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
var STANDALONE_STARTUP_DELAY_MS = 1000;  // Increased delay to allow textures to load
var STANDALONE_MAP_WIDTH = 40;          // Map width in tiles
var STANDALONE_MAP_HEIGHT = 30;         // Map height in tiles


/**************************************************************************
 * Initialize standalone mode
 * Called when the standalone HTML page loads
 **************************************************************************/
function init_standalone() {
  console.log("[Standalone] Initializing Freeciv-web in standalone mode");
  console.log("[Standalone] Startup delay: " + STANDALONE_STARTUP_DELAY_MS + "ms");

  standalone_mode = true;

  init_sprites();


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

  console.log("[Standalone] Setting client state to C_S_RUNNING");
  set_client_state(C_S_RUNNING);
  console.log("[Standalone] Standalone game started successfully");
  advance_unit_focus();
  console.log("[Standalone] Advance unit focus called");
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
