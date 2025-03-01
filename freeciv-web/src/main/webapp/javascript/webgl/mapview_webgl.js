/**********************************************************************
    FreecivX.net - the web version of Freeciv. http://www.FreecivX.net/
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
  Start the Freeciv-web WebGL renderer
****************************************************************************/
function webgl_start_renderer()
{
  var new_mapview_width = $(window).width() - width_offset;
  var new_mapview_height;
  if (!is_small_screen()) {
    new_mapview_height = $(window).height() - height_offset;
  } else {
    new_mapview_height = $(window).height() - height_offset - 40;
  }

  console.log("Three.js " + THREE.REVISION);
  THREE.ColorManagement.enabled = true;


  container = document.getElementById('mapcanvas');
  camera = new THREE.PerspectiveCamera( 45, new_mapview_width / new_mapview_height, 1, 12000 );
  scene = new THREE.Scene();

  raycaster = new THREE.Raycaster();
  raycaster.layers.set(6);

  mouse = new THREE.Vector2();

  clock = new THREE.Clock();

  // Lights
  var ambientLight = new THREE.AmbientLight( 0x606060, 28 * Math.PI );
  scene.add(ambientLight);

  spotlight = new THREE.SpotLight( 0xffffff, 3.0 * Math.PI, 0, Math.PI / 3, 0.001, 0.5);
  scene.add( spotlight );


  spotlight.castShadow = true;
  spotlight.shadow.camera.near = 100;
  spotlight.shadow.camera.far = 3000;
  spotlight.shadow.bias = 0.0001;

  spotlight.shadow.mapSize.x = 4096;
  spotlight.shadow.mapSize.y = 4096;

  var enable_antialiasing = graphics_quality >= QUALITY_MEDIUM;
  var stored_antialiasing_setting = simpleStorage.get("antialiasing_setting", "");
  if (stored_antialiasing_setting != null && stored_antialiasing_setting == "false") {
    enable_antialiasing = false;
  }


  maprenderer = new THREE.WebGLRenderer( { antialias: enable_antialiasing, preserveDrawingBuffer: true } );
  maprenderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  maprenderer.frustumCulled = true;
  maprenderer.setAnimationLoop(animate_webgl);

  maprenderer.setPixelRatio(window.devicePixelRatio);
  maprenderer.setSize(new_mapview_width, new_mapview_height);
  container.appendChild(maprenderer.domElement);

  if (anaglyph_3d_enabled) {
    anaglyph_effect = new AnaglyphEffect( maprenderer );
    anaglyph_effect.setSize( new_mapview_width, new_mapview_height );
  }

  if (is_small_screen()) {
    camera_dy = camera_dy * 1.6;
  }

  $("#pregame_page").hide();
}


