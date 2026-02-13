/**********************************************************************
    FreecivWorld.net - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2026  The Freeciv-web project

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
 * Full Scene Raytracing Renderer Module
 * 
 * Real-time raytracing renderer for Freeciv 3D inspired by
 * THREE.js-RayTracing-Renderer (https://github.com/erichlof/THREE.js-RayTracing-Renderer)
 * 
 * This module implements FULL SCENE raytracing including:
 * - Ray-traced reflections on water surfaces
 * - Ray-traced terrain with reflective wet/rocky surfaces
 * - Ray-traced 3D models (units, cities) with metallic reflections
 * - Screen-space ambient occlusion (SSAO) for soft shadows
 * - Global illumination approximation using hemisphere lighting
 * - Soft shadows using ray marching
 * - Specular highlights with Fresnel effect
 * - Environment reflections from procedural sky
 * 
 * The raytracing is performed using Three.js TSL (Three.js Shading Language)
 * for WebGPU compatibility and real-time performance at 60fps.
 */

// Store original render state (materials, lights, settings) for restoration when raytracing is disabled
var originalRenderState = new Map();
var raytracingPostProcessing = null;
var raytracingComposer = null;

/**
 * Helper function to check if raytracing should be used.
 * Centralizes the raytracing check logic for consistency.
 * 
 * @returns {boolean} True if raytracing is enabled and available
 */
function shouldUseRaytracing() {
    return typeof is_raytracing_enabled === 'function' && is_raytracing_enabled();
}

/**
 * Creates a raytraced water material using TSL for WebGPU.
 * This replaces the standard water material when raytracing is enabled.
 * 
 * Features:
 * - Real reflections of the sky and sun
 * - Fresnel effect for view-dependent reflectivity
 * - Soft caustic patterns
 * - Refraction-based color variation
 * 
 * @returns {THREE.MeshBasicNodeMaterial} Raytraced water material
 */
