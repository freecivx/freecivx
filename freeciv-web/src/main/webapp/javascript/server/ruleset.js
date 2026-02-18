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
  server_create_resources();
  server_create_nations();
  server_create_governments();
  server_create_technologies();
  server_create_unit_classes();
  server_create_unit_types();
  server_create_improvements();
  server_create_specialists();
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
    num_unit_types: 15,     // Enhanced unit types
    num_impr_types: 15,     // Enhanced improvement types
    num_tech_types: 31,     // Enhanced tech tree (31 technologies)
    num_base_types: 0,      // No bases for now
    num_road_types: 2,      // Roads and railroads
    num_styles: 3,          // 3 city styles
    government_count: 5,    // Enhanced government types
    nation_count: 10,       // 10 nations
    styles_count: 3,        // 3 styles
    terrain_count: 10,      // Terrain types
    resource_count: 10      // 10 terrain resources
  });
  
  console.log("[Server Ruleset] Ruleset control initialized");
}

// Nations are now created in server/nations.js
// This function is called from there

/**************************************************************************
 * Create government types
 * 
 * Creates government types that players can adopt throughout the game.
 * Each government has different characteristics affecting production,
 * corruption, and available actions.
 **************************************************************************/
function server_create_governments() {
  governments = {};
  
  // Use handle_ruleset_government to create governments
  handle_ruleset_government({ id: 0, name: "Anarchy" });
  handle_ruleset_government({ id: 1, name: "Despotism" });
  handle_ruleset_government({ id: 2, name: "Monarchy" });
  handle_ruleset_government({ id: 3, name: "Republic" });
  handle_ruleset_government({ id: 4, name: "Democracy" });
  
  console.log("[Server Ruleset] Created " + Object.keys(governments).length + " governments");
}



/**************************************************************************
 * Create unit class definitions
 * 
 * Unit classes define movement and combat characteristics shared by
 * multiple unit types (e.g., Land, Sea, Air units).
 **************************************************************************/
function server_create_unit_classes() {
  unit_classes = {};
  
  // Land unit class
  handle_ruleset_unit_class({ 
    id: 0, 
    name: "Land",
    move_type: 0,
    flags: 0
  });
  
  // Sea unit class
  handle_ruleset_unit_class({ 
    id: 1, 
    name: "Sea",
    move_type: 1,
    flags: 0
  });
  
  // Air unit class
  handle_ruleset_unit_class({ 
    id: 2, 
    name: "Air",
    move_type: 2,
    flags: 0
  });
  
  console.log("[Server Ruleset] Created " + Object.keys(unit_classes).length + " unit classes");
}

/**************************************************************************
 * Create unit type definitions
 * 
 * Creates a comprehensive set of unit types spanning different eras
 * and roles (settlers, workers, military, naval, air).
 **************************************************************************/
