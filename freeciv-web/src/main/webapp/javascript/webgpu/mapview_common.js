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
// Reference: https://www.redblobgames.com/grids/hexagons/#coordinates-offset
// Using centralized HexConfig when available for consistency across the codebase
var HEX_WIDTH_FACTOR = (typeof window !== 'undefined' && window.HexConfig) ? window.HexConfig.WIDTH_FACTOR : 1.0;
var HEX_HEIGHT_FACTOR = (typeof window !== 'undefined' && window.HexConfig) ? window.HexConfig.HEIGHT_FACTOR : Math.sqrt(3) / 2;
var HEX_STAGGER = (typeof window !== 'undefined' && window.HexConfig) ? window.HexConfig.STAGGER : 0.5;

// ---------------------------------------------------------------------------
// LOD (Level-of-Detail) geometry tracking
//
// For maps with terrain_quality > 1, detail tiles (Mountains / Hills /
// Forest / Jungle) use terrain_quality subdivisions per tile while flat
// tiles (everything else) use a single quad (Q=1).  This reduces triangle
// count by ~60 % on typical maps without affecting visual fidelity.
//
// Per-vertex arrays are stored so that update_land_geometry() can refresh
// only the z-component quickly without rebuilding index / UV buffers.
// lod_vertex_tile_xy is used by update_tiles_known_vertex_colors() so that
// fog-of-war colors are always correct after a LOD geometry rebuild.
// ---------------------------------------------------------------------------
var lod_vertex_fine_pos      = null;  // Int32Array [fix, fiy, ...] per main-mesh vertex
var lod_lofi_vertex_fine_pos = null;  // same for lofi mesh
var lod_vertex_hm_idx        = null;  // Int32Array: heightmap index per main-mesh vertex
var lod_lofi_vertex_hm_idx   = null;  // same for lofi mesh
var lod_vertex_tile_xy       = null;  // Int16Array [tx, ty, ...] per main-mesh vertex
var lod_structure_hash       = -1;    // changes when tile detail-status changes

/****************************************************************************
  Returns true when the tile should receive full terrain_quality subdivision.
  Only known detail terrain (Mountains, Hills, Forest, Jungle) qualifies.
****************************************************************************/
function is_detail_tile_lod(tx, ty) {
  if (tx < 0 || tx >= map.xsize || ty < 0 || ty >= map.ysize) return false;
  var ptile = map_pos_to_tile(tx, ty);
  if (ptile == null || tile_get_known(ptile) == TILE_UNKNOWN) return false;
  var n = tile_terrain(ptile)['name'];
  return n === "Mountains" || n === "Hills" || n === "Forest" || n === "Jungle";
}

