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

// Direction count constant for map navigation
var NUM_DIRECTIONS = 8;

/**
 * AI player implementation for Freeciv JavaScript server
 * 
 * This module handles AI player logic including:
 * - Unit movement (random for now)
 * - City building with settlers
 */

/**************************************************************************
 * Process AI turn for all AI players
 * Called at turn change to execute all AI actions
 **************************************************************************/
function server_ai_process_turn() {
  // Iterate through all players and process AI for those that are AI controlled
  for (var player_id in players) {
    var pplayer = players[player_id];
    
    // Check if player is AI
    if (pplayer && pplayer.flags && pplayer.flags.isSet(PLRF_AI)) {
      server_ai_process_player(parseInt(player_id));
    }
  }
}

/**************************************************************************
 * Process AI logic for a single player
 * @param {number} player_id - The player ID to process
 **************************************************************************/
function server_ai_process_player(player_id) {
  // Get all units for this player
  var player_units = [];
  for (var unit_id in server_units) {
    var punit = server_units[unit_id];
    if (punit.owner === player_id) {
      player_units.push(punit);
    }
  }
  
  // Process each unit
  for (var i = 0; i < player_units.length; i++) {
    punit = player_units[i];
    server_ai_process_unit(punit);
  }
}

/**************************************************************************
 * Process AI logic for a single unit
 * @param {Object} punit - The unit to process
 **************************************************************************/
function server_ai_process_unit(punit) {
  if (!punit || !unit_types[punit.type]) {
    return;
  }
  
  var punit_type = unit_types[punit.type];
  
  // Check if unit is a settler and should build a city
  if (punit_type.name === "Settlers" && punit.movesleft > 0) {
    server_ai_settler_logic(punit);
  }
  // For other units, move randomly
  else if (punit.movesleft > 0) {
    server_ai_move_unit_randomly(punit);
  }
}

/**************************************************************************
 * AI logic for settlers - build cities
 * @param {Object} punit - The settler unit
 **************************************************************************/
function server_ai_settler_logic(punit) {
  var current_tile = index_to_tile(punit.tile);
  
  if (!current_tile) {
    console.error("[Server AI] Settler tile not found: " + punit.tile);
    return;
  }
  
  // Check if we can build a city here
  var can_build = server_ai_can_build_city(current_tile, punit.owner);
  
  if (can_build) {
    // Build city here
    console.log("[Server AI] AI settler building city at tile " + punit.tile);
    server_ai_build_city(punit);
  } else {
    // Move to a better location
    server_ai_move_unit_randomly(punit);
  }
}

/**************************************************************************
 * Check if a city can be built at the given tile
 * @param {Object} tile - The tile to check
 * @param {number} owner - The player ID
 * @returns {boolean} - True if a city can be built
 **************************************************************************/
function server_ai_can_build_city(tile, owner) {
  // Check if there's already a city at this location
  if (tile_city(tile)) {
    return false;
  }
  
  // Check if tile is ocean (can't build cities on ocean)
  if (is_ocean_tile(tile)) {
    return false;
  }
  
  // Simple AI: build if we're not too close to another city
  // Check adjacent tiles for cities
  for (var dir = 0; dir < NUM_DIRECTIONS; dir++) {
    var adj_tile = mapstep(tile, dir);
    if (adj_tile && tile_city(adj_tile)) {
      return false; // Too close to another city
    }
  }
  
  return true;
}

/**************************************************************************
 * Build a city with the settler
 * @param {Object} punit - The settler unit
 **************************************************************************/
