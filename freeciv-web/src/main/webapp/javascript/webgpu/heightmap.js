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
 * Hexagonal Heightmap Generator for FreecivWorld
 * 
 * This module generates heightmap data that accounts for hexagonal tile geometry.
 * Key features:
 * - Hexagonal tile awareness with staggered row layout (odd-r offset coordinates)
 * - Flat terrain types (plains, grassland, desert, tundra, arctic) are flat in center
 * - Mountains and hills have natural elevation near tile center
 * - River valleys where terrain dips below water mesh level
 * - Proper coast transitions for ocean tiles
 * - Generally flat landscape to avoid excessive inland elevation
 * 
 * Reference: https://www.redblobgames.com/grids/hexagons/
 */

var heightmap = null;
var heightmap_hash = -1;

// Hexagonal geometry constants (matching mapview_common.js)
const HEX_HEIGHT_FACTOR = Math.sqrt(3) / 2;  // sqrt(3)/2 ≈ 0.8660 for hex row spacing
const HEX_STAGGER = 0.5;  // Horizontal offset for odd rows (half tile width)

// Height constants for terrain types
const HEIGHT_OCEAN = 0.45;           // Ocean floor (below water)
const HEIGHT_COAST = 0.48;           // Coast transition
const HEIGHT_BEACH = 0.52;           // Beach/shoreline
const HEIGHT_LAND_BASE = 0.55;       // Standard land height
const HEIGHT_FLAT_TERRAIN = 0.54;    // Flat terrain types (plains, grassland, etc.)
const HEIGHT_HILLS_BASE = 0.56;      // Hills base elevation
const HEIGHT_HILLS_CENTER = 0.58;    // Hills peak elevation
const HEIGHT_MOUNTAIN_BASE = 0.57;   // Mountain base elevation
const HEIGHT_MOUNTAIN_CENTER = 0.62; // Mountain peak elevation (not too high)

// River valley depth (how much lower rivers are than surrounding terrain)
const RIVER_VALLEY_DEPTH = 0.035;    // Creates visible river valleys
const RIVER_CHANNEL_DEPTH = 0.045;   // Deeper at river center for water flow appearance

// Flat terrain type names
const FLAT_TERRAIN_TYPES = new Set(['Plains', 'Grassland', 'Desert', 'Tundra', 'Arctic']);

// Terrain type detection helpers
const ELEVATED_TERRAIN_TYPES = new Set(['Hills', 'Mountains']);

// Variation constants for terrain noise (prime numbers for pseudo-random distribution)
const HILL_VARIATION_PRIME = 17;           // Prime number for hills pseudo-random variation
const MOUNTAIN_VARIATION_MULTIPLIER = 7;   // Multiplier for mountain variation input
const MOUNTAIN_VARIATION_PRIME = 23;       // Prime number for mountains pseudo-random variation

// Interpolation constants
const MAX_NEIGHBOR_BLEND_DISTANCE = 1.5;   // Maximum distance for neighbor height blending

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
  Initialize heightmap array with appropriate resolution for hexagonal tiles.
  
  @param {number} heightmap_quality - Quality multiplier (default 8)
****************************************************************************/
function init_heightmap(heightmap_quality)
{
  const heightmap_resolution_x = map.xsize * heightmap_quality + 1;
  const heightmap_resolution_y = map.ysize * heightmap_quality + 1;

  heightmap = new Float32Array(heightmap_resolution_x * heightmap_resolution_y);
}