/****************************************************************************
  Hash of which tiles are detail vs flat.  Changes when a tile is first
  revealed or its terrain type changes, signalling a full geometry rebuild.
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
  Initialize land geometry with hexagonal tile grid.

  When geometry is the main landGeometry and terrain_quality > 1 (large
  maps), each tile uses an independent set of (Q+1)² vertices where:
    Q = terrain_quality  for detail tiles (Mountains / Hills / Forest / Jungle)
    Q = 1                for flat tiles

  This per-tile LOD cuts triangle count by ~60 % on typical maps.

  For the lofi raycasting mesh and for terrain_quality <= 1, the classic
  uniform grid is used (no per-tile duplication overhead).

  All vertices are stored in fine-grid coordinates so that
  update_land_geometry() can refresh z-values cheaply.

  @param {THREE.BufferGeometry} geometry   - Geometry to (re)initialise
  @param {number}               mesh_quality - Quality multiplier
****************************************************************************/
function init_land_geometry(geometry, mesh_quality)
{
  // Decide whether to apply per-tile LOD on this mesh.
  // LOD is only worthwhile on the main (land) mesh when terrain_quality > 1.
  var use_lod = (geometry === landGeometry) && (terrain_quality > 1);

  if (use_lod) {
    var Q_scale  = terrain_quality;
    var hm_res_x = map.xsize * Q_scale + 1;
    var seg_w    = mapview_model_width  / (map.xsize * Q_scale);
    var seg_h    = (mapview_model_height / (map.ysize * Q_scale)) * HEX_HEIGHT_FACTOR;
    var half_w   = mapview_model_width  / 2;
    var half_h   = mapview_model_height / 2;

    var vertices  = [];
    var uvs       = [];
    var indices   = [];
    var finePos   = [];   // [fix, fiy] per vertex
    var hmIdxArr  = [];   // heightmap index per vertex
    var tileXYArr = [];   // [tx, ty] per vertex (for fog-of-war color lookup)

    var vi = 0;

    for (var ty = 0; ty < map.ysize; ty++) {
      for (var tx = 0; tx < map.xsize; tx++) {
        var Q    = is_detail_tile_lod(tx, ty) ? terrain_quality : 1;
        var step = Q_scale / Q;
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
            tileXYArr.push(tx, ty);
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

    landbufferattribute      = new THREE.Float32BufferAttribute(vertices, 3);
    lod_vertex_fine_pos      = new Int32Array(finePos);
    lod_vertex_hm_idx        = new Int32Array(hmIdxArr);
    lod_vertex_tile_xy       = new Int16Array(tileXYArr);
    geometry.setAttribute('position', landbufferattribute);
    geometry.setIndex(indices);
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    return geometry;
  }

  // ---- Uniform grid (lofi mesh or terrain_quality <= 1) -------------------
  const xquality = map.xsize * mesh_quality + 1;
  const yquality = map.ysize * mesh_quality + 1;

  const width_half = mapview_model_width / 2;
  const height_half = mapview_model_height / 2;

  const gridX = Math.floor(xquality);
  const gridY = Math.floor(yquality);

  const gridX1 = gridX + 1;
  const gridY1 = gridY + 1;

  // Hex tile dimensions
  const segment_width = mapview_model_width / gridX;
  const segment_height = (mapview_model_height / gridY) * HEX_HEIGHT_FACTOR;

  const indices = [];
  const uvs = [];
  const vertices = [];
  let heightmap_scale = (mesh_quality === 2) ? (mesh_quality * 2) : 1;
  const heightmap_resolution_x = map.xsize * mesh_quality + 1;

  // Create vertices for hexagonal grid
  for ( let iy = 0; iy < gridY1; iy ++ ) {
    const rowOffset = (iy % 2 === 1) ? segment_width * HEX_STAGGER : 0;
    const y = iy * segment_height - height_half;
    
    for ( let ix = 0; ix < gridX1; ix ++ ) {
      const x = ix * segment_width - width_half + rowOffset;
      var sx = ix % xquality, sy = iy % yquality;

      const heightmap_index = (sy * heightmap_scale) * heightmap_resolution_x + (sx * heightmap_scale);
      const height_value = heightmap && heightmap[heightmap_index] !== undefined ? heightmap[heightmap_index] * 100 : 0;
      
      vertices.push( x, -y, height_value );
      
      const uvX = (ix + (iy % 2 === 1 ? HEX_STAGGER : 0)) / gridX;
      uvs.push( uvX );
      uvs.push( 1 - ( iy / gridY ) );
    }
  }

  for ( let iy = 0; iy < gridY; iy ++ ) {
    for ( let ix = 0; ix < gridX; ix ++ ) {
      const a = ix + gridX1 * iy;
      const b = ix + gridX1 * ( iy + 1 );
      const c = ( ix + 1 ) + gridX1 * ( iy + 1 );
      const d = ( ix + 1 ) + gridX1 * iy;

      indices.push( a, b, d );
      indices.push( b, c, d );
    }
  }

  if (mesh_quality === 2) {
    lofibufferattribute = new THREE.Float32BufferAttribute( vertices, 3 );
    geometry.setAttribute( 'position', lofibufferattribute);
  } else {
    landbufferattribute = new THREE.Float32BufferAttribute( vertices, 3 );
    lod_vertex_fine_pos = null;  // no LOD for terrain_quality <= 1
    lod_vertex_tile_xy  = null;
    lod_vertex_hm_idx   = null;
    geometry.setAttribute( 'position', landbufferattribute);
  }

  geometry.setIndex( indices );
  geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );

  geometry.computeVertexNormals();

  return geometry;
}

/****************************************************************************
  Update vertex positions of the hex terrain geometry.

  When LOD vertex arrays exist and geometry is the main mesh, only the z
  (height) component is updated using the pre-stored fine-grid positions.
  X and Y are recomputed from fine-grid coordinates so the function is safe
  to call after rotateX / translate have been permanently applied.

  @param {THREE.BufferGeometry} geometry   - Geometry to update
  @param {number}               mesh_quality - Quality multiplier
****************************************************************************/
function update_land_geometry(geometry, mesh_quality) {
  // LOD fast path: update z only via stored per-vertex arrays.
  if (geometry === landGeometry && lod_vertex_fine_pos !== null) {
    var Q_scale = terrain_quality;
    var seg_w   = mapview_model_width  / (map.xsize * Q_scale);
    var seg_h   = (mapview_model_height / (map.ysize * Q_scale)) * HEX_HEIGHT_FACTOR;
    var half_w  = mapview_model_width  / 2;
    var half_h  = mapview_model_height / 2;
    var hm_len  = heightmap ? heightmap.length : 0;
    var nv      = lod_vertex_fine_pos.length >> 1;

    for (var vi = 0; vi < nv; vi++) {
      var fix = lod_vertex_fine_pos[vi * 2];
      var fiy = lod_vertex_fine_pos[vi * 2 + 1];
      var row_stagger = (fiy % 2 === 1) ? seg_w * HEX_STAGGER : 0;
      var wx  = fix * seg_w - half_w + row_stagger;
      var wy  = fiy * seg_h - half_h;
      var hmi = lod_vertex_hm_idx[vi];
      var h   = (hmi < hm_len) ? heightmap[hmi] * 100 : 0;
      landbufferattribute.setXYZ(vi, wx, -wy, h);
    }

    landbufferattribute.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }

  // Uniform-grid path (lofi mesh or terrain_quality <= 1).
  const xquality = map.xsize * mesh_quality + 1;
  const yquality = map.ysize * mesh_quality + 1;

  const gridX = Math.floor(xquality);
  const gridY = Math.floor(yquality);

  // Hex tile dimensions
  const segment_width = mapview_model_width / gridX;
  const segment_height = (mapview_model_height / gridY) * HEX_HEIGHT_FACTOR;

  const width_half = mapview_model_width / 2;
  const height_half = mapview_model_height / 2;

  const heightmap_scale = (mesh_quality === 2) ? 2 : 1;
  const heightmap_resolution_x = map.xsize * mesh_quality + 1;
  const bufferAttribute = mesh_quality === 2 ? lofibufferattribute : landbufferattribute;

  for (let iy = 0; iy <= gridY; iy++) {
    // Apply hex row offset for odd rows (odd-r staggered grid)
    const rowOffset = (iy % 2 === 1) ? segment_width * HEX_STAGGER : 0;
    const y = iy * segment_height - height_half;
    
    for (let ix = 0; ix <= gridX; ix++) {
      const x = ix * segment_width - width_half + rowOffset;
      const sx = ix % xquality, sy = iy % yquality;
      const index = iy * (gridX + 1) + ix;
      // Calculate 1D index for heightmap array
      const heightIndex = (sy * heightmap_scale) * heightmap_resolution_x + (sx * heightmap_scale);
      const height_value = heightmap && heightmap[heightIndex] !== undefined ? heightmap[heightIndex] * 100 : 0;

      bufferAttribute.setXYZ(index, x, -y, height_value);
    }
  }

  bufferAttribute.needsUpdate = true;
  geometry.computeVertexNormals();

  return geometry;
}


/****************************************************************************
  Update the map terrain geometry.

  Two change signals are tracked:
  1. LOD structure hash – which tiles qualify as detail (Mountains/Hills/
     Forest/Jungle) vs flat.  Changes when a tile is first revealed or
     terrain type changes.  Requires a full geometry rebuild (new index
     and UV buffers).
  2. Heightmap hash – tile heights changed.  Only vertex z-positions need
     refreshing; index/UV buffers remain valid.

  Both cases re-apply the fixed rotateX + translate transforms.
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
    if (is_hex()) {
      update_heightmap(terrain_quality);
    } else {
      update_heightmap_square(terrain_quality);
    }

    if (lodChanged) {
      // Full topology rebuild required – replaces vertex, index and UV buffers.
      if (is_hex()) {
        init_land_geometry(lofiGeometry, 2);
        init_land_geometry(landGeometry, terrain_quality);
      } else {
        init_land_geometry_square(lofiGeometry, 2);
        init_land_geometry_square(landGeometry, terrain_quality);
      }
      lod_structure_hash = newLodHash;
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

    lofiGeometry.rotateX( - Math.PI / 2 );
    lofiGeometry.translate(Math.floor(mapview_model_width / 2) - 500, 0, Math.floor(mapview_model_height / 2));
    landGeometry.rotateX( - Math.PI / 2 );
    landGeometry.translate(Math.floor(mapview_model_width / 2) - 500, 0, Math.floor(mapview_model_height / 2));

    heightmap_hash = newHeightHash;
  }

  map_geometry_dirty = false;
}

/****************************************************************************
  Update the map known tiles.

  Geometry is always rebuilt before colors are applied so that the vertex
  count in the color buffer matches the current geometry layout.  This is
  critical when a LOD geometry rebuild changes the vertex count.
****************************************************************************/
function update_map_known_tiles()
{
  // Always flush batched road updates regardless of visibility changes
  if (typeof flush_roads_updates === 'function') flush_roads_updates();

  if (map_known_dirty) {
    update_map_terrain_geometry();       // geometry first (may rebuild LOD)
    update_tiles_known_vertex_colors();  // then colors with correct vertex count
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
