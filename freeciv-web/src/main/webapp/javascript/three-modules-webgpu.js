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
// Note: We import from the local three.webgpu.min.js which contains WebGPU extensions
// This file expects THREE to already be defined globally
import * as WebGPUModule from '/javascript/webgpu/libs/threejs/three.webgpu.min.js';

// Import TSL (Three.js Shading Language) module  
import * as TSL from '/javascript/webgpu/libs/threejs/three.tsl.min.js';

// Extract the WebGPU exports and add them to the global THREE object
// The WebGPU module extends the existing THREE namespace
if (WebGPUModule.WebGPURenderer) {
  THREE.WebGPURenderer = WebGPUModule.WebGPURenderer;
}
if (WebGPUModule.MeshBasicNodeMaterial) {
  THREE.MeshBasicNodeMaterial = WebGPUModule.MeshBasicNodeMaterial;
}
if (WebGPUModule.MeshStandardNodeMaterial) {
  THREE.MeshStandardNodeMaterial = WebGPUModule.MeshStandardNodeMaterial;
}

// Add all TSL exports to THREE
Object.assign(THREE, TSL);

console.log('WebGPU modules loaded successfully');

export { WebGPUModule, TSL };
