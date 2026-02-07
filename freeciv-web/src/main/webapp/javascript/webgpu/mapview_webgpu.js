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

  // Directional light for general scene lighting and shadow casting
  // Positioned to simulate sunlight from the southeast at an elevated angle
  directionalLight = new THREE.DirectionalLight( 0xffffff, 2.0 * Math.PI );
  directionalLight.position.set(500, 800, 500);
  directionalLight.name = "directional_light";
  
  // Enable shadow casting on directional light for sun-like parallel shadows
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 4096;
  directionalLight.shadow.mapSize.height = 4096;
  // Shadow camera clipping planes: near=100 avoids artifacts near camera,
  // far=3000 encompasses terrain depth range (camera height ~450-900, terrain ~0-200)
  directionalLight.shadow.camera.near = 100;
  directionalLight.shadow.camera.far = 3000;
  // Large orthographic frustum to cover visible terrain area (±1500 units in x/z)
  directionalLight.shadow.camera.left = -1500;
  directionalLight.shadow.camera.right = 1500;
  directionalLight.shadow.camera.top = 1500;
  directionalLight.shadow.camera.bottom = -1500;
  // Shadow bias prevents shadow acne (self-shadowing artifacts) on surfaces
  // normalBias shifts shadow slightly along surface normal to reduce peter-panning
  directionalLight.shadow.bias = -0.0005;
  directionalLight.shadow.normalBias = 0.02;
  
  scene.add(directionalLight);
  // Add the directional light's target to the scene (required for shadow direction)
  scene.add(directionalLight.target);

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

  // Create WebGPU Renderer with shadow map support
  maprenderer = new THREE.WebGPURenderer( { antialias: enable_antialiasing, preserveDrawingBuffer: true } );
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

/****************************************************************************
 Add animated water mesh for WebGPU renderer using TSL shaders.
 Creates a realistic ocean water effect with:
 - Multi-octave Gerstner waves for natural wave motion
 - Procedural normals for surface detail and specular highlights
 - Fresnel effect for view-dependent reflections
 - Subsurface scattering simulation on wave crests
 - Dynamic foam patterns with noise variation
 - Caustic-like light patterns
****************************************************************************/
function add_quality_dependent_objects_webgpu() {
  // Create water plane geometry with same dimensions as land mesh
  // Uses HEX_HEIGHT_FACTOR to match the hexagonal grid height scaling
  // Higher segment count (256x256) for smoother UV interpolation and better wave detail
  var waterGeometry = new THREE.PlaneGeometry(mapview_model_width, mapview_model_height * HEX_HEIGHT_FACTOR, 256, 256);
  
  // Create animated water material using TSL (Three.js Shading Language)
  var waterMaterial = createWaterMaterialTSL();
  
  water_hq = new THREE.Mesh(waterGeometry, waterMaterial);
  water_hq.rotation.x = - Math.PI * 0.5;
  water_hq.translateOnAxis(new THREE.Vector3(0,0,1).normalize(), 50);
  water_hq.translateOnAxis(new THREE.Vector3(1,0,0).normalize(), Math.floor(mapview_model_width / 2) - 500);
  // Apply HEX_HEIGHT_FACTOR to Y-axis translation to match the scaled water geometry height
  water_hq.translateOnAxis(new THREE.Vector3(0,1,0).normalize(), -Math.floor(mapview_model_height * HEX_HEIGHT_FACTOR / 2));
  water_hq.renderOrder = -1; // Render water first
  water_hq.castShadow = false;
  water_hq.name = "water_surface";
  scene.add(water_hq);
  console.log("Added enhanced WebGPU water surface with realistic ocean shader.");
}