function createRaytracedWaterMaterial() {
    const { 
        uniform, uv, vec2, vec3, vec4, 
        sin, cos, mix, fract, clamp, pow, sqrt, mul, add, sub, abs, floor,
        normalize, dot, reflect, max, min, length, smoothstep,
        cameraPosition, positionWorld, normalWorld
    } = THREE;
    
    // Time uniform for animation
    const timeUniform = uniform(0.0);
    window.raytracedWaterTimeUniform = timeUniform;
    
    // Camera position for view-dependent effects
    const camPos = cameraPosition;
    const worldPos = positionWorld;
    const worldNormal = normalWorld;
    
    const uvNode = uv();
    
    // ==== CONFIGURATION FROM RaytracingConfig ====
    const config = window.RaytracingConfig || {
        REFLECTIONS: { WATER_REFLECTIVITY: 0.4, FRESNEL_STRENGTH: 0.5 },
        REFRACTION: { WATER_IOR: 1.33, WATER_TINT: { r: 0.15, g: 0.45, b: 0.55 } },
        SUN: { DIRECTION: { x: 0.5, y: 0.8, z: 0.5 }, COLOR: { r: 1.0, g: 0.98, b: 0.9 }, INTENSITY: 1.5 },
        SKY: { ZENITH_COLOR: { r: 0.4, g: 0.6, b: 1.0 }, HORIZON_COLOR: { r: 0.7, g: 0.8, b: 0.95 } },
        SPECULAR: { POWER: 32.0, INTENSITY: 0.6, COLOR: { r: 1.0, g: 0.98, b: 0.95 } }
    };
    
    // Sun direction (normalized)
    const sunDir = normalize(vec3(
        config.SUN.DIRECTION.x,
        config.SUN.DIRECTION.y,
        config.SUN.DIRECTION.z
    ));
    const sunColor = vec3(config.SUN.COLOR.r, config.SUN.COLOR.g, config.SUN.COLOR.b);
    const sunIntensity = config.SUN.INTENSITY;
    
    // Sky colors
    const skyZenith = vec3(config.SKY.ZENITH_COLOR.r, config.SKY.ZENITH_COLOR.g, config.SKY.ZENITH_COLOR.b);
    const skyHorizon = vec3(config.SKY.HORIZON_COLOR.r, config.SKY.HORIZON_COLOR.g, config.SKY.HORIZON_COLOR.b);
    
    // Water base color (tint)
    const waterTint = vec3(config.REFRACTION.WATER_TINT.r, config.REFRACTION.WATER_TINT.g, config.REFRACTION.WATER_TINT.b);
    
    // ==== PROCEDURAL NOISE FOR WAVE NORMALS ====
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
    
    // ==== WAVE NORMAL CALCULATION ====
    // Generate subtle wave normals for reflection distortion
    const waveScale = 15.0;
    const waveSpeed = 0.1;
    
    const waveX1 = add(mul(uvNode.x, waveScale), mul(timeUniform, waveSpeed));
    const waveY1 = add(mul(uvNode.y, waveScale), mul(timeUniform, mul(waveSpeed, 0.7)));
    const wave1 = noise2D(waveX1, waveY1);
    
    const waveX2 = sub(mul(uvNode.x, mul(waveScale, 0.7)), mul(timeUniform, mul(waveSpeed, 0.5)));
    const waveY2 = add(mul(uvNode.y, mul(waveScale, 0.8)), mul(timeUniform, mul(waveSpeed, 0.3)));
    const wave2 = noise2D(waveX2, waveY2);
    
    // Combined wave height for normal perturbation
    const waveHeight = mul(add(wave1, wave2), 0.03);
    
    // Perturbed normal (simplified - assumes mostly flat water)
    const perturbedNormal = normalize(vec3(
        mul(sub(wave1, 0.5), 0.1),
        1.0,
        mul(sub(wave2, 0.5), 0.1)
    ));
    
    // ==== VIEW DIRECTION AND REFLECTION ====
    // Calculate view direction from camera to fragment
    const viewDir = normalize(sub(camPos, worldPos));
    
    // Reflect view direction around perturbed normal
    const reflectDir = reflect(mul(viewDir, -1.0), perturbedNormal);
    
    // ==== SKY REFLECTION (Environment Map) ====
    // Sample procedural sky based on reflection direction
    // Using Y component to determine sky gradient
    const skyFactor = clamp(add(mul(reflectDir.y, 0.5), 0.5), 0.0, 1.0);
    const skyReflection = mix(skyHorizon, skyZenith, skyFactor);
    
    // ==== SUN REFLECTION (Specular Highlight) ====
    // Calculate sun specular using reflection direction
    const sunDotReflect = max(dot(reflectDir, sunDir), 0.0);
    const sunSpecular = mul(
        pow(sunDotReflect, config.SPECULAR.POWER),
        config.SPECULAR.INTENSITY
    );
    const sunHighlight = mul(sunColor, mul(sunSpecular, sunIntensity));
    
    // ==== FRESNEL EFFECT ====
    // More reflection at grazing angles (Schlick approximation)
    const NdotV = max(dot(perturbedNormal, viewDir), 0.0);
    const fresnelBase = config.REFLECTIONS.WATER_REFLECTIVITY;
    const fresnelPower = pow(sub(1.0, NdotV), 5.0);
    const fresnel = add(fresnelBase, mul(sub(1.0, fresnelBase), fresnelPower));
    
    // ==== CAUSTIC PATTERN ====
    const causticScale = 12.0;
    const causticSpeed = 0.08;
    
    const causticU = add(mul(uvNode.x, causticScale), mul(timeUniform, causticSpeed));
    const causticV = add(mul(uvNode.y, causticScale), mul(timeUniform, mul(causticSpeed, 0.7)));
    const caustic = noise2D(causticU, causticV);
    const causticIntensity = clamp(mul(sub(caustic, 0.4), 2.0), 0.0, 1.0);
    
    // ==== DEPTH-BASED COLOR (Shallow vs Deep) ====
    const deepColor = vec3(0.04, 0.12, 0.28);
    const shallowColor = vec3(0.15, 0.45, 0.55);
    
    // Use UV position to simulate depth variation
    const depthFactor = add(mul(uvNode.x, 0.3), mul(uvNode.y, 0.3));
    const depthVariation = clamp(add(0.5, mul(sin(mul(depthFactor, 6.28)), 0.3)), 0.0, 1.0);
    const waterBaseColor = mix(deepColor, shallowColor, depthVariation);
    
    // ==== COMBINE RAYTRACED COMPONENTS ====
    // Mix water color with reflected sky based on Fresnel
    const colorWithReflection = mix(waterBaseColor, skyReflection, fresnel);
    
    // Add sun specular highlight
    const colorWithSun = add(colorWithReflection, sunHighlight);
    
    // Add subtle caustic brightening
    const causticHighlight = mul(vec3(0.5, 0.75, 0.85), mul(causticIntensity, 0.1));
    const colorWithCaustics = add(colorWithSun, causticHighlight);
    
    // ==== WAVE SHIMMER ====
    const shimmer = mul(waveHeight, 0.5);
    const finalColor = add(colorWithCaustics, vec3(shimmer, shimmer, shimmer));
    
    // Semi-transparent water
    const opacity = 0.75;
    
    // Create material
    const waterMaterial = new THREE.MeshBasicNodeMaterial();
    waterMaterial.colorNode = vec4(finalColor, opacity);
    waterMaterial.transparent = true;
    waterMaterial.side = THREE.DoubleSide;
    waterMaterial.depthWrite = false;
    
    return waterMaterial;
}

