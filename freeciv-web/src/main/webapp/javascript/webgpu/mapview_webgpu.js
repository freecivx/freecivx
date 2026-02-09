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
 
 Design goals (Stylized Game Water - Civ 6-style):
 - Hexagonal: Water tiles and edges are hexagonal, matching the terrain grid
 - Atmospheric: Beautiful color gradients, depth variation, and subtle wave animations
 - Animated: Enhanced river flow with multiple layers and varying speeds
 - Blurred Transitions: Soft edges between water tiles and visibility states
 - Game-appropriate: Works well at strategy game camera angles
 
 This stylized water shader uses:
 - Hexagonal tile boundaries with soft edge blending (matching terrain shader)
 - Multi-layered caustic patterns for realistic underwater light
 - Enhanced river flow animations with turbulence and foam effects
 - Atmospheric wave patterns and depth-based color variation
 - Shoreline foam effects near land tiles
 - Soft visibility transitions at fog of war boundaries
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
 - Hexagonal tile rendering with soft edge transitions (matching terrain shader)
 - Unknown map tiles render as black (fog of war support)
 - River tiles have distinct multi-layered animated river flow effects
 - Coast/shoreline areas near land have wave foam and white water effects
 - Smooth color gradients from deep ocean to shallow coastal waters
 - Atmospheric depth variation and color transitions
 - Enhanced layered caustic patterns for realistic underwater light
 - Blurred/soft transitions between water tiles for seamless appearance
 - Gentle specular highlights and surface shimmer
 
 @param {THREE.DataTexture} maptilesTex - Texture containing tile data (visibility in alpha, river in green)
 @param {number} mapXSize - Map width in tiles
 @param {number} mapYSize - Map height in tiles
