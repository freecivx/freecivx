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
  
  // Create player 0 (human player)
  players[0] = {
    playerno: 0,
    name: "You",
    username: "Player",
    nation: 0, // Romans
    flags: new BitVector([false]), // Not AI
    gives_shared_vision: new BitVector([]),
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
  };
  
  // Create AI players
  if (numPlayers > 1) {
    players[1] = {
      playerno: 1,
      name: "Cleopatra",
      username: "AI",
      nation: 1, // Egyptians
      flags: new BitVector([true]), // Is AI
      gives_shared_vision: new BitVector([]),
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
    };
  }
  
  if (numPlayers > 2) {
    players[2] = {
      playerno: 2,
      name: "Pericles",
      username: "AI",
      nation: 2, // Greeks
      flags: new BitVector([true]), // Is AI
      gives_shared_vision: new BitVector([]),
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
    };
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
  
  // Set game info
  game_info = {
    turn: 1,
    year: -4000,
    players_max: 10,
    aifill: 0
  };
  
  // Set calendar info (required for get_year_string)
  calendar_info = {
    negative_year_label: " BC",
    positive_year_label: " AD"
  };
  
  // Set observing flag to false
  if (typeof observing !== 'undefined') {
    observing = false;
  }
  
  console.log("[Server Game] Setup client connection (player: " + client.conn.playing.name + 
              ", turn: " + game_info.turn + ", year: " + game_info.year + ")");
}