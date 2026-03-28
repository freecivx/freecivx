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
 * Mapview Common - Hexagonal Map Geometry and Rendering
 * 
 * This module handles the creation and update of the terrain mesh with
 * hexagonal tile topology. Key features:
 * - Staggered row layout (odd rows offset by half tile width)
 * - Proper UV coordinate mapping for hex tile sampling
 * - Height-based terrain with interpolation between hex neighbors
 */

var container, stats;
var scene = null;
var maprenderer = null;
var anaglyph_effect;

var mouse, raycaster;
var spotlight;
var directionalLight;
var timer;

var controls = null;

var tiletype_terrains = ["coast","ocean","desert","grassland","hills","mountains","plains","swamp","forest","jungle"];

var landGeometry;
var landMesh;
var water_hq;

var lofiGeometry;
var lofiMesh;
var freeciv_uniforms;
var terrain_material;

var landbufferattribute;
var lofibufferattribute;

var mapview_model_width;
var mapview_model_height;

var MAPVIEW_ASPECT_FACTOR = 35.71;

// Hexagonal tile constants for offset coordinate system (odd-r: odd rows shifted right)
var HEX_WIDTH_FACTOR = (typeof window !== 'undefined' && window.HexConfig) ? window.HexConfig.WIDTH_FACTOR : 1.0;
var HEX_HEIGHT_FACTOR = (typeof window !== 'undefined' && window.HexConfig) ? window.HexConfig.HEIGHT_FACTOR : Math.sqrt(3) / 2;
var HEX_STAGGER = (typeof window !== 'undefined' && window.HexConfig) ? window.HexConfig.STAGGER : 0.5;

// ---------------------------------------------------------------------------
// LOD (Level-of-Detail) geometry tracking
//
// Detail tiles (mountains, hills, forest, jungle) are rendered at full
// terrain_quality subdivisions.  Every other tile (flat land, ocean, unknown)
// uses a single quad (Q=1) – giving a real reduction in vertex / triangle
// count proportional to the fraction of flat tiles on the map.
//
// Per-vertex fine-grid positions [fix0,fiy0, fix1,fiy1, …] are stored so
// that update_land_geometry() can recompute world positions and z-heights
// cheaply without rebuilding the index / UV buffers.
// ---------------------------------------------------------------------------
var lod_vertex_fine_pos      = null;   // main mesh: Int32Array [fix, fiy …]
var lod_lofi_vertex_fine_pos = null;   // lofi mesh: Int32Array [fix, fiy …]
var lod_vertex_hm_idx        = null;   // main mesh: Int32Array heightmap indices
var lod_lofi_vertex_hm_idx   = null;   // lofi mesh: Int32Array heightmap indices
var lod_structure_hash       = -1;     // changes when tile detail-level changes

/****************************************************************************
  Returns true when a tile needs full-quality (terrain_quality) subdivision.
  Flat land, ocean and unknown tiles use a single quad instead.
****************************************************************************/
function is_detail_tile_lod(tx, ty) {
  if (tx < 0 || tx >= map.xsize || ty < 0 || ty >= map.ysize) return false;
  var ptile = map_pos_to_tile(tx, ty);
  if (ptile == null || tile_get_known(ptile) == TILE_UNKNOWN) return false;
  var n = tile_terrain(ptile)['name'];
  return n === "Mountains" || n === "Hills" || n === "Forest" || n === "Jungle";
}

/****************************************************************************
  Returns the LOD subdivision count Q for one tile.
  lofi mesh (mesh_quality <= 2): always Q=1.
  main mesh: terrain_quality for detail tiles, 1 for everything else.
****************************************************************************/
function get_tile_lod_q(tx, ty, mesh_quality) {
  if (mesh_quality <= 2) return 1;
  return is_detail_tile_lod(tx, ty) ? mesh_quality : 1;
}

/****************************************************************************
  Hash of which tiles are detail vs flat.  Used to detect topology changes
  that require a full geometry rebuild (e.g. when a tile is first revealed).
****************************************************************************/
function compute_lod_structure_hash() {
  var h = 0;
  for (var ty = 0; ty < map.ysize; ty++) {
    for (var tx = 0; tx < map.xsize; tx++) {
      if (is_detail_tile_lod(tx, ty)) h = (h + tx * 1000003 + ty * 7 + 1) | 0;
    }
  }
  return h;
}

