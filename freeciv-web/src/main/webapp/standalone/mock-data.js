/**********************************************************************
    FreecivWorld.net - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2024  The Freeciv-web project

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
 * Mock data for standalone 3D testing environment
 * Provides sample game state data for rendering tests
 */

// Terrain type constants
var T_GRASSLAND = 1;
var T_PLAINS = 2;
var T_DESERT = 3;
var T_OCEAN = 4;
var T_HILLS = 5;
var T_MOUNTAINS = 6;
var T_SWAMP = 7;
var T_TUNDRA = 8;

// Extra type constants (matching the game's dynamic assignment)
// These are normally defined dynamically in packhand.js via handle_ruleset_extra()
// but need to be predefined in standalone mode.
// NOTE: These values match the default Freeciv ruleset and may need updating if the
// ruleset changes. The values correspond to the order extras are defined in the ruleset.
var EXTRA_NONE = -1;
var EXTRA_IRRIGATION = 0;
var EXTRA_FARMLAND = 1;
var EXTRA_MINE = 2;
var EXTRA_POLLUTION = 3;
var EXTRA_HUT = 4;
var EXTRA_FORTRESS = 5;
var EXTRA_AIRBASE = 6;
var EXTRA_FALLOUT = 7;
var EXTRA_BUOY = 8;
var EXTRA_RUINS = 9;
var EXTRA_ROAD = 10;
var EXTRA_RAIL = 11;
var EXTRA_MAGLEV = 12;
var EXTRA_RIVER = 13;
var EXTRA_OIL_WELL = 14;

// Number of city styles that will be initialized
var MOCK_CITY_STYLES_COUNT = 4;


var E_CONNECTION = 98;
var observing = false;

/**
 * Initialize mock map data
 */
function init_mock_map() {
  // Create a small test map
  map = {
    xsize: 40,
    ysize: 30,
    topology_id: 0,
    wrap_id: 0
  };

  // Initialize tiles with varied terrain
  tiles = {};
  for (var x = 0; x < map.xsize; x++) {
    for (var y = 0; y < map.ysize; y++) {
      var index = y * map.xsize + x;
      
      // Create varied terrain distribution
      var terrain;
      var height = 0;
      
      // Ocean around edges
      if (x < 3 || x >= map.xsize - 3 || y < 3 || y >= map.ysize - 3) {
        terrain = 1; // Ocean
        height = -0.1;
      } 
      // Mountains in center
      else if (Math.abs(x - map.xsize/2) < 3 && Math.abs(y - map.ysize/2) < 3) {
        terrain = 5; // Mountains
        height = 0.4 + Math.random() * 0.2;
      }
      // Hills around mountains
      else if (Math.abs(x - map.xsize/2) < 6 && Math.abs(y - map.ysize/2) < 6) {
        terrain = 4; // Hills
        height = 0.2 + Math.random() * 0.1;
      }
      // Random terrain for the rest
      else {
        var rand = Math.random();
        if (rand < 0.3) {
          terrain = 0; // Grassland
          height = Math.random() * 0.05;
        } else if (rand < 0.5) {
          terrain = 3; // Plains
          height = Math.random() * 0.05;
        } else if (rand < 0.7) {
          terrain = 2; // Desert
          height = Math.random() * 0.08;
        } else {
          terrain = 6; // Swamp
          height = -0.05 + Math.random() * 0.05;
        }
      }
      
      tiles[index] = {
        index: index,
        x: x,
        y: y,
        terrain: terrain,
        height: height,
        known: 2, // TILE_KNOWN_SEEN
        owner: null,
        worked: null,
        units: [], // Units on this tile
        extras: {
          isSet: function() { return false; },
          toBitSet: function() { return []; }
        }
      };
    }
  }
  
  console.log("Mock map initialized: " + map.xsize + "x" + map.ysize + " tiles");
}

/**
 * Initialize mock player data
 */
function init_mock_players() {
  players = {};
  
  // Create a test player
  players[1] = {
    playerno: 1,
    name: "Test Player",
    username: "tester",
    nation: 0,
    team: 0,
    is_alive: true,
    flags: 0,
    ai: false,
    phase_done: false,
    nturns_idle: 0,
    is_male: true,
    government: 0,
    target_government: 0,
    real_embassy: 0,
    mood: 0,
    diplstates: {},
    gold: 100,
    tax: 50,
    science: 50,
    luxury: 0
  };
  
  console.log("Mock players initialized");
}