function server_create_unit_types() {
  unit_types = {};
  
  // Civilian Units
  handle_ruleset_unit({ 
    id: 0, 
    name: "Settlers",
    graphic_str: "u.settlers",
    move_rate: 1,
    move_bonus: [0],
    hp: 20,
    attack_strength: 0,
    defense_strength: 1,
    firepower: 1
  });
  
  handle_ruleset_unit({ 
    id: 1, 
    name: "Workers",
    graphic_str: "u.worker",
    move_rate: 1,
    move_bonus: [0],
    hp: 10,
    attack_strength: 0,
    defense_strength: 1,
    firepower: 1
  });
  
  handle_ruleset_unit({ 
    id: 2, 
    name: "Explorer",
    graphic_str: "u.explorer",
    move_rate: 2,
    move_bonus: [0],
    hp: 10,
    attack_strength: 1,
    defense_strength: 1,
    firepower: 1
  });
  
  // Ancient Era Military
  handle_ruleset_unit({ 
    id: 3, 
    name: "Warriors",
    graphic_str: "u.warriors",
    move_rate: 1,
    move_bonus: [0],
    hp: 10,
    attack_strength: 1,
    defense_strength: 1,
    firepower: 1
  });
  
  handle_ruleset_unit({ 
    id: 4, 
    name: "Phalanx",
    graphic_str: "u.phalanx",
    move_rate: 1,
    move_bonus: [0],
    hp: 10,
    attack_strength: 1,
    defense_strength: 2,
    firepower: 1
  });
  
  handle_ruleset_unit({ 
    id: 5, 
    name: "Archers",
    graphic_str: "u.archers",
    move_rate: 1,
    move_bonus: [0],
    hp: 10,
    attack_strength: 3,
    defense_strength: 2,
    firepower: 1
  });
  
  handle_ruleset_unit({ 
    id: 6, 
    name: "Legion",
    graphic_str: "u.legion",
    move_rate: 1,
    move_bonus: [0],
    hp: 20,
    attack_strength: 4,
    defense_strength: 2,
    firepower: 1
  });
  
  handle_ruleset_unit({ 
    id: 7, 
    name: "Horsemen",
    graphic_str: "u.horsemen",
    move_rate: 2,
    move_bonus: [0],
    hp: 10,
    attack_strength: 2,
    defense_strength: 1,
    firepower: 1
  });
  
  // Medieval Era
  handle_ruleset_unit({ 
    id: 8, 
    name: "Knights",
    graphic_str: "u.knights",
    move_rate: 2,
    move_bonus: [0],
    hp: 10,
    attack_strength: 4,
    defense_strength: 2,
    firepower: 1
  });
  
  handle_ruleset_unit({ 
    id: 9, 
    name: "Pikemen",
    graphic_str: "u.pikemen",
    move_rate: 1,
    move_bonus: [0],
    hp: 10,
    attack_strength: 1,
    defense_strength: 4,
    firepower: 1
  });
  
  handle_ruleset_unit({ 
    id: 10, 
    name: "Musketeers",
    graphic_str: "u.musketeers",
    move_rate: 1,
    move_bonus: [0],
    hp: 20,
    attack_strength: 3,
    defense_strength: 3,
    firepower: 1
  });
  
  // Naval Units
  handle_ruleset_unit({ 
    id: 11, 
    name: "Trireme",
    graphic_str: "u.trireme",
    move_rate: 3,
    move_bonus: [0],
    hp: 10,
    attack_strength: 1,
    defense_strength: 1,
    firepower: 1
  });
  
  handle_ruleset_unit({ 
    id: 12, 
    name: "Caravel",
    graphic_str: "u.caravel",
    move_rate: 3,
    move_bonus: [0],
    hp: 10,
    attack_strength: 2,
    defense_strength: 1,
    firepower: 1
  });
  
  handle_ruleset_unit({ 
    id: 13, 
    name: "Frigate",
    graphic_str: "u.frigate",
    move_rate: 4,
    move_bonus: [0],
    hp: 20,
    attack_strength: 4,
    defense_strength: 2,
    firepower: 1
  });
  
  // Modern Era
  handle_ruleset_unit({ 
    id: 14, 
    name: "Riflemen",
    graphic_str: "u.riflemen",
    move_rate: 1,
    move_bonus: [0],
    hp: 20,
    attack_strength: 5,
    defense_strength: 4,
    firepower: 1
  });
  
  console.log("[Server Ruleset] Created " + Object.keys(unit_types).length + " unit types");
}

/**************************************************************************
 * Create building/improvement definitions
 * 
 * Creates city improvements and wonders that players can build.
 * Improvements provide various bonuses to cities.
 **************************************************************************/
