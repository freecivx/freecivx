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
 * Game state management for the JavaScript server
 * 
 * This module handles:
 * - Game initialization and setup
 * - Player creation and management
 * - Game info and settings
 * - Client connection setup
 */

/**************************************************************************
 * Initialize server settings
 * This prevents errors when accessing server_settings in the client code
 **************************************************************************/
function server_create_settings() {
  // Initialize server_settings if it doesn't exist
  if (typeof server_settings === 'undefined') {
    window.server_settings = {};
  }
  
  // Add borders settings
  server_settings['borders'] = {
    id: 'borders',
    name: 'borders',
    is_visible: true,
    val: true
  };
  
  // Add other common server settings
  server_settings['metamessage'] = {
    id: 'metamessage',
    name: 'metamessage',
    val: 'JavaScript Server Mode'
  };
  
  server_settings['techlevel'] = {
    id: 'techlevel',
    name: 'techlevel',
    val: 0
  };
  
  server_settings['landmass'] = {
    id: 'landmass',
    name: 'landmass',
    val: 30
  };
  
  server_settings['nukes_minor'] = {
    id: 'nukes_minor',
    name: 'nukes_minor',
    val: true
  };
  
  server_settings['nukes_major'] = {
    id: 'nukes_major',
    name: 'nukes_major',
    val: true
  };
  
  console.log("[Server Game] Created server settings");
}

/**************************************************************************
 * Create player data
 * @param {number} numPlayers - Number of players to create (default: 3)
 **************************************************************************/
function server_create_players(numPlayers) {
  numPlayers = numPlayers || 3;
  
  console.log("[Server Game] Creating " + numPlayers + " players");
  
  players = {};
  
  // Create player 0 (human player) using handle_player_info
  handle_player_info({
    playerno: 0,
    name: "You",
    username: "Player",
    nation: 0, // Romans
    flags: [false], // Not AI - will be converted to BitVector
    gives_shared_vision: [], // Will be converted to BitVector
    gold: 50,
    government: 0,
    tech_goal: 0,
    researching: 0,
    bulbs: 0,
    tax: 50,
    luxury: 0,
    science: 50,
    score: 0,
    is_alive: true,
    phase_done: false,
    nturns_idle: 0,
    team: 0,
    culture: 0,
    expected_income: 5
  });
  
  // Create AI players
  if (numPlayers > 1) {
    handle_player_info({
      playerno: 1,
      name: "Cleopatra",
      username: "AI",
      nation: 1, // Egyptians
      flags: [true], // Is AI
      gives_shared_vision: [],
      gold: 50,
      government: 0,
      tech_goal: 0,
      researching: 0,
      bulbs: 0,
      tax: 50,
      luxury: 0,
      science: 50,
      score: 0,
      is_alive: true,
      phase_done: false,
      nturns_idle: 0,
      team: 1,
      culture: 0,
      expected_income: 5
    });
  }
  
  if (numPlayers > 2) {
    handle_player_info({
      playerno: 2,
      name: "Pericles",
      username: "AI",
      nation: 2, // Greeks
      flags: [true], // Is AI
      gives_shared_vision: [],
      gold: 50,
      government: 0,
      tech_goal: 0,
      researching: 0,
      bulbs: 0,
      tax: 50,
      luxury: 0,
      science: 50,
      score: 0,
      is_alive: true,
      phase_done: false,
      nturns_idle: 0,
      team: 2,
      culture: 0,
      expected_income: 5
    });
  }
  
  var playerNames = [];
  for (var i = 0; i < numPlayers; i++) {
    playerNames.push(players[i].name);
  }
  console.log("[Server Game] Created players: " + playerNames.join(", "));
}

/**************************************************************************
 * Setup client connection
 **************************************************************************/
function server_setup_client_connection() {
  // Initialize client connection
  client = {
    conn: {
      playing: players[0], // Set the human player
      observer: false
    }
  };
  
  // Set game info using handle_game_info
  handle_game_info({
    turn: 1,
    year: -4000,
    players_max: 10,
    aifill: 0
  });
  
  // Set calendar info using handle_calendar_info (required for get_year_string)
  handle_calendar_info({
    negative_year_label: " BC",
    positive_year_label: " AD"
  });
  
  // Set observing flag to false
  if (typeof observing !== 'undefined') {
    observing = false;
  }
  
  console.log("[Server Game] Setup client connection (player: " + client.conn.playing.name + 
              ", turn: " + game_info.turn + ", year: " + game_info.year + ")");
}

/**************************************************************************
 * Handle player phase done (turn done) from the client
 * 
 * This function processes turn done requests in standalone mode.
 * It advances the turn, resets unit movement points, and notifies the client.
 * 
 * @param {Object} packet - The player phase done packet from the client
 **************************************************************************/
function server_handle_turn_done(packet) {
  console.log("[Server Game] Handling turn done for turn " + packet.turn);
  
  // Send end turn notification to client
  handle_end_turn({});
  
  // Increment the turn counter
  game_info.turn++;
  
  // Calculate the new year (simple calculation: +50 years per turn for ancient era)
  game_info.year += 50;
  
  // Update game info on client
  handle_game_info({
    turn: game_info.turn,
    year: game_info.year,
    players_max: game_info.players_max,
    aifill: game_info.aifill
  });
  
  // Reset movement points for all units
  for (var unit_id in server_units) {
    var punit = server_units[unit_id];
    
    // Get the unit type to determine base movement points
    var punit_type = unit_types[punit.type];
    if (punit_type) {
      // Reset moves_left to the unit type's movement rate
      punit.moves_left = utype_real_base_move_rate(punit_type);
      punit.done_moving = false;
      
      // Send updated unit info to client
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
    }
  }
  
  console.log("[Server Game] Turn advanced to " + game_info.turn + " (year: " + game_info.year + ")");
  
  // Send begin turn notification to client
  handle_begin_turn({});
  
  console.log("[Server Game] Turn done processing completed");
}