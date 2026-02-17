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
 * Unit management for the JavaScript server
 * 
 * This module handles:
 * - Unit creation and initialization
 * - Unit properties and placement
 * - Server-side unit state tracking
 */

// Server-side units object - separate from client's units
var server_units = {};

/**************************************************************************
 * Create units for players
 **************************************************************************/
function server_create_units() {
  console.log("[Server Units] Creating units");
  
  // Initialize server's unit tracking
  server_units = {};
  
  // Clear client-side units (this will be repopulated via handle_unit_info)
  units = {};
  
  var next_unit_id = 0;
  
  // Helper function to create a unit on both server and client
  var create_unit = function(unit_data) {
    // Store in server's units object
    server_units[unit_data.id] = {
      id: unit_data.id,
      owner: unit_data.owner,
      tile: unit_data.tile,
      homecity: unit_data.homecity,
      type: unit_data.type,
      activity: unit_data.activity,
      movesleft: unit_data.movesleft,
      hp: unit_data.hp,
      facing: unit_data.facing,
      done_moving: unit_data.done_moving,
      action_decision_want: unit_data.action_decision_want,
      action_decision_tile: unit_data.action_decision_tile,
      ssa_controller: 0,
      transported: false

    };
    
    // Send to client via handle_unit_info
    handle_unit_info(unit_data);
  };
  
  // Helper function to find a nearby non-water tile using existing is_ocean_tile()
  var find_land_tile = function(start_x, start_y, max_search_radius) {
    max_search_radius = max_search_radius || 100;
    
    // Get tile at starting position
    var start_tile_index = start_x + start_y * map.xsize;
    var start_tile = index_to_tile(start_tile_index);
    
    // Try the starting position first
    if (start_tile && !is_ocean_tile(start_tile)) {
      return start_tile;
    }
    
    // Spiral outward to find land
    for (var radius = 1; radius <= max_search_radius; radius++) {
      for (var dx = -radius; dx <= radius; dx++) {
        for (var dy = -radius; dy <= radius; dy++) {
          // Only check tiles at current radius (not interior)
          if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
            var x = start_x + dx;
            var y = start_y + dy;
            
            // Ensure within map bounds
            if (x >= 0 && x < map.xsize && y >= 0 && y < map.ysize) {
              var tile_index = x + y * map.xsize;
              var ptile = index_to_tile(tile_index);
              
              if (ptile && !is_ocean_tile(ptile)) {
                return ptile;
              }
            }
          }
        }
      }
    }
    
    // If no land found, return original position (shouldn't happen with mostly land maps)
    console.warn("[Server Units] Could not find land tile near (" + start_x + ", " + start_y + ")");
    return { x: start_x, y: start_y };
  };
  
  // Helper function to calculate safe starting position for a player
  var get_player_start_position = function(player_id) {
    // Distribute players around the map in a grid pattern
    // This ensures they don't spawn outside map boundaries
    var players_per_row = Math.ceil(Math.sqrt(Object.keys(players).length));
    var row = Math.floor(player_id / players_per_row);
    var col = player_id % players_per_row;
    
    // Calculate position within map bounds with padding
    var padding = 3;
    var usable_width = map.xsize - (2 * padding);
    var usable_height = map.ysize - (2 * padding);
    
    var base_x = padding + Math.floor((col * usable_width) / players_per_row);
    var base_y = padding + Math.floor((row * usable_height) / players_per_row);
    
    // Ensure we're within bounds
    base_x = Math.max(padding, Math.min(map.xsize - padding - 3, base_x));
    base_y = Math.max(padding, Math.min(map.ysize - padding - 3, base_y));
    
    // Find a land tile near this position (don't place on water)
    var land_pos = find_land_tile(base_x, base_y);
    
    return land_pos;
  };
  
  // Unit placement offsets relative to base position
  // This keeps all units in a compact cluster
  var warrior_offsets = [[0, 0], [1, 0], [0, 1]];
  var explorer_offsets = [[2, 0], [2, 1]];
  var settler_offsets = [[0, 2], [1, 2], [2, 2]];
  
  // Create starting units for each player
  for (var player_id in players) {
    var pplayer = players[player_id];
    var start_pos = get_player_start_position(parseInt(player_id));
    
    // Create 3 warriors for each player
    for (var i = 0; i < 1; i++) {
      var offset = warrior_offsets[i];
      var warrior_x = start_pos.x + offset[0];
      var warrior_y = start_pos.y + offset[1];
      
      // Find land tile if offset position is on water
      var warrior_pos = find_land_tile(warrior_x, warrior_y, 50);
      var warrior_tile_index = warrior_pos.x + warrior_pos.y * map.xsize;
      
      create_unit({
        id: next_unit_id++,
        owner: parseInt(player_id),
        tile: warrior_tile_index,
        homecity: 0,
        type: 1, // Warriors
        activity: 0,
        movesleft: 1,
        hp: 10,
        facing: 1,
        done_moving: false,
        action_decision_want: 0,
        action_decision_tile: 0,
        ssa_controller: 0,
        transported: false
      });
    }
    
    // Create 2 explorers for each player
    for (i = 0; i < 1; i++) {
      offset = explorer_offsets[i];
      var explorer_x = start_pos.x + offset[0];
      var explorer_y = start_pos.y + offset[1];
      
      // Find land tile if offset position is on water
      var explorer_pos = find_land_tile(explorer_x, explorer_y, 50);
      var explorer_tile_index = explorer_pos.x + explorer_pos.y * map.xsize;
      
      create_unit({
        id: next_unit_id++,
        owner: parseInt(player_id),
        tile: explorer_tile_index,
        homecity: 0,
        type: 3, // Explorer
        activity: 0,
        movesleft: 2,
        hp: 10,
        facing: 2,
        done_moving: false,
        action_decision_want: 0,
        action_decision_tile: 0,
        ssa_controller: 0,
        transported: false
      });
    }
    
    // Create 3 settlers for each player
    for (i = 0; i < 1; i++) {
      offset = settler_offsets[i];
      var settler_x = start_pos.x + offset[0];
      var settler_y = start_pos.y + offset[1];
      
      // Find land tile if offset position is on water
      var settler_pos = find_land_tile(settler_x, settler_y, 50);
      var settler_tile_index = settler_pos.x + settler_pos.y * map.xsize;
      
      create_unit({
        id: next_unit_id++,
        owner: parseInt(player_id),
        tile: settler_tile_index,
        homecity: 0,
        type: 0, // Settlers
        activity: 0,
        movesleft: 1,
        hp: 10,
        facing: 3,
        done_moving: false,
        action_decision_want: 0,
        action_decision_tile: 0,
        ssa_controller: 0,
        transported: false
      });
    }
  }
  
  var unitDescriptions = [];
  for (var id in server_units) {
    unitDescriptions.push(unit_types[server_units[id].type].name);
  }
  console.log("[Server Units] Created " + Object.keys(server_units).length + " units: " + 
              unitDescriptions.slice(0, 5).join(", ") + "...");
}

