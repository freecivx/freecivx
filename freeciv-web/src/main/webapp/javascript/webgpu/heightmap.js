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


var heightmap = null;
var heightmap_hash = -1;

// Hexagonal grid constants for pointy-top hexagons (odd-r offset coordinates)
// Reference: https://www.redblobgames.com/grids/hexagons/#coordinates-offset
const HEX_SQRT3 = Math.sqrt(3);
const HEX_SQRT3_OVER_2 = HEX_SQRT3 / 2;

// Hex stagger offset for distance calculations between rows with different parities
// In odd-r offset coordinates, odd rows are shifted 0.5 tiles right.
// When calculating distances between tiles in different row parities,
// we need to account for this visual offset. The value 0.25 represents
// half of the 0.5 stagger, used to center the distance calculation.
const HEX_STAGGER_DISTANCE_OFFSET = 0.25;

// River valley rendering constants
// RIVER_VALLEY_DISTANCE_THRESHOLD: Maximum distance from tile boundary midpoint
// to apply valley depth. Tiles closer than this to a river boundary get lowered.
const RIVER_VALLEY_DISTANCE_THRESHOLD = 0.5;

// RIVER_VALLEY_DEPTH_FACTOR: Controls how deep the valley dips between river tiles.
// Higher values create more pronounced valleys for river flow visualization.
const RIVER_VALLEY_DEPTH_FACTOR = 0.06;

// River height adjustment constants for tiles with rivers
// RIVER_BASE_HEIGHT_FACTOR: Base multiplier for river tile heights (slightly raised)
// RIVER_NEIGHBOR_DEPTH_DIVISOR: Divides by (center tile + 6 neighbors) = 7 max tiles
// RIVER_NEIGHBOR_DEPTH_FACTOR: Additional depth reduction per nearby river tile
const RIVER_BASE_HEIGHT_FACTOR = 1.045;
const RIVER_NEIGHBOR_DEPTH_DIVISOR = 7; // center tile + 6 hex neighbors
const RIVER_NEIGHBOR_DEPTH_FACTOR = 0.025;

// Cache for hex neighbor offsets (pre-computed for efficiency)
// Key: row parity (0 or 1), Value: array of {dx, dy} neighbor offsets
const HEX_NEIGHBOR_OFFSETS = {
  // Even row neighbors (row % 2 === 0)
  0: [
    { dx: 0, dy: -1 },   // N
    { dx: 0, dy: 1 },    // S
    { dx: 1, dy: 0 },    // E
    { dx: -1, dy: 0 },   // W
    { dx: -1, dy: -1 },  // NW
    { dx: -1, dy: 1 }    // SW
  ],
  // Odd row neighbors (row % 2 === 1) - staggered right
  1: [
    { dx: 0, dy: -1 },   // N
    { dx: 0, dy: 1 },    // S
    { dx: 1, dy: 0 },    // E
    { dx: -1, dy: 0 },   // W
    { dx: 1, dy: -1 },   // NE (shifted due to stagger)
    { dx: 1, dy: 1 }     // SE (shifted due to stagger)
  ]
};

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
  Create heightmap based on tile.height.
****************************************************************************/
function init_heightmap(heightmap_quality)
{
  let heightmap_resolution_x = map.xsize * heightmap_quality + 1;
  let heightmap_resolution_y = map.ysize * heightmap_quality + 1;

  heightmap = new Float32Array(heightmap_resolution_x * heightmap_resolution_y);

}

/****************************************************************************
  Get the 6 hex neighbors for a tile at (x, y) using odd-r offset coordinates.
  Returns array of {x, y} coordinates for valid neighbors within map bounds.
****************************************************************************/
function get_hex_neighbors(x, y) {
  const rowParity = y & 1; // y % 2, using bitwise for speed
  const offsets = HEX_NEIGHBOR_OFFSETS[rowParity];
  const neighbors = [];
  
  for (let i = 0; i < 6; i++) {
    const nx = x + offsets[i].dx;
    const ny = y + offsets[i].dy;
    if (nx >= 0 && nx < map.xsize && ny >= 0 && ny < map.ysize) {
      neighbors.push({ x: nx, y: ny });
    }
  }
  return neighbors;
}

