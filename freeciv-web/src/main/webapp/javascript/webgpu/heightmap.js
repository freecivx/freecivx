/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2022  The Freeciv-web project

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
 * Hexagonal Heightmap Generator
 * 
 * This module generates heightmaps that respect hexagonal tile geometry.
 * Key features:
 * - Hexagonal tile shape awareness (heights properly consider hex boundaries)
 * - Flat terrain types (plains, grassland, etc.) are flat in center with edge transitions
 * - Mountains and hills have natural elevation near tile center
 * - Rivers create valleys where terrain height goes under water mesh
 * - River flow between tiles properly connects neighboring river tiles
 * - Landscape is relatively flat to avoid excessive inland elevation
 * 
 * The heightmap uses odd-r offset coordinates (staggered rows) matching the
 * hex tile coordinate system used in the shader and geometry.
 * Reference: https://www.redblobgames.com/grids/hexagons/#coordinates-offset
 */

var heightmap = null;
var heightmap_hash = -1;

// =========================================================================
// HEXAGONAL GEOMETRY CONSTANTS
// =========================================================================
// These constants define the hexagonal tile geometry for height calculations
// Matching the values in mapview_common.js and terrain_shader_webgpu.js

const HEX_HEIGHT_FACTOR = Math.sqrt(3) / 2;  // ≈ 0.866 - hex row spacing
const HEX_INRADIUS = 0.5;  // Distance from center to edge midpoint (in tile units)

// Height constants - matching water level and beach zones from terrain shader
const WATER_LEVEL = 0.50;           // Water surface level
const OCEAN_HEIGHT = 0.45;          // Ocean/deep water height
const COAST_HEIGHT = 0.48;          // Coast/shallow water height
const BEACH_HEIGHT = 0.52;          // Beach/shore height
const LAND_BASE_HEIGHT = 0.54;      // Base land height
const FLAT_TERRAIN_HEIGHT = 0.55;   // Flat terrain (plains, grassland, etc.)
const HILLS_BASE_HEIGHT = 0.58;     // Hills base height
const HILLS_PEAK_HEIGHT = 0.62;     // Hills peak at center
const MOUNTAINS_BASE_HEIGHT = 0.60; // Mountains base height
const MOUNTAINS_PEAK_HEIGHT = 0.68; // Mountains peak at center (not too high)
const RIVER_VALLEY_DEPTH = 0.46;    // River valley depth (below water level for visual effect)
const RIVER_EDGE_HEIGHT = 0.49;     // River edge height (slight depression)

// Terrain classification helpers - using Set for O(1) lookup performance
const FLAT_TERRAINS = new Set(["Plains", "Grassland", "Desert", "Tundra", "Arctic", "Swamp", "Forest", "Jungle"]);
const ELEVATED_TERRAINS = new Set(["Hills", "Mountains"]);

// Pseudo-random variation constants for terrain detail
// Using prime numbers for better distribution in hash calculations
const VARIATION_PRIME_X = 7;    // Prime multiplier for X coordinate
const VARIATION_PRIME_Y = 13;   // Prime multiplier for Y coordinate
const VARIATION_MODULO = 17;    // Prime modulo for wrapping
const VARIATION_SCALE = 170;    // Scale factor (10x modulo for 0-0.1 range)

