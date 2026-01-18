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
 * Topology dispatcher - automatically calls hex or square functions
 * This provides a unified interface for topology-dependent operations
 */

/**
 * Get scene coordinates for a map position (topology-aware)
 * @param {number} x - Map x coordinate
 * @param {number} y - Map y coordinate
 * @returns {object} Scene coordinates {x, y, z}
 */
function map_to_scene_coords(x, y) {
  if (use_hex_topology && typeof map_to_scene_coords_hex === 'function') {
    return map_to_scene_coords_hex(x, y);
  }
  
  // Square fallback - original implementation
  if (typeof mapview_model_width === 'undefined') {
    return {x: x * 100, y: 0, z: y * 100};
  }
  
  var scene_x = Math.floor(x * MAPVIEW_ASPECT_FACTOR - mapview_model_width / 2 + 500);
  var scene_y = Math.floor(y * MAPVIEW_ASPECT_FACTOR - mapview_model_height / 2);
  
  return {"x": scene_x, "y": scene_y};
}

/**
 * Get canvas position to tile (topology-aware)
 * @param {number} canvas_x - Canvas x position
 * @param {number} canvas_y - Canvas y position
 * @returns {object} Tile coordinates or null
 */
function webgl_canvas_pos_to_tile(canvas_x, canvas_y) {
  if (use_hex_topology && typeof webgl_canvas_pos_to_tile_hex === 'function') {
    return webgl_canvas_pos_to_tile_hex(canvas_x, canvas_y);
  }
  
  // Square implementation - use raycasting
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
      var tx = Math.floor((pos.x + mapview_model_width / 2 - 500) / MAPVIEW_ASPECT_FACTOR);
      var ty = Math.floor((pos.z + mapview_model_height / 2) / MAPVIEW_ASPECT_FACTOR);
      
      if (tx >= 0 && tx < map.xsize && ty >= 0 && ty < map.ysize) {
        return map_pos_to_tile(tx, ty);
      }
    }
  }
  
  return null;
}

/**
 * Get canvas position to map position (topology-aware)
 * @param {number} canvas_x - Canvas x position
 * @param {number} canvas_y - Canvas y position
 * @returns {object} Scene coordinates or null
 */
function webgl_canvas_pos_to_map_pos(canvas_x, canvas_y) {
  if (use_hex_topology && typeof webgl_canvas_pos_to_map_pos_hex === 'function') {
    return webgl_canvas_pos_to_map_pos_hex(canvas_x, canvas_y);
  }
  
  // Square implementation - raycasting
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
      return intersects[0].point;
    }
  }
  
  return null;
}

/**
 * Highlight a tile (topology-aware)
 * @param {number} tile_x - Tile x coordinate
 * @param {number} tile_y - Tile y coordinate
 */
function highlight_tile(tile_x, tile_y) {
  if (use_hex_topology && typeof highlight_hex_tile === 'function') {
    highlight_hex_tile(tile_x, tile_y);
  } else {
    // Square implementation - update uniforms
    if (typeof freeciv_uniforms !== 'undefined') {
      freeciv_uniforms.selected_x.value = tile_x;
      freeciv_uniforms.selected_y.value = tile_y;
    }
  }
}

/**
 * Clear tile highlight (topology-aware)
 */
function clear_tile_highlight() {
  if (use_hex_topology && typeof clear_hex_tile_highlight === 'function') {
    clear_hex_tile_highlight();
  } else {
    // Square implementation
    if (typeof freeciv_uniforms !== 'undefined') {
      freeciv_uniforms.selected_x.value = -1;
      freeciv_uniforms.selected_y.value = -1;
    }
  }
}

/**
 * Position an object on a tile (topology-aware)
 * @param {THREE.Object3D} object - The 3D object
 * @param {number} tile_x - Tile x coordinate
 * @param {number} tile_y - Tile y coordinate
 * @param {number} heightOffset - Height offset
 */
function position_object_on_tile(object, tile_x, tile_y, heightOffset) {
  if (use_hex_topology && typeof position_object_on_hex_tile === 'function') {
    position_object_on_hex_tile(object, tile_x, tile_y, heightOffset);
  } else {
    // Square implementation
    if (!object) return;
    
    heightOffset = heightOffset || 0;
    var coords = map_to_scene_coords(tile_x, tile_y);
    
    object.position.set(
      coords.x,
      (coords.y || 0) + heightOffset,
      coords.z || coords.y
    );
  }
}

/**
 * Create goto path (topology-aware)
 * @param {array} path - Path array
 * @param {number} color - Path color
 */
function create_goto_path(path, color) {
  if (use_hex_topology && typeof create_hex_goto_path === 'function') {
    create_hex_goto_path(path, color);
  } else {
    // Square implementation would go here
    // For now, use hex implementation as fallback
    if (typeof create_hex_goto_path === 'function') {
      create_hex_goto_path(path, color);
    }
  }
}

/**
 * Clear goto path (topology-aware)
 */
function clear_goto_path() {
  if (use_hex_topology && typeof clear_hex_goto_path === 'function') {
    clear_hex_goto_path();
  } else {
    // Square implementation
    if (typeof clear_hex_goto_path === 'function') {
      clear_hex_goto_path();
    }
  }
}