/****************************************************************************
  Calculate hexagonal distance between two points in hex grid space.
  This accounts for the staggered row layout of odd-r offset coordinates.
  Returns a distance metric suitable for inverse-distance weighting.
****************************************************************************/
function hex_distance(gx, gy, tx, ty) {
  // Convert to axial coordinates for proper hex distance calculation
  // For odd-r offset: col = x, row = y
  // Axial conversion: q = col - (row - (row & 1)) / 2, r = row
  
  // However, for sub-tile interpolation, we need continuous coordinates
  // Use hex-aware Euclidean distance with aspect ratio correction
  const dx = gx - tx;
  // Account for hex aspect ratio (height = sqrt(3)/2 * width for pointy-top)
  const dy = (gy - ty) * HEX_SQRT3_OVER_2;
  
  // Apply stagger offset for more accurate inter-tile distances
  const rowParityG = Math.floor(gy) & 1;
  const rowParityT = Math.floor(ty) & 1;
  let staggerDx = 0;
  if (rowParityG !== rowParityT) {
    // Different row parities - adjust for the visual stagger offset
    staggerDx = (rowParityT === 1 ? HEX_STAGGER_DISTANCE_OFFSET : -HEX_STAGGER_DISTANCE_OFFSET);
  }
  
  const adjustedDx = dx + staggerDx;
  return Math.sqrt(adjustedDx * adjustedDx + dy * dy);
}

/****************************************************************************
  Check if there's a river between two tiles by examining their neighbors.
  Returns true if both tiles have rivers and are adjacent, creating a flow path.
****************************************************************************/
function tiles_share_river_connection(tile1, tile2) {
  if (!tile1 || !tile2) return false;
  return tile_has_extra(tile1, EXTRA_RIVER) && tile_has_extra(tile2, EXTRA_RIVER);
}

/****************************************************************************
  Create heightmap based on tile.height with hexagonal tile awareness.
  Uses 6-neighbor hex interpolation and creates proper river valleys.
****************************************************************************/
function update_heightmap(heightmap_quality)
{
  let heightmap_resolution_x = map.xsize * heightmap_quality + 1;
  let heightmap_resolution_y = map.ysize * heightmap_quality + 1;

  console.log("Updating heightmap with hex-aware interpolation...");

  // First pass: Adjust tile heights for coastlines and unknown tiles
  for (let x = 0; x < map.xsize ; x++) {
    for (let y = 0; y < map.ysize; y++) {
      let ptile = map_pos_to_tile(x, y);

      // Make coastline more distinct, to make it easier to distinguish ocean from land.
      if (is_ocean_tile(ptile) && is_land_tile_near(ptile)) {
        ptile['height'] = 0.45;
      }
      if (!is_ocean_tile(ptile) && is_ocean_tile_near(ptile) && !tile_has_extra(ptile, EXTRA_RIVER)) {
        ptile['height'] = 0.55;
      }

      if (tile_get_known(ptile) == TILE_UNKNOWN) {
        ptile['height'] = 0.51;
        // Use hex neighbors for height propagation on unknown tiles
        let hexNeighbors = get_hex_neighbors(x, y);
        
        for (let i = 0; i < hexNeighbors.length; i++) {
          let coords = hexNeighbors[i];
          if (ptile['height'] > 0.51) break;
          
          let ntile = map_pos_to_tile(coords.x, coords.y);
          if (tile_get_known(ntile) != TILE_UNKNOWN) {
            ptile['height'] = ntile['height'];
          }
        }
      }
    }
  }

  // Second pass: Generate heightmap with hex-aware interpolation
  for (let x = 0; x < heightmap_resolution_x; x++) {
    for (let y = 0; y < heightmap_resolution_y; y++) {
      let index = y * heightmap_resolution_x + x;
      
      // Convert heightmap pixel to tile coordinates
      // gx, gy are continuous coordinates in tile space
      let gx = x / heightmap_quality - 0.5;
      let gy = y / heightmap_quality - 0.5;
      
      // Check if we're exactly at a tile center
      let isAtTileCenter = Math.round(gx) === gx && Math.round(gy) === gy;
      
      if (isAtTileCenter && gx >= 0 && gx < map.xsize && gy >= 0 && gy < map.ysize) {
        // At tile center - use tile's height directly with adjustments
        let ptile = map_pos_to_tile(gx, gy);
        let terrain = tile_terrain(ptile);
        heightmap[index] = ptile['height'];
        
        if (tile_has_extra(ptile, EXTRA_RIVER)) {
          // River tiles are slightly lower to create valley effect
          heightmap[index] = ptile['height'] * 0.98;
        }
        if (terrain && terrain['name'] == "Mountains") {
          // Mountains are slightly higher
          heightmap[index] = ptile['height'] * 1.02;
        }
      } else {
        // Between tiles - use hex-aware interpolation
        heightmap[index] = interpolate_hex_height(gx, gy, x, y, heightmap_quality);
      }
    }
  }

  console.log("Heightmap updated with hex interpolation.");
}

