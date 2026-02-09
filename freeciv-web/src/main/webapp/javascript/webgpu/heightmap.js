/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
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
 * Heightmap Generator for Hexagonal Terrain
 * 
 * This module generates a high-resolution heightmap for the 3D terrain mesh.
 * The heightmap is designed for hexagonal (pointy-top) tile rendering with:
 * 
 * - Flat terrain types (plains, grassland, desert, tundra, arctic) have flat 
 *   centers with height transitions occurring at tile edges
 * - Mountains and hills are naturally elevated near the tile center
 * - Rivers create valleys where terrain dips below the water mesh level
 * - Proper ocean/coast handling with smooth beach transitions
 * - Hexagonal-aware interpolation using odd-r offset coordinate system
 * 
 * Coordinate System (Odd-R Offset):
 * - Odd rows are shifted right by half a tile width
 * - Each tile has 6 neighbors in hex directions
 * - Reference: https://www.redblobgames.com/grids/hexagons/
 */

var heightmap = null;
var heightmap_hash = -1;

// Heightmap constants for terrain height values
// Water surface is at height 0.5 (50 when scaled by 100 in mesh)
const HEIGHTMAP_WATER_LEVEL = 0.5;
const HEIGHTMAP_OCEAN_DEPTH = 0.45;      // Ocean tiles below water
const HEIGHTMAP_COAST_DEPTH = 0.45;      // Coastal ocean near land
const HEIGHTMAP_BEACH_HEIGHT = 0.52;     // Beach/shoreline height
const HEIGHTMAP_LAND_BASE = 0.55;        // Standard land height
const HEIGHTMAP_RIVER_DEPTH = 0.47;      // Rivers below water level for valley effect
const HEIGHTMAP_HILLS_BOOST = 1.12;      // Hills height multiplier
const HEIGHTMAP_MOUNTAINS_BOOST = 1.20;  // Mountains height multiplier

// Terrain type classification for heightmap generation
// Note: Both 'Glacier' and 'Arctic' are included as they may appear as separate terrain types
// in different game rulesets (Glacier is civ2civ3 style, Arctic is classic Freeciv)
const FLAT_TERRAIN_TYPES = new Set(['Plains', 'Grassland', 'Desert', 'Tundra', 'Glacier', 'Arctic', 'Swamp', 'Jungle', 'Forest']);
const ELEVATED_TERRAIN_TYPES = new Set(['Hills', 'Mountains']);

// Variation constants for natural terrain appearance
// Prime numbers used for pseudo-random coordinate hashing to avoid grid artifacts
const VARIATION_PRIME_X_MT = 7;     // X coordinate multiplier for mountains
const VARIATION_PRIME_Y_MT = 13;    // Y coordinate multiplier for mountains
const VARIATION_PRIME_X_HILLS = 11; // X coordinate multiplier for hills
const VARIATION_PRIME_Y_HILLS = 17; // Y coordinate multiplier for hills
const VARIATION_MOD = 100;          // Modulo for pseudo-random range
const MOUNTAIN_VARIATION_SCALE = 0.02;  // Height variation amplitude for mountains
const HILLS_VARIATION_SCALE = 0.01;     // Height variation amplitude for hills

/****************************************************************************
  Returns height offset for units. This will make units higher above cities.
  Accounts for terrain type and proximity to water.
****************************************************************************/
function get_unit_height_offset(punit)
{
  if (punit == null) return 0;
  let ptile = index_to_tile(punit['tile']);
  if (ptile == null) return 0;
  let ptype = unit_type(punit);

  // Ship unit offsets (raised above water level)
  const shipOffsets = {
    'Caravel': 7,
    'Galleon': 5.4,
    'Frigate': 7.2,
    'Destroyer': 4.0,
    'Battleship': 4.0,
    'Transport': 4.0,
    'Cruiser': 4.0,
    'Ironclad': 4.2
  };
  
  // Air unit offsets (high above terrain)
  const airOffsets = {
    'Fighter': 18.0,
    'Bomber': 18.0,
    'Helicopter': 12.0,
    'Zeppelin': 28
  };

  if (shipOffsets[ptype['name']]) {
    return shipOffsets[ptype['name']];
  }

  if (airOffsets[ptype['name']]) {
    return airOffsets[ptype['name']];
  }

  // Ground unit positioning
  if (tile_has_extra(ptile, EXTRA_RIVER)) {
    return 1;
  }

  if (!is_ocean_tile(ptile) && is_ocean_tile_near(ptile)) {
    return -4;
  }

  const terrainName = tile_terrain(ptile)['name'];
  if (terrainName == "Hills" || terrainName == "Mountains") {
    return -5;
  }

  let pcity = tile_city(ptile);
  if (pcity != null) return 4;

  return -2;
}