/****************************************************************************
  Initialize land geometry with per-tile LOD subdivision (hex topology).

  Each tile independently contributes (Q+1)² vertices and Q²×2 triangles,
  where Q = get_tile_lod_q(tx, ty, mesh_quality).

  All vertex positions are stored in fine-grid coordinates so that
  update_land_geometry() can update only the z (height) component cheaply.

  Fine-grid scale = terrain_quality  (the heightmap resolution per tile).
  For tile (tx,ty) sub-vertex (sx,sy) at tile quality Q:
    fix = tx * terrain_quality + sx * (terrain_quality / Q)
    fiy = ty * terrain_quality + sy * (terrain_quality / Q)
  UV.x = (fix + hex_stagger(fiy)) / (xsize * terrain_quality)
  UV.y = 1 − fiy / (ysize * terrain_quality)
****************************************************************************/
function init_land_geometry(geometry, mesh_quality)
{
  var Q_scale   = terrain_quality;            // fine-grid cells per tile
  var hm_res_x  = map.xsize * Q_scale + 1;   // matches init_heightmap resolution
  var seg_w     = mapview_model_width  / (map.xsize * Q_scale);
  var seg_h     = (mapview_model_height / (map.ysize * Q_scale)) * HEX_HEIGHT_FACTOR;
  var half_w    = mapview_model_width  / 2;
  var half_h    = mapview_model_height / 2;

  var vertices  = [];
  var uvs       = [];
  var indices   = [];
  var finePos   = [];   // [fix, fiy] pairs for every vertex
  var hmIdxArr  = [];   // heightmap array index for every vertex

  var vi = 0;  // running vertex index

  for (var ty = 0; ty < map.ysize; ty++) {
    for (var tx = 0; tx < map.xsize; tx++) {
      var Q    = get_tile_lod_q(tx, ty, mesh_quality);
      var step = Q_scale / Q;   // fine-grid steps per subdivision step
      var tile_vi_start = vi;

      for (var sy = 0; sy <= Q; sy++) {
        for (var sx = 0; sx <= Q; sx++) {
          var fix = tx * Q_scale + sx * step;
          var fiy = ty * Q_scale + sy * step;

          var row_stagger = (fiy % 2 === 1) ? seg_w * HEX_STAGGER : 0;
          var wx = fix * seg_w - half_w + row_stagger;
          var wy = fiy * seg_h - half_h;

          var hm_idx = fiy * hm_res_x + fix;
          var h = (heightmap && hm_idx < heightmap.length) ? heightmap[hm_idx] : 0;

          vertices.push(wx, -wy, h * 100);

          var uv_stagger = (fiy % 2 === 1) ? HEX_STAGGER : 0;
          uvs.push((fix + uv_stagger) / (map.xsize * Q_scale));
          uvs.push(1 - fiy / (map.ysize * Q_scale));

          finePos.push(fix, fiy);
          hmIdxArr.push(hm_idx);
          vi++;
        }
      }

      // Q×Q quads → Q×Q×2 triangles
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
  Update vertex positions of the LOD hex terrain geometry.

  X and Y are recomputed from the stored fine-grid coordinates so the
  function is safe to call after rotateX / translate have been applied
  (those permanent transforms are re-applied by update_map_terrain_geometry
  immediately after this call).
****************************************************************************/
function update_land_geometry(geometry, mesh_quality) {
  var bufAttr  = mesh_quality <= 2 ? lofibufferattribute      : landbufferattribute;
  var finePosA = mesh_quality <= 2 ? lod_lofi_vertex_fine_pos : lod_vertex_fine_pos;
  var hmIdxA   = mesh_quality <= 2 ? lod_lofi_vertex_hm_idx   : lod_vertex_hm_idx;

  if (!bufAttr || !finePosA || !hmIdxA || !heightmap) return geometry;

  var Q_scale = terrain_quality;
  var seg_w   = mapview_model_width  / (map.xsize * Q_scale);
  var seg_h   = (mapview_model_height / (map.ysize * Q_scale)) * HEX_HEIGHT_FACTOR;
  var half_w  = mapview_model_width  / 2;
  var half_h  = mapview_model_height / 2;
  var hm_len  = heightmap.length;

  var nv = finePosA.length >> 1;  // total vertex count
  for (var vi = 0; vi < nv; vi++) {
    var fix = finePosA[vi * 2];
    var fiy = finePosA[vi * 2 + 1];
    var row_stagger = (fiy % 2 === 1) ? seg_w * HEX_STAGGER : 0;
    var wx = fix * seg_w - half_w + row_stagger;
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
  Update the map terrain geometry.

  Two separate change signals are tracked:
  1. LOD structure hash  – which tiles are detail (mountains/hills/forest/
     jungle) vs flat.  Changes when a tile is first revealed or terrain
     type changes.  Requires a full geometry rebuild (new index buffer).
  2. Heightmap hash – tile heights changed (e.g. terrain transformation).
     Only vertex z-positions need updating; index/UV buffers stay the same.

  Both cases re-apply the fixed rotateX + translate transforms that put the
  geometry in the correct world-space orientation.
****************************************************************************/
function update_map_terrain_geometry()
{
  if (!map_geometry_dirty) {
    return;
  }

  var newLodHash    = compute_lod_structure_hash();
  var newHeightHash = generate_heightmap_hash();
  var lodChanged    = (newLodHash    !== lod_structure_hash);
  var heightChanged = (newHeightHash !== heightmap_hash);

  if (lodChanged || heightChanged) {
    // Always recompute the heightmap first (needed for both cases).
    if (is_hex()) {
      update_heightmap(terrain_quality);
    } else {
      update_heightmap_square(terrain_quality);
    }

    if (lodChanged) {
      // Full topology rebuild – new vertex / index / UV buffers.
      console.log("LOD structure changed – rebuilding terrain geometry.");
      if (is_hex()) {
        init_land_geometry(lofiGeometry, 2);
        init_land_geometry(landGeometry, terrain_quality);
      } else {
        init_land_geometry_square(lofiGeometry, 2);
        init_land_geometry_square(landGeometry, terrain_quality);
      }
      lod_structure_hash = newLodHash;
      console.log("Land mesh triangles after LOD rebuild: " + landGeometry.index.count / 3);
    } else {
      // Heights-only update – fast z-position refresh.
      if (is_hex()) {
        update_land_geometry(lofiGeometry, 2);
        update_land_geometry(landGeometry, terrain_quality);
      } else {
        update_land_geometry_square(lofiGeometry, 2);
        update_land_geometry_square(landGeometry, terrain_quality);
      }
    }

    // Re-apply the world-space transform (both init and update output
    // pre-rotation positions so this is always correct).
    lofiGeometry.rotateX( - Math.PI / 2 );
    lofiGeometry.translate(Math.floor(mapview_model_width / 2) - 500, 0, Math.floor(mapview_model_height / 2));
    landGeometry.rotateX( - Math.PI / 2 );
    landGeometry.translate(Math.floor(mapview_model_width / 2) - 500, 0, Math.floor(mapview_model_height / 2));

    heightmap_hash = newHeightHash;
  }

  map_geometry_dirty = false;
}

/****************************************************************************
  Update the map known tiles!
****************************************************************************/
function update_map_known_tiles()
{
  // Always flush batched road updates regardless of visibility changes
  if (typeof flush_roads_updates === 'function') flush_roads_updates();

  if (map_known_dirty) {
    update_tiles_known_vertex_colors();
    update_map_terrain_geometry();
  }
  map_known_dirty = false;
}

/****************************************************************************
  Main animation method for WebGL.
****************************************************************************/
/****************************************************************************
  Main animation method.
****************************************************************************/
function animate_webgl() {
  if (scene == null) return;

  // Skip 3D rendering when the 2D map tab is active.
  // Still tick the timer so deltaTime doesn't spike on switch-back.
  try {
    if ($('#tabs').tabs('option', 'active') !== 0) {
      if (timer) timer.update();
      return;
    }
  } catch (e) {}

  if (stats != null) stats.begin();
  if (mapview_slide['active']) update_map_slide_3d();

  update_animated_objects();
  
  // Get actual delta time from THREE.Timer (in seconds)
  // This ensures animation speed is consistent regardless of frame rate
  const DEFAULT_DELTA_TIME = 0.016; // Default to ~60fps if timer not available
  var deltaTime = DEFAULT_DELTA_TIME;
  if (timer) {
    timer.update();
    deltaTime = timer.getDelta();
    // Clamp delta time to prevent huge jumps when tab is inactive
    deltaTime = Math.min(deltaTime, 0.1);
  }
  
  // Update water animation
  updateWaterAnimation(deltaTime);

  // Update procedural sky (time of day, dome follows camera)
  updateSkyAnimation(deltaTime);

  
  // Update selected unit animation (TSL-based pulsing effect)

    updateSelectedUnitAnimation(deltaTime);


  if (controls != null) {
    controls.update();
  }

  maprenderer.render(scene, camera);

  if (goto_active) check_request_goto_path();
  if (stats != null) stats.end();
  if (initial_benchmark_enabled || benchmark_enabled) benchmark_frames_count++;

}


/****************************************************************************
 Sets the mapview model dimensions based on map size.
 Also updates the hex center offsets used for object placement.
 ****************************************************************************/
function set_mapview_model_size() {
  mapview_model_width = Math.floor(MAPVIEW_ASPECT_FACTOR * map['xsize']);
  mapview_model_height = Math.floor(MAPVIEW_ASPECT_FACTOR * map['ysize']);
  
  // Update hex center offsets after model dimensions are set
  updateHexCenterOffsets();
}
