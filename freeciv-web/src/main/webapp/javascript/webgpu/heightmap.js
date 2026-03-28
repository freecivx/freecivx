/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.freecivx.com/
    Copyright (C) 2009-2022  The Freeciv-web project

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


var heightmap = null;
var heightmap_hash = -1;

// ---------------------------------------------------------------------------
// Terrain-type height targets.  All values in the [0,1] range where 0.50 is
// exactly water level (shader WATER_LEVEL = 50.0 → vertex z = height * 100).
// ---------------------------------------------------------------------------
var TERRAIN_HEIGHT_OCEAN_DEEP  = 0.44;  // deep ocean
var TERRAIN_HEIGHT_OCEAN_COAST = 0.45;  // ocean tile adjacent to land
var TERRAIN_HEIGHT_BEACH       = 0.55;  // land tile adjacent to ocean
var TERRAIN_HEIGHT_FLAT        = 0.52;  // grassland / plains / desert / tundra / arctic / unknown
var TERRAIN_HEIGHT_FOREST      = 0.55;  // forest / jungle
var TERRAIN_HEIGHT_HILLS_MIN   = 0.62;  // hills lower bound
var TERRAIN_HEIGHT_HILLS_MAX   = 0.72;  // hills upper bound
var TERRAIN_HEIGHT_MOUNT_MIN   = 0.76;  // mountains lower bound
var TERRAIN_HEIGHT_MOUNT_MAX   = 0.92;  // mountains upper bound

/****************************************************************************
  Return the visual height target for a tile based on its terrain type.
  'above_water' maps the server's raw height (which is already terrain-typed)
  into a [0,1] proportion inside the terrain's own height band.
****************************************************************************/
function get_terrain_target_height(ptile) {
  if (ptile == null || tile_terrain(ptile) == null) return TERRAIN_HEIGHT_FLAT;
  var raw_h = ptile['height'] || 0.52;
  var above = Math.max(0, Math.min(1, (raw_h - 0.50) * 2.0));
  switch (tile_terrain(ptile)['name']) {
    case "Mountains":
      return TERRAIN_HEIGHT_MOUNT_MIN + above * (TERRAIN_HEIGHT_MOUNT_MAX - TERRAIN_HEIGHT_MOUNT_MIN);
    case "Hills":
      return TERRAIN_HEIGHT_HILLS_MIN + above * (TERRAIN_HEIGHT_HILLS_MAX - TERRAIN_HEIGHT_HILLS_MIN);
    case "Forest":
    case "Jungle":
      return TERRAIN_HEIGHT_FOREST + above * 0.06;
    default:   // Grassland, Plains, Desert, Tundra, Arctic, Swamp
      return TERRAIN_HEIGHT_FLAT + above * 0.02;
  }
}

/****************************************************************************
  Returns true if a tile has flat terrain (grassland, plains, desert …).
  Flat tiles do not need sub-tile height variation.
****************************************************************************/
function is_flat_terrain(ptile) {
  if (ptile == null || tile_terrain(ptile) == null) return true;
  var n = tile_terrain(ptile)['name'];
  return n !== "Mountains" && n !== "Hills" && n !== "Forest" && n !== "Jungle";
}

/****************************************************************************
  Returns height offset for units. This will make units higher above cities.
  @param {Unit} punit - The unit to get the height offset for.
  @returns {number} The height offset in world units.
****************************************************************************/
function get_unit_height_offset(punit)
{
  if (punit == null) return 0;
  let ptile = index_to_tile(punit['tile']);
  if (ptile == null) return 0;
  let ptype = unit_type(punit);

  if (ptype['name'] == "Caravel") {
    return 7;
  }

  if (ptype['name'] == "Galleon") {
    return 5.4;
  }

  if (ptype['name'] == "Frigate") {
    return 7.2;
  }

  if (ptype['name'] == "Destroyer") {
    return 4.0;
  }
  if (ptype['name'] == "Battleship") {
    return 4.0;
  }
  if (ptype['name'] == "Transport") {
    return 4.0;
  }
  if (ptype['name'] == "Fighter") {
    return 18.0;
  }
  if (ptype['name'] == "Bomber") {
    return 18.0;
  }
  if (ptype['name'] == "Helicopter") {
    return 12.0;
  }
  if (ptype['name'] == "Cruiser") {
    return 4.0;
  }
  if (ptype['name'] == "Ironclad") {
    return 4.2;
  }

  if (ptype['name'] == "Zeppelin") {
    return 28;
  }

  if (!is_ocean_tile(ptile) && is_ocean_tile_near(ptile)) {
    return -4;
  }

  if (tile_terrain(ptile)['name'] == "Hills" || tile_terrain(ptile)['name'] == "Mountains") {
    return -5;
  }


  let pcity = tile_city(ptile);
  if (pcity != null) return 4;

  return -2;

}

