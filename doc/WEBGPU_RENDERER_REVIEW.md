# FreecivWorld WebGPU 3D Renderer Review

**Date:** February 2026  
**Reviewer:** GitHub Copilot Coding Agent  
**Repository:** freecivworld/freecivworld  

---

## Executive Summary

This document provides a comprehensive review of the FreecivWorld WebGPU 3D renderer, identifying its current architecture, strengths, and areas for improvement. The renderer is built on Three.js with WebGPU backend, utilizing TSL (Three.js Shading Language) for custom shaders.

---

## Current Architecture Overview

### 1. Core Components

| Component | File | Purpose |
|-----------|------|---------|
| Renderer Init | `renderer_init.js` | WebGPU renderer setup, quality settings |
| Main Mapview | `mapview_webgpu.js` | Scene setup, lighting, water shader |
| Terrain Shader | `terrain_shader_webgpu.js` | TSL-based terrain rendering with hex tiles |
| Configuration | `config.js` | Centralized constants and settings |
| Material Factory | `material_factory.js` | WebGPU material conversion utilities |
| Instance Manager | `instances.js` | Instanced mesh rendering for forests/models |
| Camera System | `camera.js` | Camera positioning and smooth sliding |
| Animation | `animation.js` | Unit movement, explosions, spaceship launch |

### 2. Technology Stack

- **Three.js r170+** with WebGPU renderer
- **TSL (Three.js Shading Language)** for GPU shaders
- **GLTF/GLB models** with DRACO compression
- **DataTexture** for terrain, borders, and roads data

---

## Strengths of Current Implementation

### ✅ Well-Architected Shader System
The TSL-based terrain shader (`terrain_shader_webgpu.js`) is comprehensive:
- Proper hexagonal tile coordinate system (odd-r offset)
- Multi-terrain blending with beach transitions
- Roads/railroads rendering from sprite sheets
- Nation border rendering with dashed lines
- Slope-based lighting with sun direction
- Soft edges between known/unknown tiles

### ✅ Centralized Configuration
The `config.js` module provides excellent separation of concerns:
- Immutable frozen configuration objects
- Well-documented constants
- Consistent settings across the codebase

### ✅ Deferred Batch Update System
Performance-conscious texture updates:
- `schedule_visibility_update()` batches fog-of-war updates
- `schedule_borders_texture_update()` batches border changes
- `schedule_roads_texture_update()` batches road modifications
- Uses `requestAnimationFrame` for optimal timing

### ✅ Instance Mesh Optimization
The `instances.js` module efficiently handles repeated objects:
- Forest/jungle trees use instanced rendering
- Reduces draw calls significantly
- Proper WebGPU material conversion

### ✅ WebGPU Material Factory
Clean conversion pattern for WebGL→WebGPU materials:
- `convertToNodeMaterial()` handles material properties
- `convertModelMaterials()` traverses entire model hierarchies
- Factory functions for common material types

---

## Areas for Improvement

### 🔴 HIGH PRIORITY

#### 1. Texture Memory Management
**Issue:** No texture disposal strategy or memory limits.

**Current Code Pattern:**
```javascript
// Textures are created but never disposed
webgl_textures[terrain_name] = texture;
texture_cache[key] = texture;
```

**Recommendation:**
- Implement LRU cache for texture_cache with configurable limit
- Call `texture.dispose()` when removing from cache
- Add memory budget tracking
- Dispose unused model textures when switching maps

**Implementation Suggestion:**
```javascript
const MAX_TEXTURE_CACHE_SIZE = 100;
const textureCache = new Map();

function getCachedTexture(key, createFn) {
  if (textureCache.has(key)) {
    return textureCache.get(key);
  }
  if (textureCache.size >= MAX_TEXTURE_CACHE_SIZE) {
    const oldestKey = textureCache.keys().next().value;
    const oldTexture = textureCache.get(oldestKey);
    oldTexture.dispose();
    textureCache.delete(oldestKey);
  }
  const texture = createFn();
  textureCache.set(key, texture);
  return texture;
}
```

#### 2. Level of Detail (LOD) System Missing
**Issue:** Same detail level regardless of camera distance.

