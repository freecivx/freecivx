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


/****************************************************************************
  Initialize land geometry
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

  const segment_width = mapview_model_width / gridX;
  const segment_height = mapview_model_height / gridY;

  const indices = [];
  const uvs = [];
  const vertices = [];
  let heightmap_scale = (mesh_quality === 2) ? (mesh_quality * 2) : 1;
  const heightmap_resolution_x = map.xsize * mesh_quality + 1;

  for ( let iy = 0; iy < gridY1; iy ++ ) {
    const y = iy * segment_height - height_half;
    for ( let ix = 0; ix < gridX1; ix ++ ) {
      const x = ix * segment_width - width_half;
      var sx = ix % xquality, sy = iy % yquality;

      // Calculate 1D index for heightmap array
      const heightmap_index = (sy * heightmap_scale) * heightmap_resolution_x + (sx * heightmap_scale);
      const height_value = heightmap && heightmap[heightmap_index] !== undefined ? heightmap[heightmap_index] * 100 : 0;
      
      vertices.push( x, -y, height_value );
      uvs.push( ix / gridX );
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
    geometry.setAttribute( 'position', landbufferattribute);
  }

  geometry.setIndex( indices );
  geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );

  geometry.computeVertexNormals();

  return geometry;
}

/****************************************************************************
  Create the land terrain geometry
****************************************************************************/
function update_land_geometry(geometry, mesh_quality) {
  const xquality = map.xsize * mesh_quality + 1;
  const yquality = map.ysize * mesh_quality + 1;

  const gridX = Math.floor(xquality);
  const gridY = Math.floor(yquality);

  const segment_width = mapview_model_width / gridX;
  const segment_height = mapview_model_height / gridY;

  const width_half = mapview_model_width / 2;
  const height_half = mapview_model_height / 2;

  const heightmap_scale = (mesh_quality === 2) ? 2 : 1;
  const heightmap_resolution_x = map.xsize * mesh_quality + 1;
  const bufferAttribute = mesh_quality === 2 ? lofibufferattribute : landbufferattribute;

  for (let iy = 0; iy <= gridY; iy++) {
    const y = iy * segment_height - height_half;
    for (let ix = 0; ix <= gridX; ix++) {
      const x = ix * segment_width - width_half;
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
  
  // Update water animation
  if (typeof updateWaterAnimation === 'function') {
    updateWaterAnimation(0.016); // ~60fps delta time
  }
  
  // Update selected unit animation (TSL-based pulsing effect)
  if (typeof updateSelectedUnitAnimation === 'function') {
    updateSelectedUnitAnimation(0.016); // ~60fps delta time
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
 ...
 ****************************************************************************/
function set_mapview_model_size() {
  mapview_model_width = Math.floor(MAPVIEW_ASPECT_FACTOR * map['xsize']);
  mapview_model_height = Math.floor(MAPVIEW_ASPECT_FACTOR * map['ysize']);
}
