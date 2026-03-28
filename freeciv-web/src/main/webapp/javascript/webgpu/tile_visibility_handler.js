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

// Persistent Float32Array for vertex color data.
// Reused across frames to avoid large typed-array GC pressure.
// A new Float32BufferAttribute wrapper is created each dirty frame so that
// Three.js WebGPU reliably re-uploads the buffer to the GPU.
var _vert_colors_buffer = null;

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
    // A tile reveal may change LOD structure (TILE_UNKNOWN → KNOWN exposes a
    // detail terrain type like Mountains or Hills for the first time).
    map_geometry_dirty = true;
    // Update visibility in maptiles texture for hex-aligned visibility boundaries
    update_tiletypes_visibility(new_tile);
  }

}


/**************************************************************************
 This will update the fog of war and unknown tiles, and farmland/irrigation
 by storing these as vertex colors in the landscape mesh.
 
 When LOD geometry is active (lod_vertex_tile_xy is set), each vertex has
 an explicit owning tile recorded by init_land_geometry(), so the color
 buffer is rebuilt directly from that mapping.  This ensures visibility
 colors are correct immediately after a LOD geometry rebuild.

 For the regular uniform grid the existing floor-based tile lookup is used.
**************************************************************************/
function update_tiles_known_vertex_colors()
{
  // LOD path: per-vertex tile coordinates are stored in lod_vertex_tile_xy.
  if (typeof lod_vertex_tile_xy !== 'undefined' && lod_vertex_tile_xy !== null) {
    var nv = lod_vertex_tile_xy.length >> 1;
    if (_vert_colors_buffer === null || _vert_colors_buffer.length !== nv * 3) {
      _vert_colors_buffer = new Float32Array(nv * 3);
    }
    var idx = 0;
    for (var vi = 0; vi < nv; vi++) {
      var tx    = lod_vertex_tile_xy[vi * 2];
      var ty    = lod_vertex_tile_xy[vi * 2 + 1];
      var ptile = map_pos_to_tile(tx, ty);
      var c     = ptile ? get_vertex_color_from_tile(ptile, tx, ty) : [0, 0, 0];
      _vert_colors_buffer[idx]     = c[0];
      _vert_colors_buffer[idx + 1] = c[1];
      _vert_colors_buffer[idx + 2] = c[2];
      idx += 3;
    }
    landGeometry.setAttribute('vertColor', new THREE.Float32BufferAttribute(_vert_colors_buffer, 3));
    landGeometry.colorsNeedUpdate = true;
    return;
  }

  // Uniform-grid path (terrain_quality <= 1 or non-LOD geometry).
  const xquality = map.xsize * terrain_quality + 1;
  const yquality = map.ysize * terrain_quality + 1;
  const gridX = Math.floor(xquality);
  const gridY = Math.floor(yquality);

  const gridX1 = gridX + 1;
  const gridY1 = gridY + 1;
  const total = gridX1 * gridY1;

  // Lazily allocate (or reallocate on map-size change) the persistent buffer.
  // Writing directly into a Float32Array avoids the JS-array resize overhead
  // of push() across tens-of-thousands of vertices during bulk tile reveals.
  if (_vert_colors_buffer === null || _vert_colors_buffer.length !== total * 3) {
    _vert_colors_buffer = new Float32Array(total * 3);
  }

  let idx = 0;
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
          _vert_colors_buffer[idx]     = c[0];
          _vert_colors_buffer[idx + 1] = c[1];
          _vert_colors_buffer[idx + 2] = c[2];
        } else {
          _vert_colors_buffer[idx]     = 0;
          _vert_colors_buffer[idx + 1] = 0;
          _vert_colors_buffer[idx + 2] = 0;
        }
        idx += 3;
    }
  }

  // Always pass a new Float32BufferAttribute wrapping the pre-allocated buffer.
  // Three.js WebGPU tracks attributes by object identity, so a new wrapper
  // guarantees the GPU buffer is re-uploaded every dirty frame.
  landGeometry.setAttribute( 'vertColor', new THREE.Float32BufferAttribute( _vert_colors_buffer, 3 ) );

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