**Current Behavior:**
- Full terrain quality mesh rendered at all zoom levels
- All forest trees rendered even when far away
- No LOD for city models

**Recommendation:**
- Implement THREE.LOD for city and unit models
- Dynamic terrain mesh quality based on zoom
- Fade out small details at distance
- Reduce instanced mesh count when zoomed out

**Implementation Suggestion:**
```javascript
const lod = new THREE.LOD();
lod.addLevel(highDetailModel, 0);
lod.addLevel(mediumDetailModel, 500);
lod.addLevel(lowDetailModel, 1500);
scene.add(lod);
```

#### 3. Shadow Map Resolution Management
**Issue:** Fixed 4096x4096 shadow map is expensive.

**Current Code:**
```javascript
const ShadowConfig = Object.freeze({
  MAP_SIZE: 4096,  // Always 4096, regardless of device
  // ...
});
```

**Recommendation:**
- Dynamic shadow map size based on device capability
- Reduce shadow map resolution for mobile devices
- Consider Cascaded Shadow Maps (CSM) for large view distances
- Add toggle for shadow quality in settings

#### 4. Missing Frustum Culling for Scene Objects
**Issue:** Individual models/sprites not culled by frustum.

**Current Code:**
```javascript
maprenderer.frustumCulled = true;  // Only applies to built-in culling
// But many manual sprites/meshes added directly
scene.add(sprite);  // No frustum check
```

**Recommendation:**
- Group sprites by tile for efficient culling
- Use `THREE.Frustum` for manual culling of distant objects
- Consider spatial partitioning (octree/BVH) for large maps

---

### 🟠 MEDIUM PRIORITY

#### 5. Water Shader Performance
**Issue:** Water shader calculates full effects even when water is not visible.

**Current Water Shader:**
```javascript
// Complex caustics, ripples, shimmer calculated for every water pixel
const caustic1 = noise2D(causticU1, causticV1);
const caustic2 = noise2D(causticU2, causticV2);
// ... many more calculations
```

**Recommendation:**
- Add early-out for tiles with no water visibility
- Reduce noise complexity at distance
- Consider simpler water shader for low quality mode
- Use precomputed noise textures instead of procedural noise

#### 6. Animation System Improvements
**Issue:** Animation uses `setInterval()` which is not optimal.

**Current Code:**
```javascript
setInterval(update_map_terrain_geometry, 40);  // ~25 FPS
setInterval(update_map_known_tiles, 15);       // ~66 FPS
```

**Recommendation:**
- Consolidate into main render loop using `deltaTime`
- Remove setInterval calls, use `maprenderer.setAnimationLoop()`
- Implement time-based animations for consistent speed
- Add animation priority system

#### 7. Model Loading Optimization
**Issue:** Sequential model loading blocks rendering.

**Current Code:**
```javascript
for (var i = 0; i < model_filenames_initial.length; i++) {
  load_model(model_filenames_initial[i]);  // Sequential
}
```

**Recommendation:**
- Use `Promise.all()` for parallel model loading
- Add loading priority (units first, decorations last)
- Implement progressive loading feedback
- Consider model compression (already using DRACO, could add KTX2)

**Implementation Suggestion:**
```javascript
async function loadModelsParallel(filenames) {
  const highPriority = ['Settlers', 'Workers', 'Warriors'];
  const lowPriority = filenames.filter(f => !highPriority.includes(f));
  
  await Promise.all(highPriority.map(loadModel));
  webgl_preload_complete(); // Show game early
  await Promise.all(lowPriority.map(loadModel)); // Continue in background
}
```

#### 8. GPU State Changes Reduction
**Issue:** Frequent material switches cause state changes.

**Recommendation:**
- Sort renderables by material before rendering
- Batch sprites by texture atlas
- Use uniform buffer objects for shared parameters
- Consider instanced sprites for labels

#### 9. Hex Edge Rendering Optimization
**Issue:** Hex edge calculation done per-pixel.

**Current Code:**
```javascript
// Per-pixel SDF calculation for hex edges
const dist1 = abs(hexX);
const dist2 = abs(add(mul(hexX, 0.5), mul(hexY, HEX_SQRT3_OVER_2)));
const dist3 = abs(add(mul(hexX, -0.5), mul(hexY, HEX_SQRT3_OVER_2)));
```

