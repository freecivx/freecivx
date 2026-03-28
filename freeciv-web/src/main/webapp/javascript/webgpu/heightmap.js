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
// Terrain-type height targets.  All values in [0,1] where the shader uses
// WATER_LEVEL = 50.0 (vertex z = height * 100).  Moderate ranges keep
// slopes natural and avoid overly jagged terrain.
// ---------------------------------------------------------------------------
var TERRAIN_HEIGHT_OCEAN_DEEP  = 0.44;  // deep ocean
var TERRAIN_HEIGHT_OCEAN_COAST = 0.45;  // ocean adjacent to land
var TERRAIN_HEIGHT_BEACH       = 0.55;  // land adjacent to ocean
var TERRAIN_HEIGHT_FLAT        = 0.52;  // grassland / plains / desert / tundra / arctic / unknown
var TERRAIN_HEIGHT_FOREST_MIN  = 0.54;  // forest / jungle lower bound
var TERRAIN_HEIGHT_FOREST_MAX  = 0.57;  // forest / jungle upper bound
var TERRAIN_HEIGHT_HILLS_MIN   = 0.57;  // hills lower bound
var TERRAIN_HEIGHT_HILLS_MAX   = 0.63;  // hills upper bound
var TERRAIN_HEIGHT_MOUNT_MIN   = 0.63;  // mountains lower bound
var TERRAIN_HEIGHT_MOUNT_MAX   = 0.72;  // mountains upper bound

/****************************************************************************
  Return the visual height for a tile based on terrain type.
  Uses ptile['height'] (server-provided, 0-1) to vary within each type's band.
****************************************************************************/
function get_terrain_target_height(ptile) {
  if (ptile == null || tile_terrain(ptile) == null) return TERRAIN_HEIGHT_FLAT;
  var raw_h = ptile['height'] || TERRAIN_HEIGHT_FLAT;
  // Normalise to [0,1] within the "above water" band [0.5, 1.0].
  var above = Math.max(0, Math.min(1, (raw_h - 0.50) * 2.0));
  var tname = tile_terrain(ptile)['name'];
  if (tname === "Mountains") {
    return TERRAIN_HEIGHT_MOUNT_MIN + above * (TERRAIN_HEIGHT_MOUNT_MAX - TERRAIN_HEIGHT_MOUNT_MIN);
  } else if (tname === "Hills") {
    return TERRAIN_HEIGHT_HILLS_MIN + above * (TERRAIN_HEIGHT_HILLS_MAX - TERRAIN_HEIGHT_HILLS_MIN);
  } else if (tname === "Forest" || tname === "Jungle") {
    return TERRAIN_HEIGHT_FOREST_MIN + above * (TERRAIN_HEIGHT_FOREST_MAX - TERRAIN_HEIGHT_FOREST_MIN);
  }
  // Flat: Grassland, Plains, Desert, Tundra, Arctic, Swamp
  return TERRAIN_HEIGHT_FLAT + above * 0.02;
}

