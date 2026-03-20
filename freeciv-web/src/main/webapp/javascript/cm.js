/**********************************************************************
    Freecivx.com - the web version of Freeciv. https://www.freecivx.com/
    Copyright (C) 2024 Freecivx.com

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

***********************************************************************/

/**
 * JavaScript City Governor (CM) - client-side citizen management.
 *
 * Implements a greedy tile-assignment algorithm equivalent to (and inspired
 * by) freeciv/common/aicore/cm.c.  Running the search entirely in JS means
 * the governor can respond immediately without a server round-trip.
 *
 * Algorithm overview:
 *   1. Build a list of every tile reachable from the city centre, together
 *      with its raw food/shield/trade output (supplied by the server in the
 *      PACKET_WEB_CITY_INFO_ADDITION arrays output_food/shield/trade).
 *   2. Score each tile: weighted sum of outputs, where trade is split into
 *      gold/luxury/science according to the player's current tax rates.
 *   3. Sort tiles by score (highest first); the city-centre tile is always
 *      free-worked and is excluded from the assignable pool.
 *   4. Assign workers to the best (city_size - 1) tiles.  If specialists
 *      are allowed and the best specialist type outscores the marginal tile,
 *      replace that worker with a specialist.
 *   5. Send PACKET_CITY_MAKE_WORKER / PACKET_CITY_MAKE_SPECIALIST deltas so
 *      only changed tiles produce network traffic.
 *
 * See also: cma.js (UI layer that stores per-city governor parameters and
 * calls cm_run_governor / cm_apply_result).
 */

/* -------------------------------------------------------------------------
 * Default specialist output values.
 * Indexed as CM_SPECIALIST_OUTPUTS[specialist_id][O_*].
 * Values match the webperimental/classic effects.ruleset:
 *   entertainer (elvis) → 2 luxury
 *   scientist           → 3 science
 *   taxman              → 3 gold
 * If the server sends different values via effects these could be overridden.
 * -------------------------------------------------------------------------*/
var CM_SPECIALIST_OUTPUTS = [
  /* [food, shield, trade, gold, luxury, science] */
  [0, 0, 0, 0, 2, 0],   /* 0 – entertainer / elvis */
  [0, 0, 0, 0, 0, 3],   /* 1 – scientist            */
  [0, 0, 0, 3, 0, 0],   /* 2 – taxman               */
];

/* Per-city governor state:  cm_city_params[city_id] = {enabled, parameter} */
var cm_city_params = {};


/* =========================================================================
 * Internal helpers
 * =========================================================================*/

/**
 * Compute the weighted score for a tile's raw output given cm_parameter and
 * the player's current tax/luxury/science rates (0-100 integers).
 */
function cm_tile_score(food, shield, trade, param, tax_pct, lux_pct, sci_pct)
{
  /* Trade converts to gold/luxury/science at the current tax rates.
   * The cm_parameter factor for O_TRADE adds direct weight on top of that. */
  var trade_score = trade * (
      param['factor'][O_TRADE]
    + param['factor'][O_GOLD]    * tax_pct / 100.0
    + param['factor'][O_LUXURY]  * lux_pct / 100.0
    + param['factor'][O_SCIENCE] * sci_pct / 100.0
  );
  return param['factor'][O_FOOD]   * food
       + param['factor'][O_SHIELD] * shield
       + trade_score;
}

/**
 * Compute the weighted score for one specialist slot of the given type.
 * Unlike tiles, specialist output is already in final units (gold, luxury,
 * science), so no tax-rate conversion is needed.
 */
function cm_specialist_score(spec_idx, param)
{
  var s = CM_SPECIALIST_OUTPUTS[spec_idx];
  if (!s) return -Infinity;
  return param['factor'][O_FOOD]    * s[O_FOOD]
       + param['factor'][O_SHIELD]  * s[O_SHIELD]
       + param['factor'][O_TRADE]   * s[O_TRADE]
       + param['factor'][O_GOLD]    * s[O_GOLD]
       + param['factor'][O_LUXURY]  * s[O_LUXURY]
       + param['factor'][O_SCIENCE] * s[O_SCIENCE];
}

