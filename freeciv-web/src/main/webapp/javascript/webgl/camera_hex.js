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
 * Camera utilities for hexagonal maps
 * Handles camera positioning and tile-to-scene coordinate conversion
 */

/**
 * Convert hex map position to 3D scene coordinates for camera/objects
 * This is the hex-specific version of map_to_scene_coords
 * @param {number} map_x - Map tile x coordinate
 * @param {number} map_y - Map tile y coordinate  
 * @returns {object} Object with x, y, z scene coordinates
 */
function map_to_scene_coords_hex(map_x, map_y) {
  if (typeof hex_to_scene_coords === 'function') {
    var coords = hex_to_scene_coords(map_x, map_y);
    
    // Get height from tile
    var ptile = map_pos_to_tile(map_x, map_y);
    var height = 0;
    if (ptile && ptile['height']) {
      height = ptile['height'] * 100;  // Same height scaling as geometry
    }
    
    // Apply the same offset as tile_mesh_group
    var offsetX = Math.floor(mapview_model_width / 2) - 500;
    
    return {
      x: coords.x + offsetX,
      y: height,
      z: coords.z
    };
  }
  
  // Fallback to basic calculation if hex_to_scene_coords not available
  var hex_width = MAPVIEW_ASPECT_FACTOR * Math.sqrt(3);
  var hex_height = MAPVIEW_ASPECT_FACTOR * 2;
  var hex_vertical_spacing = hex_height * 0.75;
  
  var sceneX = map_x * hex_width;
  if (map_y % 2 === 1) {
    sceneX += hex_width / 2;
  }
  var sceneZ = map_y * hex_vertical_spacing;
  
  // Center and offset
  var width_half = (map.xsize * hex_width) / 2;
  var height_half = (map.ysize * hex_vertical_spacing) / 2;
  
  sceneX -= width_half;
  sceneZ -= height_half;
  
  var offsetX = Math.floor(mapview_model_width / 2) - 500;
  
  var ptile = map_pos_to_tile(map_x, map_y);
  var height = 0;
  if (ptile && ptile['height']) {
    height = ptile['height'] * 100;
  }
  
  return {
    x: sceneX + offsetX,
    y: height,
    z: sceneZ
  };
}

/**
 * Center camera on a specific hex tile
 * @param {number} tile_x - Tile x coordinate
 * @param {number} tile_y - Tile y coordinate
 */
function center_camera_on_hex_tile(tile_x, tile_y) {
  var coords = map_to_scene_coords_hex(tile_x, tile_y);
  
  if (typeof camera !== 'undefined' && camera) {
    // Position camera to look at this tile
    // Maintain current camera height and angle
    var cameraDistance = Math.sqrt(
      Math.pow(camera.position.x - coords.x, 2) +
      Math.pow(camera.position.z - coords.z, 2)
    );
    
    // Keep camera at same relative position but centered on new tile
    var angle = Math.atan2(camera.position.z, camera.position.x);
    camera.position.x = coords.x + cameraDistance * Math.cos(angle);
    camera.position.z = coords.z + cameraDistance * Math.sin(angle);
    
    if (typeof controls !== 'undefined' && controls && controls.target) {
      controls.target.set(coords.x, coords.y, coords.z);
    }
  }
}
