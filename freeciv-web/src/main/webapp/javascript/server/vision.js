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
 * Vision and fog of war management for the JavaScript server
 * 
 * This module handles:
 * - Tile visibility calculation based on unit/city vision
 * - Fog of war state management
 * - Vision updates when units move
 */

/**************************************************************************
 * Get the vision radius for a unit type
 * 
 * Vision radius squared is the distance a unit can see.
 * Most basic units can see 2 tiles (vision_radius_sq = 5)
 * Explorers and some advanced units can see further.
 * 
 * @param {number} unit_type_id - The unit type ID
 * @returns {number} Vision radius squared
 **************************************************************************/
function server_get_unit_vision_radius(unit_type_id) {
  // Get unit type from the global unit_types array
  if (unit_types && unit_types[unit_type_id]) {
    var vision = unit_types[unit_type_id]['vision_radius_sq'];
    if (vision !== undefined) {
      return vision;
    }
  }
  
  // Default vision radius squared (2 tiles = radius squared of 5)
  // This matches standard Freeciv rules
  return 5;
}

/**************************************************************************
 * Calculate if a tile is within vision range of a center tile
 * 
 * Uses vision_radius_sq to determine if target tile is visible from center.
 * In Freeciv, vision_radius_sq represents the squared distance.
 * Handles map wrapping correctly.
 * 
 * @param {number} center_x - X coordinate of viewing position
 * @param {number} center_y - Y coordinate of viewing position
 * @param {number} target_x - X coordinate of target tile
 * @param {number} target_y - Y coordinate of target tile
 * @param {number} vision_radius_sq - Vision radius squared
 * @returns {boolean} True if target is visible from center
 **************************************************************************/
function server_tile_is_in_vision(center_x, center_y, target_x, target_y, vision_radius_sq) {
  // Calculate distance considering map wrapping
  var dx = target_x - center_x;
  var dy = target_y - center_y;
  
  // Handle map wrapping for X coordinate
  if (wrap_has_flag(WRAP_X)) {
    var half_world = Math.floor(map.xsize / 2);
    dx = FC_WRAP(dx + half_world, map.xsize) - half_world;
  }
  
  // Handle map wrapping for Y coordinate
  if (wrap_has_flag(WRAP_Y)) {
    var half_world = Math.floor(map.ysize / 2);
    dy = FC_WRAP(dy + half_world, map.ysize) - half_world;
  }
  
  // Calculate squared distance
  // For now using simple Euclidean distance (works for square maps)
  // TODO: Use map_vector_to_sq_distance for hex/iso topologies
  var dist_sq = dx * dx + dy * dy;
  
  return dist_sq <= vision_radius_sq;
}

/**************************************************************************
 * Reveal a tile to a player
 * 
 * Updates the tile visibility state and sends the update to the client.
 * This reveals the tile's terrain, resources, and current state.
 * 
 * @param {number} tile_index - The tile index to reveal
 * @param {number} player_id - The player ID who should see the tile
 * @param {boolean} seen - If true, mark as TILE_KNOWN_SEEN, else TILE_KNOWN_UNSEEN
 **************************************************************************/
function server_reveal_tile(tile_index, player_id, seen) {
  var ptile = index_to_tile(tile_index);
  if (!ptile) {
    console.error("[Server Vision] Cannot reveal tile - invalid tile index: " + tile_index);
    return;
  }
  
  // Set the visibility state
  var known_state = seen ? TILE_KNOWN_SEEN : TILE_KNOWN_UNSEEN;
  
  // Only update if the visibility changed
  if (ptile['known'] !== known_state) {
    // Update the tile and send to client
    handle_tile_info({
      tile: tile_index,
      x: ptile.x,
      y: ptile.y,
      terrain: ptile.terrain,
      known: known_state,
      extras: ptile.extras ? ptile.extras.toBitSet() : [],
      height: ptile.height || 0
    });
  }
}

/**************************************************************************
 * Reveal tiles within vision radius of a position
 * 
 * This is called when units or cities are created/moved to reveal
 * surrounding tiles to the owning player.
 * Handles map wrapping correctly for both X and Y wrapped maps.
 * 
 * @param {number} center_x - X coordinate of viewing position
 * @param {number} center_y - Y coordinate of viewing position
 * @param {number} vision_radius_sq - Vision radius squared
 * @param {number} player_id - The player ID who should see the tiles
 **************************************************************************/