/**
 * Return the index of the best specialist type for the given cm_parameter,
 * together with that type's score.  Returns {idx, score}.
 */
function cm_best_specialist(param, num_spec_types)
{
  var best_idx   = 0;
  var best_score = -Infinity;
  var max_idx    = Math.min(num_spec_types || 3, CM_SPECIALIST_OUTPUTS.length);
  for (var sp = 0; sp < max_idx; sp++) {
    var s = cm_specialist_score(sp, param);
    if (s > best_score) {
      best_score = s;
      best_idx   = sp;
    }
  }
  return { idx: best_idx, score: best_score };
}

/**
 * Build and return the list of tiles that this city *can* work, including
 * their raw food/shield/trade values from the server-supplied arrays.
 * The city-centre tile is tagged as is_center = true.
 *
 * Each element: { tile_id, sorted_idx, is_center, food, shield, trade, score }
 * (score is computed separately and filled in by cm_query_result).
 */
function cm_get_city_tiles(pcity)
{
  var ctile = city_tile(pcity);
  if (ctile == null || pcity['output_food'] == null) return [];

  build_city_tile_map(pcity['city_radius_sq'] || 5);
  var tilemap = get_city_tile_map_for_pos(ctile['x'], ctile['y']);

  var result = [];

  for (var i = 0; i < city_tile_map.base_sorted.length; i++) {
    var vec      = city_tile_map.base_sorted[i];
    var dx       = vec[0];
    var dy       = vec[1];
    var is_center = (dx === 0 && dy === 0);

    var center_idx  = dxy_to_center_index(dx, dy, city_tile_map.radius);
    var sorted_idx  = (tilemap && tilemap[center_idx] !== undefined)
                        ? tilemap[center_idx] : i;

    var ptile = map_pos_to_tile(ctile['x'] + dx, ctile['y'] + dy);
    if (ptile == null) continue;

    /* A tile is available to this city if it isn't already worked by another
     * city (worked == null means unworked; worked == pcity['id'] is fine). */
    var worked_by = ptile['worked'];
    var can_work  = is_center
                  || worked_by == null
                  || worked_by === pcity['id'];
    if (!can_work) continue;

    var food   = (pcity['output_food']   && pcity['output_food'][sorted_idx])   || 0;
    var shield = (pcity['output_shield'] && pcity['output_shield'][sorted_idx]) || 0;
    var trade  = (pcity['output_trade']  && pcity['output_trade'][sorted_idx])  || 0;

    result.push({
      tile_id    : ptile['index'],
      sorted_idx : sorted_idx,
      is_center  : is_center,
      food       : food,
      shield     : shield,
      trade      : trade,
      score      : 0    /* filled in below */
    });
  }

  return result;
}


/* =========================================================================
 * Public API
 * =========================================================================*/

/**
 * cm_query_result(pcity, param)
 *
 * Run the city governor for the given city and cm_parameter.
 * Returns an object:
 *   { found_a_valid: bool,
 *     worked_tiles: [tile_id, ...],   // non-centre tiles to assign workers to
 *     specialist_counts: [n0, n1, n2] // number of each specialist type
 *   }
 * or null if the city data is missing.
 *
 * This is a greedy (not branch-and-bound) algorithm; it runs in O(T log T)
 * where T ≤ 21 tiles, which is instantaneous in the browser.
 */
