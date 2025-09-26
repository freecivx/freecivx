/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivX.net/
    Copyright (C) 2009-2015  The Freeciv-web project

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


var units = {};

/* Depends on the ruleset. Comes in the packet ruleset_terrain_control.
 * Set in handle_ruleset_terrain_control(). */
var SINGLE_MOVE;

var ANIM_STEPS = 6;

/* The unit_orders enum from unit.h */
var ORDER_MOVE = 0;
var ORDER_ACTIVITY = 1;
var ORDER_FULL_MP = 2;
var ORDER_ACTION_MOVE = 3;
var ORDER_PERFORM_ACTION = 4;
var ORDER_LAST = 5;

/* The unit_ss_data_type enum from unit.h */
var USSDT_QUEUE = 0;
var USSDT_UNQUEUE = 1;
var USSDT_BATTLE_GROUP = 2;
var USSDT_SENTRY = 3;

/* enum server_side_agent */
var SSA_NONE = 0;
var SSA_AUTOSETTLER = 1;
var SSA_AUTOEXPLORE = 2;
var SSA_COUNT = 3;

/****************************************************************************
 ...
****************************************************************************/
function idex_lookup_unit(id)
{
  return units[id];
}

/****************************************************************************
 ...
****************************************************************************/
function unit_owner(punit)
{
  return player_by_number(punit['owner']);
}


/****************************************************************************
 ...
****************************************************************************/
function client_remove_unit(punit)
{
  control_unit_killed(punit);

  if (unit_is_in_focus(punit)) {
    current_focus = [];
    webgl_clear_unit_focus();
  }

  delete units[punit['id']];
}

/**************************************************************************
 Returns a list of units on the given tile. See update_tile_unit().
**************************************************************************/
function tile_units(ptile)
{
  if (ptile == null) return null;
  return ptile['units'];
}

/**************************************************************************
 Returns a list of units supported by this city.
**************************************************************************/
function get_supported_units(pcity)
{
  if (pcity == null) return null;
  var result = [];
  for (var unit_id in units) {
    var punit = units[unit_id];
    if (punit['homecity'] == pcity['id']) {
      result.push(punit);
    }
  }
  return result;
}


/**************************************************************************
 Updates the index of which units can be found on a tile.
 Note: This must be called after a unit has moved to a new tile.
 See: clear_tile_unit()
**************************************************************************/
function update_tile_unit(punit)
{
  if (punit == null) return;

  var found = false;
  var ptile = index_to_tile(punit['tile']);

  if (ptile == null || ptile['units'] == null) return;

  for (var i = 0; i <  ptile['units'].length; i++) {
    if (ptile['units'][i]['id'] == punit['id']) {
      found = true;
    }
  }

  if (!found) {
    ptile['units'].push(punit);
  }
}

/**************************************************************************
 Updates the index of which units can be found on a tile.
 Note: This must be called before a unit has moved to a new tile.
**************************************************************************/
function clear_tile_unit(punit)
{
  if (punit == null) return;
  var ptile = index_to_tile(punit['tile']);
  if (ptile == null || ptile['units'] == null) return -1;

  if (ptile['units'].indexOf(punit) >= 0) {
    ptile['units'].splice(ptile['units'].indexOf(punit), 1);
  }
}

/**************************************************************************
  Returns the length of the unit list
**************************************************************************/
function unit_list_size(unit_list)
{
  if (unit_list == null) return 0;
  return unit_list.length;
}

/**************************************************************************
  Returns the unit list with the specified unit removed.
**************************************************************************/
function unit_list_without(unit_list, punit)
{
  return unit_list.filter(function(funit, index, c_focus) {
    return funit['id'] != punit['id'];
  });
}

/**************************************************************************
  Returns the type of the unit.
**************************************************************************/
function unit_type(punit)
{
  return unit_types[punit['type']];
}

/**************************************************************************
  Return TRUE iff this unit can do the specified generalized (ruleset
  defined) action enabler controlled action.
**************************************************************************/
function unit_can_do_action(punit, act_id)
{
  return utype_can_do_action(unit_type(punit), act_id);
}

/**************************************************************************
  Returns a string saying how many moves a unit has left.
**************************************************************************/
function get_unit_moves_left(punit)
{
  if (punit == null) {
    return 0;
  }

  return "Moves:" + move_points_text(punit['movesleft']);
}

/**************************************************************************
  Returns an amount of movement formated for player readability.
**************************************************************************/
function move_points_text(moves)
{
  var result = "";

  if ((moves % SINGLE_MOVE) != 0) {
    if (Math.floor(moves / SINGLE_MOVE) > 0) {
      result = Math.floor(moves / SINGLE_MOVE)
               + " " + Math.floor(moves % SINGLE_MOVE)
               + "/" + SINGLE_MOVE;
    } else {
      result = Math.floor(moves % SINGLE_MOVE)
               + "/" + SINGLE_MOVE;
    }
  } else {
    result = Math.floor(moves / SINGLE_MOVE);
  }

  return result;
}

/**************************************************************************
  ...
**************************************************************************/
function unit_has_goto(punit)
{
  /* don't show goto activity for enemy units. I'm not 100% sure this is correct.  */
  if (client.conn.playing == null || punit['owner'] != client.conn.playing.playerno) {
    return false;
  }

  return (punit['goto_tile'] != -1);
}


