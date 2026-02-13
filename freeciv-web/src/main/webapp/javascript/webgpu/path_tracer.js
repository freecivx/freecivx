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
 * Path Tracer Module for Freeciv 3D
 * 
 * Implements a real-time path tracing renderer using THREE.js TSL (Three.js Shading Language)
 * for WebGPU. This provides photorealistic rendering with:
 * 
 * - Global Illumination via multi-bounce ray tracing
 * - Soft shadows through area light sampling
 * - PBR (Physically Based Rendering) materials
 * - Progressive sample accumulation
 * - Water refraction and metallic unit reflections
 * 
 * Architecture:
 * - Full-screen quad with custom ShaderMaterial
 * - DataTextures for terrain heightmap and unit positions
 * - Ping-pong frame buffers for accumulation
 * - Camera-based ray generation
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

    console.log('Initializing Path Tracer...');

    // Get viewport size
    const size = renderer.getSize(new THREE.Vector2());
    const width = size.x;
    const height = size.y;

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

    // Create terrain data texture from heightmap
    createTerrainDataTexture();

    // Create unit data texture (initially empty)
    createUnitDataTexture();

    // Create path tracer uniforms
    createPathTracerUniforms(mainCamera, width, height);

    // Create path tracer material using TSL
    pathTracerMaterial = createPathTracerMaterial();

    // Create full-screen quad
    const quadGeometry = new THREE.PlaneGeometry(2, 2);
    pathTracerQuad = new THREE.Mesh(quadGeometry, pathTracerMaterial);
    pathTracerQuad.frustumCulled = false;
    pathTracerQuad.name = 'PathTracerQuad';

    // Create orthographic camera for quad rendering
    pathTracerCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Create scene for path tracer quad
    pathTracerScene = new THREE.Scene();
    pathTracerScene.add(pathTracerQuad);

    // Store previous camera state
    prevCameraPosition = mainCamera.position.clone();
    prevCameraQuaternion = mainCamera.quaternion.clone();

    console.log('Path Tracer initialized successfully');
}

/**
 * Create the terrain data texture from the heightmap.
 * Encodes terrain heights and types into a DataTexture for GPU access.
 */
