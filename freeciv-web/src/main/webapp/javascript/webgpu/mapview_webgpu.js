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

  // Adjust camera distance for smaller screens
  if ($(window).width() <= 800) {
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
  // These values should match config.js LightingConfig for consistency
  const lightConfig = window.LightingConfig || {
    AMBIENT_COLOR: 0x707065,
    AMBIENT_INTENSITY: 0.9 * Math.PI,
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
 Add animated water mesh for WebGPU renderer using TSL shaders.
 
 Design goals (Stylized Game Water - Civ-style):
 - Calm: Gentle, subtle movement instead of big ocean waves
 - Stylized: Color gradients and caustic patterns for visual interest
 - Fast: Efficient shader without heavy wave calculations
 - Game-appropriate: Works well at top-down/isometric strategy game camera angles
 
 This stylized water shader uses:
 - UV-scrolling patterns for gentle surface animation
 - Layered caustic/ripple effects
 - Gradient-based color transitions (deep to shallow)
 - Soft specular highlights without dramatic waves
****************************************************************************/
function add_quality_dependent_objects_webgpu() {
  // Create water plane geometry matching land mesh dimensions
  // Lower segment count (64x64) - stylized water doesn't need high tessellation
  var waterGeometry = new THREE.PlaneGeometry(
    mapview_model_width,
    mapview_model_height * HEX_HEIGHT_FACTOR,
    64,
    64
  );
  
  // Pass map data to water shader for visibility and river detection
  var waterMaterial = createWaterMaterialTSL(maptiletypes, map['xsize'], map['ysize']);
  
  water_hq = new THREE.Mesh(waterGeometry, waterMaterial);
  water_hq.rotation.x = -Math.PI * 0.5;
  water_hq.translateOnAxis(new THREE.Vector3(0, 0, 1).normalize(), 50);
  water_hq.translateOnAxis(new THREE.Vector3(1, 0, 0).normalize(), Math.floor(mapview_model_width / 2) - 500);
  water_hq.translateOnAxis(new THREE.Vector3(0, 1, 0).normalize(), -Math.floor(mapview_model_height * HEX_HEIGHT_FACTOR / 2));
  water_hq.renderOrder = -1;
  water_hq.castShadow = false;
  water_hq.name = "water_surface";
  scene.add(water_hq);
  console.log("Added stylized game water surface.");
}

/****************************************************************************
 Create stylized water material using TSL (Three.js Shading Language).
 
 Enhanced features:
 - Unknown map tiles render as black (fog of war support)
 - River tiles have distinct animated river flow effects
 - Coast/shoreline areas near land have wave foam and white water effects
 - Smooth color gradients from deep ocean to shallow coastal waters
 - Layered caustic/cell-noise for visual interest
 - Gentle specular highlights that don't dominate the scene
 
 @param {THREE.DataTexture} maptilesTex - Texture containing tile data (visibility in alpha, river in green)
 @param {number} mapXSize - Map width in tiles
 @param {number} mapYSize - Map height in tiles
****************************************************************************/
function createWaterMaterialTSL(maptilesTex, mapXSize, mapYSize) {
  const { texture, uniform, uv, vec2, vec3, vec4, sin, cos, mix, fract, clamp, pow, sqrt, mul, add, sub, abs, floor, max, min, mod, step, div } = THREE;
  
  // Time uniform for animation
  const timeUniform = uniform(0.0);
  window.waterTimeUniform = timeUniform;
  
  // Store reference to maptiles texture for the water shader
  // This is the same DataTexture used by the terrain shader (maptiletypes)
  // When the map is revealed, schedule_maptiles_texture_update() sets needsUpdate=true
  // which causes THREE.js to re-upload the texture data to the GPU on next render
  window.waterMaptilesTex = maptilesTex;
  
  // Map size uniforms
  const map_x_size = uniform(mapXSize);
  const map_y_size = uniform(mapYSize);
  
  const uvNode = uv();
  
  // ==== HEXAGONAL COORDINATE CALCULATIONS ====
  // Match the terrain shader's hex coordinate system for proper tile alignment
  const HEX_HEIGHT_FACTOR = 0.866025; // sqrt(3)/2
  
  // Calculate tile coordinates
  const tileYRaw = mul(map_y_size, uvNode.y);
  const tileY = floor(tileYRaw);
  const tileXRaw = mul(map_x_size, uvNode.x);
  const tileX = floor(tileXRaw);
  
  // Hex stagger: odd rows are offset
  const isOddRow = mod(sub(sub(map_y_size, 1.0), tileY), 2.0);
  const hexOffsetX = mul(isOddRow, div(0.5, map_x_size));
  const hexUvX = sub(uvNode.x, hexOffsetX);
  
  // Calculate tile center UV for texture sampling
  const tileCenterU = div(add(floor(mul(map_x_size, hexUvX)), 0.5), map_x_size);
  const tileCenterV = div(add(tileY, 0.5), map_y_size);
  const tileCenterUStaggered = add(tileCenterU, hexOffsetX);
  const tileCenterUV = vec2(tileCenterUStaggered, tileCenterV);
  
  // ==== SAMPLE MAPTILES TEXTURE ====
  // Red channel: terrain type (multiplied by 10 in game data)
  // Green channel: river flag (value of 10 indicates river present)
  // Blue channel: irrigation/farmland
  // Alpha channel: visibility (0=unknown, ~0.54=fogged, 1.0=visible)
  const tileData = texture(maptilesTex, tileCenterUV);
  const visibility = tileData.a;
  // River detection: green channel value of 10 (or higher) indicates river
  // step(9.5, x) returns 1 when x >= 10 (after floor), 0 otherwise
  const hasRiver = step(9.5, mul(tileData.g, 256.0));
  
  // Detect coast tiles (terrain type 20 = TERRAIN_COAST)
  const terrainType = floor(mul(tileData.r, 256.0));
  const isCoast = mul(step(19.5, terrainType), step(terrainType, 20.5));
  
  // ==== SAMPLE NEIGHBORS FOR SHORELINE DETECTION ====
  // Check if any adjacent tile is land (for shoreline foam effects)
  const neighborOffsetX = div(1.0, map_x_size);
  const neighborOffsetY = div(1.0, map_y_size);
  
  // Sample 4 cardinal neighbors
  const neighborE = texture(maptilesTex, vec2(add(tileCenterUV.x, neighborOffsetX), tileCenterUV.y));
  const neighborW = texture(maptilesTex, vec2(sub(tileCenterUV.x, neighborOffsetX), tileCenterUV.y));
  const neighborN = texture(maptilesTex, vec2(tileCenterUV.x, add(tileCenterUV.y, neighborOffsetY)));
  const neighborS = texture(maptilesTex, vec2(tileCenterUV.x, sub(tileCenterUV.y, neighborOffsetY)));
  
  // Detect if neighbors are land (terrain types >= 40 are land-based)
  // Water terrain types: INACCESSIBLE(0), LAKE(10), COAST(20), OCEAN/FLOOR(30)
  // Land terrain types: ARCTIC(40), DESERT(50), FOREST(60), GRASSLAND(70), etc.
  const isLandE = step(39.5, floor(mul(neighborE.r, 256.0)));
  const isLandW = step(39.5, floor(mul(neighborW.r, 256.0)));
  const isLandN = step(39.5, floor(mul(neighborN.r, 256.0)));
  const isLandS = step(39.5, floor(mul(neighborS.r, 256.0)));
  const nearLand = max(max(max(isLandE, isLandW), isLandN), isLandS);
  
  // ==== COLOR PALETTE (Stylized Game Colors) ====
  const deepOcean = vec3(0.04, 0.12, 0.28);     // Deep blue
  const midOcean = vec3(0.08, 0.25, 0.45);      // Medium blue  
  const shallowWater = vec3(0.15, 0.45, 0.55);  // Teal/turquoise
  const riverBlue = vec3(0.12, 0.35, 0.52);     // River water color
  const riverHighlight = vec3(0.25, 0.55, 0.68); // River surface highlights
  const causticColor = vec3(0.50, 0.75, 0.85);  // Caustic highlight
  const foamWhite = vec3(0.92, 0.95, 0.98);     // Shoreline foam color
  const unknownBlack = vec3(0.0, 0.0, 0.0);     // Unknown tile color
  
  // ==== PROCEDURAL NOISE FUNCTIONS ====
  function hash(p) {
    return fract(mul(sin(mul(p, 127.1)), 43758.5453));
  }
  
  function noise2D(x, y) {
    const ix = floor(x);
    const iy = floor(y);
    const fx = fract(x);
    const fy = fract(y);
    const ux = mul(mul(fx, fx), sub(3.0, mul(2.0, fx)));
    const uy = mul(mul(fy, fy), sub(3.0, mul(2.0, fy)));
    const a = hash(add(ix, mul(iy, 157.0)));
    const b = hash(add(add(ix, 1.0), mul(iy, 157.0)));
    const c = hash(add(ix, mul(add(iy, 1.0), 157.0)));
    const d = hash(add(add(ix, 1.0), mul(add(iy, 1.0), 157.0)));
    const mixAB = mix(a, b, ux);
    const mixCD = mix(c, d, ux);
    return mix(mixAB, mixCD, uy);
  }
  
  // ==== CAUSTIC PATTERN (Ocean) ====
  const causticScale = 12.0;
  const causticSpeed = 0.08;
  const causticU1 = add(mul(uvNode.x, causticScale), mul(timeUniform, causticSpeed));
  const causticV1 = add(mul(uvNode.y, causticScale), mul(timeUniform, mul(causticSpeed, 0.7)));
  const caustic1 = noise2D(causticU1, causticV1);
  const causticU2 = sub(mul(uvNode.x, mul(causticScale, 1.5)), mul(timeUniform, mul(causticSpeed, 0.5)));
  const causticV2 = add(mul(uvNode.y, mul(causticScale, 1.3)), mul(timeUniform, mul(causticSpeed, 0.3)));
  const caustic2 = noise2D(causticU2, causticV2);
  const causticPattern = mul(add(caustic1, caustic2), 0.5);
  const causticIntensity = clamp(mul(sub(causticPattern, 0.3), 2.5), 0.0, 1.0);
  
  // ==== RIVER FLOW ANIMATION ====
  // Faster, more linear flow pattern for rivers
  const riverFlowSpeed = 0.35;
  const riverFlowScale = 18.0;
  // Create directional flow (primarily along one axis to simulate current)
  const riverFlow1 = sin(add(mul(sub(uvNode.y, mul(uvNode.x, 0.3)), riverFlowScale), mul(timeUniform, riverFlowSpeed)));
  const riverFlow2 = sin(add(mul(sub(uvNode.y, mul(uvNode.x, 0.5)), mul(riverFlowScale, 1.3)), mul(timeUniform, mul(riverFlowSpeed, 1.2))));
  const riverFlowPattern = mul(add(riverFlow1, riverFlow2), 0.15);
  
  // River ripples (smaller scale, faster)
  const riverRippleScale = 30.0;
  const riverRipple = sin(add(mul(add(uvNode.x, uvNode.y), riverRippleScale), mul(timeUniform, 0.5)));
  const riverRippleIntensity = mul(riverRipple, 0.08);
  
  // ==== SHORELINE FOAM/WAVE ANIMATION ====
  // Animated foam that appears at the edge of land
  const foamSpeed = 0.25;
  const foamScale = 20.0;
  // Create wave-like foam pattern
  const foamWave1 = sin(add(mul(uvNode.x, foamScale), mul(timeUniform, foamSpeed)));
  const foamWave2 = sin(add(mul(uvNode.y, mul(foamScale, 0.8)), mul(timeUniform, mul(foamSpeed, 1.3))));
  const foamPattern = mul(add(add(foamWave1, foamWave2), 1.5), 0.33);
  
  // Foam intensity based on proximity to land (using noise for natural edge)
  const foamNoise = noise2D(mul(uvNode.x, 25.0), add(mul(uvNode.y, 25.0), mul(timeUniform, 0.1)));
  const foamIntensity = mul(mul(nearLand, foamPattern), clamp(add(foamNoise, 0.3), 0.0, 1.0));
  
  // ==== GENTLE SURFACE RIPPLES (Ocean) ====
  const rippleScale = 25.0;
  const rippleSpeed = 0.15;
  const ripple1 = sin(add(mul(add(mul(uvNode.x, 1.0), mul(uvNode.y, 0.5)), rippleScale), mul(timeUniform, rippleSpeed)));
  const ripple2 = sin(add(mul(add(mul(uvNode.x, 0.7), mul(uvNode.y, 1.0)), mul(rippleScale, 0.8)), mul(timeUniform, mul(rippleSpeed, 1.3))));
  const rippleValue = mul(add(ripple1, ripple2), 0.1);
  
  // ==== BASE OCEAN COLOR ====
  const positionFactor = mul(add(uvNode.x, uvNode.y), 0.3);
  const variation = add(positionFactor, rippleValue);
  const normalizedVariation = clamp(add(0.5, mul(variation, 0.2)), 0.0, 1.0);
  const deepToMid = mix(deepOcean, midOcean, clamp(mul(normalizedVariation, 1.5), 0.0, 1.0));
  const oceanBaseColor = mix(deepToMid, shallowWater, clamp(sub(mul(normalizedVariation, 1.5), 0.5), 0.0, 1.0));
  
  // ==== RIVER COLOR ====
  // River water is slightly different - more of a flowing appearance
  const riverBaseColor = mix(riverBlue, riverHighlight, clamp(add(riverFlowPattern, riverRippleIntensity), 0.0, 1.0));
  
  // ==== COMBINE BASE COLORS (Ocean vs River) ====
  const baseColor = mix(oceanBaseColor, riverBaseColor, hasRiver);
  
  // ==== ADD CAUSTIC HIGHLIGHTS (reduced for rivers) ====
  const causticStrength = mix(0.15, 0.05, hasRiver);
  const colorWithCaustics = mix(baseColor, causticColor, mul(causticIntensity, causticStrength));
  
  // ==== ADD SHORELINE FOAM ====
  // Blend foam at coastline areas near land
  const colorWithFoam = mix(colorWithCaustics, foamWhite, mul(foamIntensity, 0.45));
  
  // ==== GENTLE SPECULAR ====
  const specularBase = clamp(add(rippleValue, 0.5), 0.0, 1.0);
  const specular = mul(pow(specularBase, 8.0), 0.08);
  const specularTint = mul(vec3(1.0, 0.98, 0.95), specular);
  
  // ==== SURFACE SHIMMER ====
  const shimmerU = add(mul(uvNode.x, 40.0), mul(timeUniform, 0.2));
  const shimmerV = add(mul(uvNode.y, 35.0), mul(timeUniform, 0.15));
  const shimmer = mul(fract(mul(sin(add(shimmerU, shimmerV)), 43758.5)), 0.03);
  
  // ==== EDGE DARKENING (Vignette) ====
  const cx = sub(uvNode.x, 0.5);
  const cy = sub(uvNode.y, 0.5);
  const edgeDist = sqrt(add(mul(cx, cx), mul(cy, cy)));
  const edgeDarken = clamp(mul(edgeDist, 0.15), 0.0, 0.1);
  
  // ==== FINAL WATER COLOR COMPOSITION ====
  const colorWithSpecular = add(colorWithFoam, specularTint);
  const colorWithShimmer = add(colorWithSpecular, vec3(shimmer, shimmer, shimmer));
  const waterColor = sub(colorWithShimmer, vec3(edgeDarken, edgeDarken, edgeDarken));
  
  // ==== VISIBILITY HANDLING ====
  // The visibility value comes from maptiles texture alpha channel which updates
  // as the map is revealed during gameplay. The texture is automatically refreshed
  // by THREE.js when maptiletypes.needsUpdate = true is set.
  //
  // Unknown tiles (visibility = 0) should be rendered as black
  // Fogged tiles (~0.54) get slightly dimmed water
  // Visible tiles (1.0) show full water color
  //
  // The 1.5 multiplier amplifies fogged tiles (~0.54 -> ~0.81) for better visibility
  // while keeping fully visible tiles clamped at 1.0
  const visibilityFactor = clamp(mul(visibility, 1.5), 0.0, 1.0);
  const finalColor = mix(unknownBlack, waterColor, visibilityFactor);
  
  // Opacity: unknown tiles are fully opaque black, visible tiles have normal transparency
  // Use higher opacity for unknown areas to ensure solid black appearance
  const baseOpacity = 0.72;
  const unknownOpacity = 1.0;
  const finalOpacity = mix(unknownOpacity, baseOpacity, step(0.01, visibility));
  
  // Create material
  const waterMaterial = new THREE.MeshBasicNodeMaterial();
  waterMaterial.colorNode = vec4(finalColor, finalOpacity);
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
  
  // Create MeshStandardNodeMaterial with the shader - supports shadow receiving
  // The terrain shader provides the color, while the material handles shadow reception
  terrain_material = new THREE.MeshStandardNodeMaterial();
  terrain_material.colorNode = terrainColorNode;
  terrain_material.side = THREE.FrontSide;
  terrain_material.transparent = false;
  // Reduce default lighting influence since terrain shader has its own slope-based lighting
  terrain_material.roughness = 1.0;
  terrain_material.metalness = 0.0;

  // Create the terrain land mesh
  landGeometry = new THREE.BufferGeometry();
  landGeometry.name = "land_terrain_geometry";
  init_land_geometry(landGeometry, terrain_quality);
  update_land_geometry(landGeometry, terrain_quality);
  landMesh = new THREE.Mesh(landGeometry, terrain_material);
  // Enable shadow receiving for units and cities to cast shadows on terrain
  landMesh.receiveShadow = (graphics_quality >= QUALITY_MEDIUM);
  landMesh.castShadow = false;
  landMesh.name = "land_terrain_mesh";
  scene.add(landMesh);
  console.log("Land mesh triangles: " + landGeometry.index.count / 3);
  if (landMesh.receiveShadow) {
    console.log("Terrain mesh shadow receiving enabled");
  }

  // Set up terrain geometry updates
  update_map_terrain_geometry();
  setInterval(update_map_terrain_geometry, 40);
  setInterval(update_map_known_tiles, 15);
  
  // Schedule initial visibility update for map tiles
  // This uses the deferred batching system for consistency
  if (typeof schedule_visibility_update !== 'undefined') {
    schedule_visibility_update();
  }

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
    borders_visible: { type: "bool", value: server_settings['borders']['is_visible'] }
  };

  // Add terrain textures
  for (let i = 0; i < tiletype_terrains.length; i++) {
    const terrain_name = tiletype_terrains[i];
    uniforms[terrain_name] = { type: "t", value: webgl_textures[terrain_name] };
  }

  return uniforms;
}
