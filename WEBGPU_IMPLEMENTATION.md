# WebGPU Renderer Support

## Overview

This implementation adds WebGPU renderer support to Freeciv 3D, providing an alternative to the existing WebGL renderer. WebGPU is the next-generation graphics API for the web, offering better performance and more modern features.

## Changes Made

### 1. Pregame Settings Dialog (`pregame_freeciv_server.js`)

- Added a new `renderer_type` global variable to track the selected renderer ("webgl" or "webgpu")
- Added a dropdown menu in the 3D WebGL settings tab to allow users to choose between WebGL and WebGPU
- Implemented storage/retrieval of the renderer preference using `simpleStorage`
- The setting persists across sessions and triggers a page reload when changed

### 2. Renderer Initialization (`webgl/renderer_init.js`)

- Modified `init_webgl_renderer()` to check for WebGPU support and fall back to WebGL if unavailable
- Updated `renderer_init()` to conditionally initialize either WebGL or WebGPU renderer based on user preference
- Added WebGPU availability detection using `navigator.gpu` API
- Maintains backward compatibility with existing WebGL implementation

### 3. WebGPU Renderer (`webgl/mapview_webgpu.js`)

New file implementing WebGPU-specific rendering:

- `webgpu_start_renderer()`: Initializes the WebGPU renderer with Three.js WebGPURenderer
- `init_webgpu_mapview()`: Sets up the map view using Three.js Shading Language (TSL) node materials
- Uses `MeshBasicNodeMaterial` for WebGPU-compatible materials
- **Loads and applies the TSL terrain shader** from `terrain_shader_webgpu.js`
- Implements the same scene structure as WebGL but with WebGPU-compatible components
- Note: Anaglyph 3D is currently disabled for WebGPU (logged as not yet supported)

### 4. WebGPU Terrain Shader (`webgl/terrain_shader_webgpu.js`)

**NEW FILE**: Complete TSL (Three.js Shading Language) shader implementation for terrain rendering.

**Key Features**:
- **Full terrain type support**: Grassland, plains, desert, hills, mountains, swamp, coast, ocean, arctic, forest, jungle, tundra
- **Height-based blending**: Smooth transitions between terrain and coast based on elevation
- **Texture sampling**: Random offset for visual variety, proper UV coordinate mapping
- **Border rendering**: Conditional border overlay when enabled in game settings
- **Vertex color support**: For fog of war and tile visibility
- **TSL node system**: Uses Three.js node-based shader construction for WebGPU compatibility

**Shader Architecture**:
- Defines terrain type constants matching the GLSL shader
- Creates texture nodes for all terrain types
- Implements conditional terrain selection using TSL `mix()` and `step()` functions
- Calculates texture coordinates with proper tiling
- Applies beach/coast blending based on terrain height
- Combines all terrain layers into final color output

**Performance**:
- Compiled to WGSL (WebGPU Shading Language) at runtime
- Optimized texture sampling with minimal overdraw
- Efficient conditional rendering using step functions

### 5. Module Loading (`three-modules.js`)

- Added asynchronous loading of WebGPU modules when WebGPU is supported
- Dynamically imports `three.webgpu.min.js` and `three.tsl.min.js` from the webgpu libs directory
- Extends the THREE namespace with WebGPU-specific classes
- Gracefully handles cases where WebGPU is not available
- Uses an IIFE (Immediately Invoked Function Expression) to handle async imports

## How It Works

1. **User Selection**: Users can select their preferred renderer in the pregame settings dialog under the "3D WebGL" tab
2. **Detection**: The system checks if WebGPU is supported using `navigator.gpu`
3. **Fallback**: If WebGPU is selected but not available, the system automatically falls back to WebGL
4. **Initialization**: Based on the selection, either `webgl_start_renderer()` or `webgpu_start_renderer()` is called
5. **Rendering**: The appropriate renderer handles all 3D rendering operations

## Browser Support

WebGPU is currently supported in:
- Chrome/Edge 113+ (enabled by default)
- Firefox (behind flag `dom.webgpu.enabled`)
- Safari Technology Preview

The implementation automatically detects support and falls back to WebGL when WebGPU is unavailable.

## Testing

To test the WebGPU renderer:

