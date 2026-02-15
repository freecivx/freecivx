/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2016  The Freeciv-web project

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

var map_known_dirty = true;
var map_geometry_dirty = true;

/**************************************************************************
 Updates the terrain vertex colors to set tile to known, unknown or fogged.
 Also updates the maptiles texture visibility for hexagonal edge rendering.
**************************************************************************/
function webgl_update_tile_known(old_tile, new_tile)
{
  if (new_tile == null || old_tile == null || landGeometry == null) return;

  if (new_tile['height'] != old_tile['height']) {
    map_geometry_dirty = true;
  }

  if (tile_get_known(new_tile) != tile_get_known(old_tile)) {
    map_known_dirty = true;
    // Update visibility in maptiles texture for hex-aligned visibility boundaries
    update_tiletypes_visibility(new_tile);
  }

}


/**************************************************************************
 This will update the fog of war and unknown tiles, and farmland/irrigation
 by storing these as vertex colors in the landscape mesh.
 
 For hexagonal maps, we need to account for the staggered row layout when
 determining which tile a vertex belongs to. Odd rows are offset by half
 a tile width (odd-r offset coordinate system).
 
 Uses a permissive approach: for boundary vertices, checks neighboring tiles
 and uses the maximum visibility value to avoid incorrectly showing tiles
 as unknown when they should be visible.
**************************************************************************/
function update_tiles_known_vertex_colors()
{
  const xquality = map.xsize * terrain_quality + 1;
  const yquality = map.ysize * terrain_quality + 1;
  const colors = [];
  const gridX = Math.floor(xquality);
  const gridY = Math.floor(yquality);

  const gridX1 = gridX + 1;
  const gridY1 = gridY + 1;

  for ( let iy = 0; iy < gridY1; iy ++ ) {
    for ( let ix = 0; ix < gridX1; ix ++ ) {
        // Clamp to valid range instead of wrapping (handles edge vertices at ix == xquality)
        var sx = Math.min(ix, xquality - 1), sy = Math.min(iy, yquality - 1);
        
        // Calculate map tile coordinates from vertex position
        // Divide by terrain_quality to convert from vertex index to tile index
        var my = Math.floor(sy / terrain_quality);
        
        // For hex grids, the MESH geometry staggers odd rows by HEX_STAGGER (0.5)
        // The stagger is applied based on mesh row (iy), not tile row (my)
        // This matches init_land_geometry() which uses: (iy % 2 === 1 ? HEX_STAGGER : 0)
        var hex_stagger_offset = (iy % 2 === 1) ? 0.5 : 0;
        var mx = Math.floor((sx / terrain_quality) - hex_stagger_offset);
        
        // Use permissive visibility: check the computed tile AND neighbors,
        // use the maximum visibility to avoid incorrectly showing unknown tiles
        var c = get_permissive_vertex_color(mx, my, ix, iy);
        colors.push(c[0], c[1], c[2]);
    }
  }

  landGeometry.setAttribute( 'vertColor', new THREE.Float32BufferAttribute( colors, 3) );

  landGeometry.colorsNeedUpdate = true;

}

/**************************************************************************
 Gets the vertex color using a permissive approach: checks the tile at (mx, my)
 and its immediate neighbors, returning the maximum visibility value.
 This prevents edge/boundary vertices from incorrectly showing as unknown
 when a neighboring tile is actually visible.
**************************************************************************/
function get_permissive_vertex_color(mx, my, vertex_x, vertex_y)
{
    var best_color = 0;
    
    // Check the computed tile and its immediate neighbors (3x3 grid)
    // Use the maximum visibility value found
    for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
            var check_x = mx + dx;
            var check_y = my + dy;
            
            // Skip out-of-bounds tiles
            if (check_x < 0 || check_x >= map.xsize || check_y < 0 || check_y >= map.ysize) {
                continue;
            }
            
            var ptile = map_pos_to_tile(check_x, check_y);
            if (ptile != null) {
                var c = get_vertex_color_from_tile(ptile, vertex_x, vertex_y);
                // Use the maximum visibility (most permissive)
                if (c[0] > best_color) {
                    best_color = c[0];
                }
            }
        }
    }
    
    return [best_color, 0, 0];
}


/**************************************************************************
 Returns the vertex colors (THREE.Color) of a tile. The color is used to
 set terrain type in the terrain fragment shader.
**************************************************************************/
function get_vertex_color_from_tile(ptile, vertex_x, vertex_y)
{
    var known_status_color = 0;
    if (tile_get_known(ptile) == TILE_KNOWN_SEEN) {
      known_status_color = 1.06;

    } else if (tile_get_known(ptile) == TILE_KNOWN_UNSEEN) {
      known_status_color = 0.54;
    } else if (tile_get_known(ptile) == TILE_UNKNOWN) {
      known_status_color = 0;
    }

    if (active_city != null && ptile != null && (tile_get_known(ptile) == TILE_KNOWN_SEEN || tile_get_known(ptile) == TILE_KNOWN_UNSEEN)) {
      // Hightlight active city
      var ctile = city_tile(active_city);
      if (ptile['index'] == ctile['index']) {
        known_status_color = 1.06;
      } else if (is_city_tile(ptile, active_city)) {
        known_status_color = 1.06;
      } else {
        known_status_color = 0.30;
      }
    }

    return [known_status_color, 0,0];

}