/****************************************************************************
 Create animated water material using TSL (Three.js Shading Language).
 Enhanced realistic water with:
 - Multi-octave Gerstner-style waves for natural wave shapes
 - Procedural normal mapping derived from wave derivatives
 - Fresnel effect for view-dependent reflections
 - Subsurface scattering simulation for wave translucency
 - Dynamic foam on wave crests with noise variation
 - Caustic-like light patterns
 - Depth-based color gradients
****************************************************************************/
function createWaterMaterialTSL() {
  const {
    uniform, positionLocal, uv,
    vec2, vec3, vec4,
    sin, cos, mix, fract, dot, abs, clamp, pow, sqrt, max, min, normalize,
    mul, add, sub, div, floor
  } = THREE;
  
  // =========================================================================
  // WAVE CONFIGURATION - Multiple wave layers for natural ocean appearance
  // =========================================================================
  // Large primary waves (ocean swell)
  const WAVE1_DIR = { x: 1.0, y: 0.3 };
  const WAVE1_FREQ = 8.0;
  const WAVE1_SPEED = 0.6;
  const WAVE1_AMP = 0.35;
  const WAVE1_STEEP = 0.4;  // Gerstner steepness (0-1)
  
  // Medium secondary waves (wind waves)
  const WAVE2_DIR = { x: 0.4, y: 1.0 };
  const WAVE2_FREQ = 12.0;
  const WAVE2_SPEED = 0.8;
  const WAVE2_AMP = 0.25;
  const WAVE2_STEEP = 0.35;
  
  // Small detail waves (ripples)
  const WAVE3_DIR = { x: -0.6, y: 0.8 };
  const WAVE3_FREQ = 20.0;
  const WAVE3_SPEED = 1.2;
  const WAVE3_AMP = 0.12;
  const WAVE3_STEEP = 0.25;
  
  // Micro detail waves (surface texture)
  const WAVE4_DIR = { x: 0.7, y: -0.7 };
  const WAVE4_FREQ = 35.0;
  const WAVE4_SPEED = 1.5;
  const WAVE4_AMP = 0.06;
  const WAVE4_STEEP = 0.2;
  
  // Cross waves for interference patterns
  const WAVE5_DIR = { x: -0.3, y: -0.9 };
  const WAVE5_FREQ = 15.0;
  const WAVE5_SPEED = 0.9;
  const WAVE5_AMP = 0.15;
  const WAVE5_STEEP = 0.3;
  
  // =========================================================================
  // VISUAL PARAMETERS
  // =========================================================================
  // Specular (sun reflection)
  const SPECULAR_POWER = 64.0;
  const SPECULAR_INTENSITY = 0.6;
  const SPECULAR_TIGHTNESS = 128.0;  // Secondary tight specular
  
  // Foam
  const FOAM_THRESHOLD = 0.25;
  const FOAM_SOFTNESS = 4.0;
  const FOAM_INTENSITY = 0.45;
  const FOAM_NOISE_SCALE = 25.0;
  const FOAM_MOVEMENT = 0.3;
  
  // Fresnel (edge reflection)
  const FRESNEL_POWER = 3.0;
  const FRESNEL_BIAS = 0.1;
  const FRESNEL_SCALE = 0.6;
  
  // Subsurface scattering
  const SSS_STRENGTH = 0.35;
  const SSS_POWER = 2.5;
  
  // Caustics (light patterns)
  const CAUSTIC_SCALE = 18.0;
  const CAUSTIC_SPEED = 0.4;
  const CAUSTIC_INTENSITY = 0.12;
  
  // Opacity
  const BASE_OPACITY = 0.65;
  const OPACITY_MIN = 0.55;
  const OPACITY_MAX = 0.8;
  
  // =========================================================================
  // WATER COLORS - More nuanced palette
  // =========================================================================
  const deepOceanColor = vec3(0.02, 0.08, 0.22);     // Very deep blue
  const midOceanColor = vec3(0.05, 0.18, 0.38);      // Deep blue
  const shallowColor = vec3(0.12, 0.42, 0.58);       // Ocean blue
  const surfaceColor = vec3(0.18, 0.52, 0.68);       // Light blue
  const foamColor = vec3(0.92, 0.97, 1.0);           // White foam
  const sssColor = vec3(0.15, 0.65, 0.55);           // Cyan-green for SSS
  const skyReflectColor = vec3(0.45, 0.65, 0.85);    // Sky reflection tint
  
  // Time uniform for animation
  const timeUniform = uniform(0.0);
  
  // Store reference for animation updates
  if (!window.waterTimeUniform) {
    window.waterTimeUniform = timeUniform;
  }
  
  // Get UV coordinates
  const uvNode = uv();
  
  // =========================================================================
  // GERSTNER WAVE FUNCTION
  // Creates realistic wave shapes with steeper peaks and flatter troughs
  // Returns: height contribution and derivative for normal calculation
  // =========================================================================
  function gerstnerWave(uvCoord, dirX, dirY, frequency, speed, amplitude, steepness, time) {
    // Wave direction dot product with position
    const dotProduct = add(mul(uvCoord.x, dirX), mul(uvCoord.y, dirY));
    const phase = add(mul(dotProduct, frequency), mul(time, speed));
    
    // Gerstner wave height (steeper peaks, flatter troughs)
    const sinPhase = sin(phase);
    const cosPhase = cos(phase);
    
    // Height with steepness control
    const height = mul(amplitude, sinPhase);
    
    // Add steepness effect - sharpens wave peaks
    const steepnessEffect = mul(mul(steepness, amplitude), mul(cosPhase, cosPhase));
    const totalHeight = add(height, steepnessEffect);
    
    return totalHeight;
  }
  
  // =========================================================================
  // CALCULATE ALL WAVE LAYERS
  // =========================================================================
  const wave1 = gerstnerWave(uvNode, WAVE1_DIR.x, WAVE1_DIR.y, WAVE1_FREQ, WAVE1_SPEED, WAVE1_AMP, WAVE1_STEEP, timeUniform);
  const wave2 = gerstnerWave(uvNode, WAVE2_DIR.x, WAVE2_DIR.y, WAVE2_FREQ, WAVE2_SPEED, WAVE2_AMP, WAVE2_STEEP, timeUniform);
  const wave3 = gerstnerWave(uvNode, WAVE3_DIR.x, WAVE3_DIR.y, WAVE3_FREQ, WAVE3_SPEED, WAVE3_AMP, WAVE3_STEEP, timeUniform);
  const wave4 = gerstnerWave(uvNode, WAVE4_DIR.x, WAVE4_DIR.y, WAVE4_FREQ, WAVE4_SPEED, WAVE4_AMP, WAVE4_STEEP, timeUniform);
  const wave5 = gerstnerWave(uvNode, WAVE5_DIR.x, WAVE5_DIR.y, WAVE5_FREQ, WAVE5_SPEED, WAVE5_AMP, WAVE5_STEEP, timeUniform);
  
  // Combined wave height (normalized to roughly -1 to 1 range)
  const totalWaveHeight = add(add(add(add(wave1, wave2), wave3), wave4), wave5);
  const normalizedHeight = clamp(mul(totalWaveHeight, 1.2), -1.0, 1.0);
  
  // =========================================================================
  // PROCEDURAL NORMAL CALCULATION
  // Derive surface normals from wave derivatives for lighting
  // =========================================================================
  // Calculate wave derivatives for normal mapping
  const dx1 = mul(cos(add(mul(add(mul(uvNode.x, WAVE1_DIR.x), mul(uvNode.y, WAVE1_DIR.y)), WAVE1_FREQ), mul(timeUniform, WAVE1_SPEED))), mul(WAVE1_AMP, WAVE1_FREQ));
  const dx2 = mul(cos(add(mul(add(mul(uvNode.x, WAVE2_DIR.x), mul(uvNode.y, WAVE2_DIR.y)), WAVE2_FREQ), mul(timeUniform, WAVE2_SPEED))), mul(WAVE2_AMP, WAVE2_FREQ));
  const dx3 = mul(cos(add(mul(add(mul(uvNode.x, WAVE3_DIR.x), mul(uvNode.y, WAVE3_DIR.y)), WAVE3_FREQ), mul(timeUniform, WAVE3_SPEED))), mul(WAVE3_AMP, WAVE3_FREQ));
  
  // Combined derivative scaled down for stable normals
  const dxTotal = mul(add(add(mul(dx1, WAVE1_DIR.x), mul(dx2, WAVE2_DIR.x)), mul(dx3, WAVE3_DIR.x)), 0.15);
  const dyTotal = mul(add(add(mul(dx1, WAVE1_DIR.y), mul(dx2, WAVE2_DIR.y)), mul(dx3, WAVE3_DIR.y)), 0.15);
  
  // Construct normal (approximation for visual effect)
  const normalX = mul(dxTotal, -1.0);
  const normalY = 1.0;
  const normalZ = mul(dyTotal, -1.0);
  
  // =========================================================================
  // NOISE FUNCTION FOR DETAIL
  // Simple procedural noise for foam and caustics variation
  // =========================================================================
  function pseudoNoise(x, y) {
    const nx = sin(add(mul(x, 12.9898), mul(y, 78.233)));
    const fracPart = fract(mul(nx, 43758.5453));
    return fracPart;
  }
  
  // Animated noise coordinates
  const noiseX = add(mul(uvNode.x, FOAM_NOISE_SCALE), mul(timeUniform, FOAM_MOVEMENT));
  const noiseY = add(mul(uvNode.y, FOAM_NOISE_SCALE), mul(timeUniform, mul(FOAM_MOVEMENT, 0.7)));
  const noise = pseudoNoise(noiseX, noiseY);
  
  // =========================================================================
  // DEPTH-BASED COLOR
  // =========================================================================
  // Use wave height to simulate depth perception
  const depthFactor = clamp(add(0.5, mul(normalizedHeight, 0.3)), 0.0, 1.0);
  
  // Multi-level color blending for realistic depth appearance
  const deepToMid = mix(deepOceanColor, midOceanColor, depthFactor);
  const midToShallow = mix(midOceanColor, shallowColor, depthFactor);
  const waterColor = mix(deepToMid, midToShallow, mul(depthFactor, depthFactor));
  
  // =========================================================================
  // FRESNEL EFFECT
  // More reflection at grazing angles (edges), more refraction when looking down
  // =========================================================================
  // Simplified fresnel based on UV distance from center (simulates view angle)
  const centerDistX = sub(uvNode.x, 0.5);
  const centerDistY = sub(uvNode.y, 0.5);
  const distFromCenter = sqrt(add(mul(centerDistX, centerDistX), mul(centerDistY, centerDistY)));
  const fresnel = clamp(add(FRESNEL_BIAS, mul(pow(distFromCenter, FRESNEL_POWER), FRESNEL_SCALE)), 0.0, 1.0);
  
  // Apply fresnel - blend between water color and sky reflection
  const fresnelColor = mix(waterColor, skyReflectColor, mul(fresnel, 0.4));
  
  // =========================================================================
  // SUBSURFACE SCATTERING (SSS)
  // Light passing through thin parts of waves (crests)
  // =========================================================================
  const waveCrests = clamp(mul(add(normalizedHeight, 0.3), SSS_STRENGTH), 0.0, 1.0);
  const sssEffect = mul(pow(waveCrests, SSS_POWER), 0.5);
  const colorWithSSS = add(fresnelColor, mul(sssColor, sssEffect));
  
  // =========================================================================
  // SPECULAR HIGHLIGHTS (Sun reflection)
  // =========================================================================
  // Sun direction (matches directional light)
  const sunDirX = 0.5;
  const sunDirY = 0.8;
  const sunDirZ = 0.5;
  
  // View direction (simplified - looking down from above)
  const viewDirY = 1.0;
  
  // Reflect sun off wave normals
  const reflectDotView = clamp(add(mul(normalX, sunDirX), add(mul(normalY, sunDirY), mul(normalZ, sunDirZ))), 0.0, 1.0);
  
  // Main specular highlight
  const specular1 = mul(pow(reflectDotView, SPECULAR_POWER), SPECULAR_INTENSITY);
  
  // Secondary tight specular for sun sparkle
  const specular2 = mul(pow(reflectDotView, SPECULAR_TIGHTNESS), mul(SPECULAR_INTENSITY, 0.5));
  
  // Combine specular terms
  const totalSpecular = add(specular1, specular2);
  const specularColor = mul(vec3(1.0, 0.98, 0.9), totalSpecular);
  
  // =========================================================================
  // FOAM ON WAVE CRESTS
  // =========================================================================
  // Foam appears on wave peaks with noise variation
  const foamBase = clamp(mul(sub(normalizedHeight, FOAM_THRESHOLD), FOAM_SOFTNESS), 0.0, 1.0);
  const foamWithNoise = mul(foamBase, add(0.6, mul(noise, 0.4)));
  const foamAmount = clamp(mul(foamWithNoise, FOAM_INTENSITY), 0.0, 0.5);
  
  // Add foam to color
  const colorWithFoam = mix(colorWithSSS, foamColor, foamAmount);
  
  // =========================================================================
  // CAUSTIC PATTERNS
  // Light patterns from water surface focusing light
  // =========================================================================
  const causticX = add(mul(uvNode.x, CAUSTIC_SCALE), mul(timeUniform, CAUSTIC_SPEED));
  const causticY = add(mul(uvNode.y, CAUSTIC_SCALE), mul(timeUniform, mul(CAUSTIC_SPEED, 0.8)));
  const caustic1 = sin(add(causticX, mul(sin(causticY), 2.0)));
  const caustic2 = sin(add(mul(causticY, 1.3), mul(cos(causticX), 1.7)));
  const causticPattern = mul(mul(add(caustic1, caustic2), 0.5), CAUSTIC_INTENSITY);
  const causticBrightness = clamp(add(1.0, causticPattern), 0.95, 1.15);
  
  // Apply caustics as brightness modulation
  const colorWithCaustics = mul(colorWithFoam, causticBrightness);
  
  // =========================================================================
  // FINAL COLOR COMPOSITION
  // =========================================================================
  const finalColor = add(colorWithCaustics, specularColor);
  
  // =========================================================================
  // OPACITY WITH WAVE-BASED VARIATION
  // =========================================================================
  const opacityWaveEffect = mul(normalizedHeight, 0.08);
  const opacityFoamEffect = mul(foamAmount, 0.15);
  const finalOpacity = clamp(add(add(BASE_OPACITY, opacityWaveEffect), opacityFoamEffect), OPACITY_MIN, OPACITY_MAX);
  
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

  if (graphics_quality >= QUALITY_MEDIUM) {
    // Shadow mesh overlays the terrain to receive shadows from 3D objects
    // Uses ShadowMaterial which only renders shadows cast onto it
    var shadowMaterial = new THREE.ShadowMaterial();
    // Shadow opacity varies by quality: higher quality = darker, more defined shadows
    // QUALITY_HIGH: 0.75 opacity for more defined shadows
    // QUALITY_MEDIUM: 0.55 opacity for subtler shadows to balance performance
    shadowMaterial.opacity = (graphics_quality === QUALITY_HIGH) ? 0.75 : 0.55;
    shadowmesh = new THREE.Mesh( landGeometry, shadowMaterial);
    shadowmesh.receiveShadow = true;
    shadowmesh.castShadow = false;
    shadowmesh.name = "shadow_mesh";
    scene.add(shadowmesh);
    console.log("Shadow mesh enabled for terrain shadow receiving");
  }

  update_map_terrain_geometry();
  setInterval(update_map_terrain_geometry, 40);

  setInterval(update_map_known_tiles, 15);

  add_quality_dependent_objects_webgpu();

  add_all_objects_to_scene();

  benchmark_start = new Date().getTime();

}
