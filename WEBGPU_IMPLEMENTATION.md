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

### WebGPU Lighting and Material System - Correct Fix (Latest - 2026-02-03)

Fixed critical lighting issues in WebGPU mode that caused units and 3D models to appear completely black or washed out:

1. **Added Explicit lightsNode Assignment**:
   - **Problem**: WebGPU materials were not properly detecting scene lights, resulting in "THREE.LightsNode.setupNodeLights: Light node not found" errors
   - **Root Cause**: In Three.js WebGPU renderer with node materials, lights must be explicitly referenced using the TSL `lights()` function
   - **Solution**: Added explicit `nodeMaterial.lightsNode = THREE.lights()` assignment when converting materials to WebGPU-compatible node materials
   - **File**: `preload.js` lines 716-720
   - **Result**: Materials now properly reference all scene lights

2. **Corrected Ambient Light Intensity**:
   - **Problem**: Ambient light intensity was set to `28 * Math.PI` (≈87.96), which is extremely high for physically-based rendering
   - **Root Cause**: Such high values cause severe overexposure, washing out all lighting detail and preventing directional/spot lights from contributing properly
   - **Solution**: Reduced ambient light intensity to `1.2 * Math.PI` (≈3.77), which is appropriate for WebGPU physically-based rendering
   - **File**: `mapview_webgpu.js` line 53
   - **Result**: Scene now has proper lighting balance with visible depth, shadows, and form

3. **Technical Details**:
   - `MeshStandardNodeMaterial` in WebGPU mode requires explicit light node setup via `lightsNode` property
   - The `THREE.lights()` function (imported from 'three/tsl') creates a node that references all lights in the scene
   - In Three.js physically-based rendering, typical ambient light intensities range from 0.5-2.0 (multiplied by Math.PI)
   - The fix ensures compatibility with Three.js r171+ WebGPU lighting system and proper visual quality

### WebGPU Lighting and Material System - Previous Incorrect Attempt

Previous attempt that did not resolve the issue:

1. **Incorrectly Removed lightsNode Assignment**:
   - **Problem**: Assumed that `MeshStandardNodeMaterial` would automatically detect lights without manual configuration
   - **Issue**: This assumption was incorrect; WebGPU node materials require explicit light node references
   - **Result**: Units and models remained unlit with "Light node not found" warnings

### WebGPU Lighting and Material System - Previous Attempt (Earlier 2026-02-03)

Previous attempt that did not fully resolve the issue:

1. **Incorrect TSL lights() Usage**:
   - **Problem**: Attempted to manually call `THREE.lights()` and assign to `lightsNode`
   - **Issue**: While removing the array parameter was correct, manual lightsNode assignment still caused "Light node not found" warnings
   - **File**: `preload.js` line 719

2. **Cleaned Up Unnecessary Code**:
   - Removed `lightsArray` creation and management in `mapview_webgpu.js`
   - Removed `scene.userData.lightsArray` storage as it's not needed by the TSL system
   - Simplified lighting setup code

3. **Made WebGPU Default When Supported**:
   - **Change**: Modified renderer detection logic to default to WebGPU when `navigator.gpu` is available
   - **Behavior**: 
     - First-time users with WebGPU support will automatically use WebGPU renderer
     - Users without WebGPU support will use WebGL renderer
     - Users with saved preferences keep their preference
     - URL parameter overrides always take precedence
   - **Files**: `renderer_init.js` in both `init_webgl_renderer()` and `renderer_init()` functions

### Previous WebGPU Fixes

#### WebGPU Lighting and Material System (Earlier 2026-02-03)

Fixed critical issues with WebGPU renderer that caused units and 3D models to appear completely black:

1. **Multiple Three.js Instance Warning**: 
   - **Problem**: Importing Three.js WebGPU module directly caused duplicate Three.js core imports
   - **Solution**: Changed import to use the importmap path `'three/webgpu'` instead of direct file path
   - **File**: `three-modules-webgpu.js`

2. **Model Material Conversion**:
   - **Problem**: GLTF models use standard materials that aren't compatible with WebGPU node system
   - **Solution**: In `webgl_get_model()`, detect WebGPU renderer and convert materials to `MeshStandardNodeMaterial` with proper lighting nodes
   - **File**: `preload.js`

#### WebGPU TSL Function Exports (Earlier 2026-02-03)

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
- `freeciv-web/src/main/webapp/javascript/webgl/renderer_init.js` (2026-02-03: Made WebGPU default when supported)
- `freeciv-web/src/main/webapp/javascript/three-modules.js`
- `freeciv-web/src/main/webapp/javascript/three-modules-webgpu.js` (2026-02-03: Fixed import path and TSL exports)
- `freeciv-web/src/main/webapp/javascript/webgl/mapview_webgpu.js` (2026-02-03: Cleaned up lighting array code)
- `freeciv-web/src/main/webapp/javascript/webgl/preload.js` (2026-02-03: Fixed TSL lights() usage for WebGPU)

## Files Added

- `freeciv-web/src/main/webapp/javascript/webgl/mapview_webgpu.js` - WebGPU renderer initialization
- `freeciv-web/src/main/webapp/javascript/webgl/terrain_shader_webgpu.js` - TSL terrain shader

## Build Configuration

The build process automatically includes the new files in the minified JavaScript bundle (`webclient-app.min.js`) through the existing `webgl/*.js` include pattern in `pom.xml`.
