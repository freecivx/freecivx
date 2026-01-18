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
 * Object positioning for hexagonal maps
 * Handles placement of units, cities, and other objects on hex tiles
 */

/**
 * Position a 3D object (unit, city, etc.) on a hex tile
 * @param {THREE.Object3D} object - The 3D object to position
 * @param {number} tile_x - Tile x coordinate
 * @param {number} tile_y - Tile y coordinate
 * @param {number} heightOffset - Additional height offset (optional)
 */
function position_object_on_hex_tile(object, tile_x, tile_y, heightOffset) {
  if (!object) return;
  
  heightOffset = heightOffset || 0;
  
  // Get scene coordinates for the hex tile
  var coords = map_to_scene_coords_hex(tile_x, tile_y);
  
  // Position the object
  object.position.set(
    coords.x,
    coords.y + heightOffset,
    coords.z
  );
}

/**
 * Get the position for a unit on a hex tile
 * Accounts for stacking and unit type
 * @param {object} punit - The unit object
 * @param {number} stackPosition - Position in stack (0 = bottom)
 * @returns {object} Position {x, y, z}
 */
function get_unit_position_on_hex_tile(punit, stackPosition) {
  if (!punit) return null;
  
  var ptile = index_to_tile(punit['tile']);
  if (!ptile) return null;
  
  var tile_x = tile_x(ptile);
  var tile_y = tile_y(ptile);
  
  var coords = map_to_scene_coords_hex(tile_x, tile_y);
  
  // Get unit height offset (from heightmap_square.js function)
  var heightOffset = 0;
  if (typeof get_unit_height_offset === 'function') {
    heightOffset = get_unit_height_offset(punit);
  }
  
  // Add stacking offset
  stackPosition = stackPosition || 0;
  var stackOffset = stackPosition * 8; // Vertical spacing for stacked units
  
  return {
    x: coords.x,
    y: coords.y + heightOffset + stackOffset,
    z: coords.z
  };
}

/**
 * Get the position for a city on a hex tile
 * @param {object} pcity - The city object
 * @returns {object} Position {x, y, z}
 */
function get_city_position_on_hex_tile(pcity) {
  if (!pcity) return null;
  
  var ptile = city_tile(pcity);
  if (!ptile) return null;
  
  var tile_x = tile_x(ptile);
  var tile_y = tile_y(ptile);
  
  var coords = map_to_scene_coords_hex(tile_x, tile_y);
  
  // Cities are elevated above terrain
  var cityHeightOffset = 10;
  
  return {
    x: coords.x,
    y: coords.y + cityHeightOffset,
    z: coords.z
  };
}

/**
 * Position multiple units on a hex tile (for stacking visualization)
 * @param {array} units - Array of unit objects
 * @param {number} tile_x - Tile x coordinate
 * @param {number} tile_y - Tile y coordinate
 */
function position_stacked_units_on_hex_tile(units, tile_x, tile_y) {
  if (!units || units.length === 0) return;
  
  // Arrange units in a circular pattern around hex center for better visibility
  var coords = map_to_scene_coords_hex(tile_x, tile_y);
  var radius = 8; // Distance from center
  
  for (var i = 0; i < units.length; i++) {
    var unit = units[i];
    var unit3d = unit.mesh3d; // Assuming units have mesh3d property
    
    if (!unit3d) continue;
    
    if (units.length === 1) {
      // Single unit at center
      position_object_on_hex_tile(unit3d, tile_x, tile_y, 0);
    } else {
      // Multiple units arranged in circle
      var angle = (2 * Math.PI * i) / units.length;
      var offsetX = radius * Math.cos(angle);
      var offsetZ = radius * Math.sin(angle);
      
      unit3d.position.set(
        coords.x + offsetX,
        coords.y,
        coords.z + offsetZ
      );
    }
  }
}
