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

/**************************************************************************
 * Create cities for players
 **************************************************************************/
function server_create_cities() {
  console.log("[Server Cities] Creating cities");
  
  cities = {};
  
  // Create capital city for player 0
  var capital_tile_index = 5 + 5 * map.xsize; // Near corner
  
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
    can_build_improvement: [],  // Will be converted to BitVector
    can_build_unit: [],  // Will be converted to BitVector
    ppl_happy: [1,1,1,1,1],
    ppl_content: [1,1,1,1,1],
    ppl_unhappy: [0,0,0,0,0]
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
      can_build_improvement: [],
      can_build_unit: [],
      ppl_happy: [1,1,1,1,1],
      ppl_content: [1,1,1,1,1],
      ppl_unhappy: [0,0,0,0,0]
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
      can_build_improvement: [],
      can_build_unit: [],
      ppl_happy: [1,1,1,1,1],
      ppl_content: [1,1,1,1,1],
      ppl_unhappy: [0,0,0,0,0]
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
}