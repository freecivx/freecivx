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

var map_known_dirty = true;
var map_geometry_dirty = true;

// Reusable buffer for vertex colors to avoid GC pressure during bulk updates
var vertColorBuffer = null;
var vertColorAttribute = null;

// Deferred update system for batching bulk visibility operations
// This prevents multiple expensive full-mesh iterations during bulk map reveals
var visibility_update_pending = false;

/**************************************************************************
 Updates the terrain vertex colors to set tile to known, unknown or fogged.
 Also updates the maptiles texture visibility for hexagonal edge rendering.
**************************************************************************/
function webgl_update_tile_known(old_tile, new_tile)
{
  if (new_tile == null || old_tile == null || landGeometry == null) return;

  if (new_tile['height'] != old_tile['height']) {
    map_geometry_dirty = true;
  }

  if (tile_get_known(new_tile) != tile_get_known(old_tile)) {
    map_known_dirty = true;
    // Schedule deferred visibility update to batch multiple tile changes
    schedule_visibility_update();
    // Update visibility in maptiles texture for hex-aligned visibility boundaries
    if (typeof update_tiletypes_visibility !== 'undefined') {
      update_tiletypes_visibility(new_tile);
    }
  }

}

/**************************************************************************
  Schedule a deferred visibility vertex color update. This batches multiple
  tile visibility changes into a single vertex buffer update, significantly
  improving performance during bulk operations like revealing the entire
  map at game end.
**************************************************************************/
function schedule_visibility_update()
{
  // Schedule update for next animation frame if not already pending
  if (!visibility_update_pending) {
    visibility_update_pending = true;
    requestAnimationFrame(flush_visibility_update);
  }
}

/**************************************************************************
  Flush pending visibility updates. Called on next animation frame to
  batch all visibility modifications into a single vertex buffer update.
  This is the performance-critical optimization that prevents multiple
  expensive full-mesh iterations during bulk map reveals.
  
  Note: JavaScript is single-threaded, so there's no true race condition.
  We clear map_known_dirty before processing to ensure any updates that
  arrive during processing will schedule another flush.
**************************************************************************/
function flush_visibility_update()
{
  visibility_update_pending = false;
  if (map_known_dirty && landGeometry != null) {
    // Clear flag first so any new updates during processing will re-schedule
    map_known_dirty = false;
    update_tiles_known_vertex_colors();
  }
}


/**************************************************************************
 This will update the fog of war and unknown tiles, and farmland/irrigation
 by storing these as vertex colors in the landscape mesh.
 
 For hexagonal maps, we need to account for the staggered row layout when
 determining which tile a vertex belongs to. Odd rows are offset by half
 a tile width (odd-r offset coordinate system).
 
 PERFORMANCE OPTIMIZATION: Reuses a pre-allocated Float32Array buffer
 instead of creating a new one each update. This significantly reduces
 GC pressure during bulk map reveals (e.g., game end).
**************************************************************************/
function update_tiles_known_vertex_colors()
{
  const xquality = map.xsize * terrain_quality + 1;
  const yquality = map.ysize * terrain_quality + 1;
  const gridX = Math.floor(xquality);
  const gridY = Math.floor(yquality);

  const gridX1 = gridX + 1;
  const gridY1 = gridY + 1;
  const totalVertices = gridX1 * gridY1;
  const bufferSize = totalVertices * 3;

  // Reuse existing buffer if size matches, otherwise create new one
  if (vertColorBuffer === null || vertColorBuffer.length !== bufferSize) {
    vertColorBuffer = new Float32Array(bufferSize);
    vertColorAttribute = null; // Force new attribute creation
  }

  let bufferIndex = 0;
  for ( let iy = 0; iy < gridY1; iy ++ ) {
    for ( let ix = 0; ix < gridX1; ix ++ ) {
        var sx = ix % xquality, sy = iy % yquality;
        
        // Calculate map tile coordinates from vertex position
        // For hex maps, we need to account for the row stagger in the mesh geometry
        var my = Math.floor((sy / terrain_quality) - 0.040);
        
        // For hex grids, odd rows in the mesh are staggered by HEX_STAGGER (0.5)
        // We need to subtract this offset when looking up the tile X coordinate
        var hex_stagger_offset = (my % 2 === 1) ? 0.5 : 0;
        var mx = Math.floor((sx / terrain_quality) - hex_stagger_offset - 0.040);
        
        var ptile = map_pos_to_tile(mx, my);
        if (ptile != null) {
          var c = get_vertex_color_from_tile(ptile, ix, iy);
          vertColorBuffer[bufferIndex++] = c[0];
          vertColorBuffer[bufferIndex++] = c[1];
          vertColorBuffer[bufferIndex++] = c[2];
        } else {
          vertColorBuffer[bufferIndex++] = 0;
          vertColorBuffer[bufferIndex++] = 0;
          vertColorBuffer[bufferIndex++] = 0;
        }
    }
  }

  // Reuse existing attribute if possible, just update the data
  if (vertColorAttribute === null) {
    vertColorAttribute = new THREE.Float32BufferAttribute(vertColorBuffer, 3);
    landGeometry.setAttribute('vertColor', vertColorAttribute);
  } else {
    // Copy data to the existing attribute's array
    vertColorAttribute.array.set(vertColorBuffer);
    vertColorAttribute.needsUpdate = true;
  }

  landGeometry.colorsNeedUpdate = true;
}


/**************************************************************************
 Returns the vertex colors (THREE.Color) of a tile. The color is used to
 set terrain type in the terrain fragment shader.
**************************************************************************/
function get_vertex_color_from_tile(ptile, vertex_x, vertex_y)
{
    var known_status_color = 0;
    if (tile_get_known(ptile) == TILE_KNOWN_SEEN) {
      known_status_color = 1.06;

    } else if (tile_get_known(ptile) == TILE_KNOWN_UNSEEN) {
      known_status_color = 0.54;
    } else if (tile_get_known(ptile) == TILE_UNKNOWN) {
      known_status_color = 0;
    }

    if (active_city != null && ptile != null && (tile_get_known(ptile) == TILE_KNOWN_SEEN || tile_get_known(ptile) == TILE_KNOWN_UNSEEN)) {
      // Hightlight active city
      var ctile = city_tile(active_city);
      if (ptile['index'] == ctile['index']) {
        known_status_color = 1.06;
      } else if (is_city_tile(ptile, active_city)) {
        known_status_color = 1.06;
      } else {
        known_status_color = 0.30;
      }
    }

    return [known_status_color, 0,0];

}