function server_create_improvements() {
  
  // Use handle_ruleset_building to create improvements
  
  // Infrastructure
  handle_ruleset_building({ id: 0, name: "Palace", build_cost: 100 });
  handle_ruleset_building({ id: 1, name: "Barracks", build_cost: 40 });
  handle_ruleset_building({ id: 2, name: "Granary", build_cost: 60 });
  handle_ruleset_building({ id: 3, name: "Library", build_cost: 80 });
  handle_ruleset_building({ id: 4, name: "Marketplace", build_cost: 80 });
  handle_ruleset_building({ id: 5, name: "Temple", build_cost: 40 });
  
  // Advanced buildings
  handle_ruleset_building({ id: 6, name: "Courthouse", build_cost: 80 });
  handle_ruleset_building({ id: 7, name: "City Walls", build_cost: 120 });
  handle_ruleset_building({ id: 8, name: "Aqueduct", build_cost: 80 });
  handle_ruleset_building({ id: 9, name: "Bank", build_cost: 120 });
  handle_ruleset_building({ id: 10, name: "University", build_cost: 160 });
  handle_ruleset_building({ id: 11, name: "Cathedral", build_cost: 160 });
  
  // Wonders
  handle_ruleset_building({ id: 12, name: "Great Library", build_cost: 300 });
  handle_ruleset_building({ id: 13, name: "Pyramids", build_cost: 300 });
  handle_ruleset_building({ id: 14, name: "Colossus", build_cost: 200 });
  
  console.log("[Server Ruleset] Created " + Object.keys(improvements).length + " improvements");
}

/**************************************************************************
 * Create specialist definitions
 * 
 * Specialists are citizens that can be assigned to specific roles in cities
 * to provide various bonuses (science, taxes, entertainment, etc.).
 **************************************************************************/
function server_create_specialists() {
  specialists = {};
  
  // Use handle_ruleset_specialist to create specialists
  handle_ruleset_specialist({ id: 0, name: "Elvis", plural_name: "Elvises" });
  handle_ruleset_specialist({ id: 1, name: "Scientist", plural_name: "Scientists" });
  handle_ruleset_specialist({ id: 2, name: "Taxman", plural_name: "Taxmen" });
  
  console.log("[Server Ruleset] Created " + Object.keys(specialists).length + " specialists");
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

/**************************************************************************
 * Create terrain resources
 * 
 * Resources are special bonuses that appear on terrain tiles and provide
 * additional production, food, or trade bonuses.
 **************************************************************************/
function server_create_resources() {
  resources = {};
  
  // Use handle_ruleset_resource to create resources
  handle_ruleset_resource({ 
    id: 0, 
    name: "Gold",
    graphic_str: "ts.gold",
    graphic_alt: "-"
  });
  
  handle_ruleset_resource({ 
    id: 1, 
    name: "Iron",
    graphic_str: "ts.iron",
    graphic_alt: "-"
  });
  
  handle_ruleset_resource({ 
    id: 2, 
    name: "Wheat",
    graphic_str: "ts.wheat",
    graphic_alt: "-"
  });
  
  handle_ruleset_resource({ 
    id: 3, 
    name: "Fish",
    graphic_str: "ts.fish",
    graphic_alt: "-"
  });
  
  handle_ruleset_resource({ 
    id: 4, 
    name: "Game",
    graphic_str: "ts.tundra_game",
    graphic_alt: "-"
  });
  
  handle_ruleset_resource({ 
    id: 5, 
    name: "Pheasant",
    graphic_str: "ts.pheasant",
    graphic_alt: "-"
  });
  
  handle_ruleset_resource({ 
    id: 6, 
    name: "Coal",
    graphic_str: "ts.coal",
    graphic_alt: "-"
  });
  
  handle_ruleset_resource({ 
    id: 7, 
    name: "Oasis",
    graphic_str: "ts.oasis",
    graphic_alt: "-"
  });
  
  handle_ruleset_resource({ 
    id: 8, 
    name: "Peat",
    graphic_str: "ts.peat",
    graphic_alt: "-"
  });
  
  handle_ruleset_resource({ 
    id: 9, 
    name: "Gems",
    graphic_str: "ts.gems",
    graphic_alt: "-"
  });
  
  console.log("[Server Ruleset] Created " + Object.keys(resources).length + " resources");
}