/****************************************************************************
  Returns true when a tile has flat terrain (grassland, plains, desert, …).
  Flat tiles use constant height so their normals are perfectly horizontal.
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
  1. Compute per-tile target height from terrain type (no ptile mutation).
  2. Propagate heights to unknown/fogged tiles from known neighbours.
  3. Build the heightmap array: flat tiles use an average for constant
     z-values (clean normals); detail tiles use IDW for smooth blending.
     Mountains get a very subtle per-point variation (±0.012) for texture.
****************************************************************************/
function update_heightmap(heightmap_quality)
{
  var hm_res_x = map.xsize * heightmap_quality + 1;
  var hm_res_y = map.ysize * heightmap_quality + 1;

  // --- Phase 1: per-tile target heights (does not modify ptile['height']) --
  var tile_h = new Float32Array(map.xsize * map.ysize);

  for (var ty = 0; ty < map.ysize; ty++) {
    for (var tx = 0; tx < map.xsize; tx++) {
      var ptile = map_pos_to_tile(tx, ty);
      var idx   = ty * map.xsize + tx;
      if (tile_get_known(ptile) == TILE_UNKNOWN) {
        tile_h[idx] = -1; // sentinel; filled in phase 2
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

  // --- Phase 2: propagate to unknown tiles from 8-connected known neighbours
  for (var ty = 0; ty < map.ysize; ty++) {
    for (var tx = 0; tx < map.xsize; tx++) {
      var idx = ty * map.xsize + tx;
      if (tile_h[idx] >= 0) continue;
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          var nx = tx + dx, ny = ty + dy;
          if (nx >= 0 && nx < map.xsize && ny >= 0 && ny < map.ysize) {
            if (tile_h[ny * map.xsize + nx] >= 0) {
              tile_h[idx] = TERRAIN_HEIGHT_FLAT;
              break;
            }
          }
        }
        if (tile_h[idx] >= 0) break;
      }
      if (tile_h[idx] < 0) tile_h[idx] = TERRAIN_HEIGHT_FLAT;
    }
  }

  // --- Phase 3: build heightmap array with sub-tile interpolation ----------
  var CTX = [0, 0, 1, 1]; // corner offsets for 4-corner IDW
  var CTY = [0, 1, 0, 1];

  for (var hx = 0; hx < hm_res_x; hx++) {
    for (var hy = 0; hy < hm_res_y; hy++) {
      var index = hy * hm_res_x + hx;
      var gx    = hx / heightmap_quality - 0.5;
      var gy    = hy / heightmap_quality - 0.5;
      var igx   = Math.round(gx);
      var igy   = Math.round(gy);

      if (igx === gx && igy === gy) {
        // Exact tile-centre sample
        if (igx >= 0 && igx < map.xsize && igy >= 0 && igy < map.ysize) {
          heightmap[index] = tile_h[igy * map.xsize + igx];
        }
      } else {
        var flx = Math.floor(gx), fly = Math.floor(gy);

        // Fast path: if every reachable corner is flat/ocean/unknown,
        // write the average height (perfect flat normals, no IDW needed).
        var allFlat = true;
        for (var ci = 0; ci < 4; ci++) {
          var ctx = flx + CTX[ci], cty = fly + CTY[ci];
          if (ctx < 0 || ctx >= map.xsize || cty < 0 || cty >= map.ysize) continue;
          var ct = map_pos_to_tile(ctx, cty);
          if (tile_get_known(ct) != TILE_UNKNOWN && !is_flat_terrain(ct) && !is_ocean_tile(ct)) {
            allFlat = false; break;
          }
        }

        if (allFlat) {
          var flatSum = 0, flatCnt = 0;
          for (var ci = 0; ci < 4; ci++) {
            var ctx = flx + CTX[ci], cty = fly + CTY[ci];
            if (ctx >= 0 && ctx < map.xsize && cty >= 0 && cty < map.ysize) {
              flatSum += tile_h[cty * map.xsize + ctx]; flatCnt++;
            }
          }
          heightmap[index] = flatCnt > 0 ? flatSum / flatCnt : TERRAIN_HEIGHT_FLAT;
        } else {
          // IDW for terrain-varied regions; mountains get subtle variation.
          var norm = 0, wsum = 0;
          for (var ci = 0; ci < 4; ci++) {
            var ctx = flx + CTX[ci], cty = fly + CTY[ci];
            if (ctx < 0 || ctx >= map.xsize || cty < 0 || cty >= map.ysize) continue;
            var dx = gx - ctx, dy = gy - cty;
            var distSq = dx * dx + dy * dy;
            if (distSq < 1e-10) { norm = 1; wsum = tile_h[cty * map.xsize + ctx]; break; }
            var h = tile_h[cty * map.xsize + ctx];
            // Very subtle per-point variation for mountains (±0.012)
            var ct = map_pos_to_tile(ctx, cty);
            if (tile_get_known(ct) != TILE_UNKNOWN && tile_terrain(ct)['name'] === "Mountains") {
              var rnd = ((hx * 7 + hy * 13) % 31) / 31.0;
              h += (rnd - 0.5) * 0.024;
            }
            wsum += h / distSq;
            norm += 1.0 / distSq;
          }
          heightmap[index] = norm > 0 ? wsum / norm : TERRAIN_HEIGHT_FLAT;
        }
      }
    }
  }
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

