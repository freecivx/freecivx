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
 * Historic leader names for generating player names
 * Contains 100 famous historic leaders from various civilizations
 **************************************************************************/
var HISTORIC_LEADERS = [
  "Cleopatra", "Pericles", "Genghis Khan", "Cyrus", "Qin Shi Huang",
  "Ashoka", "Ragnar", "Hammurabi", "Hannibal", "Alexander",
  "Caesar", "Napoleon", "Elizabeth", "Victoria", "Gandhi",
  "Charlemagne", "Akbar", "Saladin", "Sitting Bull", "Montezuma",
  "Ramesses", "Nebuchadnezzar", "Darius", "Xerxes", "Attila",
  "Suleiman", "Frederick", "Catherine", "Peter", "Tokugawa",
  "Bismarck", "Meiji", "Shaka", "Mansa Musa", "Pachacuti",
  "Sejong", "Gustavus", "William", "Isabella", "Philip",
  "Maria Theresa", "Louis", "Henry", "Harald", "Harun",
  "Ramkhamhaeng", "Trajan", "Augustus", "Marcus Aurelius", "Constantine",
  "Justinian", "Theodora", "Wu Zetian", "Kublai Khan", "Tamerlane",
  "Barbarossa", "Richard", "John", "Edward", "Alfred",
  "Cnut", "Erik", "Olaf", "Sweyn", "Canute",
  "Vladimir", "Ivan", "Boris", "Casimir", "Stephen",
  "Bela", "Otto", "Leonidas", "Conrad", "Rudolf",
  "Charles", "Francis", "Ferdinand", "Albert", "Leopold",
  "Matthias", "Maximilian", "Joseph", "Franz", "Karl",
  "Wilhelm", "Friedrich", "Georg", "Ludwig", "Heinrich",
  "Phillip", "Robert", "David", "James", "George",
  "Arthur", "Harold", "Edwin", "Edmund", "Edgar",
  "Ethelred", "Aethelstan", "Offa", "Egbert", "Ceawlin"
];

/**************************************************************************
 * Generate a random leader name based on permutations of historic leaders
 * Supports up to 1000 unique leader names by combining leader names
 **************************************************************************/
