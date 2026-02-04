/**********************************************************************
    FreecivWorld.net - the web version of Freeciv. http://www.FreecivWorld.net/
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
var scene, maprenderer;
var anaglyph_effect;

var mouse, raycaster;
var spotlight;
var clock;

var controls;

var tiletype_terrains = ["coast","ocean","desert","grassland","hills","mountains","plains","swamp", "arctic_farmland_irrigation_tundra"];

var landGeometry;
var landMesh; // the terrain land geometry
var water_hq;
var shadowmesh;

var lofiGeometry;
var lofiMesh;  // low resolution mesh used for raycasting.
var freeciv_uniforms;
var terrain_material;

var landbufferattribute;
var lofibufferattribute;

var mapview_model_width;
var mapview_model_height;

var MAPVIEW_ASPECT_FACTOR = 35.71;

// Hexagonal tile constants for offset coordinate system (odd-r: odd rows shifted right)
// Reference: https://www.redblobgames.com/grids/hexagons/#coordinates-offset
var HEX_WIDTH_FACTOR = 1.0;  // Width multiplier for hex tiles
var HEX_HEIGHT_FACTOR = Math.sqrt(3) / 2; // sqrt(3)/2 ≈ 0.8660 - hex row spacing for proper aspect ratio
var HEX_STAGGER = 0.5;  // Horizontal offset for odd rows (half tile width)


/****************************************************************************
  Initialize land geometry with hexagonal tile grid
  
  Creates a mesh with hexagonal tiling using offset coordinates (odd-r).
  Reference: https://www.redblobgames.com/grids/hexagons/#coordinates-offset
  
  Grid properties:
  - Each tile has 6 neighbors (hex topology)
  - Odd rows are offset by half a tile width (odd-r offset coordinates)
  - UV coordinates map to hex tile centers for proper terrain sampling
  - Heightmap values are interpolated between adjacent hex tiles
  
  @param {THREE.BufferGeometry} geometry - Geometry to initialize
  @param {number} mesh_quality - Quality multiplier (1=standard, 2=low-res for raycasting)
****************************************************************************/
function init_land_geometry(geometry, mesh_quality)
{
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
    // Apply hex row offset for odd rows (odd-r staggered grid)
    // In Freeciv hex: row 0 is normal, row 1 is staggered 0.5 tiles right, etc.
    const rowOffset = (iy % 2 === 1) ? segment_width * HEX_STAGGER : 0;
    const y = iy * segment_height - height_half;
    
    for ( let ix = 0; ix < gridX1; ix ++ ) {
      const x = ix * segment_width - width_half + rowOffset;
      var sx = ix % xquality, sy = iy % yquality;

      // Calculate 1D index for heightmap array
      const heightmap_index = (sy * heightmap_scale) * heightmap_resolution_x + (sx * heightmap_scale);
      const height_value = heightmap && heightmap[heightmap_index] !== undefined ? heightmap[heightmap_index] * 100 : 0;
      
      vertices.push( x, -y, height_value );
      
      // UV coordinates for hex sampling
      // Add hex stagger to UV for odd rows - the shader will subtract this
      // to get the correct tile position for terrain texture lookup
      const uvX = (ix + (iy % 2 === 1 ? HEX_STAGGER : 0)) / gridX;
      uvs.push( uvX );
      uvs.push( 1 - ( iy / gridY ) );
    }
  }

  // Create triangles connecting the hexagonal grid
  // Uses standard triangle pairs but with hex-aware indexing
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
    geometry.setAttribute( 'position', landbufferattribute);
  }

  geometry.setIndex( indices );
  geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );

  geometry.computeVertexNormals();

  return geometry;
}

/****************************************************************************
  Update the land terrain geometry with hexagonal tiling
  
  Updates vertex positions based on current heightmap values while maintaining
  hex grid layout with odd-r offset coordinates.
  
  @param {THREE.BufferGeometry} geometry - Geometry to update
  @param {number} mesh_quality - Quality multiplier matching init_land_geometry
****************************************************************************/
function update_land_geometry(geometry, mesh_quality) {
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
  Update the map terrain geometry!
****************************************************************************/
function update_map_terrain_geometry()
{
  if (map_geometry_dirty) {
    var hash = generate_heightmap_hash();
    if (hash != heightmap_hash) {
      update_heightmap(terrain_quality);
      update_land_geometry(lofiGeometry, 2);
      update_land_geometry(landGeometry, terrain_quality);

      lofiGeometry.rotateX( - Math.PI / 2 );
      lofiGeometry.translate(Math.floor(mapview_model_width / 2) - 500, 0, Math.floor(mapview_model_height / 2));
      landGeometry.rotateX( - Math.PI / 2 );
      landGeometry.translate(Math.floor(mapview_model_width / 2) - 500, 0, Math.floor(mapview_model_height / 2));
      heightmap_hash = hash;
    }
  }

  map_geometry_dirty = false;
}

/****************************************************************************
  Update the map known tiles!
****************************************************************************/
function update_map_known_tiles()
{
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

  if (stats != null) stats.begin();
  if (mapview_slide['active']) update_map_slide_3d();

  update_animated_objects();
  
  // Get actual delta time from the timer (in seconds)
  // This ensures animation speed is consistent regardless of frame rate
  // THREE.Timer needs update() called before getDelta()
  const DEFAULT_DELTA_TIME = 0.016; // Default to ~60fps if timer not available
  var deltaTime = DEFAULT_DELTA_TIME;
  if (clock) {
    if (typeof clock.update === 'function') {
      clock.update(); // Update timer state
    }
    if (typeof clock.getDelta === 'function') {
      deltaTime = clock.getDelta();
    } else if (typeof clock.getElapsedTime === 'function') {
      // Fallback for THREE.Clock which doesn't have update()
      var elapsed = clock.getElapsedTime();
      if (window._lastElapsedTime !== undefined) {
        deltaTime = elapsed - window._lastElapsedTime;
      }
      window._lastElapsedTime = elapsed;
    }
    // Clamp delta time to prevent huge jumps when tab is inactive
    deltaTime = Math.min(deltaTime, 0.1);
  }
  
  // Update water animation
  if (typeof updateWaterAnimation === 'function') {
    updateWaterAnimation(deltaTime);
  }
  
  // Update selected unit animation (TSL-based pulsing effect)
  if (typeof updateSelectedUnitAnimation === 'function') {
    updateSelectedUnitAnimation(deltaTime);
  }

  if (controls != null) {
    controls.update();
  }

  if (anaglyph_3d_enabled) {
    anaglyph_effect.render(scene,camera);
  } else {
    maprenderer.render(scene, camera);
  }

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
