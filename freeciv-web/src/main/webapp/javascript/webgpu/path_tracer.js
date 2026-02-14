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

/**
 * Camera-First Path Tracer Module for Freeciv 3D
 * 
 * This is a CAMERA-FIRST (backward) path tracer, meaning:
 * - Rays ORIGINATE from the camera position (eye point)
 * - Rays are cast THROUGH each pixel on the image plane
 * - Rays travel INTO the scene to find surface intersections
 * - Light contribution is traced back toward the camera
 * 
 * This approach is more efficient than light-first tracing for scenes
 * with complex geometry because it only computes lighting for pixels
 * that are actually visible to the camera.
 * 
 * Implements real-time path tracing using THREE.js TSL (Three.js Shading Language)
 * for WebGPU. This provides photorealistic rendering with:
 * 
 * - Global Illumination via multi-bounce ray tracing (2+ bounces)
 * - Soft shadows through area light sampling
 * - PBR (Physically Based Rendering) materials
 * - Progressive sample accumulation (converges when camera is still)
 * - Water refraction (IOR 1.33) and metallic unit reflections
 * 
 * Architecture:
 * - Full-screen quad with custom TSL ShaderMaterial
 * - DataTextures for terrain heightmap and unit positions
 * - Ping-pong frame buffers for sample accumulation
 * - Camera-based ray generation with sub-pixel jitter for anti-aliasing
 */

// Path tracer state variables
let pathTracerEnabled = false;
let pathTracerQuad = null;
let pathTracerMaterial = null;
let pathTracerScene = null;
let pathTracerCamera = null;

// Accumulation buffers (ping-pong)
let accumulationBufferA = null;
let accumulationBufferB = null;
let currentAccumulationBuffer = 0;
let accumulatedSamples = 0;

// Data textures for scene representation
let terrainDataTexture = null;
let unitDataTexture = null;

// Uniforms for the path tracer shader
let pathTracerUniforms = null;

// Previous camera state for detecting movement
let prevCameraPosition = null;
let prevCameraQuaternion = null;

// Debug configuration
const DEBUG_LOG_INTERVAL_MS = 5000;

// Default map size fallback (used when map object is not available)
const DEFAULT_MAP_SIZE = 64;

// Tile-based rendering configuration
// Instead of rendering all pixels every frame, render one random tile at a time
const TILE_SIZE = 4;                    // Tile width/height in pixels (4x4 tiles)
const TILE_HALF_SIZE = TILE_SIZE * 0.5; // Half tile size for center calculation

/**
 * Initialize the path tracer renderer.
 * Creates the full-screen quad, shader material, accumulation buffers,
 * and data textures for scene representation.
 * 
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @param {THREE.Scene} mainScene - The main 3D scene
 * @param {THREE.Camera} mainCamera - The main camera
 */
function initPathTracer(renderer, mainScene, mainCamera) {
    if (!renderer || !mainScene || !mainCamera) {
        console.error('Path Tracer: Missing required parameters');
        return;
    }

    console.log('[PathTracer] Initializing Path Tracer...');
    console.log('[PathTracer] Renderer type:', renderer.constructor.name);
    console.log('[PathTracer] Camera type:', mainCamera.constructor.name);
    console.log('[PathTracer] Camera position:', mainCamera.position.x, mainCamera.position.y, mainCamera.position.z);

    // Get viewport size
    const size = renderer.getSize(new THREE.Vector2());
    const width = size.x;
    const height = size.y;
    console.log('[PathTracer] Viewport size:', width, 'x', height);

    if (width === 0 || height === 0) {
        console.error('[PathTracer] Invalid viewport size: width or height is 0');
        return;
    }

    // Create accumulation render targets (ping-pong buffers)
    const rtOptions = {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        depthBuffer: false,
        stencilBuffer: false
    };

    accumulationBufferA = new THREE.WebGLRenderTarget(width, height, rtOptions);
    accumulationBufferB = new THREE.WebGLRenderTarget(width, height, rtOptions);
    accumulationBufferA.texture.name = 'PathTracer_AccumA';
    accumulationBufferB.texture.name = 'PathTracer_AccumB';
    console.log('[PathTracer] Accumulation buffers created');

    // Create terrain data texture from heightmap
    createTerrainDataTexture();
    console.log('[PathTracer] Terrain data texture created:', terrainDataTexture ? 'OK' : 'FAILED');

    // Create unit data texture (initially empty)
    createUnitDataTexture();
    console.log('[PathTracer] Unit data texture created:', unitDataTexture ? 'OK' : 'FAILED');

    // Create path tracer uniforms
    createPathTracerUniforms(mainCamera, width, height);
    console.log('[PathTracer] Uniforms created:', pathTracerUniforms ? 'OK' : 'FAILED');

    // Create path tracer material using TSL
    try {
        pathTracerMaterial = createPathTracerMaterial();
        console.log('[PathTracer] Material created:', pathTracerMaterial ? 'OK' : 'FAILED');
        if (pathTracerMaterial) {
            console.log('[PathTracer] Material colorNode:', pathTracerMaterial.colorNode ? 'present' : 'MISSING');
        }
    } catch (e) {
        console.error('[PathTracer] Failed to create material:', e);
        return;
    }

    // Initialize TSL uniforms with actual values from pathTracerUniforms
    // This is necessary because TSL uniforms are created with defaults in createPathTracerMaterial()
    if (window.pathTracerTSLUniforms && pathTracerUniforms) {
        try {
            // Initialize resolution with actual viewport dimensions
            window.pathTracerTSLUniforms.resolution.value.copy(pathTracerUniforms.resolution.value);
            console.log('[PathTracer] Resolution uniform initialized:', width, 'x', height);
            
            // Initialize camera uniforms with main camera values
            mainCamera.updateMatrixWorld();
            mainCamera.updateProjectionMatrix();
            window.pathTracerTSLUniforms.mainCameraPosition.value.copy(mainCamera.position);
            window.pathTracerTSLUniforms.mainCameraProjectionMatrixInverse.value.copy(mainCamera.projectionMatrixInverse);
            window.pathTracerTSLUniforms.mainCameraWorldMatrix.value.copy(mainCamera.matrixWorld);
            console.log('[PathTracer] Camera uniforms initialized:', 
                mainCamera.position.x.toFixed(2), 
                mainCamera.position.y.toFixed(2), 
                mainCamera.position.z.toFixed(2));
            
            // Initialize map uniforms
            window.pathTracerTSLUniforms.mapSize.value.copy(pathTracerUniforms.mapSize.value);
            window.pathTracerTSLUniforms.mapWorldSize.value.copy(pathTracerUniforms.mapWorldSize.value);
            
            // Initialize lighting and material uniforms
            window.pathTracerTSLUniforms.sunDirection.value.copy(pathTracerUniforms.sunDirection.value);
            window.pathTracerTSLUniforms.sunIntensity.value = pathTracerUniforms.sunIntensity.value;
            window.pathTracerTSLUniforms.sunColor.value.copy(pathTracerUniforms.sunColor.value);
            window.pathTracerTSLUniforms.skyColor.value.copy(pathTracerUniforms.skyColor.value);
            window.pathTracerTSLUniforms.groundColor.value.copy(pathTracerUniforms.groundColor.value);
            window.pathTracerTSLUniforms.waterRoughness.value = pathTracerUniforms.waterRoughness.value;
            window.pathTracerTSLUniforms.waterIOR.value = pathTracerUniforms.waterIOR.value;
            window.pathTracerTSLUniforms.waterColor.value.copy(pathTracerUniforms.waterColor.value);
            window.pathTracerTSLUniforms.metalRoughness.value = pathTracerUniforms.metalRoughness.value;
            window.pathTracerTSLUniforms.metalColor.value.copy(pathTracerUniforms.metalColor.value);
            window.pathTracerTSLUniforms.terrainRoughness.value = pathTracerUniforms.terrainRoughness.value;
            window.pathTracerTSLUniforms.maxBounces.value = pathTracerUniforms.maxBounces.value;
            
            console.log('[PathTracer] All TSL uniforms initialized from pathTracerUniforms');
        } catch (e) {
            console.warn('[PathTracer] Error initializing some uniforms:', e.message);
        }
    }

    // Create full-screen quad
    const quadGeometry = new THREE.PlaneGeometry(2, 2);
    pathTracerQuad = new THREE.Mesh(quadGeometry, pathTracerMaterial);
    pathTracerQuad.frustumCulled = false;
    pathTracerQuad.name = 'PathTracerQuad';
    console.log('[PathTracer] Quad mesh created');

    // Create orthographic camera for quad rendering
    pathTracerCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    console.log('[PathTracer] Orthographic camera created');

    // Create scene for path tracer quad
    pathTracerScene = new THREE.Scene();
    pathTracerScene.add(pathTracerQuad);
    console.log('[PathTracer] Scene created with quad');

    // Store previous camera state
    prevCameraPosition = mainCamera.position.clone();
    prevCameraQuaternion = mainCamera.quaternion.clone();

    console.log('[PathTracer] Initialized successfully');
    console.log('[PathTracer] Map dimensions:', map ? map.xsize + 'x' + map.ysize : 'map not available');
    console.log('[PathTracer] Map world size:', mapview_model_width, 'x', mapview_model_height);
}

/**
 * Create the terrain data texture from the heightmap.
 * Encodes terrain heights and types into a DataTexture for GPU access.
 */
function createTerrainDataTexture() {
    // Get map dimensions
    const mapWidth = map ? map.xsize : DEFAULT_MAP_SIZE;
    const mapHeight = map ? map.ysize : DEFAULT_MAP_SIZE;

    // Create data array (RGBA float)
    // R = height, G = terrain type, B = is_water, A = reserved
    const data = new Float32Array(mapWidth * mapHeight * 4);

    // Terrain type constants matching TerrainType from config.js
    const TERRAIN_INACCESSIBLE = 0;   // Inaccessible/ocean
    const TERRAIN_LAKE = 10;          // Lake tiles
    const TERRAIN_COAST = 20;         // Coastal water

    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            const idx = (y * mapWidth + x) * 4;
            const tile = tiles ? tiles[x + y * mapWidth] : null;
            
            if (tile) {
                // Height (normalized to 0-1 range)
                data[idx + 0] = tile.height !== undefined ? tile.height : 0.5;
                // Terrain type (normalized)
                data[idx + 1] = tile.terrain !== undefined ? tile.terrain / 255.0 : 0.5;
                // Is water (coast, ocean, lake) - use named constants
                const terrain = tile.terrain;
                const isWater = (terrain === TERRAIN_LAKE || terrain === TERRAIN_COAST || terrain === TERRAIN_INACCESSIBLE) ? 1.0 : 0.0;
                data[idx + 2] = isWater;
                // Reserved
                data[idx + 3] = 1.0;
            } else {
                // Default values
                data[idx + 0] = 0.5;
                data[idx + 1] = 0.5;
                data[idx + 2] = 0.0;
                data[idx + 3] = 1.0;
            }
        }
    }

    // Create DataTexture
    terrainDataTexture = new THREE.DataTexture(
        data,
        mapWidth,
        mapHeight,
        THREE.RGBAFormat,
        THREE.FloatType
    );
    terrainDataTexture.needsUpdate = true;
    terrainDataTexture.name = 'PathTracer_TerrainData';
}