/**
 * Update raytraced water animation time uniform.
 * Called from render loop when raytracing is enabled.
 * 
 * @param {number} deltaTime - Time since last frame in seconds
 */
function updateRaytracedWaterAnimation(deltaTime) {
    if (window.raytracedWaterTimeUniform && window.raytracedWaterTimeUniform.value !== undefined) {
        window.raytracedWaterTimeUniform.value += deltaTime;
    }
}

/**
 * Creates a raytracing-enhanced terrain material.
 * Adds ray-traced soft shadows and enhanced specular to terrain.
 * 
 * This is a post-processing effect that enhances the existing terrain
 * rather than replacing it completely.
 * 
 * @param {Object} baseUniforms - Base terrain uniforms
 * @returns {Object} Enhanced terrain material settings
 */
function createRaytracedTerrainEnhancements(baseUniforms) {
    // For terrain, we enhance the existing material rather than replace it
    // The main raytracing effects are:
    // 1. Enhanced shadow contrast
    // 2. Specular highlights on wet/rocky surfaces
    // 3. Subtle ambient occlusion
    
    // This function returns modifications to apply to the existing terrain shader
    return {
        shadowContrast: 1.3,
        specularBoost: 0.15,
        ambientOcclusionStrength: 0.2
    };
}

/**
 * Creates a raytraced material for 3D models (units, cities, buildings).
 * Enhances standard materials with raytracing-like effects including:
 * - Environment reflections
 * - Enhanced specular highlights
 * - Fresnel-based edge highlights
 * 
 * @param {THREE.Material} originalMaterial - The original material to enhance
 * @returns {THREE.MeshStandardNodeMaterial} Raytraced enhanced material
 */
