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

// Extract the WebGPU exports and add them to the global THREE object
// The WebGPU module extends the existing THREE namespace and includes TSL
if (WebGPUModule.WebGPURenderer) {
  THREE.WebGPURenderer = WebGPUModule.WebGPURenderer;
}
if (WebGPUModule.MeshBasicNodeMaterial) {
  THREE.MeshBasicNodeMaterial = WebGPUModule.MeshBasicNodeMaterial;
}
if (WebGPUModule.MeshStandardNodeMaterial) {
  THREE.MeshStandardNodeMaterial = WebGPUModule.MeshStandardNodeMaterial;
}

// Export TSL (Three.js Shading Language) functions to THREE
// The WebGPU module includes TSL which provides the lighting and shader functions needed for WebGPU
// We export commonly used TSL functions to the global THREE object for use in custom shaders
const tslFunctions = [
  // Lighting and material functions
  'lights', 'uniform', 'texture', 'color',
  // Vector constructors
  'vec2', 'vec3', 'vec4', 'float',
  // Vertex shader functions
  'positionLocal', 'attribute', 'uv',
  // Math and blending functions
  'mix', 'step', 'floor', 'fract', 'mod', 'dot', 'sin',
  // Arithmetic operators
  'mul', 'add', 'sub', 'div'
];
tslFunctions.forEach(fn => {
  if (WebGPUModule[fn]) {
    THREE[fn] = WebGPUModule[fn];
  }
});

console.log('WebGPU modules loaded successfully');

export { WebGPUModule };