/**
 * Create the unit data texture for unit positions and types.
 * Encodes unit positions as a grid texture.
 */
function createUnitDataTexture() {
    // Get map dimensions
    const mapWidth = map ? map.xsize : DEFAULT_MAP_SIZE;
    const mapHeight = map ? map.ysize : DEFAULT_MAP_SIZE;

    // Create data array (RGBA float)
    // R = has_unit, G = unit_type, B = is_metallic, A = reserved
    const data = new Float32Array(mapWidth * mapHeight * 4);

    // Initialize with no units
    for (let i = 0; i < data.length; i += 4) {
        data[i + 0] = 0.0;  // No unit
        data[i + 1] = 0.0;  // Type
        data[i + 2] = 0.0;  // Not metallic
        data[i + 3] = 1.0;  // Reserved
    }

    // Populate with actual unit data if available
    if (typeof units !== 'undefined' && units) {
        for (const unitId in units) {
            const unit = units[unitId];
            if (unit && unit.tile !== undefined) {
                const tile = tiles[unit.tile];
                if (tile) {
                    const x = tile.x;
                    const y = tile.y;
                    const idx = (y * mapWidth + x) * 4;
                    data[idx + 0] = 1.0;  // Has unit
                    data[idx + 1] = (unit.type || 0) / 255.0;  // Unit type
                    data[idx + 2] = 1.0;  // Metallic (all units are metallic for now)
                    data[idx + 3] = 1.0;
                }
            }
        }
    }

    // Create DataTexture
    unitDataTexture = new THREE.DataTexture(
        data,
        mapWidth,
        mapHeight,
        THREE.RGBAFormat,
        THREE.FloatType
    );
    unitDataTexture.needsUpdate = true;
    unitDataTexture.name = 'PathTracer_UnitData';
}

/**
 * Create uniforms for the path tracer shader.
 * Note: Camera matrices now use built-in TSL nodes.
 * 
 * @param {THREE.Camera} camera - The main camera
 * @param {number} width - Viewport width
 * @param {number} height - Viewport height
 */
function createPathTracerUniforms(camera, width, height) {
    const config = window.PathTracerConfig || {};
    const sky = config.SKY || {};
    const materials = config.MATERIALS || {};

    pathTracerUniforms = {
        // Time and frame counter
        time: { value: 0.0 },
        frameCount: { value: 0 },
        accumulatedSamples: { value: 0 },
        
        // Resolution
        resolution: { value: new THREE.Vector2(width, height) },
        
        // Note: Camera matrices now use built-in TSL nodes (cameraPosition,
        // cameraProjectionMatrixInverse, cameraWorldMatrix) which auto-update
        
        // Previous accumulation buffer
        previousFrame: { value: null },
        
        // Terrain data
        terrainData: { value: terrainDataTexture },
        unitData: { value: unitDataTexture },
        mapSize: { value: new THREE.Vector2(map ? map.xsize : DEFAULT_MAP_SIZE, map ? map.ysize : DEFAULT_MAP_SIZE) },
        
        // Map world dimensions
        mapWorldSize: { value: new THREE.Vector2(
            mapview_model_width || 2000,
            mapview_model_height ? mapview_model_height * HEX_HEIGHT_FACTOR : 2000
        )},
        
        // Path tracer settings
        maxBounces: { value: config.MAX_BOUNCES || 2 },
        samplesPerFrame: { value: config.SAMPLES_PER_FRAME || 1 },
        
        // Sky/lighting settings
        sunDirection: { value: new THREE.Vector3(
            sky.SUN_DIRECTION?.x || 0.5,
            sky.SUN_DIRECTION?.y || 0.8,
            sky.SUN_DIRECTION?.z || 0.5
        ).normalize() },
        sunIntensity: { value: sky.SUN_INTENSITY || 3.0 },
        sunColor: { value: new THREE.Vector3(
            sky.SUN_COLOR?.r || 1.0,
            sky.SUN_COLOR?.g || 0.95,
            sky.SUN_COLOR?.b || 0.85
        )},
        skyColor: { value: new THREE.Vector3(
            sky.SKY_COLOR?.r || 0.4,
            sky.SKY_COLOR?.g || 0.6,
            sky.SKY_COLOR?.b || 0.9
        )},
        groundColor: { value: new THREE.Vector3(
            sky.GROUND_COLOR?.r || 0.3,
            sky.GROUND_COLOR?.g || 0.25,
            sky.GROUND_COLOR?.b || 0.2
        )},
        
        // Water material properties
        waterRoughness: { value: materials.WATER?.ROUGHNESS || 0.05 },
        waterIOR: { value: materials.WATER?.IOR || 1.33 },
        waterColor: { value: new THREE.Vector3(
            materials.WATER?.COLOR?.r || 0.1,
            materials.WATER?.COLOR?.g || 0.3,
            materials.WATER?.COLOR?.b || 0.5
        )},
        
        // Metal material properties
        metalRoughness: { value: materials.UNIT_METAL?.ROUGHNESS || 0.3 },
        metalColor: { value: new THREE.Vector3(
            materials.UNIT_METAL?.COLOR?.r || 0.8,
            materials.UNIT_METAL?.COLOR?.g || 0.8,
            materials.UNIT_METAL?.COLOR?.b || 0.85
        )},
        
        // Terrain material properties
        terrainRoughness: { value: materials.TERRAIN?.ROUGHNESS || 0.85 }
    };
}

/**
 * Create the path tracer material using THREE.js TSL.
 * This implements the full path tracing algorithm in the shader.
 * 
 * @returns {THREE.MeshBasicNodeMaterial} The path tracer material
 */
