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