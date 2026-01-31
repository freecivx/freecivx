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
 * Map generator for the JavaScript server
 * 
 * This module provides elegant and flexible map generation algorithms
 * for creating varied and interesting terrain in Freeciv games.
 * 
 * Features:
 * - Noise-based terrain generation for natural-looking landscapes
 * - Configurable land/water ratio
 * - Multiple terrain types with realistic distributions
 * - Height-based terrain assignment
 */

// Default map configuration
var DEFAULT_MAP_WIDTH = 40;
var DEFAULT_MAP_HEIGHT = 30;

// Terrain type constants
var TERRAIN_OCEAN = 1;
var TERRAIN_GRASSLAND = 0;
var TERRAIN_PLAINS = 2;
var TERRAIN_FOREST = 3;
var TERRAIN_HILLS = 4;
var TERRAIN_MOUNTAINS = 5;
var TERRAIN_DESERT = 6;
var TERRAIN_TUNDRA = 7;
var TERRAIN_SWAMP = 8;

/**************************************************************************
 * Simple noise generator for terrain variation
 * Uses a pseudo-random hash function for deterministic noise
 **************************************************************************/
function noise2D(x, y, seed) {
  var n = x + y * 57 + seed * 131;
  n = (n << 13) ^ n;
  return (1.0 - ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824.0);
}

/**************************************************************************
 * Smoothed noise using bilinear interpolation
 **************************************************************************/
function smoothNoise2D(x, y, seed) {
  var intX = Math.floor(x);
  var intY = Math.floor(y);
  var fracX = x - intX;
  var fracY = y - intY;
  
  // Get the four corners
  var v1 = noise2D(intX, intY, seed);
  var v2 = noise2D(intX + 1, intY, seed);
  var v3 = noise2D(intX, intY + 1, seed);
  var v4 = noise2D(intX + 1, intY + 1, seed);
  
  // Interpolate
  var i1 = v1 * (1 - fracX) + v2 * fracX;
  var i2 = v3 * (1 - fracX) + v4 * fracX;
  
  return i1 * (1 - fracY) + i2 * fracY;
}

/**************************************************************************
 * Multi-octave noise (Perlin-like) for natural terrain variation
 **************************************************************************/
function perlinNoise(x, y, seed, octaves, persistence) {
  var total = 0;
  var frequency = 1;
  var amplitude = 1;
  var maxValue = 0;
  
  for (var i = 0; i < octaves; i++) {
    total += smoothNoise2D(x * frequency * 0.1, y * frequency * 0.1, seed + i) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }
  
  return total / maxValue;
}

/**************************************************************************
 * Determine terrain type based on height and moisture
 * @param {number} height - Height value (0-1)
 * @param {number} moisture - Moisture value (0-1)
 * @returns {number} Terrain type ID
 **************************************************************************/
function getTerrainType(height, moisture) {
  // Water levels
  if (height < 0.35) {
    return TERRAIN_OCEAN;
  }
  
  // Coastal lowlands
  if (height < 0.45) {
    if (moisture < 0.3) {
      return TERRAIN_DESERT;
    } else if (moisture < 0.6) {
      return TERRAIN_PLAINS;
    } else {
      return TERRAIN_SWAMP;
    }
  }
  
  // Mid elevations
  if (height < 0.60) {
    if (moisture < 0.3) {
      return TERRAIN_PLAINS;
    } else if (moisture < 0.7) {
      return TERRAIN_GRASSLAND;
    } else {
      return TERRAIN_FOREST;
    }
  }
  
  // High elevations
  if (height < 0.75) {
    if (moisture < 0.4) {
      return TERRAIN_HILLS;
    } else {
      return TERRAIN_FOREST;
    }
  }
  
  // Mountain peaks
  if (height < 0.90) {
    return TERRAIN_HILLS;
  }
  
  // Highest peaks
  return TERRAIN_MOUNTAINS;
}

/**************************************************************************
 * Generate height map for terrain elevation
 * @param {number} width - Map width
 * @param {number} height - Map height
 * @param {number} seed - Random seed
 * @returns {Array} 2D array of height values
 **************************************************************************/