/****************************************************************************
...
****************************************************************************/
function get_forest_offset(ptile)
{
    if (!is_ocean_tile(ptile) && is_ocean_tile_near(ptile)) {
      if (tile_terrain(ptile)['name'] == "Hills") {
        return  -8;
      } else if (tile_terrain(ptile)['name'] == "Mountains") {
        return -12;
      } else {
        return  -7;
      }
    }

    return -6;

}

/****************************************************************************
  Returns height offset for cities.
****************************************************************************/
function get_city_height_offset(pcity)
{
  if (pcity == null) return 0;
  let ptile = index_to_tile(pcity['tile']);
  if (ptile == null) return 0;

  if (!is_ocean_tile(ptile) && is_ocean_tile_near(ptile)) {
    if (tile_terrain(ptile)['name'] == "Hills") return -6;
    if (tile_terrain(ptile)['name'] == "Mountains") return -10;
    return -2.2;
  }

  if (tile_terrain(ptile) != null) {
    if (tile_terrain(ptile)['name'] == "Hills") return -6;
    if (tile_terrain(ptile)['name'] == "Mountains") return -10;
  }

  return 1.8;

}

/****************************************************************************
  Initialize heightmap buffer.
  Uses Float32Array for efficient memory usage and fast access.
  
  @param {number} heightmap_quality - Quality multiplier for resolution
****************************************************************************/
function init_heightmap(heightmap_quality)
{
  const heightmap_resolution_x = map.xsize * heightmap_quality + 1;
  const heightmap_resolution_y = map.ysize * heightmap_quality + 1;

  heightmap = new Float32Array(heightmap_resolution_x * heightmap_resolution_y);
}

/****************************************************************************
  Get hexagonal neighbors for a tile position using odd-r offset coordinates.
  Odd rows are shifted right by half a tile.
  
  @param {number} x - Tile X coordinate
  @param {number} y - Tile Y coordinate
  @returns {Array} Array of {x, y} neighbor coordinates
****************************************************************************/
function get_hex_neighbors(x, y) {
  const isOddRow = y % 2 === 1;
  
  // Hex neighbors in odd-r offset coordinates
  // For even rows: neighbors at (-1,-1), (0,-1), (-1,0), (1,0), (-1,1), (0,1)
  // For odd rows: neighbors at (0,-1), (1,-1), (-1,0), (1,0), (0,1), (1,1)
  if (isOddRow) {
    return [
      { x: x,     y: y - 1 },  // NW
      { x: x + 1, y: y - 1 },  // NE
      { x: x - 1, y: y     },  // W
      { x: x + 1, y: y     },  // E
      { x: x,     y: y + 1 },  // SW
      { x: x + 1, y: y + 1 }   // SE
    ];
  } else {
    return [
      { x: x - 1, y: y - 1 },  // NW
      { x: x,     y: y - 1 },  // NE
      { x: x - 1, y: y     },  // W
      { x: x + 1, y: y     },  // E
      { x: x - 1, y: y + 1 },  // SW
      { x: x,     y: y + 1 }   // SE
    ];
  }
}

/****************************************************************************
  Check if a terrain type is flat (should have flat center).
  
  @param {string} terrainName - Name of the terrain type
  @returns {boolean} True if terrain should be flat
****************************************************************************/
function is_flat_terrain(terrainName) {
  return FLAT_TERRAIN_TYPES.has(terrainName);
}

/****************************************************************************
  Check if a terrain type is elevated (hills/mountains).
  
  @param {string} terrainName - Name of the terrain type
  @returns {boolean} True if terrain is elevated
****************************************************************************/
function is_elevated_terrain(terrainName) {
  return ELEVATED_TERRAIN_TYPES.has(terrainName);
}

