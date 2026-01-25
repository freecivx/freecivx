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
 * Map generation and management for the JavaScript server
 * 
 * This module handles creating and managing the game map including:
 * - Map initialization with configurable dimensions
 * - Terrain generation
 * - Tile property management
 */

// Default map configuration
var DEFAULT_MAP_WIDTH = 40;
var DEFAULT_MAP_HEIGHT = 30;

/**************************************************************************
 * Create a game map with terrain
 * @param {number} width - Map width in tiles (default: 40)
 * @param {number} height - Map height in tiles (default: 30)
 **************************************************************************/
function server_create_map(width, height) {
  width = width || DEFAULT_MAP_WIDTH;
  height = height || DEFAULT_MAP_HEIGHT;
  
  console.log("[Server Map] Creating map: " + width + "x" + height + " tiles");
  
  // Create map structure
  map = {
    xsize: width,
    ysize: height,
    topology_id: 0,  // Standard topology
    wrap_id: WRAP_X, // Wrap in X direction
    num_valid_dirs: 8,
    num_cardinal_dirs: 4
  };
  
  // Initialize tiles array
  tiles = {};
  
  // Generate terrain types
  server_initialize_terrain_types();
  
  // Generate tiles with terrain
  for (var y = 0; y < map.ysize; y++) {
    for (var x = 0; x < map.xsize; x++) {
      var index = x + y * map.xsize;
      tiles[index] = server_create_tile(x, y, index);
    }
  }
  
  set_mapview_model_size();
  
  console.log("[Server Map] Created map with " + Object.keys(tiles).length + " tiles");
  return map;
}

/**************************************************************************
 * Initialize terrain types
 **************************************************************************/
function server_initialize_terrain_types() {
  // Create terrain types with correct graphic_str values for terrain rendering
  // Note: Ocean must use "floor" or "coast" for is_ocean_tile() to work correctly
  terrains = {
    0: { id: 0, name: "Grassland", graphic: "grassland", graphic_str: "grassland" },
    1: { id: 1, name: "Ocean", graphic: "floor", graphic_str: "floor" },
    2: { id: 2, name: "Plains", graphic: "plains", graphic_str: "plains" },
    3: { id: 3, name: "Forest", graphic: "forest", graphic_str: "forest" },
    4: { id: 4, name: "Hills", graphic: "hills", graphic_str: "hills" },
    5: { id: 5, name: "Mountains", graphic: "mountains", graphic_str: "mountains" },
    6: { id: 6, name: "Desert", graphic: "desert", graphic_str: "desert" },
    7: { id: 7, name: "Tundra", graphic: "tundra", graphic_str: "tundra" },
    8: { id: 8, name: "Swamp", graphic: "swamp", graphic_str: "swamp" }
  };
  
  console.log("[Server Map] Initialized " + Object.keys(terrains).length + " terrain types");
}

/**************************************************************************
 * Create a single tile
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} index - Tile index
 * @returns {Object} Tile object
 **************************************************************************/
function server_create_tile(x, y, index) {
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
      height = 0.5 + Math.random() * 0.1;
    } else if (rand < 0.50) {
      terrain = 2; // Plains
      height = 0.55 + Math.random() * 0.1;
    } else if (rand < 0.65) {
      terrain = 3; // Forest
      height = 0.6 + Math.random() * 0.15;
    } else if (rand < 0.80) {
      terrain = 4; // Hills
      height = 0.56 + Math.random() * 0.2;
    } else if (rand < 0.88) {
      terrain = 5; // Mountains
      height = 0.61 + Math.random() * 0.3;
    } else if (rand < 0.93) {
      terrain = 6; // Desert
      height = 0.5 + Math.random() * 0.15;
    } else if (rand < 0.97) {
      terrain = 7; // Tundra
      height = 0.55 + Math.random() * 0.1;
    } else {
      terrain = 8; // Swamp
      height = 0.45 + Math.random() * 0.05;
    }
  }
  
  return {
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
    height: height,
    spec_sprite: null,
    goto_dir: null,
    nuke: 0
  };
}