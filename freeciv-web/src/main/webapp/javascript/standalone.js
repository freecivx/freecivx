/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2015  The Freeciv-web project

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
 * Standalone-specific initialization and functionality
 * This module provides the necessary glue code for running Freeciv-web
 * in standalone mode without a full server infrastructure.
 * 
 * ARCHITECTURE:
 * ------------
 * Standalone mode bypasses the normal network stack and creates mock game data:
 * 1. HTML page loads and calls init_standalone()
 * 2. After delay, setup_standalone_environment() prepares the UI
 * 3. start_standalone_game() creates mock data (map, players, cities, units)
 * 4. WebGL renderer initializes with the mock data
 * 5. Client state is set to C_S_RUNNING to start the game loop
 * 
 * KEY DIFFERENCES FROM NORMAL MODE:
 * - No WebSocket connection to Freeciv C server
 * - No multiplayer or AI turns (static game state)
 * - All game data is procedurally generated in JavaScript
 * - Limited interaction (primarily view-only)
 * 
 * TIMING DEPENDENCIES:
 * - STANDALONE_STARTUP_DELAY_MS: Wait for sprite/texture loading
 * - STANDALONE_WEBGL_INIT_DELAY_MS: Wait for WebGL context and geometry
 * 
 * TODO: Replace delays with Promise-based initialization for more reliable startup
 * 
 * For more details, see:
 * - QUICKSTART.md - Quick setup guide
 * - DEVELOPMENT.md - Detailed architecture documentation
 */

var standalone_mode = false;

// Configuration constants for standalone mode
var STANDALONE_STARTUP_DELAY_MS = 1000;  // Increased delay to allow textures to load
var STANDALONE_MAP_WIDTH = 40;          // Map width in tiles (adjustable for testing)
var STANDALONE_MAP_HEIGHT = 30;         // Map height in tiles (adjustable for testing)
// Delay before setting client state to allow WebGL renderer, textures, and geometry to initialize
// This prevents race conditions where the renderer tries to use resources before they're ready
var STANDALONE_WEBGL_INIT_DELAY_MS = 500;

// Error tracking for debugging
var standalone_errors = [];
var standalone_warnings = [];

/**************************************************************************
 * Initialize standalone mode
 * Called when the standalone HTML page loads
 * 
 * @public
 * @returns {void}
 **************************************************************************/
function init_standalone() {
  console.log("[Standalone] Initializing Freeciv-web in standalone mode");
  console.log("[Standalone] Startup delay: " + STANDALONE_STARTUP_DELAY_MS + "ms");
  console.log("[Standalone] Map size: " + STANDALONE_MAP_WIDTH + "x" + STANDALONE_MAP_HEIGHT);
  
  try {
    standalone_mode = true;

    // Initialize sprite system
    console.log("[Standalone] Initializing sprites...");
    init_sprites();
    
    // Schedule environment setup after sprites load
    setTimeout(function() {
      try {
        setup_standalone_environment();
        start_standalone_game();
      } catch (error) {
        standalone_handle_error("Failed to start standalone game", error);
      }
    }, STANDALONE_STARTUP_DELAY_MS);
    
  } catch (error) {
    standalone_handle_error("Failed to initialize standalone mode", error);
  }
}

/**************************************************************************
 * Setup standalone environment
 * Configure any standalone-specific settings and overrides
 **************************************************************************/
function setup_standalone_environment() {
  console.log("[Standalone] Setting up standalone environmentMap dimensions: " + STANDALONE_MAP_WIDTH + "x" + STANDALONE_MAP_HEIGHT);
  
  // Override network_init to prevent websocket connection
  if (typeof network_init !== 'undefined') {
    var original_network_init = network_init;
    network_init = function() {
      console.log("[Standalone] Skipping network initialization in standalone mode");
      // Don't call original network_init
    };
  }


    $(window).on('resize', function() {
      setup_window_size();
    });

    // Remove pregame intro elements
    $("#fciv-intro").remove();
    $("#game_text_input").blur();

    $("#dialog").dialog('close');
    $("#pregame_page").hide();

}

/**************************************************************************
 * Check if running in standalone mode
 * Other modules can call this to detect standalone operation
 **************************************************************************/