function createPathTracerMaterial() {
    console.log('[PathTracer] Creating path tracer material...');
    
    // Import TSL functions and nodes from THREE
    // These should be available after three-modules-webgpu.js has loaded
    // Note: We do NOT use built-in cameraPosition, cameraProjectionMatrixInverse, cameraWorldMatrix
    // because we render with an orthographic camera but need main game camera matrices
    const { 
        texture, uniform, uv,
        vec2, vec3, vec4,
        mix, step, floor, fract, mod, dot, sin, cos, normalize, max, min, pow, clamp, abs, sqrt,
        mul, add, sub, div, reflect, refract,
        // TSL control flow and function definition
        Fn, If, Loop, Break, Return,
        // Additional math functions
        cross, length, negate, exp, sign
    } = THREE;

    // Pre-computed constants for efficiency
    const PI = Math.PI;
    const TWO_PI = 2.0 * Math.PI;

    // Verify all required TSL functions and nodes are available
    const requiredTSLNames = [
        'texture', 'uniform', 'uv',
        'vec2', 'vec3', 'vec4',
        'mix', 'step', 'floor', 'fract', 'mod', 'dot', 'sin', 'cos', 'normalize', 'max', 'min', 'pow', 'clamp', 'abs', 'sqrt',
        'mul', 'add', 'sub', 'div', 'reflect', 'refract',
        'Fn', 'If', 'Loop', 'Break', 'Return',
        'cross', 'length', 'negate', 'exp', 'sign'
    ];
    const missing = requiredTSLNames.filter(name => THREE[name] === undefined);
    if (missing.length > 0) {
        console.error('[PathTracer] Missing TSL functions/nodes:', missing);
        throw new Error(`Path Tracer: Required TSL functions/nodes not available: ${missing.join(', ')}. Ensure three-modules-webgpu.js has loaded successfully.`);
    }
    console.log('[PathTracer] All TSL functions available');

    // Create uniforms as TSL uniform nodes
    // IMPORTANT: We pass main camera matrices as custom uniforms because we render
    // the fullscreen quad with an orthographic camera, but need the main game camera's
    // view/projection for ray generation
    const timeUniform = uniform(0.0);
    const frameCountUniform = uniform(0);
    const accumulatedSamplesUniform = uniform(0);
    const resolutionUniform = uniform(new THREE.Vector2(1, 1));
    
    // Main camera uniforms - these are updated each frame with the game camera values
    const mainCameraPositionUniform = uniform(new THREE.Vector3(0, 100, 0));
    const mainCameraProjectionMatrixInverseUniform = uniform(new THREE.Matrix4());
    const mainCameraWorldMatrixUniform = uniform(new THREE.Matrix4());
    
    // For textures in TSL, we create texture nodes that can be sampled.
    // The actual THREE.Texture instances are passed directly to texture() calls.
    // Store texture references for use in sampling functions.
    const terrainDataTex = terrainDataTexture;
    const unitDataTex = unitDataTexture;
    // Previous frame texture - for accumulation, we create a texture node
    // that can have its .value updated for ping-pong buffer swapping
    const previousFrameTextureNode = texture(accumulationBufferA.texture);
    
    const mapSizeUniform = uniform(new THREE.Vector2(64, 64));
    const mapWorldSizeUniform = uniform(new THREE.Vector2(2000, 2000));
    const maxBouncesUniform = uniform(2);
    const sunDirectionUniform = uniform(new THREE.Vector3(0.5, 0.8, 0.5));
    const sunIntensityUniform = uniform(3.0);
    const sunColorUniform = uniform(new THREE.Vector3(1.0, 0.95, 0.85));
    const skyColorUniform = uniform(new THREE.Vector3(0.4, 0.6, 0.9));
    const groundColorUniform = uniform(new THREE.Vector3(0.3, 0.25, 0.2));
    const waterRoughnessUniform = uniform(0.05);
    const waterIORUniform = uniform(1.33);
    const waterColorUniform = uniform(new THREE.Vector3(0.1, 0.3, 0.5));
    const metalRoughnessUniform = uniform(0.3);
    const metalColorUniform = uniform(new THREE.Vector3(0.8, 0.8, 0.85));
    const terrainRoughnessUniform = uniform(0.85);
    
    // Performance optimization: render one random tile at a time
    // TILE_SIZE is defined at module level (currently 4x4 pixels)
    const randomTileUniform = uniform(new THREE.Vector2(0, 0)); // Current tile coordinates to render

    // Store uniforms for external updates
    // Note: For TSL texture nodes, .value can be updated to swap textures
    // Camera matrices are now passed as custom uniforms since we render with orthographic camera
    window.pathTracerTSLUniforms = {
        time: timeUniform,
        frameCount: frameCountUniform,
        accumulatedSamples: accumulatedSamplesUniform,
        resolution: resolutionUniform,
        // Main camera uniforms - updated each frame with main game camera values
        mainCameraPosition: mainCameraPositionUniform,
        mainCameraProjectionMatrixInverse: mainCameraProjectionMatrixInverseUniform,
        mainCameraWorldMatrix: mainCameraWorldMatrixUniform,
        // previousFrame is a TSL texture node - its .value can be updated for ping-pong buffering
        previousFrame: previousFrameTextureNode,
        // These are reference wrappers (note: shader uses baked-in texture refs)
        terrainData: { value: terrainDataTex },
        unitData: { value: unitDataTex },
        mapSize: mapSizeUniform,
        mapWorldSize: mapWorldSizeUniform,
        maxBounces: maxBouncesUniform,
        sunDirection: sunDirectionUniform,
        sunIntensity: sunIntensityUniform,
        sunColor: sunColorUniform,
        skyColor: skyColorUniform,
        groundColor: groundColorUniform,
        waterRoughness: waterRoughnessUniform,
        waterIOR: waterIORUniform,
        waterColor: waterColorUniform,
        metalRoughness: metalRoughnessUniform,
        metalColor: metalColorUniform,
        terrainRoughness: terrainRoughnessUniform,
        randomTile: randomTileUniform
    };

    // ==== UTILITY FUNCTIONS ====

    // Hash function for pseudo-random numbers
    function hash(p) {
        return fract(mul(sin(mul(p, 127.1)), 43758.5453));
    }

    // 2D hash for random number generation
    function hash2(px, py) {
        const h1 = hash(add(mul(px, 12.9898), mul(py, 78.233)));
        const h2 = hash(add(mul(px, 63.7264), mul(py, 10.873)));
        return vec2(h1, h2);
    }

    // Random value based on pixel and frame
    function random(px, py, seed) {
        return hash(add(add(mul(px, 12.9898), mul(py, 78.233)), mul(seed, 43758.5453)));
    }

    // ==== BLUE NOISE SAMPLING ====
    // Blue noise provides better sample distribution than white noise,
    // leading to faster convergence in path tracing. This is an approximation
    // using interleaved gradient noise which has blue noise-like properties.
    
    // Interleaved Gradient Noise - approximates blue noise properties
    // Reference: "Next Generation Post Processing in Call of Duty: Advanced Warfare" (Jimenez, 2014)
    function interleavedGradientNoise(px, py, frame) {
        // Magic numbers for interleaved gradient noise
        const magic = vec3(0.06711056, 0.00583715, 52.9829189);
        // Add frame-based temporal offset using golden ratio for good distribution
        const frameOffset = mul(frame, 0.618033988749895);
        const dotProduct = add(add(mul(px, magic.x), mul(py, magic.y)), frameOffset);
        return fract(mul(magic.z, fract(dotProduct)));
    }
    
    // 2D Blue Noise sample using R2 quasi-random sequence (low-discrepancy)
    // R2 sequence provides excellent 2D coverage with blue noise properties
    // Reference: "The Unreasonable Effectiveness of Quasirandom Sequences" (Roberts, 2018)
    function blueNoise2D(px, py, frame) {
        // R2 sequence constants (based on the plastic number / plastic ratio)
        const g = 1.32471795724474602596;  // Plastic number (unique real solution to x³ = x + 1)
        const a1 = div(1.0, g);        // ≈ 0.7548776662
        const a2 = div(1.0, mul(g, g)); // ≈ 0.5698402910
        
        // Base sample from interleaved gradient noise
        const base = interleavedGradientNoise(px, py, frame);
        
        // Add R2 sequence offset based on frame number for temporal variation
        const r2x = fract(add(base, mul(frame, a1)));
        const r2y = fract(add(base, mul(frame, a2)));
        
        return vec2(r2x, r2y);
    }
    
    // Blue noise random value (single dimension)
    function blueNoiseRandom(px, py, seed) {
        return interleavedGradientNoise(px, py, seed);
    }

    // ==== COSINE-WEIGHTED HEMISPHERE SAMPLING ====
    // Generates a random direction for indirect lighting (Lambertian BRDF)
    // This sampling strategy is importance-sampled for diffuse surfaces
    function cosineWeightedDirection(normalX, normalY, normalZ, r1, r2) {
        // Convert uniform random numbers to spherical coordinates
        // r1, r2 are uniform random values in [0, 1]
        const phi = mul(TWO_PI, r1);
        const cosTheta = sqrt(r2);
        const sinTheta = sqrt(sub(1.0, r2));
        
        // Create tangent space direction
        const localX = mul(sinTheta, cos(phi));
        const localY = mul(sinTheta, sin(phi));
        const localZ = cosTheta;
        
        // Build orthonormal basis from normal
        // Find a vector not parallel to normal for cross product
        const absNormalX = abs(normalX);
        const absNormalY = abs(normalY);
        const pickX = step(absNormalX, 0.9);
        
        // Reference vector: (1,0,0) if normal.y is dominant, otherwise (0,1,0)
        const refX = pickX;
        const refY = sub(1.0, pickX);
        const refZ = 0.0;
        
        // Tangent = cross(normal, ref)
        const tangentX = sub(mul(normalY, refZ), mul(normalZ, refY));
        const tangentY = sub(mul(normalZ, refX), mul(normalX, refZ));
        const tangentZ = sub(mul(normalX, refY), mul(normalY, refX));
        
        // Normalize tangent
        const tangentLen = sqrt(add(add(mul(tangentX, tangentX), mul(tangentY, tangentY)), mul(tangentZ, tangentZ)));
        const tanX = div(tangentX, max(tangentLen, 0.0001));
        const tanY = div(tangentY, max(tangentLen, 0.0001));
        const tanZ = div(tangentZ, max(tangentLen, 0.0001));
        
        // Bitangent = cross(normal, tangent)
        const bitX = sub(mul(normalY, tanZ), mul(normalZ, tanY));
        const bitY = sub(mul(normalZ, tanX), mul(normalX, tanZ));
        const bitZ = sub(mul(normalX, tanY), mul(normalY, tanX));
        
        // Transform local direction to world space
        // worldDir = localX * tangent + localY * bitangent + localZ * normal
        const worldDirX = add(add(mul(localX, tanX), mul(localY, bitX)), mul(localZ, normalX));
        const worldDirY = add(add(mul(localX, tanY), mul(localY, bitY)), mul(localZ, normalY));
        const worldDirZ = add(add(mul(localX, tanZ), mul(localY, bitZ)), mul(localZ, normalZ));
        
        return vec3(worldDirX, worldDirY, worldDirZ);
    }

    // Get UV coordinates
    const uvCoord = uv();
    
    // ==== PERFORMANCE OPTIMIZATION: TILE-BASED RENDERING ====
    // Instead of rendering all pixels every frame, render one random 4x4 tile at a time.
    // This dramatically reduces per-frame computation while still converging to a complete image.
    
    // Calculate which 4x4 tile this pixel belongs to
    const pixelCoordX = mul(uvCoord.x, resolutionUniform.x);
    const pixelCoordY = mul(uvCoord.y, resolutionUniform.y);
    const currentTileX = floor(div(pixelCoordX, TILE_SIZE));
    const currentTileY = floor(div(pixelCoordY, TILE_SIZE));
    
    // Check if this pixel is in the randomly selected tile
    // randomTileUniform contains the tile coordinates to render this frame
    // step(abs(a - b), 0.5) returns 1 when |a - b| <= 0.5, which for integer tile indices
    // means the tiles match exactly (0.5 threshold handles floating-point precision)
    const isSelectedTileX = step(abs(sub(currentTileX, randomTileUniform.x)), 0.5);
    const isSelectedTileY = step(abs(sub(currentTileY, randomTileUniform.y)), 0.5);
    const isSelectedTile = mul(isSelectedTileX, isSelectedTileY);
    
    // Quantize UV to 4x4 pixel blocks - all pixels in a tile use the center UV
    // This makes each "pixel" appear as a 4x4 block for artistic effect
    const tileUvX = div(add(mul(currentTileX, TILE_SIZE), TILE_HALF_SIZE), resolutionUniform.x);
    const tileUvY = div(add(mul(currentTileY, TILE_SIZE), TILE_HALF_SIZE), resolutionUniform.y);

    // Calculate normalized device coordinates (NDC) from quantized UV
    // UV goes from 0 to 1, NDC goes from -1 to +1
    const ndcX = sub(mul(tileUvX, 2.0), 1.0);
    const ndcY = sub(mul(tileUvY, 2.0), 1.0);

    // Generate random seed from frame count and tile position for stochastic sampling
    // Use tile UV to ensure all pixels in a tile use the same random values
    const randomSeed = add(mul(frameCountUniform, 0.618033988), mul(add(tileUvX, mul(tileUvY, 1000.0)), 0.0001));

    // ============================================================
    // CAMERA-FIRST RAY GENERATION
    // ============================================================
    // In Camera-First (backward) path tracing, we:
    // 1. Start rays AT the camera position (eye point)
    // 2. Cast rays THROUGH each pixel on the image plane
    // 3. Trace rays INTO the scene to find intersections
    // 4. Accumulate light contribution back toward the camera
    // ============================================================

    // ==== BLUE NOISE SUB-PIXEL JITTER ====
    // Use blue noise for anti-aliasing jitter instead of white noise
    // Blue noise provides better sample distribution, leading to:
    // - Faster convergence (fewer samples needed for smooth image)
    // - Less visible noise patterns during accumulation
    // - More perceptually pleasing intermediate results
    // Use tile center position for blue noise sampling (since we render 4x4 tiles as single pixels)
    const pixelX = mul(tileUvX, resolutionUniform.x);
    const pixelY = mul(tileUvY, resolutionUniform.y);
    const blueNoiseSample = blueNoise2D(pixelX, pixelY, frameCountUniform);
    
    // Convert blue noise [0,1] to centered sub-pixel jitter in NDC space
    // Result is in range [-0.5/resolution, +0.5/resolution] which covers one pixel in NDC
    const jitterX = mul(sub(blueNoiseSample.x, 0.5), div(1.0, resolutionUniform.x));
    const jitterY = mul(sub(blueNoiseSample.y, 0.5), div(1.0, resolutionUniform.y));

    // Apply jitter to NDC coordinates
    const jitteredNdcX = add(ndcX, jitterX);
    const jitteredNdcY = add(ndcY, jitterY);

    // RAY ORIGIN: Use our custom camera position uniform (main game camera)
    // We pass the main camera position as a uniform because we render with an orthographic camera
    const rayOrigin = vec3(mainCameraPositionUniform.x, mainCameraPositionUniform.y, mainCameraPositionUniform.z);

    // RAY DIRECTION: Transform NDC coordinates through inverse projection and camera matrices
    // Using our custom matrix uniforms (main game camera) for proper ray generation
    
    // Create clip-space coordinate (NDC with z=-1 for near plane, w=1)
    const clipSpace = vec4(jitteredNdcX, jitteredNdcY, -1.0, 1.0);
    
    // Transform clip space to view space using inverse projection matrix from main camera
    const projInv = mainCameraProjectionMatrixInverseUniform;
    
    // Manually compute matrix * vector since TSL doesn't support direct mat4 * vec4
    // projInv is column-major, access as projInv[col][row]
    const viewX = add(add(add(
        mul(projInv[0].x, clipSpace.x),
        mul(projInv[1].x, clipSpace.y)),
        mul(projInv[2].x, clipSpace.z)),
        mul(projInv[3].x, clipSpace.w));
    const viewY = add(add(add(
        mul(projInv[0].y, clipSpace.x),
        mul(projInv[1].y, clipSpace.y)),
        mul(projInv[2].y, clipSpace.z)),
        mul(projInv[3].y, clipSpace.w));
    const viewZ = add(add(add(
        mul(projInv[0].z, clipSpace.x),
        mul(projInv[1].z, clipSpace.y)),
        mul(projInv[2].z, clipSpace.z)),
        mul(projInv[3].z, clipSpace.w));
    const viewW = add(add(add(
        mul(projInv[0].w, clipSpace.x),
        mul(projInv[1].w, clipSpace.y)),
        mul(projInv[2].w, clipSpace.z)),
        mul(projInv[3].w, clipSpace.w));

    // Perspective divide to get view-space direction
    const viewDirX = div(viewX, viewW);
    const viewDirY = div(viewY, viewW);
    const viewDirZ = div(viewZ, viewW);

    // Transform view-space direction to world-space using camera world matrix (rotation only)
    // worldDir = cameraWorldMatrix * viewDir (3x3 upper-left for rotation)
    const camWorld = mainCameraWorldMatrixUniform;
    const worldDirX = add(add(
        mul(camWorld[0].x, viewDirX),
        mul(camWorld[1].x, viewDirY)),
        mul(camWorld[2].x, viewDirZ));
    const worldDirY = add(add(
        mul(camWorld[0].y, viewDirX),
        mul(camWorld[1].y, viewDirY)),
        mul(camWorld[2].y, viewDirZ));
    const worldDirZ = add(add(
        mul(camWorld[0].z, viewDirX),
        mul(camWorld[1].z, viewDirY)),
        mul(camWorld[2].z, viewDirZ));

    // Final ray direction: normalized world-space vector FROM camera THROUGH pixel INTO scene
    const rayDir = normalize(vec3(worldDirX, worldDirY, worldDirZ));

    // ============================================================
    // TERRAIN INTERSECTION (Heightfield Raymarching)
    // ============================================================
    // Using TSL Fn for reusable GPU shader functions
    // March the ray from the camera into the scene, checking for
    // intersections with terrain, water, and units

    // Water level constant - matches water mesh Y position in mapview_webgpu.js
    // This defines the Y coordinate where water surface is rendered
    const WATER_LEVEL = 50.0;

    // ==== WORLD-TO-UV COORDINATE CONVERSION ====
    // World coordinates are centered at (0,0,0) in the middle of the map.
    // Map extends from -mapWorldSize/2 to +mapWorldSize/2 in X and Z.
    // UV coordinates range from 0 to 1, where:
    //   UV(0,0) = world position (-mapWorldSize.x/2, -mapWorldSize.y/2)
    //   UV(1,1) = world position (+mapWorldSize.x/2, +mapWorldSize.y/2)
    //   UV(0.5,0.5) = world position (0, 0) = map center
    //
    // Formula: UV = (worldPos + mapWorldSize/2) / mapWorldSize

    // Sample terrain height at world position - helper function
    function sampleTerrainHeight(worldX, worldZ) {
        // Convert world coords to map UV using the world-to-UV formula
        // mapU = (worldX + mapWorldSize.x/2) / mapWorldSize.x
        // This maps world X range [-mapWorldSize.x/2, +mapWorldSize.x/2] to UV range [0, 1]
        const mapU = div(add(worldX, mul(mapWorldSizeUniform.x, 0.5)), mapWorldSizeUniform.x);
        const mapV = div(add(worldZ, mul(mapWorldSizeUniform.y, 0.5)), mapWorldSizeUniform.y);
        
        // Sample terrain data texture (clamped to [0,1] to handle out-of-bounds)
        const terrainSample = texture(terrainDataTex, vec2(clamp(mapU, 0.0, 1.0), clamp(mapV, 0.0, 1.0)));
        
        // Height is in R channel, scaled by 100 to convert normalized height to world units
        // The terrain data stores heights in [0,1] range, multiply by 100 for world Y coordinates
        return mul(terrainSample.r, 100.0);
    }

    // Sample if position is water - helper function
    function sampleIsWater(worldX, worldZ) {
        const mapU = div(add(worldX, mul(mapWorldSizeUniform.x, 0.5)), mapWorldSizeUniform.x);
        const mapV = div(add(worldZ, mul(mapWorldSizeUniform.y, 0.5)), mapWorldSizeUniform.y);
        const terrainSample = texture(terrainDataTex, vec2(clamp(mapU, 0.0, 1.0), clamp(mapV, 0.0, 1.0)));
        return terrainSample.b;  // B channel = is_water (1.0 if water, 0.0 otherwise)
    }

    // Sample unit presence - helper function
    function sampleUnit(worldX, worldZ) {
        const mapU = div(add(worldX, mul(mapWorldSizeUniform.x, 0.5)), mapWorldSizeUniform.x);
        const mapV = div(add(worldZ, mul(mapWorldSizeUniform.y, 0.5)), mapWorldSizeUniform.y);
        return texture(unitDataTex, vec2(clamp(mapU, 0.0, 1.0), clamp(mapV, 0.0, 1.0)));
    }

    // ==== RAY-HEIGHTMAP INTERSECTION FUNCTION (TSL Fn) ====
    // Performs ray marching through the terrain heightfield texture
    // with Binary Search refinement to eliminate stepping artifacts (ring patterns)
    // Returns: vec4(hitT, materialType, isWater, didHit)
    // - hitT: distance along ray to intersection point (refined via binary search)
    // - materialType: 0=terrain, 1=water, 2=metal unit
    // - isWater: 1.0 if water surface, 0.0 otherwise
    // - didHit: 1.0 if any intersection found, 0.0 otherwise
    const rayMarchHeightfield = Fn(([rayOriginX, rayOriginY, rayOriginZ, rayDirX, rayDirY, rayDirZ]) => {
        const RAYMARCH_STEPS = 24;  // Reduced from 32 for better performance
        const BINARY_SEARCH_STEPS = 4;  // Reduced from 8, still provides smooth intersections
        const MAX_DIST = 2000.0;
        // Progressive step size constants - tuned to cover ~1300 units with 24 steps
        const RAYMARCH_BASE_STEP = 12.0;       // Initial step size factor
        const RAYMARCH_STEP_GROWTH = 1.3;      // Step size growth rate per iteration
        
        // Initialize result
        let hitT = MAX_DIST;
        let hitMaterial = 0.0;
        let hitIsWater = 0.0;
        let didHit = 0.0;
        
        // Track the previous step distance for binary search refinement
        let prevStepDist = 0.0;
        let hitStepPrev = 0.0;  // Distance just before hit (above terrain)
        let hitStepCurr = 0.0;  // Distance at hit (below terrain)
        
        // March along the ray
        for (let i = 0; i < RAYMARCH_STEPS; i++) {
            // Progressive step size: starts small, increases with distance
            // This gives fine detail near camera and covers more ground far away
            const stepDist = i * (RAYMARCH_BASE_STEP + i * RAYMARCH_STEP_GROWTH);
            
            // Calculate sample position along ray
            const sampleX = add(rayOriginX, mul(rayDirX, stepDist));
            const sampleY = add(rayOriginY, mul(rayDirY, stepDist));
            const sampleZ = add(rayOriginZ, mul(rayDirZ, stepDist));
            
            // Sample terrain data
            const terrainH = sampleTerrainHeight(sampleX, sampleZ);
            const isWater = sampleIsWater(sampleX, sampleZ);
            const unitInfo = sampleUnit(sampleX, sampleZ);
            
            // Check terrain intersection: ray.y < sampledHeight
            const heightDiff = sub(sampleY, terrainH);
            const terrainHit = step(heightDiff, 0.0);
            
            // Check water surface intersection
            const waterHit = mul(isWater, step(sub(sampleY, WATER_LEVEL), 0.0));
            
            // Check unit intersection (sphere test)
            const hasUnit = unitInfo.r;
            const unitY = add(terrainH, 5.0);
            const unitDistSq = add(mul(sub(sampleY, unitY), sub(sampleY, unitY)), 9.0);
            const unitHit = mul(hasUnit, step(unitDistSq, 25.0));
            
            // Determine first hit (only update if not already hit)
            const notHitYet = sub(1.0, didHit);
            const anyHit = max(terrainHit, max(waterHit, unitHit));
            
            // Store step bounds for binary search refinement
            // hitStepPrev = distance where we were still above terrain
            // hitStepCurr = distance where we crossed below terrain
            hitStepPrev = mix(hitStepPrev, prevStepDist, mul(anyHit, notHitYet));
            hitStepCurr = mix(hitStepCurr, stepDist, mul(anyHit, notHitYet));
            
            // Update hit distance (initially use current step, will be refined later)
            hitT = mix(hitT, stepDist, mul(anyHit, notHitYet));
            
            // Determine material type: 0=terrain, 1=water, 2=unit
            const newMaterial = add(mul(waterHit, 1.0), mul(unitHit, 2.0));
            hitMaterial = mix(hitMaterial, newMaterial, mul(anyHit, notHitYet));
            hitIsWater = mix(hitIsWater, isWater, mul(anyHit, notHitYet));
            
            // Mark as hit
            didHit = max(didHit, anyHit);
            
            // Remember previous step distance for next iteration
            prevStepDist = stepDist;
        }
        
        // ==== BINARY SEARCH REFINEMENT ====
        // After finding an intersection bracket [hitStepPrev, hitStepCurr],
        // perform binary search to find the precise intersection point.
        // This eliminates the visible "rings" caused by discrete step boundaries.
        let binaryLow = hitStepPrev;
        let binaryHigh = hitStepCurr;
        
        for (let b = 0; b < BINARY_SEARCH_STEPS; b++) {
            // Midpoint of current bracket
            const binaryMid = mul(add(binaryLow, binaryHigh), 0.5);
            
            // Sample at midpoint
            const midX = add(rayOriginX, mul(rayDirX, binaryMid));
            const midY = add(rayOriginY, mul(rayDirY, binaryMid));
            const midZ = add(rayOriginZ, mul(rayDirZ, binaryMid));
            
            const midTerrainH = sampleTerrainHeight(midX, midZ);
            const midIsWater = sampleIsWater(midX, midZ);
            
            // Check if midpoint is below terrain or water
            const midHeightDiff = sub(midY, midTerrainH);
            const midTerrainHit = step(midHeightDiff, 0.0);
            const midWaterHit = mul(midIsWater, step(sub(midY, WATER_LEVEL), 0.0));
            const midAnyHit = max(midTerrainHit, midWaterHit);
            
            // Binary search: if hit at mid, search lower half; else search upper half
            // If midAnyHit == 1: intersection is in [low, mid], so high = mid
            // If midAnyHit == 0: intersection is in [mid, high], so low = mid
            binaryHigh = mix(binaryHigh, binaryMid, midAnyHit);
            binaryLow = mix(binaryMid, binaryLow, midAnyHit);
        }
        
        // Final refined hit distance is the midpoint of the final bracket
        // Only apply refinement if we actually hit something
        const refinedT = mul(add(binaryLow, binaryHigh), 0.5);
        hitT = mix(hitT, refinedT, didHit);
        
        return vec4(hitT, hitMaterial, hitIsWater, didHit);
    });

    // ==== SHADOW RAY FUNCTION ====
    // Cast a ray toward the sun to determine shadow factor
    // Returns 0.0 if in shadow, 1.0 if fully lit
    // Optimized with progressive step sizes for better coverage with fewer steps
    function castShadowRay(originX, originY, originZ) {
        const SHADOW_STEPS = 8;  // Reduced from 16 for better performance
        const SHADOW_BIAS = 1.0;  // Offset to avoid self-shadowing
        // Progressive step constants - tuned to cover ~600 units with 8 steps
        const SHADOW_BASE_STEP = 5.0;         // Initial step size factor  
        const SHADOW_STEP_GROWTH = 2.5;       // Step size growth rate per iteration
        
        // Start ray slightly above surface
        const startX = add(originX, mul(sunDirectionUniform.x, SHADOW_BIAS));
        const startY = add(originY, mul(sunDirectionUniform.y, SHADOW_BIAS));
        const startZ = add(originZ, mul(sunDirectionUniform.z, SHADOW_BIAS));
        
        let inShadow = 0.0;
        
        // Use progressive step sizes: smaller near origin, larger further away
        // This catches nearby shadows precisely while covering distant terrain
        for (let i = 0; i < SHADOW_STEPS; i++) {
            // Progressive step formula: (i+1) * (base + i * growth)
            // With base=5, growth=2.5: steps at 5, 15, 30, 50, 75, 105, 140, 180 (total ~600 units)
            const stepDist = mul((i + 1) * (SHADOW_BASE_STEP + i * SHADOW_STEP_GROWTH), 1.0);
            const sampleX = add(startX, mul(sunDirectionUniform.x, stepDist));
            const sampleY = add(startY, mul(sunDirectionUniform.y, stepDist));
            const sampleZ = add(startZ, mul(sunDirectionUniform.z, stepDist));
            
            const terrainH = sampleTerrainHeight(sampleX, sampleZ);
            const blocked = step(sampleY, terrainH);
            
            inShadow = max(inShadow, blocked);
        }
        
        return sub(1.0, inShadow);
    }

    // ==== PATH TRACING CORE ====
    // Main path tracing with bounces

    // Sky color based on ray direction
    function getSkyColor(rayDirY) {
        const t = clamp(add(mul(rayDirY, 0.5), 0.5), 0.0, 1.0);
        return mix(groundColorUniform, skyColorUniform, t);
    }

    // Sun contribution
    function getSunLight(rayDirX, rayDirY, rayDirZ) {
        const sunDot = max(0.0, add(
            add(
                mul(rayDirX, sunDirectionUniform.x),
                mul(rayDirY, sunDirectionUniform.y)
            ),
            mul(rayDirZ, sunDirectionUniform.z)
        ));
        const sunFactor = pow(sunDot, 256.0);
        return mul(mul(sunColorUniform, sunFactor), sunIntensityUniform);
    }

    // ==== MATERIAL EVALUATION ====
    // PBR BRDF evaluation

    // Fresnel-Schlick approximation
    function fresnelSchlick(cosTheta, f0) {
        return add(f0, mul(sub(1.0, f0), pow(sub(1.0, cosTheta), 5.0)));
    }

    // GGX Normal Distribution Function
    // Uses PI constant defined at the top of createPathTracerMaterial
    function distributionGGX(NdotH, roughness) {
        const a = mul(roughness, roughness);
        const a2 = mul(a, a);
        const NdotH2 = mul(NdotH, NdotH);
        const num = a2;
        const denom = add(mul(NdotH2, sub(a2, 1.0)), 1.0);
        const denomSq = mul(mul(denom, denom), PI);
        return div(num, denomSq);
    }

    // ==== CAMERA-FIRST PATH TRACING ====
    // This is a Camera-First (backward) path tracer where:
    // 1. Rays originate FROM the camera position (rayOrigin)
    // 2. Rays are cast THROUGH each pixel into the scene (rayDir)
    // 3. When rays hit surfaces, they bounce according to material BRDFs
    // 4. Light contribution is accumulated via next-event estimation (direct light sampling)
    // This approach is more efficient for scenes with many lights as it focuses
    // computation on pixels visible to the camera.

    // Initialize accumulated color and path throughput
    let finalColor = vec3(0.0, 0.0, 0.0);
    let throughput = vec3(1.0, 1.0, 1.0);

    // Current ray state - STARTS FROM CAMERA
    // rayOrigin = camera position (where rays originate)
    // rayDir = direction through pixel (where rays go)
    let currentRayOriginX = rayOrigin.x;
    let currentRayOriginY = rayOrigin.y;
    let currentRayOriginZ = rayOrigin.z;
    let currentRayDirX = rayDir.x;
    let currentRayDirY = rayDir.y;
    let currentRayDirZ = rayDir.z;

    // Configuration
    const MAX_BOUNCES = 2;  // Reduced from 3 for better performance (2 bounces adequate for GI)
    const WATER_IOR = 1.33; // Index of refraction for water

    // ============================================================
    // PATH TRACING LOOP (Multi-bounce)
    // ============================================================
    // Unrolled loop for 3 bounces to avoid GPU branching issues
    // Each bounce: trace ray, hit test, shade, generate new ray
    
    for (let bounce = 0; bounce < MAX_BOUNCES; bounce++) {
        // Cast ray using raymarching function
        const hitResult = rayMarchHeightfield(
            currentRayOriginX, currentRayOriginY, currentRayOriginZ,
            currentRayDirX, currentRayDirY, currentRayDirZ
        );
        
        const hitT = hitResult.x;
        const hitMaterial = hitResult.y;
        const isWater = hitResult.z;
        const didHit = hitResult.w;
        
        // Calculate hit position
        const hitPosX = add(currentRayOriginX, mul(currentRayDirX, hitT));
        const hitPosY = add(currentRayOriginY, mul(currentRayDirY, hitT));
        const hitPosZ = add(currentRayOriginZ, mul(currentRayDirZ, hitT));
        
        // Hit normal (simplified - assume Y-up for terrain)
        const hitNormalX = 0.0;
        const hitNormalY = 1.0;
        const hitNormalZ = 0.0;
        
        // ==== SKY CONTRIBUTION (no hit) ====
        const skyColor = getSkyColor(currentRayDirY);
        const sunLight = getSunLight(currentRayDirX, currentRayDirY, currentRayDirZ);
        const noHitContrib = mul(add(skyColor, sunLight), sub(1.0, didHit));
        finalColor = add(finalColor, mul(throughput, noHitContrib));
        
        // ==== DIRECT LIGHTING WITH SUN SHADOWS ====
        // Cast shadow ray toward sun
        const shadowFactor = castShadowRay(hitPosX, hitPosY, hitPosZ);
        
        // Calculate N·L for diffuse lighting
        const NdotL = max(0.0, add(
            add(
                mul(hitNormalX, sunDirectionUniform.x),
                mul(hitNormalY, sunDirectionUniform.y)
            ),
            mul(hitNormalZ, sunDirectionUniform.z)
        ));
        
        // ==== MATERIAL SHADING ====
        
        // Terrain material (diffuse Lambertian)
        const terrainDiffuse = vec3(0.3, 0.5, 0.2);  // Green terrain
        const terrainDirect = mul(mul(mul(terrainDiffuse, NdotL), shadowFactor), sunIntensityUniform);
        const terrainAmbient = mul(terrainDiffuse, 0.2);
        const terrainFinal = add(terrainDirect, terrainAmbient);
        
        // Water material (reflection + refraction + Beer-Lambert absorption)
        // Note: Water surface is always horizontal in this heightfield renderer,
        // so we optimize by assuming normal = (0, 1, 0) for water calculations.
        // Calculate Fresnel for water using Schlick approximation
        // cosTheta = -rayDir · normal = -rayDir.y (since normal.y = 1)
        const cosTheta = max(0.0, negate(currentRayDirY));  // View angle with surface
        const waterF0 = 0.02;  // Water base reflectance
        const waterFresnel = fresnelSchlick(cosTheta, waterF0);
        
        // Reflection direction: R = I - 2*(I·N)*N
        // For horizontal surface (normal = 0,1,0): R.x = I.x, R.y = -I.y, R.z = I.z
        const reflectDirX = currentRayDirX;
        const reflectDirY = negate(currentRayDirY);  // Reflect Y
        const reflectDirZ = currentRayDirZ;
        const reflectionColor = getSkyColor(reflectDirY);
        
        // ==== BEER-LAMBERT WATER DEPTH ABSORPTION ====
        // Beer-Lambert law: I = I_0 * e^(-absorption_coefficient * distance)
        // This makes deeper water appear darker as light is absorbed
        // 
        // Calculate water depth at hit position (WATER_LEVEL - terrainHeight)
        const terrainAtHit = sampleTerrainHeight(hitPosX, hitPosZ);
        const waterDepth = max(0.0, sub(WATER_LEVEL, terrainAtHit));
        
        // Water absorption coefficients (per unit depth)
        // Different wavelengths absorb at different rates:
        // - Red light absorbs fastest (higher coefficient)
        // - Blue light absorbs slowest (lower coefficient)
        // This creates the characteristic blue-green color of deep water
        const waterAbsorptionR = 0.15;  // Red absorbs fastest
        const waterAbsorptionG = 0.07;  // Green absorbs moderately
        const waterAbsorptionB = 0.03;  // Blue absorbs slowest
        
        // Beer-Lambert absorption factor: e^(-absorption * depth)
        // Clamp depth to reasonable range to avoid extreme values
        const clampedDepth = min(waterDepth, 100.0);
        const absorptionR = exp(mul(negate(waterAbsorptionR), clampedDepth));
        const absorptionG = exp(mul(negate(waterAbsorptionG), clampedDepth));
        const absorptionB = exp(mul(negate(waterAbsorptionB), clampedDepth));
        const waterAbsorption = vec3(absorptionR, absorptionG, absorptionB);
        
        // Deep water color (what we see when all light is absorbed)
        // This is the color of the water at maximum depth
        const deepWaterColor = vec3(0.02, 0.05, 0.15);  // Dark blue-black
        
        // Refraction direction (IOR 1.33 for water)
        // Using Snell's law for horizontal surface: sin(theta_t) = (n1/n2) * sin(theta_i)
        // For horizontal normal, we only need to modify the Y component
        const etaRatio = div(1.0, WATER_IOR);  // Air to water (1.0 / 1.33)
        const cosThetaI = negate(currentRayDirY);  // cos(incident angle) = -ray.y for downward rays
        const sinThetaI2 = sub(1.0, mul(cosThetaI, cosThetaI));
        const sinThetaT2 = mul(mul(etaRatio, etaRatio), sinThetaI2);
        const cosThetaT = sqrt(max(0.0, sub(1.0, sinThetaT2)));
        
        // Refracted direction for horizontal surface
        // T = eta * I + (eta * cosI - cosT) * N
        // For N = (0,1,0): T.x = eta*I.x, T.y = eta*I.y + eta*cosI - cosT, T.z = eta*I.z
        const refractDirX = mul(etaRatio, currentRayDirX);
        const refractDirY = sub(mul(etaRatio, currentRayDirY), cosThetaT);  // Downward into water
        const refractDirZ = mul(etaRatio, currentRayDirZ);
        
        // Apply Beer-Lambert absorption to water color
        // Shallow water: shows more of the base water color
        // Deep water: shows more of the deep water color (darker)
        const absorbedWaterColor = mul(waterColorUniform, waterAbsorption);
        const depthBlendedWaterColor = add(absorbedWaterColor, mul(deepWaterColor, sub(vec3(1.0, 1.0, 1.0), waterAbsorption)));
        
        // Blend reflection and refraction based on Fresnel, with depth-based absorption
        const waterReflect = mul(reflectionColor, waterFresnel);
        const waterRefract = mul(depthBlendedWaterColor, sub(1.0, waterFresnel));
        const waterFinal = add(waterReflect, waterRefract);
        
        // Metal unit material (high reflectance)
        const metalReflectColor = getSkyColor(reflectDirY);
        const metalFinal = mul(metalColorUniform, metalReflectColor);
        
        // Select material based on hit type
        // hitMaterial: 0=terrain, 1=water, 2=metal unit
        const isTerrain = step(hitMaterial, 0.5);
        const isWaterMat = mul(step(0.5, hitMaterial), step(hitMaterial, 1.5));
        const isMetal = step(1.5, hitMaterial);
        
        const materialColor = add(add(
            mul(terrainFinal, isTerrain),
            mul(waterFinal, isWaterMat)),
            mul(metalFinal, isMetal)
        );
        
        // Add material contribution to final color
        const hitContrib = mul(materialColor, didHit);
        finalColor = add(finalColor, mul(throughput, hitContrib));
        
        // ==== PREPARE NEXT BOUNCE ====
        // Generate new ray direction based on material type
        
        // Use blue noise for bounce random numbers (better convergence than white noise)
        // Add bounce index as offset for decorrelation between bounces
        const bounceOffset = mul(bounce, 17.0);  // Use 17 (prime) for good decorrelation
        const bounceNoise = blueNoise2D(pixelX, pixelY, add(frameCountUniform, bounceOffset));
        const rand1 = bounceNoise.x;
        const rand2 = bounceNoise.y;
        
        // Cosine-weighted hemisphere sampling for diffuse bounce
        const bounceDir = cosineWeightedDirection(hitNormalX, hitNormalY, hitNormalZ, rand1, rand2);
        
        // Select bounce direction based on material
        // Terrain: cosine-weighted random (diffuse)
        // Water: refracted direction
        // Metal: reflected direction
        const nextDirX = add(add(
            mul(bounceDir.x, isTerrain),
            mul(refractDirX, isWaterMat)),
            mul(reflectDirX, isMetal)
        );
        const nextDirY = add(add(
            mul(bounceDir.y, isTerrain),
            mul(refractDirY, isWaterMat)),
            mul(reflectDirY, isMetal)
        );
        const nextDirZ = add(add(
            mul(bounceDir.z, isTerrain),
            mul(refractDirZ, isWaterMat)),
            mul(reflectDirZ, isMetal)
        );
        
        // Update throughput
        // Terrain: multiply by albedo / PI (Lambertian BRDF)
        // Water: multiply by transparency
        // Metal: multiply by reflectance
        const terrainThroughput = mul(terrainDiffuse, div(1.0, PI));
        const waterThroughput = mul(waterColorUniform, sub(1.0, waterFresnel));
        const metalThroughput = metalColorUniform;
        
        const newThroughput = add(add(
            mul(terrainThroughput, isTerrain),
            mul(waterThroughput, isWaterMat)),
            mul(metalThroughput, isMetal)
        );
        
        // Update throughput (only if we hit something)
        throughput = mul(throughput, mix(vec3(1, 1, 1), newThroughput, didHit));
        
        // Update ray for next bounce
        const BOUNCE_OFFSET = 0.5;
        currentRayOriginX = add(hitPosX, mul(nextDirX, BOUNCE_OFFSET));
        currentRayOriginY = add(hitPosY, mul(nextDirY, BOUNCE_OFFSET));
        currentRayOriginZ = add(hitPosZ, mul(nextDirZ, BOUNCE_OFFSET));
        currentRayDirX = nextDirX;
        currentRayDirY = nextDirY;
        currentRayDirZ = nextDirZ;
    }

    // ==== ACCUMULATION ====
    // Blend with previous frame for progressive rendering
    // previousFrameTextureNode is a texture node created with texture(tex) which defaults to uv()
    // This is equivalent to texture(tex, uv()) - sampling at the fragment's UV coordinates
    // Its .value property can be updated for ping-pong buffer swapping
    const previousColor = previousFrameTextureNode;
    const sampleWeight = div(1.0, add(accumulatedSamplesUniform, 1.0));
    
    // ==== TILE-BASED RENDERING ====
    // For pixels in the selected tile: blend new path-traced color with accumulated history
    // For pixels NOT in the selected tile: pass through the previous frame color unchanged
    const newFrameColor = vec4(finalColor.x, finalColor.y, finalColor.z, 1.0);
    const blendedColor = mix(previousColor, newFrameColor, sampleWeight);
    
    // Select: if this is the selected tile, use blended color; otherwise use previous color
    const accumulatedColor = mix(previousColor, blendedColor, isSelectedTile);

    // Tone mapping (simple Reinhard)
    const toneMappedR = div(accumulatedColor.r, add(accumulatedColor.r, 1.0));
    const toneMappedG = div(accumulatedColor.g, add(accumulatedColor.g, 1.0));
    const toneMappedB = div(accumulatedColor.b, add(accumulatedColor.b, 1.0));

    // Gamma correction (sRGB: gamma = 1/2.2 ≈ 0.45454545)
    const GAMMA = 1.0 / 2.2;
    const gammaR = pow(toneMappedR, GAMMA);
    const gammaG = pow(toneMappedG, GAMMA);
    const gammaB = pow(toneMappedB, GAMMA);

    // Output
    const outputColor = vec4(gammaR, gammaG, gammaB, 1.0);

    // Create node material
    const material = new THREE.MeshBasicNodeMaterial();
    material.colorNode = outputColor;
    material.transparent = false;
    material.side = THREE.DoubleSide;
    material.depthTest = false;
    material.depthWrite = false;

    console.log('[PathTracer] Material created successfully');
    console.log('[PathTracer] Material type:', material.constructor.name);
    console.log('[PathTracer] colorNode set:', material.colorNode ? 'yes' : 'no');

    return material;
}