/****************************************************************************
  Interpolate height at a sub-tile position using hex-aware weighting.
  Takes into account hex neighbor topology and river connections.
****************************************************************************/
function interpolate_hex_height(gx, gy, pixelX, pixelY, quality) {
  // Find the nearest tile and its hex neighbors for interpolation
  let centerTileX = Math.round(gx);
  let centerTileY = Math.round(gy);
  
  // Clamp to map bounds
  centerTileX = Math.max(0, Math.min(map.xsize - 1, centerTileX));
  centerTileY = Math.max(0, Math.min(map.ysize - 1, centerTileY));
  
  // Get center tile and its 6 hex neighbors
  let centerTile = map_pos_to_tile(centerTileX, centerTileY);
  let hexNeighbors = get_hex_neighbors(centerTileX, centerTileY);
  
  // Build list of tiles to interpolate from (center + up to 6 neighbors)
  let tilesToInterpolate = [{ x: centerTileX, y: centerTileY, tile: centerTile }];
  
  for (let i = 0; i < hexNeighbors.length; i++) {
    let coords = hexNeighbors[i];
    let ntile = map_pos_to_tile(coords.x, coords.y);
    tilesToInterpolate.push({ x: coords.x, y: coords.y, tile: ntile });
  }
  
  // Count river tiles and detect river connections for valley creation
  let numRiverTiles = 0;
  let riverConnectionStrength = 0;
  
  // Track which tiles have rivers for efficient valley checking
  let centerHasRiver = tile_has_extra(tilesToInterpolate[0].tile, EXTRA_RIVER);
  if (centerHasRiver) numRiverTiles++;
  
  for (let i = 1; i < tilesToInterpolate.length; i++) {
    if (tile_has_extra(tilesToInterpolate[i].tile, EXTRA_RIVER)) {
      numRiverTiles++;
    }
  }
  
  // Check for river connections between center tile and its hex neighbors only
  // This is O(n) instead of O(n²) - only 6 comparisons instead of 21
  if (numRiverTiles >= 2 && centerHasRiver) {
    for (let i = 1; i < tilesToInterpolate.length; i++) {
      if (tile_has_extra(tilesToInterpolate[i].tile, EXTRA_RIVER)) {
        // River connection between center and this neighbor - create valley
        let midX = (tilesToInterpolate[0].x + tilesToInterpolate[i].x) / 2;
        let midY = (tilesToInterpolate[0].y + tilesToInterpolate[i].y) / 2;
        let distToMid = Math.sqrt((gx - midX) * (gx - midX) + (gy - midY) * (gy - midY));
        
        // Increase valley strength when closer to the boundary between river tiles
        if (distToMid < RIVER_VALLEY_DISTANCE_THRESHOLD) {
          riverConnectionStrength += (RIVER_VALLEY_DISTANCE_THRESHOLD - distToMid) * RIVER_VALLEY_DEPTH_FACTOR;
        }
      }
    }
  }
  
  // Inverse-distance weighted interpolation with hex distance metric
  let sum = 0;
  let norm = 0;
  const MIN_DISTANCE = 0.001; // Prevent division by zero
  
  for (let i = 0; i < tilesToInterpolate.length; i++) {
    let tileData = tilesToInterpolate[i];
    let ptile = tileData.tile;
    
    // Calculate hex-aware distance
    let distance = hex_distance(gx, gy, tileData.x, tileData.y);
    if (distance < MIN_DISTANCE) distance = MIN_DISTANCE;
    
    // Get base height for this tile
    let height = ptile['height'];
    
    // Apply terrain-specific variations
    let terrain = tile_terrain(ptile);
    if (terrain && (terrain['name'] == "Hills" || terrain['name'] == "Mountains")) {
      // Add subtle variation for hills/mountains
      let rnd = ((pixelX * pixelY) % 10) / 10;
      height = height + ((rnd - 0.5) / 50) - 0.01;
    }
    
    // Apply river height reduction
    if (tile_has_extra(ptile, EXTRA_RIVER)) {
      // River tiles get lowered, more so when multiple river tiles are nearby
      // Calculate reduction: ratio of river tiles to max possible (7) times depth factor
      let riverTileRatio = numRiverTiles / RIVER_NEIGHBOR_DEPTH_DIVISOR;
      let depthReduction = riverTileRatio * RIVER_NEIGHBOR_DEPTH_FACTOR;
      let riverFactor = RIVER_BASE_HEIGHT_FACTOR - depthReduction;
      height = height * riverFactor;
    }
    
    // Inverse distance weighting (IDW) - closer tiles have more influence
    let weight = 1.0 / (distance * distance);
    sum += height * weight;
    norm += weight;
  }
  
  let interpolatedHeight = norm > 0 ? sum / norm : 0.5;
  
  // Apply river valley depth for areas between river tiles
  if (riverConnectionStrength > 0) {
    interpolatedHeight -= riverConnectionStrength;
  }
  
  return interpolatedHeight;
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