function generateHeightMap(width, height, seed) {
  var heightMap = [];
  
  for (var y = 0; y < height; y++) {
    heightMap[y] = [];
    for (var x = 0; x < width; x++) {
      // Use Perlin noise with multiple octaves for natural variation
      var noise = perlinNoise(x, y, seed, 4, 0.5);
      
      // Normalize to 0-1 range
      noise = (noise + 1) / 2;
      
      // Add some island tendency - reduce height near edges
      var distX = Math.abs(x - width / 2) / (width / 2);
      var distY = Math.abs(y - height / 2) / (height / 2);
      var edgeFactor = Math.max(distX, distY);
      
      // Apply gentle edge reduction
      noise = noise * (1 - edgeFactor * 0.3);
      
      heightMap[y][x] = noise;
    }
  }
  
  return heightMap;
}

/**************************************************************************
 * Generate moisture map for climate variation
 * @param {number} width - Map width
 * @param {number} height - Map height
 * @param {number} seed - Random seed
 * @returns {Array} 2D array of moisture values
 **************************************************************************/
function generateMoistureMap(width, height, seed) {
  var moistureMap = [];
  
  for (var y = 0; y < height; y++) {
    moistureMap[y] = [];
    for (var x = 0; x < width; x++) {
      // Use different seed for moisture to get variation
      var noise = perlinNoise(x, y, seed + 1000, 3, 0.6);
      
      // Normalize to 0-1 range
      noise = (noise + 1) / 2;
      
      moistureMap[y][x] = noise;
    }
  }
  
  return moistureMap;
}

/**************************************************************************
 * Generate a single tile with terrain and properties
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} index - Tile index
 * @param {number} terrain - Terrain type
 * @param {number} height - Tile height
 * @returns {Object} Tile packet for handle_tile_info
 **************************************************************************/
function generateTile(x, y, index, terrain, height) {
  return {
    tile: index,
    x: x,
    y: y,
    terrain: terrain,
    known: 2, // TILE_KNOWN_SEEN
    extras: ['0'],
    owner: null,
    claimer: null,
    worked: null,
    height: height,
    spec_sprite: null,
    goto_dir: null,
    nuke: 0
  };
}

/**************************************************************************
 * Main map generation function
 * @param {number} width - Map width in tiles
 * @param {number} height - Map height in tiles
 * @param {Object} options - Generation options
 * @returns {Object} Generated map
 **************************************************************************/
function generator_create_map(width, height, options) {
  width = width || DEFAULT_MAP_WIDTH;
  height = height || DEFAULT_MAP_HEIGHT;
  options = options || {};
  
  var seed = options.seed || Math.floor(Math.random() * 1000000);
  
  console.log("[Generator] Creating map: " + width + "x" + height + " tiles (seed: " + seed + ")");
  
  // Initialize terrain types
  generator_initialize_terrain_types();
  
  // Create map structure
  handle_map_info({
    xsize: width,
    ysize: height,
    topology_id: 0,
    wrap_id: WRAP_X,
    num_valid_dirs: 8,
    num_cardinal_dirs: 4
  });
  
  // Generate height and moisture maps
  var heightMap = generateHeightMap(width, height, seed);
  var moistureMap = generateMoistureMap(width, height, seed);
  
  // Generate tiles
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      var index = x + y * width;
      var h = heightMap[y][x];
      var m = moistureMap[y][x];
      
      var terrain = getTerrainType(h, m);
      var tileHeight = h;
      
      var tileData = generateTile(x, y, index, terrain, tileHeight);
      handle_tile_info(tileData);
    }
  }
  
  console.log("[Generator] Created map with " + Object.keys(tiles).length + " tiles");
  return map;
}

/**************************************************************************
 * Initialize terrain types
 **************************************************************************/
function generator_initialize_terrain_types() {
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
  
  console.log("[Generator] Initialized " + Object.keys(terrains).length + " terrain types");
}