function cm_query_result(pcity, param)
{
  if (pcity == null || param == null) return null;
  if (pcity['output_food'] == null)   return null;

  var ctile = city_tile(pcity);
  if (ctile == null) return null;

  /* --- Tax rates -------------------------------------------------------- */
  var pplayer  = city_owner(pcity);
  var tax_pct  = pplayer ? (pplayer['tax']     || 30) : 30;
  var lux_pct  = pplayer ? (pplayer['luxury']  || 30) : 30;
  var sci_pct  = pplayer ? (pplayer['science'] || 40) : 40;

  /* --- Tile list with scores -------------------------------------------- */
  var tile_list = cm_get_city_tiles(pcity);
  if (tile_list.length === 0) return null;

  for (var i = 0; i < tile_list.length; i++) {
    var t = tile_list[i];
    t.score = cm_tile_score(t.food, t.shield, t.trade,
                            param, tax_pct, lux_pct, sci_pct);
  }

  /* Sort non-centre tiles by score (descending). */
  var assignable = tile_list.filter(function(t) { return !t.is_center; });
  assignable.sort(function(a, b) { return b.score - a.score; });

  /* --- Specialist best-type -------------------------------------------- */
  var num_spec_types = pcity['specialists_size'] || CM_SPECIALIST_OUTPUTS.length;
  var allow_specs    = param['allow_specialists'] !== false; /* default true */
  var best_spec      = allow_specs
                         ? cm_best_specialist(param, num_spec_types)
                         : { idx: 0, score: -Infinity };

  /* --- Greedy assignment ------------------------------------------------ */
  var city_size        = pcity['size'] || 1;
  var workers_needed   = city_size - 1;   /* centre is always free-worked */
  var worked_tiles     = [];
  var specialist_counts = [0, 0, 0];
  var remaining        = workers_needed;

  for (var j = 0; j < assignable.length && remaining > 0; j++) {
    var tile = assignable[j];

    /* If the best specialist beats this (marginal) tile, turn all remaining
     * workers into specialists of the best type. */
    if (allow_specs && best_spec.score > tile.score) {
      break;   /* fill remainder as specialists below */
    }

    worked_tiles.push(tile.tile_id);
    remaining--;
  }

  /* Remaining unassigned workers become specialists. */
  if (remaining > 0 && allow_specs) {
    var sidx = best_spec.idx;
    if (sidx < specialist_counts.length) {
      specialist_counts[sidx] += remaining;
    }
    remaining = 0;
  }

  return {
    found_a_valid     : true,
    worked_tiles      : worked_tiles,
    specialist_counts : specialist_counts
  };
}

/**
 * cm_apply_result(pcity, result)
 *
 * Apply a governor result to the city by sending the minimal set of
 * PACKET_CITY_MAKE_WORKER and PACKET_CITY_MAKE_SPECIALIST packets required
 * to move from the current tile assignment to the desired one.
 */
function cm_apply_result(pcity, result)
{
  if (pcity == null || result == null || !result.found_a_valid) return;

  var city_id      = pcity['id'];
  var center_tile  = pcity['tile'];   /* always free-worked – never touch */
  var desired      = {};
  for (var k = 0; k < result.worked_tiles.length; k++) {
    desired[result.worked_tiles[k]] = true;
  }

  /* Find which tiles this city currently works (excluding the centre). */
  var currently_worked = {};
  for (var tile_idx in tiles) {
    var pt = tiles[tile_idx];
    if (pt && pt['worked'] == city_id && pt['index'] != center_tile) {
      currently_worked[pt['index']] = true;
    }
  }

  /* Release tiles that should no longer be worked. */
  for (var tid in currently_worked) {
    tid = parseInt(tid, 10);
    if (!desired[tid]) {
      send_request(JSON.stringify({
        "pid"     : packet_city_make_specialist,
        "city_id" : city_id,
        "tile_id" : tid
      }));
    }
  }

  /* Claim tiles that should now be worked. */
  for (var wid in desired) {
    wid = parseInt(wid, 10);
    if (!currently_worked[wid]) {
      send_request(JSON.stringify({
        "pid"     : packet_city_make_worker,
        "city_id" : city_id,
        "tile_id" : wid
      }));
    }
  }
}

/**
 * cm_run_governor(pcity)
 *
 * Run the city governor for the given city if it has an enabled governor
 * parameter stored in cm_city_params.  Called after receiving updated city
 * data from the server so the assignment stays optimal each turn.
 */
function cm_run_governor(pcity)
{
  if (pcity == null) return;
  if (client.conn == null || client.conn.playing == null) return;
  if (city_owner_player_id(pcity) !== client.conn.playing.playerno) return;

  var city_id = pcity['id'];
  var state   = cm_city_params[city_id];
  if (!state || !state['enabled']) return;

  var result = cm_query_result(pcity, state['parameter']);
  if (result && result.found_a_valid) {
    cm_apply_result(pcity, result);
  }
}
