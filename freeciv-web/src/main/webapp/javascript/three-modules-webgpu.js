/**
 * Three.js WebGPU Module Loader
 * 
 * Loads Three.js WebGPU-specific modules for the Freeciv-web application.
 * This file is loaded dynamically when WebGPU renderer is selected.
 * 
 * This is separate from three-modules.js to avoid loading WebGPU modules
 * when they're not needed and to prevent module conflicts.
 */

// Import WebGPU renderer and related modules
import { WebGPURenderer, MeshBasicNodeMaterial } from 'three/webgpu';
// Import TSL (Three.js Shading Language) module
import * as TSL from '/javascript/webgpu/libs/threejs/three.tsl.min.js';

// Get the existing THREE object from window (already loaded by three-modules.js)
const THREE = window.THREE;

if (!THREE) {
  const errorMsg = 'THREE not found! Ensure <script type="module" src="/javascript/three-modules.js"> appears before three-modules-webgpu.js in your HTML.';
  console.error(errorMsg);
  throw new Error(errorMsg);
}

// Add WebGPU-specific exports to the global THREE object
THREE.WebGPURenderer = WebGPURenderer;
THREE.MeshBasicNodeMaterial = MeshBasicNodeMaterial;

// Add all TSL exports to THREE
Object.assign(THREE, TSL);

console.log('WebGPU modules loaded successfully');

export { WebGPURenderer, MeshBasicNodeMaterial, TSL };
