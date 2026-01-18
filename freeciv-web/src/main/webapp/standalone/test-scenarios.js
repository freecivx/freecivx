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
 * Test scenarios for standalone 3D testing
 * Defines various test cases for rendering validation
 */

var test_scenarios = {
  
  /**
   * Scenario 1: Small varied terrain map
   */
  small_varied_terrain: {
    name: "Small Varied Terrain",
    description: "40x30 map with varied terrain types including ocean, grassland, desert, hills, and mountains",
    setup: function() {
      console.log("Setting up scenario: Small Varied Terrain");
      init_all_mock_data();
    }
  },
  
  /**
   * Scenario 2: Flat grassland
   */
  flat_grassland: {
    name: "Flat Grassland",
    description: "Simple flat grassland map for basic rendering test",
    setup: function() {
      console.log("Setting up scenario: Flat Grassland");
      
      map = {
        xsize: 30,
        ysize: 20,
        topology_id: 0,
        wrap_id: 0
      };
      
      tiles = {};
      for (var x = 0; x < map.xsize; x++) {
        for (var y = 0; y < map.ysize; y++) {
          var index = y * map.xsize + x;
          tiles[index] = {
            index: index,
            x: x,
            y: y,
            terrain: 0, // Grassland
            height: 0,
            known: 2,
            owner: null,
            worked: null,
            extras: {
              isSet: function() { return false; },
              toBitSet: function() { return []; }
            }
          };
        }
      }
      
      init_mock_terrains();
      init_mock_players();
      init_mock_nations();
      cities = {};
      units = {};
      unit_types = {};
      init_mock_game();
    }
  },
  
  /**
   * Scenario 3: Cities test
   */
  cities_test: {
    name: "Cities Test",
    description: "Map with multiple cities of various sizes",
    setup: function() {
      console.log("Setting up scenario: Cities Test");
      init_all_mock_data();
      
      // Add more cities
      var additional_cities = [
        {x: 5, y: 5, size: 8},
        {x: 30, y: 5, size: 12},
        {x: 5, y: 25, size: 6},
        {x: 30, y: 25, size: 10}
      ];
      
      var city_id = Object.keys(cities).length;
      for (var i = 0; i < additional_cities.length; i++) {
        var pos = additional_cities[i];
        var tile_index = pos.y * map.xsize + pos.x;
        
        cities[city_id] = {
          id: city_id,
          name: "City" + (city_id + 1),
          owner: 1,
          tile: tile_index,
          size: pos.size,
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
        
        if (tiles[tile_index]) {
          tiles[tile_index].owner = 1;
          tiles[tile_index].worked = city_id;
        }
        
        city_id++;
      }
      
      console.log("Cities test: " + Object.keys(cities).length + " cities");
    }
  },
  
  /**
   * Scenario 4: Units test
   */
  units_test: {
    name: "Units Test",
    description: "Map with various units placed strategically",
    setup: function() {
      console.log("Setting up scenario: Units Test");
      init_all_mock_data();
      
      // Add more units in a grid pattern
      var unit_id = Object.keys(units).length;
      for (var x = 8; x < map.xsize - 8; x += 4) {
        for (var y = 8; y < map.ysize - 8; y += 4) {
          var tile_index = y * map.xsize + x;
          var unit_type = unit_id % 2; // Alternate between Settlers and Warriors
          
          units[unit_id] = {
            id: unit_id,
            tile: tile_index,
            owner: 1,
            type: unit_type,
            veteran: 0,
            hp: unit_types[unit_type].hp,
            homecity: 0,
            moves_left: unit_types[unit_type].move_rate,
            fuel: unit_types[unit_type].fuel,
            activity: 0,
            goto_tile: null,
            paradropped: false,
            transported: false,
            done_moving: false,
            occupy: 0,
            battlegroup: -1,
            has_orders: false
          };
          
          unit_id++;
        }
      }
      
      console.log("Units test: " + Object.keys(units).length + " units");
    }
  },
  
  /**
   * Scenario 5: Mountain range
   */
  mountain_range: {
    name: "Mountain Range",
    description: "Dramatic terrain with a central mountain range",
    setup: function() {
      console.log("Setting up scenario: Mountain Range");
      
      map = {
        xsize: 50,
        ysize: 35,
        topology_id: 0,
        wrap_id: 0
      };
      
      tiles = {};
      for (var x = 0; x < map.xsize; x++) {
        for (var y = 0; y < map.ysize; y++) {
          var index = y * map.xsize + x;
          
          // Create a mountain range down the middle
          var dist_from_center = Math.abs(x - map.xsize / 2);
          var terrain, height;
          
          if (dist_from_center < 3) {
            terrain = 5; // Mountains
            height = 0.5 + Math.random() * 0.3;
          } else if (dist_from_center < 6) {
            terrain = 4; // Hills
            height = 0.2 + Math.random() * 0.15;
          } else if (dist_from_center < 10) {
            terrain = 0; // Grassland
            height = Math.random() * 0.05;
          } else {
            terrain = 3; // Plains
            height = Math.random() * 0.05;
          }
          
          tiles[index] = {
            index: index,
            x: x,
            y: y,
            terrain: terrain,
            height: height,
            known: 2,
            owner: null,
            worked: null,
            extras: {
              isSet: function() { return false; },
              toBitSet: function() { return []; }
            }
          };
        }
      }
      
      init_mock_terrains();
      init_mock_players();
      init_mock_nations();
      cities = {};
      units = {};
      unit_types = {};
      init_mock_game();
    }
  }
};

/**
 * Load a test scenario
 */
function load_test_scenario(scenario_name) {
  console.log(`=== Loading Test Scenario: ${scenario_name} ===`);
  
  const scenario = test_scenarios[scenario_name];
  if (!scenario) {
    console.error(`Scenario not found: ${scenario_name}`);
    return false;
  }
  
  console.log(`Description: ${scenario.description}`);
  
  try {
    scenario.setup();
    console.log("Scenario setup complete");
    return true;
  } catch (e) {
    console.error("Error setting up scenario:", e);
    return false;
  }
}

/**
 * Get list of available scenarios
 */
function get_available_scenarios() {
  return Object.entries(test_scenarios).map(([id, scenario]) => ({
    id,
    name: scenario.name,
    description: scenario.description
  }));
}

console.log("Test scenarios module loaded");
console.log("Available scenarios:", Object.keys(test_scenarios));
