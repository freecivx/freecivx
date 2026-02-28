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
  const new_mapview_height = $(window).height() - height_offset;

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

  // Initialize THREE.Timer for frame timing
  if (!timer) {
    timer = new THREE.Timer();
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
  // Note: preserveDrawingBuffer is set to false for better performance
  // Screenshots are handled specially by capturing canvas immediately after render
  maprenderer = new THREE.WebGPURenderer({ 
    antialias: enable_antialiasing, 
    preserveDrawingBuffer: false 
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

  if ($(window).width() <= 800) {
    camera_dy = camera_dy * 1.5;
  } else {
    camera.position.y -= 50;
    camera.position.z += 250;
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
  // These values should match config.js LightingConfig for consistency
  const lightConfig = window.LightingConfig || {
    AMBIENT_COLOR: 0x707065,
    AMBIENT_INTENSITY: 1.1 * Math.PI,  // Increased by 10% (was 1.0 * Math.PI)
    DIRECTIONAL_COLOR: 0xfffaf0,
    DIRECTIONAL_INTENSITY: 1.6 * Math.PI,
    DIRECTIONAL_POSITION: { x: 500, y: 800, z: 500 },
    KEY_LIGHT_COLOR: 0xffffff,
    KEY_LIGHT_INTENSITY: 0.6 * Math.PI,
    KEY_LIGHT_POSITION: { x: 150, y: 280, z: 150 },
    FILL_LIGHT_COLOR: 0xe8e8ff,
    FILL_LIGHT_INTENSITY: 0.35 * Math.PI,
    FILL_LIGHT_POSITION: { x: -200, y: 180, z: -120 },
    SPOTLIGHT_COLOR: 0xffffff,
    SPOTLIGHT_INTENSITY: 2.0 * Math.PI,
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
  
  // Use appropriate heightmap update based on map topology
  var useHexTopology = typeof is_hex === 'function' && is_hex();
  
  if (useHexTopology) {
    update_heightmap(terrain_quality);
  } else if (typeof update_heightmap_square === 'function') {
    update_heightmap_square(terrain_quality);
  } else {
    // Fallback to hex
    update_heightmap(terrain_quality);
  }

  // Create low-resolution mesh for raycasting (invisible, used for picking)
  const lofiMaterial = typeof createBasicMaterial === 'function'
    ? createBasicMaterial(0x00aa00, { transparent: true, opacity: 0 })
    : new THREE.MeshBasicMaterial({ color: 0x00aa00, transparent: true, opacity: 0 });
  
  lofiGeometry = new THREE.BufferGeometry();
  lofiGeometry.name = "lofi_terrain_geometry";
  
  // Use appropriate geometry initialization based on map topology
  if (useHexTopology) {
    init_land_geometry(lofiGeometry, 2);
    update_land_geometry(lofiGeometry, 2);
  } else if (typeof init_land_geometry_square === 'function') {
    init_land_geometry_square(lofiGeometry, 2);
    update_land_geometry_square(lofiGeometry, 2);
  } else {
    // Fallback to hex if square functions not available
    init_land_geometry(lofiGeometry, 2);
    update_land_geometry(lofiGeometry, 2);
  }
  
  lofiMesh = new THREE.Mesh(lofiGeometry, lofiMaterial);
  lofiMesh.layers.set(6);
  lofiMesh.name = "raycaster_mesh";
  scene.add(lofiMesh);

  // Create node-based material for WebGPU using TSL shader
  // Use appropriate shader based on map topology (hex vs square)
  var terrainColorNode;
  
  if (useHexTopology) {
    console.log("Creating WebGPU terrain shader with TSL (Hex topology)...");
    terrainColorNode = createTerrainShaderTSL(freeciv_uniforms);
  } else if (typeof createTerrainShaderSquareTSL === 'function') {
    console.log("Creating WebGPU terrain shader with TSL (Square topology)...");
    terrainColorNode = createTerrainShaderSquareTSL(freeciv_uniforms);
  } else {
    // Fallback to hex shader if square shader not available
    console.log("Creating WebGPU terrain shader with TSL (Fallback to Hex)...");
    terrainColorNode = createTerrainShaderTSL(freeciv_uniforms);
  }
  
  // Create MeshStandardNodeMaterial with the shader
  // StandardNodeMaterial is required to enable shadow receiving on terrain
  // The terrain shader provides custom slope-based lighting, while StandardNodeMaterial handles shadows
  terrain_material = new THREE.MeshStandardNodeMaterial();
  terrain_material.colorNode = terrainColorNode;
  terrain_material.side = THREE.FrontSide;
  terrain_material.transparent = false;

  // Create the terrain land mesh
  landGeometry = new THREE.BufferGeometry();
  landGeometry.name = "land_terrain_geometry";
  
  if (useHexTopology) {
    init_land_geometry(landGeometry, terrain_quality);
    update_land_geometry(landGeometry, terrain_quality);
  } else if (typeof init_land_geometry_square === 'function') {
    init_land_geometry_square(landGeometry, terrain_quality);
    update_land_geometry_square(landGeometry, terrain_quality);
  } else {
    // Fallback to hex
    init_land_geometry(landGeometry, terrain_quality);
    update_land_geometry(landGeometry, terrain_quality);
  }
  
  landMesh = new THREE.Mesh(landGeometry, terrain_material);
  // Enable shadow receiving on terrain to display shadows cast by units, buildings, and other objects
  // MeshStandardNodeMaterial with the node system supports shadow receiving in Three.js
  landMesh.receiveShadow = true;
  landMesh.castShadow = false;
  landMesh.name = "land_terrain_mesh";
  scene.add(landMesh);
  console.log("Land mesh triangles: " + landGeometry.index.count / 3);

  // Set up terrain geometry updates
  update_map_terrain_geometry();
  setInterval(update_map_terrain_geometry, 40);
  setInterval(update_map_known_tiles, 15);

  // Add water and other quality-dependent objects
  // Use appropriate water function based on map topology
  if (useHexTopology) {
    add_quality_dependent_objects_webgpu();
  } else if (typeof add_quality_dependent_objects_webgpu_square === 'function') {
    add_quality_dependent_objects_webgpu_square();
  } else {
    // Fallback to hex if square function not available
    add_quality_dependent_objects_webgpu();
  }
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
    terrain_layers: { type: "t", value: webgl_textures["terrain_layers"] },
    terrain_atlas: { type: "t", value: webgl_textures["terrain_atlas"] },
    borders_visible: { type: "bool", value: server_settings['borders']['is_visible'] }
  };

  // Count and log texture usage
  const textureBindings = Object.entries(uniforms).filter(([key, value]) => value.type === "t");
  const textureCount = textureBindings.length;
  const maxTextures = 16; // WebGPU/WebGL texture binding limit
  
  console.log(`Terrain mesh textures: ${textureCount} / ${maxTextures} max`);
  console.log(`  Texture bindings: ${textureBindings.map(([key]) => key).join(', ')}`);
  
  // Log details about array textures
  if (webgl_textures["terrain_atlas"] && webgl_textures["terrain_atlas"].image) {
    const terrainNames = typeof tiletype_terrains !== 'undefined' ? tiletype_terrains.join(', ') : 'not loaded';
    console.log(`  terrain_atlas: ${webgl_textures["terrain_atlas"].image.depth} layers (${terrainNames})`);
  }
  if (webgl_textures["terrain_layers"] && webgl_textures["terrain_layers"].image) {
    console.log(`  terrain_layers: ${webgl_textures["terrain_layers"].image.depth} layers (arctic, tundra, farmland, irrigation)`);
  }

  return uniforms;
}
