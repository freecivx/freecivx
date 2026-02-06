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
 * Server-side goto pathfinding for standalone mode.
 * 
 * This module computes paths for unit movement using a simple greedy
 * approach that follows valid directions for hexagonal maps.
 * 
 * For hexagonal isometric maps (TF_HEX | TF_ISO), the valid directions are:
 *   N (North), E (East), S (South), W (West), SE (SouthEast), NW (NorthWest)
 * 
 * Invalid directions for iso-hex: NE (NorthEast), SW (SouthWest)
 */

/**
 * Handle a goto path request from the client.
 * Computes the path and sends it back via handle_web_goto_path.
 * 
 * @param {Object} packet - The goto path request packet
 * @param {number} packet.unit_id - The unit requesting the path
 * @param {number} packet.goal - The destination tile index
 */
function server_handle_goto_path_req(packet) {
  var unit_id = packet.unit_id;
  var goal_tile_index = packet.goal;
  
  // Get the unit
  var punit = server_units[unit_id];
  if (!punit) {
    console.error("[Server Goto] Unit not found: " + unit_id);
    return;
  }
  
  // Get start and destination tiles
  var start_tile = index_to_tile(punit.tile);
  var dest_tile = index_to_tile(goal_tile_index);
  
  if (!start_tile || !dest_tile) {
    console.error("[Server Goto] Invalid tiles - start: " + punit.tile + ", dest: " + goal_tile_index);
    return;
  }
  
  // Compute the path
  var dirs = server_compute_goto_path(start_tile, dest_tile);
  
  // Send the path back to the client
  var response = {
    unit_id: unit_id,
    dest: goal_tile_index,
    dir: dirs,
    length: dirs.length,
    turns: Math.max(1, Math.ceil(dirs.length / Math.max(1, punit.movesleft)))
  };
  
  // Call the client's packet handler
  handle_web_goto_path(response);
}

/**
 * Compute a path from start_tile to dest_tile.
 * Uses a simple greedy algorithm that picks the best direction at each step.
 * 
 * @param {Object} start_tile - The starting tile
 * @param {Object} dest_tile - The destination tile
 * @returns {Array} Array of direction indices (DIR8_*) for the path
 */
function server_compute_goto_path(start_tile, dest_tile) {
  var dirs = [];
  var current_tile = start_tile;
  var max_steps = 1000; // Safety limit to prevent infinite loops
  var steps = 0;
  
  while (current_tile.index !== dest_tile.index && steps < max_steps) {
    steps++;
    
    // Find the best direction to move toward the destination
    var best_dir = server_find_best_direction(current_tile, dest_tile);
    
    if (best_dir === -1) {
      // No valid direction found - path is blocked
      console.warn("[Server Goto] Path blocked at tile " + current_tile.index);
      break;
    }
    
    // Add direction to path
    dirs.push(best_dir);
    
    // Move to next tile
    current_tile = mapstep(current_tile, best_dir);
    
    if (!current_tile) {
      console.error("[Server Goto] mapstep returned null for direction " + best_dir);
      break;
    }
  }
  
  return dirs;
}

/**
 * Find the best direction to move from current_tile toward dest_tile.
 * Iterates through all valid directions and picks the one that
 * brings us closest to the destination.
 * 
 * @param {Object} current_tile - The current tile
 * @param {Object} dest_tile - The destination tile  
 * @returns {number} The best direction (DIR8_*), or -1 if no valid direction
 */
function server_find_best_direction(current_tile, dest_tile) {
  var best_dir = -1;
  var best_distance = Infinity;
  
  // Try all directions and find the one that minimizes distance to destination
  for (var dir = 0; dir < 8; dir++) {
    // Check if this direction is valid for the current topology
    if (!is_valid_dir(dir)) {
      continue;
    }
    
    // Get the tile in this direction
    var next_tile = mapstep(current_tile, dir);
    
    if (!next_tile) {
      continue;
    }
    
    // Calculate distance to destination from this tile
    var dx = dest_tile.x - next_tile.x;
    var dy = dest_tile.y - next_tile.y;
    
    // Handle map wrapping for X coordinate
    if (typeof wrap_has_flag !== 'undefined' && wrap_has_flag(WRAP_X)) {
      var half_world = Math.floor(map.xsize / 2);
      if (dx > half_world) dx -= map.xsize;
      if (dx < -half_world) dx += map.xsize;
    }
    
    // Use squared distance to avoid sqrt
    var distance = dx * dx + dy * dy;
    
    if (distance < best_distance) {
      best_distance = distance;
      best_dir = dir;
    }
  }
  
  return best_dir;
}