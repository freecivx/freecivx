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
 * City management for the JavaScript server
 * 
 * This module handles:
 * - City creation and initialization
 * - City properties and production
 */

// Server-side cities object - separate from client's cities
// Tracks server state for city management (similar to server_units)
var server_cities = {};

// Counter for generating unique city IDs
var next_city_id = 0;

/**************************************************************************
 * Create cities for players
 **************************************************************************/
function server_create_cities() {
  console.log("[Server Cities] Creating cities");
  
  // Initialize server's city tracking
  server_cities = {};
  
  cities = {};
  
  // Create capital city for player 0
  var capital_tile_index = 5 + 5 * map.xsize; // Near corner
  
  // Store in server's cities object
  server_cities[0] = {
    id: 0,
    owner: 0,
    tile: capital_tile_index,
    name: "Rome"
  };
  
  // Use handle_city_info to create the city
  handle_city_info({
    id: 0,
    owner: 0,
    tile: capital_tile_index,
    name: "Rome",
    size: 3,
    style: 1, // Classical style
    improvements: [true, false, false], // Has Palace - will be converted to BitVector
    city_options: [],  // Required by handle_city_info
    production_kind: 0, // Building
    production_value: 1, // Barracks
    shield_stock: 10,
    food_stock: 5,
    food_prod: 2,
    prod_prod: 2,
    trade_prod: 2,
    gold_prod: 1,
    culture: 5,
    science_prod: 1,
    can_build_improvement: new BitVector([]),
    can_build_unit: new BitVector([]),
    ppl_happy: [1,1,1,1,1,1],
    ppl_content: [1,1,1,1,1,1],
    ppl_unhappy: [0,0,0,0,0,0],
    ppl_angry: [0,0,0,0,0,0]
  });
  
  // Update tile ownership using handle_tile_info
  handle_tile_info({
    tile: capital_tile_index,
    owner: 0,
    worked: 0
  });
  
  // Create city for player 1 if exists
  if (players[1]) {
    var city1_tile_index = 30 + 15 * map.xsize;
    
    server_cities[1] = {
      id: 1,
      owner: 1,
      tile: city1_tile_index,
      name: "Memphis"
    };
    
    handle_city_info({
      id: 1,
      owner: 1,
      tile: city1_tile_index,
      name: "Memphis",
      size: 2,
      style: 0, // European style
      improvements: [true, false, false], // Has Palace
      city_options: [],
      production_kind: 1, // Unit
      production_value: 1, // Warriors
      shield_stock: 5,
      food_stock: 3,
      food_prod: 2,
      prod_prod: 1,
      trade_prod: 1,
      gold_prod: 1,
      culture: 3,
      science_prod: 1,
      can_build_improvement: new BitVector([]),
      can_build_unit: new BitVector([]),
      ppl_happy: [1,1,1,1,1,1],
      ppl_content: [1,1,1,1,1,1],
      ppl_unhappy: [0,0,0,0,0,0],
      ppl_angry: [0,0,0,0,0,0]
    });
    
    handle_tile_info({
      tile: city1_tile_index,
      owner: 1,
      worked: 1
    });
  }
  
  // Create city for player 2 if exists
  if (players[2]) {
    var city2_tile_index = 25 + 20 * map.xsize;
    
    server_cities[2] = {
      id: 2,
      owner: 2,
      tile: city2_tile_index,
      name: "Athens"
    };
    
    handle_city_info({
      id: 2,
      owner: 2,
      tile: city2_tile_index,
      name: "Athens",
      size: 2,
      style: 1, // Classical style
      improvements: [true, false, false], // Has Palace
      city_options: [],
      production_kind: 1, // Unit
      production_value: 1, // Warriors
      shield_stock: 5,
      food_stock: 3,
      food_prod: 2,
      prod_prod: 1,
      trade_prod: 1,
      gold_prod: 1,
      culture: 3,
      science_prod: 1,
      can_build_improvement: new BitVector([]),
      can_build_unit: new BitVector([]),
      ppl_happy: [1,1,1,1,1,1],
      ppl_content: [1,1,1,1,1,1],
      ppl_unhappy: [0,0,0,0,0,0],
      ppl_angry: [0,0,0,0,0,0]
    });
    
    handle_tile_info({
      tile: city2_tile_index,
      owner: 2,
      worked: 2
    });
  }
  
  var cityNames = [];
  for (var id in cities) {
    cityNames.push(cities[id].name + " (size " + cities[id].size + ")");
  }
  console.log("[Server Cities] Created " + Object.keys(cities).length + " cities: " + cityNames.join(", "));
  
  // Set next city ID for future city creation
  next_city_id = Object.keys(server_cities).length;
  console.log("[Server Cities] Next city ID: " + next_city_id);
}

/**************************************************************************
 * Handle city name suggestion request from client
 * This is called when a settler wants to build a city and needs a name
 **************************************************************************/