/**
 * Update path tracer uniforms each frame.
 * Updates time and checks for camera movement.
 * Updates main camera matrices for shader use.
 * 
 * @param {THREE.Camera} camera - The main camera
 * @param {number} deltaTime - Time since last frame
 */
function updatePathTracerUniforms(camera, deltaTime) {
    if (!pathTracerUniforms || !window.pathTracerTSLUniforms) return;

    const tslUniforms = window.pathTracerTSLUniforms;

    // Update time
    tslUniforms.time.value += deltaTime;
    tslUniforms.frameCount.value++;

    // Check if camera moved
    const cameraMoved = !prevCameraPosition.equals(camera.position) ||
                        !prevCameraQuaternion.equals(camera.quaternion);

    if (cameraMoved) {
        // Reset accumulation
        accumulatedSamples = 0;
        prevCameraPosition.copy(camera.position);
        prevCameraQuaternion.copy(camera.quaternion);
    } else {
        // Continue accumulation
        accumulatedSamples++;
    }

    tslUniforms.accumulatedSamples.value = accumulatedSamples;

    // ==== RANDOM TILE SELECTION ====
    // Each frame, select a random tile to render (TILE_SIZE defined at module level)
    // This distributes path tracing work across frames for better performance
    const resolution = tslUniforms.resolution.value;
    const numTilesX = Math.ceil(resolution.x / TILE_SIZE);
    const numTilesY = Math.ceil(resolution.y / TILE_SIZE);
    
    // Select a random tile
    const randomTileX = Math.floor(Math.random() * numTilesX);
    const randomTileY = Math.floor(Math.random() * numTilesY);
    tslUniforms.randomTile.value.set(randomTileX, randomTileY);

    // Update main camera matrices - we pass these as uniforms because we render
    // with an orthographic camera but need the main game camera's view/projection
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    
    // Update camera position uniform
    tslUniforms.mainCameraPosition.value.copy(camera.position);
    
    // Update projection matrix inverse (copy directly without cloning)
    tslUniforms.mainCameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse);
    
    // Update world matrix
    tslUniforms.mainCameraWorldMatrix.value.copy(camera.matrixWorld);
}

