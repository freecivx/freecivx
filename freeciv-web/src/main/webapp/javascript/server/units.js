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
 */

/**************************************************************************
 * Create units for players
 **************************************************************************/
function server_create_units() {
  console.log("[Server Units] Creating units");
  
  units = {};
  
  // Create settler for player 0
  var settler_tile_index = 7 + 5 * map.xsize;
  
  // Use handle_unit_info to create the unit
  handle_unit_info({
    id: 0,
    owner: 0,
    tile: settler_tile_index,
    homecity: 0,
    type: 0, // Settlers
    activity: 0,
    moves_left: 1,
    hp: 10,
    facing: 1,
    done_moving: false,
    action_decision_want: 0,
    action_decision_tile: 0
  });
  
  // Create warrior for player 0
  var warrior_tile_index = 6 + 6 * map.xsize;
  
  handle_unit_info({
    id: 1,
    owner: 0,
    tile: warrior_tile_index,
    homecity: 0,
    type: 1, // Warriors
    activity: 0,
    moves_left: 1,
    hp: 10,
    facing: 2,
    done_moving: false,
    action_decision_want: 0,
    action_decision_tile: 0
  });
  
  // Create warrior for player 1 if exists
  if (players[1]) {
    var warrior1_tile_index = 31 + 15 * map.xsize;
    
    handle_unit_info({
      id: 2,
      owner: 1,
      tile: warrior1_tile_index,
      homecity: 1,
      type: 1, // Warriors
      activity: 0,
      moves_left: 1,
      hp: 10,
      facing: 3,
      done_moving: false,
      action_decision_want: 0,
      action_decision_tile: 0
    });
  }
  
  // Create warrior for player 2 if exists
  if (players[2]) {
    var warrior2_tile_index = 26 + 20 * map.xsize;
    
    handle_unit_info({
      id: 3,
      owner: 2,
      tile: warrior2_tile_index,
      homecity: 2,
      type: 2, // Phalanx
      activity: 0,
      moves_left: 1,
      hp: 10,
      facing: 4,
      done_moving: false,
      action_decision_want: 0,
      action_decision_tile: 0
    });
  }
  
  var unitDescriptions = [];
  for (var id in units) {
    unitDescriptions.push(unit_types[units[id].type].name);
  }
  console.log("[Server Units] Created " + Object.keys(units).length + " units: " + unitDescriptions.join(", "));
}

/**************************************************************************
 * Handle unit orders from the client (e.g., movement)
 * 
 * This function processes unit movement requests in standalone mode.
 * It updates the unit's position and sends the result back to the client.
 * 
 * @param {Object} packet - The unit orders packet from the client
 **************************************************************************/
function server_handle_unit_orders(packet) {
  console.log("[Server Units] Handling unit orders for unit " + packet.unit_id);
  
  // Get the unit
  var punit = units[packet.unit_id];
  if (!punit) {
    console.error("[Server Units] Unit not found: " + packet.unit_id);
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
    
    // Calculate the new tile
    var new_tile = mapstep(current_tile, dir);
    
    if (!new_tile) {
      console.error("[Server Units] Cannot move in direction " + dir);
      return;
    }
    
    console.log("[Server Units] Moving unit " + packet.unit_id + " from tile " + punit.tile + " to tile " + new_tile.index);
    
    // Update the unit's tile
    punit.tile = new_tile.index;
    
    // Reduce moves left
    // TODO: In the future, consider different movement costs for terrain types
    // For now, using a simple cost of 1 move per tile
    if (punit.moves_left > 0) {
      punit.moves_left--;
    }
    
    // Update facing direction, keeping current facing if direction is invalid
    var new_facing = (dir !== undefined && dir >= 0) ? dir : punit.facing;
    
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
      facing: new_facing,
      done_moving: punit.moves_left <= 0,
      action_decision_want: punit.action_decision_want || 0,
      action_decision_tile: punit.action_decision_tile || 0
    });
    
    console.log("[Server Units] Unit movement completed");
  } else {
    console.log("[Server Units] Ignoring order type: " + order.order);
  }
}