**Recommendation:**
- Consider pre-baking hex edge texture overlay
- Use simplified edge function at distance
- Add option to disable hex edges for performance

---

### 🟢 LOW PRIORITY

#### 10. Missing Post-Processing Effects
**Opportunity:** Add optional visual enhancements.

**Suggestions:**
- Bloom effect for cities at night
- SSAO (Screen Space Ambient Occlusion) for depth
- Anti-aliasing improvements (TAA/FXAA as options)
- Color grading for atmosphere

#### 11. Weather/Environmental Effects
**Opportunity:** Add atmosphere to the map.

**Suggestions:**
- Animated clouds/fog layer
- Day/night cycle option
- Rain/snow particle effects on tiles
- Wind effect on trees/water

#### 12. Text Rendering Optimization
**Issue:** Canvas-based text creates many textures.

**Current Code:**
```javascript
var fcanvas = document.createElement("canvas");
// ... draw text ...
texture = new THREE.Texture(fcanvas);
```

**Recommendation:**
- Implement signed distance field (SDF) text
- Use shared font atlas
- Batch city labels by nation

#### 13. Error Handling and Recovery
**Issue:** Limited error handling in shader creation.

**Current Code:**
```javascript
const missing = requiredTSLNames.filter(name => THREE[name] === undefined);
if (missing.length > 0) {
  throw new Error(...);  // Crashes completely
}
```

**Recommendation:**
- Add fallback rendering mode
- Graceful degradation for missing features
- User-friendly error messages
- Error telemetry/logging

#### 14. Profiling and Debug Tools
**Opportunity:** Add developer tools.

**Suggestions:**
- Frame time graph (already has stats option)
- Draw call counter
- Memory usage display
- Shader compilation time logging
- Debug visualization modes (wireframe, normals, UVs)

#### 15. Accessibility Improvements
**Opportunity:** Make renderer more accessible.

**Suggestions:**
- High contrast mode
- Colorblind-friendly terrain colors
- Scalable UI elements
- Keyboard navigation improvements

---

## Performance Benchmarks to Establish

The following benchmarks should be measured before and after optimizations:

| Metric | Current | Target |
|--------|---------|--------|
| Frame Time (60 FPS target) | ? ms | < 16.67 ms |
| Draw Calls per Frame | ? | < 100 |
| Memory Usage (100x100 map) | ? MB | < 500 MB |
| Initial Load Time | ? sec | < 5 sec |
| Terrain Mesh Triangles | ~500K | Maintain |
| Texture Memory | ? MB | < 256 MB |

---

## Implementation Priority Roadmap

### Phase 1: Performance Foundations (High Impact)
1. Implement texture cache with disposal
2. Add dynamic shadow map sizing
3. Consolidate animation loops

### Phase 2: Scalability (Medium Impact)
4. Add LOD system for models
5. Implement frustum culling for sprites
6. Parallel model loading

### Phase 3: Visual Polish (Low Impact)
7. Optional post-processing effects
8. Environmental effects
9. Text rendering improvements

### Phase 4: Developer Experience
10. Profiling and debug tools
11. Error handling improvements
12. Performance testing automation

---

## Conclusion

The FreecivWorld WebGPU renderer is a well-structured implementation that successfully brings the game to modern web browsers. The TSL-based shader system is particularly impressive, providing a complete hexagonal terrain rendering solution with proper fog of war, borders, and infrastructure visualization.

The primary areas for improvement focus on memory management and scalability for larger maps. Implementing texture disposal, LOD systems, and frustum culling would significantly improve performance on a wider range of devices.

The deferred batch update system demonstrates good performance awareness, and extending this pattern to other areas (model loading, GPU state management) would further enhance the renderer's efficiency.

---

## References

- [Three.js WebGPU Documentation](https://threejs.org/docs/#api/en/renderers/WebGPURenderer)
- [TSL (Three.js Shading Language)](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)
- [Red Blob Games: Hexagonal Grids](https://www.redblobgames.com/grids/hexagons/)
- [WebGPU Best Practices](https://toji.dev/webgpu-best-practices/)

---

*This document is intended as a technical reference for future development efforts. All recommendations should be validated with profiling data before implementation.*
