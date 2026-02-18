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
 * Tile operations for the JavaScript server
 * 
 * This module handles tile-specific operations such as:
 * - Adding/removing improvements (irrigation, mines, roads, etc.)
 * - Changing tile resources
 * - Tile ownership changes
 * - Tile visibility updates
 */

/**************************************************************************
 * Add an improvement to a tile
 * 
 * @param {number} tileId - The ID of the tile
 * @param {number} extraId - The ID of the extra/improvement to add
 **************************************************************************/
function server_tile_add_extra(tileId, extraId) {
  if (!tiles || !tiles[tileId]) {
    console.log("[Server Tile] Error: Tile " + tileId + " does not exist");
    return false;
  }
  
  var tile = tiles[tileId];
  
  // Initialize extras array if it doesn't exist
  if (!tile.extras) {
    tile.extras = [];
  }
  
  // Check if extra already exists on this tile
  if (tile.extras.indexOf(extraId) !== -1) {
    console.log("[Server Tile] Extra " + extraId + " already exists on tile " + tileId);
    return false;
  }
  
  // Add the extra
  tile.extras.push(extraId);
  
  console.log("[Server Tile] Added extra " + extraId + " to tile " + tileId);
  return true;
}

/**************************************************************************
 * Remove an improvement from a tile
 * 
 * @param {number} tileId - The ID of the tile
 * @param {number} extraId - The ID of the extra/improvement to remove
 **************************************************************************/
function server_tile_remove_extra(tileId, extraId) {
  if (!tiles || !tiles[tileId]) {
    console.log("[Server Tile] Error: Tile " + tileId + " does not exist");
    return false;
  }
  
  var tile = tiles[tileId];
  
  if (!tile.extras) {
    console.log("[Server Tile] Tile " + tileId + " has no extras");
    return false;
  }
  
  var index = tile.extras.indexOf(extraId);
  if (index === -1) {
    console.log("[Server Tile] Extra " + extraId + " not found on tile " + tileId);
    return false;
  }
  
  // Remove the extra
  tile.extras.splice(index, 1);
  
  console.log("[Server Tile] Removed extra " + extraId + " from tile " + tileId);
  return true;
}

/**************************************************************************
 * Set the owner of a tile
 * 
 * @param {number} tileId - The ID of the tile
 * @param {number} playerId - The ID of the player who will own the tile
 **************************************************************************/
function server_tile_set_owner(tileId, playerId) {
  if (!tiles || !tiles[tileId]) {
    console.log("[Server Tile] Error: Tile " + tileId + " does not exist");
    return false;
  }
  
  tiles[tileId].owner = playerId;
  
  console.log("[Server Tile] Set owner of tile " + tileId + " to player " + playerId);
  return true;
}

/**************************************************************************
 * Get information about a tile
 * 
 * @param {number} tileId - The ID of the tile
 * @returns {object} Tile information
 **************************************************************************/
function server_tile_get_info(tileId) {
  if (!tiles || !tiles[tileId]) {
    console.log("[Server Tile] Error: Tile " + tileId + " does not exist");
    return null;
  }
  
  var tile = tiles[tileId];
  
  return {
    id: tileId,
    terrain: tile.terrain,
    owner: tile.owner || null,
    extras: tile.extras || [],
    resource: tile.resource || null,
    x: tile.x,
    y: tile.y
  };
}