/****************************************************************************
  Get the 6 hexagonal neighbors for a tile at (x, y) in odd-r offset coordinates.
  Returns an array of {x, y} coordinates for valid neighbors.
  
  For odd-r offset coordinates (odd rows shifted right):
  - Even rows: neighbors at (-1,-1), (0,-1), (-1,0), (1,0), (-1,1), (0,1)
  - Odd rows: neighbors at (0,-1), (1,-1), (-1,0), (1,0), (0,1), (1,1)
  
  @param {number} x - Tile x coordinate
  @param {number} y - Tile y coordinate
  @returns {Array} Array of neighbor coordinates {x, y}
****************************************************************************/
function getHexNeighbors(x, y) {
  const isOddRow = y % 2 === 1;
  const offsets = isOddRow ? [
    {dx: 0, dy: -1},   // NW
    {dx: 1, dy: -1},   // NE
    {dx: -1, dy: 0},   // W
    {dx: 1, dy: 0},    // E
    {dx: 0, dy: 1},    // SW
    {dx: 1, dy: 1}     // SE
  ] : [
    {dx: -1, dy: -1},  // NW
    {dx: 0, dy: -1},   // NE
    {dx: -1, dy: 0},   // W
    {dx: 1, dy: 0},    // E
    {dx: -1, dy: 1},   // SW
    {dx: 0, dy: 1}     // SE
  ];
  
  const neighbors = [];
  for (const offset of offsets) {
    const nx = x + offset.dx;
    const ny = y + offset.dy;
    if (nx >= 0 && nx < map.xsize && ny >= 0 && ny < map.ysize) {
      neighbors.push({x: nx, y: ny});
    }
  }
  return neighbors;
}

/****************************************************************************
  Calculate the distance from a point to the nearest hexagon edge.
  Uses the hexagonal coordinate system to determine position within tile.
  
  Returns a value from 0 (at edge) to 1 (at center).
  
  @param {number} localX - Local x coordinate within tile (0-1)
  @param {number} localY - Local y coordinate within tile (0-1)
  @returns {number} Distance factor (0 at edge, 1 at center)
****************************************************************************/
function hexDistanceFromCenter(localX, localY) {
  // Convert to centered coordinates (-0.5 to 0.5)
  const cx = localX - 0.5;
  const cy = localY - 0.5;
  
  // For a pointy-top hexagon, calculate distance using hex geometry
  // The hexagon inscribed in a unit square has vertices touching the edges
  const absX = Math.abs(cx);
  const absY = Math.abs(cy);
  
  // Hexagon edge distance calculation
  // For pointy-top hex: max distance is 0.5 at center, 0 at edges
  const hexDist = Math.max(absX * 2, absY * 2, absX + absY * 1.5);
  
  // Normalize to 0-1 range (0 at edge, 1 at center)
  return Math.max(0, 1 - hexDist * 2);
}

/****************************************************************************
  Check if a tile has any neighboring river tiles.
  
  @param {Object} ptile - The tile to check
  @returns {number} Number of neighboring tiles with rivers (0-6 for hex)
****************************************************************************/
function countRiverNeighbors(x, y) {
  const neighbors = getHexNeighbors(x, y);
  let count = 0;
  for (const n of neighbors) {
    const ntile = map_pos_to_tile(n.x, n.y);
    if (ntile && tile_has_extra(ntile, EXTRA_RIVER)) {
      count++;
    }
  }
  return count;
}

/****************************************************************************
  Get base height for a tile based on terrain type.
  Accounts for ocean, coast, flat terrains, hills, and mountains.
  
  @param {Object} ptile - The tile
  @returns {number} Base height value (0-1 range)
****************************************************************************/
function getTileBaseHeight(ptile) {
  if (!ptile || !tile_terrain(ptile)) {
    return HEIGHT_LAND_BASE;
  }
  
  const terrain = tile_terrain(ptile);
  const terrainName = terrain['name'];
  const isOcean = is_ocean_tile(ptile);
  const nearOcean = is_ocean_tile_near(ptile);
  const hasRiver = tile_has_extra(ptile, EXTRA_RIVER);
  
  // Ocean tiles
  if (isOcean) {
    return nearOcean && is_land_tile_near(ptile) ? HEIGHT_COAST : HEIGHT_OCEAN;
  }
  
  // Coastal land tiles
  if (nearOcean && !hasRiver) {
    return HEIGHT_BEACH;
  }
  
  // Flat terrain types - keep them consistently flat
  if (FLAT_TERRAIN_TYPES.has(terrainName)) {
    return HEIGHT_FLAT_TERRAIN;
  }
  
  // Hills
  if (terrainName === 'Hills') {
    return HEIGHT_HILLS_BASE;
  }
  
  // Mountains
  if (terrainName === 'Mountains') {
    return HEIGHT_MOUNTAIN_BASE;
  }
  
  // Default land
  return HEIGHT_LAND_BASE;
}

