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

/**
 * Heightmap Generation for Square Map Tiles
 *
 * Per-terrain-type height targets (identical values to the hex version):
 *   Mountains  0.76 – 0.92   (high peaks)
 *   Hills      0.62 – 0.72   (moderate elevation)
 *   Forest/Jungle  0.55 – 0.61
 *   Flat land  0.52 – 0.54   (grassland, plains, desert, tundra …)
 *   Beach      0.55           (land adjacent to ocean)
 *   Ocean      0.44 – 0.45
 *
 * Flat tiles receive a constant height (no IDW) so they produce zero
 * normal variation on the GPU and are ideal candidates for LOD Q=1.
 */

/****************************************************************************
  Create heightmap based on tile.height for square topology.
****************************************************************************/
function update_heightmap_square(heightmap_quality)
{
  var hm_res_x = map.xsize * heightmap_quality + 1;
  var hm_res_y = map.ysize * heightmap_quality + 1;

  console.log("Updating heightmap (square topology)...");

  // --- Phase 1: per-tile target heights -----------------------------------
  var tile_h = new Float32Array(map.xsize * map.ysize);

  for (var ty = 0; ty < map.ysize; ty++) {
    for (var tx = 0; tx < map.xsize; tx++) {
      var ptile = map_pos_to_tile(tx, ty);
      var idx   = ty * map.xsize + tx;
      if (tile_get_known(ptile) == TILE_UNKNOWN) {
        tile_h[idx] = -1;
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
  var HP = [7, 13, 17, 23];

  for (var hx = 0; hx < hm_res_x; hx++) {
    for (var hy = 0; hy < hm_res_y; hy++) {
      var index = hy * hm_res_x + hx;
      var gx = hx / heightmap_quality - 0.5;
      var gy = hy / heightmap_quality - 0.5;
      var igx = Math.round(gx), igy = Math.round(gy);

      if (igx === gx && igy === gy) {
        if (igx >= 0 && igx < map.xsize && igy >= 0 && igy < map.ysize) {
          heightmap[index] = tile_h[igy * map.xsize + igx];
        }
      } else {
        var corners = [
          { tx: Math.floor(gx), ty: Math.floor(gy) },
          { tx: Math.floor(gx), ty: Math.ceil(gy)  },
          { tx: Math.ceil(gx),  ty: Math.floor(gy) },
          { tx: Math.ceil(gx),  ty: Math.ceil(gy)  }
        ];

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
          var flatH = 0, flatCnt = 0;
          for (var ci = 0; ci < 4; ci++) {
            var c = corners[ci];
            if (c.tx >= 0 && c.tx < map.xsize && c.ty >= 0 && c.ty < map.ysize) {
              flatH += tile_h[c.ty * map.xsize + c.tx]; flatCnt++;
            }
          }
          heightmap[index] = flatCnt > 0 ? flatH / flatCnt : TERRAIN_HEIGHT_FLAT;
        } else {
          var norm = 0, sum = 0;
          for (var ci = 0; ci < 4; ci++) {
            var c = corners[ci];
            if (c.tx < 0 || c.tx >= map.xsize || c.ty < 0 || c.ty >= map.ysize) continue;
            var dx = gx - c.tx, dy = gy - c.ty;
            var distSq = dx * dx + dy * dy;
            if (distSq < 1e-10) { norm = 1; sum = tile_h[c.ty * map.xsize + c.tx]; break; }
            var h = tile_h[c.ty * map.xsize + c.tx];
            var ct = map_pos_to_tile(c.tx, c.ty);
            if (tile_get_known(ct) != TILE_UNKNOWN) {
              var tname = tile_terrain(ct)['name'];
              if (tname === "Mountains") {
                var rnd = ((hx * HP[0] + hy * HP[1]) % 31) / 31.0;
                h += (rnd - 0.5) * 0.10; // ±0.05 range variation on mountains
              } else if (tname === "Hills") {
                var rnd = ((hx * HP[2] + hy * HP[3]) % 19) / 19.0;
                h += (rnd - 0.5) * 0.05; // ±0.025 range variation on hills
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

  console.log("Heightmap updated (square topology).");
}