/**
 * Render a frame using the path tracer.
 * Implements ping-pong buffer accumulation.
 * 
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @param {THREE.Camera} camera - The main camera
 */
// Debug: track render calls
let pathTracerRenderCallCount = 0;
let pathTracerLastDebugTime = 0;

function renderPathTracer(renderer, camera) {
    if (!pathTracerEnabled || !pathTracerScene || !pathTracerCamera) {
        return false;
    }

    pathTracerRenderCallCount++;
    const now = Date.now();
    
    // Debug output at configured interval
    if (now - pathTracerLastDebugTime > DEBUG_LOG_INTERVAL_MS) {
        console.log('[PathTracer] ========== DEBUG OUTPUT ==========');
        console.log('[PathTracer] Render call #' + pathTracerRenderCallCount);
        console.log('[PathTracer] Main camera position:', 
            camera.position?.x?.toFixed(2) ?? 'N/A', 
            camera.position?.y?.toFixed(2) ?? 'N/A', 
            camera.position?.z?.toFixed(2) ?? 'N/A');
        console.log('[PathTracer] Accumulated samples:', accumulatedSamples);
        console.log('[PathTracer] Current buffer:', currentAccumulationBuffer);
        
        // Check uniforms
        if (window.pathTracerTSLUniforms) {
            console.log('[PathTracer] TSL Uniforms present: yes');
            console.log('[PathTracer] Resolution:', 
                window.pathTracerTSLUniforms.resolution?.value?.x ?? 'N/A', 
                'x', 
                window.pathTracerTSLUniforms.resolution?.value?.y ?? 'N/A');
            
            // Debug camera uniforms
            const camPosUniform = window.pathTracerTSLUniforms.mainCameraPosition?.value;
            if (camPosUniform) {
                console.log('[PathTracer] Camera uniform position:', 
                    camPosUniform.x?.toFixed(2) ?? 'N/A',
                    camPosUniform.y?.toFixed(2) ?? 'N/A',
                    camPosUniform.z?.toFixed(2) ?? 'N/A');
            } else {
                console.log('[PathTracer] Camera position uniform: MISSING');
            }
            
            const projInvUniform = window.pathTracerTSLUniforms.mainCameraProjectionMatrixInverse?.value;
            console.log('[PathTracer] Projection inverse uniform:', projInvUniform ? 'present' : 'MISSING');
            
            // Debug projection matrix inverse details for ray generation verification
            if (projInvUniform && projInvUniform.elements) {
                const e = projInvUniform.elements;
                console.log('[PathTracer] ProjInv diagonal (FOV related): [' + 
                    e[0].toFixed(4) + ', ' + e[5].toFixed(4) + ', ' + e[10].toFixed(4) + ', ' + e[15].toFixed(4) + ']');
                console.log('[PathTracer] ProjInv translation col: [' + 
                    e[12].toFixed(4) + ', ' + e[13].toFixed(4) + ', ' + e[14].toFixed(4) + ', ' + e[15].toFixed(4) + ']');
            }
            
            const worldMatUniform = window.pathTracerTSLUniforms.mainCameraWorldMatrix?.value;
            console.log('[PathTracer] World matrix uniform:', worldMatUniform ? 'present' : 'MISSING');
            
            // Debug camera world matrix rotation for ray direction verification
            if (worldMatUniform && worldMatUniform.elements) {
                const w = worldMatUniform.elements;
                // First 3 columns of upper-left 3x3 are the camera's local axes in world space
                console.log('[PathTracer] Camera Right axis (col0): [' + 
                    w[0].toFixed(3) + ', ' + w[1].toFixed(3) + ', ' + w[2].toFixed(3) + ']');
                console.log('[PathTracer] Camera Up axis (col1): [' + 
                    w[4].toFixed(3) + ', ' + w[5].toFixed(3) + ', ' + w[6].toFixed(3) + ']');
                console.log('[PathTracer] Camera Forward axis (col2, -lookDir): [' + 
                    w[8].toFixed(3) + ', ' + w[9].toFixed(3) + ', ' + w[10].toFixed(3) + ']');
            }
            
            // Debug World-to-UV mapping parameters
            const mapSize = window.pathTracerTSLUniforms.mapSize?.value;
            const mapWorldSize = window.pathTracerTSLUniforms.mapWorldSize?.value;
            if (mapSize && mapWorldSize) {
                console.log('[PathTracer] Map size (tiles):', mapSize.x, 'x', mapSize.y);
                console.log('[PathTracer] Map world size (units):', mapWorldSize.x, 'x', mapWorldSize.y);
                console.log('[PathTracer] World units per tile:', 
                    (mapWorldSize.x / mapSize.x).toFixed(2), 'x', 
                    (mapWorldSize.y / mapSize.y).toFixed(2));
                
                // Calculate expected UV at camera position for debugging
                if (camPosUniform) {
                    const camWorldX = camPosUniform.x;
                    const camWorldZ = camPosUniform.z;
                    const expectedU = (camWorldX + mapWorldSize.x * 0.5) / mapWorldSize.x;
                    const expectedV = (camWorldZ + mapWorldSize.y * 0.5) / mapWorldSize.y;
                    console.log('[PathTracer] Expected UV at camera XZ: U=' + expectedU.toFixed(4) + ', V=' + expectedV.toFixed(4));
                    console.log('[PathTracer] UV in valid range [0,1]:', 
                        (expectedU >= 0 && expectedU <= 1 && expectedV >= 0 && expectedV <= 1) ? 'YES' : 'NO - camera may be outside map bounds');
                }
            }
            
            // Debug sun/lighting uniforms
            const sunDir = window.pathTracerTSLUniforms.sunDirection?.value;
            const sunInt = window.pathTracerTSLUniforms.sunIntensity?.value;
            if (sunDir) {
                console.log('[PathTracer] Sun direction:', 
                    sunDir.x?.toFixed(3) ?? 'N/A', 
                    sunDir.y?.toFixed(3) ?? 'N/A', 
                    sunDir.z?.toFixed(3) ?? 'N/A');
            }
            console.log('[PathTracer] Sun intensity:', sunInt ?? 'N/A');
            
            // Debug terrain data texture
            if (terrainDataTexture) {
                console.log('[PathTracer] Terrain texture size:', 
                    terrainDataTexture.image?.width ?? 'N/A', 'x', 
                    terrainDataTexture.image?.height ?? 'N/A');
            }
            
        } else {
            console.log('[PathTracer] TSL Uniforms present: NO - this is a problem!');
        }
        
        // Check material and quad
        if (pathTracerQuad) {
            console.log('[PathTracer] Quad visible:', pathTracerQuad.visible);
            console.log('[PathTracer] Quad material:', pathTracerQuad.material ? 'present' : 'MISSING');
        }
        
        console.log('[PathTracer] ========== END DEBUG ==========');
        pathTracerLastDebugTime = now;
    }

    // Update uniforms
    const deltaTime = clock ? clock.getDelta() : 0.016;
    updatePathTracerUniforms(camera, deltaTime);

    // Set previous frame texture
    const readBuffer = currentAccumulationBuffer === 0 ? accumulationBufferB : accumulationBufferA;
    const writeBuffer = currentAccumulationBuffer === 0 ? accumulationBufferA : accumulationBufferB;

    if (window.pathTracerTSLUniforms && window.pathTracerTSLUniforms.previousFrame) {
        window.pathTracerTSLUniforms.previousFrame.value = readBuffer.texture;
    }

    // Render to accumulation buffer
    renderer.setRenderTarget(writeBuffer);
    renderer.render(pathTracerScene, pathTracerCamera);

    // Render to screen
    renderer.setRenderTarget(null);
    renderer.render(pathTracerScene, pathTracerCamera);

    // Swap buffers
    currentAccumulationBuffer = 1 - currentAccumulationBuffer;

    return true;
}