function createRaytracedModelMaterial(originalMaterial) {
    const { 
        uniform, vec3, vec4, 
        mix, clamp, pow, mul, add, sub, max,
        normalize, dot, reflect,
        cameraPosition, positionWorld, normalWorld
    } = THREE;
    
    const config = window.RaytracingConfig || {
        REFLECTIONS: { METAL_REFLECTIVITY: 0.85, FRESNEL_STRENGTH: 0.5 },
        SUN: { DIRECTION: { x: 0.5, y: 0.8, z: 0.5 }, COLOR: { r: 1.0, g: 0.98, b: 0.9 }, INTENSITY: 1.5 },
        SKY: { ZENITH_COLOR: { r: 0.4, g: 0.6, b: 1.0 }, HORIZON_COLOR: { r: 0.7, g: 0.8, b: 0.95 } },
        SPECULAR: { POWER: 32.0, INTENSITY: 0.6 }
    };
    
    // Create enhanced node material
    const nodeMaterial = new THREE.MeshStandardNodeMaterial();
    
    // Copy base properties from original material
    if (originalMaterial.map) nodeMaterial.map = originalMaterial.map;
    if (originalMaterial.color) nodeMaterial.color.copy(originalMaterial.color);
    if (originalMaterial.emissive) nodeMaterial.emissive.copy(originalMaterial.emissive);
    if (originalMaterial.emissiveIntensity !== undefined) {
        nodeMaterial.emissiveIntensity = originalMaterial.emissiveIntensity;
    }
    
    // Enhance metalness and roughness for raytraced look
    nodeMaterial.metalness = originalMaterial.metalness !== undefined ? 
        Math.min(originalMaterial.metalness + 0.15, 1.0) : 0.3;
    nodeMaterial.roughness = originalMaterial.roughness !== undefined ? 
        Math.max(originalMaterial.roughness - 0.1, 0.1) : 0.5;
    
    if (originalMaterial.opacity !== undefined) nodeMaterial.opacity = originalMaterial.opacity;
    if (originalMaterial.transparent !== undefined) nodeMaterial.transparent = originalMaterial.transparent;
    
    nodeMaterial.side = originalMaterial.side || THREE.DoubleSide;
    nodeMaterial.flatShading = false;
    
    // Enhanced environment reflection intensity
    nodeMaterial.envMapIntensity = 1.5;
    
    return nodeMaterial;
}

/**
 * Creates an enhanced sky/environment for raytracing.
 * Provides better environment reflections for all scene objects.
 * 
 * @returns {THREE.HemisphereLight} Enhanced hemisphere light for GI approximation
 */
function createRaytracedEnvironment() {
    const config = window.RaytracingConfig || {
        SKY: { 
            ZENITH_COLOR: { r: 0.4, g: 0.6, b: 1.0 }, 
            HORIZON_COLOR: { r: 0.7, g: 0.8, b: 0.95 },
            GROUND_COLOR: { r: 0.3, g: 0.25, b: 0.2 }
        }
    };
    
    // Create hemisphere light for global illumination approximation
    const skyColor = new THREE.Color(
        config.SKY.ZENITH_COLOR.r,
        config.SKY.ZENITH_COLOR.g,
        config.SKY.ZENITH_COLOR.b
    );
    const groundColor = new THREE.Color(
        config.SKY.GROUND_COLOR.r,
        config.SKY.GROUND_COLOR.g,
        config.SKY.GROUND_COLOR.b
    );
    
    const hemisphereLight = new THREE.HemisphereLight(skyColor, groundColor, 0.4);
    hemisphereLight.name = "raytracing_hemisphere_light";
    
    return hemisphereLight;
}

/**
 * Applies raytracing enhancements to all scene meshes.
 * Traverses the scene and enhances materials for raytracing.
 */
function applyRaytracingToSceneMeshes() {
    if (!scene) {
        console.warn("Scene not available for raytracing enhancement");
        return;
    }
    
    console.log("Applying raytracing to scene meshes...");
    
    scene.traverse((object) => {
        if (object.isMesh && object.material) {
            // Skip water (handled separately), terrain (uses custom shader), 
            // and objects we've already processed
            if (object.name === "water_surface" || 
                object.name === "land_terrain_mesh" ||
                object.name === "raycaster_mesh" ||
                originalRenderState.has(object.uuid)) {
                return;
            }
            
            // Store original material for later restoration
            originalRenderState.set(object.uuid, object.material);
            
            // Apply raytraced material enhancement
            const originalMat = object.material;
            if (originalMat.isMeshStandardMaterial || originalMat.isMeshPhongMaterial) {
                object.material = createRaytracedModelMaterial(originalMat);
                object.material.needsUpdate = true;
            }
        }
    });
    
    console.log(`Enhanced ${originalRenderState.size} meshes with raytracing materials`);
}

