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

/****************************************************************************
  Start the Freeciv-web WebGPU renderer
****************************************************************************/
function webgpu_start_renderer()
{
  var new_mapview_width = $(window).width() - width_offset;
  var new_mapview_height;
  if (!is_small_screen()) {
    new_mapview_height = $(window).height() - height_offset;
  } else {
    new_mapview_height = $(window).height() - height_offset - 40;
  }

  console.log("Three.js " + THREE.REVISION + " with WebGPU Renderer");
  THREE.ColorManagement.enabled = true;

  container = document.getElementById('mapcanvas');
  camera = new THREE.PerspectiveCamera( 45, new_mapview_width / new_mapview_height, 1, 12000 );
  scene = new THREE.Scene();

  raycaster = new THREE.Raycaster();
  raycaster.layers.set(6);

  mouse = new THREE.Vector2();

  // Use THREE.Timer instead of deprecated THREE.Clock
  if (!clock) {
    clock = new THREE.Timer();
  }

  // Lights - Set up lighting for both terrain and 3D objects
  
  // Ambient light provides base illumination for the entire scene
  var ambientLight = new THREE.AmbientLight( 0x606060, 28 * Math.PI );
  ambientLight.name = "ambient_light";
  scene.add(ambientLight);

  // Directional light for general scene lighting (better WebGPU compatibility)
  var directionalLight = new THREE.DirectionalLight( 0xffffff, 2.0 * Math.PI );
  directionalLight.position.set(100, 200, 100);
  directionalLight.name = "directional_light";
  scene.add(directionalLight);

  // Spotlight for focused lighting and shadows
  spotlight = new THREE.SpotLight( 0xffffff, 3.0 * Math.PI, 0, Math.PI / 3, 0.001, 0.5);
  spotlight.name = "spotlight";
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

  // Create WebGPU Renderer
  maprenderer = new THREE.WebGPURenderer( { antialias: enable_antialiasing, preserveDrawingBuffer: true } );
  maprenderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  maprenderer.frustumCulled = true;
  maprenderer.setAnimationLoop(animate_webgl);

  maprenderer.setPixelRatio(window.devicePixelRatio);
  maprenderer.setSize(new_mapview_width, new_mapview_height);
  container.appendChild(maprenderer.domElement);

  if (anaglyph_3d_enabled) {
    console.log("Anaglyph 3D is not yet supported with WebGPU renderer");
    anaglyph_3d_enabled = false;
  }

  if (is_small_screen()) {
    camera_dy = camera_dy * 1.6;
  }

  $("#pregame_page").hide();
}

/****************************************************************************
 Add simple water mesh for WebGPU renderer.
 Uses basic material instead of complex physical material for better compatibility.
****************************************************************************/
function add_quality_dependent_objects_webgpu() {
  // Create simple water plane with basic material
  var waterGeometry = new THREE.PlaneGeometry( mapview_model_width, mapview_model_height);
  
  // Use MeshBasicMaterial with simple color and transparency for WebGPU compatibility
  var waterMaterial = new THREE.MeshBasicMaterial({
    color: 0x4a9fc7, // Light blue water color
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide
  });
  
  water_hq = new THREE.Mesh(waterGeometry, waterMaterial);
  water_hq.rotation.x = - Math.PI * 0.5;
  water_hq.translateOnAxis(new THREE.Vector3(0,0,1).normalize(), 50);
  water_hq.translateOnAxis(new THREE.Vector3(1,0,0).normalize(), Math.floor(mapview_model_width / 2) - 500);
  water_hq.translateOnAxis(new THREE.Vector3(0,1,0).normalize(), -mapview_model_height / 2);
  water_hq.renderOrder = -1; // Render water first
  water_hq.castShadow = false;
  water_hq.name = "water_surface";
  scene.add( water_hq );
  console.log("Added simple WebGPU water surface.");
}

/****************************************************************************
 This will render the map terrain mesh using WebGPU and TSL shaders.
****************************************************************************/
async function init_webgpu_mapview() {
  selected_unit_material = new THREE.MeshBasicMaterial( { color: 0xf6f7bf, transparent: true, opacity: 0.7} );

  /* uniforms are variables which are used in the shader */
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

  if (map.xsize > 200 || map.ysize > 200) {
    terrain_quality = 2;
  }

  init_heightmap(terrain_quality);
  update_heightmap(terrain_quality);

  // Create low-resolution mesh for raycasting
  var lofiMaterial = new THREE.MeshBasicMaterial( {color: 0x00aa00, transparent: true, opacity: 0} );
  lofiGeometry = new THREE.BufferGeometry();
  lofiGeometry.name = "lofi_terrain_geometry";
  init_land_geometry(lofiGeometry, 2);
  update_land_geometry(lofiGeometry, 2);
  lofiMesh = new THREE.Mesh(lofiGeometry, lofiMaterial);
  lofiMesh.layers.set(6);
  lofiMesh.name = "raycaster_mesh";
  scene.add(lofiMesh);

  // Create node-based material for WebGPU using TSL shader
  console.log("Creating WebGPU terrain shader with TSL...");
  
  // Create the TSL shader node
  const terrainColorNode = createTerrainShaderTSL(freeciv_uniforms);
  
  // Create MeshBasicNodeMaterial with the shader
  terrain_material = new THREE.MeshBasicNodeMaterial();
  terrain_material.colorNode = terrainColorNode;
  terrain_material.side = THREE.FrontSide;
  terrain_material.transparent = false;

  landGeometry = new THREE.BufferGeometry();
  landGeometry.name = "land_terrain_geometry";
  init_land_geometry(landGeometry, terrain_quality);
  update_land_geometry(landGeometry, terrain_quality);
  landMesh = new THREE.Mesh( landGeometry, terrain_material );
  landMesh.receiveShadow = false;
  landMesh.castShadow = false;
  landMesh.name = "land_terrain_mesh";
  scene.add(landMesh);
  console.log("Land mesh triangles: " + landGeometry.index.count / 3);

  if (graphics_quality === QUALITY_HIGH) {
    var shadowMaterial = new THREE.ShadowMaterial();
    shadowMaterial.opacity = 0.92;
    shadowmesh = new THREE.Mesh( landGeometry, shadowMaterial);
    shadowmesh.receiveShadow = true;
    shadowmesh.castShadow = false;
    shadowmesh.name = "shadow_mesh";
    scene.add(shadowmesh);
  }

  update_map_terrain_geometry();
  setInterval(update_map_terrain_geometry, 40);

  setInterval(update_map_known_tiles, 15);

  add_quality_dependent_objects_webgpu();

  add_all_objects_to_scene();

  benchmark_start = new Date().getTime();
}