/**
 * Enable or disable the path tracer.
 * 
 * @param {boolean} enabled - Whether to enable path tracing
 */
function setPathTracerEnabled(enabled) {
    console.log('[PathTracer] setPathTracerEnabled called with:', enabled);
    console.log('[PathTracer] pathTracerScene:', pathTracerScene ? 'present' : 'MISSING');
    console.log('[PathTracer] pathTracerCamera:', pathTracerCamera ? 'present' : 'MISSING');
    console.log('[PathTracer] pathTracerQuad:', pathTracerQuad ? 'present' : 'MISSING');
    console.log('[PathTracer] pathTracerMaterial:', pathTracerMaterial ? 'present' : 'MISSING');
    console.log('[PathTracer] accumulationBufferA:', accumulationBufferA ? 'present' : 'MISSING');
    console.log('[PathTracer] accumulationBufferB:', accumulationBufferB ? 'present' : 'MISSING');
    console.log('[PathTracer] terrainDataTexture:', terrainDataTexture ? 'present' : 'MISSING');
    console.log('[PathTracer] unitDataTexture:', unitDataTexture ? 'present' : 'MISSING');
    
    pathTracerEnabled = enabled;
    console.log('[PathTracer] Path Tracer ' + (enabled ? 'enabled' : 'disabled'));
    
    // Reset accumulation when enabling
    if (enabled) {
        accumulatedSamples = 0;
        pathTracerRenderCallCount = 0;
        pathTracerLastDebugTime = 0;
    }
}

