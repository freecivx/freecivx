/**********************************************************************
    FreecivWorld.net - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2024  The Freeciv-web project

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
 * Roads and railroads for hexagonal maps
 * Handles rendering of roads with 6-way connections instead of 8-way
 */

/**
 * Calculate road sprite index for hex tile based on neighbor connections
 * Hex tiles have 6 possible connections instead of 8
 * @param {object} ptile - The tile object
 * @param {number} extra_id - The extra (road/railroad) ID
 * @returns {number} Sprite index for road rendering
 */
function get_hex_road_sprite_index(ptile, extra_id) {
  if (!ptile) return 0;
  
  var tile_x = tile_x(ptile);
  var tile_y = tile_y(ptile);
  
  // Get 6 hex neighbors
  var neighbors = get_hex_neighbors(tile_x, tile_y);
  
  // Check which neighbors have the same road/railroad
  var connections = 0;
  var bit = 1;
  
  for (var i = 0; i < neighbors.length; i++) {
    var ntile = map_pos_to_tile(neighbors[i].x, neighbors[i].y);
    if (ntile && tile_has_extra(ntile, extra_id)) {
      connections |= bit;
    }
    bit <<= 1;
  }
  
  // Map 6-bit connection pattern to sprite index
  // This would need a hex-specific sprite sheet with 64 variations (2^6)
  // For now, return a basic index based on connection count
  var connectionCount = 0;
  for (var i = 0; i < 6; i++) {
    if (connections & (1 << i)) connectionCount++;
  }
  
  // Simple mapping: 0-6 connections
  return connectionCount;
}

/**
 * Render roads on hex tiles
 * This is a placeholder that needs proper sprite sheet integration
 * @param {object} ptile - The tile object
 * @param {number} extra_id - The extra (road/railroad) ID
 */
function render_hex_road(ptile, extra_id) {
  // TODO: Implement proper hex road rendering with sprite sheet
  // For now, roads are handled by the shader system
  // This function is a placeholder for future dedicated hex road sprites
  
  var spriteIndex = get_hex_road_sprite_index(ptile, extra_id);
  
  // The actual rendering would use the spriteIndex to select
  // the appropriate sprite from a hex-specific road sprite sheet
  
  return spriteIndex;
}

/**
 * Update road rendering for all hex tiles
 * Called when roads are built or removed
 */
function update_hex_roads() {
  // Roads are currently rendered via the shader system
  // This function would update any dedicated hex road meshes if implemented
  
  // For now, we rely on the roads texture in the shader uniforms
  // which is updated by the main road update system
}