/****************************************************************************
  Calculate distance from point (px, py) to hex center (cx, cy).
  Accounts for hex aspect ratio (pointy-top hex is taller than wide).
  
  For pointy-top hexagons:
  - Width = sqrt(3) * radius ≈ 1.732 * R
  - Height = 2 * radius = 2 * R
  - Height/Width ratio = 2/sqrt(3) ≈ 1.1547
  
  We multiply dy by this ratio to normalize distances so that moving
  the same visual distance in X or Y produces the same distance value.
  
  @param {number} px - Point X
  @param {number} py - Point Y  
  @param {number} cx - Center X
  @param {number} cy - Center Y
  @returns {number} Distance normalized to hex inradius (0 = center, 1 = edge)
****************************************************************************/
function hex_distance_to_center(px, py, cx, cy) {
  const HEX_HEIGHT_TO_WIDTH_RATIO = 1.1547; // 2/sqrt(3) for pointy-top hex
  const dx = px - cx;
  const dy = (py - cy) * HEX_HEIGHT_TO_WIDTH_RATIO;
  return Math.sqrt(dx * dx + dy * dy);
}

/****************************************************************************
  Smooth interpolation function for edge transitions.
  Uses a smooth Hermite interpolation (smoothstep).
  
  @param {number} t - Input value (0 to 1)
  @returns {number} Smoothed value
****************************************************************************/
function smoothstep(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

/****************************************************************************
  Generate height for a point based on hexagonal tile topology.
  
  @param {number} gx - Grid X position (can be fractional)
  @param {number} gy - Grid Y position (can be fractional)
  @param {number} heightmap_quality - Quality level
  @returns {number} Height value at this point
****************************************************************************/
function calculate_hex_height(gx, gy, heightmap_quality) {
  // Determine the primary tile and position within it
  const tileX = Math.floor(gx + 0.5);
  const tileY = Math.floor(gy + 0.5);
  
  // Clamp to valid map bounds
  const clampedX = Math.max(0, Math.min(map.xsize - 1, tileX));
  const clampedY = Math.max(0, Math.min(map.ysize - 1, tileY));
  
  const ptile = map_pos_to_tile(clampedX, clampedY);
  if (!ptile || !tile_terrain(ptile)) {
    return HEIGHTMAP_LAND_BASE;
  }
  
  const terrainName = tile_terrain(ptile)['name'];
  const isOcean = is_ocean_tile(ptile);
  const hasRiver = tile_has_extra(ptile, EXTRA_RIVER);
  const isNearOcean = !isOcean && is_ocean_tile_near(ptile);
  const isNearLand = isOcean && is_land_tile_near(ptile);
  
  // Calculate distance from hex center (0 = center, ~0.5 = edge)
  const distFromCenter = hex_distance_to_center(gx, gy, clampedX, clampedY);
  
  // Base height from tile
  let baseHeight = ptile['height'] || HEIGHTMAP_LAND_BASE;
  
  // =========================================================================
  // OCEAN AND COAST HANDLING
  // =========================================================================
  if (isOcean) {
    if (isNearLand) {
      // Coastal water - slightly deeper near edges, shallower toward land
      const edgeFactor = smoothstep(distFromCenter * 2);
      return HEIGHTMAP_COAST_DEPTH + edgeFactor * 0.02;
    }
    return HEIGHTMAP_OCEAN_DEPTH;
  }
  
  // =========================================================================
  // RIVER HANDLING - Create river valleys below water mesh
  // =========================================================================
  if (hasRiver) {
    // Rivers should create valleys
    // The center of river tiles is deepest (below water level)
    // Edges transition to surrounding terrain
    const riverDepth = HEIGHTMAP_RIVER_DEPTH;
    
    // Check neighboring tiles for river continuity
    const neighbors = get_hex_neighbors(clampedX, clampedY);
    let riverNeighborCount = 0;
    let neighborHeightSum = 0;
    let neighborCount = 0;
    
    for (const neighbor of neighbors) {
      if (neighbor.x >= 0 && neighbor.x < map.xsize && 
          neighbor.y >= 0 && neighbor.y < map.ysize) {
        const ntile = map_pos_to_tile(neighbor.x, neighbor.y);
        if (ntile) {
          neighborCount++;
          neighborHeightSum += ntile['height'] || HEIGHTMAP_LAND_BASE;
          if (tile_has_extra(ntile, EXTRA_RIVER)) {
            riverNeighborCount++;
          }
        }
      }
    }
    
    const avgNeighborHeight = neighborCount > 0 ? neighborHeightSum / neighborCount : HEIGHTMAP_LAND_BASE;
    
    // River valley profile: deep at center, rising toward edges
    // Edge blend factor (0 at center, 1 at edge)
    const edgeBlend = smoothstep(distFromCenter * 2.5);
    
    // Center is river depth, edges blend to neighbor terrain
    const valleyHeight = riverDepth + (avgNeighborHeight - riverDepth) * edgeBlend;
    
    // If multiple river neighbors, make the valley deeper (river junction)
    const junctionFactor = riverNeighborCount > 2 ? 0.98 : 1.0;
    
    return valleyHeight * junctionFactor;
  }
  
  // =========================================================================
  // COASTAL LAND HANDLING
  // =========================================================================
  if (isNearOcean) {
    // Land tiles near ocean: beach height at edges, rising inland
    const edgeFactor = smoothstep(distFromCenter * 2);
    
    if (terrainName === 'Hills') {
      // Hills near coast: gentle slope from beach to hill center
      const hillHeight = baseHeight * HEIGHTMAP_HILLS_BOOST * 0.9;
      return HEIGHTMAP_BEACH_HEIGHT + (hillHeight - HEIGHTMAP_BEACH_HEIGHT) * (1 - edgeFactor * 0.5);
    } else if (terrainName === 'Mountains') {
      // Mountains near coast: steeper rise from beach
      const mtHeight = baseHeight * HEIGHTMAP_MOUNTAINS_BOOST * 0.85;
      return HEIGHTMAP_BEACH_HEIGHT + (mtHeight - HEIGHTMAP_BEACH_HEIGHT) * (1 - edgeFactor * 0.3);
    }
    
    // Flat coastal terrain: beach level at edges
    return HEIGHTMAP_BEACH_HEIGHT + (baseHeight - HEIGHTMAP_BEACH_HEIGHT) * (1 - edgeFactor * 0.7);
  }
  
  // =========================================================================
  // ELEVATED TERRAIN (HILLS AND MOUNTAINS)
  // =========================================================================
  if (is_elevated_terrain(terrainName)) {
    // Get neighbor heights for smooth transitions
    const neighbors = get_hex_neighbors(clampedX, clampedY);
    let neighborHeightSum = 0;
    let neighborCount = 0;
    let hasLowerNeighbor = false;
    
    for (const neighbor of neighbors) {
      if (neighbor.x >= 0 && neighbor.x < map.xsize && 
          neighbor.y >= 0 && neighbor.y < map.ysize) {
        const ntile = map_pos_to_tile(neighbor.x, neighbor.y);
        if (ntile && tile_terrain(ntile)) {
          neighborCount++;
          const nHeight = ntile['height'] || HEIGHTMAP_LAND_BASE;
          neighborHeightSum += nHeight;
          if (!is_elevated_terrain(tile_terrain(ntile)['name'])) {
            hasLowerNeighbor = true;
          }
        }
      }
    }
    
    const avgNeighborHeight = neighborCount > 0 ? neighborHeightSum / neighborCount : baseHeight;
    
    // Determine peak height based on terrain type
    let peakHeight;
    if (terrainName === 'Mountains') {
      peakHeight = baseHeight * HEIGHTMAP_MOUNTAINS_BOOST;
      // Add subtle pseudo-random variation for natural appearance using coordinate hashing
      const variation = (((clampedX * VARIATION_PRIME_X_MT + clampedY * VARIATION_PRIME_Y_MT) % VARIATION_MOD) / VARIATION_MOD - 0.5) * MOUNTAIN_VARIATION_SCALE;
      peakHeight += variation;
    } else { // Hills
      peakHeight = baseHeight * HEIGHTMAP_HILLS_BOOST;
      // Smaller pseudo-random variation for gentler hills
      const variation = (((clampedX * VARIATION_PRIME_X_HILLS + clampedY * VARIATION_PRIME_Y_HILLS) % VARIATION_MOD) / VARIATION_MOD - 0.5) * HILLS_VARIATION_SCALE;
      peakHeight += variation;
    }
    
    // Profile: peak at center, smooth transition to edges
    // Using a bell curve profile for natural appearance
    const edgeDist = distFromCenter * 2; // 0 at center, ~1 at edge
    const elevationProfile = Math.exp(-edgeDist * edgeDist * 2);
    
    // Blend between edge height and peak height
    const edgeHeight = hasLowerNeighbor ? avgNeighborHeight : peakHeight * 0.85;
    return edgeHeight + (peakHeight - edgeHeight) * elevationProfile;
  }
  
  // =========================================================================
  // FLAT TERRAIN (PLAINS, GRASSLAND, DESERT, etc.)
  // =========================================================================
  if (is_flat_terrain(terrainName)) {
    // Flat terrain: constant height in center, smooth transitions at edges
    
    // Get neighbor heights for edge blending
    const neighbors = get_hex_neighbors(clampedX, clampedY);
    let neighborHeightSum = 0;
    let neighborCount = 0;
    
    for (const neighbor of neighbors) {
      if (neighbor.x >= 0 && neighbor.x < map.xsize && 
          neighbor.y >= 0 && neighbor.y < map.ysize) {
        const ntile = map_pos_to_tile(neighbor.x, neighbor.y);
        if (ntile) {
          neighborCount++;
          neighborHeightSum += ntile['height'] || HEIGHTMAP_LAND_BASE;
        }
      }
    }
    
    const avgNeighborHeight = neighborCount > 0 ? neighborHeightSum / neighborCount : baseHeight;
    
    // Define flat center region (inner 60% of hex)
    const flatRegionRadius = 0.3;
    
    if (distFromCenter <= flatRegionRadius) {
      // Inside flat center region - constant height
      return baseHeight;
    } else {
      // Edge region - smooth transition to neighbor average
      const edgeBlend = smoothstep((distFromCenter - flatRegionRadius) / (0.5 - flatRegionRadius));
      return baseHeight + (avgNeighborHeight - baseHeight) * edgeBlend * 0.5;
    }
  }
  
  // =========================================================================
  // DEFAULT HANDLING
  // =========================================================================
  return baseHeight;
}

/****************************************************************************
  Update heightmap with improved hexagonal-aware generation.
  
  Features:
  - Flat terrain types have flat centers with edge transitions
  - Mountains and hills are elevated at center with natural slopes
  - Rivers create valleys below water level
  - Proper ocean/coast height handling
  - Hex-aware neighbor interpolation
  
  @param {number} heightmap_quality - Quality multiplier for resolution
****************************************************************************/
function update_heightmap(heightmap_quality)
{
  const heightmap_resolution_x = map.xsize * heightmap_quality + 1;
  const heightmap_resolution_y = map.ysize * heightmap_quality + 1;

  console.log("Updating heightmap (hex-aware)...");

  // =========================================================================
  // PASS 1: Pre-process tile heights for coastlines and unknown tiles
  // =========================================================================
  for (let x = 0; x < map.xsize; x++) {
    for (let y = 0; y < map.ysize; y++) {
      const ptile = map_pos_to_tile(x, y);
      if (!ptile) continue;

      // Handle coastline heights for distinct water/land separation
      if (is_ocean_tile(ptile) && is_land_tile_near(ptile)) {
        ptile['height'] = HEIGHTMAP_COAST_DEPTH;
      } else if (!is_ocean_tile(ptile) && is_ocean_tile_near(ptile) && !tile_has_extra(ptile, EXTRA_RIVER)) {
        ptile['height'] = HEIGHTMAP_BEACH_HEIGHT;
      }

      // Handle unknown tiles - propagate height from known neighbors
      if (tile_get_known(ptile) == TILE_UNKNOWN) {
        ptile['height'] = 0.51;
        
        const neighbors = get_hex_neighbors(x, y);
        for (const neighbor of neighbors) {
          if (neighbor.x < 0 || neighbor.x >= map.xsize || 
              neighbor.y < 0 || neighbor.y >= map.ysize) {
            continue;
          }
          const ntile = map_pos_to_tile(neighbor.x, neighbor.y);
          if (ntile && tile_get_known(ntile) != TILE_UNKNOWN) {
            ptile['height'] = ntile['height'];
            break;
          }
        }
      }
    }
  }

  // =========================================================================
  // PASS 2: Generate high-resolution heightmap with hex-aware interpolation
  // =========================================================================
  for (let x = 0; x < heightmap_resolution_x; x++) {
    for (let y = 0; y < heightmap_resolution_y; y++) {
      const index = y * heightmap_resolution_x + x;
      
      // Convert heightmap coordinates to tile coordinates
      // Offset by 0.5 to align with tile centers
      const gx = x / heightmap_quality - 0.5;
      const gy = y / heightmap_quality - 0.5;
      
      // Calculate height using hex-aware algorithm
      heightmap[index] = calculate_hex_height(gx, gy, heightmap_quality);
    }
  }

  console.log("Heightmap updated (hex-aware generation complete).");
}


/****************************************************************************
 Creates a hash of the map heightmap.
****************************************************************************/
function generate_heightmap_hash() {
  let hash = 0;

  for (let x = 0; x < map.xsize ; x++) {
    for (let y = 0; y < map.ysize; y++) {
      let ptile = map_pos_to_tile(x, y);
      hash += ptile['height']
    }
  }
  return hash;
}