function is_standalone_mode() {
  return standalone_mode === true;
}

/**************************************************************************
 * Start standalone game with mock data
 **************************************************************************/
function start_standalone_game() {
  console.log("[Standalone] Starting standalone game with mock data");
  
  // Initialize game structures
  console.log("[Standalone] Calling game_init()");
  game_init();
  
  // Create mock data
  console.log("[Standalone] Creating mock game data");
  create_mock_game_data();
  
  // Validate tile heights to prevent NaN errors in geometry
  var invalidTiles = 0;
  for (var index in tiles) {
    if (tiles[index].height === undefined || tiles[index].height === null || isNaN(tiles[index].height)) {
      console.error("[Standalone] Invalid height for tile " + index + ": " + tiles[index].height);
      tiles[index].height = 0.5; // Fix invalid heights
      invalidTiles++;
    }
  }
  if (invalidTiles > 0) {
    console.warn("[Standalone] Fixed " + invalidTiles + " tiles with invalid heights");
  } else {
    console.log("[Standalone] All " + Object.keys(tiles).length + " tiles have valid heights");
  }
  
  // Initialize WebGL loader and resources before starting the game
  // This is necessary because in standalone mode we bypass the normal
  // tileset preloading flow that initializes these resources
  console.log("[Standalone] Initializing WebGL resources");
  initialize_standalone_webgl();
  
  // Delay setting client state to allow WebGL resources to initialize
  // This prevents errors with undefined textures and uninitialized geometries
  console.log("[Standalone] Waiting " + STANDALONE_WEBGL_INIT_DELAY_MS + "ms before starting renderer");
  setTimeout(function() {
    console.log("[Standalone] Setting client state to C_S_RUNNING");
    set_client_state(C_S_RUNNING);
    console.log("[Standalone] Standalone game started successfully");
    advance_unit_focus();
    console.log("[Standalone] Advance unit focus called");
  }, STANDALONE_WEBGL_INIT_DELAY_MS);
}

/**************************************************************************
 * Create mock game data for standalone mode
 **************************************************************************/
function create_mock_game_data() {
  console.log("[Standalone] Creating mock game data");
  
  // Initialize mock server settings (must be first to prevent errors)
  console.log("[Standalone] Creating server settings");
  create_mock_server_settings();
  
  // Initialize mock map
  console.log("[Standalone] Creating map data");
  create_mock_map();
  
  // Initialize mock ruleset data
  console.log("[Standalone] Creating ruleset data");
  create_mock_ruleset();
  
  // Initialize mock players
  console.log("[Standalone] Creating players");
  create_mock_players();
  
  // Initialize mock cities
  console.log("[Standalone] Creating cities");
  create_mock_cities();
  
  // Initialize mock units
  console.log("[Standalone] Creating units");
  create_mock_units();
  
  // Set up the client connection
  console.log("[Standalone] Setting up client connection");
  setup_mock_client_connection();
  
  console.log("[Standalone] Mock game data created successfully");
}

/**************************************************************************
 * Create mock map data
 **************************************************************************/