/**
 * Initialize mock nation data
 */
function init_mock_nations() {
  nations = {};
  
  nations[0] = {
    nation_id: 0,
    adjective: "Roman",
    noun_plural: "Romans",
    rule_name: "Roman",
    leader_name: "Caesar",
    is_playable: true,
    is_available: true
  };
  
  console.log("Mock nations initialized");
}

/**
 * Initialize mock city data
 */
function init_mock_cities() {
  cities = {};
  
  // Add a few test cities
  var city_positions = [
    {x: 10, y: 10},
    {x: 25, y: 15},
    {x: 15, y: 20}
  ];
  
  for (var i = 0; i < city_positions.length; i++) {
    var pos = city_positions[i];
    var tile_index = pos.y * map.xsize + pos.x;
    
    cities[i] = {
      id: i,
      name: "TestCity" + (i + 1),
      owner: 1,
      tile: tile_index,
      size: 3 + Math.floor(Math.random() * 5),
      style: i % MOCK_CITY_STYLES_COUNT,  // Rotate through available city styles
      pplhappy: [3],
      pplcontent: [2],
      pplunhappy: [0],
      specialists: [0, 0, 0],
      food_prod: 10,
      shield_prod: 5,
      trade_prod: 8,
      food_surplus: 2,
      shield_surplus: 2,
      trade_surplus: 2,
      pollution: 0,
      shield_stock: 10,
      granary_size: 20,
      production_kind: 1,
      production_value: 0,
      walls: false,
      occupied: false,
      rally_point: null,
      city_radius_sq: 5
    };
    
    // Mark tile as owned by city
    if (tiles[tile_index]) {
      tiles[tile_index].owner = 1;
      tiles[tile_index].worked = i;
    }
  }
  
  console.log("Mock cities initialized: " + Object.keys(cities).length + " cities");
}

/**
 * Initialize mock unit data
 */
function init_mock_units() {
  units = {};
  unit_types = {};
  
  // Create a simple unit type
  unit_types[0] = {
    unit_type_id: 0,
    name: "Settlers",
    rule_name: "Settlers",
    graphic_str: "Settlers",
    graphic_alt: "Settlers",
    sound_move: null,
    sound_move_alt: null,
    sound_fight: null,
    sound_fight_alt: null,
    build_cost: 40,
    pop_cost: 1,
    attack_strength: 0,
    defense_strength: 1,
    move_rate: 1,
    vision_radius_sq: 2,
    transport_capacity: 0,
    hp: 20,
    firepower: 1,
    obsoleted_by: -1,
    fuel: 0
  };
  
  unit_types[1] = {
    unit_type_id: 1,
    name: "Warriors",
    rule_name: "Warriors",
    graphic_str: "Warriors",
    graphic_alt: "Warriors",
    sound_move: null,
    sound_move_alt: null,
    sound_fight: null,
    sound_fight_alt: null,
    build_cost: 10,
    pop_cost: 0,
    attack_strength: 1,
    defense_strength: 1,
    move_rate: 1,
    vision_radius_sq: 2,
    transport_capacity: 0,
    hp: 10,
    firepower: 1,
    obsoleted_by: -1,
    fuel: 0
  };
  
  // Add a few test units
  var unit_positions = [
    {x: 12, y: 12, type: 0},
    {x: 20, y: 15, type: 1},
    {x: 18, y: 18, type: 1}
  ];
  
  for (var i = 0; i < unit_positions.length; i++) {
    var pos = unit_positions[i];
    var tile_index = pos.y * map.xsize + pos.x;
    
    units[i] = {
      id: i,
      tile: tile_index,
      owner: 1,
      type: pos.type,
      veteran: 0,
      hp: unit_types[pos.type].hp,
      homecity: 0,
      moves_left: unit_types[pos.type].move_rate,
      fuel: unit_types[pos.type].fuel,
      activity: 0, // ACTIVITY_IDLE
      goto_tile: null,
      paradropped: false,
      transported: false,
      done_moving: false,
      occupy: 0,
      battlegroup: -1,
      has_orders: false
    };
  }
  
  console.log("Mock units initialized: " + Object.keys(units).length + " units");
}

/**
 * Initialize mock game state
 */