****************************************************************************/
function createWaterMaterialTSL(maptilesTex, mapXSize, mapYSize) {
  const { texture, uniform, uv, vec2, vec3, vec4, sin, cos, mix, fract, clamp, pow, sqrt, mul, add, sub, abs, floor, max, min, mod, step, div, dot } = THREE;
  
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
  
  // ==== CONSTANTS ====
  // Texture values are stored as 0-255 in the DataTexture, but sampled as 0-1 floats
  // Multiply by 256.0 to convert back to original integer range for comparisons
  const TEXTURE_VALUE_SCALE = 256.0;
  
  // ==== HEXAGONAL CONSTANTS ====
  // Match terrain shader's hex system for proper alignment
  const HEX_SQRT3_OVER_2 = 0.866025; // sqrt(3)/2 for hex edge normals
  const HEX_MESH_HEIGHT_FACTOR = HEX_SQRT3_OVER_2;
  const HEX_ASPECT = 1.0 / HEX_MESH_HEIGHT_FACTOR; // ~1.1547 for proper hex shape
  const HEX_EDGE_WIDTH = 0.06;        // Width of hex edge highlight
  const HEX_EDGE_SOFTNESS = 0.035;    // Edge anti-aliasing softness (blurred transitions)
  const HEX_EDGE_BLEND_STRENGTH = 0.25; // How strongly hex edges darken the water
  
  // ==== HEXAGONAL COORDINATE CALCULATIONS ====
  // Match the terrain shader's hex coordinate system for proper tile alignment
  
  // Calculate tile coordinates
  const tileYRaw = mul(map_y_size, uvNode.y);
  const tileY = floor(tileYRaw);
  const tileXRaw = mul(map_x_size, uvNode.x);
  const tileX = floor(tileXRaw);
  
  // Hex stagger: determine if this row should be offset (odd-r coordinate system)
  // The mesh geometry offsets odd rows, so we compute: (map_y_size - 1 - tileY) % 2
  // This matches the terrain shader's coordinate system
  const isOddRow = mod(sub(sub(map_y_size, 1.0), tileY), 2.0);
  const hexOffsetX = mul(isOddRow, div(0.5, map_x_size));
  const hexUvX = sub(uvNode.x, hexOffsetX);
  
  // ==== HEXAGONAL CELL LOCAL COORDINATES ====
  // Calculate position within the current hex cell (0 to 1 range)
  const localX = fract(mul(map_x_size, hexUvX));
  const localY = fract(tileYRaw);
  
  // Transform to hex-centered system (-0.5 to 0.5 range)
  const centeredX = sub(localX, 0.5);
  const centeredY = sub(localY, 0.5);
  
  // ==== HEXAGONAL DISTANCE FUNCTION (Signed Distance Field) ====
  // Calculate signed distance to hexagon edge for pointy-top hex
  // Scale Y coordinate to account for mesh's height compression
  const hexX = centeredX;
  const hexY = mul(centeredY, HEX_ASPECT);
  
  // Calculate distance to three pairs of hex edges using dot products with edge normals
  // Edge 1: vertical edges (normal = (1, 0))
  const dist1 = abs(hexX);
  // Edge 2: top-right and bottom-left edges (normal = (0.5, sqrt(3)/2))
  const dist2 = abs(add(mul(hexX, 0.5), mul(hexY, HEX_SQRT3_OVER_2)));
  // Edge 3: top-left and bottom-right edges (normal = (-0.5, sqrt(3)/2))
  const dist3 = abs(add(mul(hexX, -0.5), mul(hexY, HEX_SQRT3_OVER_2)));
  
  // The distance to hex edge is the maximum of these three distances
  const hexDist = max(max(dist1, dist2), dist3);
  
  // ==== HEX EDGE MASK FOR SOFT WATER BOUNDARIES ====
  // Create a soft edge mask with blurred transitions between tiles
  const hexInradius = 0.5;
  const edgeStart = sub(hexInradius, HEX_EDGE_WIDTH);
  const edgeT = clamp(div(sub(hexDist, edgeStart), mul(HEX_EDGE_WIDTH, 1.5)), 0.0, 1.0);
  // Smoothstep for soft/blurred edge transitions
  const hexEdgeMask = mul(mul(edgeT, edgeT), sub(3.0, mul(2.0, edgeT)));
  
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
  const hasRiver = step(9.5, mul(tileData.g, TEXTURE_VALUE_SCALE));
  
  // Detect coast tiles (terrain type 20 = TERRAIN_COAST)
  const terrainType = floor(mul(tileData.r, TEXTURE_VALUE_SCALE));
  const isCoast = mul(step(19.5, terrainType), step(terrainType, 20.5));
  
  // ==== SAMPLE NEIGHBORS FOR SHORELINE AND BLENDING ====
  const neighborOffsetX = div(1.0, map_x_size);
  const neighborOffsetY = div(1.0, map_y_size);
  
  // Diagonal neighbor offsets for proper hex coordinate system (odd-r layout)
  const neSeOffsetXFactor = sub(1.5, isOddRow);
  const nwSwOffsetXFactor = sub(-0.5, isOddRow);
  
  // Sample all 6 hex neighbors for visibility blending
  const neighborUV_E = vec2(add(tileCenterUV.x, neighborOffsetX), tileCenterUV.y);
  const neighborUV_W = vec2(sub(tileCenterUV.x, neighborOffsetX), tileCenterUV.y);
  const neighborUV_NE = vec2(add(tileCenterUV.x, mul(neighborOffsetX, neSeOffsetXFactor)), add(tileCenterUV.y, neighborOffsetY));
  const neighborUV_NW = vec2(add(tileCenterUV.x, mul(neighborOffsetX, nwSwOffsetXFactor)), add(tileCenterUV.y, neighborOffsetY));
  const neighborUV_SE = vec2(add(tileCenterUV.x, mul(neighborOffsetX, neSeOffsetXFactor)), sub(tileCenterUV.y, neighborOffsetY));
  const neighborUV_SW = vec2(add(tileCenterUV.x, mul(neighborOffsetX, nwSwOffsetXFactor)), sub(tileCenterUV.y, neighborOffsetY));
  
  // Sample terrain data from neighbors
  const neighborE = texture(maptilesTex, neighborUV_E);
  const neighborW = texture(maptilesTex, neighborUV_W);
  const neighborNE = texture(maptilesTex, neighborUV_NE);
  const neighborNW = texture(maptilesTex, neighborUV_NW);
  const neighborSE = texture(maptilesTex, neighborUV_SE);
  const neighborSW = texture(maptilesTex, neighborUV_SW);
  
  // Detect if neighbors are land (terrain types >= 40 are land-based)
  const isLandE = step(39.5, floor(mul(neighborE.r, TEXTURE_VALUE_SCALE)));
  const isLandW = step(39.5, floor(mul(neighborW.r, TEXTURE_VALUE_SCALE)));
  const isLandNE = step(39.5, floor(mul(neighborNE.r, TEXTURE_VALUE_SCALE)));
  const isLandNW = step(39.5, floor(mul(neighborNW.r, TEXTURE_VALUE_SCALE)));
  const isLandSE = step(39.5, floor(mul(neighborSE.r, TEXTURE_VALUE_SCALE)));
  const isLandSW = step(39.5, floor(mul(neighborSW.r, TEXTURE_VALUE_SCALE)));
  const nearLand = max(max(max(max(max(isLandE, isLandW), isLandNE), isLandNW), isLandSE), isLandSW);
  
  // Calculate neighbor visibility average for soft edge blending
  const visE = neighborE.a;
  const visW = neighborW.a;
  const visNE = neighborNE.a;
  const visNW = neighborNW.a;
  const visSE = neighborSE.a;
  const visSW = neighborSW.a;
  const avgNeighborVis = mul(add(add(add(add(add(visE, visW), visNE), visNW), visSE), visSW), div(1.0, 6.0));
  
  // ==== ENHANCED COLOR PALETTE (Atmospheric Game Colors) ====
  const deepOcean = vec3(0.02, 0.08, 0.22);       // Deep rich blue
  const midOcean = vec3(0.06, 0.20, 0.42);        // Medium blue
  const shallowWater = vec3(0.12, 0.40, 0.52);    // Teal/turquoise
  const coastalWater = vec3(0.18, 0.50, 0.58);    // Light coastal blue
  const riverBlue = vec3(0.08, 0.30, 0.48);       // River water color (darker, clearer)
  const riverHighlight = vec3(0.22, 0.52, 0.65);  // River surface highlights
  const riverFoam = vec3(0.45, 0.68, 0.78);       // River foam/rapids
  const causticColor = vec3(0.55, 0.80, 0.90);    // Caustic highlight (brighter)
  const foamWhite = vec3(0.95, 0.98, 1.0);        // Shoreline foam color
  const waveHighlight = vec3(0.70, 0.88, 0.95);   // Wave crest highlight
  const hexEdgeColor = vec3(0.03, 0.10, 0.25);    // Subtle hex edge darkening
  const unknownBlack = vec3(0.0, 0.0, 0.0);       // Unknown tile color
  
  // ==== PROCEDURAL NOISE FUNCTIONS ====
  function hash(p) {
    return fract(mul(sin(mul(p, 127.1)), 43758.5453));
  }
  
  function hash2D(x, y) {
    return fract(mul(sin(add(mul(x, 127.1), mul(y, 311.7))), 43758.5453));
  }
  
  function noise2D(x, y) {
    const ix = floor(x);
    const iy = floor(y);
    const fx = fract(x);
    const fy = fract(y);
    // Improved smoothstep interpolation
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
  
  // Fractal Brownian Motion for natural-looking patterns (3 octaves)
  function fbm(x, y) {
    // Compute all three octaves
    const octave1 = noise2D(x, y);
    const octave2 = mul(noise2D(mul(x, 2.0), mul(y, 2.0)), 0.5);
    const octave3 = mul(noise2D(mul(x, 4.0), mul(y, 4.0)), 0.25);
    // Combine and normalize (1 + 0.5 + 0.25 = 1.75, 1/1.75 ≈ 0.571)
    return mul(add(add(octave1, octave2), octave3), 0.571);
  }
  
  // ==== ENHANCED CAUSTIC PATTERN (Ocean) ====
  // Multi-layered caustics for realistic underwater light patterns
  const causticScale1 = 10.0;
  const causticScale2 = 15.0;
  const causticScale3 = 22.0;
  const causticSpeed = 0.06;
  
  // Layer 1: Large slow caustics
  const causticU1 = add(mul(uvNode.x, causticScale1), mul(timeUniform, causticSpeed));
  const causticV1 = add(mul(uvNode.y, causticScale1), mul(timeUniform, mul(causticSpeed, 0.8)));
  const caustic1 = noise2D(causticU1, causticV1);
  
  // Layer 2: Medium caustics
  const causticU2 = sub(mul(uvNode.x, causticScale2), mul(timeUniform, mul(causticSpeed, 0.7)));
  const causticV2 = add(mul(uvNode.y, causticScale2), mul(timeUniform, mul(causticSpeed, 0.5)));
  const caustic2 = noise2D(causticU2, causticV2);
  
  // Layer 3: Fine detail caustics
  const causticU3 = add(mul(uvNode.x, causticScale3), mul(timeUniform, mul(causticSpeed, 1.2)));
  const causticV3 = sub(mul(uvNode.y, causticScale3), mul(timeUniform, mul(causticSpeed, 0.9)));
  const caustic3 = noise2D(causticU3, causticV3);
  
  // Combine caustic layers with weighted blend
  const causticPattern = add(add(mul(caustic1, 0.5), mul(caustic2, 0.35)), mul(caustic3, 0.15));
  const causticIntensity = clamp(mul(sub(causticPattern, 0.25), 2.8), 0.0, 1.0);
  
  // ==== ENHANCED RIVER FLOW ANIMATION ====
  // Multiple layers with different speeds for dynamic river appearance
  const riverFlowSpeed1 = 0.55;  // Main flow (faster)
  const riverFlowSpeed2 = 0.38;  // Secondary flow
  const riverFlowSpeed3 = 0.72;  // Fast surface ripples
  const riverFlowScale = 20.0;
  
  // Main river flow - diagonal current direction
  const riverFlow1 = sin(add(mul(sub(uvNode.y, mul(uvNode.x, 0.25)), riverFlowScale), mul(timeUniform, riverFlowSpeed1)));
  const riverFlow2 = sin(add(mul(sub(uvNode.y, mul(uvNode.x, 0.45)), mul(riverFlowScale, 1.2)), mul(timeUniform, riverFlowSpeed2)));
  
  // Surface turbulence layer
  const riverTurbulence = sin(add(mul(add(uvNode.x, mul(uvNode.y, 0.8)), mul(riverFlowScale, 1.8)), mul(timeUniform, riverFlowSpeed3)));
  
  // Combined flow pattern
  const riverFlowPattern = add(add(mul(riverFlow1, 0.12), mul(riverFlow2, 0.08)), mul(riverTurbulence, 0.06));
  
  // River ripples and sparkles (faster, smaller scale)
  const riverRippleScale = 35.0;
  const riverRipple1 = sin(add(mul(add(uvNode.x, uvNode.y), riverRippleScale), mul(timeUniform, 0.8)));
  const riverRipple2 = sin(add(mul(sub(mul(uvNode.x, 1.2), uvNode.y), mul(riverRippleScale, 0.7)), mul(timeUniform, 0.65)));
  const riverRippleIntensity = mul(add(riverRipple1, riverRipple2), 0.06);
  
  // River foam/rapids effect (appears on faster-flowing sections)
  const riverFoamNoise = noise2D(add(mul(uvNode.x, 30.0), mul(timeUniform, 0.4)), add(mul(uvNode.y, 25.0), mul(timeUniform, 0.3)));
  const riverFoamIntensity = mul(clamp(sub(riverFoamNoise, 0.6), 0.0, 0.4), 2.0);
  
  // ==== ATMOSPHERIC WAVE ANIMATION ====
  // Gentle undulating waves for atmospheric ocean feel
  const waveScale1 = 8.0;
  const waveScale2 = 12.0;
  const waveSpeed = 0.12;
  
  // Large gentle swells
  const wave1 = sin(add(add(mul(uvNode.x, waveScale1), mul(uvNode.y, mul(waveScale1, 0.6))), mul(timeUniform, waveSpeed)));
  const wave2 = sin(add(sub(mul(uvNode.x, mul(waveScale2, 0.8)), mul(uvNode.y, waveScale2)), mul(timeUniform, mul(waveSpeed, 1.3))));
  const wavePattern = mul(add(wave1, wave2), 0.04);
  
  // ==== SHORELINE FOAM/WAVE ANIMATION ====
  // Enhanced animated foam at land edges
  const foamSpeed = 0.32;
  const foamScale = 25.0;
  
  // Multi-layer foam waves
  const foamWave1 = sin(add(mul(uvNode.x, foamScale), mul(timeUniform, foamSpeed)));
  const foamWave2 = sin(add(mul(uvNode.y, mul(foamScale, 0.85)), mul(timeUniform, mul(foamSpeed, 1.15))));
  const foamWave3 = sin(add(mul(add(uvNode.x, uvNode.y), mul(foamScale, 0.6)), mul(timeUniform, mul(foamSpeed, 0.8))));
  const foamPattern = mul(add(add(foamWave1, foamWave2), mul(foamWave3, 0.5)), 0.28);
  
  // Foam noise for natural edge appearance
  const foamNoise = fbm(add(mul(uvNode.x, 20.0), mul(timeUniform, 0.08)), add(mul(uvNode.y, 20.0), mul(timeUniform, 0.06)));
  const foamIntensity = mul(mul(nearLand, foamPattern), clamp(add(foamNoise, 0.2), 0.0, 1.0));
  
  // ==== GENTLE SURFACE RIPPLES (Ocean) ====
  const rippleScale = 28.0;
  const rippleSpeed = 0.18;
  const ripple1 = sin(add(mul(add(mul(uvNode.x, 1.0), mul(uvNode.y, 0.5)), rippleScale), mul(timeUniform, rippleSpeed)));
  const ripple2 = sin(add(mul(add(mul(uvNode.x, 0.7), mul(uvNode.y, 1.0)), mul(rippleScale, 0.85)), mul(timeUniform, mul(rippleSpeed, 1.2))));
  const rippleValue = mul(add(ripple1, ripple2), 0.08);
  
  // ==== ATMOSPHERIC DEPTH VARIATION ====
  // Create natural color variation based on position (simulating depth/distance)
  const depthNoise = fbm(mul(uvNode.x, 3.0), mul(uvNode.y, 3.0));
  const depthFactor = clamp(add(0.4, mul(depthNoise, 0.6)), 0.0, 1.0);
  
  // ==== BASE OCEAN COLOR (Enhanced) ====
  const positionFactor = mul(add(uvNode.x, uvNode.y), 0.25);
  const variation = add(add(positionFactor, rippleValue), wavePattern);
  const normalizedVariation = clamp(add(0.5, mul(variation, 0.25)), 0.0, 1.0);
  
  // Three-stage gradient: deep -> mid -> shallow with coastal highlights
  const deepToMid = mix(deepOcean, midOcean, clamp(mul(normalizedVariation, 1.6), 0.0, 1.0));
  const midToShallow = mix(deepToMid, shallowWater, clamp(sub(mul(normalizedVariation, 1.6), 0.5), 0.0, 1.0));
  const oceanBaseColor = mix(midToShallow, coastalWater, mul(nearLand, 0.3));
  
  // Add depth variation for atmospheric feel
  const oceanColorWithDepth = mix(deepOcean, oceanBaseColor, depthFactor);
  
  // ==== RIVER COLOR (Enhanced) ====
  // River water with flowing appearance and foam highlights
  const riverFlowColor = mix(riverBlue, riverHighlight, clamp(add(riverFlowPattern, riverRippleIntensity), 0.0, 1.0));
  const riverWithFoam = mix(riverFlowColor, riverFoam, riverFoamIntensity);
  const riverBaseColor = riverWithFoam;
  
  // ==== COMBINE BASE COLORS (Ocean vs River) ====
  const baseColor = mix(oceanColorWithDepth, riverBaseColor, hasRiver);
  
  // ==== ADD CAUSTIC HIGHLIGHTS (enhanced, reduced for rivers) ====
  const causticStrength = mix(0.18, 0.04, hasRiver);
  const colorWithCaustics = mix(baseColor, causticColor, mul(causticIntensity, causticStrength));
  
  // ==== ADD WAVE HIGHLIGHTS ====
  // Subtle highlights on wave crests
  const waveHighlightIntensity = mul(clamp(add(wavePattern, 0.02), 0.0, 0.08), 1.5);
  const colorWithWaves = mix(colorWithCaustics, waveHighlight, waveHighlightIntensity);
  
  // ==== ADD SHORELINE FOAM ====
  const colorWithFoam = mix(colorWithWaves, foamWhite, mul(foamIntensity, 0.55));
  
  // ==== GENTLE SPECULAR ====
  const specularBase = clamp(add(rippleValue, 0.5), 0.0, 1.0);
  const specular = mul(pow(specularBase, 10.0), 0.10);
  const specularTint = mul(vec3(1.0, 0.98, 0.96), specular);
  
  // ==== SURFACE SHIMMER ====
  const shimmerU = add(mul(uvNode.x, 45.0), mul(timeUniform, 0.25));
  const shimmerV = add(mul(uvNode.y, 40.0), mul(timeUniform, 0.18));
  const shimmer = mul(fract(mul(sin(add(shimmerU, shimmerV)), 43758.5)), 0.025);
  
  // ==== HEXAGONAL EDGE BLENDING ====
  // Apply subtle darkening at hex edges for visual tile boundaries (matching terrain)
  const hexEdgeBlend = mul(hexEdgeMask, HEX_EDGE_BLEND_STRENGTH);
  
  // ==== EDGE DARKENING (Vignette) ====
  const cx = sub(uvNode.x, 0.5);
  const cy = sub(uvNode.y, 0.5);
  const edgeDist = sqrt(add(mul(cx, cx), mul(cy, cy)));
  const edgeDarken = clamp(mul(edgeDist, 0.12), 0.0, 0.08);
  
  // ==== FINAL WATER COLOR COMPOSITION ====
  const colorWithSpecular = add(colorWithFoam, specularTint);
  const colorWithShimmer = add(colorWithSpecular, vec3(shimmer, shimmer, shimmer));
  const colorWithVignette = sub(colorWithShimmer, vec3(edgeDarken, edgeDarken, edgeDarken));
  
  // Apply hexagonal edge darkening for tile boundaries
  const waterColor = mix(colorWithVignette, hexEdgeColor, hexEdgeBlend);
  
  // ==== SOFT VISIBILITY HANDLING WITH BLURRED TRANSITIONS ====
  // Create soft transitions at the boundary between visible and unknown tiles
  
  // Calculate edge proximity for blending (stronger at hex edges)
  const edgeProximity = clamp(mul(sub(hexDist, 0.25), 4.0), 0.0, 1.0);
  
  // Blend current tile visibility with neighbor average at edges for soft transitions
  const softVisibility = mix(visibility, avgNeighborVis, mul(edgeProximity, 0.45));
  
  // Apply smoothstep curve for softer edges
  const visNormalized = clamp(mul(softVisibility, 1.5), 0.0, 1.0);
  const visSmooth = mul(mul(visNormalized, visNormalized), sub(3.0, mul(2.0, visNormalized)));
  
  const finalColor = mix(unknownBlack, waterColor, visSmooth);
  
  // Opacity: unknown tiles are fully opaque black, visible tiles have normal transparency
  const baseOpacity = 0.75;
  const unknownOpacity = 1.0;
  const finalOpacity = mix(unknownOpacity, baseOpacity, step(0.01, softVisibility));
  
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