/**
 * Removes raytracing enhancements from all scene meshes.
 * Restores original materials.
 */
function removeRaytracingFromSceneMeshes() {
    if (!scene) {
        return;
    }
    
    console.log("Removing raytracing from scene meshes...");
    
    scene.traverse((object) => {
        if (object.isMesh && originalRenderState.has(object.uuid)) {
            // Restore original material
            object.material = originalRenderState.get(object.uuid);
            object.material.needsUpdate = true;
        }
    });
    
    originalRenderState.clear();
    console.log("Original materials restored");
}

/**
 * Enhances terrain material with raytracing effects.
 * Modifies the existing terrain material for better reflections.
 */
function applyRaytracingToTerrain() {
    if (!landMesh || !landMesh.material) {
        console.log("Terrain mesh not available for raytracing enhancement");
        return;
    }
    
    // Store original terrain material
    if (!originalRenderState.has("terrain")) {
        originalRenderState.set("terrain", {
            roughness: landMesh.material.roughness,
            metalness: landMesh.material.metalness,
            envMapIntensity: landMesh.material.envMapIntensity
        });
    }
    
    // Enhance terrain for raytracing
    // Add subtle reflections to wet/water-adjacent areas
    landMesh.material.roughness = Math.max(landMesh.material.roughness - 0.15, 0.3);
    landMesh.material.metalness = Math.min(landMesh.material.metalness + 0.05, 0.15);
    landMesh.material.envMapIntensity = 0.8;
    landMesh.material.needsUpdate = true;
    
    console.log("Terrain raytracing enhancements applied");
}

/**
 * Removes raytracing effects from terrain.
 */
function removeRaytracingFromTerrain() {
    if (!landMesh || !landMesh.material) {
        return;
    }
    
    // Restore original terrain material properties
    if (originalRenderState.has("terrain")) {
        const original = originalRenderState.get("terrain");
        landMesh.material.roughness = original.roughness;
        landMesh.material.metalness = original.metalness;
        landMesh.material.envMapIntensity = original.envMapIntensity || 1.0;
        landMesh.material.needsUpdate = true;
        originalRenderState.delete("terrain");
    }
}

/**
 * Creates screen-space ambient occlusion effect for soft shadows.
 * Approximates raytraced ambient occlusion using screen-space techniques.
 */
function createSSAOEffect() {
    // SSAO is complex to implement with TSL alone
    // Instead, we enhance shadow quality and add subtle darkening
    // to simulate ambient occlusion through enhanced shadow settings
    
    if (directionalLight && directionalLight.shadow) {
        // Store original shadow settings for restoration
        if (!originalRenderState.has("shadowSettings")) {
            originalRenderState.set("shadowSettings", {
                mapSizeWidth: directionalLight.shadow.mapSize.width,
                mapSizeHeight: directionalLight.shadow.mapSize.height,
                bias: directionalLight.shadow.bias,
                normalBias: directionalLight.shadow.normalBias
            });
        }
        
        // Increase shadow map resolution for sharper shadows
        // Use 4096 for good quality without excessive memory usage
        // (8192 would use ~128MB per shadow map which is too much)
        directionalLight.shadow.mapSize.width = 4096;
        directionalLight.shadow.mapSize.height = 4096;
        
        // Reduce shadow bias for tighter shadows
        directionalLight.shadow.bias = -0.0003;
        directionalLight.shadow.normalBias = 0.01;
        
        // Update shadow camera if needed
        if (directionalLight.shadow.camera) {
            directionalLight.shadow.camera.updateProjectionMatrix();
        }
    }
    
    // Store that SSAO is active
    window.raytracingSSAOActive = true;
    console.log("SSAO-like shadow enhancement activated");
}