/****************************************************************************
 This will render the map terrain mesh.
****************************************************************************/
async function init_webgl_mapview() {
  selected_unit_material = new THREE.MeshBasicMaterial( { color: 0xf6f7bf, transparent: true, opacity: 0.7} );

  /* uniforms are variables which are used in the fragment shader fragment.js */
  freeciv_uniforms = {
      maptiles: { type: "t", value: maptiletypes },
      borders: { type: "t", value: borders_texture },
      map_x_size: { type: "f", value: map['xsize'] },
      map_y_size: { type: "f", value: map['ysize'] },
      mouse_x: { type: "i", value: -1 },
      mouse_y: { type: "i", value: -1 },
      selected_x: { type: "i", value: -1 },
      selected_y: { type: "i", value: -1 },
      roadsmap: { type: "t", value: roads_texture},
      roadsprites: {type: "t", value: webgl_textures["roads"]},
      railroadsprites: {type: "t", value: webgl_textures["railroads"]},
      borders_visible: {type: "bool", value: server_settings['borders']['is_visible']}
    };

    for (var i = 0; i < tiletype_terrains.length ; i++) {
      var terrain_name = tiletype_terrains[i];
      freeciv_uniforms[terrain_name] = {type: "t", value: webgl_textures[terrain_name]};
    }

  init_heightmap(terrain_quality);
  update_heightmap(terrain_quality);

  // Low-resolution terrain mesh used for raycasting to find mouse postition.
  var lofiMaterial = new THREE.MeshBasicMaterial({"color" : 0x00ff00});
  lofiGeometry = new THREE.BufferGeometry();
  init_land_geometry(lofiGeometry, 2);
  update_land_geometry(lofiGeometry, 2);
  lofiMesh = new THREE.Mesh( lofiGeometry, lofiMaterial );
  lofiMesh.layers.set(6);
  scene.add(lofiMesh);

  if (map.xsize > 200 || map.ysize > 200) {
    terrain_quality = 2;
  }

  const vertexShaderResponse = await fetch('/javascript/webgl/shaders_square/terrain_vertex_shader.glsl');
  const vertex_shader = await vertexShaderResponse.text();

  const fragmentShaderResponse = await fetch('/javascript/webgl/shaders_square/terrain_fragment_shader.glsl');
  var fragment_shader = await fragmentShaderResponse.text();

  if (maprenderer.capabilities.maxTextures <= 16) {
    console.log("max textures: " + maprenderer.capabilities.maxTextures);
  }

  // High-resolution terrain-mesh shown in mapview.
  terrain_material = new THREE.ShaderMaterial({
      uniforms: freeciv_uniforms,
      vertexShader: vertex_shader,
      fragmentShader: fragment_shader,
      vertexColors: true,
      glslVersion: THREE.GLSL3
    });

  landGeometry = new THREE.BufferGeometry();
  init_land_geometry(landGeometry, terrain_quality);
  update_land_geometry(landGeometry, terrain_quality);
  landMesh = new THREE.Mesh( landGeometry, terrain_material );
  landMesh.receiveShadow = false;
  landMesh.castShadow = false;
  scene.add(landMesh);

  if (graphics_quality === QUALITY_HIGH) {
    var shadowMaterial = new THREE.ShadowMaterial();
    shadowMaterial.opacity = 0.92;
    shadowmesh = new THREE.Mesh( landGeometry, shadowMaterial);
    shadowmesh.receiveShadow = true;
    shadowmesh.castShadow = false;
    scene.add(shadowmesh);
  }

  update_map_terrain_geometry();
  setInterval(update_map_terrain_geometry, 40);

  setInterval(update_map_known_tiles, 15);

  add_quality_dependent_objects_webgl();

  add_all_objects_to_scene();

  benchmark_start = new Date().getTime();


}

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

  for ( let iy = 0; iy < gridY1; iy ++ ) {
    const y = iy * segment_height - height_half;
    for ( let ix = 0; ix < gridX1; ix ++ ) {
      const x = ix * segment_width - width_half;
      var sx = ix % xquality, sy = iy % yquality;

      vertices.push( x, -y, heightmap[sx * heightmap_scale][sy * heightmap_scale] * 100 );
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
  const bufferAttribute = mesh_quality === 2 ? lofibufferattribute : landbufferattribute;

  for (let iy = 0; iy <= gridY; iy++) {
    const y = iy * segment_height - height_half;
    for (let ix = 0; ix <= gridX; ix++) {
      const x = ix * segment_width - width_half;
      const sx = ix % xquality, sy = iy % yquality;
      const index = iy * (gridX + 1) + ix;
      const heightIndex = (sy * heightmap_scale * xquality) + (sx * heightmap_scale); // Convert (sx, sy) to single index

      bufferAttribute.setXYZ(index, x, -y, heightmap[heightIndex] * 100);
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
function animate_webgl() {
  if (scene == null) return;
  if (globe_view_active) return;
  if (stats != null) stats.begin();
  if (mapview_slide['active']) update_map_slide_3d();

  update_animated_objects();

  if (selected_unit_indicator != null && selected_unit_material != null) {
    selected_unit_material.color.multiplyScalar (0.996);
    if (selected_unit_material_counter > 50) {
      selected_unit_material_counter = 0;
      selected_unit_material.color.setHex(0xffffff);
    }
    selected_unit_material_counter++;
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
function add_quality_dependent_objects_webgl()
{
  let waterMaterial;
  var waterGeometry = new THREE.PlaneGeometry( mapview_model_width, mapview_model_height);

  // Full water effect for other platforms
  waterMaterial = new THREE.MeshPhysicalMaterial({
    transmission: 1, // Fully transparent
    roughness: 0.1, // Smoother surface for shiny appearance
    ior: 1.333, // Index of refraction for water
    color: '#c4f0e6', // Lighter blue for shallow shiny areas
    clearcoat: 1, // Adds shine to the water surface
    clearcoatRoughness: 0.015, // Even smoother clearcoat
    reflectivity: 0.97, // Maximized reflections for glossy shallow water
    thickness: 6, // Reduced thickness to emphasize shallow areas
    attenuationColor: '#b0e2d4', // Soft blue-green for shallow areas
    attenuationDistance: 12, // Shorter absorption distance for vibrant shallow areas
    envMapIntensity: 1.7, // Stronger environment reflections
    normalMap: webgl_textures["water1"], // Wave texture
    normalScale: new THREE.Vector2(0.02, 0.02), // Very subtle, short waves
  });
  water_hq = new THREE.Mesh(waterGeometry, waterMaterial);

  water_hq.rotation.x = - Math.PI * 0.5;
  water_hq.translateOnAxis(new THREE.Vector3(0,0,1).normalize(), 50);
  water_hq.translateOnAxis(new THREE.Vector3(1,0,0).normalize(), Math.floor(mapview_model_width / 2) - 500);
  water_hq.translateOnAxis(new THREE.Vector3(0,1,0).normalize(), -mapview_model_height / 2);
  water_hq.renderOrder = -1; // Render water first, this will solve transparency issues in city labels.
  water_hq.castShadow = false;
  scene.add( water_hq );

  if (graphics_quality === QUALITY_HIGH) {
    if (shadowmesh == null) {
      var shadowMaterial = new THREE.ShadowMaterial();
      shadowMaterial.opacity = 0.85;
      shadowmesh = new THREE.Mesh( landGeometry, shadowMaterial);
      shadowmesh.receiveShadow = true;
      shadowmesh.castShadow = false;
      scene.add(shadowmesh);
    }

    shadowmesh.visible = true;

    maprenderer.shadowMap.enabled = true;
    maprenderer.shadowMap.type = THREE.PCFShadowMap;

  } else if (shadowmesh != null) {
    shadowmesh.visible = false;
    maprenderer.shadowMap.enabled = false;
  }

  var hours = new Date().getHours();
  var is_day = hours > 6 && hours < 20;

  if (graphics_quality === QUALITY_HIGH) {
    if (is_day) {
      const sky = new THREE.WebGLCubeRenderTarget(webgl_textures["skybox"].image.height);
      sky.fromEquirectangularTexture(maprenderer, webgl_textures["skybox"]);
      scene.background = sky.texture;
    } else {
      const sky = new THREE.WebGLCubeRenderTarget(2000);
      sky.fromEquirectangularTexture(maprenderer, create_star_sky_texture(18000, 5000, 2400, false));
      scene.background = sky.texture;
    }
  } else {
    scene.background = null;
  }
}