function generate_leader_name(playerIndex) {
  // For the first 100 players, use the historic leaders directly
  if (playerIndex < HISTORIC_LEADERS.length) {
    return HISTORIC_LEADERS[playerIndex];
  }
  
  // For players 100-999, generate combinations
  // Use a seeded random approach to ensure consistent names
  var rng_seed = playerIndex * 7919; // Use prime number for better distribution
  
  function seeded_random() {
    rng_seed = (rng_seed * 9301 + 49297) % 233280;
    return rng_seed / 233280;
  }
  
  // Generate name by combining two leader names or adding a suffix
  var nameType = Math.floor(seeded_random() * 4);
  var leader1 = HISTORIC_LEADERS[Math.floor(seeded_random() * HISTORIC_LEADERS.length)];
  
  if (nameType === 0) {
    // Use "the Great" suffix
    return leader1 + " the Great";
  } else if (nameType === 1) {
    // Use "the Wise" suffix
    return leader1 + " the Wise";
  } else if (nameType === 2) {
    // Use roman numerals (II, III, IV, etc.)
    var numeral = ["II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
    var numeralIndex = Math.floor(seeded_random() * numeral.length);
    return leader1 + " " + numeral[numeralIndex];
  } else {
    // Combine two leader first names
    var leader2 = HISTORIC_LEADERS[Math.floor(seeded_random() * HISTORIC_LEADERS.length)];
    // Take first part of first name and second part of second name
    var parts1 = leader1.split(" ");
    var parts2 = leader2.split(" ");
    var name1 = parts1[0];
    var name2 = parts2[parts2.length - 1];
    
    // If they're the same, just use the first with a suffix
    if (name1 === name2) {
      return name1 + " the Bold";
    }
    return name1 + "-" + name2;
  }
}

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
 * @param {number} numPlayers - Number of players to create (default: 10, max: 1000)
 * @param {number} humanNation - Nation ID for the human player (optional, uses chosen_nation if available)
 **************************************************************************/
function server_create_players(numPlayers, humanNation) {
  numPlayers = numPlayers || 10;
  
  // Cap at 1000 players to match nation support
  var MAX_PLAYERS = 1000;
  if (numPlayers > MAX_PLAYERS) {
    console.log("[Server Game] Requested " + numPlayers + " players, capping at " + MAX_PLAYERS);
    numPlayers = MAX_PLAYERS;
  }
  
  // Use the specified nation or fall back to chosen_nation or default to 0
  if (humanNation === undefined || humanNation === null) {
    if (typeof chosen_nation !== 'undefined' && chosen_nation >= 0) {
      humanNation = chosen_nation;
      console.log("[Server Game] Using chosen_nation: " + humanNation);
    } else {
      humanNation = 0; // Default to Romans
    }
  }
  
  console.log("[Server Game] Creating " + numPlayers + " players (human nation: " + humanNation + ")");
  
  players = {};
  
  // Create all players
  for (var i = 0; i < numPlayers; i++) {
    var playerName;
    var playerUsername;
    var isAI;
    var playerNation;
    
    if (i === 0) {
      // First player is the human player
      playerName = "You";
      playerUsername = "Player";
      isAI = false;
      playerNation = humanNation;
    } else {
      // AI players get generated leader names
      playerName = generate_leader_name(i - 1); // -1 because first player is human
      playerUsername = "AI";
      isAI = true;
      // Assign nations sequentially, wrapping around if needed
      playerNation = i % MAX_PLAYERS;
    }
    
    handle_player_info({
      playerno: i,
      name: playerName,
      username: playerUsername,
      nation: playerNation,
      flags: [isAI], // Will be converted to BitVector
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
      team: i,
      culture: 0,
      expected_income: 5
    });
  }
  
  var playerNames = [];
  for (var i = 0; i < numPlayers; i++) {
    if (players[i]) {
      playerNames.push(players[i].name);
    }
  }
  
  if (numPlayers <= 20) {
    // For small number of players, show all names
    console.log("[Server Game] Created players: " + playerNames.join(", "));
  } else {
    // For large number of players, just show count and first few
    console.log("[Server Game] Created " + numPlayers + " players");
    console.log("[Server Game] First 10 players: " + playerNames.slice(0, 10).join(", ") + "...");
  }
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
  console.log("[Server Game] Turn " + game_info.turn + " -> " + (game_info.turn + 1));
  
  // Send end turn notification to client
  handle_end_turn({});
  
  // Process AI turns before advancing to next turn
  if (typeof server_ai_process_turn === 'function') {
    server_ai_process_turn();
  }
  
  // Increment the turn counter
  game_info.turn++;
  
  // Calculate the new year
  // TODO: This is a simplified implementation that adds a fixed amount per turn.
  // The real game uses variable year increments based on the current era.
  // For now, we use +50 years per turn which is appropriate for ancient era.
  game_info.year += 50;
  
  // Update game info on client
  handle_game_info({
    turn: game_info.turn,
    year: game_info.year,
    players_max: game_info.players_max,
    aifill: game_info.aifill
  });
  
  // Reset movement points for all units
  // Batch updates to avoid triggering multiple redraws
  var units_to_update = [];
  for (var unit_id in server_units) {
    var punit = server_units[unit_id];
    
    // Get the unit type to determine base movement points
    var punit_type = unit_types[punit.type];
    if (punit_type) {
      // Reset moves_left to the unit type's movement rate
      punit.moves_left = utype_real_base_move_rate(punit_type);
      punit.done_moving = false;
      
      // Collect unit data for batched update
      units_to_update.push({
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
  
  // Send all unit updates at once
  for (var i = 0; i < units_to_update.length; i++) {
    handle_unit_info(units_to_update[i]);
  }
  
  // Send begin turn notification to client
  handle_begin_turn({});
  
  // Send a chat message about the new turn
  server_send_chat_message("Turn " + game_info.turn + " (" + game_info.year + ")", E_CHAT_MSG);
}