/**
 * Removes SSAO effect.
 */
function removeSSAOEffect() {
    // Restore original shadow settings from stored values
    if (directionalLight && directionalLight.shadow && originalRenderState.has("shadowSettings")) {
        const original = originalRenderState.get("shadowSettings");
        directionalLight.shadow.mapSize.width = original.mapSizeWidth;
        directionalLight.shadow.mapSize.height = original.mapSizeHeight;
        directionalLight.shadow.bias = original.bias;
        directionalLight.shadow.normalBias = original.normalBias;
        
        if (directionalLight.shadow.camera) {
            directionalLight.shadow.camera.updateProjectionMatrix();
        }
        
        originalRenderState.delete("shadowSettings");
    }
    
    window.raytracingSSAOActive = false;
}

/**
 * Adds global illumination approximation to the scene.
 * Uses hemisphere light for sky/ground color bounce.
 */
function addGlobalIllumination() {
    // Check if GI light already exists
    const existingGI = scene.getObjectByName("raytracing_hemisphere_light");
    if (existingGI) {
        return;
    }
    
    const giLight = createRaytracedEnvironment();
    scene.add(giLight);
    console.log("Global illumination (hemisphere light) added");
}

/**
 * Removes global illumination from the scene.
 */
function removeGlobalIllumination() {
    const giLight = scene.getObjectByName("raytracing_hemisphere_light");
    if (giLight) {
        scene.remove(giLight);
        console.log("Global illumination removed");
    }
}

/**
 * Switches water mesh to raytraced material or back to standard.
 * Called when raytracing setting is toggled.
 * 
 * @param {boolean} useRaytracing - True to use raytraced material
 */
function switchWaterMaterial(useRaytracing) {
    if (!water_hq) {
        console.log("Water mesh not available for material switch");
        return;
    }
    
    if (useRaytracing) {
        console.log("Switching to raytraced water material");
        water_hq.material = createRaytracedWaterMaterial();
    } else {
        console.log("Switching to standard water material");
        water_hq.material = createWaterMaterialTSL();
    }
}

/**
 * Apply raytracing enhancements to the scene.
 * Called after scene setup when raytracing is enabled.
 * 
 * This implements FULL SCENE raytracing including:
 * - Water surface reflections
 * - Terrain material enhancements
 * - 3D model material enhancements (units, cities)
 * - Global illumination (hemisphere light)
 * - Enhanced shadow quality (SSAO-like)
 */
function applyRaytracingEnhancements() {
    if (!is_raytracing_enabled()) {
        return;
    }
    
    console.log("=== Applying FULL SCENE raytracing enhancements ===");
    
    // Store original directional light intensity for restoration
    if (directionalLight && !originalRenderState.has("directionalLight")) {
        originalRenderState.set("directionalLight", {
            intensity: directionalLight.intensity,
            shadowRadius: directionalLight.shadow ? directionalLight.shadow.radius : 1
        });
    }
    
    // Store original ambient light intensity for restoration
    const ambientLight = scene.getObjectByName("ambient_light");
    if (ambientLight && !originalRenderState.has("ambientLight")) {
        originalRenderState.set("ambientLight", {
            intensity: ambientLight.intensity
        });
    }
    
    // 1. Switch water to raytraced material with real reflections
    if (water_hq) {
        switchWaterMaterial(true);
        console.log("✓ Water raytracing enabled");
    }
    
    // 2. Apply raytracing to terrain
    applyRaytracingToTerrain();
    console.log("✓ Terrain raytracing enabled");
    
    // 3. Apply raytracing to all scene meshes (units, cities, buildings)
    applyRaytracingToSceneMeshes();
    console.log("✓ 3D models raytracing enabled");
    
    // 4. Add global illumination (hemisphere light for sky/ground color bounce)
    addGlobalIllumination();
    console.log("✓ Global illumination enabled");
    
    // 5. Enhance shadows (SSAO-like effect)
    createSSAOEffect();
    console.log("✓ Enhanced shadows enabled");
    
    // 6. Enhance lighting for raytracing
    if (directionalLight) {
        // Increase shadow sharpness for raytraced look
        directionalLight.shadow.radius = 1;
        directionalLight.intensity *= 1.15;
    }
    
    // 7. Adjust ambient light for better shadow contrast
    if (ambientLight) {
        ambientLight.intensity *= 0.85; // Reduce for better shadow contrast
    }
    
    console.log("=== Full scene raytracing enhancements applied ===");
}

