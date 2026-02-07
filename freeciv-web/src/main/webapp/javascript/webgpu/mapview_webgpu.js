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
  // Using physically-based intensity values for WebGPU compatibility
  var ambientLight = new THREE.AmbientLight( 0x606060, 1.2 * Math.PI );
  ambientLight.name = "ambient_light";
  scene.add(ambientLight);

  // Directional light for general scene lighting (better WebGPU compatibility)
  var directionalLight = new THREE.DirectionalLight( 0xffffff, 2.0 * Math.PI );
  directionalLight.position.set(100, 200, 100);
  directionalLight.name = "directional_light";
  scene.add(directionalLight);

  // Additional point lights to validate WebGPU lighting coverage
  var keyLight = new THREE.PointLight(0xffffff, 1.0 * Math.PI, 0, 2);
  keyLight.position.set(150, 280, 150);
  keyLight.name = "key_light";
  scene.add(keyLight);

  var fillLight = new THREE.PointLight(0xffffff, 0.6 * Math.PI, 0, 2);
  fillLight.position.set(-200, 180, -120);
  fillLight.name = "fill_light";
  scene.add(fillLight);

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
 Add animated water mesh for WebGPU renderer using TSL shaders.
 Creates a realistic water effect with animated waves, color variation, and specular highlights.
****************************************************************************/
function add_quality_dependent_objects_webgpu() {
  // Create water plane geometry with more segments for smoother waves
  var waterGeometry = new THREE.PlaneGeometry(mapview_model_width, mapview_model_height, 128, 128);
  
  // Create animated water material using TSL (Three.js Shading Language)
  var waterMaterial = createWaterMaterialTSL();
  
  water_hq = new THREE.Mesh(waterGeometry, waterMaterial);
  water_hq.rotation.x = - Math.PI * 0.5;
  water_hq.translateOnAxis(new THREE.Vector3(0,0,1).normalize(), 50);
  water_hq.translateOnAxis(new THREE.Vector3(1,0,0).normalize(), Math.floor(mapview_model_width / 2) - 500);
  water_hq.translateOnAxis(new THREE.Vector3(0,1,0).normalize(), mapview_model_height / 2);
  water_hq.renderOrder = -1; // Render water first
  water_hq.castShadow = false;
  water_hq.name = "water_surface";
  scene.add(water_hq);
  console.log("Added animated WebGPU water surface with TSL shader.");
}

