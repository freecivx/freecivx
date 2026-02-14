/**
 * Three.js WebGPU Module Loader
 * 
 * Loads Three.js WebGPU-specific modules for the Freeciv-web application.
 * This file is loaded dynamically when WebGPU renderer is selected.
 * 
 * This is separate from three-modules.js to avoid loading WebGPU modules
 * when they're not needed and to prevent module conflicts.
 * 
 * IMPORTANT: This file reuses the THREE instance from three-modules.js to avoid
 * duplicate imports that cause "Multiple instances of Three.js being imported" warnings.
 * We import WebGPU modules directly from local files rather than using the 'three/webgpu' 
 * import path to prevent creating a second instance of Three.js core.
 */

// Get the existing THREE object from window (already loaded by three-modules.js)
const THREE = window.THREE;

if (!THREE) {
  const errorMsg = 'THREE not found! Ensure <script type="module" src="/javascript/three-modules.js"> appears before three-modules-webgpu.js in your HTML.';
  console.error(errorMsg);
  throw new Error(errorMsg);
}

// Import WebGPU-specific classes directly from the WebGPU bundle
// IMPORTANT: We use the 'three/webgpu' import path from the importmap to avoid
// creating multiple Three.js instances. The importmap resolves this to our local file.
import * as WebGPUModule from 'three/webgpu';

// Import TSL (Three.js Shading Language) module for shader node functions
// TSL provides a comprehensive set of functions needed for WebGPU materials
import * as TSL from 'three/tsl';

// WebGPU classes to bulk-add to THREE
// These are the core WebGPU renderer and material classes needed for 3D rendering
const webGpuKeys = [
  'WebGPURenderer', 'MeshBasicNodeMaterial', 'MeshStandardNodeMaterial',
  'AmbientLight', 'DirectionalLight', 'SpotLight', 'PointLight'
];

// Bulk-add WebGPU classes to THREE namespace
webGpuKeys.forEach(key => {
  if (WebGPUModule[key]) {
    THREE[key] = WebGPUModule[key];
  }
});

// Bulk-add all TSL functions to THREE namespace
// This replaces the massive list of manual assignments and handles all available exports automatically
Object.keys(TSL).forEach(key => {
  THREE[key] = TSL[key];
});

console.log('WebGPU & TSL modules bridged to THREE successfully');

export { WebGPUModule };
