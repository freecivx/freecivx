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

// Import TSL (Three.js Shading Language) functions from the TSL module
// The TSL module contains shader node functions needed for WebGPU materials
// Note: 'float' is imported as 'floatFn' because 'float' is a reserved word in JavaScript
import {
  // Lighting and material functions
  lights, uniform, texture, color,
  // Vector constructors
  vec2, vec3, vec4, float as floatFn,
  // Vertex shader functions
  positionLocal, attribute, uv,
  // Math and blending functions
  mix, step, floor, fract, mod, dot, sin,
  // Arithmetic operators
  mul, add, sub, div
} from 'three/tsl';

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
// The TSL module provides shader node functions needed for WebGPU materials
// We export commonly used TSL functions to the global THREE object for use in custom shaders
THREE.lights = lights;
THREE.uniform = uniform;
THREE.texture = texture;
THREE.color = color;
THREE.vec2 = vec2;
THREE.vec3 = vec3;
THREE.vec4 = vec4;
// Note: 'float' is exported from the imported 'floatFn' to avoid using reserved word
THREE.float = floatFn;
THREE.positionLocal = positionLocal;
THREE.attribute = attribute;
THREE.uv = uv;
THREE.mix = mix;
THREE.step = step;
THREE.floor = floor;
THREE.fract = fract;
THREE.mod = mod;
THREE.dot = dot;
THREE.sin = sin;
THREE.mul = mul;
THREE.add = add;
THREE.sub = sub;
THREE.div = div;

console.log('WebGPU modules loaded successfully');

export { WebGPUModule };