/**************************************************************************
  Determines the unit_anim_list for the specified unit (old and new unit).
**************************************************************************/
function update_unit_anim_list(old_unit, new_unit)
{
  var anim_tuple;
  if (old_unit == null || new_unit == null) return;
  /* unit is in same position. */
  if (new_unit['tile'] == old_unit['tile']) return;

  if (old_unit['anim_list'] == null) old_unit['anim_list'] = [];

  if (new_unit['transported'] == true) {
    /* don't show transported units animated. */
    old_unit['anim_list'] = [];
    return;
  }

  var has_old_pos = false;
  var has_new_pos = false;
  for (var i = 0; i <  old_unit['anim_list'].length; i++) {
    anim_tuple = old_unit['anim_list'][i];
    if (anim_tuple['tile'] == old_unit['tile']) {
      has_old_pos = true;
    }
    if (anim_tuple['tile'] == new_unit['tile']) {
      has_new_pos = true;
    }
  }

  if (!has_old_pos) {
    anim_tuple = {};
    anim_tuple['tile'] = old_unit['tile'];
    anim_tuple['i'] = ANIM_STEPS;
    old_unit['anim_list'].push(anim_tuple);
  }

  if (!has_new_pos) {
    anim_tuple = {};
    anim_tuple['tile'] = new_unit['tile'];
    anim_tuple['i'] = ANIM_STEPS;
    old_unit['anim_list'].push(anim_tuple);
  }
}

/**************************************************************************
  Determines the pixel offset for the specified unit, based on the units
  anim list. This is how Freeciv-web does unit animations.
**************************************************************************/
function get_unit_anim_offset(punit)
{
  var offset = {};

  offset['x'] = 0;
  offset['y'] = 0;

  return offset;

}

/**************************************************************************
 Resets the unit anim list, every turn.
**************************************************************************/
function reset_unit_anim_list()
{
 for (var unit_id in units) {
    var punit = units[unit_id];
    punit['anim_list'] = [];
  }
}

/**************************************************************************
  Returns the name of the unit's homecity.
**************************************************************************/
function get_unit_homecity_name(punit)
{
  if (punit['homecity'] != 0 && cities[punit['homecity']] != null) {
    return decodeURIComponent(cities[punit['homecity']]['name']);
  } else {
    return null;
  }
}

/**************************************************************************
  Determines if unit is visible
**************************************************************************/
function is_unit_visible(punit)
{
  if (punit == null || punit['tile'] == null) return false;
  return false;  // TODO: not supported by 3D version.

}

/**************************************************************************
 Returns a list containing the unittype ids sorted by unittype name.
**************************************************************************/
function unittype_ids_alphabetic()
{
  var unittype_names = [];
  var unit_id;
  for (unit_id in unit_types) {
    var punit_type = unit_types[unit_id];
    unittype_names.push(punit_type['name']);
  }

  unittype_names.sort();

  var unittype_id_list = [];
  for (var n in unittype_names) {
    var unit_name = unittype_names[n];
    for (unit_id in unit_types) {
      punit_type = unit_types[unit_id];
      if (unit_name == punit_type['name']) {
        unittype_id_list.push(unit_id);
      }
    }
  }
  return unittype_id_list;
}

/**************************************************************************
 Returns a text about the unit to be shown in the city dialog, containing
 unit type name, home city, upkeep.
**************************************************************************/
function get_unit_city_info(punit)
{
  var result = "";

  var ptype = unit_type(punit);

  result += ptype['name'] + "\nFood/Shield/Gold: ";

  if (punit['upkeep'] != null) {
    result += punit['upkeep'][O_FOOD] + "/"
           + punit['upkeep'][O_SHIELD] + "/"
           + punit['upkeep'][O_GOLD];
  }

  result += "\n" + get_unit_moves_left(punit) + "\n";

  if (get_unit_homecity_name(punit) != null) {
    result += get_unit_homecity_name(punit);
  }

  return result;
}

/**************************************************************************
 Returns a list of extras a unit can pillage from a tile.
 It is empty if the unit can't pillage or there's nothing to.
 Contains just EXTRA_NONE if there's something but the unit can't choose.
**************************************************************************/
function get_what_can_unit_pillage_from(punit, ptile)
{
  var i, j;
  var extra;
  var targets = [];
  if (punit == null) return targets;

  /* If no tile is given, use the one the unit is on */
  if (ptile == null) {
    ptile = index_to_tile(punit.tile);
  }

  if (terrains[ptile.terrain].pillage_time == 0) return targets;
  if (!utype_can_do_action(unit_type(punit), ACTION_PILLAGE)) return targets;

  var available = ptile.extras.toBitSet();
  var cannot_pillage = new BitVector([]);

  /* Get what other units are pillaging on the tile */
  for (const unit_idx in Object.keys(ptile.units)) {
    const unit = ptile.units[unit_idx];
    if (unit.activity === ACTIVITY_PILLAGE) {
      cannot_pillage.set(unit.activity_tgt);
    }
  }

  /* Get what extras that are dependencies of other */
  for (i = 0; i < available.length; i++) {
    extra = extras[available[i]];
    for (j = 0; j < extra.reqs.length; j++) {
      var req = extra.reqs[j];
      if (req.kind == VUT_EXTRA && req.present == true) {
        cannot_pillage.set(req.value);
      }
    }
  }

  // TODO: more things to check?

  for (i = 0; i < available.length; i++) {
    extra = available[i];
    if (is_extra_removed_by(extras[extra], ERM_PILLAGE)
        && !cannot_pillage.isSet(extra)) {
      if (game_info.pillage_select) {
        targets.push(extra);
      } else {
        targets.push(EXTRA_NONE);
        break;
      }
    }
  }

  return targets;
}