/****************************************************************************
  Returns height offset for units. This will make units higher above cities.
****************************************************************************/
function get_unit_height_offset(punit)
{
  if (punit == null) return 0;
  let ptile = index_to_tile(punit['tile']);
  if (ptile == null) return 0;
  let ptype = unit_type(punit);

  if (ptype['name'] == "Caravel") {
    return 7;
  }

  if (ptype['name'] == "Galleon") {
    return 5.4;
  }

  if (ptype['name'] == "Frigate") {
    return 7.2;
  }

  if (ptype['name'] == "Destroyer") {
    return 4.0;
  }
  if (ptype['name'] == "Battleship") {
    return 4.0;
  }
  if (ptype['name'] == "Transport") {
    return 4.0;
  }
  if (ptype['name'] == "Fighter") {
    return 18.0;
  }
  if (ptype['name'] == "Bomber") {
    return 18.0;
  }
  if (ptype['name'] == "Helicopter") {
    return 12.0;
  }
  if (ptype['name'] == "Cruiser") {
    return 4.0;
  }
  if (ptype['name'] == "Ironclad") {
    return 4.2;
  }

  if (ptype['name'] == "Zeppelin") {
    return 28;
  }

  if (tile_has_extra(ptile, EXTRA_RIVER)) {
    return 1;
  }

  if (!is_ocean_tile(ptile) && is_ocean_tile_near(ptile)) {
    return -4;
  }

  if (tile_terrain(ptile)['name'] == "Hills" || tile_terrain(ptile)['name'] == "Mountains") {
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
  Initialize heightmap array with proper size for hexagonal resolution.
  Uses Float32Array for efficient memory usage and GPU compatibility.
****************************************************************************/
function init_heightmap(heightmap_quality)
{
  const heightmap_resolution_x = map.xsize * heightmap_quality + 1;
  const heightmap_resolution_y = map.ysize * heightmap_quality + 1;
  
  // Use Float32Array for efficient memory and GPU transfer
  heightmap = new Float32Array(heightmap_resolution_x * heightmap_resolution_y);
}

/****************************************************************************
  Get the 6 hex neighbors for a tile in iso-hex coordinate system.
  In iso-hex, valid directions are: N, S, E, W, NW, SE (not NE, SW)
  
  For height blending purposes, we use a simplified approach that works
  well for the visual height interpolation regardless of exact hex topology.
  
  Returns array of neighbor tile coordinates.
****************************************************************************/
function get_hex_neighbors(x, y) {
  const neighbors = [];
  
  // For iso-hex topology (TF_HEX | TF_ISO), the valid 6 directions are:
  // N, S, E, W, NW, SE - and NE/SW are invalid
  // These offsets work for height blending across hex boundaries
  const directions = [
    { dx: -1, dy: -1 },  // NW
    { dx:  0, dy: -1 },  // N
    { dx: -1, dy:  0 },  // W
    { dx:  1, dy:  0 },  // E
    { dx:  0, dy:  1 },  // S
    { dx:  1, dy:  1 }   // SE
  ];
  
  for (const dir of directions) {
    const nx = x + dir.dx;
    const ny = y + dir.dy;
    if (nx >= 0 && nx < map.xsize && ny >= 0 && ny < map.ysize) {
      neighbors.push({ x: nx, y: ny });
    }
  }
  
  return neighbors;
}

/****************************************************************************
  Calculate distance from point to hexagon edge (signed distance field).
  Returns 0 at center, 1 at edge for a unit hex.
  Uses pointy-top hexagon geometry.
****************************************************************************/
function hex_distance_from_center(localX, localY) {
  // Transform to centered coordinates (-0.5 to 0.5)
  const cx = localX - 0.5;
  const cy = (localY - 0.5) * (1.0 / HEX_HEIGHT_FACTOR);  // Compensate for hex aspect
  
  // Calculate distance to three pairs of hex edges using dot products
  const HEX_SQRT3_2 = Math.sqrt(3) / 2;
  
  const dist1 = Math.abs(cx);  // Vertical edges
  const dist2 = Math.abs(cx * 0.5 + cy * HEX_SQRT3_2);  // Top-right/bottom-left
  const dist3 = Math.abs(cx * -0.5 + cy * HEX_SQRT3_2); // Top-left/bottom-right
  
  // Maximum distance determines which edge we're closest to
  const hexDist = Math.max(dist1, dist2, dist3);
  
  // Normalize so that 0 = center, 1 = edge
  return hexDist / HEX_INRADIUS;
}

/****************************************************************************
  Check if a terrain type is considered "flat" terrain.
****************************************************************************/
function is_flat_terrain(ptile) {
  if (ptile == null || tile_terrain(ptile) == null) return true;
  const terrainName = tile_terrain(ptile)['name'];
  return FLAT_TERRAINS.has(terrainName);
}

/****************************************************************************
  Check if a terrain type is elevated (hills or mountains).
****************************************************************************/
function is_elevated_terrain(ptile) {
  if (ptile == null || tile_terrain(ptile) == null) return false;
  const terrainName = tile_terrain(ptile)['name'];
  return ELEVATED_TERRAINS.has(terrainName);
}

/****************************************************************************
  Get base height for a tile based on its terrain type and neighbors.
****************************************************************************/
function get_tile_base_height(ptile) {
  if (ptile == null) return LAND_BASE_HEIGHT;
  
  const terrain = tile_terrain(ptile);
  if (terrain == null) return LAND_BASE_HEIGHT;
  
  const terrainName = terrain['name'];
  
  // Ocean tiles
  if (is_ocean_tile(ptile)) {
    if (is_land_tile_near(ptile)) {
      return COAST_HEIGHT;  // Shallow water near coast
    }
    return OCEAN_HEIGHT;  // Deep ocean
  }
  
  // River tiles - create valley
  if (tile_has_extra(ptile, EXTRA_RIVER)) {
    return RIVER_VALLEY_DEPTH;
  }
  
  // Coast-adjacent land
  if (is_ocean_tile_near(ptile)) {
    return BEACH_HEIGHT;
  }
  
  // Elevated terrain
  if (terrainName === "Mountains") {
    return MOUNTAINS_BASE_HEIGHT;
  }
  if (terrainName === "Hills") {
    return HILLS_BASE_HEIGHT;
  }
  
  // Flat terrain
  return FLAT_TERRAIN_HEIGHT;
}

/****************************************************************************
  Get peak height for elevated terrain at tile center.
****************************************************************************/
function get_tile_peak_height(ptile) {
  if (ptile == null) return FLAT_TERRAIN_HEIGHT;
  
  const terrain = tile_terrain(ptile);
  if (terrain == null) return FLAT_TERRAIN_HEIGHT;
  
  const terrainName = terrain['name'];
  
  if (terrainName === "Mountains") {
    return MOUNTAINS_PEAK_HEIGHT;
  }
  if (terrainName === "Hills") {
    return HILLS_PEAK_HEIGHT;
  }
  
  // Flat terrains have same height at center as edges
  return get_tile_base_height(ptile);
}

/****************************************************************************
  Count neighboring river tiles for river flow calculations.
****************************************************************************/
function count_river_neighbors(x, y) {
  let count = 0;
  const neighbors = get_hex_neighbors(x, y);
  
  for (const n of neighbors) {
    const ntile = map_pos_to_tile(n.x, n.y);
    if (ntile && tile_has_extra(ntile, EXTRA_RIVER)) {
      count++;
    }
  }
  
  return count;
}

/****************************************************************************
  Calculate interpolated height at a point considering hexagonal geometry.
  
  This is the core of the hexagonal heightmap algorithm:
  1. Determine which hex tile the point is in
  2. Calculate position within the hex (0-1 local coordinates)
  3. Calculate distance from hex center (for elevation profile)
  4. Blend with neighboring tiles at hex edges
  
  For flat terrain: height is constant across tile
  For elevated terrain: height peaks at center, decreases toward edges
  For rivers: create valley that goes below water level between river tiles
****************************************************************************/
function calculate_hex_height(gx, gy, heightmap_quality) {
  // Get integer tile coordinates
  const tileX = Math.floor(gx + 0.5);
  const tileY = Math.floor(gy + 0.5);
  
  // Clamp to valid tile range
  const clampedX = Math.max(0, Math.min(map.xsize - 1, tileX));
  const clampedY = Math.max(0, Math.min(map.ysize - 1, tileY));
  
  const ptile = map_pos_to_tile(clampedX, clampedY);
  if (ptile == null) return LAND_BASE_HEIGHT;
  
  // Calculate local position within tile (0 to 1)
  const localX = gx - tileX + 0.5;
  const localY = gy - tileY + 0.5;
  
  // Calculate distance from hex center (0 at center, 1 at edge)
  const hexDist = hex_distance_from_center(localX, localY);
  
  // Get base and peak heights for this tile
  const baseHeight = get_tile_base_height(ptile);
  const peakHeight = get_tile_peak_height(ptile);
  
  // Calculate height based on terrain type and position within hex
  let height;
  
  if (is_ocean_tile(ptile)) {
    // Ocean tiles are flat
    height = baseHeight;
  }
  else if (tile_has_extra(ptile, EXTRA_RIVER)) {
    // River tiles create valleys
    // Center of river tile is deepest
    // Edges blend with neighboring terrain
    const riverNeighbors = count_river_neighbors(clampedX, clampedY);
    
    // Create deeper valley when more river neighbors (river confluence)
    const valleyDepth = RIVER_VALLEY_DEPTH - (riverNeighbors * 0.005);
    
    // Smooth valley profile: deepest at center, rises toward edges
    const valleyProfile = hexDist * hexDist;  // Parabolic valley
    height = valleyDepth + valleyProfile * (RIVER_EDGE_HEIGHT - valleyDepth);
    
    // Ensure rivers connect properly between tiles
    if (hexDist > 0.7) {
      // At edge, blend with neighbor heights for smooth river flow
      const neighbors = get_hex_neighbors(clampedX, clampedY);
      let neighborSum = 0;
      let neighborCount = 0;
      
      for (const n of neighbors) {
        const ntile = map_pos_to_tile(n.x, n.y);
        if (ntile && tile_has_extra(ntile, EXTRA_RIVER)) {
          // Neighboring river - maintain low elevation for flow
          neighborSum += RIVER_VALLEY_DEPTH;
          neighborCount++;
        }
      }
      
      if (neighborCount > 0) {
        const edgeBlend = (hexDist - 0.7) / 0.3;  // 0 to 1 in edge zone
        const neighborAvg = neighborSum / neighborCount;
        height = height * (1 - edgeBlend) + neighborAvg * edgeBlend;
      }
    }
  }
  else if (is_elevated_terrain(ptile)) {
    // Hills and mountains: peak at center, blend to base at edges
    // Use smooth hermite interpolation for natural look
    const t = Math.min(1, hexDist);  // Clamp to 0-1
    const smoothT = t * t * (3 - 2 * t);  // Smoothstep
    
    height = peakHeight * (1 - smoothT) + baseHeight * smoothT;
    
    // Add subtle variation for natural appearance using named constants
    const variation = ((clampedX * VARIATION_PRIME_X + clampedY * VARIATION_PRIME_Y) % VARIATION_MODULO) / VARIATION_SCALE;
    height += (variation - 0.05) * 0.02;
  }
  else {
    // Flat terrain: mostly constant, slight variation at edges
    height = baseHeight;
    
    // Very subtle edge depression for tile boundaries
    if (hexDist > 0.8) {
      const edgeBlend = (hexDist - 0.8) / 0.2;
      height -= edgeBlend * 0.005;  // Tiny edge depression
    }
  }
  
  // Handle edge blending with neighboring tiles
  if (hexDist > 0.6) {
    const neighbors = get_hex_neighbors(clampedX, clampedY);
    let blendHeight = 0;
    let blendWeight = 0;
    
    // Calculate point direction once before the loop (optimization)
    const pointDir = Math.atan2(localY - 0.5, localX - 0.5);
    
    for (const n of neighbors) {
      const ntile = map_pos_to_tile(n.x, n.y);
      if (ntile == null) continue;
      
      // Calculate direction to this neighbor
      const dx = n.x - clampedX;
      const dy = n.y - clampedY;
      
      // Calculate how much this neighbor should influence based on direction
      const neighborDir = Math.atan2(dy, dx);
      let angleDiff = Math.abs(neighborDir - pointDir);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
      
      // Only blend with neighbors in the direction we're heading
      if (angleDiff < Math.PI / 3) {
        const neighborBaseHeight = get_tile_base_height(ntile);
        const weight = (1 - angleDiff / (Math.PI / 3)) * (hexDist - 0.6) / 0.4;
        blendHeight += neighborBaseHeight * weight;
        blendWeight += weight;
      }
    }
    
    if (blendWeight > 0) {
      const neighborAvg = blendHeight / blendWeight;
      const blendFactor = Math.min(0.5, blendWeight) * (hexDist - 0.6) / 0.4;
      height = height * (1 - blendFactor) + neighborAvg * blendFactor;
    }
  }
  
  return height;
}

/****************************************************************************
  Update heightmap based on tile heights with hexagonal geometry support.
  
  This improved version:
  1. Pre-processes tile heights for consistency
  2. Uses hexagonal geometry for height calculations
  3. Properly handles rivers as valleys
  4. Creates smooth transitions between terrain types
  5. Keeps landscape relatively flat
****************************************************************************/
function update_heightmap(heightmap_quality)
{
  const heightmap_resolution_x = map.xsize * heightmap_quality + 1;
  const heightmap_resolution_y = map.ysize * heightmap_quality + 1;

  console.log("Updating hexagonal heightmap...");

  // Pre-process: Ensure all tiles have proper base heights
  for (let x = 0; x < map.xsize; x++) {
    for (let y = 0; y < map.ysize; y++) {
      const ptile = map_pos_to_tile(x, y);
      if (ptile == null) continue;
      
      // Handle unknown tiles - use neighbor height for smooth fog of war
      if (tile_get_known(ptile) == TILE_UNKNOWN) {
        ptile['height'] = LAND_BASE_HEIGHT;
        
        const neighbors = get_hex_neighbors(x, y);
        for (const n of neighbors) {
          const ntile = map_pos_to_tile(n.x, n.y);
          if (ntile && tile_get_known(ntile) != TILE_UNKNOWN) {
            ptile['height'] = get_tile_base_height(ntile);
            break;
          }
        }
        continue;
      }
      
      // Set tile height based on terrain type
      ptile['height'] = get_tile_base_height(ptile);
    }
  }

  // Generate heightmap using hexagonal interpolation
  for (let hx = 0; hx < heightmap_resolution_x; hx++) {
    for (let hy = 0; hy < heightmap_resolution_y; hy++) {
      const index = hy * heightmap_resolution_x + hx;
      
      // Convert heightmap coordinates to tile coordinates
      // Account for staggered hex rows (odd rows offset by 0.5)
      const gx = hx / heightmap_quality - 0.5;
      const gy = hy / heightmap_quality - 0.5;
      
      // Calculate height using hexagonal geometry
      heightmap[index] = calculate_hex_height(gx, gy, heightmap_quality);
    }
  }

  console.log("Hexagonal heightmap updated.");
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