function create_mock_map() {
  // Create a configurable map for testing
  map = {
    xsize: STANDALONE_MAP_WIDTH,
    ysize: STANDALONE_MAP_HEIGHT,
    topology_id: 0,  // Standard topology
    wrap_id: WRAP_X, // Wrap in X direction
    num_valid_dirs: 8,
    num_cardinal_dirs: 4
  };
  
  // Allocate and initialize tiles
  tiles = {};
  
  // Create terrain types with correct graphic_str values for terrain rendering
  // Note: Ocean must use "floor" or "coast" for is_ocean_tile() to work correctly
  terrains = {
    0: { id: 0, name: "Grassland", graphic: "grassland", graphic_str: "grassland" },
    1: { id: 1, name: "Ocean", graphic: "floor", graphic_str: "floor" }, // FIXED: was "ocean", must be "floor"
    2: { id: 2, name: "Plains", graphic: "plains", graphic_str: "plains" },
    3: { id: 3, name: "Forest", graphic: "forest", graphic_str: "forest" },
    4: { id: 4, name: "Hills", graphic: "hills", graphic_str: "hills" },
    5: { id: 5, name: "Mountains", graphic: "mountains", graphic_str: "mountains" },
    6: { id: 6, name: "Desert", graphic: "desert", graphic_str: "desert" },
    7: { id: 7, name: "Tundra", graphic: "tundra", graphic_str: "tundra" },
    8: { id: 8, name: "Swamp", graphic: "swamp", graphic_str: "swamp" }
  };
  
  // Initialize each tile with proper height values for 3D terrain rendering
  for (var y = 0; y < map.ysize; y++) {
    for (var x = 0; x < map.xsize; x++) {
      var index = x + y * map.xsize;
      
      // Determine terrain based on position with varied heights
      var terrain;
      var height;
      
      // Create ocean borders
      if (y < 2 || y >= map.ysize - 2) {
        terrain = 1; // Ocean at top and bottom
        height = 0; // Sea level
      } else if (x < 2 || x >= map.xsize - 2) {
        terrain = 1; // Ocean at sides
        height = 0; // Sea level
      } else {
        // Create varied terrain in the middle with realistic heights
        // Heights should be in range 0-3 for proper rendering
        var rand = Math.random();
        
        if (rand < 0.30) {
          terrain = 0; // Grassland
          height = 0.5 + Math.random() * 0.1; // Slightly above sea level
        } else if (rand < 0.50) {
          terrain = 2; // Plains
          height = 0.55 + Math.random() * 0.1;
        } else if (rand < 0.65) {
          terrain = 3; // Forest
          height = 0.6 + Math.random() * 0.15;
        } else if (rand < 0.80) {
          terrain = 4; // Hills
          height = 0.56 + Math.random() * 0.2; // Hills are higher
        } else if (rand < 0.88) {
          terrain = 5; // Mountains
          height = 0.61 + Math.random() * 0.3; // Mountains are highest
        } else if (rand < 0.93) {
          terrain = 6; // Desert (limited to avoid missing cactus models)
          height = 0.5 + Math.random() * 0.15;
        } else if (rand < 0.97) {
          terrain = 7; // Tundra
          height = 0.55 + Math.random() * 0.1;
        } else {
          terrain = 8; // Swamp
          height = 0.45 + Math.random() * 0.05; // Swamps are low
        }
      }
      
      tiles[index] = {
        index: index,
        x: x,
        y: y,
        terrain: terrain,
        known: 2, // TILE_KNOWN_SEEN
        extras: new BitVector(['0']), // No extras to avoid missing model errors
        units: [],
        owner: null,
        claimer: null,
        worked: null,
        height: height, // Proper height values for 3D terrain rendering
        spec_sprite: null,
        goto_dir: null,
        nuke: 0
      };
    }
  }

  set_mapview_model_size();
  
  console.log("[Standalone] Created mock map: " + map.xsize + "x" + map.ysize + " tiles (" + Object.keys(tiles).length + " tiles initialized with varied terrain and proper heights)");
}

/**************************************************************************
 * Create mock ruleset data (nations, governments, technologies, etc.)
 **************************************************************************/
