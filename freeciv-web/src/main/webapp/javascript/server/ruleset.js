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
 * Ruleset management for the JavaScript server
 * 
 * This module handles creating and managing game rulesets including:
 * - Government types
 * - Technologies
 * - Unit types
 * - Building/improvement types
 * - City styles
 * - Terrain extras (roads, mines, etc.)
 * 
 * Note: Nations are managed in server/nations.js
 */

/**************************************************************************
 * Create complete ruleset data
 **************************************************************************/
function server_create_ruleset() {
  console.log("[Server Ruleset] Creating ruleset data");

  // First, initialize ruleset_control with metadata about the ruleset
  server_create_ruleset_control();
  
  server_create_extras();
  server_create_nations();
  server_create_governments();
  server_create_technologies();
  server_create_unit_types();
  server_create_improvements();
  server_create_city_styles();
  
  console.log("[Server Ruleset] Ruleset created successfully");
}

/**************************************************************************
 * Initialize ruleset control data
 * 
 * This provides metadata about the ruleset including counts of various
 * game elements. This must be called first before creating other ruleset elements.
 **************************************************************************/
function server_create_ruleset_control() {
  // Call handle_ruleset_control to initialize the ruleset_control object
  // This contains counts and metadata about the ruleset
  handle_ruleset_control({
    num_unit_types: 4,      // We're creating 4 unit types
    num_impr_types: 3,      // We're creating 3 improvement types
    num_tech_types: 4,      // We're creating 4 tech types
    num_base_types: 0,      // No bases for now
    num_road_types: 2,      // Roads and railroads
    num_styles: 3,          // 3 city styles
    government_count: 3,    // 3 government types
    nation_count: 10,       // 10 nations
    styles_count: 3,        // 3 styles
    terrain_count: 10,      // Terrain types
    resource_count: 0       // No special resources for now
  });
  
  console.log("[Server Ruleset] Ruleset control initialized");
}

// Nations are now created in server/nations.js
// This function is called from there

/**************************************************************************
 * Create government types
 **************************************************************************/
function server_create_governments() {
  governments = {};
  
  // Use handle_ruleset_government to create governments
  handle_ruleset_government({ id: 0, name: "Despotism" });
  handle_ruleset_government({ id: 1, name: "Monarchy" });
  handle_ruleset_government({ id: 2, name: "Republic" });
  
  console.log("[Server Ruleset] Created " + Object.keys(governments).length + " governments");
}



/**************************************************************************
 * Create unit type definitions
 **************************************************************************/
function server_create_unit_types() {
  unit_types = {};
  
  // Use handle_ruleset_unit to create unit types
  handle_ruleset_unit({ 
    id: 0, 
    name: "Settlers",
    graphic_str: "u.settlers",
    move_rate: 1,
    move_bonus: [0],
    hp: 10
  });
  
  handle_ruleset_unit({ 
    id: 1, 
    name: "Warriors",
    graphic_str: "u.warriors",
    move_rate: 1,
    move_bonus: [0],
    hp: 10
  });
  
  handle_ruleset_unit({ 
    id: 2, 
    name: "Phalanx",
    graphic_str: "u.phalanx",
    move_rate: 1,
    move_bonus: [0],
    hp: 10
  });
  
  handle_ruleset_unit({ 
    id: 3, 
    name: "Explorer",
    graphic_str: "u.explorer",
    move_rate: 2,
    move_bonus: [0],
    hp: 10
  });
  
  console.log("[Server Ruleset] Created " + Object.keys(unit_types).length + " unit types");
}

/**************************************************************************
 * Create building/improvement definitions
 **************************************************************************/
function server_create_improvements() {
  
  // Use handle_ruleset_building to create improvements
  handle_ruleset_building({ id: 0, name: "Palace" });
  handle_ruleset_building({ id: 1, name: "Barracks" });
  handle_ruleset_building({ id: 2, name: "Granary" });
  
  console.log("[Server Ruleset] Created " + Object.keys(improvements).length + " improvements");
}

/**************************************************************************
 * Create city style definitions
 **************************************************************************/
function server_create_city_styles() {
  city_rules = {};
  
  // Use handle_ruleset_city to create city styles
  handle_ruleset_city({
    style_id: 0,
    rule_name: "European",
    name: "European"
  });
  
  handle_ruleset_city({
    style_id: 1,
    rule_name: "Classical",
    name: "Classical"
  });
  
  handle_ruleset_city({
    style_id: 2,
    rule_name: "Modern",
    name: "Modern"
  });
  
  console.log("[Server Ruleset] Created " + Object.keys(city_rules).length + " city styles");
}

/**************************************************************************
 * Create terrain extras (roads, mines, etc.)
 **************************************************************************/
function server_create_extras() {
  extras = {};
  
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

  extras[extraId] = { id: extraId, name: "Farmland", rule_name: "Farmland" };
  window.EXTRA_FARMLAND = extraId++;
  
  console.log("[Server Ruleset] Created " + Object.keys(extras).length + " extras");
}