/**
 * Toggle path tracer on/off.
 * 
 * @returns {boolean} New enabled state
 */
function togglePathTracer() {
    setPathTracerEnabled(!pathTracerEnabled);
    return pathTracerEnabled;
}

/**
 * Check if path tracer is enabled.
 * 
 * @returns {boolean} Whether path tracing is enabled
 */
function isPathTracerEnabled() {
    return pathTracerEnabled;
}

// Track if path tracer terrain data needs update
let pathTracerTerrainDirty = true;
let pathTracerUnitsDirty = true;
let lastTerrainUpdateFrame = 0;
const TERRAIN_UPDATE_MIN_FRAMES = 30;  // Minimum frames between full terrain updates

/**
 * Mark the path tracer terrain data as dirty (needing update).
 * Call this when map exploration changes, terrain is modified, or fog of war updates.
 */
function markPathTracerTerrainDirty() {
    pathTracerTerrainDirty = true;
    console.log('[PathTracer] Terrain marked as dirty - will update on next render');
}

/**
 * Mark the path tracer unit data as dirty (needing update).
 * Call this when units move, are created, or are destroyed.
 */
function markPathTracerUnitsDirty() {
    pathTracerUnitsDirty = true;
}

/**
 * Update scene data textures.
 * Call this when terrain or units change.
 * Can be called even when path tracer is disabled to keep data ready.
 * 
 * @param {boolean} force - Force update even if not marked dirty
 */
function updatePathTracerSceneData(force = false) {
    // Track if any updates were made
    let updated = false;
    
    // Update terrain data if dirty or forced
    if (pathTracerTerrainDirty || force) {
        console.log('[PathTracer] Updating terrain data texture...');
        createTerrainDataTexture();
        pathTracerTerrainDirty = false;
        updated = true;
        
        // Update uniform reference if available
        if (window.pathTracerTSLUniforms) {
            window.pathTracerTSLUniforms.terrainData.value = terrainDataTexture;
        }
    }
    
    // Update unit data if dirty or forced
    if (pathTracerUnitsDirty || force) {
        createUnitDataTexture();
        pathTracerUnitsDirty = false;
        updated = true;
        
        // Update uniform reference if available
        if (window.pathTracerTSLUniforms) {
            window.pathTracerTSLUniforms.unitData.value = unitDataTexture;
        }
    }
    
    // Reset accumulation since scene changed
    if (updated && pathTracerEnabled) {
        accumulatedSamples = 0;
        console.log('[PathTracer] Scene data updated, accumulation reset');
    }
    
    return updated;
}

/**
 * Automatically check and update path tracer data if map has changed.
 * This should be called periodically (e.g., each frame) to detect map changes.
 * Uses the global map_known_dirty and map_geometry_dirty flags from tile_visibility_handler.js
 */