function server_handle_city_name_suggestion_req(packet) {
  console.log("[Server Cities] Handling city name suggestion request for unit " + packet.unit_id);
  
  // Get the unit from server_units
  var punit = server_units[packet.unit_id];
  
  if (!punit) {
    console.error("[Server Cities] Unit " + packet.unit_id + " not found");
    return;
  }
  
  // Generate a suggested city name based on player
  var suggested_names = [
    ["New Rome", "Florence", "Milan", "Venice", "Naples", "Turin", "Genoa"],
    ["New Memphis", "Thebes", "Alexandria", "Giza", "Luxor", "Aswan", "Cairo"],
    ["New Athens", "Sparta", "Corinth", "Delphi", "Olympia", "Argos", "Rhodes"]
  ];
  
  var player_id = punit.owner;
  var player_names = suggested_names[player_id] || ["New City"];
  
  // Find an unused city name
  var suggested_name = player_names[0];
  var existing_names = Object.values(server_cities).map(function(c) { return c.name; });
  
  for (var i = 0; i < player_names.length; i++) {
    if (existing_names.indexOf(player_names[i]) === -1) {
      suggested_name = player_names[i];
      break;
    }
  }
  
  // If all names are used, append a number
  if (existing_names.indexOf(suggested_name) !== -1) {
    suggested_name = player_names[0] + " " + next_city_id;
  }
  
  console.log("[Server Cities] Suggesting city name: " + suggested_name);
  
  // Send city name suggestion response to client
  handle_city_name_suggestion_info({
    unit_id: packet.unit_id,
    name: suggested_name
  });
}

/**************************************************************************
 * Handle building a new city (ACTION_FOUND_CITY)
 * This is called when the player confirms the city name and builds the city
 **************************************************************************/
function server_handle_build_city(packet) {
  console.log("[Server Cities] Handling build city action for unit " + packet.actor_id);
  
  // Get the unit from server_units
  var punit = server_units[packet.actor_id];
  
  if (!punit) {
    console.error("[Server Cities] Unit " + packet.actor_id + " not found");
    return;
  }
  
  // Validate unit can build city
  var ptype = unit_types[punit.type];
  if (!ptype) {
    console.error("[Server Cities] Unit type " + punit.type + " not found");
    return;
  }
  
  // Check if unit is a Settler or Engineer
  if (ptype.name !== "Settlers" && ptype.name !== "Engineers") {
    console.error("[Server Cities] Unit is not a Settler or Engineer");
    return;
  }
  
  // Check if unit has movement points
  if (punit.moves_left <= 0) {
    console.error("[Server Cities] Unit has no movement points left");
    return;
  }
  
  // Check if there's already a city at this location
  var tile = index_to_tile(punit.tile);
  
  if (!tile) {
    console.error("[Server Cities] Tile " + punit.tile + " not found");
    return;
  }
  
  // Check terrain type - cities cannot be built on ocean
  var terrain = tile.terrain;
  if (terrain && (terrain === T_OCEAN || terrain === T_DEEP_OCEAN)) {
    console.error("[Server Cities] Cannot build city on ocean tile");
    return;
  }
  
  if (tile_city(tile)) {
    console.error("[Server Cities] City already exists at this location");
    return;
  }
  
  // Decode the city name
  var city_name = decodeURIComponent(packet.name);
  console.log("[Server Cities] Building city: " + city_name + " at tile " + punit.tile);
  
  // Create the new city
  var new_city_id = next_city_id++;
  
  // Store in server's cities object
  server_cities[new_city_id] = {
    id: new_city_id,
    owner: punit.owner,
    tile: punit.tile,
    name: city_name
  };
  
  // Send city info to client via handle_city_info
  handle_city_info({
    id: new_city_id,
    owner: punit.owner,
    tile: punit.tile,
    name: city_name,
    size: 1,  // New cities start with size 1
    style: 1,
    improvements: [false, false, false],  // No improvements initially
    city_options: [],
    production_kind: 1, // Unit
    production_value: 1, // Warriors
    shield_stock: 0,
    food_stock: 0,
    food_prod: 2,
    prod_prod: 1,
    trade_prod: 1,
    gold_prod: 0,
    culture: 0,
    science_prod: 0,
    can_build_improvement: new BitVector([]),
    can_build_unit: new BitVector([]),
    ppl_happy: [1,1,1,1,1,1],
    ppl_content: [1,1,1,1,1,1],
    ppl_unhappy: [0,0,0,0,0,0],
    ppl_angry: [0,0,0,0,0,0]
  });
  
  // Update tile ownership
  handle_tile_info({
    tile: punit.tile,
    owner: punit.owner,
    worked: new_city_id
  });
  
  // Remove the unit (settlers are consumed when building a city)
  console.log("[Server Cities] Removing unit " + packet.actor_id + " after building city");
  delete server_units[packet.actor_id];
  
  // Send unit removal to client
  handle_unit_remove({
    unit_id: packet.actor_id
  });
  
  console.log("[Server Cities] City " + city_name + " (ID: " + new_city_id + ") built successfully");
  
  // Send a chat message to confirm
  server_send_chat_message("City " + city_name + " has been founded!", E_CHAT_MSG);
}