/****************************************************************************
...
  @param {Tile} ptile - The tile to get the forest height offset for.
  @returns {number} The height offset for forest terrain on this tile.
****************************************************************************/
function get_forest_offset(ptile)
{
    if (!is_ocean_tile(ptile) && is_ocean_tile_near(ptile)) {
      if (tile_terrain(ptile)['name'] == "Hills") {
        return  -8;
      } else if (tile_terrain(ptile)['name'] == "Mountains") {
        return -12;
      } else {
        return  -7;
      }
    }

    return -6;

}

/****************************************************************************
  Returns height offset for cities.
  @param {City} pcity - The city to get the height offset for.
  @returns {number} The height offset in world units.
****************************************************************************/
function get_city_height_offset(pcity)
{
  if (pcity == null) return 0;
  let ptile = index_to_tile(pcity['tile']);
  if (ptile == null) return 0;

  if (!is_ocean_tile(ptile) && is_ocean_tile_near(ptile)) {
    if (tile_terrain(ptile)['name'] == "Hills") return -6;
    if (tile_terrain(ptile)['name'] == "Mountains") return -10;
    return -2.2;
  }

  if (tile_terrain(ptile) != null) {
    if (tile_terrain(ptile)['name'] == "Hills") return -6;
    if (tile_terrain(ptile)['name'] == "Mountains") return -10;
  }

  return 1.8;

}

/****************************************************************************
  Create heightmap based on tile.height.
****************************************************************************/
function init_heightmap(heightmap_quality)
{
  let heightmap_resolution_x = map.xsize * heightmap_quality + 1;
  let heightmap_resolution_y = map.ysize * heightmap_quality + 1;

  heightmap = new Float32Array(heightmap_resolution_x * heightmap_resolution_y);

}

