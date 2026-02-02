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
- Implements the same scene structure as WebGL but with WebGPU-compatible components
- Note: Anaglyph 3D is currently disabled for WebGPU (logged as not yet supported)

### 4. Module Loading (`three-modules.js`)

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

1. **Anaglyph 3D**: Not yet supported with WebGPU renderer
2. **Shader Implementation**: Currently uses basic node materials; full terrain shader conversion to TSL is planned for future enhancement
3. **Browser Support**: Limited to browsers with WebGPU support

## Future Enhancements

1. Implement complete terrain shaders using Three.js Shading Language (TSL)
2. Add WebGPU-specific optimizations
3. Implement compute shaders for advanced effects
4. Add Anaglyph 3D support for WebGPU
5. Enhance visual effects using WebGPU-specific features

## Files Modified

- `freeciv-web/src/main/webapp/javascript/pregame_freeciv_server.js`
- `freeciv-web/src/main/webapp/javascript/webgl/renderer_init.js`
- `freeciv-web/src/main/webapp/javascript/three-modules.js`

## Files Added

- `freeciv-web/src/main/webapp/javascript/webgl/mapview_webgpu.js`

## Build Configuration

The build process automatically includes the new `mapview_webgpu.js` file in the minified JavaScript bundle (`webclient-app.min.js`) through the existing `webgl/*.js` include pattern in `pom.xml`.
