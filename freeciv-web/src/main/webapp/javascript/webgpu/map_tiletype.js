/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2016  The Freeciv-web project

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

var maptiletypes;
var maptiles_data;

// Deferred texture update system for batching bulk tile operations
var maptiles_needs_update = false;
var maptiles_update_pending = false;

/****************************************************************************
  Returns a texture containing each map tile, where the color of each pixel
  indicates which Freeciv tile type the pixel is.
****************************************************************************/
function init_map_tiletype_image()
{
  maptiles_data = new Uint8Array( 4 * map.xsize * map.ysize );

  maptiletypes = new THREE.DataTexture(maptiles_data, map.xsize, map.ysize);
  maptiletypes.flipY = true;
  // Use NearestFilter for WebGPU compatibility with non-power-of-two textures
  // This ensures proper sampler binding for discrete tile data
  maptiletypes.minFilter = THREE.NearestFilter;
  maptiletypes.magFilter = THREE.NearestFilter;
  maptiletypes.generateMipmaps = false;

  for (let x = 0; x < map.xsize; x++) {
    for (let y = 0; y < map.ysize; y++) {
      let index = (y * map.xsize + x) * 4;
      maptiles_data[index] = 0;
      maptiles_data[index + 1] = 0;
      maptiles_data[index + 2] = 0;
      maptiles_data[index + 3] = 0;
    }
  }

 }

/****************************************************************************
  ...
****************************************************************************/
function update_tiletypes_tile(ptile)
{
  let x = ptile.x;
  let y = ptile.y;
  let index = (y * map.xsize + x) * 4;
  if (ptile != null && tile_terrain(ptile) != null && !tile_has_extra(ptile, EXTRA_RIVER)) {
    maptiles_data[index] = tile_terrain(ptile)['id'] * 10;
    maptiles_data[index + 1] = 0;
  } else if (ptile != null && tile_terrain(ptile) != null && tile_has_extra(ptile, EXTRA_RIVER)) {
    maptiles_data[index] = tile_terrain(ptile)['id'] * 10;
    maptiles_data[index + 1] = 10;
  } else {
    maptiles_data[index] = tile_terrain(ptile)['id'] * 10;
    maptiles_data[index + 1] = 10;
  }
  if (tile_has_extra(ptile, EXTRA_FARMLAND)) {
    maptiles_data[index + 2] = 2;
  } else if (tile_has_extra(ptile, EXTRA_IRRIGATION)) {
    maptiles_data[index + 2] = 1;
  } else {
    maptiles_data[index + 2] = 0;
  }

  // Store visibility in alpha channel for hexagonal visibility edges
  // Visibility values (matching terrain shader constants):
  // - 0 = TILE_UNKNOWN (black)
  // - 138 (≈0.541 * 255) = TILE_KNOWN_UNSEEN (fogged)
  // - 255 (1.0 * 255) = TILE_KNOWN_SEEN (visible)
  // The shader will sample this at hex tile center to create hex-aligned visibility boundaries
  if (typeof tile_get_known !== 'undefined') {
    let known_status = tile_get_known(ptile);
    if (known_status == TILE_KNOWN_SEEN) {
      maptiles_data[index + 3] = 255;  // Fully visible
    } else if (known_status == TILE_KNOWN_UNSEEN) {
      maptiles_data[index + 3] = 138;  // Fogged (0.54 * 255 ≈ 138)
    } else {
      maptiles_data[index + 3] = 0;    // Unknown
    }
  } else {
    maptiles_data[index + 3] = 0;
  }

  // Use deferred update to batch multiple tile updates
  schedule_maptiles_texture_update();
}

/****************************************************************************
  Schedule a deferred texture update. This batches multiple tile updates
  into a single texture upload, significantly improving performance during
  bulk operations like revealing the entire map at game end.
****************************************************************************/
function schedule_maptiles_texture_update()
{
  maptiles_needs_update = true;
  
  // Schedule update for next animation frame if not already pending
  if (!maptiles_update_pending) {
    maptiles_update_pending = true;
    requestAnimationFrame(flush_maptiles_texture_update);
  }
}

/****************************************************************************
  Flush pending texture updates. Called on next animation frame to
  batch all tile modifications into a single GPU upload.
****************************************************************************/
function flush_maptiles_texture_update()
{
  maptiles_update_pending = false;
  if (maptiles_needs_update && maptiletypes != null) {
    maptiletypes.needsUpdate = true;
    maptiles_needs_update = false;
  }
}

/****************************************************************************
  Updates just the visibility information for a tile in the maptiles texture.
  Called when tile visibility changes (fog of war updates).
****************************************************************************/
function update_tiletypes_visibility(ptile)
{
  if (ptile == null || maptiles_data == null) return;
  
  let x = ptile.x;
  let y = ptile.y;
  let index = (y * map.xsize + x) * 4;
  
  // Update alpha channel with visibility
  if (typeof tile_get_known !== 'undefined') {
    let known_status = tile_get_known(ptile);
    if (known_status == TILE_KNOWN_SEEN) {
      maptiles_data[index + 3] = 255;  // Fully visible
    } else if (known_status == TILE_KNOWN_UNSEEN) {
      maptiles_data[index + 3] = 138;  // Fogged
    } else {
      maptiles_data[index + 3] = 0;    // Unknown
    }
  }
  
  // Use deferred update to batch multiple visibility updates
  schedule_maptiles_texture_update();
}