function server_ai_build_city(punit) {
  // Generate a city name
  var city_names = [
    ["Rome", "Florence", "Milan", "Venice", "Naples", "Turin", "Genoa", "Ravenna", "Pisa", "Bologna", "Verona", "Padua", "Palermo", "Bari", "Catania", "Mantua", "Siena", "Perugia", "Ancona", "Parma"],
    ["Memphis", "Thebes", "Alexandria", "Giza", "Luxor", "Aswan", "Cairo", "Karnak", "Abydos", "Elephantine", "Heliopolis", "Tanis", "Bubastis", "Sais", "Avaris", "Pi-Ramesses", "Hermopolis", "Edfu", "Philae", "Abu Simbel"],
    ["Athens", "Sparta", "Corinth", "Delphi", "Olympia", "Argos", "Rhodes", "Thebes", "Mycenae", "Ephesus", "Miletus", "Pergamon", "Byzantium", "Smyrna", "Syracuse", "Massalia", "Cyrene", "Halicarnassus", "Knossos", "Phaistos"],
    ["Babylon", "Nineveh", "Ur", "Akkad", "Lagash", "Eridu", "Nippur", "Kish", "Uruk", "Assur", "Persepolis", "Susa", "Ecbatana", "Pasargadae", "Ctesiphon", "Seleucia", "Hatra", "Palmyra", "Mari", "Ebla"],
    ["Chang'an", "Luoyang", "Beijing", "Nanjing", "Hangzhou", "Xi'an", "Kaifeng", "Chengdu", "Guangzhou", "Suzhou", "Yangzhou", "Qufu", "Anyang", "Zhengzhou", "Dalian", "Kunming", "Shenzhen", "Tianjin", "Wuhan", "Chongqing"],
    ["Delhi", "Mumbai", "Varanasi", "Agra", "Jaipur", "Pataliputra", "Ujjain", "Kanchipuram", "Madurai", "Thanjavur", "Vijayanagara", "Hampi", "Mysore", "Hyderabad", "Calcutta", "Lucknow", "Lahore", "Peshawar", "Taxila", "Mathura"],
    ["Paris", "Lyon", "Marseille", "Toulouse", "Bordeaux", "Strasbourg", "Nantes", "Nice", "Lille", "Reims", "Rouen", "Orleans", "Avignon", "Dijon", "Tours", "Chartres", "Versailles", "Amiens", "Nancy", "Metz"],
    ["London", "York", "Canterbury", "Winchester", "Bath", "Oxford", "Cambridge", "Lincoln", "Durham", "Exeter", "Norwich", "Chester", "Bristol", "Salisbury", "Coventry", "Leicester", "Nottingham", "Birmingham", "Manchester", "Liverpool"],
    ["Constantinople", "Nicaea", "Adrianople", "Antioch", "Trebizond", "Smyrna", "Ephesus", "Thessalonica", "Philippi", "Myra", "Iconium", "Sardis", "Pergamon", "Halicarnassus", "Miletus", "Ancyra", "Caesarea", "Sinope", "Amisus", "Chalcedon"],
    ["Tenochtitlan", "Texcoco", "Tlacopan", "Cholula", "Tlaxcala", "Teotihuacan", "Tula", "Xochicalco", "Monte Alban", "Mitla", "Palenque", "Tikal", "Chichen Itza", "Uxmal", "Mayapan", "Tulum", "Copan", "Quirigua", "Calakmul", "El Mirador"]
  ];
  
  var player_names = city_names[punit.owner] || ["New City"];
  var existing_names = Object.values(server_cities).map(function(c) { return c.name; });
  
  var city_name = player_names[0];
  for (var i = 0; i < player_names.length; i++) {
    if (existing_names.indexOf(player_names[i]) === -1) {
      city_name = player_names[i];
      break;
    }
  }
  
  // If all names are used, append a number
  if (existing_names.indexOf(city_name) !== -1) {
    city_name = player_names[0] + " " + next_city_id;
  }
  
  console.log("[Server AI] Building city: " + city_name + " at tile " + punit.tile);
  
  // Create the new city
  var new_city_id = next_city_id++;
  
  // Store in server's cities object
  server_cities[new_city_id] = {
    id: new_city_id,
    owner: punit.owner,
    tile: punit.tile,
    name: city_name
  };
  
  var new_city_packet = {
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
      prod: [0,0,0,0,0,0],
      surplus: [0,0,0,0,0,0],
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
  };
  
  // Send city info to client
  handle_city_info(new_city_packet);
  handle_city_short_info(new_city_packet);
  
  // Update tile ownership
  handle_tile_info({
    tile: punit.tile,
    owner: punit.owner,
    worked: new_city_id
  });
  
  // Remove the unit (settlers are consumed when building a city)
  console.log("[Server AI] Removing settler unit " + punit.id + " after building city");
  delete server_units[punit.id];
  
  // Send unit removal to client
  handle_unit_remove({
    unit_id: punit.id
  });
}

/**************************************************************************
 * Move a unit in a random direction
 * @param {Object} punit - The unit to move
 **************************************************************************/
function server_ai_move_unit_randomly(punit) {
  if (punit.movesleft <= 0) {
    return;
  }
  
  var current_tile = index_to_tile(punit.tile);
  
  if (!current_tile) {
    console.error("[Server AI] Unit tile not found: " + punit.tile);
    return;
  }
  
  // Try random directions until we find a valid one or run out of attempts
  var max_attempts = NUM_DIRECTIONS;
  var attempts = 0;
  
  while (attempts < max_attempts && punit.movesleft > 0) {
    // Pick a random direction (0-7 for 8 directions)
    var dir = Math.floor(Math.random() * NUM_DIRECTIONS);
    
    // Try to move in that direction
    var new_tile = mapstep(current_tile, dir);
    
    if (new_tile && server_ai_can_move_to_tile(punit, new_tile)) {
      // Move the unit
      punit.tile = new_tile.index;
      punit.facing = dir;
      punit.movesleft--;
      punit.done_moving = punit.movesleft <= 0;
      
      // Send updated unit info to client
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
      
      // Update current tile for next move
      current_tile = new_tile;
    }
    
    attempts++;
  }
}

/**************************************************************************
 * Check if a unit can move to a tile
 * @param {Object} punit - The unit
 * @param {Object} tile - The target tile
 * @returns {boolean} - True if the unit can move to the tile
 **************************************************************************/
function server_ai_can_move_to_tile(punit, tile) {
  if (!tile) {
    return false;
  }
  
  // Check if the tile is ocean - land units cannot move to ocean
  // (In a more complete implementation, we would check the unit type's
  // movement capabilities, but for now we assume all units are land units)
  if (is_ocean_tile(tile)) {
    return false;
  }
  
  // For now, simple check: just make sure tile exists and is land
  // In the future, could add checks for:
  // - Enemy units on tile
  // - Zone of control
  // - Impassable terrain
  // etc.
  
  return true;
}