function checkPathTracerMapUpdates() {
    // Check global dirty flags from tile_visibility_handler.js
    if (typeof map_known_dirty !== 'undefined' && map_known_dirty) {
        markPathTracerTerrainDirty();
        // Note: We don't clear map_known_dirty here as other systems may also need it
    }
    
    if (typeof map_geometry_dirty !== 'undefined' && map_geometry_dirty) {
        markPathTracerTerrainDirty();
        // Note: We don't clear map_geometry_dirty here as other systems may also need it
    }
    
    // Update terrain data if dirty
    if (pathTracerTerrainDirty || pathTracerUnitsDirty) {
        updatePathTracerSceneData(false);
    }
}

/**
 * Update a single tile in the path tracer terrain texture.
 * More efficient than recreating the entire texture for single tile changes.
 * 
 * @param {object} tile - The tile that changed
 */
function updatePathTracerTile(tile) {
    if (!terrainDataTexture || !tile) return;
    
    const mapWidth = map ? map.xsize : DEFAULT_MAP_SIZE;
    const x = tile.x;
    const y = tile.y;
    
    if (x < 0 || x >= mapWidth || y < 0 || y >= (map ? map.ysize : DEFAULT_MAP_SIZE)) {
        return;  // Out of bounds
    }
    
    // Calculate index into texture data
    const idx = (y * mapWidth + x) * 4;
    
    // Get the texture data array
    const data = terrainDataTexture.image.data;
    if (!data) return;
    
    // Terrain type constants
    const TERRAIN_INACCESSIBLE = 0;
    const TERRAIN_LAKE = 10;
    const TERRAIN_COAST = 20;
    
    // Update tile data
    data[idx + 0] = tile.height !== undefined ? tile.height : 0.5;
    data[idx + 1] = tile.terrain !== undefined ? tile.terrain / 255.0 : 0.5;
    
    const terrain = tile.terrain;
    const isWater = (terrain === TERRAIN_LAKE || terrain === TERRAIN_COAST || terrain === TERRAIN_INACCESSIBLE) ? 1.0 : 0.0;
    data[idx + 2] = isWater;
    data[idx + 3] = 1.0;
    
    // Mark texture as needing upload to GPU
    terrainDataTexture.needsUpdate = true;
    
    // Reset accumulation
    if (pathTracerEnabled) {
        accumulatedSamples = 0;
    }
}

/**
 * Resize path tracer buffers.
 * Call this when viewport size changes.
 * 
 * @param {number} width - New viewport width
 * @param {number} height - New viewport height
 */
function resizePathTracer(width, height) {
    if (!accumulationBufferA || !accumulationBufferB) return;
    
    accumulationBufferA.setSize(width, height);
    accumulationBufferB.setSize(width, height);
    
    if (window.pathTracerTSLUniforms) {
        window.pathTracerTSLUniforms.resolution.value.set(width, height);
    }
    
    // Reset accumulation
    accumulatedSamples = 0;
}

/**
 * Clean up path tracer resources.
 */
function disposePathTracer() {
    if (accumulationBufferA) {
        accumulationBufferA.dispose();
        accumulationBufferA = null;
    }
    if (accumulationBufferB) {
        accumulationBufferB.dispose();
        accumulationBufferB = null;
    }
    if (terrainDataTexture) {
        terrainDataTexture.dispose();
        terrainDataTexture = null;
    }
    if (unitDataTexture) {
        unitDataTexture.dispose();
        unitDataTexture = null;
    }
    if (pathTracerMaterial) {
        pathTracerMaterial.dispose();
        pathTracerMaterial = null;
    }
    if (pathTracerQuad) {
        pathTracerQuad.geometry.dispose();
        pathTracerQuad = null;
    }
    
    pathTracerScene = null;
    pathTracerCamera = null;
    pathTracerEnabled = false;
    
    console.log('Path Tracer disposed');
}

/**
 * Get current accumulation sample count.
 * 
 * @returns {number} Number of accumulated samples
 */
function getPathTracerSampleCount() {
    return accumulatedSamples;
}

/**
 * External Render Loop Controller
 * 
 * This function provides a high-level API for controlling the path tracer's
 * render loop from external code. It handles:
 * 
 * 1. Camera static detection - determines if camera has moved
 * 2. Accumulation counter management - increments when camera is static
 * 3. Ping-pong buffer swapping - only swaps when accumulating
 * 4. Convergence detection - signals when image has converged
 * 
 * Usage:
 * ```javascript
 * // In your animation loop:
 * const loopState = updatePathTracerRenderLoop(renderer, camera);
 * if (loopState.shouldRender) {
 *     // Path tracer rendered this frame
 * }
 * if (loopState.converged) {
 *     // Image has converged, can reduce frame rate
 * }
 * ```
 * 
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @param {THREE.Camera} camera - The main game camera
 * @param {Object} options - Optional configuration
 * @param {number} options.maxSamples - Max samples before considered converged (default: 256)
 * @param {number} options.movementThreshold - Camera movement threshold (default: 0.001)
 * @returns {Object} State object with render loop information
 */
function updatePathTracerRenderLoop(renderer, camera, options = {}) {
    const maxSamples = options.maxSamples || 256;
    const movementThreshold = options.movementThreshold || 0.001;
    
    // Return early if path tracer not ready
    if (!pathTracerEnabled || !pathTracerScene || !pathTracerCamera) {
        return {
            shouldRender: false,
            cameraStatic: false,
            accumulatedSamples: 0,
            converged: false,
            bufferIndex: currentAccumulationBuffer
        };
    }
    
    // Determine if camera has moved
    const cameraMoved = !prevCameraPosition || 
        Math.abs(camera.position.x - prevCameraPosition.x) > movementThreshold ||
        Math.abs(camera.position.y - prevCameraPosition.y) > movementThreshold ||
        Math.abs(camera.position.z - prevCameraPosition.z) > movementThreshold ||
        !prevCameraQuaternion ||
        Math.abs(camera.quaternion.x - prevCameraQuaternion.x) > movementThreshold ||
        Math.abs(camera.quaternion.y - prevCameraQuaternion.y) > movementThreshold ||
        Math.abs(camera.quaternion.z - prevCameraQuaternion.z) > movementThreshold ||
        Math.abs(camera.quaternion.w - prevCameraQuaternion.w) > movementThreshold;
    
    const cameraStatic = !cameraMoved;
    
    // Update accumulated samples counter
    if (cameraMoved) {
        // Camera moved - reset accumulation
        accumulatedSamples = 0;
        prevCameraPosition = camera.position.clone();
        prevCameraQuaternion = camera.quaternion.clone();
    } else if (accumulatedSamples < maxSamples) {
        // Camera static and not yet converged - continue accumulation
        accumulatedSamples++;
    }
    
    // Update uniforms
    if (window.pathTracerTSLUniforms) {
        window.pathTracerTSLUniforms.accumulatedSamples.value = accumulatedSamples;
        window.pathTracerTSLUniforms.frameCount.value++;
        
        // Update camera matrices
        camera.updateMatrixWorld();
        camera.updateProjectionMatrix();
        window.pathTracerTSLUniforms.mainCameraPosition.value.copy(camera.position);
        window.pathTracerTSLUniforms.mainCameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse);
        window.pathTracerTSLUniforms.mainCameraWorldMatrix.value.copy(camera.matrixWorld);
    }
    
    // Determine ping-pong buffer configuration
    const readBuffer = currentAccumulationBuffer === 0 ? accumulationBufferB : accumulationBufferA;
    const writeBuffer = currentAccumulationBuffer === 0 ? accumulationBufferA : accumulationBufferB;
    
    // Set previous frame texture for accumulation
    if (window.pathTracerTSLUniforms && window.pathTracerTSLUniforms.previousFrame) {
        window.pathTracerTSLUniforms.previousFrame.value = readBuffer.texture;
    }
    
    // Render to accumulation buffer
    renderer.setRenderTarget(writeBuffer);
    renderer.render(pathTracerScene, pathTracerCamera);
    
    // Render to screen
    renderer.setRenderTarget(null);
    renderer.render(pathTracerScene, pathTracerCamera);
    
    // Only swap buffers when camera is static (accumulating)
    // This is key for proper progressive rendering:
    // - When camera moves, we start fresh and don't need to accumulate
    // - When camera is static, we blend with previous frame
    if (cameraStatic) {
        currentAccumulationBuffer = 1 - currentAccumulationBuffer;
    }
    
    // Determine convergence
    const converged = accumulatedSamples >= maxSamples;
    
    return {
        shouldRender: true,
        cameraStatic: cameraStatic,
        accumulatedSamples: accumulatedSamples,
        converged: converged,
        bufferIndex: currentAccumulationBuffer,
        maxSamples: maxSamples
    };
}

/**
 * Check if camera has been static (not moving) recently.
 * Useful for determining when to enable higher quality rendering.
 * 
 * @param {THREE.Camera} camera - The camera to check
 * @param {number} threshold - Movement threshold (default: 0.001)
 * @returns {boolean} True if camera is static
 */
function isCameraStatic(camera, threshold = 0.001) {
    if (!prevCameraPosition || !prevCameraQuaternion) {
        return false;
    }
    
    const positionDelta = Math.sqrt(
        Math.pow(camera.position.x - prevCameraPosition.x, 2) +
        Math.pow(camera.position.y - prevCameraPosition.y, 2) +
        Math.pow(camera.position.z - prevCameraPosition.z, 2)
    );
    
    const quatDelta = Math.sqrt(
        Math.pow(camera.quaternion.x - prevCameraQuaternion.x, 2) +
        Math.pow(camera.quaternion.y - prevCameraQuaternion.y, 2) +
        Math.pow(camera.quaternion.z - prevCameraQuaternion.z, 2) +
        Math.pow(camera.quaternion.w - prevCameraQuaternion.w, 2)
    );
    
    return positionDelta < threshold && quatDelta < threshold;
}

// Export functions to global scope
window.initPathTracer = initPathTracer;
window.renderPathTracer = renderPathTracer;
window.setPathTracerEnabled = setPathTracerEnabled;
window.togglePathTracer = togglePathTracer;
window.isPathTracerEnabled = isPathTracerEnabled;
window.updatePathTracerSceneData = updatePathTracerSceneData;
window.resizePathTracer = resizePathTracer;
window.disposePathTracer = disposePathTracer;
window.getPathTracerSampleCount = getPathTracerSampleCount;
window.updatePathTracerRenderLoop = updatePathTracerRenderLoop;
window.isCameraStatic = isCameraStatic;
window.markPathTracerTerrainDirty = markPathTracerTerrainDirty;
window.markPathTracerUnitsDirty = markPathTracerUnitsDirty;
window.checkPathTracerMapUpdates = checkPathTracerMapUpdates;
window.updatePathTracerTile = updatePathTracerTile;
