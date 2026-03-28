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
 * Mapview Common - Square Map Geometry and Rendering (LOD)
 *
 * Per-tile LOD: detail tiles (mountains, hills, forest, jungle) use
 * terrain_quality subdivisions; every other tile uses a single quad (Q=1).
 * LOD variables (lod_vertex_fine_pos etc.) are shared with the hex version
 * since only one topology is active at a time.
 */

/****************************************************************************
  Initialize land geometry with per-tile LOD subdivision (square topology).

  Fine-grid scale = terrain_quality (same as the heightmap resolution).
  Square tiles have no row stagger, so the mapping is straightforward:
    fix = tx * terrain_quality + sx * (terrain_quality / Q)
    fiy = ty * terrain_quality + sy * (terrain_quality / Q)
  UV.x = fix / (xsize * terrain_quality)
  UV.y = 1 − fiy / (ysize * terrain_quality)
****************************************************************************/
function init_land_geometry_square(geometry, mesh_quality)
{
  var Q_scale  = terrain_quality;
  var hm_res_x = map.xsize * Q_scale + 1;
  var seg_w    = mapview_model_width  / (map.xsize * Q_scale);
  var seg_h    = mapview_model_height / (map.ysize * Q_scale);
  var half_w   = mapview_model_width  / 2;
  var half_h   = mapview_model_height / 2;

  var vertices = [];
  var uvs      = [];
  var indices  = [];
  var finePos  = [];
  var hmIdxArr = [];

  var vi = 0;

  for (var ty = 0; ty < map.ysize; ty++) {
    for (var tx = 0; tx < map.xsize; tx++) {
      var Q    = get_tile_lod_q(tx, ty, mesh_quality);
      var step = Q_scale / Q;
      var tile_vi_start = vi;

      for (var sy = 0; sy <= Q; sy++) {
        for (var sx = 0; sx <= Q; sx++) {
          var fix = tx * Q_scale + sx * step;
          var fiy = ty * Q_scale + sy * step;

          var wx = fix * seg_w - half_w;
          var wy = fiy * seg_h - half_h;

          var hm_idx = fiy * hm_res_x + fix;
          var h = (heightmap && hm_idx < heightmap.length) ? heightmap[hm_idx] : 0;

          vertices.push(wx, -wy, h * 100);
          uvs.push(fix / (map.xsize * Q_scale));
          uvs.push(1 - fiy / (map.ysize * Q_scale));

          finePos.push(fix, fiy);
          hmIdxArr.push(hm_idx);
          vi++;
        }
      }

      for (var sy = 0; sy < Q; sy++) {
        for (var sx = 0; sx < Q; sx++) {
          var a = tile_vi_start + sy       * (Q + 1) + sx;
          var b = tile_vi_start + (sy + 1) * (Q + 1) + sx;
          var c = tile_vi_start + (sy + 1) * (Q + 1) + (sx + 1);
          var d = tile_vi_start + sy       * (Q + 1) + (sx + 1);
          indices.push(a, b, d);
          indices.push(b, c, d);
        }
      }
    }
  }

  var bufAttr = new THREE.Float32BufferAttribute(vertices, 3);
  if (mesh_quality <= 2) {
    lofibufferattribute      = bufAttr;
    lod_lofi_vertex_fine_pos = new Int32Array(finePos);
    lod_lofi_vertex_hm_idx   = new Int32Array(hmIdxArr);
  } else {
    landbufferattribute      = bufAttr;
    lod_vertex_fine_pos      = new Int32Array(finePos);
    lod_vertex_hm_idx        = new Int32Array(hmIdxArr);
  }

  geometry.setAttribute('position', bufAttr);
  geometry.setIndex(indices);
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();

  return geometry;
}

/****************************************************************************
  Update vertex positions of the LOD square terrain geometry.
****************************************************************************/
function update_land_geometry_square(geometry, mesh_quality) {
  var bufAttr  = mesh_quality <= 2 ? lofibufferattribute      : landbufferattribute;
  var finePosA = mesh_quality <= 2 ? lod_lofi_vertex_fine_pos : lod_vertex_fine_pos;
  var hmIdxA   = mesh_quality <= 2 ? lod_lofi_vertex_hm_idx   : lod_vertex_hm_idx;

  if (!bufAttr || !finePosA || !hmIdxA || !heightmap) return geometry;

  var Q_scale = terrain_quality;
  var seg_w   = mapview_model_width  / (map.xsize * Q_scale);
  var seg_h   = mapview_model_height / (map.ysize * Q_scale);
  var half_w  = mapview_model_width  / 2;
  var half_h  = mapview_model_height / 2;
  var hm_len  = heightmap.length;

  var nv = finePosA.length >> 1;
  for (var vi = 0; vi < nv; vi++) {
    var fix = finePosA[vi * 2];
    var fiy = finePosA[vi * 2 + 1];
    var wx = fix * seg_w - half_w;
    var wy = fiy * seg_h - half_h;
    var hm_idx = hmIdxA[vi];
    var h = (hm_idx < hm_len) ? heightmap[hm_idx] * 100 : 0;
    bufAttr.setXYZ(vi, wx, -wy, h);
  }

  bufAttr.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/****************************************************************************
  Get tile center offsets for square tiles (no offset needed)
****************************************************************************/
function getSquareCenterOffsets() {
  return { x: 0, y: 0 };
}

/****************************************************************************
  Update square center offsets (no-op for square tiles)
****************************************************************************/
function updateSquareCenterOffsets() {
  // Square tiles don't need center offsets
}
