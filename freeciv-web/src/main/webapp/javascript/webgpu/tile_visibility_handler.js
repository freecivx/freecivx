/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.freecivx.com/
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
var vertex_colors_buffer = null;  // Pre-allocated Float32Array, reused each update

// Visibility colour values used as the red channel of the 'vertColor' vertex attribute.
// The terrain fragment shader interprets these thresholds:
//   >= ~1.0  → fully visible (TILE_KNOWN_SEEN) or highlighted city tile
//   ~0.54    → fogged (TILE_KNOWN_UNSEEN)
//   0        → completely unknown
//   ~0.30    → city work-radius tile (dimmed when active-city overlay is shown)
var VERTCOLOR_VISIBLE  = 1.06;
var VERTCOLOR_FOGGED   = 0.54;
var VERTCOLOR_WORKABLE = 0.30;
var VERTCOLOR_UNKNOWN  = 0;

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
    // Update visibility in maptiles texture for hex-aligned visibility boundaries
    update_tiletypes_visibility(new_tile);
  }

}


/**************************************************************************
 This will update the fog of war and unknown tiles, and farmland/irrigation
 by storing these as vertex colors in the landscape mesh.
 
 For hexagonal maps, we need to account for the staggered row layout when
 determining which tile a vertex belongs to. Odd rows are offset by half
 a tile width (odd-r offset coordinate system).

 Uses a pre-allocated Float32Array (vertex_colors_buffer) to avoid repeated
 large heap allocations when many tiles change at once (e.g. full map reveal
 at game end). The buffer and its BufferAttribute are created once, then
 updated in-place on subsequent calls.
**************************************************************************/
function update_tiles_known_vertex_colors()
{
  if (landGeometry == null) return;

  const xquality = map.xsize * terrain_quality + 1;
  const yquality = map.ysize * terrain_quality + 1;
  const gridX1 = Math.floor(xquality) + 1;
  const gridY1 = Math.floor(yquality) + 1;
  const total   = gridX1 * gridY1;

  // Allocate once; re-allocate only if map size changed.
  if (vertex_colors_buffer == null || vertex_colors_buffer.length !== total * 3) {
    vertex_colors_buffer = new Float32Array(total * 3);
    landGeometry.setAttribute('vertColor', new THREE.Float32BufferAttribute(vertex_colors_buffer, 3));
  }

  // Cache active-city state to avoid repeated lookups inside the hot loop.
  const has_active_city   = (active_city != null);
  const active_ctile_idx  = has_active_city ? city_tile(active_city)['index'] : -1;

  for (let iy = 0; iy < gridY1; iy++) {
    for (let ix = 0; ix < gridX1; ix++) {
      const sx = ix % xquality;
      const sy = iy % yquality;

      // Calculate map tile coordinates from vertex position.
      // For hex maps, odd rows are staggered by HEX_STAGGER (0.5).
      const my = Math.floor((sy / terrain_quality) - 0.040);
      const hex_stagger_offset = (my % 2 === 1) ? 0.5 : 0;
      const mx = Math.floor((sx / terrain_quality) - hex_stagger_offset - 0.040);

      const ptile  = map_pos_to_tile(mx, my);
      const offset = (iy * gridX1 + ix) * 3;

      if (ptile != null) {
        const known = tile_get_known(ptile);
        let c;
        if (known == TILE_KNOWN_SEEN) {
          c = VERTCOLOR_VISIBLE;
        } else if (known == TILE_KNOWN_UNSEEN) {
          c = VERTCOLOR_FOGGED;
        } else {
          c = VERTCOLOR_UNKNOWN;
        }

        // Highlight active city workable tiles.
        if (has_active_city && (known == TILE_KNOWN_SEEN || known == TILE_KNOWN_UNSEEN)) {
          if (ptile['index'] == active_ctile_idx) {
            c = VERTCOLOR_VISIBLE;
          } else if (is_city_tile(ptile, active_city)) {
            c = VERTCOLOR_VISIBLE;
          } else {
            c = VERTCOLOR_WORKABLE;
          }
        }

        vertex_colors_buffer[offset]     = c;
        vertex_colors_buffer[offset + 1] = 0;
        vertex_colors_buffer[offset + 2] = 0;
      } else {
        vertex_colors_buffer[offset]     = 0;
        vertex_colors_buffer[offset + 1] = 0;
        vertex_colors_buffer[offset + 2] = 0;
      }
    }
  }

  const attr = landGeometry.getAttribute('vertColor');
  if (attr) attr.needsUpdate = true;
}


/**************************************************************************
 Returns the vertex color value for a tile. The value is used to
 set visibility (fog-of-war) in the terrain fragment shader.
**************************************************************************/
function get_vertex_color_from_tile(ptile, vertex_x, vertex_y)
{
    var known_status_color = VERTCOLOR_UNKNOWN;
    if (tile_get_known(ptile) == TILE_KNOWN_SEEN) {
      known_status_color = VERTCOLOR_VISIBLE;

    } else if (tile_get_known(ptile) == TILE_KNOWN_UNSEEN) {
      known_status_color = VERTCOLOR_FOGGED;
    } else if (tile_get_known(ptile) == TILE_UNKNOWN) {
      known_status_color = VERTCOLOR_UNKNOWN;
    }

    if (active_city != null && ptile != null && (tile_get_known(ptile) == TILE_KNOWN_SEEN || tile_get_known(ptile) == TILE_KNOWN_UNSEEN)) {
      // Hightlight active city
      var ctile = city_tile(active_city);
      if (ptile['index'] == ctile['index']) {
        known_status_color = VERTCOLOR_VISIBLE;
      } else if (is_city_tile(ptile, active_city)) {
        known_status_color = VERTCOLOR_VISIBLE;
      } else {
        known_status_color = VERTCOLOR_WORKABLE;
      }
    }

    return [known_status_color, 0,0];

}