function server_reveal_tiles_in_radius(center_x, center_y, vision_radius_sq, player_id) {
  if (!map || !map.xsize || !map.ysize) {
    console.error("[Server Vision] Map not initialized");
    return;
  }
  
  // Calculate the actual radius from vision_radius_sq
  var radius = Math.ceil(Math.sqrt(vision_radius_sq));
  
  // Iterate over all tiles in the bounding box
  for (var dy = -radius; dy <= radius; dy++) {
    for (var dx = -radius; dx <= radius; dx++) {
      var target_x = center_x + dx;
      var target_y = center_y + dy;
      
      // Handle map wrapping for X coordinate
      if (wrap_has_flag(WRAP_X)) {
        target_x = FC_WRAP(target_x, map.xsize);
      } else if (target_x < 0 || target_x >= map.xsize) {
        // Skip tiles outside map bounds if not wrapping
        continue;
      }
      
      // Handle map wrapping for Y coordinate
      if (wrap_has_flag(WRAP_Y)) {
        target_y = FC_WRAP(target_y, map.ysize);
      } else if (target_y < 0 || target_y >= map.ysize) {
        // Skip tiles outside map bounds if not wrapping
        continue;
      }
      
      // Check if tile is within vision range
      if (server_tile_is_in_vision(center_x, center_y, target_x, target_y, vision_radius_sq)) {
        var tile_index = target_x + target_y * map.xsize;
        server_reveal_tile(tile_index, player_id, true);
      }
    }
  }
}

/**************************************************************************
 * Update fog of war for a player
 * 
 * This function marks all tiles as either SEEN (currently visible by a unit/city)
 * or UNSEEN (fogged - was visible before but not now) or UNKNOWN (never seen).
 * 
 * Should be called after unit movement or at the start of a player's turn.
 * 
 * @param {number} player_id - The player ID to update vision for
 **************************************************************************/
function server_update_player_vision(player_id) {
  if (!map || !map.xsize || !map.ysize) {
    console.error("[Server Vision] Map not initialized");
    return;
  }
  
  console.log("[Server Vision] Updating vision for player " + player_id);
  
  // First pass: Mark all currently SEEN tiles as UNSEEN (fogged)
  // This ensures proper fog of war - tiles that were seen but aren't currently visible
  for (var tile_index in tiles) {
    var ptile = tiles[tile_index];
    if (ptile && ptile['known'] === TILE_KNOWN_SEEN) {
      handle_tile_info({
        tile: parseInt(tile_index),
        x: ptile.x,
        y: ptile.y,
        terrain: ptile.terrain,
        known: TILE_KNOWN_UNSEEN,  // Fog it
        extras: ptile.extras ? ptile.extras.toBitSet() : [],
        height: ptile.height || 0
      });
    }
  }
  
  // Second pass: Reveal tiles visible by units
  if (server_units) {
    for (var unit_id in server_units) {
      var punit = server_units[unit_id];
      if (punit && punit.owner === player_id) {
        var unit_tile = index_to_tile(punit.tile);
        if (unit_tile) {
          var vision_radius_sq = server_get_unit_vision_radius(punit.type);
          server_reveal_tiles_in_radius(unit_tile.x, unit_tile.y, vision_radius_sq, player_id);
        }
      }
    }
  }
  
  // Third pass: Reveal tiles visible by cities
  if (server_cities) {
    for (var city_id in server_cities) {
      var pcity = server_cities[city_id];
      if (pcity && pcity.owner === player_id) {
        var city_tile = index_to_tile(pcity.tile);
        if (city_tile) {
          // Cities have vision radius squared of 5 (can see 2 tiles out)
          // This matches standard Freeciv rules
          server_reveal_tiles_in_radius(city_tile.x, city_tile.y, 5, player_id);
        }
      }
    }
  }
  
  console.log("[Server Vision] Vision update complete for player " + player_id);
}

/**************************************************************************
 * Initialize vision for all players at game start
 * 
 * This reveals the tiles around each player's starting units and cities.
 * Called after map generation and unit/city placement is complete.
 **************************************************************************/
function server_initialize_all_vision() {
  console.log("[Server Vision] Initializing vision for all players");
  
  // Update vision for each player
  for (var player_id in players) {
    server_update_player_vision(parseInt(player_id));
  }
  
  console.log("[Server Vision] Vision initialization complete");
}
