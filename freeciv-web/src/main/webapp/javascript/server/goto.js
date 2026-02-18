/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2026  The Freeciv-web project

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
 * Pathfinding and movement for the JavaScript server
 * 
 * This module handles unit movement and pathfinding including:
 * - Finding paths between tiles
 * - Calculating movement costs
 * - Validating unit movement
 */

/**************************************************************************
 * Calculate Manhattan distance between two tiles
 * 
 * @param {number} x1 - X coordinate of first tile
 * @param {number} y1 - Y coordinate of first tile
 * @param {number} x2 - X coordinate of second tile
 * @param {number} y2 - Y coordinate of second tile
 * @returns {number} Manhattan distance
 **************************************************************************/
function server_goto_manhattan_distance(x1, y1, x2, y2) {
  return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}

/**************************************************************************
 * Check if a tile is adjacent to another tile
 * 
 * @param {number} x1 - X coordinate of first tile
 * @param {number} y1 - Y coordinate of first tile
 * @param {number} x2 - X coordinate of second tile
 * @param {number} y2 - Y coordinate of second tile
 * @returns {boolean} True if tiles are adjacent
 **************************************************************************/
function server_goto_is_adjacent(x1, y1, x2, y2) {
  var dx = Math.abs(x2 - x1);
  var dy = Math.abs(y2 - y1);
  
  // Adjacent if distance is 1 in either direction (or both for diagonal)
  return (dx <= 1 && dy <= 1 && (dx + dy > 0));
}

/**************************************************************************
 * Get all adjacent tiles to a given position
 * 
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} mapWidth - Width of the map
 * @param {number} mapHeight - Height of the map
 * @returns {Array} Array of adjacent tile coordinates [{x, y}, ...]
 **************************************************************************/
function server_goto_get_adjacent_tiles(x, y, mapWidth, mapHeight) {
  var adjacent = [];
  
  // Check all 8 directions (including diagonals)
  var directions = [
    {dx: -1, dy: -1}, {dx: 0, dy: -1}, {dx: 1, dy: -1},
    {dx: -1, dy: 0},                   {dx: 1, dy: 0},
    {dx: -1, dy: 1},  {dx: 0, dy: 1},  {dx: 1, dy: 1}
  ];
  
  for (var i = 0; i < directions.length; i++) {
    var newX = x + directions[i].dx;
    var newY = y + directions[i].dy;
    
    // Check bounds
    if (newX >= 0 && newX < mapWidth && newY >= 0 && newY < mapHeight) {
      adjacent.push({x: newX, y: newY});
    }
  }
  
  return adjacent;
}

/**************************************************************************
 * Find a simple path from one tile to another
 * 
 * Uses a greedy approach that moves towards the target tile.
 * This is not optimal pathfinding but works for basic movement.
 * 
 * @param {number} startX - Starting X coordinate
 * @param {number} startY - Starting Y coordinate
 * @param {number} endX - Ending X coordinate
 * @param {number} endY - Ending Y coordinate
 * @param {number} mapWidth - Width of the map
 * @param {number} mapHeight - Height of the map
 * @param {number} maxSteps - Maximum number of steps (default: 100)
 * @returns {Array} Array of coordinates representing the path, or null if no path found
 **************************************************************************/
function server_goto_find_path(startX, startY, endX, endY, mapWidth, mapHeight, maxSteps) {
  if (!maxSteps) maxSteps = 100;
  
  var path = [{x: startX, y: startY}];
  var currentX = startX;
  var currentY = startY;
  var steps = 0;
  
  while ((currentX !== endX || currentY !== endY) && steps < maxSteps) {
    var dx = endX - currentX;
    var dy = endY - currentY;
    
    // Move in the direction that reduces distance the most
    var nextX = currentX;
    var nextY = currentY;
    
    if (dx !== 0) {
      nextX += (dx > 0 ? 1 : -1);
    }
    
    if (dy !== 0) {
      nextY += (dy > 0 ? 1 : -1);
    }
    
    // Check bounds
    if (nextX < 0 || nextX >= mapWidth || nextY < 0 || nextY >= mapHeight) {
      console.log("[Server Goto] Path out of bounds");
      return null;
    }
    
    currentX = nextX;
    currentY = nextY;
    path.push({x: currentX, y: currentY});
    steps++;
  }
  
  if (currentX === endX && currentY === endY) {
    console.log("[Server Goto] Found path with " + path.length + " steps");
    return path;
  } else {
    console.log("[Server Goto] Path not found within step limit");
    return null;
  }
}

/**************************************************************************
 * Calculate movement cost for a unit on a tile
 * 
 * @param {object} unit - The unit object
 * @param {object} tile - The tile object
 * @returns {number} Movement cost (in movement points)
 **************************************************************************/
function server_goto_get_movement_cost(unit, tile) {
  // Base movement cost
  var cost = 1;
  
  // Check for roads - reduce movement cost
  if (tile.extras && tile.extras.indexOf(EXTRA_ROAD) !== -1) {
    cost = 0.5;
  }
  
  // Check for railroads - further reduce movement cost
  if (tile.extras && tile.extras.indexOf(EXTRA_RAIL) !== -1) {
    cost = 0.25;
  }
  
  return cost;
}