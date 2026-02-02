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

  clock = new THREE.Clock();

  // Lights
  var ambientLight = new THREE.AmbientLight( 0x606060, 28 * Math.PI );
  ambientLight.name = "ambient_light";
  scene.add(ambientLight);

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
 This will render the map terrain mesh using WebGPU and TSL shaders.
****************************************************************************/
async function init_webgpu_mapview() {
  selected_unit_material = new THREE.MeshBasicMaterial( { color: 0xf6f7bf, transparent: true, opacity: 0.7} );

  /* Import TSL functions for shader nodes */
  const { texture, uniform, positionLocal, normalLocal, color, uv, 
          vec2, vec3, vec4, float, int, mix, step, smoothstep } = THREE;

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

  // Create low-resolution mesh for raycasting
  lofiGeometry = new THREE.PlaneGeometry( mapview_model_width, mapview_model_height, map['xsize'], map['ysize']);
  lofiGeometry.rotateX( - Math.PI / 2 );
  var lofiMaterial = new THREE.MeshBasicMaterial( {color: 0x00aa00, transparent: true, opacity: 0} );
  lofiMesh = new THREE.Mesh(lofiGeometry, lofiMaterial);
  lofiMesh.layers.set(6);
  lofiMesh.name = "raycaster_mesh";
  scene.add(lofiMesh);

  if (map.xsize > 200 || map.ysize > 200) {
    terrain_quality = 2;
  }

  // For WebGPU, we use NodeMaterial with TSL (Three.js Shading Language)
  // Create a basic material that works similarly to the WebGL shader
  const vertColorNode = color(positionLocal);
  
  // Create node-based material for WebGPU
  terrain_material = new THREE.MeshBasicNodeMaterial();
  terrain_material.colorNode = vertColorNode;

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

  add_quality_dependent_objects_webgl();

  add_all_objects_to_scene();

  benchmark_start = new Date().getTime();
}