/****************************************************************************
 Create animated water material using TSL (Three.js Shading Language).
 Features:
 - Animated wave displacement
 - Color variation based on depth
 - Specular highlights from sun direction
 - Transparency with depth-based opacity
****************************************************************************/
function createWaterMaterialTSL() {
  const {
    uniform, positionLocal, uv, time,
    vec2, vec3, vec4,
    sin, cos, mix, fract, dot, abs, clamp, pow,
    mul, add, sub, div
  } = THREE;
  
  // =========================================================================
  // WATER WAVE PARAMETERS
  // =========================================================================
  // Wave 1: Primary wave moving along X-axis
  const WAVE1_FREQUENCY = 15.0;   // Spatial frequency (waves per unit)
  const WAVE1_SPEED = 0.8;        // Animation speed multiplier
  const WAVE1_AMPLITUDE = 0.3;    // Wave height contribution
  
  // Wave 2: Secondary wave moving along Y-axis
  const WAVE2_FREQUENCY = 12.0;
  const WAVE2_SPEED = 0.6;
  const WAVE2_AMPLITUDE = 0.25;
  
  // Wave 3: Diagonal wave for complexity
  const WAVE3_FREQUENCY = 8.0;
  const WAVE3_SPEED = 1.2;
  const WAVE3_AMPLITUDE = 0.15;
  
  // Specular and foam parameters
  const SPECULAR_POWER = 16.0;    // Shininess exponent
  const SPECULAR_INTENSITY = 0.4; // Specular brightness
  const FOAM_THRESHOLD = 0.2;     // Wave height where foam starts
  const FOAM_SCALE = 3.0;         // Foam intensity multiplier
  const FOAM_MAX = 0.3;           // Maximum foam contribution
  
  // Opacity parameters
  const BASE_OPACITY = 0.55;
  const OPACITY_VARIATION = 0.08;
  const OPACITY_MIN = 0.45;
  const OPACITY_MAX = 0.7;
  
  // =========================================================================
  // WATER COLORS
  // =========================================================================
  const deepColor = vec3(0.05, 0.15, 0.35);   // Deep blue
  const shallowColor = vec3(0.15, 0.45, 0.65); // Light blue-cyan
  const foamColor = vec3(0.85, 0.95, 1.0);     // White foam
  
  // Time uniform for animation
  const timeUniform = uniform(0.0);
  
  // Store reference for animation updates
  if (!window.waterTimeUniform) {
    window.waterTimeUniform = timeUniform;
  }
  
  // Get UV and position
  const uvNode = uv();
  const posNode = positionLocal;
  
  // Create animated wave pattern using multiple sine waves
  const wave1 = mul(sin(add(mul(uvNode.x, WAVE1_FREQUENCY), mul(timeUniform, WAVE1_SPEED))), WAVE1_AMPLITUDE);
  const wave2 = mul(sin(add(mul(uvNode.y, WAVE2_FREQUENCY), mul(timeUniform, WAVE2_SPEED))), WAVE2_AMPLITUDE);
  const wave3 = mul(sin(add(mul(add(uvNode.x, uvNode.y), WAVE3_FREQUENCY), mul(timeUniform, WAVE3_SPEED))), WAVE3_AMPLITUDE);
  const wavePattern = add(add(wave1, wave2), wave3);
  
  // Calculate "depth" based on distance from center for color variation
  const centerDist = mul(abs(sub(uvNode.x, 0.5)), 2.0);
  const depthFactor = clamp(add(0.3, mul(wavePattern, 0.1)), 0.0, 1.0);
  
  // Mix between deep and shallow water colors
  const baseColor = mix(deepColor, shallowColor, depthFactor);
  
  // Add specular highlight from sun direction (simulated)
  const sunDir = vec3(0.5, 0.8, 0.3);
  const viewDir = vec3(0.0, 1.0, 0.0);
  const halfDir = vec3(0.25, 0.9, 0.15);
  
  // Calculate specular using wave pattern to simulate surface normals
  const specularIntensity = pow(clamp(add(0.5, mul(wavePattern, 0.3)), 0.0, 1.0), SPECULAR_POWER);
  const specular = mul(vec3(1.0, 1.0, 0.9), mul(specularIntensity, SPECULAR_INTENSITY));
  
  // Add subtle foam on wave peaks
  const foamThreshold = clamp(mul(sub(wavePattern, FOAM_THRESHOLD), FOAM_SCALE), 0.0, FOAM_MAX);
  const colorWithFoam = mix(baseColor, foamColor, foamThreshold);
  
  // Combine base color with specular
  const finalColor = add(colorWithFoam, specular);
  
  // Animated opacity with subtle variation
  const opacityVariation = mul(sin(add(mul(timeUniform, 0.5), mul(uvNode.x, 5.0))), OPACITY_VARIATION);
  const finalOpacity = clamp(add(BASE_OPACITY, opacityVariation), OPACITY_MIN, OPACITY_MAX);
  
  // Create output color with transparency
  const outputColor = vec4(finalColor, finalOpacity);
  
  // Create MeshBasicNodeMaterial with animated water shader
  const waterMaterial = new THREE.MeshBasicNodeMaterial();
  waterMaterial.colorNode = outputColor;
  waterMaterial.transparent = true;
  waterMaterial.side = THREE.DoubleSide;
  waterMaterial.depthWrite = false;
  
  return waterMaterial;
}

/****************************************************************************
 Update water animation time uniform. Call this from the render loop.
****************************************************************************/
function updateWaterAnimation(deltaTime) {
  if (window.waterTimeUniform && window.waterTimeUniform.value !== undefined) {
    window.waterTimeUniform.value += deltaTime;
  }
}

/****************************************************************************
 Create selected unit indicator material using TSL for WebGPU compatibility.
 Creates a pulsing ring effect with proper transparency.
****************************************************************************/
function createSelectedUnitMaterial() {
  const { uniform, vec4, sin, mul, add, clamp } = THREE;
  
  // Time uniform for pulsing animation
  const timeUniform = uniform(0.0);
  window.selectedUnitTimeUniform = timeUniform;
  
  // Create pulsing color effect (yellow-white)
  const baseColor = vec4(0.97, 0.97, 0.75, 0.7); // Light yellow
  const pulseIntensity = mul(add(sin(mul(timeUniform, 3.0)), 1.0), 0.15);
  const pulsedColor = vec4(
    clamp(add(baseColor.r, pulseIntensity), 0.0, 1.0),
    clamp(add(baseColor.g, pulseIntensity), 0.0, 1.0),
    clamp(add(baseColor.b, pulseIntensity), 0.0, 1.0),
    baseColor.a
  );
  
  // Create WebGPU-compatible node material
  const material = new THREE.MeshBasicNodeMaterial();
  material.colorNode = pulsedColor;
  material.transparent = true;
  material.side = THREE.DoubleSide;
  material.depthWrite = false;
  
  return material;
}

/****************************************************************************
 Update selected unit animation. Call this from the render loop.
****************************************************************************/
function updateSelectedUnitAnimation(deltaTime) {
  if (window.selectedUnitTimeUniform && window.selectedUnitTimeUniform.value !== undefined) {
    window.selectedUnitTimeUniform.value += deltaTime;
  }
}

/****************************************************************************
 This will render the map terrain mesh using WebGPU and TSL shaders.
****************************************************************************/
async function init_webgpu_mapview() {
  // Create WebGPU-compatible selected unit material with pulsing effect
  selected_unit_material = createSelectedUnitMaterial();

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
