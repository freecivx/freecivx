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
 * Hexagonal map utility functions
 * Provides coordinate conversion and neighbor calculations for hex maps
 */

// Hex dimensions based on MAPVIEW_ASPECT_FACTOR
var HEX_WIDTH = MAPVIEW_ASPECT_FACTOR * Math.sqrt(3);
var HEX_HEIGHT = MAPVIEW_ASPECT_FACTOR * 2;
var HEX_VERTICAL_SPACING = HEX_HEIGHT * 0.75;

/**
 * Convert hex tile coordinates to scene (3D world) coordinates
 * Uses odd-r offset coordinate system
 * @param {number} x - Tile x coordinate
 * @param {number} y - Tile y coordinate
 * @returns {object} Object with x, z properties (scene coordinates)
 */
function hex_to_scene_coords(x, y) {
  var sceneX = x * HEX_WIDTH;
  if (y % 2 === 1) {  // Odd rows are offset
    sceneX += HEX_WIDTH / 2;
  }
  var sceneZ = y * HEX_VERTICAL_SPACING;
  
  // Center the map
  var width_half = (map.xsize * HEX_WIDTH) / 2;
  var height_half = (map.ysize * HEX_VERTICAL_SPACING) / 2;
  
  sceneX -= width_half;
  sceneZ -= height_half;
  
  return {x: sceneX, z: sceneZ};
}

/**
 * Convert scene coordinates to hex tile coordinates
 * @param {number} sceneX - Scene X coordinate
 * @param {number} sceneZ - Scene Z coordinate
 * @returns {object} Object with x, y properties (tile coordinates)
 */
function scene_to_hex_coords(sceneX, sceneZ) {
  // Adjust for map centering
  var width_half = (map.xsize * HEX_WIDTH) / 2;
  var height_half = (map.ysize * HEX_VERTICAL_SPACING) / 2;
  
  sceneX += width_half;
  sceneZ += height_half;
  
  // Approximate y from vertical position
  var y = Math.round(sceneZ / HEX_VERTICAL_SPACING);
  
  // Calculate x accounting for odd row offset
  var offset = (y % 2 === 1) ? HEX_WIDTH / 2 : 0;
  var x = Math.round((sceneX - offset) / HEX_WIDTH);
  
  return {x: x, y: y};
}

/**
 * Get the 6 neighbor tiles for a hex tile
 * Returns neighbors in clockwise order starting from North
 * For odd-r offset coordinates (odd rows shifted right by 0.5)
 * @param {number} x - Tile x coordinate
 * @param {number} y - Tile y coordinate
 * @returns {array} Array of {x, y} neighbor coordinates
 */
function get_hex_neighbors(x, y) {
  var neighbors = [];
  var isOddRow = (y % 2 === 1);
  
  // Neighbor offsets for odd-r offset coordinates (flat-top hexagons)
  // Odd rows are shifted right by 0.5 hex width
  //
  // For even rows (y % 2 == 0):
  //     NW(-1,-1)  N(0,-1)
  //        \      /
  //    W(-1,0) - tile(0,0) - E(+1,0)
  //        /      \
  //     SW(-1,+1)  S(0,+1)
  //
  // For odd rows (y % 2 == 1):  
  //        N(0,-1)  NE(+1,-1)
  //        /      \
  //    W(-1,0) - tile(0,0) - E(+1,0)
  //        \      /
  //        S(0,+1)  SE(+1,+1)
  
  if (isOddRow) {
    // Odd row (shifted right)
    neighbors = [
      {x: x,     y: y - 1},  // North
      {x: x + 1, y: y - 1},  // Northeast
      {x: x + 1, y: y},      // East
      {x: x + 1, y: y + 1},  // Southeast
      {x: x,     y: y + 1},  // South
      {x: x - 1, y: y}       // West (no NW, SW for odd rows in this direction)
    ];
  } else {
    // Even row
    neighbors = [
      {x: x,     y: y - 1},  // North
      {x: x,     y: y - 1},  // Northeast (same as north for even)
      {x: x + 1, y: y},      // East
      {x: x,     y: y + 1},  // Southeast (same as south for even)
      {x: x,     y: y + 1},  // South
      {x: x - 1, y: y}       // West
    ];
  }
  
  // Actually, let me use the correct odd-r flat-top hex neighbor offsets
  // Reference: https://www.redblobgames.com/grids/hexagons/#neighbors-offset
  
  var parity = y & 1; // 0 for even, 1 for odd
  var offsetDirections = [
    // even rows, odd rows
    [{x: 1, y: 0},  {x: 1, y: 0}],   // E
    [{x: 0, y: 1},  {x: 1, y: 1}],   // SE
    [{x: -1, y: 1}, {x: 0, y: 1}],   // SW
    [{x: -1, y: 0}, {x: -1, y: 0}],  // W
    [{x: -1, y: -1},{x: 0, y: -1}],  // NW
    [{x: 0, y: -1}, {x: 1, y: -1}]   // NE
  ];
  
  neighbors = [];
  for (var i = 0; i < 6; i++) {
    var dir = offsetDirections[i][parity];
    var nx = x + dir.x;
    var ny = y + dir.y;
    
    // Only add if within map bounds
    if (nx >= 0 && nx < map.xsize && ny >= 0 && ny < map.ysize) {
      neighbors.push({x: nx, y: ny});
    }
  }
  
  return neighbors;
}

/**
 * Calculate distance between two hex tiles (in tiles)
 * @param {number} x1 - First tile x
 * @param {number} y1 - First tile y
 * @param {number} x2 - Second tile x
 * @param {number} y2 - Second tile y
 * @returns {number} Distance in tiles
 */
function hex_distance(x1, y1, x2, y2) {
  // Convert to cube coordinates for easier distance calculation
  var cube1 = offset_to_cube(x1, y1);
  var cube2 = offset_to_cube(x2, y2);
  
  return (Math.abs(cube1.x - cube2.x) + 
          Math.abs(cube1.y - cube2.y) + 
          Math.abs(cube1.z - cube2.z)) / 2;
}

/**
 * Convert odd-r offset coordinates to cube coordinates
 * @param {number} x - Offset x coordinate
 * @param {number} y - Offset y coordinate
 * @returns {object} Cube coordinates {x, y, z}
 */
function offset_to_cube(x, y) {
  var cubeX = x - (y - (y % 2)) / 2;
  var cubeZ = y;
  var cubeY = -cubeX - cubeZ;
  return {x: cubeX, y: cubeY, z: cubeZ};
}

/**
 * Convert cube coordinates to odd-r offset coordinates
 * @param {number} cubeX - Cube x coordinate
 * @param {number} cubeY - Cube y coordinate
 * @param {number} cubeZ - Cube z coordinate
 * @returns {object} Offset coordinates {x, y}
 */
function cube_to_offset(cubeX, cubeY, cubeZ) {
  var y = cubeZ;
  var x = cubeX + (y - (y % 2)) / 2;
  return {x: x, y: y};
}