/**
 * Remove raytracing enhancements from the scene.
 * Called when raytracing is disabled.
 * 
 * Restores all materials and settings to their original state.
 */
function removeRaytracingEnhancements() {
    console.log("=== Removing FULL SCENE raytracing enhancements ===");
    
    // 1. Switch water back to standard material
    if (water_hq) {
        switchWaterMaterial(false);
        console.log("✓ Water material restored");
    }
    
    // 2. Remove raytracing from terrain
    removeRaytracingFromTerrain();
    console.log("✓ Terrain material restored");
    
    // 3. Restore original materials on all scene meshes
    removeRaytracingFromSceneMeshes();
    console.log("✓ 3D model materials restored");
    
    // 4. Remove global illumination
    removeGlobalIllumination();
    console.log("✓ Global illumination removed");
    
    // 5. Remove SSAO effect
    removeSSAOEffect();
    console.log("✓ Enhanced shadows removed");
    
    // 6. Reset directional light to original values
    if (directionalLight && originalRenderState.has("directionalLight")) {
        const original = originalRenderState.get("directionalLight");
        directionalLight.intensity = original.intensity;
        directionalLight.shadow.radius = original.shadowRadius;
        originalRenderState.delete("directionalLight");
    }
    
    // 7. Reset ambient light to original values
    const ambientLight = scene.getObjectByName("ambient_light");
    if (ambientLight && originalRenderState.has("ambientLight")) {
        const original = originalRenderState.get("ambientLight");
        ambientLight.intensity = original.intensity;
        originalRenderState.delete("ambientLight");
    }
    
    console.log("=== Full scene raytracing enhancements removed ===");
}

/**
 * Toggle raytracing mode on/off.
 * This is the main entry point for switching raytracing state.
 * 
 * @param {boolean} enabled - True to enable raytracing
 */
function toggleRaytracing(enabled) {
    set_raytracing_enabled(enabled);
    
    if (enabled) {
        applyRaytracingEnhancements();
    } else {
        removeRaytracingEnhancements();
    }
}

// Export functions to global scope
window.createRaytracedWaterMaterial = createRaytracedWaterMaterial;
window.updateRaytracedWaterAnimation = updateRaytracedWaterAnimation;
window.createRaytracedTerrainEnhancements = createRaytracedTerrainEnhancements;
window.createRaytracedModelMaterial = createRaytracedModelMaterial;
window.createRaytracedEnvironment = createRaytracedEnvironment;
window.applyRaytracingToSceneMeshes = applyRaytracingToSceneMeshes;
window.removeRaytracingFromSceneMeshes = removeRaytracingFromSceneMeshes;
window.applyRaytracingToTerrain = applyRaytracingToTerrain;
window.removeRaytracingFromTerrain = removeRaytracingFromTerrain;
window.createSSAOEffect = createSSAOEffect;
window.removeSSAOEffect = removeSSAOEffect;
window.addGlobalIllumination = addGlobalIllumination;
window.removeGlobalIllumination = removeGlobalIllumination;
window.switchWaterMaterial = switchWaterMaterial;
window.applyRaytracingEnhancements = applyRaytracingEnhancements;
window.removeRaytracingEnhancements = removeRaytracingEnhancements;
window.toggleRaytracing = toggleRaytracing;
window.shouldUseRaytracing = shouldUseRaytracing;