/**************************************************************************
 * Handle unit orders from the client (e.g., movement)
 * 
 * This function processes unit movement requests in standalone mode.
 * It updates the server's unit state and sends the result back to the client.
 * 
 * @param {Object} packet - The unit orders packet from the client
 **************************************************************************/
function server_handle_unit_orders(packet) {
  console.log("[Server Units] Handling unit orders for unit " + packet.unit_id);
  
  // Get the unit from SERVER's units object
  var punit = server_units[packet.unit_id];
  if (!punit) {
    console.error("[Server Units] Unit not found in server_units: " + packet.unit_id);
    return;
  }
  
  // Get the orders
  var orders = packet.orders;
  if (!orders || orders.length === 0) {
    console.error("[Server Units] No orders in packet");
    return;
  }
  
  // Get the current tile
  var current_tile = index_to_tile(punit.tile);
  if (!current_tile) {
    console.error("[Server Units] Current tile not found for unit " + packet.unit_id);
    return;
  }
  
  // Process the first order (for now, just handle single-step movement)
  var order = orders[0];
  
  // Handle movement orders
  if (order.order === ORDER_MOVE || order.order === ORDER_ACTION_MOVE) {
    var dir = order.dir;
    
    if (dir === undefined || dir < 0) {
      console.error("[Server Units] Invalid direction: " + dir);
      return;
    }
    
    // Check if unit has movement points left
    if (punit.movesleft <= 0) {
      console.log("[Server Units] Unit " + packet.unit_id + " has no movement points left");
      return;
    }
    
    // Calculate the new tile
    var new_tile = mapstep(current_tile, dir);
    
    if (!new_tile) {
      console.error("[Server Units] Cannot move in direction " + dir);
      return;
    }
    
    console.log("[Server Units] Moving unit " + packet.unit_id + " from tile " + punit.tile + " to tile " + new_tile.index);
    
    // Update the server's unit state
    punit.tile = new_tile.index;
    punit.facing = dir;
    
    // Reduce moves left
    // TODO: In the future, consider different movement costs for terrain types
    // For now, using a simple cost of 1 move per tile
    punit.movesleft--;
    punit.done_moving = punit.movesleft <= 0;
    
    // Send the updated unit info back to the client
    handle_unit_info({
      id: punit.id,
      owner: punit.owner,
      tile: punit.tile,
      homecity: punit.homecity,
      type: punit.type,
      activity: punit.activity,
      movesleft: punit.movesleft,
      hp: punit.hp,
      facing: punit.facing,
      done_moving: punit.done_moving,
      action_decision_want: punit.action_decision_want,
      action_decision_tile: punit.action_decision_tile
    });
    
    // Update vision after unit movement
    // This reveals new tiles and creates fog where the unit moved from
    console.log("[Server Units] Updating vision after unit movement");
    server_update_player_vision(punit.owner);
    
    console.log("[Server Units] Unit movement completed");
  } else {
    console.log("[Server Units] Ignoring order type: " + order.order);
  }
}