function create_mock_ruleset() {
  // Create basic nations
  nations = {
    0: {
      id: 0,
      name: "Romans",
      adjective: "Roman",
      graphic_str: "rome",
      legend: "The Roman Empire",
      color: "#8B0000"
    },
    1: {
      id: 1,
      name: "Egyptians",
      adjective: "Egyptian",
      graphic_str: "egypt",
      legend: "Ancient Egypt",
      color: "#FFD700"
    },
    2: {
      id: 2,
      name: "Greeks",
      adjective: "Greek",
      graphic_str: "greece",
      legend: "Ancient Greece",
      color: "#0000FF"
    },
    3: {
      id: 3,
      name: "Barbarians",
      adjective: "Barbarian",
      graphic_str: "barbarian",
      legend: "Barbarian Tribes",
      color: "#808080"
    }
  };
  
  // Create basic governments
  governments = {
    0: { id: 0, name: "Despotism" },
    1: { id: 1, name: "Monarchy" },
    2: { id: 2, name: "Republic" }
  };
  
  // Create basic technologies
  techs = {
    0: { id: 0, name: "Alphabet" },
    1: { id: 1, name: "Bronze Working" },
    2: { id: 2, name: "Pottery" },
    3: { id: 3, name: "The Wheel" }
  };
  
  // Create basic unit types
  unit_types = {
    0: { 
      id: 0, 
      name: "Settlers",
      graphic_str: "unit.settlers",
      move_rate: 1,
      hp: 10
    },
    1: { 
      id: 1, 
      name: "Warriors",
      graphic_str: "unit.warriors",
      move_rate: 1,
      hp: 10
    },
    2: { 
      id: 2, 
      name: "Phalanx",
      graphic_str: "unit.phalanx",
      move_rate: 1,
      hp: 10
    }
  };
  
  // Create basic improvements (populate existing const object)
  improvements[0] = { id: 0, name: "Palace" };
  improvements[1] = { id: 1, name: "Barracks" };
  improvements[2] = { id: 2, name: "Granary" };
  
  // Create city styles (city_rules)
  city_rules = {
    0: {
      style_id: 0,
      rule_name: "European",
      name: "European"
    },
    1: {
      style_id: 1,
      rule_name: "Classical",
      name: "Classical"
    },
    2: {
      style_id: 2,
      rule_name: "Modern",
      name: "Modern"
    }
  };
  
  // Create mock extras (terrain improvements like roads, mines, etc.)
  // This is needed because object_position_handler_square.js references EXTRA_* constants
  extras = {};
  
  // Define common extra types with IDs
  var extraId = 0;
  
  // Roads and infrastructure
  extras[extraId] = { id: extraId, name: "Road", rule_name: "Road" };
  window.EXTRA_ROAD = extraId++;
  
  extras[extraId] = { id: extraId, name: "Railroad", rule_name: "Railroad" };
  window.EXTRA_RAIL = extraId++;
  
  extras[extraId] = { id: extraId, name: "River", rule_name: "River" };
  window.EXTRA_RIVER = extraId++;
  
  // Resources
  extras[extraId] = { id: extraId, name: "Mine", rule_name: "Mine" };
  window.EXTRA_MINE = extraId++;
  
  extras[extraId] = { id: extraId, name: "Irrigation", rule_name: "Irrigation" };
  window.EXTRA_IRRIGATION = extraId++;
  
  extras[extraId] = { id: extraId, name: "Oil Well", rule_name: "Oil Well" };
  window.EXTRA_OIL_WELL = extraId++;
  
  // Special features
  extras[extraId] = { id: extraId, name: "Hut", rule_name: "Hut" };
  window.EXTRA_HUT = extraId++;
  
  extras[extraId] = { id: extraId, name: "Ruins", rule_name: "Ruins" };
  window.EXTRA_RUINS = extraId++;
  
  extras[extraId] = { id: extraId, name: "Fortress", rule_name: "Fortress" };
  window.EXTRA_FORTRESS = extraId++;
  
  extras[extraId] = { id: extraId, name: "Airbase", rule_name: "Airbase" };
  window.EXTRA_AIRBASE = extraId++;
  
  extras[extraId] = { id: extraId, name: "Fallout", rule_name: "Fallout" };
  window.EXTRA_FALLOUT = extraId++;
  
  extras[extraId] = { id: extraId, name: "Pollution", rule_name: "Pollution" };
  window.EXTRA_POLLUTION = extraId++;
  
  extras[extraId] = { id: extraId, name: "Buoy", rule_name: "Buoy" };
  window.EXTRA_BUOY = extraId++;
  
  console.log("[Standalone] Created mock ruleset data (nations: " + Object.keys(nations).length + 
              ", governments: " + Object.keys(governments).length + 
              ", techs: " + Object.keys(techs).length + 
              ", unit_types: " + Object.keys(unit_types).length + 
              ", extras: " + Object.keys(extras).length + ")");
}

/**************************************************************************
 * Create mock player data
 **************************************************************************/
function create_mock_players() {
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
  
  // Create player 1 (AI player)
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
  
  // Create player 2 (AI player)
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
  
  console.log("[Standalone] Created " + Object.keys(players).length + " mock players: " + 
              players[0].name + " (Human), " + players[1].name + ", " + players[2].name);
}