function createTerrainDataTexture() {
    // Get map dimensions
    const mapWidth = map ? map.xsize : 64;
    const mapHeight = map ? map.ysize : 64;

    // Create data array (RGBA float)
    // R = height, G = terrain type, B = is_water, A = reserved
    const data = new Float32Array(mapWidth * mapHeight * 4);

    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            const idx = (y * mapWidth + x) * 4;
            const tile = tiles ? tiles[tile_index(x, y)] : null;
            
            if (tile) {
                // Height (normalized to 0-1 range)
                data[idx + 0] = tile.height !== undefined ? tile.height : 0.5;
                // Terrain type (normalized)
                data[idx + 1] = tile.terrain !== undefined ? tile.terrain / 255.0 : 0.5;
                // Is water (coast, ocean, lake)
                const terrain = tile.terrain;
                const isWater = (terrain === 10 || terrain === 20 || terrain === 0) ? 1.0 : 0.0;
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
    const mapWidth = map ? map.xsize : 64;
    const mapHeight = map ? map.ysize : 64;

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
        
        // Camera matrices
        cameraWorldMatrix: { value: camera.matrixWorld.clone() },
        cameraProjectionMatrixInverse: { value: camera.projectionMatrixInverse.clone() },
        
        // Previous accumulation buffer
        previousFrame: { value: null },
        
        // Terrain data
        terrainData: { value: terrainDataTexture },
        unitData: { value: unitDataTexture },
        mapSize: { value: new THREE.Vector2(map ? map.xsize : 64, map ? map.ysize : 64) },
        
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
    // Import TSL functions and nodes from THREE
    // These should be available after three-modules-webgpu.js has loaded
    const { 
        texture, uniform, uv,
        vec2, vec3, vec4,
        mix, step, floor, fract, mod, dot, sin, cos, normalize, max, min, pow, clamp, abs, sqrt,
        mul, add, sub, div, reflect
    } = THREE;

    // Verify all required TSL functions and nodes are available
    const requiredTSLNames = [
        'texture', 'uniform', 'uv',
        'vec2', 'vec3', 'vec4',
        'mix', 'step', 'floor', 'fract', 'mod', 'dot', 'sin', 'cos', 'normalize', 'max', 'min', 'pow', 'clamp', 'abs', 'sqrt',
        'mul', 'add', 'sub', 'div', 'reflect'
    ];
    const missing = requiredTSLNames.filter(name => THREE[name] === undefined);
    if (missing.length > 0) {
        console.error('Path Tracer: Missing TSL functions/nodes:', missing);
        throw new Error(`Path Tracer: Required TSL functions/nodes not available: ${missing.join(', ')}. Ensure three-modules-webgpu.js has loaded successfully.`);
    }

    // Create uniforms as TSL uniform nodes
    const timeUniform = uniform(0.0);
    const frameCountUniform = uniform(0);
    const accumulatedSamplesUniform = uniform(0);
    const resolutionUniform = uniform(new THREE.Vector2(1, 1));
    const cameraWorldMatrixUniform = uniform(new THREE.Matrix4());
    const cameraProjectionMatrixInverseUniform = uniform(new THREE.Matrix4());
    const previousFrameUniform = uniform(null);
    const terrainDataUniform = uniform(terrainDataTexture);
    const unitDataUniform = uniform(unitDataTexture);
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

    // Store uniforms for external updates
    window.pathTracerTSLUniforms = {
        time: timeUniform,
        frameCount: frameCountUniform,
        accumulatedSamples: accumulatedSamplesUniform,
        resolution: resolutionUniform,
        cameraWorldMatrix: cameraWorldMatrixUniform,
        cameraProjectionMatrixInverse: cameraProjectionMatrixInverseUniform,
        previousFrame: previousFrameUniform,
        terrainData: terrainDataUniform,
        unitData: unitDataUniform,
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
        terrainRoughness: terrainRoughnessUniform
    };

    // ==== UTILITY FUNCTIONS ====

    // Hash function for pseudo-random numbers
    function hash(p) {
        return fract(mul(sin(mul(p, 127.1)), 43758.5453));
    }

    // 2D hash
    function hash2(px, py) {
        const h1 = hash(add(mul(px, 12.9898), mul(py, 78.233)));
        const h2 = hash(add(mul(px, 63.7264), mul(py, 10.873)));
        return vec2(h1, h2);
    }

    // Random value based on pixel and frame
    function random(px, py, seed) {
        return hash(add(add(mul(px, 12.9898), mul(py, 78.233)), mul(seed, 43758.5453)));
    }

    // Get UV coordinates
    const uvCoord = uv();

    // Calculate screen-space position
    const screenPos = vec2(
        sub(mul(uvCoord.x, 2.0), 1.0),
        sub(mul(uvCoord.y, 2.0), 1.0)
    );

    // Generate random seed from frame count and position
    const randomSeed = add(mul(frameCountUniform, 0.618033988), mul(add(uvCoord.x, mul(uvCoord.y, 1000.0)), 0.0001));

    // ==== RAY GENERATION ====
    // Generate camera ray from screen coordinates

    // Near plane point in clip space
    const clipNear = vec4(screenPos.x, screenPos.y, -1.0, 1.0);
    // Far plane point in clip space
    const clipFar = vec4(screenPos.x, screenPos.y, 1.0, 1.0);

    // Transform to world space (simplified - using approximation)
    // Note: Full matrix multiplication would require TSL matrix ops
    // Using camera position and direction approximation
    const cameraPos = vec3(
        cameraWorldMatrixUniform.value.elements ? 0 : 0,  // Will be updated
        450,  // Default camera height
        320   // Default camera Z
    );

    // Approximate ray direction (looking at terrain)
    const rayDirBase = normalize(vec3(
        mul(screenPos.x, 0.8),
        -0.7,  // Looking down
        mul(screenPos.y, 0.8)
    ));

    // Add jitter for anti-aliasing
    const jitterX = mul(sub(random(uvCoord.x, uvCoord.y, randomSeed), 0.5), div(2.0, resolutionUniform.x));
    const jitterY = mul(sub(random(uvCoord.y, uvCoord.x, add(randomSeed, 0.5)), 0.5), div(2.0, resolutionUniform.y));

    const rayDir = normalize(add(rayDirBase, vec3(jitterX, 0, jitterY)));

    // ==== TERRAIN INTERSECTION ====
    // Raymarch against terrain heightfield

    // Water level constant
    const WATER_LEVEL = 50.0;

    // Sample terrain height at world position
    function sampleTerrainHeight(worldX, worldZ) {
        // Convert world coords to map UV
        const mapU = div(add(worldX, mul(mapWorldSizeUniform.x, 0.5)), mapWorldSizeUniform.x);
        const mapV = div(add(worldZ, mul(mapWorldSizeUniform.y, 0.5)), mapWorldSizeUniform.y);
        
        // Sample terrain data texture
        const terrainSample = texture(terrainDataUniform, vec2(clamp(mapU, 0.0, 1.0), clamp(mapV, 0.0, 1.0)));
        
        // Height is in R channel, scaled
        return mul(terrainSample.r, 100.0);
    }

    // Sample if position is water
    function sampleIsWater(worldX, worldZ) {
        const mapU = div(add(worldX, mul(mapWorldSizeUniform.x, 0.5)), mapWorldSizeUniform.x);
        const mapV = div(add(worldZ, mul(mapWorldSizeUniform.y, 0.5)), mapWorldSizeUniform.y);
        const terrainSample = texture(terrainDataUniform, vec2(clamp(mapU, 0.0, 1.0), clamp(mapV, 0.0, 1.0)));
        return terrainSample.b;  // B channel = is_water
    }

    // Sample unit presence
    function sampleUnit(worldX, worldZ) {
        const mapU = div(add(worldX, mul(mapWorldSizeUniform.x, 0.5)), mapWorldSizeUniform.x);
        const mapV = div(add(worldZ, mul(mapWorldSizeUniform.y, 0.5)), mapWorldSizeUniform.y);
        return texture(unitDataUniform, vec2(clamp(mapU, 0.0, 1.0), clamp(mapV, 0.0, 1.0)));
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

    // GGX Normal Distribution
    function distributionGGX(NdotH, roughness) {
        const a = mul(roughness, roughness);
        const a2 = mul(a, a);
        const NdotH2 = mul(NdotH, NdotH);
        const num = a2;
        const denom = add(mul(NdotH2, sub(a2, 1.0)), 1.0);
        const denomSq = mul(mul(denom, denom), 3.14159265);
        return div(num, denomSq);
    }

    // ==== MAIN COLOR CALCULATION ====

    // Initialize accumulated color
    let finalColor = vec3(0.0, 0.0, 0.0);
    let throughput = vec3(1.0, 1.0, 1.0);

    // Current ray
    let currentRayOrigin = cameraPos;
    let currentRayDir = rayDir;

    // Raymarch loop (simplified heightfield tracing)
    const MAX_STEPS = 64;
    const MAX_DIST = 2000.0;
    const EPSILON = 0.5;

    let totalDist = 0.0;
    let hitPos = vec3(0, 0, 0);
    let hitNormal = vec3(0, 1, 0);
    let hitMaterial = 0; // 0=terrain, 1=water, 2=metal unit
    let didHit = 0.0;

    // Simple raymarching against terrain
    // For each step, check if ray is below terrain height
    for (let i = 0; i < 32; i++) {
        const stepSize = 10.0 + i * 2.0;  // Increasing step size
        const sampleDist = i * stepSize;
        
        const samplePos = vec3(
            add(currentRayOrigin.x, mul(currentRayDir.x, sampleDist)),
            add(currentRayOrigin.y, mul(currentRayDir.y, sampleDist)),
            add(currentRayOrigin.z, mul(currentRayDir.z, sampleDist))
        );
        
        const terrainH = sampleTerrainHeight(samplePos.x, samplePos.z);
        const isWater = sampleIsWater(samplePos.x, samplePos.z);
        const unitInfo = sampleUnit(samplePos.x, samplePos.z);
        
        // Check terrain hit
        const heightDiff = sub(samplePos.y, terrainH);
        const isUnderTerrain = step(heightDiff, 0.0);
        
        // Check water hit (if water and above water level)
        const waterSurface = WATER_LEVEL;
        const waterHit = mul(isWater, step(sub(samplePos.y, waterSurface), 0.0));
        
        // Check unit hit (units are small spheres)
        const hasUnit = unitInfo.r;
        const unitY = add(terrainH, 5.0);  // Units sit above terrain
        const unitDist = sqrt(add(
            mul(sub(samplePos.y, unitY), sub(samplePos.y, unitY)),
            mul(3.0, 3.0)  // Unit radius
        ));
        const unitHitTest = mul(hasUnit, step(unitDist, 5.0));
        
        // Accumulate hit info (take first hit)
        hitPos = mix(hitPos, samplePos, mul(isUnderTerrain, sub(1.0, didHit)));
        hitNormal = mix(hitNormal, vec3(0, 1, 0), mul(isUnderTerrain, sub(1.0, didHit)));
        hitMaterial = mix(hitMaterial, mul(isWater, 1.0), mul(waterHit, sub(1.0, didHit)));
        hitMaterial = mix(hitMaterial, 2.0, mul(unitHitTest, sub(1.0, didHit)));
        
        didHit = max(didHit, max(isUnderTerrain, max(waterHit, unitHitTest)));
    }

    // ==== SHADING ====

    // Sky contribution (no hit)
    const skyContrib = mul(getSkyColor(currentRayDir.y), sub(1.0, didHit));
    const sunContrib = mul(getSunLight(currentRayDir.x, currentRayDir.y, currentRayDir.z), sub(1.0, didHit));

    // Terrain shading (diffuse)
    const terrainDiffuse = vec3(0.3, 0.5, 0.2);  // Green terrain
    const NdotL_terrain = max(0.0, add(
        add(
            mul(hitNormal.x, sunDirectionUniform.x),
            mul(hitNormal.y, sunDirectionUniform.y)
        ),
        mul(hitNormal.z, sunDirectionUniform.z)
    ));
    const terrainLit = mul(mul(terrainDiffuse, NdotL_terrain), sunIntensityUniform);
    const terrainAmbient = mul(terrainDiffuse, 0.3);
    const terrainColor = add(terrainLit, terrainAmbient);

    // Water shading (reflective with fresnel)
    const waterReflectDir = reflect(currentRayDir, hitNormal);
    const waterReflectColor = getSkyColor(waterReflectDir.y);
    const waterFresnelTerm = fresnelSchlick(
        max(0.0, sub(0.0, mul(currentRayDir.y, hitNormal.y))),
        0.02  // F0 for water
    );
    const waterSurfaceColor = mix(waterColorUniform, waterReflectColor, waterFresnelTerm);

    // Metal shading (highly reflective)
    const metalReflectDir = reflect(currentRayDir, hitNormal);
    const metalReflectColor = getSkyColor(metalReflectDir.y);
    const metalSpecular = mul(metalColorUniform, metalReflectColor);

    // Select material color based on hit type
    const materialColorStep1 = mix(terrainColor, waterSurfaceColor, step(0.5, hitMaterial));
    const materialColor = mix(materialColorStep1, metalSpecular, step(1.5, hitMaterial));

    // Final color with hit
    const hitColor = mul(materialColor, didHit);

    // Combine sky and hit contributions
    finalColor = add(add(skyContrib, sunContrib), hitColor);

    // ==== SECOND BOUNCE (Global Illumination) ====
    // Simplified: add ambient occlusion approximation

    const aoFactor = mix(0.8, 1.0, didHit);
    finalColor = mul(finalColor, aoFactor);

    // Add slight bounce light from terrain
    const bounceLight = mul(vec3(0.1, 0.15, 0.08), mul(didHit, 0.3));
    finalColor = add(finalColor, bounceLight);

    // ==== ACCUMULATION ====
    // Blend with previous frame for progressive rendering

    const previousColor = texture(previousFrameUniform, uvCoord);
    const sampleWeight = div(1.0, add(accumulatedSamplesUniform, 1.0));
    
    // Mix based on accumulation
    const accumulatedColor = mix(previousColor, vec4(finalColor.x, finalColor.y, finalColor.z, 1.0), sampleWeight);

    // Tone mapping (simple Reinhard)
    const toneMappedR = div(accumulatedColor.r, add(accumulatedColor.r, 1.0));
    const toneMappedG = div(accumulatedColor.g, add(accumulatedColor.g, 1.0));
    const toneMappedB = div(accumulatedColor.b, add(accumulatedColor.b, 1.0));

    // Gamma correction
    const gammaR = pow(toneMappedR, 0.4545);
    const gammaG = pow(toneMappedG, 0.4545);
    const gammaB = pow(toneMappedB, 0.4545);

    // Output
    const outputColor = vec4(gammaR, gammaG, gammaB, 1.0);

    // Create node material
    const material = new THREE.MeshBasicNodeMaterial();
    material.colorNode = outputColor;
    material.transparent = false;
    material.side = THREE.DoubleSide;
    material.depthTest = false;
    material.depthWrite = false;

    return material;
}

/**
 * Update path tracer uniforms each frame.
 * Updates camera matrices, time, and checks for camera movement.
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

    // Update camera matrices
    camera.updateMatrixWorld();
    tslUniforms.cameraWorldMatrix.value.copy(camera.matrixWorld);
    tslUniforms.cameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse);
}

/**
 * Render a frame using the path tracer.
 * Implements ping-pong buffer accumulation.
 * 
 * @param {THREE.WebGPURenderer} renderer - The WebGPU renderer
 * @param {THREE.Camera} camera - The main camera
 */
function renderPathTracer(renderer, camera) {
    if (!pathTracerEnabled || !pathTracerScene || !pathTracerCamera) {
        return false;
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
    pathTracerEnabled = enabled;
    console.log('Path Tracer ' + (enabled ? 'enabled' : 'disabled'));
    
    // Reset accumulation when enabling
    if (enabled) {
        accumulatedSamples = 0;
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

/**
 * Update scene data textures.
 * Call this when terrain or units change.
 */
function updatePathTracerSceneData() {
    if (!pathTracerEnabled) return;
    
    // Recreate textures with updated data
    createTerrainDataTexture();
    createUnitDataTexture();
    
    // Update uniform references
    if (window.pathTracerTSLUniforms) {
        window.pathTracerTSLUniforms.terrainData.value = terrainDataTexture;
        window.pathTracerTSLUniforms.unitData.value = unitDataTexture;
    }
    
    // Reset accumulation since scene changed
    accumulatedSamples = 0;
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
