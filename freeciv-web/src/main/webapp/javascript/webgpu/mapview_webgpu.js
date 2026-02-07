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
/**
 * Initializes and starts the WebGPU renderer for the Freeciv map view.
 * Sets up the Three.js scene with camera, lighting, and renderer configuration.
 * Uses centralized configuration from config.js for consistent settings.
 */
function webgpu_start_renderer()
{
  // Calculate viewport dimensions
  const new_mapview_width = $(window).width() - width_offset;
  const new_mapview_height = is_small_screen() 
    ? $(window).height() - height_offset - 40
    : $(window).height() - height_offset;

  console.log("Three.js " + THREE.REVISION + " with WebGPU Renderer");
  THREE.ColorManagement.enabled = true;

  container = document.getElementById('mapcanvas');
  
  // Use CameraConfig for consistent camera settings
  const camConfig = window.CameraConfig || { FOV: 45, NEAR: 1, FAR: 12000 };
  camera = new THREE.PerspectiveCamera(
    camConfig.FOV, 
    new_mapview_width / new_mapview_height, 
    camConfig.NEAR, 
    camConfig.FAR
  );
  scene = new THREE.Scene();

  raycaster = new THREE.Raycaster();
  raycaster.layers.set(6);

  mouse = new THREE.Vector2();

  // Use THREE.Timer instead of deprecated THREE.Clock
  if (!clock) {
    clock = new THREE.Timer();
  }

  // Set up scene lighting using LightingConfig
  setupSceneLighting();

  // Determine antialiasing based on quality settings
  let enable_antialiasing = graphics_quality >= QUALITY_MEDIUM;
  const stored_antialiasing_setting = simpleStorage.get("antialiasing_setting", "");
  if (stored_antialiasing_setting !== null && stored_antialiasing_setting === "false") {
    enable_antialiasing = false;
  }

  // Create WebGPU Renderer with shadow map support
  maprenderer = new THREE.WebGPURenderer({ 
    antialias: enable_antialiasing, 
    preserveDrawingBuffer: true 
  });
  maprenderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  maprenderer.frustumCulled = true;
  maprenderer.setAnimationLoop(animate_webgl);
  
  // Enable shadow maps for rendering shadows from lights onto geometry
  maprenderer.shadowMap.enabled = true;
  maprenderer.shadowMap.type = THREE.PCFSoftShadowMap;

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

/**
 * Sets up the scene lighting with ambient, directional, point, and spot lights.
 * Uses centralized LightingConfig and ShadowConfig for consistent settings.
 * @private
 */
function setupSceneLighting() {
  // Get configuration or use inline defaults for backwards compatibility
  const lightConfig = window.LightingConfig || {
    AMBIENT_COLOR: 0x606060,
    AMBIENT_INTENSITY: 1.2 * Math.PI,
    DIRECTIONAL_COLOR: 0xffffff,
    DIRECTIONAL_INTENSITY: 2.0 * Math.PI,
    DIRECTIONAL_POSITION: { x: 500, y: 800, z: 500 },
    KEY_LIGHT_COLOR: 0xffffff,
    KEY_LIGHT_INTENSITY: 1.0 * Math.PI,
    KEY_LIGHT_POSITION: { x: 150, y: 280, z: 150 },
    FILL_LIGHT_COLOR: 0xffffff,
    FILL_LIGHT_INTENSITY: 0.6 * Math.PI,
    FILL_LIGHT_POSITION: { x: -200, y: 180, z: -120 },
    SPOTLIGHT_COLOR: 0xffffff,
    SPOTLIGHT_INTENSITY: 3.0 * Math.PI,
    SPOTLIGHT_ANGLE: Math.PI / 3,
    SPOTLIGHT_PENUMBRA: 0.001,
    SPOTLIGHT_DECAY: 0.5
  };
  
  const shadowConfig = window.ShadowConfig || {
    MAP_SIZE: 4096,
    CAMERA_NEAR: 100,
    CAMERA_FAR: 3000,
    FRUSTUM_SIZE: 1500,
    BIAS: -0.0005,
    NORMAL_BIAS: 0.02
  };

  // Ambient light provides base illumination for the entire scene
  const ambientLight = new THREE.AmbientLight(
    lightConfig.AMBIENT_COLOR, 
    lightConfig.AMBIENT_INTENSITY
  );
  ambientLight.name = "ambient_light";
  scene.add(ambientLight);

  // Directional light for general scene lighting and shadow casting
  directionalLight = new THREE.DirectionalLight(
    lightConfig.DIRECTIONAL_COLOR, 
    lightConfig.DIRECTIONAL_INTENSITY
  );
  directionalLight.position.set(
    lightConfig.DIRECTIONAL_POSITION.x,
    lightConfig.DIRECTIONAL_POSITION.y,
    lightConfig.DIRECTIONAL_POSITION.z
  );
  directionalLight.name = "directional_light";
  
  // Configure shadows for directional light
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = shadowConfig.MAP_SIZE;
  directionalLight.shadow.mapSize.height = shadowConfig.MAP_SIZE;
  directionalLight.shadow.camera.near = shadowConfig.CAMERA_NEAR;
  directionalLight.shadow.camera.far = shadowConfig.CAMERA_FAR;
  directionalLight.shadow.camera.left = -shadowConfig.FRUSTUM_SIZE;
  directionalLight.shadow.camera.right = shadowConfig.FRUSTUM_SIZE;
  directionalLight.shadow.camera.top = shadowConfig.FRUSTUM_SIZE;
  directionalLight.shadow.camera.bottom = -shadowConfig.FRUSTUM_SIZE;
  directionalLight.shadow.bias = shadowConfig.BIAS;
  directionalLight.shadow.normalBias = shadowConfig.NORMAL_BIAS;
  
  scene.add(directionalLight);
  scene.add(directionalLight.target);

  // Key light for additional illumination
  const keyLight = new THREE.PointLight(
    lightConfig.KEY_LIGHT_COLOR, 
    lightConfig.KEY_LIGHT_INTENSITY, 
    0, 
    2
  );
  keyLight.position.set(
    lightConfig.KEY_LIGHT_POSITION.x,
    lightConfig.KEY_LIGHT_POSITION.y,
    lightConfig.KEY_LIGHT_POSITION.z
  );
  keyLight.name = "key_light";
  scene.add(keyLight);

  // Fill light for softer shadows
  const fillLight = new THREE.PointLight(
    lightConfig.FILL_LIGHT_COLOR, 
    lightConfig.FILL_LIGHT_INTENSITY, 
    0, 
    2
  );
  fillLight.position.set(
    lightConfig.FILL_LIGHT_POSITION.x,
    lightConfig.FILL_LIGHT_POSITION.y,
    lightConfig.FILL_LIGHT_POSITION.z
  );
  fillLight.name = "fill_light";
  scene.add(fillLight);

  // Spotlight for focused lighting and shadows
  spotlight = new THREE.SpotLight(
    lightConfig.SPOTLIGHT_COLOR, 
    lightConfig.SPOTLIGHT_INTENSITY, 
    0, 
    lightConfig.SPOTLIGHT_ANGLE, 
    lightConfig.SPOTLIGHT_PENUMBRA, 
    lightConfig.SPOTLIGHT_DECAY
  );
  spotlight.name = "spotlight";
  spotlight.castShadow = true;
  spotlight.shadow.camera.near = shadowConfig.CAMERA_NEAR;
  spotlight.shadow.camera.far = shadowConfig.CAMERA_FAR;
  spotlight.shadow.bias = 0.0001;
  spotlight.shadow.mapSize.x = shadowConfig.MAP_SIZE;
  spotlight.shadow.mapSize.y = shadowConfig.MAP_SIZE;
  scene.add(spotlight);
}

/****************************************************************************
 Add animated water mesh for WebGPU renderer using TSL shaders.
 
 Design goals:
 - Fast: Reduced from 5 wave layers to 3 for better performance
 - Simple: Clean code structure with clear sections
 - Good looking: Maintains visual quality with optimized effects
 
 The water mesh covers the entire map, so performance is critical.
 This optimized shader uses:
 - 3 wave layers (primary swell, wind waves, ripples)
 - Single-pass specular calculation
 - Simplified foam and color gradients
****************************************************************************/
function add_quality_dependent_objects_webgpu() {
  // Create water plane geometry matching land mesh dimensions
  // Use moderate segments (128x128) - sufficient for visual quality, better performance
  var waterGeometry = new THREE.PlaneGeometry(
    mapview_model_width,
    mapview_model_height * HEX_HEIGHT_FACTOR,
    128,
    128
  );
  
  var waterMaterial = createWaterMaterialTSL();
  
  water_hq = new THREE.Mesh(waterGeometry, waterMaterial);
  water_hq.rotation.x = -Math.PI * 0.5;
  water_hq.translateOnAxis(new THREE.Vector3(0, 0, 1).normalize(), 50);
  water_hq.translateOnAxis(new THREE.Vector3(1, 0, 0).normalize(), Math.floor(mapview_model_width / 2) - 500);
  water_hq.translateOnAxis(new THREE.Vector3(0, 1, 0).normalize(), -Math.floor(mapview_model_height * HEX_HEIGHT_FACTOR / 2));
  water_hq.renderOrder = -1;
  water_hq.castShadow = false;
  water_hq.name = "water_surface";
  scene.add(water_hq);
  console.log("Added optimized WebGPU water surface.");
}

/****************************************************************************
 Create animated water material using TSL (Three.js Shading Language).
 
 Optimized for performance while maintaining visual appeal:
 - 3 wave layers instead of 5 (40% fewer wave calculations)
 - Simplified specular with single highlight pass
 - Efficient color gradients using fewer mix operations
 - Streamlined foam calculation
****************************************************************************/
function createWaterMaterialTSL() {
  const { uniform, uv, vec3, vec4, sin, cos, mix, fract, clamp, pow, sqrt, mul, add, sub } = THREE;
  
  // Time uniform for animation
  const timeUniform = uniform(0.0);
  window.waterTimeUniform = timeUniform;
  
  const uvNode = uv();
  
  // ==== WAVE CONFIGURATION ====
  // 3 optimized wave layers: primary swell, wind waves, and detail ripples
  const waves = [
    { dx: 1.0, dy: 0.3, freq: 8.0, speed: 0.5, amp: 0.4 },   // Primary ocean swell
    { dx: 0.4, dy: 1.0, freq: 14.0, speed: 0.7, amp: 0.25 }, // Secondary wind waves
    { dx: -0.5, dy: 0.7, freq: 22.0, speed: 1.0, amp: 0.15 } // Detail ripples
  ];
  
  // ==== COLORS ====
  const deepColor = vec3(0.02, 0.10, 0.25);    // Deep ocean
  const shallowColor = vec3(0.10, 0.40, 0.55); // Shallow water
  const foamColor = vec3(0.90, 0.95, 1.0);     // Wave foam
  const skyTint = vec3(0.40, 0.60, 0.80);      // Sky reflection
  
  // ==== CALCULATE WAVES ====
  // Simple wave function: amplitude * sin(direction · uv * freq + time * speed)
  function wave(w) {
    const phase = add(mul(add(mul(uvNode.x, w.dx), mul(uvNode.y, w.dy)), w.freq), mul(timeUniform, w.speed));
    return mul(w.amp, sin(phase));
  }
  
  const waveHeight = add(add(wave(waves[0]), wave(waves[1])), wave(waves[2]));
  const normalizedHeight = clamp(waveHeight, -1.0, 1.0);
  
  // ==== WAVE DERIVATIVES FOR NORMALS ====
  // Calculate derivatives for specular lighting
  function waveDeriv(w) {
    const phase = add(mul(add(mul(uvNode.x, w.dx), mul(uvNode.y, w.dy)), w.freq), mul(timeUniform, w.speed));
    return mul(mul(w.amp, w.freq), cos(phase));
  }
  
  const d0 = waveDeriv(waves[0]);
  const d1 = waveDeriv(waves[1]);
  const d2 = waveDeriv(waves[2]);
  
  // Surface normal approximation (scaled for visual effect)
  const nx = mul(add(add(mul(d0, waves[0].dx), mul(d1, waves[1].dx)), mul(d2, waves[2].dx)), -0.12);
  const nz = mul(add(add(mul(d0, waves[0].dy), mul(d1, waves[1].dy)), mul(d2, waves[2].dy)), -0.12);
  
  // ==== DEPTH-BASED COLOR ====
  const depthFactor = clamp(add(0.5, mul(normalizedHeight, 0.35)), 0.0, 1.0);
  const baseColor = mix(deepColor, shallowColor, depthFactor);
  
  // ==== FRESNEL (edge brightness) ====
  const cx = sub(uvNode.x, 0.5);
  const cy = sub(uvNode.y, 0.5);
  const dist = sqrt(add(mul(cx, cx), mul(cy, cy)));
  const fresnel = clamp(mul(pow(dist, 2.5), 0.5), 0.0, 0.3);
  const colorWithFresnel = mix(baseColor, skyTint, fresnel);
  
  // ==== SPECULAR HIGHLIGHT ====
  // Sun reflection based on wave normals (simplified single-pass)
  const sunDot = clamp(add(mul(nx, 0.5), add(0.8, mul(nz, 0.5))), 0.0, 1.0);
  const specular = mul(pow(sunDot, 48.0), 0.5);
  const specularColor = mul(vec3(1.0, 0.98, 0.92), specular);
  
  // ==== FOAM ====
  // Simple foam on wave peaks using pseudo-noise
  const noiseInput = add(mul(uvNode.x, 20.0), mul(timeUniform, 0.2));
  const noise = fract(mul(sin(add(noiseInput, mul(uvNode.y, 15.0))), 43758.5453));
  const foamMask = clamp(mul(sub(normalizedHeight, 0.2), 3.0), 0.0, 1.0);
  const foamAmount = clamp(mul(foamMask, add(0.5, mul(noise, 0.5))), 0.0, 0.35);
  const colorWithFoam = mix(colorWithFresnel, foamColor, foamAmount);
  
  // ==== FINAL COMPOSITION ====
  const finalColor = add(colorWithFoam, specularColor);
  
  // Opacity varies slightly with wave height
  const opacity = clamp(add(0.65, mul(normalizedHeight, 0.06)), 0.55, 0.75);
  
  // Create material
  const waterMaterial = new THREE.MeshBasicNodeMaterial();
  waterMaterial.colorNode = vec4(finalColor, opacity);
  waterMaterial.transparent = true;
  waterMaterial.side = THREE.DoubleSide;
  waterMaterial.depthWrite = false;
  
  return waterMaterial;
}

/****************************************************************************
 Update water animation time uniform. Called from render loop.
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
 @param {number} deltaTime - Time since last frame in seconds
****************************************************************************/
function updateSelectedUnitAnimation(deltaTime) {
  if (window.selectedUnitTimeUniform && window.selectedUnitTimeUniform.value !== undefined) {
    window.selectedUnitTimeUniform.value += deltaTime;
  }
}

/****************************************************************************
 Initializes the WebGPU map view with terrain mesh, materials, and shaders.
 This is the main entry point for setting up the terrain rendering pipeline.
 
 @returns {Promise<void>}
****************************************************************************/
async function init_webgpu_mapview() {
  // Create WebGPU-compatible selected unit material with pulsing effect
  selected_unit_material = createSelectedUnitMaterial();

  // Set up shader uniforms for terrain rendering
  freeciv_uniforms = createTerrainUniforms();

  // Adjust terrain quality for large maps to maintain performance
  if (map.xsize > 200 || map.ysize > 200) {
    terrain_quality = 2;
  }

  init_heightmap(terrain_quality);
  update_heightmap(terrain_quality);

  // Create low-resolution mesh for raycasting (invisible, used for picking)
  const lofiMaterial = typeof createBasicMaterial === 'function'
    ? createBasicMaterial(0x00aa00, { transparent: true, opacity: 0 })
    : new THREE.MeshBasicMaterial({ color: 0x00aa00, transparent: true, opacity: 0 });
  
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

  // Create the terrain land mesh
  landGeometry = new THREE.BufferGeometry();
  landGeometry.name = "land_terrain_geometry";
  init_land_geometry(landGeometry, terrain_quality);
  update_land_geometry(landGeometry, terrain_quality);
  landMesh = new THREE.Mesh(landGeometry, terrain_material);
  landMesh.receiveShadow = false;
  landMesh.castShadow = false;
  landMesh.name = "land_terrain_mesh";
  scene.add(landMesh);
  console.log("Land mesh triangles: " + landGeometry.index.count / 3);

  // Create shadow mesh for medium+ quality settings
  if (graphics_quality >= QUALITY_MEDIUM) {
    const shadowConfig = window.ShadowConfig || { OPACITY_HIGH: 0.75, OPACITY_MEDIUM: 0.55 };
    const shadowOpacity = (graphics_quality === QUALITY_HIGH) 
      ? shadowConfig.OPACITY_HIGH 
      : shadowConfig.OPACITY_MEDIUM;
    
    const shadowMaterial = typeof createShadowMaterial === 'function'
      ? createShadowMaterial({ opacity: shadowOpacity })
      : new THREE.ShadowMaterial({ opacity: shadowOpacity });
    
    shadowmesh = new THREE.Mesh(landGeometry, shadowMaterial);
    shadowmesh.receiveShadow = true;
    shadowmesh.castShadow = false;
    shadowmesh.name = "shadow_mesh";
    scene.add(shadowmesh);
    console.log("Shadow mesh enabled for terrain shadow receiving");
  }

  // Set up terrain geometry updates
  update_map_terrain_geometry();
  setInterval(update_map_terrain_geometry, 40);
  setInterval(update_map_known_tiles, 15);

  // Add water and other quality-dependent objects
  add_quality_dependent_objects_webgpu();
  add_all_objects_to_scene();

  benchmark_start = new Date().getTime();
}

/**
 * Creates the uniform objects for the terrain shader.
 * Centralizes uniform creation for better maintainability.
 * 
 * @returns {Object} Uniform object for terrain shader
 * @private
 */
function createTerrainUniforms() {
  const uniforms = {
    maptiles: { type: "t", value: maptiletypes },
    borders: { type: "t", value: borders_texture },
    map_x_size: { type: "f", value: map['xsize'] },
    map_y_size: { type: "f", value: map['ysize'] },
    mouse_x: { type: "i", value: -1 },
    mouse_y: { type: "i", value: -1 },
    selected_x: { type: "i", value: -1 },
    selected_y: { type: "i", value: -1 },
    roadsmap: { type: "t", value: roads_texture },
    roadsprites: { type: "t", value: webgl_textures["roads"] },
    railroadsprites: { type: "t", value: webgl_textures["railroads"] },
    borders_visible: { type: "bool", value: server_settings['borders']['is_visible'] }
  };

  // Add terrain textures
  for (let i = 0; i < tiletype_terrains.length; i++) {
    const terrain_name = tiletype_terrains[i];
    uniforms[terrain_name] = { type: "t", value: webgl_textures[terrain_name] };
  }

  return uniforms;
}