/**************************************************************************
 * Create mock city data
 **************************************************************************/
function create_mock_cities() {
  cities = {};
  
  // Create capital city for player 0
  var capital_tile_index = 5 + 5 * map.xsize; // Near corner
  cities[0] = {
    id: 0,
    owner: 0,
    tile: capital_tile_index,
    name: "Rome",
    size: 3,
    style: 1, // Classical style
    improvements: new BitVector([true, false, false]), // Has Palace
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
    unhappy: 0,
    ppl_happy: 1,
    ppl_content: 2,
    ppl_unhappy: 0
  };
  
  // Mark tile as owned by player 0
  tiles[capital_tile_index].owner = 0;
  tiles[capital_tile_index].worked = 0;
  
  // Create city for player 1
  var city1_tile_index = 30 + 15 * map.xsize;
  cities[1] = {
    id: 1,
    owner: 1,
    tile: city1_tile_index,
    name: "Memphis",
    size: 2,
    style: 0, // European style
    improvements: new BitVector([true, false, false]), // Has Palace
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
    unhappy: 0,
    ppl_happy: 1,
    ppl_content: 1,
    ppl_unhappy: 0
  };
  
  tiles[city1_tile_index].owner = 1;
  tiles[city1_tile_index].worked = 1;
  
  // Create city for player 2
  var city2_tile_index = 25 + 20 * map.xsize;
  cities[2] = {
    id: 2,
    owner: 2,
    tile: city2_tile_index,
    name: "Athens",
    size: 2,
    style: 1, // Classical style
    improvements: new BitVector([true, false, false]), // Has Palace
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
    unhappy: 0,
    ppl_happy: 1,
    ppl_content: 1,
    ppl_unhappy: 0
  };
  
  tiles[city2_tile_index].owner = 2;
  tiles[city2_tile_index].worked = 2;
  
  console.log("[Standalone] Created " + Object.keys(cities).length + " mock cities: " + 
              cities[0].name + " (size " + cities[0].size + "), " + 
              cities[1].name + " (size " + cities[1].size + "), " + 
              cities[2].name + " (size " + cities[2].size + ")");
}

/**************************************************************************
 * Create mock unit data
 **************************************************************************/
function create_mock_units() {
  units = {};
  
  // Create settler for player 0
  var settler_tile_index = 7 + 5 * map.xsize;
  units[0] = {
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
    anim_list: [],
    action_decision_want: 0,
    action_decision_tile: 0
  };
  
  tiles[settler_tile_index].units.push(0);
  
  // Create warrior for player 0
  var warrior_tile_index = 6 + 6 * map.xsize;
  units[1] = {
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
    anim_list: [],
    action_decision_want: 0,
    action_decision_tile: 0
  };
  
  tiles[warrior_tile_index].units.push(1);
  
  // Create warrior for player 1
  var warrior1_tile_index = 31 + 15 * map.xsize;
  units[2] = {
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
    anim_list: [],
    action_decision_want: 0,
    action_decision_tile: 0
  };
  
  tiles[warrior1_tile_index].units.push(2);
  
  // Create warrior for player 2
  var warrior2_tile_index = 26 + 20 * map.xsize;
  units[3] = {
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
    anim_list: [],
    action_decision_want: 0,
    action_decision_tile: 0
  };
  
  tiles[warrior2_tile_index].units.push(3);
  
  console.log("[Standalone] Created " + Object.keys(units).length + " mock units: " + 
              unit_types[units[0].type].name + ", " + 
              unit_types[units[1].type].name + ", " + 
              unit_types[units[2].type].name + ", " + 
              unit_types[units[3].type].name);
}

/**************************************************************************
 * Setup mock client connection
 **************************************************************************/
function setup_mock_client_connection() {
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
  
  console.log("[Standalone] Setup mock client connection (current player: " + client.conn.playing.name + 
              ", turn: " + game_info.turn + ", year: " + game_info.year + ")");
}

/**************************************************************************
 * Initialize mock server settings
 * This prevents errors when accessing server_settings in the client code
 **************************************************************************/
