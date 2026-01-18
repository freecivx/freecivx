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
 * Map control and interaction for hexagonal tiles
 * Handles mouse picking, tile selection, and user interaction
 */

/**
 * Convert canvas position to hex tile coordinates
 * This is the hex-specific version of webgl_canvas_pos_to_tile
 * @param {number} canvas_x - Canvas x position
 * @param {number} canvas_y - Canvas y position
 * @returns {object} Tile coordinates {x, y} or null
 */
function webgl_canvas_pos_to_tile_hex(canvas_x, canvas_y) {
  // Use raycasting with the lofi mesh (still square for now)
  // TODO: Create hex-specific lofi mesh for accurate picking
  
  // Use raycasting directly without going through dispatcher
  if (typeof raycaster === 'undefined' || typeof mouse === 'undefined' || typeof camera === 'undefined') {
    return null;
  }
  
  var rect = maprenderer.domElement.getBoundingClientRect();
  mouse.x = ((canvas_x - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((canvas_y - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  
  if (typeof lofiMesh !== 'undefined' && lofiMesh) {
    var intersects = raycaster.intersectObject(lofiMesh);
    if (intersects.length > 0) {
      var pos = intersects[0].point;
      
      // Convert scene position to hex tile coordinates
      var tx = Math.floor((pos.x + mapview_model_width / 2 - 500) / MAPVIEW_ASPECT_FACTOR);
      var ty = Math.floor((pos.z + mapview_model_height / 2) / MAPVIEW_ASPECT_FACTOR);
      
      // Refine to hex coordinates using scene_to_hex_coords if available
      if (typeof scene_to_hex_coords === 'function') {
        var hex_coords = scene_to_hex_coords(pos.x, pos.z);
        if (hex_coords && hex_coords.x >= 0 && hex_coords.x < map.xsize && 
            hex_coords.y >= 0 && hex_coords.y < map.ysize) {
          return map_pos_to_tile(hex_coords.x, hex_coords.y);
        }
      }
      
      // Fallback to square approximation
      if (tx >= 0 && tx < map.xsize && ty >= 0 && ty < map.ysize) {
        return map_pos_to_tile(tx, ty);
      }
    }
  }
  
  return null;
}

/**
 * Convert canvas position to map (scene) position for hex maps
 * @param {number} canvas_x - Canvas x position
 * @param {number} canvas_y - Canvas y position
 * @returns {object} Scene coordinates {x, y, z} or null
 */
function webgl_canvas_pos_to_map_pos_hex(canvas_x, canvas_y) {
  // Use raycasting to find 3D position
  if (typeof raycaster === 'undefined' || typeof mouse === 'undefined' || typeof camera === 'undefined') {
    return null;
  }
  
  // Convert canvas to normalized device coordinates
  var rect = maprenderer.domElement.getBoundingClientRect();
  mouse.x = ((canvas_x - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((canvas_y - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  
  // Raycast against lofi mesh
  if (typeof lofiMesh !== 'undefined' && lofiMesh) {
    var intersects = raycaster.intersectObject(lofiMesh);
    if (intersects.length > 0) {
      return intersects[0].point;
    }
  }
  
  return null;
}

/**
 * Highlight a hex tile
 * @param {number} tile_x - Tile x coordinate
 * @param {number} tile_y - Tile y coordinate
 */
function highlight_hex_tile(tile_x, tile_y) {
  // Update shader uniforms for tile highlighting
  if (typeof freeciv_uniforms !== 'undefined') {
    freeciv_uniforms.selected_x.value = tile_x;
    freeciv_uniforms.selected_y.value = tile_y;
  }
}

/**
 * Clear hex tile highlight
 */
function clear_hex_tile_highlight() {
  if (typeof freeciv_uniforms !== 'undefined') {
    freeciv_uniforms.selected_x.value = -1;
    freeciv_uniforms.selected_y.value = -1;
  }
}
