# WebGPU Terrain Shader Implementation

## Overview

This document explains the WebGPU terrain shader implementation using Three.js Shading Language (TSL).

## Architecture

### Three.js Shading Language (TSL)

TSL is a node-based shader system in Three.js that compiles to WGSL (WebGPU Shading Language) at runtime. Instead of writing raw GLSL or WGSL code, shaders are constructed using JavaScript functions that create shader nodes.

**Benefits**:
- **Type-safe**: Compile-time checking in JavaScript
- **Cross-platform**: Works with both WebGL and WebGPU
- **Composable**: Easy to combine and reuse shader logic
- **Modern**: Built for WebGPU from the ground up

### Shader Structure

The terrain shader (`terrain_shader_webgpu.js`) is organized as follows:

```
createTerrainShaderTSL(uniforms)
├── Import TSL functions from THREE
├── Define terrain type constants
├── Create uniform nodes (textures, values)
├── Sample textures (terrain types, borders, roads)
├── Calculate texture coordinates
├── Select terrain based on type
├── Apply height-based blending
├── Combine all layers
└── Return final color node
```

## Shader Features

### 1. Terrain Type Support

The shader supports all Freeciv terrain types:

- **Inaccessible** (0) - Black/invisible tiles
- **Lake** (10) - Inland water bodies
- **Coast** (20) - Shallow water near land
- **Ocean/Floor** (30) - Deep ocean
- **Arctic/Tundra** (40) - Snow-covered terrain
- **Desert** (50) - Sandy desert
- **Forest** (60) - Forested grassland
- **Grassland** (70) - Base grass terrain
- **Hills** (80) - Elevated terrain
- **Jungle** (90) - Dense vegetation
- **Mountains** (100) - High elevation peaks
- **Plains** (110) - Flat farmland
- **Swamp** (120) - Wetlands

### 2. Height-Based Blending

Terrain automatically transitions to coastal texture based on elevation:

```javascript
const BEACH_HIGH = 50.9;
const BEACH_BLEND_HIGH = 50.4;
```

When `posY < BEACH_BLEND_HIGH`, terrain blends with coast texture, creating realistic shorelines.

### 3. Texture Sampling

**Random Offset**: Adds visual variety by slightly offsetting UV coordinates per tile
```javascript
const rnd = fract(mul(sin(dot(uvNode, vec2(12.98, 78.233))), 43758.5453));
const rndOffset = mul(sub(rnd, 0.5), div(1.0, mul(8.0, vec2(map_x_size, map_y_size))));
```

**Coordinate Calculation**:
- `dx, dy`: Standard tile coordinates
- `tdx, tdy`: Half-tile coordinates for arctic terrain

### 4. TSL Node System

The shader uses TSL node functions to build the shader graph:

| TSL Function | Purpose |
|--------------|---------|
| `texture()` | Sample a texture |
| `uniform()` | Define a uniform value |
| `uv()` | Get UV coordinates |
| `positionLocal` | Get vertex position |
| `mix()` | Blend two values |
| `step()` | Conditional selection |
| `floor()` | Round down |
| `fract()` | Get fractional part |
| `mul()`, `add()`, `sub()`, `div()` | Math operations |

### 5. Terrain Selection Logic

Each terrain type uses a combination of `step()` and `mix()`:

```javascript
// Check if current terrain is grassland (value ~70)
const isGrassland = step(TERRAIN_GRASSLAND - 0.5, terrainHere)
                    .mul(step(terrainHere, TERRAIN_GRASSLAND + 0.5));

// Select grassland or coast based on height
const grasslandColor = mix(
    coastNode.uv(texCoord),
    grasslandNode.uv(texCoord),
    step(BEACH_BLEND_HIGH, posY)
);

// Mix into final color if this is grassland
finalColor = mix(finalColor, grasslandColor, isGrassland);
```

## Conversion from GLSL

The original WebGL shader uses GLSL. Here's how key patterns were converted to TSL:

### GLSL Conditional
```glsl
if (terrain_here == terrain_grassland) {
    if (vPosition.y > beach_blend_high) {
        terrain_color = texture(grassland, vec2(dx, dy));
    } else {
        terrain_color = texture(coast, vec2(dx, dy));
    }
}
```

