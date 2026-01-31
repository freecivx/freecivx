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
      moves_left: unit_data.moves_left,
      hp: unit_data.hp,
      facing: unit_data.facing,
      done_moving: unit_data.done_moving,
      action_decision_want: unit_data.action_decision_want,
      action_decision_tile: unit_data.action_decision_tile
    };
    
    // Send to client via handle_unit_info
    handle_unit_info(unit_data);
  };
  
  // Create starting units for each player
  for (var player_id in players) {
    var pplayer = players[player_id];
    var base_x = 5 + (parseInt(player_id) * 5);
    var base_y = 5 + (parseInt(player_id) * 3);
    
    // Create 3 warriors for each player
    for (var i = 0; i < 3; i++) {
      var warrior_tile_index = (base_x + i) + (base_y + i) * map.xsize;
      create_unit({
        id: next_unit_id++,
        owner: parseInt(player_id),
        tile: warrior_tile_index,
        homecity: 0,
        type: 1, // Warriors
        activity: 0,
        moves_left: 1,
        hp: 10,
        facing: 1,
        done_moving: false,
        action_decision_want: 0,
        action_decision_tile: 0
      });
    }
    
    // Create 2 explorers for each player
    for (var i = 0; i < 2; i++) {
      var explorer_tile_index = (base_x + i + 3) + (base_y + i) * map.xsize;
      create_unit({
        id: next_unit_id++,
        owner: parseInt(player_id),
        tile: explorer_tile_index,
        homecity: 0,
        type: 3, // Explorer
        activity: 0,
        moves_left: 2,
        hp: 10,
        facing: 2,
        done_moving: false,
        action_decision_want: 0,
        action_decision_tile: 0
      });
    }
    
    // Create 3 settlers for each player
    for (var i = 0; i < 3; i++) {
      var settler_tile_index = (base_x + i) + (base_y + i + 1) * map.xsize;
      create_unit({
        id: next_unit_id++,
        owner: parseInt(player_id),
        tile: settler_tile_index,
        homecity: 0,
        type: 0, // Settlers
        activity: 0,
        moves_left: 1,
        hp: 10,
        facing: 3,
        done_moving: false,
        action_decision_want: 0,
        action_decision_tile: 0
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
    if (punit.moves_left <= 0) {
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
    punit.moves_left--;
    punit.done_moving = punit.moves_left <= 0;
    
    // Send the updated unit info back to the client
    handle_unit_info({
      id: punit.id,
      owner: punit.owner,
      tile: punit.tile,
      homecity: punit.homecity,
      type: punit.type,
      activity: punit.activity,
      moves_left: punit.moves_left,
      hp: punit.hp,
      facing: punit.facing,
      done_moving: punit.done_moving,
      action_decision_want: punit.action_decision_want,
      action_decision_tile: punit.action_decision_tile
    });
    
    console.log("[Server Units] Unit movement completed");
  } else {
    console.log("[Server Units] Ignoring order type: " + order.order);
  }
}