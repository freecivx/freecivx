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

// Map generation parameters
var NOISE_OCTAVES = 30;           // More octaves for finer detail
var NOISE_PERSISTENCE = 0.5;     // How much each octave contributes
var NOISE_LACUNARITY = 6.0;      // Frequency multiplier between octaves

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
function perlinNoise(x, y, seed, octaves, persistence, lacunarity) {
  var total = 0;
  var frequency = 1;
  var amplitude = 1;
  var maxValue = 0;
  
  for (var i = 0; i < octaves; i++) {
    total += smoothNoise2D(x * frequency * 0.05, y * frequency * 0.05, seed + i) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  
  return total / maxValue;
}

/**************************************************************************
 * Determine terrain type based on height, moisture, and temperature
 * @param {number} height - Height value (0-1)
 * @param {number} moisture - Moisture value (0-1)
 * @param {number} temperature - Temperature value (0-1, where 0=cold, 1=hot)
 * @returns {number} Terrain type ID
 **************************************************************************/
function getTerrainType(height, moisture, temperature) {
  // Deep water
  if (height < 0.42) {
    return TERRAIN_OCEAN;
  }
  
  // Shallow water / coastal
  if (height < 0.48) {
    return TERRAIN_OCEAN;
  }
  
  // Coastal lowlands
  if (height < 0.52) {
    // Swamps near coast
    if (moisture > 0.7) {
      return TERRAIN_SWAMP;
    }
    // Desert in hot, dry areas
    if (temperature > 0.65 && moisture < 0.35) {
      return TERRAIN_DESERT;
    }
    // Cold areas get tundra
    if (temperature < 0.3) {
      return TERRAIN_TUNDRA;
    }
    // Otherwise grassland or plains
    return (moisture > 0.5) ? TERRAIN_GRASSLAND : TERRAIN_PLAINS;
  }
  
  // Low elevations - main biomes
  if (height < 0.65) {
    // Arctic/tundra
    if (temperature < 0.25) {
      return TERRAIN_TUNDRA;
    }
    // Desert belt (hot and dry)
    if (temperature > 0.7 && moisture < 0.4) {
      return TERRAIN_DESERT;
    }
    // Forests in wet areas
    if (moisture > 0.65) {
      return TERRAIN_FOREST;
    }
    // Grassland in moderate moisture
    if (moisture > 0.4) {
      return TERRAIN_GRASSLAND;
    }
    // Plains in drier areas
    return TERRAIN_PLAINS;
  }
  
  // Mid elevations - hills and forests
  if (height < 0.78) {
    // Cold mountains
    if (temperature < 0.3) {
      return TERRAIN_MOUNTAINS;
    }
    // Forest on wet slopes
    if (moisture > 0.55) {
      return TERRAIN_FOREST;
    }
    // Hills
    return TERRAIN_HILLS;
  }
  
  // High elevations - mountains and hills
  if (height < 0.90) {
    // Alpine tundra in cold areas
    if (temperature < 0.4) {
      return TERRAIN_TUNDRA;
    }
    return TERRAIN_HILLS;
  }
  
  // Highest peaks - always mountains
  return TERRAIN_MOUNTAINS;
}

/**************************************************************************
 * Generate height map for terrain elevation
 * Uses improved multi-octave Perlin noise for natural-looking landmasses
 * @param {number} width - Map width
 * @param {number} height - Map height
 * @param {number} seed - Random seed
 * @returns {Array} 2D array of height values
 **************************************************************************/
function generateHeightMap(width, height, seed) {
  var heightMap = [];
  
  // Generate base noise with island shaping
  for (var y = 0; y < height; y++) {
    heightMap[y] = [];
    for (var x = 0; x < width; x++) {
      // Use more octaves for richer detail
      var noise = perlinNoise(x, y, seed, NOISE_OCTAVES, NOISE_PERSISTENCE, NOISE_LACUNARITY);
      
      // Normalize to 0-1 range
      noise = (noise + 1) / 2;
      
      // Add gentle island tendency - reduce height near edges to create ocean
      var distX = Math.abs(x - width / 2) / (width / 2);
      var distY = Math.abs(y - height / 2) / (height / 2);
      var distFromCenter = Math.sqrt(distX * distX + distY * distY);
      var edgeFactor = Math.min(1.0, distFromCenter);
      
      // Apply island shaping - stronger reduction creates more ocean
      // Using squared distance for smoother transition
      noise = noise * (1 - (edgeFactor * edgeFactor) * 0.7);
      
      heightMap[y][x] = Math.max(0, Math.min(1, noise));
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
      // Use different seed and parameters for moisture
      var noise = perlinNoise(x, y, seed + 1000, 5, 0.55, 2.2);
      
      // Normalize to 0-1 range
      noise = (noise + 1) / 2;
      
      moistureMap[y][x] = noise;
    }
  }
  
  return moistureMap;
}

/**************************************************************************
 * Generate temperature map based on latitude
 * Temperature decreases from equator (center) to poles (edges)
 * @param {number} width - Map width
 * @param {number} height - Map height
 * @param {number} seed - Random seed
 * @returns {Array} 2D array of temperature values (0=cold, 1=hot)
 **************************************************************************/
function generateTemperatureMap(width, height, seed) {
  var temperatureMap = [];
  
  for (var y = 0; y < height; y++) {
    temperatureMap[y] = [];
    for (var x = 0; x < width; x++) {
      // Base temperature on distance from equator (vertical center)
      var distFromEquator = Math.abs(y - height / 2) / (height / 2);
      
      // Temperature decreases with latitude
      var baseTemp = 1.0 - distFromEquator * 0.8;
      
      // Add some noise for variation
      var noise = perlinNoise(x, y, seed + 2000, 3, 0.4, 2.5);
      noise = (noise + 1) / 2;
      
      // Combine base temperature with noise
      var temp = baseTemp * 0.7 + noise * 0.3;
      
      // Clamp to valid range
      temperatureMap[y][x] = Math.max(0, Math.min(1, temp));
    }
  }
  
  return temperatureMap;
}

/**************************************************************************
 * Smooth terrain to reduce isolated single tiles
 * Makes maps look more natural by ensuring terrain types cluster together
 * @param {Array} terrainMap - 2D array of terrain types
 * @param {number} width - Map width
 * @param {number} height - Map height
 * @returns {Array} Smoothed terrain map
 **************************************************************************/
function smoothTerrain(terrainMap, width, height) {
  var smoothedMap = [];
  
  // Initialize smoothed map
  for (var y = 0; y < height; y++) {
    smoothedMap[y] = [];
    for (var x = 0; x < width; x++) {
      smoothedMap[y][x] = terrainMap[y][x];
    }
  }
  
  // Smooth pass - replace isolated tiles
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      var currentTerrain = terrainMap[y][x];
      
      // Count neighbors of same type
      var neighbors = [];
      var terrainCounts = {};
      
      // Check all 8 neighbors
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          
          var nx = x + dx;
          var ny = y + dy;
          
          // Wrap x coordinate (maps wrap horizontally in Freeciv)
          if (nx < 0) nx = width - 1;
          if (nx >= width) nx = 0;
          
          // Don't wrap y coordinate
          if (ny >= 0 && ny < height) {
            var neighborTerrain = terrainMap[ny][nx];
            neighbors.push(neighborTerrain);
            terrainCounts[neighborTerrain] = (terrainCounts[neighborTerrain] || 0) + 1;
          }
        }
      }
      
      // If this tile is isolated (no same-type neighbors), replace with most common neighbor
      var sameTypeCount = terrainCounts[currentTerrain] || 0;
      if (sameTypeCount <= 1 && neighbors.length >= 5) {
        // Find most common neighbor terrain
        var maxCount = 0;
        var mostCommonTerrain = currentTerrain;
        for (var terrain in terrainCounts) {
          if (terrainCounts[terrain] > maxCount) {
            maxCount = terrainCounts[terrain];
            mostCommonTerrain = parseInt(terrain);
          }
        }
        
        // Only smooth land tiles to preserve ocean/coastline shapes
        if (currentTerrain !== TERRAIN_OCEAN && mostCommonTerrain !== TERRAIN_OCEAN) {
          smoothedMap[y][x] = mostCommonTerrain;
        }
      }
    }
  }
  
  return smoothedMap;
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
  
  // Generate height, moisture, and temperature maps
  console.log("[Generator] Generating height map...");
  var heightMap = generateHeightMap(width, height, seed);
  
  console.log("[Generator] Generating moisture map...");
  var moistureMap = generateMoistureMap(width, height, seed);
  
  console.log("[Generator] Generating temperature map...");
  var temperatureMap = generateTemperatureMap(width, height, seed);
  
  // Generate initial terrain
  console.log("[Generator] Assigning terrain types...");
  var terrainMap = [];
  for (var y = 0; y < height; y++) {
    terrainMap[y] = [];
    for (var x = 0; x < width; x++) {
      var h = heightMap[y][x];
      var m = moistureMap[y][x];
      var t = temperatureMap[y][x];
      
      terrainMap[y][x] = getTerrainType(h, m, t);
    }
  }
  
  // Smooth terrain to reduce isolated tiles
  console.log("[Generator] Smoothing terrain...");
  terrainMap = smoothTerrain(terrainMap, width, height);
  
  // Generate tiles
  console.log("[Generator] Creating tiles...");
  var landTiles = 0;
  var waterTiles = 0;
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      var index = x + y * width;
      var terrain = terrainMap[y][x];
      var tileHeight = heightMap[y][x];
      
      if (terrain === TERRAIN_OCEAN) {
        waterTiles++;
      } else {
        landTiles++;
      }
      
      var tileData = generateTile(x, y, index, terrain, tileHeight);
      handle_tile_info(tileData);
    }
  }
  
  var totalTiles = landTiles + waterTiles;
  var actualLandPercent = (landTiles / totalTiles * 100).toFixed(1);
  console.log("[Generator] Created map with " + Object.keys(tiles).length + " tiles");
  console.log("[Generator] Land: " + landTiles + " (" + actualLandPercent + "%), Water: " + waterTiles);
  
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