/****************************************************************************
  Update heightmap with hexagonal tile awareness.
  
  This function generates a heightmap that:
  - Accounts for hexagonal tile geometry with staggered rows
  - Keeps flat terrain types flat in center with edge transitions
  - Creates natural elevation for hills and mountains near tile center
  - Creates river valleys that dip below water level for visible rivers
  - Handles coast transitions properly
  - Maintains generally flat landscape inland
  
  @param {number} heightmap_quality - Quality multiplier (vertices per tile)
****************************************************************************/
function update_heightmap(heightmap_quality)
{
  const heightmap_resolution_x = map.xsize * heightmap_quality + 1;
  const heightmap_resolution_y = map.ysize * heightmap_quality + 1;

  console.log("Updating hexagonal heightmap...");

  // Phase 1: Pre-calculate and normalize tile heights
  // This ensures consistent base heights based on terrain type
  for (let x = 0; x < map.xsize; x++) {
    for (let y = 0; y < map.ysize; y++) {
      const ptile = map_pos_to_tile(x, y);
      if (!ptile) continue;
      
      // Set base height from terrain type
      ptile['height'] = getTileBaseHeight(ptile);
      
      // Handle unknown tiles - propagate from known neighbors
      if (tile_get_known(ptile) === TILE_UNKNOWN) {
        ptile['height'] = HEIGHT_LAND_BASE - 0.04;  // Slightly below water for fog effect
        const neighbors = getHexNeighbors(x, y);
        for (const n of neighbors) {
          const ntile = map_pos_to_tile(n.x, n.y);
          if (ntile && tile_get_known(ntile) !== TILE_UNKNOWN) {
            ptile['height'] = ntile['height'];
            break;
          }
        }
      }
    }
  }

  // Phase 2: Generate detailed heightmap with hex-aware interpolation
  for (let hx = 0; hx < heightmap_resolution_x; hx++) {
    for (let hy = 0; hy < heightmap_resolution_y; hy++) {
      const index = hy * heightmap_resolution_x + hx;
      
      // Convert heightmap coordinates to tile coordinates
      // Account for hexagonal stagger in odd rows
      const tileY = hy / heightmap_quality;
      const tileYInt = Math.floor(tileY);
      const isOddRow = tileYInt % 2 === 1;
      
      // Apply hex stagger for odd rows
      const staggerOffset = isOddRow ? HEX_STAGGER : 0;
      const tileX = (hx / heightmap_quality) - staggerOffset;
      const tileXInt = Math.floor(tileX);
      
      // Local position within the tile (0-1 range)
      const localX = tileX - tileXInt;
      const localY = tileY - tileYInt;
      
      // Get the primary tile at this position
      const primaryTileX = Math.max(0, Math.min(map.xsize - 1, tileXInt));
      const primaryTileY = Math.max(0, Math.min(map.ysize - 1, tileYInt));
      const ptile = map_pos_to_tile(primaryTileX, primaryTileY);
      
      if (!ptile || !tile_terrain(ptile)) {
        heightmap[index] = HEIGHT_LAND_BASE;
        continue;
      }
      
      const terrain = tile_terrain(ptile);
      const terrainName = terrain['name'];
      const baseHeight = ptile['height'];
      const hasRiver = tile_has_extra(ptile, EXTRA_RIVER);
      
      // Calculate position within hexagon (0 at edges, 1 at center)
      const hexCenterFactor = hexDistanceFromCenter(localX, localY);
      
      // Calculate final height based on terrain type and position within hex
      let finalHeight = baseHeight;
      
      // Hills: slight elevation towards center
      if (terrainName === 'Hills') {
        const hillElevation = (HEIGHT_HILLS_CENTER - HEIGHT_HILLS_BASE) * hexCenterFactor;
        // Add subtle pseudo-random variation using prime modulo for natural appearance
        const variation = (((hx * hy) % HILL_VARIATION_PRIME) / HILL_VARIATION_PRIME - 0.5) * 0.005;
        finalHeight = baseHeight + hillElevation + variation;
      }
      // Mountains: more pronounced central elevation
      else if (terrainName === 'Mountains') {
        const mountainElevation = (HEIGHT_MOUNTAIN_CENTER - HEIGHT_MOUNTAIN_BASE) * hexCenterFactor;
        // Add subtle pseudo-random rocky variation using prime modulo
        const variation = (((hx * hy * MOUNTAIN_VARIATION_MULTIPLIER) % MOUNTAIN_VARIATION_PRIME) / MOUNTAIN_VARIATION_PRIME - 0.5) * 0.008;
        finalHeight = baseHeight + mountainElevation + variation;
      }
      // Flat terrains: stay flat in center, slight transition at edges
      else if (FLAT_TERRAIN_TYPES.has(terrainName)) {
        // Very subtle dip at edges for hex shape visibility
        const edgeFactor = 1 - hexCenterFactor;
        finalHeight = baseHeight - edgeFactor * 0.003;
      }
      
      // River valley handling
      if (hasRiver) {
        // Create deeper valley at river center
        const riverDepth = RIVER_VALLEY_DEPTH + (hexCenterFactor * RIVER_CHANNEL_DEPTH);
        finalHeight = baseHeight - riverDepth;
        
        // Check for neighboring rivers to create flow channels between tiles
        const riverNeighborCount = countRiverNeighbors(primaryTileX, primaryTileY);
        if (riverNeighborCount > 0) {
          // Deepen the edges towards neighboring river tiles
          const edgeFactor = 1 - hexCenterFactor;
          const flowBonus = edgeFactor * riverNeighborCount * 0.004;
          finalHeight -= flowBonus;
        }
      }
      
      // Smooth transitions at tile boundaries using neighbor interpolation
      if (hexCenterFactor < 0.4) {
        // Near tile edge - blend with neighbors for smooth transitions
        const neighbors = getHexNeighbors(primaryTileX, primaryTileY);
        let totalWeight = hexCenterFactor + 0.1;  // Weight for current tile
        let weightedHeight = finalHeight * (hexCenterFactor + 0.1);
        
        for (const n of neighbors) {
          const ntile = map_pos_to_tile(n.x, n.y);
          if (!ntile) continue;
          
          // Calculate distance to this neighbor (simplified)
          const ndx = (n.x + (n.y % 2 === 1 ? HEX_STAGGER : 0)) - (primaryTileX + staggerOffset);
          const ndy = (n.y - primaryTileY) * HEX_HEIGHT_FACTOR;
          const neighborDist = Math.sqrt(ndx * ndx + ndy * ndy);
          
          if (neighborDist > 0 && neighborDist < MAX_NEIGHBOR_BLEND_DISTANCE) {
            const nHeight = ntile['height'];
            const nWeight = (1 - hexCenterFactor) / (neighborDist * neighborDist + 0.5);
            
            // Apply river adjustments for neighbor tiles
            let adjustedNHeight = nHeight;
            if (tile_has_extra(ntile, EXTRA_RIVER) && hasRiver) {
              // Create smooth river channel between tiles
              adjustedNHeight -= RIVER_VALLEY_DEPTH;
            }
            
            weightedHeight += adjustedNHeight * nWeight;
            totalWeight += nWeight;
          }
        }
        
        finalHeight = weightedHeight / totalWeight;
      }
      
      // Store the calculated height
      heightmap[index] = finalHeight;
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

