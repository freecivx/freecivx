/**********************************************************************
    Freecivx.com - the web version of Freeciv. http://www.freecivx.com/
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
 * Map Utilities for Square Map Tiles
 * 
 * This module provides coordinate conversion utilities for square map tiles.
 * Unlike hexagonal maps, square maps use direct coordinate mapping without
 * row staggering.
 */

/****************************************************************************
  Convert map tile coordinates to 3D scene coordinates for square maps.
  
  For square maps, the conversion is straightforward:
  - Each tile maps directly to a grid position
  - No row staggering is needed
  
  @param {number} map_x - Map X coordinate (tile column)
  @param {number} map_y - Map Y coordinate (tile row)
  @returns {Object} Object with x, y properties for scene coordinates
****************************************************************************/
function map_to_scene_coords_square(map_x, map_y) {
  if (typeof map === 'undefined' || !map || typeof mapview_model_width === 'undefined') {
    return { x: 0, y: 0 };
  }

  var tileWidth = mapview_model_width / map['xsize'];
  var tileHeight = mapview_model_height / map['ysize'];

  // For square maps, use MAP_X_OFFSET which is -500 (same as hex)
  var x_offset = (typeof MAP_X_OFFSET !== 'undefined') ? MAP_X_OFFSET : -500;

  // Calculate scene coordinates (direct mapping)
  var x = x_offset + map_x * tileWidth;
  var y = map_y * tileHeight;

  return { x: x, y: y };
}

/****************************************************************************
  Convert 3D scene coordinates to map tile coordinates for square maps.
  
  @param {number} scene_x - Scene X coordinate
  @param {number} scene_y - Scene Y coordinate  
  @returns {Object} Object with x, y properties for map tile coordinates
****************************************************************************/
function scene_to_map_coords_square(scene_x, scene_y) {
  if (typeof map === 'undefined' || !map || typeof mapview_model_width === 'undefined') {
    return { x: 0, y: 0 };
  }

  var tileWidth = mapview_model_width / map['xsize'];
  var tileHeight = mapview_model_height / map['ysize'];
  
  var x_offset = (typeof MAP_X_OFFSET !== 'undefined') ? MAP_X_OFFSET : -500;

  // Calculate map coordinates (inverse of map_to_scene_coords_square)
  var map_x = Math.floor((scene_x - x_offset) / tileWidth);
  var map_y = Math.floor(scene_y / tileHeight);

  // Clamp to valid range
  map_x = Math.max(0, Math.min(map_x, map['xsize'] - 1));
  map_y = Math.max(0, Math.min(map_y, map['ysize'] - 1));

  return { x: map_x, y: map_y };
}

/****************************************************************************
  Get the 8 neighbors of a tile in square topology.
  
  @param {number} tileX - Map X coordinate
  @param {number} tileY - Map Y coordinate
  @returns {Array} Array of neighbor objects with name, x, y properties
****************************************************************************/
function get_square_neighbors(tileX, tileY) {
  var neighbors = [
    { name: 'N', x: tileX, y: tileY - 1 },
    { name: 'NE', x: tileX + 1, y: tileY - 1 },
    { name: 'E', x: tileX + 1, y: tileY },
    { name: 'SE', x: tileX + 1, y: tileY + 1 },
    { name: 'S', x: tileX, y: tileY + 1 },
    { name: 'SW', x: tileX - 1, y: tileY + 1 },
    { name: 'W', x: tileX - 1, y: tileY },
    { name: 'NW', x: tileX - 1, y: tileY - 1 }
  ];
  
  return neighbors;
}

/****************************************************************************
  Log tile debug info for square maps.
  
  @param {number} tileX - Map X coordinate
  @param {number} tileY - Map Y coordinate
****************************************************************************/
function squareLogTile(tileX, tileY) {
  if (typeof map === 'undefined' || !map) {
    console.log('[SQUARE-DEBUG] Map not available');
    return null;
  }
  
  var tileWidth = mapview_model_width / map['xsize'];
  var tileHeight = mapview_model_height / map['ysize'];
  
  var sceneCoords = map_to_scene_coords_square(tileX, tileY);
  var backToMap = scene_to_map_coords_square(sceneCoords.x + tileWidth/2, sceneCoords.y + tileHeight/2);
  
  var ptile = map_pos_to_tile(tileX, tileY);
  var tileInfo = null;
  if (ptile) {
    tileInfo = {
      index: ptile.index,
      terrain: typeof tile_terrain !== 'undefined' && tile_terrain(ptile) ? tile_terrain(ptile).name : 'unknown'
    };
  }
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ SQUARE TILE DEBUG: (' + tileX + ', ' + tileY + ')');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║ Tile Size: ' + tileWidth.toFixed(2) + ' x ' + tileHeight.toFixed(2) + ' units');
  console.log('║ Scene Position: (' + sceneCoords.x.toFixed(2) + ', ' + sceneCoords.y.toFixed(2) + ')');
  console.log('║ Round-Trip Match: ' + (backToMap.x === tileX && backToMap.y === tileY));
  if (tileInfo) {
    console.log('║ Terrain: ' + tileInfo.terrain);
  }
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  return {
    tileCoords: { x: tileX, y: tileY },
    sceneCoords: sceneCoords,
    tileInfo: tileInfo
  };
}