### TSL Equivalent
```javascript
const isGrassland = step(TERRAIN_GRASSLAND - 0.5, terrainHere)
                    .mul(step(terrainHere, TERRAIN_GRASSLAND + 0.5));
const grasslandColor = mix(
    coastNode.uv(texCoord),
    grasslandNode.uv(texCoord),
    step(BEACH_BLEND_HIGH, posY)
);
finalColor = mix(finalColor, grasslandColor, isGrassland);
```

### Why This Works

- `step(a, b)` returns 1 if `b >= a`, else 0
- Multiplying two `step()` results creates an AND condition
- `mix(a, b, t)` returns `a` when `t=0`, `b` when `t=1`
- This creates branch-less, GPU-friendly code

## Performance Considerations

### Optimizations

1. **Branch-less execution**: Uses `step()` and `mix()` instead of if/else
2. **Texture batching**: All terrain textures loaded once
3. **Efficient UV calculation**: Minimal math operations
4. **No dynamic loops**: All terrain types checked in parallel

### Trade-offs

- **All terrain paths execute**: Every terrain type is evaluated, but only the matching one is selected
- **Memory usage**: All terrain textures must be loaded
- **Compilation time**: TSL must compile to WGSL on initialization

## Current Limitations

### Not Yet Implemented

1. **Roads and Railroads**: Sprite-based road rendering
2. **Mouse Highlighting**: Interactive tile selection
3. **Tile Grid**: Debug grid overlay
4. **River Detection**: Special handling for river tiles

### Planned Additions

These features from the GLSL shader will be added in future updates:

```javascript
// Road rendering (roadtype_1 through roadtype_9)
// Railroad rendering (roadtype_10 through roadtype_19)
// Mouse position highlighting
// Selected tile highlighting
// Tile grid rendering for debugging
```

## Testing

### Verification Checklist

- [x] Shader compiles without errors
- [x] Included in minified build
- [x] All terrain types defined
- [x] Height blending implemented
- [x] Border rendering support
- [x] Vertex color support (fog of war)
- [ ] Visual comparison with WebGL (requires browser testing)
- [ ] Performance benchmarking

### Manual Testing

To test the shader in a browser:

1. Build: `mvn clean compile`
2. Serve: `cd target/freeciv-web && python3 -m http.server 8080`
3. Open: http://localhost:8080/freeciv-web-standalone.html
4. Settings: Select "WebGPU (Experimental)" renderer
5. Verify: Terrain renders correctly with proper textures

## Troubleshooting

### Common Issues

**Issue**: "WebGPU not supported"
**Solution**: Use Chrome 113+ or enable WebGPU in browser flags

**Issue**: "Cannot read property 'texture' of undefined"
**Solution**: Ensure Three.js WebGPU modules are loaded (check console)

**Issue**: "Black screen with WebGPU"
**Solution**: Check browser console for shader compilation errors

**Issue**: "Terrain not rendering"
**Solution**: Verify all texture uniforms are properly loaded

## Future Enhancements

### Planned Features

1. **Complete road/railroad rendering** using TSL sprite sampling
2. **Interactive highlighting** for mouse-over and selected tiles
3. **Advanced blending** for smoother terrain transitions
4. **Compute shader integration** for procedural terrain effects
5. **Performance profiling** and optimization

### Research Areas

- **WGSL direct export**: Bypass TSL for maximum performance
- **Texture arrays**: More efficient texture management
- **Bindless textures**: Reduce uniform count
- **Mesh shaders**: Advanced terrain LOD

## References

- [Three.js WebGPU Documentation](https://threejs.org/docs/#api/en/renderers/WebGPURenderer)
- [Three.js Node System](https://threejs.org/docs/#api/en/nodes/Nodes)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [WGSL Specification](https://www.w3.org/TR/WGSL/)

## Authors

- Implementation: GitHub Copilot Agent
- Original GLSL shader: Freeciv-web project
- Three.js WebGPU: Three.js contributors