/****************************************************************************
  Create heightmap based on tile.height for hexagonal topology.

  Three-phase algorithm:
  1. Compute per-tile target height from terrain type (does NOT modify ptile).
  2. Propagate heights to unknown tiles from their known neighbours.
  3. Build the heightmap array using IDW for non-flat tiles (mountains /
     hills / forests get realistic sub-tile variation) and a direct constant
     for flat tiles (no wasted variation on grassland, plains, etc.).
****************************************************************************/
function update_heightmap(heightmap_quality)
{
  var hm_res_x = map.xsize * heightmap_quality + 1;
  var hm_res_y = map.ysize * heightmap_quality + 1;

  console.log("Updating heightmap (hex topology)...");

  // --- Phase 1: per-tile target heights -----------------------------------
  var tile_h = new Float32Array(map.xsize * map.ysize);

  for (var ty = 0; ty < map.ysize; ty++) {
    for (var tx = 0; tx < map.xsize; tx++) {
      var ptile = map_pos_to_tile(tx, ty);
      var idx   = ty * map.xsize + tx;
      if (tile_get_known(ptile) == TILE_UNKNOWN) {
        tile_h[idx] = -1; // sentinel – filled in phase 2
      } else if (is_ocean_tile(ptile)) {
        tile_h[idx] = is_land_tile_near(ptile) ? TERRAIN_HEIGHT_OCEAN_COAST
                                                : TERRAIN_HEIGHT_OCEAN_DEEP;
      } else if (is_ocean_tile_near(ptile)) {
        tile_h[idx] = TERRAIN_HEIGHT_BEACH;
      } else {
        tile_h[idx] = get_terrain_target_height(ptile);
      }
    }
  }

  // --- Phase 2: propagate to unknown tiles --------------------------------
  var NB8 = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  for (var ty = 0; ty < map.ysize; ty++) {
    for (var tx = 0; tx < map.xsize; tx++) {
      var idx = ty * map.xsize + tx;
      if (tile_h[idx] >= 0) continue;
      for (var k = 0; k < 8; k++) {
        var nx = tx + NB8[k][0], ny = ty + NB8[k][1];
        if (nx >= 0 && nx < map.xsize && ny >= 0 && ny < map.ysize) {
          var nidx = ny * map.xsize + nx;
          if (tile_h[nidx] >= 0) { tile_h[idx] = TERRAIN_HEIGHT_FLAT; break; }
        }
      }
      if (tile_h[idx] < 0) tile_h[idx] = TERRAIN_HEIGHT_FLAT;
    }
  }

  // --- Phase 3: build heightmap array with sub-tile interpolation ---------
  // Primes for a cheap deterministic per-point hash (reproducible variation).
  var HP = [7, 13, 17, 23];

  for (var hx = 0; hx < hm_res_x; hx++) {
    for (var hy = 0; hy < hm_res_y; hy++) {
      var index = hy * hm_res_x + hx;
      // gx / gy: position in tile-coordinate space (integer = tile centre)
      var gx = hx / heightmap_quality - 0.5;
      var gy = hy / heightmap_quality - 0.5;
      var igx = Math.round(gx), igy = Math.round(gy);

      if (igx === gx && igy === gy) {
        // Exact tile-centre sample
        if (igx >= 0 && igx < map.xsize && igy >= 0 && igy < map.ysize) {
          heightmap[index] = tile_h[igy * map.xsize + igx];
        }
      } else {
        // Sub-tile: IDW from 4 nearest tile centres
        var corners = [
          { tx: Math.floor(gx), ty: Math.floor(gy) },
          { tx: Math.floor(gx), ty: Math.ceil(gy)  },
          { tx: Math.ceil(gx),  ty: Math.floor(gy) },
          { tx: Math.ceil(gx),  ty: Math.ceil(gy)  }
        ];

        // Fast-path: if every reachable corner is flat / ocean / unknown,
        // skip IDW and just write the constant flat height.
        var allFlat = true;
        for (var ci = 0; ci < 4; ci++) {
          var c = corners[ci];
          if (c.tx < 0 || c.tx >= map.xsize || c.ty < 0 || c.ty >= map.ysize) continue;
          var ct = map_pos_to_tile(c.tx, c.ty);
          if (tile_get_known(ct) != TILE_UNKNOWN && !is_flat_terrain(ct) && !is_ocean_tile(ct)) {
            allFlat = false; break;
          }
        }

        if (allFlat) {
          // Flat region – constant height, no IDW needed (saves computation
          // and ensures perfectly flat normals for the GPU).
          var flatH = 0, flatCnt = 0;
          for (var ci = 0; ci < 4; ci++) {
            var c = corners[ci];
            if (c.tx >= 0 && c.tx < map.xsize && c.ty >= 0 && c.ty < map.ysize) {
              flatH += tile_h[c.ty * map.xsize + c.tx]; flatCnt++;
            }
          }
          heightmap[index] = flatCnt > 0 ? flatH / flatCnt : TERRAIN_HEIGHT_FLAT;
        } else {
          // Terrain-varied region – IDW with per-terrain variation.
          var norm = 0, sum = 0;
          for (var ci = 0; ci < 4; ci++) {
            var c = corners[ci];
            if (c.tx < 0 || c.tx >= map.xsize || c.ty < 0 || c.ty >= map.ysize) continue;
            var dx = gx - c.tx, dy = gy - c.ty;
            var distSq = dx * dx + dy * dy;
            if (distSq < 1e-10) { norm = 1; sum = tile_h[c.ty * map.xsize + c.tx]; break; }
            var h = tile_h[c.ty * map.xsize + c.tx];
            // Add deterministic sub-tile variation for mountains and hills
            var ct = map_pos_to_tile(c.tx, c.ty);
            if (tile_get_known(ct) != TILE_UNKNOWN) {
              var tname = tile_terrain(ct)['name'];
              if (tname === "Mountains") {
                var rnd = ((hx * HP[0] + hy * HP[1]) % 31) / 31.0;
                h += (rnd - 0.5) * 0.10; // ±0.05 variation
              } else if (tname === "Hills") {
                var rnd = ((hx * HP[2] + hy * HP[3]) % 19) / 19.0;
                h += (rnd - 0.5) * 0.05; // ±0.025 variation
              }
            }
            sum  += h / distSq;
            norm += 1.0 / distSq;
          }
          heightmap[index] = sum / norm;
        }
      }
    }
  }

  console.log("Heightmap updated (hex topology).");
}


/****************************************************************************
 Creates a hash of the map heightmap.
****************************************************************************/
function generate_heightmap_hash() {
  let hash = 0;

  for (let x = 0; x < map.xsize ; x++) {
    for (let y = 0; y < map.ysize; y++) {
      let ptile = map_pos_to_tile(x, y);
      hash += ptile['height']
    }
  }
  return hash;
}