1. Build the project: `mvn clean compile` (requires Java 21)
2. Navigate to: `target/freeciv-web/freeciv-web-standalone.html`
3. Serve the files with a local HTTP server
4. Open the standalone page in a WebGPU-compatible browser
5. Check the pregame settings to select WebGPU renderer
6. Reload the page to apply the change

## Known Limitations

1. **Road/Railroad Rendering**: Not yet implemented in TSL shader (planned for future)
2. **Anaglyph 3D**: Not supported with WebGPU renderer
3. **Browser Support**: Limited to browsers with WebGPU support
4. **Shader Complexity**: Some advanced GLSL features may need additional TSL conversion

## Recent Fixes (2026-02-03)

### WebGPU Lighting and Material System

Fixed critical issues with WebGPU renderer that caused units and 3D models to appear completely black:

1. **Multiple Three.js Instance Warning**: 
   - **Problem**: Importing Three.js WebGPU module directly caused duplicate Three.js core imports
   - **Solution**: Changed import to use the importmap path `'three/webgpu'` instead of direct file path
   - **File**: `three-modules-webgpu.js`

2. **Light Nodes Not Found Error**:
   - **Problem**: WebGPU TSL (Three.js Shading Language) requires lights to be converted to light nodes
   - **Solution**: 
     - Added lights array to `scene.userData.lightsArray` for sharing with materials
     - Exported TSL `lights()` function to global THREE object
     - Convert model materials to `MeshStandardNodeMaterial` with `lightsNode` when using WebGPU
   - **Files**: `mapview_webgpu.js`, `three-modules-webgpu.js`, `preload.js`

3. **Model Material Conversion**:
   - **Problem**: GLTF models use standard materials that aren't compatible with WebGPU node system
   - **Solution**: In `webgl_get_model()`, detect WebGPU renderer and convert materials to `MeshStandardNodeMaterial` with proper lighting nodes
   - **File**: `preload.js`

These fixes ensure that all 3D models (units, cities, buildings) are properly lit in WebGPU mode while maintaining backward compatibility with WebGL renderer.

### WebGPU TSL Function Exports (2026-02-03 Update)

Fixed additional errors after initial WebGPU implementation:

1. **Missing TSL Functions Error**:
   - **Problem**: Custom terrain shader (`createTerrainShaderTSL`) was trying to destructure TSL functions from THREE that weren't exported, causing `TypeError: e is not a function`
   - **Solution**: Extended the TSL functions export list in `three-modules-webgpu.js` to include all required functions:
     - Vertex shader functions: `positionLocal`, `attribute`, `uv`
     - Math/blending functions: `mix`, `step`, `floor`, `fract`, `mod`, `dot`, `sin`
     - Arithmetic operators: `mul`, `add`, `sub`, `div`
   - **File**: `three-modules-webgpu.js`

2. **TSL Functions Organization**:
   - Organized TSL function exports with inline comments grouping related functions by category
   - Improved code maintainability and developer understanding of function purposes

## Future Enhancements

1. Add road and railroad rendering to TSL shader
2. Implement mouse-over highlighting in shader
3. Add WebGPU-specific optimizations
4. Implement compute shaders for advanced effects
5. Add Anaglyph 3D support for WebGPU
6. Enhance visual effects using WebGPU-specific features
7. Performance benchmarking comparison between WebGL and WebGPU

## Files Modified

- `freeciv-web/src/main/webapp/javascript/pregame_freeciv_server.js`
- `freeciv-web/src/main/webapp/javascript/webgl/renderer_init.js`
- `freeciv-web/src/main/webapp/javascript/three-modules.js`
- `freeciv-web/src/main/webapp/javascript/three-modules-webgpu.js` (2026-02-03: Fixed import path and TSL exports)
- `freeciv-web/src/main/webapp/javascript/webgl/mapview_webgpu.js` (2026-02-03: Added lights array storage)
- `freeciv-web/src/main/webapp/javascript/webgl/preload.js` (2026-02-03: Added material conversion for WebGPU)

## Files Added

- `freeciv-web/src/main/webapp/javascript/webgl/mapview_webgpu.js` - WebGPU renderer initialization
- `freeciv-web/src/main/webapp/javascript/webgl/terrain_shader_webgpu.js` - TSL terrain shader

## Build Configuration

The build process automatically includes the new files in the minified JavaScript bundle (`webclient-app.min.js`) through the existing `webgl/*.js` include pattern in `pom.xml`.
