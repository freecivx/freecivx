/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
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
 * Improved hexagonal map utilities with better accuracy near hex boundaries
 * 
 * This module provides enhanced coordinate conversion for hexagonal tiles
 * that uses a distance-based nearest-neighbor approach to correctly identify
 * tiles even when clicking near hexagon boundaries.
 */

/****************************************************************************
  Improved scene to map coordinate conversion with accurate hex picking
  Uses distance-based approach to find the nearest hexagon center
  
  Algorithm:
  1. Get approximate tile using simple mathematical conversion
  2. Check a 3x3 grid of tiles around the approximate position
  3. Calculate distance to each candidate hexagon center
  4. Return the tile with the minimum distance
  
  This approach ensures correct tile selection even when clicking near
  hexagon boundaries where the simple method might be ambiguous.
****************************************************************************/
function scene_to_map_coords_hexagon_improved(x, y)
{
  var result = {};
  
  // Get hexagon dimensions (uses shared utility function)
  var dims = get_hexagon_dimensions();
  if (!dims) return null;
  
  // Validate map dimensions
  if (!map || !map['xsize'] || !map['ysize']) {
    console.error("Invalid map dimensions in scene_to_map_coords_hexagon_improved");
    return null;
  }
  
  var width_half = mapview_model_width / 2;
  var height_half = mapview_model_height / 2;
  
  // Get approximate tile coordinates using simple method
  var approxY = Math.round((y + height_half) / dims.vertSpace);
  var offsetX = (approxY % 2) * (dims.hexWidth * 0.5);
  var approxX = Math.round((x + width_half - dims.hexRadius - offsetX) / dims.hexWidth);
  
  // Check this tile and its neighbors to find the closest one
  var minDistance = Infinity;
  var bestX = approxX;
  var bestY = approxY;
  
  // Check a 3x3 grid of tiles around the approximate position
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      var testX = approxX + dx;
      var testY = approxY + dy;
      
      // Skip tiles outside map bounds
      if (testX < 0 || testX >= map['xsize'] || testY < 0 || testY >= map['ysize']) {
        continue;
      }
      
      // Calculate the center position of this test tile
      var testOffsetX = (testY % 2) * (dims.hexWidth * 0.5);
      var testCenterX = testX * dims.hexWidth + testOffsetX + dims.hexRadius - width_half;
      var testCenterY = testY * dims.vertSpace - height_half;
      
      // Calculate squared distance from point to this hexagon center
      // (squared distance is sufficient for comparison)
      var deltaX = x - testCenterX;
      var deltaY = y - testCenterY;
      var distance = deltaX * deltaX + deltaY * deltaY;
      
      // Update if this is the closest hexagon
      if (distance < minDistance) {
        minDistance = distance;
        bestX = testX;
        bestY = testY;
      }
    }
  }
  
  // Clamp to map bounds (shouldn't be necessary but safety check)
  result['x'] = Math.max(0, Math.min(map['xsize'] - 1, bestX));
  result['y'] = Math.max(0, Math.min(map['ysize'] - 1, bestY));
  
  return result;
}

/****************************************************************************
  Get hex neighbors for a given tile
  Returns array of up to 6 neighbor tiles (may be less at map edges)
  
  Hexagonal grids use an offset coordinate system where odd rows are shifted.
  This affects the neighbor offsets:
  - Even rows: Neighbors are at standard positions
  - Odd rows: Neighbors are shifted to account for the row offset
  
  The six directions are: NE, E, SE, SW, W, NW (clockwise from northeast)
****************************************************************************/
function get_hex_neighbors(tile_x, tile_y) {
  // Validate inputs
  if (!map || tile_x < 0 || tile_x >= map['xsize'] || tile_y < 0 || tile_y >= map['ysize']) {
    console.error("Invalid tile coordinates in get_hex_neighbors");
    return [];
  }
  
  var neighbors = [];
  var isOddRow = (tile_y % 2) === 1;
  
  // Neighbor offsets for pointy-top hexagons with odd-row offset
  var neighborOffsets;
  if (isOddRow) {
    // Odd row (shifted right): NE, E, SE, SW, W, NW
    neighborOffsets = [
      [1, -1],  // NE
      [1,  0],  // E
      [1,  1],  // SE
      [0,  1],  // SW
      [-1, 0],  // W
      [0, -1]   // NW
    ];
  } else {
    // Even row: NE, E, SE, SW, W, NW
    neighborOffsets = [
      [0, -1],  // NE
      [1,  0],  // E
      [0,  1],  // SE
      [-1, 1],  // SW
      [-1, 0],  // W
      [-1,-1]   // NW
    ];
  }
  
  // Add valid neighbors
  for (var i = 0; i < neighborOffsets.length; i++) {
    var nx = tile_x + neighborOffsets[i][0];
    var ny = tile_y + neighborOffsets[i][1];
    
    // Check if neighbor is within map bounds
    if (nx >= 0 && nx < map['xsize'] && ny >= 0 && ny < map['ysize']) {
      neighbors.push({x: nx, y: ny});
    }
  }
  
  return neighbors;
}

/****************************************************************************
  Calculate distance between two hexagon tiles
  Uses cube coordinate conversion for accurate hex distance
  
  Hexagonal grids can be represented in cube coordinates (q, r, s) where q+r+s=0.
  Distance in cube space is the maximum of the absolute differences of coordinates.
  
  Reference: https://www.redblobgames.com/grids/hexagons/#distances
****************************************************************************/
function hex_distance(x1, y1, x2, y2) {
  // Validate inputs
  if (!map || x1 < 0 || x1 >= map['xsize'] || y1 < 0 || y1 >= map['ysize'] ||
      x2 < 0 || x2 >= map['xsize'] || y2 < 0 || y2 >= map['ysize']) {
    console.error("Invalid coordinates in hex_distance");
    return -1;
  }
  
  // Convert offset coordinates to cube coordinates
  function offsetToCube(x, y) {
    var q = x - Math.floor((y - (y % 2)) / 2);
    var r = y;
    var s = -q - r;
    return {q: q, r: r, s: s};
  }
  
  var cube1 = offsetToCube(x1, y1);
  var cube2 = offsetToCube(x2, y2);
  
  // Distance in cube coordinates is max of abs differences
  return Math.max(
    Math.abs(cube1.q - cube2.q),
    Math.abs(cube1.r - cube2.r),
    Math.abs(cube1.s - cube2.s)
  );
}

/****************************************************************************
  Check if two hexagon tiles are adjacent
****************************************************************************/
function are_hexagons_adjacent(x1, y1, x2, y2) {
  return hex_distance(x1, y1, x2, y2) === 1;
}