function init_mock_game() {
  game_info = {
    turn: 1,
    year: -4000,
    year_label: "4000 BC",
    end_turn: 500,
    gold: 0,
    tech: 0,
    researchcost: 0,
    skill_level: 3
  };
  
  client = {
    conn: {
      playing: players[1]
    }
  };
  
  // Mock server settings
  server_settings = {
    borders: {
      is_visible: true
    }
  };
  
  // Mock extras and resources
  extras = {};
  resources = {};
  
  // Mock additional game objects
  connections = {};
  governments = {};
  // Don't reassign improvements - it's a const in improvement.js
  // techs will be initialized by init_mock_techs()
  
  console.log("Mock game state initialized");
}

/**
 * Initialize mock terrain definitions
 */
function init_mock_terrains() {
  terrains = {};
  
  var terrain_names = [
    "Grassland", "Ocean", "Desert", "Plains", "Hills", 
    "Mountains", "Swamp", "Tundra", "Arctic"
  ];
  
  for (var i = 0; i < terrain_names.length; i++) {
    terrains[i] = {
      id: i,
      name: terrain_names[i],
      rule_name: terrain_names[i],
      graphic_str: terrain_names[i].toLowerCase(),
      graphic_alt: terrain_names[i].toLowerCase(),
      movement_cost: 1,
      defense_bonus: 0,
      output: {food: 1, shield: 0, trade: 0},
      road_output_incr_pct: [0, 0, 0],
      base_time: 0,
      road_time: 0,
      irrigation_result: i,
      irrigation_food_incr: 1,
      irrigation_time: 0,
      mining_result: i,
      mining_shield_incr: 1,
      mining_time: 0,
      transform_result: i,
      transform_time: 0,
      rail_time: 0,
      clean_pollution_time: 0,
      clean_fallout_time: 0,
      pillage_time: 0,
      flags: []
    };
  }
  
  console.log("Mock terrains initialized");
}

/**
 * Initialize mock city rules (styles)
 */
function init_mock_city_rules() {
  // city_rules is declared in city.js, just populate it
  if (typeof city_rules === 'undefined') {
    window.city_rules = {};
  }
  
  // Default city styles
  var styles = [
    { id: 0, name: "European", rule_name: "European", graphic: "city.european", graphic_alt: "city.classical" },
    { id: 1, name: "Classical", rule_name: "Classical", graphic: "city.classical", graphic_alt: "city.european" },
    { id: 2, name: "Modern", rule_name: "Modern", graphic: "city.modern", graphic_alt: "city.european" },
    { id: 3, name: "Babylonian", rule_name: "Babylonian", graphic: "city.babylonian", graphic_alt: "city.classical" }
  ];
  
  for (var i = 0; i < styles.length; i++) {
    city_rules[styles[i].id] = styles[i];
  }
  
  console.log("Mock city rules initialized: " + styles.length + " styles");
}

/**
 * Initialize mock technologies
 * Creates basic tech tree for testing
 */
function init_mock_techs() {
  techs = {};
  
  // Create some basic technologies that are commonly used
  // These match the structure from handle_ruleset_tech in packhand.js
  var basic_techs = [
    { id: 0, name: "None", req: [0, 0] },
    { id: 1, name: "Alphabet", req: [0, 0] },
    { id: 2, name: "Bronze Working", req: [0, 0] },
    { id: 3, name: "Pottery", req: [0, 0] },
    { id: 4, name: "Writing", req: [1, 0] },
    { id: 5, name: "Iron Working", req: [2, 0] },
    { id: 6, name: "Warrior Code", req: [0, 0] },
    { id: 7, name: "Horseback Riding", req: [0, 0] },
    { id: 8, name: "Masonry", req: [0, 0] },
    { id: 9, name: "Currency", req: [2, 0] }
  ];
  
  basic_techs.forEach(function(tech) {
    techs[tech.id] = {
      id: tech.id,
      name: tech.name,
      req: tech.req,
      root_req: 0,
      flags: [],
      cost: 10,
      helptext: "Mock technology for testing"
    };
  });
  
  console.log("Mock techs initialized:", Object.keys(techs).length, "technologies");
}

/**
 * Initialize all mock data
 */
function init_all_mock_data() {
  console.log("=== Initializing Mock Data for Standalone Mode ===");
  
  init_mock_map();
  init_mock_terrains();
  init_mock_city_rules();
  init_mock_players();
  init_mock_nations();
  init_mock_cities();
  init_mock_units();
  init_mock_techs();
  init_mock_game();
  
  console.log("=== Mock Data Initialization Complete ===");
}


function tech_dialog_active() {
  return false;
}

function update_tech_dialog_cursor() {
  return;
}


function is_small_screen() {
  return false;
}
