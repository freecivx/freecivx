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
 Add animated water mesh for WebGPU renderer using Three.js WaterMesh.
 
 Design goals (Realistic Reflective Water):
 - Reflective: Real-time scene reflections for immersion
 - Animated: Normal map-based wave movement
 - Beautiful: Fresnel effects and specular sun highlights
 - Game-appropriate: Works well at strategy game camera angles
 
 This water implementation uses Three.js WaterMesh which provides:
 - Real-time planar reflections
 - Normal map-based surface distortion for wave effects
 - Fresnel-based reflectance (more reflective at glancing angles)
 - Sun specular highlights
 - Configurable water and sun colors
****************************************************************************/
function add_quality_dependent_objects_webgpu() {
  // Create water plane geometry matching land mesh dimensions
  // Segment count balanced for wave detail vs performance (64x64)
  var waterGeometry = new THREE.PlaneGeometry(
    mapview_model_width,
    mapview_model_height * HEX_HEIGHT_FACTOR,
    64,
    64
  );
  
  // Check if WaterMesh is available (loaded via three-modules-webgpu.js)
  if (typeof THREE.WaterMesh !== 'undefined') {
    // Use the new Three.js WaterMesh with real-time reflections
    console.log("Using Three.js WaterMesh with reflections...");
    
    // Get preloaded water normal texture (webgl_textures is the shared texture storage)
    var waterNormalTexture = webgl_textures["water1"];
    if (!waterNormalTexture) {
      console.warn("Water normal texture not loaded, creating placeholder...");
      waterNormalTexture = new THREE.Texture();
    }
    
    // Configure water options for Freeciv 3D style
    // These settings are tuned for a nice looking strategy game water
    var waterOptions = {
      // Resolution scale for reflections (0.25 = quarter resolution for better performance)
      resolution: 0.25,
      // Normal map for wave patterns
      waterNormals: waterNormalTexture,
      // Transparency (slightly transparent for depth effect)
      alpha: 0.88,
      // Size affects normal map tiling (smaller = more wave detail)
      size: 0.15,
      // Sun settings for specular highlights
      sunColor: 0xffffee,
      sunDirection: new THREE.Vector3(0.5, 0.6, 0.3).normalize(),
      // Water base color - brighter tropical blue for natural look
      waterColor: 0x1a6b9e,
      // Distortion scale affects reflection waviness (lower = calmer water)
      distortionScale: 3.0,
      // Pass maptiles texture for visibility and land awareness
      maptilesTex: maptiletypes,
      mapXSize: map['xsize'],
      mapYSize: map['ysize']
    };
    
    water_hq = new THREE.WaterMesh(waterGeometry, waterOptions);
    console.log("Added Three.js WaterMesh water surface with reflections.");
  } else {
    // Fallback to the custom TSL shader if WaterMesh not available
    console.log("WaterMesh not available, using fallback TSL shader...");
    var waterMaterial = createWaterMaterialTSL(maptiletypes, map['xsize'], map['ysize']);
    water_hq = new THREE.Mesh(waterGeometry, waterMaterial);
    console.log("Added fallback TSL water surface.");
  }
  
  water_hq.rotation.x = -Math.PI * 0.5;
  water_hq.translateOnAxis(new THREE.Vector3(0, 0, 1).normalize(), 50.6);
  water_hq.translateOnAxis(new THREE.Vector3(1, 0, 0).normalize(), Math.floor(mapview_model_width / 2) - 500);
  water_hq.translateOnAxis(new THREE.Vector3(0, 1, 0).normalize(), -Math.floor(mapview_model_height * HEX_HEIGHT_FACTOR / 2));
  water_hq.renderOrder = -1;
  water_hq.castShadow = false;
  water_hq.name = "water_surface";
  scene.add(water_hq);
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
 - Hexagonal tile edges for Civ 6-style map appearance
 - Multi-layer blur effects for softer, more realistic water
 
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
  
  // ==== CONSTANTS ====
  // Texture values are stored as 0-255 in the DataTexture, but sampled as 0-1 floats
  // Multiply by 256.0 to convert back to original integer range for comparisons
  const TEXTURE_VALUE_SCALE = 256.0;
  
  // ==== HEXAGONAL TILE CONSTANTS ====
  // Match the terrain shader's hex geometry for consistent tile appearance
  // Pointy-top hexagons: flat sides on left/right, points on top/bottom
  const HEX_SQRT3_OVER_2 = 0.866025; // sqrt(3)/2 for hex edge normals
  const HEX_MESH_HEIGHT_FACTOR = HEX_SQRT3_OVER_2; // Mesh Y compression factor
  const HEX_ASPECT = 1.0 / HEX_MESH_HEIGHT_FACTOR; // ~1.1547 - Y scale to counteract mesh compression
  const HEX_EDGE_WIDTH = 0.035; // Width of hex edge highlight as fraction of tile - sharper than before
  const HEX_EDGE_SOFTNESS = 0.008; // Edge anti-aliasing softness - reduced for sharper edges
  const HEX_EDGE_BLEND_STRENGTH = 0.38; // How strongly hex edges darken water (0-1) - increased for visibility
  const HEX_EDGE_COLOR_R = 0.01; // Edge darkening color (deeper blue tint)
  const HEX_EDGE_COLOR_G = 0.04;
  const HEX_EDGE_COLOR_B = 0.12;
  
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
  
  // Calculate tile center UV for texture sampling
  const tileCenterU = div(add(floor(mul(map_x_size, hexUvX)), 0.5), map_x_size);
  const tileCenterV = div(add(tileY, 0.5), map_y_size);
  const tileCenterUStaggered = add(tileCenterU, hexOffsetX);
  const tileCenterUV = vec2(tileCenterUStaggered, tileCenterV);
  
  // ==== HEXAGONAL CELL LOCAL COORDINATES ====
  // Calculate position within the current hex cell for edge detection
  const localX = fract(mul(map_x_size, hexUvX));
  const localY = fract(tileYRaw);
  
  // Transform to hex-centered coordinates (-0.5 to 0.5)
  const centeredX = sub(localX, 0.5);
  const centeredY = sub(localY, 0.5);
  
  // Scale Y to counteract mesh compression for proper hex proportions
  const hexX = centeredX;
  const hexY = mul(centeredY, HEX_ASPECT);
  
  // ==== HEXAGONAL DISTANCE FUNCTION ====
  // Calculate signed distance to hex edge for pointy-top hexagon
  // Edge normals are at 0°, 60°, 120° for the three edge pairs
  // The coefficients 0.5 and -0.5 are cos(60°) and cos(120°) respectively
  // HEX_SQRT3_OVER_2 is sin(60°) = sqrt(3)/2 ≈ 0.866
  const dist1 = abs(hexX); // Vertical edges (left/right) - normal at 0°
  const dist2 = abs(add(mul(hexX, 0.5), mul(hexY, HEX_SQRT3_OVER_2))); // Top-right/bottom-left edges - normal at 60°
  const dist3 = abs(add(mul(hexX, -0.5), mul(hexY, HEX_SQRT3_OVER_2))); // Top-left/bottom-right edges - normal at 120°
  
  // Distance to hex edge is max of the three edge distances
  const hexDist = max(max(dist1, dist2), dist3);
  
  // ==== HEX EDGE MASK ====
  // Create soft edge mask for water hex boundaries
  const hexInradius = 0.5;
  const edgeStart = sub(hexInradius, HEX_EDGE_WIDTH);
  
  // Smooth step from interior to edge with softness for anti-aliasing
  const edgeT = clamp(div(sub(hexDist, edgeStart), add(HEX_EDGE_WIDTH, HEX_EDGE_SOFTNESS)), 0.0, 1.0);
  const hexEdgeMask = mul(mul(edgeT, edgeT), sub(3.0, mul(2.0, edgeT))); // smoothstep
  
  // ==== SAMPLE MAPTILES TEXTURE ====
  // Red channel: terrain type (multiplied by 10 in game data)
  // Green channel: river flag (value of 10 indicates river present)
  // Blue channel: irrigation/farmland
  // Alpha channel: visibility (0=unknown, ~0.54=fogged, 1.0=visible)
  const tileData = texture(maptilesTex, tileCenterUV);
  const visibility = tileData.a;
  // River detection: green channel value of 10 (or higher) indicates river
  // step(9.5, x) returns 1 when x >= 9.5 - we use 9.5 threshold to detect value 10
  // accounting for floating point precision
  const hasRiver = step(9.5, mul(tileData.g, TEXTURE_VALUE_SCALE));
  
  // Detect coast tiles (terrain type 20 = TERRAIN_COAST)
  const terrainType = floor(mul(tileData.r, TEXTURE_VALUE_SCALE));
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
  const isLandE = step(39.5, floor(mul(neighborE.r, TEXTURE_VALUE_SCALE)));
  const isLandW = step(39.5, floor(mul(neighborW.r, TEXTURE_VALUE_SCALE)));
  const isLandN = step(39.5, floor(mul(neighborN.r, TEXTURE_VALUE_SCALE)));
  const isLandS = step(39.5, floor(mul(neighborS.r, TEXTURE_VALUE_SCALE)));
  const nearLand = max(max(max(isLandE, isLandW), isLandN), isLandS);
  
  // ==== COLOR PALETTE (Stylized Game Colors) - Brighter, more natural water ====
  const deepOcean = vec3(0.08, 0.22, 0.42);     // Brighter deep blue
  const midOcean = vec3(0.12, 0.30, 0.50);      // Medium blue - brighter
  const shallowWater = vec3(0.18, 0.42, 0.58);  // Brighter teal/turquoise
  const riverBlue = vec3(0.14, 0.35, 0.52);     // River water color - brighter
  const riverHighlight = vec3(0.20, 0.45, 0.60); // River surface highlights - brighter
  const causticColor = vec3(0.35, 0.55, 0.65);  // Caustic highlight - brighter
  const foamWhite = vec3(0.95, 0.97, 1.0);      // Shoreline foam color - whiter
  const unknownBlack = vec3(0.0, 0.0, 0.0);     // Unknown tile color
  const hexEdgeColor = vec3(HEX_EDGE_COLOR_R, HEX_EDGE_COLOR_G, HEX_EDGE_COLOR_B); // Hex tile edge tint
  const skyReflectionColor = vec3(0.30, 0.45, 0.60); // Sky reflection tint - brighter
  
  // ==== PROCEDURAL NOISE FUNCTIONS ====
  function hash(p) {
    return fract(mul(sin(mul(p, 127.1)), 43758.5453));
  }
  
  // Improved 2D noise with smoother interpolation for more water-like blur effect
  // Helper function for quintic interpolation (smoother than smoothstep)
  // t = 6t^5 - 15t^4 + 10t^3
  function quinticSmooth(t) {
    const t3 = mul(mul(t, t), t);
    const t4 = mul(t3, t);
    const t5 = mul(t4, t);
    return add(sub(mul(6.0, t5), mul(15.0, t4)), mul(10.0, t3));
  }
  
  function noise2D(x, y) {
    const ix = floor(x);
    const iy = floor(y);
    const fx = fract(x);
    const fy = fract(y);
    // Quintic interpolation for smoother, more blurred appearance
    const ux = quinticSmooth(fx);
    const uy = quinticSmooth(fy);
    const a = hash(add(ix, mul(iy, 157.0)));
    const b = hash(add(add(ix, 1.0), mul(iy, 157.0)));
    const c = hash(add(ix, mul(add(iy, 1.0), 157.0)));
    const d = hash(add(add(ix, 1.0), mul(add(iy, 1.0), 157.0)));
    const mixAB = mix(a, b, ux);
    const mixCD = mix(c, d, ux);
    return mix(mixAB, mixCD, uy);
  }
  
  // ==== MULTI-LAYER NOISE - Performance optimized ====
  // Two octaves for a softer appearance with better performance
  const FBM_OCTAVE_WEIGHTS = { first: 1.0, second: 0.5 };
  const FBM_NORMALIZATION = FBM_OCTAVE_WEIGHTS.first + FBM_OCTAVE_WEIGHTS.second; // 1.5

  function blurredNoise(x, y) {
    // First octave: base frequency
    let result = noise2D(x, y);
    // Second octave: ~2x frequency, half amplitude
    const n2 = noise2D(mul(x, 2.1), mul(y, 2.1));
    result = add(result, mul(n2, FBM_OCTAVE_WEIGHTS.second));
    // Normalize to [0, 1] range
    return div(result, FBM_NORMALIZATION);
  }
  
  // ==== SOFT CAUSTIC PATTERN (Ocean) - More blurred and water-like ====
  const causticScale = 8.0; // Reduced scale for larger, softer patterns
  const causticSpeed = 0.06; // Slower, more gentle animation
  const causticU1 = add(mul(uvNode.x, causticScale), mul(timeUniform, causticSpeed));
  const causticV1 = add(mul(uvNode.y, causticScale), mul(timeUniform, mul(causticSpeed, 0.7)));
  const caustic1 = blurredNoise(causticU1, causticV1);
  const causticU2 = sub(mul(uvNode.x, mul(causticScale, 1.3)), mul(timeUniform, mul(causticSpeed, 0.5)));
  const causticV2 = add(mul(uvNode.y, mul(causticScale, 1.1)), mul(timeUniform, mul(causticSpeed, 0.3)));
  const caustic2 = blurredNoise(causticU2, causticV2);
  const causticPattern = mul(add(caustic1, caustic2), 0.5);
  // Softer caustic intensity with smoother falloff
  const causticIntensity = clamp(mul(sub(causticPattern, 0.35), 2.0), 0.0, 1.0);
  
  // ==== RIVER FLOW ANIMATION ====
  // Faster, more linear flow pattern for rivers with softer waves
  const riverFlowSpeed = 0.28; // Slightly slower for smoother appearance
  const riverFlowScale = 14.0; // Larger scale for softer waves
  // Create directional flow (primarily along one axis to simulate current)
  const riverFlow1 = sin(add(mul(sub(uvNode.y, mul(uvNode.x, 0.3)), riverFlowScale), mul(timeUniform, riverFlowSpeed)));
  const riverFlow2 = sin(add(mul(sub(uvNode.y, mul(uvNode.x, 0.5)), mul(riverFlowScale, 1.3)), mul(timeUniform, mul(riverFlowSpeed, 1.2))));
  const riverFlowPattern = mul(add(riverFlow1, riverFlow2), 0.12); // Reduced amplitude for softer effect
  
  // River ripples (softer, more blurred)
  const riverRippleScale = 22.0; // Reduced for softer ripples
  const riverRipple = sin(add(mul(add(uvNode.x, uvNode.y), riverRippleScale), mul(timeUniform, 0.4)));
  const riverRippleIntensity = mul(riverRipple, 0.06);
  
  // ==== SHORELINE FOAM/WAVE ANIMATION ====
  // Animated foam that appears at the edge of land - softer, more blurred
  const foamSpeed = 0.18; // Slower for smoother waves
  const foamScale = 14.0; // Larger scale for softer foam patterns
  // Create wave-like foam pattern with blur
  const foamWave1 = sin(add(mul(uvNode.x, foamScale), mul(timeUniform, foamSpeed)));
  const foamWave2 = sin(add(mul(uvNode.y, mul(foamScale, 0.8)), mul(timeUniform, mul(foamSpeed, 1.2))));
  const foamPattern = mul(add(add(foamWave1, foamWave2), 1.5), 0.33);
  
  // Foam intensity based on proximity to land (using blurred noise for softer, natural edge)
  const foamNoiseX = mul(uvNode.x, 18.0);
  const foamNoiseY = add(mul(uvNode.y, 18.0), mul(timeUniform, 0.08));
  const foamNoise = blurredNoise(foamNoiseX, foamNoiseY);
  const foamIntensity = mul(mul(nearLand, foamPattern), clamp(add(foamNoise, 0.25), 0.0, 1.0));
  
  // ==== SOFT SURFACE RIPPLES (Ocean) - Performance optimized ====
  const rippleScale = 14.0; // Scale for water-like ripples
  const rippleSpeed = 0.08; // Slower for calmer water
  
  // Two-directional ripples for natural water appearance (performance optimized)
  // Ripple 1: diagonal direction
  const ripple1Dir = add(uvNode.x, mul(uvNode.y, 0.6));
  const ripple1Phase = add(mul(ripple1Dir, rippleScale), mul(timeUniform, rippleSpeed));
  const ripple1 = sin(ripple1Phase);
  
  // Ripple 2: different diagonal
  const ripple2Dir = add(mul(uvNode.x, 0.5), uvNode.y);
  const ripple2Phase = add(mul(ripple2Dir, mul(rippleScale, 0.9)), mul(timeUniform, mul(rippleSpeed, 1.1)));
  const ripple2 = sin(ripple2Phase);
  
  // Blend two ripple layers for good water appearance with better performance
  const rippleValue = mul(add(ripple1, ripple2), 0.04); // Reduced amplitude for uniform look
  
  // ==== BASE OCEAN COLOR - More uniform gradients ====
  const positionFactor = mul(add(uvNode.x, uvNode.y), 0.2); // Reduced influence
  // Add blurred noise for organic color variation (reduced)
  const colorNoiseScale = 5.0;
  const colorNoiseX = mul(uvNode.x, colorNoiseScale);
  const colorNoiseY = add(mul(uvNode.y, colorNoiseScale), mul(timeUniform, 0.015));
  const colorNoise = blurredNoise(colorNoiseX, colorNoiseY);
  const variation = add(add(positionFactor, rippleValue), mul(sub(colorNoise, 0.5), 0.08)); // Much smaller noise contribution
  const normalizedVariation = clamp(add(0.5, mul(variation, 0.10)), 0.0, 1.0); // Tighter variation range for uniformity
  const deepToMid = mix(deepOcean, midOcean, clamp(mul(normalizedVariation, 1.2), 0.0, 1.0));
  const oceanBaseColor = mix(deepToMid, shallowWater, clamp(sub(mul(normalizedVariation, 1.2), 0.5), 0.0, 1.0));
  
  // ==== RIVER COLOR - Softer flowing appearance ====
  const riverBaseColor = mix(riverBlue, riverHighlight, clamp(add(riverFlowPattern, riverRippleIntensity), 0.0, 1.0));
  
  // ==== COMBINE BASE COLORS (Ocean vs River) ====
  const baseColor = mix(oceanBaseColor, riverBaseColor, hasRiver);
  
  // ==== ADD CAUSTIC HIGHLIGHTS (much subtler for uniform look) ====
  const causticStrength = mix(0.06, 0.02, hasRiver); // Reduced for more uniform appearance
  const colorWithCaustics = mix(baseColor, causticColor, mul(causticIntensity, causticStrength));
  
  // ==== ADD SHORELINE FOAM ====
  // Blend foam at coastline areas near land with softer transition
  const colorWithFoam = mix(colorWithCaustics, foamWhite, mul(foamIntensity, 0.45)); // Slightly more visible foam
  
  // ==== FRESNEL REFLECTION - Makes water more reflective at glancing angles ====
  // Simplified Fresnel approximation using Schlick's formula
  // For a top-down-ish camera, we simulate view angle variation using UV position
  // This creates a more realistic water surface that reflects more at edges
  const fresnelBase = 0.02; // Base reflectivity (water's R0 at normal incidence)
  const fresnelPower = 3.5; // How quickly reflection increases at glancing angles
  // Use a combination of ripple value and position to create view-angle-like variation
  const viewAngleSim = clamp(add(mul(rippleValue, 0.3), 0.7), 0.0, 1.0);
  const fresnelTerm = add(fresnelBase, mul(sub(1.0, fresnelBase), pow(sub(1.0, viewAngleSim), fresnelPower)));
  
  // Apply Fresnel-based sky reflection (reduced for uniform look)
  const fresnelReflection = mul(skyReflectionColor, mul(fresnelTerm, 0.20));
  const colorWithFresnel = add(colorWithFoam, fresnelReflection);
  
  // ==== WAVE HIGHLIGHTS - Simplified for performance ====
  // Single wave direction for subtle surface variation
  const waveHighlight = sin(add(mul(add(uvNode.x, mul(uvNode.y, 0.5)), 18.0), mul(timeUniform, 0.10)));
  const waveCrestIntensity = clamp(mul(waveHighlight, 0.02), 0.0, 1.0);
  
  // ==== SOFT SPECULAR - Subtle sun reflection ====
  const specularBase = clamp(add(rippleValue, 0.5), 0.0, 1.0);
  const specular = mul(pow(specularBase, 6.0), 0.05); // Softer highlights
  const specularColor = vec3(0.85, 0.90, 0.95); // Cooler sun color for subtle effect
  const specularTint = mul(specularColor, add(specular, mul(waveCrestIntensity, 0.03)));
  
  // ==== SURFACE SHIMMER - Removed for performance ====
  // Shimmer effect removed to improve performance and reduce contrast
  
  // ==== SUBSURFACE SCATTERING - Reduced ====
  const subsurfaceStrength = mul(isCoast, 0.03); // Reduced for uniform look
  const subsurfaceColor = vec3(0.18, 0.42, 0.50); // Brighter subsurface
  const subsurfaceGlow = mul(subsurfaceColor, subsurfaceStrength);
  
  // ==== EDGE DARKENING (Vignette) - Reduced ====
  const cx = sub(uvNode.x, 0.5);
  const cy = sub(uvNode.y, 0.5);
  const edgeDist = sqrt(add(mul(cx, cx), mul(cy, cy)));
  const edgeDarken = clamp(mul(edgeDist, 0.06), 0.0, 0.04); // Much softer vignette
  
  // ==== FINAL WATER COLOR COMPOSITION ====
  const colorWithSpecular = add(colorWithFresnel, specularTint);
  const colorWithSubsurface = add(colorWithSpecular, subsurfaceGlow);
  const baseWaterColor = sub(colorWithSubsurface, vec3(edgeDarken, edgeDarken, edgeDarken));
  
  // ==== HEXAGONAL TILE EDGE EFFECT ====
  // Apply subtle hex edge darkening for Civ 6-style tile boundaries
  // The edge blends from full water color at interior to slightly darker at edges
  const hexEdgeDarken = mul(hexEdgeMask, HEX_EDGE_BLEND_STRENGTH);
  const waterColor = mix(baseWaterColor, hexEdgeColor, hexEdgeDarken);
  
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
