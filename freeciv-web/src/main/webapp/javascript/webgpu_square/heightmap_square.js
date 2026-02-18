/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
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

/**
 * Heightmap Generation for Square Map Tiles
 * 
 * This module provides heightmap generation specifically optimized for
 * square map tile topology. Unlike hexagonal maps, square maps:
 * - Use direct 8-neighbor connectivity (N, NE, E, SE, S, SW, W, NW)
 * - Have 1:1 aspect ratio tiles
 * - Use bilinear interpolation for sub-tile positions
 * 
 * Key differences from hex topology:
 * - Deeper rivers for better visual definition (0.95 vs 0.98 factor)
 * - Steeper river banks for narrower river appearance (1.08 vs 1.045 factor)
 * - Direct coordinate mapping without row staggering
 */

/****************************************************************************
  Create heightmap based on tile.height for square topology.
****************************************************************************/
function update_heightmap_square(heightmap_quality)
{
  let heightmap_resolution_x = map.xsize * heightmap_quality + 1;
  let heightmap_resolution_y = map.ysize * heightmap_quality + 1;

  console.log("Updating heightmap (square topology)...");

  for (let x = 0; x < map.xsize ; x++) {
    for (let y = 0; y < map.ysize; y++) {
      let ptile = map_pos_to_tile(x, y);

      // Make coastline more distinct, to make it easier to distinguish ocean from land.
      if (is_ocean_tile(ptile) && is_land_tile_near(ptile)) {
        ptile['height'] = 0.45;
      }
      if (!is_ocean_tile(ptile) && is_ocean_tile_near(ptile) && !tile_has_extra(ptile, EXTRA_RIVER)) {
        ptile['height'] = 0.55;
      }

      if (tile_get_known(ptile) == TILE_UNKNOWN) {
        ptile['height'] = 0.51;
        let neighbours = [
          { "x": x - 1 , "y": y - 1},
          { "x": x - 1, "y": y },
          { "x": x - 1,  "y": y + 1 },
          { "x": x,  "y": y - 1},
          { "x": x , "y": y + 1},
          { "x": x + 1, "y": y - 1 },
          { "x": x + 1,  "y": y },
          { "x": x + 1,  "y": y + 1},
          ];

        for (let i = 0; i < 8; i++) {
          let coords = neighbours[i];
          if (coords.x < 0 || coords.x >= map.xsize || coords.y < 0 || coords.y >= map.ysize || ptile['height'] > 0.51) {
            continue;
          }
          let ntile = map_pos_to_tile(coords.x, coords.y);
          if (tile_get_known(ntile) != TILE_UNKNOWN) {
            ptile['height'] = ntile['height'];
          }
        }

      }
    }
  }

  for (let x = 0; x < heightmap_resolution_x; x++) {
    for (let y = 0; y < heightmap_resolution_y; y++) {
      let index = y * heightmap_resolution_x + x;
      let gx = x / heightmap_quality - 0.5;
      let gy = y / heightmap_quality - 0.5;
       if (Math.round(gx) == gx && Math.round(gy) == gy) {
        let ptile = map_pos_to_tile(gx, gy);
        heightmap[index] = ptile['height'];
        if (tile_has_extra(ptile, EXTRA_RIVER)) {
          heightmap[index] = ptile['height'] * 0.98;
        }
        if (tile_terrain(ptile)['name'] == "Mountains") {
          heightmap[index] = ptile['height'] * 1.02;
        }
      } else {
        let neighbours = [
          { "x": Math.floor(gx), "y": Math.floor(gy) },
          { "x": Math.floor(gx), "y": Math.ceil(gy) },
          { "x": Math.ceil(gx),  "y": Math.floor(gy) },
          { "x": Math.ceil(gx),  "y": Math.ceil(gy) }];

        let num_river_neighbours = 0;
        for (let i = 0; i < 4; i++) {
          let coords = neighbours[i];
          if (coords.x < 0 || coords.x >= map.xsize || coords.y < 0 || coords.y >= map.ysize) {
            continue;
          }
          let ptile = map_pos_to_tile(coords.x, coords.y);
          if (tile_has_extra(ptile, EXTRA_RIVER)) {
            num_river_neighbours++;
          }
        }

        let norm = 0;
        let sum = 0;
        for (let i = 0; i < 4; i++) {
          let coords = neighbours[i];
          if (coords.x < 0 || coords.x >= map.xsize || coords.y < 0 || coords.y >= map.ysize) {
            continue;
          }
          let dx = gx - coords.x;
          let dy = gy - coords.y;
          let distance = Math.sqrt(dx*dx + dy*dy);
          let ptile = map_pos_to_tile(coords.x, coords.y);
          let height = 0;
          if (tile_terrain(ptile)['name'] == "Hills" || tile_terrain(ptile)['name'] == "Mountains") {
            let rnd = ((x * y) % 10) / 10;
            height = ptile['height'] + ((rnd - 0.5) / 50) - 0.01;
          } else {
            height = ptile['height'];
          }
          if (tile_has_extra(ptile, EXTRA_RIVER)) {
            height = ptile['height'] * 1.045  - ((num_river_neighbours / 4) * 0.02);
          }

          sum += height / distance / distance;
          norm += 1 / distance / distance;
        }

        heightmap[index] = (sum / norm);
      }
    }
  }

  console.log("Heightmap updated (square topology).");
}