function create_mock_server_settings() {
  // Initialize server_settings if it doesn't exist
  if (typeof server_settings === 'undefined') {
    window.server_settings = {};
  }
  
  // Add borders settings (fixes the 'is_visible' error)
  server_settings['borders'] = {
    id: 'borders',
    name: 'borders',
    is_visible: true,
    val: true
  };
  
  // Add other common server settings that might be accessed
  server_settings['metamessage'] = {
    id: 'metamessage',
    name: 'metamessage',
    val: 'Standalone Mode'
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
  
  console.log("[Standalone] Created mock server_settings (borders: " + server_settings['borders'].val + 
              ", techlevel: " + server_settings['techlevel'].val + ")");
}


/**************************************************************************
 * Initialize WebGL resources for standalone mode
 * This initializes the GLTFLoader and other resources that would normally
 * be initialized during tileset preloading
 **************************************************************************/
function initialize_standalone_webgl() {
  console.log("[Standalone] Initializing WebGL resources for standalone mode");


  // Initialize the GLTF loader if it hasn't been initialized yet
  if (!loader) {
    console.log("[Standalone] Creating GLTFLoader");
    loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/javascript/webgl/libs/');
    dracoLoader.setDecoderConfig({ type: 'wasm' });
    loader.setDRACOLoader(dracoLoader);
    console.log("[Standalone] GLTFLoader initialized");
  } else {
    console.log("[Standalone] GLTFLoader already exists");
  }
  
  // Initialize webgl_textures if not already initialized
  if (!window.webgl_textures) {
    console.log("[Standalone] Creating webgl_textures object");
    window.webgl_textures = {};
  } else {
    console.log("[Standalone] webgl_textures already initialized with " + Object.keys(window.webgl_textures).length + " textures");
  }

  
  // Initialize webgl_models if not already initialized  
  if (!window.webgl_models) {
    console.log("[Standalone] Creating webgl_models object");
    window.webgl_models = {};
  } else {
    console.log("[Standalone] webgl_models already initialized with " + Object.keys(window.webgl_models).length + " models");
  }
  
  console.log("[Standalone] WebGL resources initialized for standalone mode");
}

/**************************************************************************
 * Error handling and debugging utilities
 **************************************************************************/

/**
 * Handle errors in standalone mode with detailed logging
 * 
 * @param {string} message - Human-readable error description
 * @param {Error} error - JavaScript Error object
 * @public
 */
function standalone_handle_error(message, error) {
  var errorInfo = {
    message: message,
    error: error ? error.toString() : "Unknown error",
    stack: error && error.stack ? error.stack : "No stack trace",
    timestamp: new Date().toISOString()
  };
  
  standalone_errors.push(errorInfo);
  
  console.error("[Standalone ERROR] " + message);
  console.error("[Standalone ERROR] Details:", error);
  
  if (error && error.stack) {
    console.error("[Standalone ERROR] Stack trace:");
    console.error(error.stack);
  }
  
  // Make errors accessible from browser console for debugging
  window.standalone_errors = standalone_errors;
}

/**
 * Log warnings in standalone mode
 * 
 * @param {string} message - Warning message
 * @public
 */
function standalone_log_warning(message) {
  standalone_warnings.push({
    message: message,
    timestamp: new Date().toISOString()
  });
  
  console.warn("[Standalone WARNING] " + message);
  window.standalone_warnings = standalone_warnings;
}

/**
 * Get diagnostic information about standalone mode state
 * Useful for debugging and troubleshooting
 * 
 * @returns {Object} Diagnostic information object
 * @public
 */
function standalone_get_diagnostics() {
  var diagnostics = {
    mode: "standalone",
    initialized: standalone_mode,
    mapSize: {
      width: STANDALONE_MAP_WIDTH,
      height: STANDALONE_MAP_HEIGHT,
      tileCount: STANDALONE_MAP_WIDTH * STANDALONE_MAP_HEIGHT
    },
    gameState: {
      tilesCreated: tiles ? Object.keys(tiles).length : 0,
      playersCreated: players ? Object.keys(players).length : 0,
      citiesCreated: cities ? Object.keys(cities).length : 0,
      unitsCreated: units ? Object.keys(units).length : 0,
      terrainsCreated: terrains ? Object.keys(terrains).length : 0
    },
    webgl: {
      texturesLoaded: window.webgl_textures ? Object.keys(window.webgl_textures).length : 0,
      modelsLoaded: window.webgl_models ? Object.keys(window.webgl_models).length : 0,
      loaderInitialized: typeof loader !== 'undefined' && loader !== null
    },
    errors: standalone_errors.length,
    warnings: standalone_warnings.length,
    clientState: typeof client_state !== 'undefined' ? client_state : 'undefined',
    timing: {
      startupDelay: STANDALONE_STARTUP_DELAY_MS,
      webglInitDelay: STANDALONE_WEBGL_INIT_DELAY_MS
    }
  };
  
  return diagnostics;
}

/**
 * Print diagnostic report to console
 * Call from browser console: standalone_print_diagnostics()
 * 
 * @public
 */
function standalone_print_diagnostics() {
  var diag = standalone_get_diagnostics();
  
  console.log("=== STANDALONE MODE DIAGNOSTICS ===");
  console.log("Mode: " + diag.mode);
  console.log("Initialized: " + diag.initialized);
  console.log("");
  console.log("Map Configuration:");
  console.log("  Size: " + diag.mapSize.width + "x" + diag.mapSize.height);
  console.log("  Total tiles: " + diag.mapSize.tileCount);
  console.log("");
  console.log("Game State:");
  console.log("  Tiles created: " + diag.gameState.tilesCreated);
  console.log("  Players created: " + diag.gameState.playersCreated);
  console.log("  Cities created: " + diag.gameState.citiesCreated);
  console.log("  Units created: " + diag.gameState.unitsCreated);
  console.log("  Terrains defined: " + diag.gameState.terrainsCreated);
  console.log("");
  console.log("WebGL:");
  console.log("  Textures loaded: " + diag.webgl.texturesLoaded);
  console.log("  Models loaded: " + diag.webgl.modelsLoaded);
  console.log("  Loader initialized: " + diag.webgl.loaderInitialized);
  console.log("");
  console.log("Status:");
  console.log("  Errors: " + diag.errors);
  console.log("  Warnings: " + diag.warnings);
  console.log("  Client state: " + diag.clientState);
  console.log("");
  console.log("Timing:");
  console.log("  Startup delay: " + diag.timing.startupDelay + "ms");
  console.log("  WebGL init delay: " + diag.timing.webglInitDelay + "ms");
  console.log("===================================");
  
  if (diag.errors > 0) {
    console.log("");
    console.log("Errors encountered:");
    standalone_errors.forEach(function(err, idx) {
      console.log("  " + (idx + 1) + ". " + err.message);
      console.log("     " + err.error);
    });
  }
  
  if (diag.warnings > 0) {
    console.log("");
    console.log("Warnings:");
    standalone_warnings.forEach(function(warn, idx) {
      console.log("  " + (idx + 1) + ". " + warn.message);
    });
  }
  
  return diag;
}

// Make diagnostics available globally for debugging
if (typeof window !== 'undefined') {
  window.standalone_get_diagnostics = standalone_get_diagnostics;
  window.standalone_print_diagnostics = standalone_print_diagnostics;
  window.standalone_handle_error = standalone_handle_error;
  window.standalone_log_warning = standalone_log_warning;
}

/**************************************************************************
 * Development helper functions
 **************************************************************************/

/**
 * Reload the standalone client (useful during development)
 * Call from browser console: standalone_reload()
 * 
 * @public
 */
function standalone_reload() {
  console.log("[Standalone] Reloading client...");
  window.location.reload();
}

/**
 * Adjust map size and reload (for testing different configurations)
 * Call from browser console: standalone_resize_map(60, 40)
 * 
 * @param {number} width - New map width
 * @param {number} height - New map height
 * @public
 */
function standalone_resize_map(width, height) {
  console.log("[Standalone] Resizing map to " + width + "x" + height);
  STANDALONE_MAP_WIDTH = width;
  STANDALONE_MAP_HEIGHT = height;
  standalone_reload();
}

// Make dev helpers available globally
if (typeof window !== 'undefined') {
  window.standalone_reload = standalone_reload;
  window.standalone_resize_map = standalone_resize_map;
}
