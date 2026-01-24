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
 */

var standalone_mode = false;

// Configuration constants for standalone mode
var STANDALONE_STARTUP_DELAY_MS = 500;  // Delay before auto-starting the game
var STANDALONE_MAP_WIDTH = 40;          // Map width in tiles
var STANDALONE_MAP_HEIGHT = 30;         // Map height in tiles

/**************************************************************************
 * Initialize standalone mode
 * Called when the standalone HTML page loads
 **************************************************************************/
function init_standalone() {
  console.log("Initializing Freeciv-web in standalone mode");
  
  // Set global flag for other modules to detect standalone mode
  if (typeof window !== 'undefined') {
    window.is_standalone = true;
  }
  
  // Initialize any standalone-specific settings
  setup_standalone_environment();
  
  // Start the game automatically after a short delay to allow initialization
  setTimeout(function() {
    start_standalone_game();
  }, STANDALONE_STARTUP_DELAY_MS);
}

/**************************************************************************
 * Setup standalone environment
 * Configure any standalone-specific settings and overrides
 **************************************************************************/
function setup_standalone_environment() {
  console.log("Setting up standalone environment");
  
  // Override network_init to prevent websocket connection
  if (typeof network_init !== 'undefined') {
    var original_network_init = network_init;
    network_init = function() {
      console.log("Skipping network initialization in standalone mode");
      // Don't call original network_init
    };
  }
  
  // Ensure window sizing works in standalone mode
  if (typeof setup_window_size === 'function') {
    $(window).on('resize', function() {
      setup_window_size();
    });
  }
}

/**************************************************************************
 * Check if running in standalone mode
 * Other modules can call this to detect standalone operation
 **************************************************************************/
function is_standalone_mode() {
  return standalone_mode === true || (typeof window !== 'undefined' && window.is_standalone === true);
}

/**************************************************************************
 * Start standalone game with mock data
 **************************************************************************/
function start_standalone_game() {
  console.log("Starting standalone game with mock data");
  
  // Initialize game structures
  game_init();
  
  // Create mock data
  create_mock_game_data();
  
  // Initialize WebGL loader and resources before starting the game
  // This is necessary because in standalone mode we bypass the normal
  // tileset preloading flow that initializes these resources
  initialize_standalone_webgl();
  
  // Set client state to running - this will trigger the game UI to show
  set_client_state(C_S_RUNNING);
  
  console.log("Standalone game started successfully");
}

/**************************************************************************
 * Create mock game data for standalone mode
 **************************************************************************/
function create_mock_game_data() {
  console.log("Creating mock game data");
  
  // Initialize mock server settings (must be first to prevent errors)
  create_mock_server_settings();
  
  // Initialize mock map
  create_mock_map();
  
  // Initialize mock ruleset data
  create_mock_ruleset();
  
  // Initialize mock players
  create_mock_players();
  
  // Initialize mock cities
  create_mock_cities();
  
  // Initialize mock units
  create_mock_units();
  
  // Set up the client connection
  setup_mock_client_connection();
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
  
  // Create terrain types (simplified)
  terrains = {
    0: { id: 0, name: "Grassland", graphic: "grassland", graphic_str: "grassland" },
    1: { id: 1, name: "Ocean", graphic: "ocean", graphic_str: "ocean" },
    2: { id: 2, name: "Plains", graphic: "plains", graphic_str: "plains" },
    3: { id: 3, name: "Forest", graphic: "forest", graphic_str: "forest" },
    4: { id: 4, name: "Hills", graphic: "hills", graphic_str: "hills" },
    5: { id: 5, name: "Mountains", graphic: "mountains", graphic_str: "mountains" }
  };
  
  // Initialize each tile
  for (var y = 0; y < map.ysize; y++) {
    for (var x = 0; x < map.xsize; x++) {
      var index = x + y * map.xsize;
      
      // Determine terrain based on position
      var terrain;
      if (y < 2 || y >= map.ysize - 2) {
        terrain = 1; // Ocean at top and bottom
      } else if (x < 2 || x >= map.xsize - 2) {
        terrain = 1; // Ocean at sides
      } else {
        // Random terrain in the middle
        var rand = Math.random();
        if (rand < 0.4) terrain = 0; // Grassland
        else if (rand < 0.6) terrain = 2; // Plains
        else if (rand < 0.75) terrain = 3; // Forest
        else if (rand < 0.9) terrain = 4; // Hills
        else terrain = 5; // Mountains
      }
      
      tiles[index] = {
        index: index,
        x: x,
        y: y,
        terrain: terrain,
        known: 2, // TILE_KNOWN_SEEN
        extras: new BitVector(['0']),
        units: [],
        owner: null,
        claimer: null,
        worked: null,
        height: terrain === 5 ? 15 : (terrain === 4 ? 10 : 0),
        spec_sprite: null,
        goto_dir: null,
        nuke: 0
      };
    }
  }
  
  console.log("Created mock map: " + map.xsize + "x" + map.ysize + " tiles");
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
  
  console.log("Created mock ruleset data");
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
  
  console.log("Created " + Object.keys(players).length + " mock players");
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
  
  console.log("Created " + Object.keys(cities).length + " mock cities");
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
  
  console.log("Created " + Object.keys(units).length + " mock units");
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
  
  console.log("Setup mock client connection");
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
  
  console.log("Created mock server_settings");
}

/**************************************************************************
 * Initialize WebGL resources for standalone mode
 * This initializes the GLTFLoader and other resources that would normally
 * be initialized during tileset preloading
 **************************************************************************/
function initialize_standalone_webgl() {
  console.log("Initializing WebGL resources for standalone mode");
  
  // Initialize the GLTF loader if it hasn't been initialized yet
  if (!loader) {
    loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/javascript/webgl/libs/');
    dracoLoader.setDecoderConfig({ type: 'wasm' });
    loader.setDRACOLoader(dracoLoader);
    console.log("Initialized GLTFLoader for standalone mode");
  }
  
  // Initialize webgl_textures if not already initialized
  if (!window.webgl_textures) {
    window.webgl_textures = {};
  }
  
  // Initialize webgl_models if not already initialized  
  if (!window.webgl_models) {
    window.webgl_models = {};
  }
  
  console.log("WebGL resources initialized for standalone mode");
}
