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

// First, import TSL directly from the WebGPU module to ensure availability
// This provides a fallback if direct tsl imports don't work
import { TSL } from 'three/webgpu';

import {
  // Lighting and material functions
  lights, uniform, texture, color,
  // Vector constructors
  vec2, vec3, vec4, float as floatFn,
  // Vertex shader functions
  positionLocal, normalLocal, attribute, uv,
  // Math and blending functions
  mix, step, floor, fract, mod, dot, sin, cos, normalize, max, min, pow, clamp, abs, sqrt,
  // Arithmetic operators
  mul, add, sub, div,
  // Reflection and refraction functions (used by path tracer for water and metal surfaces)
  reflect, refract,
  // Camera-related nodes (needed for path tracer ray generation)
  cameraPosition, cameraProjectionMatrixInverse, cameraViewMatrix, cameraWorldMatrix,
  // TSL control flow and function definition (needed for path tracer)
  Fn, If, Loop, Break, Return,
  // Additional math functions for path tracing
  cross, length, negate, exp, sign,
  // Comparison and logical operators
  lessThan, greaterThan, equal, and, or, not, select
} from 'three/tsl';

// Fallback to TSL object if any imports are undefined
// This handles edge cases where the three/tsl module might not properly re-export everything
const _reflect = reflect !== undefined ? reflect : TSL?.reflect;
const _refract = refract !== undefined ? refract : TSL?.refract;
const _Fn = Fn !== undefined ? Fn : TSL?.Fn;
const _If = If !== undefined ? If : TSL?.If;
const _Loop = Loop !== undefined ? Loop : TSL?.Loop;
const _Break = Break !== undefined ? Break : TSL?.Break;
const _Return = Return !== undefined ? Return : TSL?.Return;
const _cross = cross !== undefined ? cross : TSL?.cross;
const _length = length !== undefined ? length : TSL?.length;
const _negate = negate !== undefined ? negate : TSL?.negate;
const _exp = exp !== undefined ? exp : TSL?.exp;
const _sign = sign !== undefined ? sign : TSL?.sign;
// Note: atan2 and log are not exported from three/tsl directly, so we only use TSL object fallback
const _atan2 = TSL?.atan2;
const _log = TSL?.log;

// Log if any fallbacks were used (for debugging)
const tslFallbacksUsed = [
  ['reflect', reflect, _reflect],
  ['refract', refract, _refract],
  ['Fn', Fn, _Fn],
  ['If', If, _If],
  ['Loop', Loop, _Loop],
  ['Break', Break, _Break],
  ['Return', Return, _Return],
  ['cross', cross, _cross],
  ['length', length, _length],
  ['negate', negate, _negate],
  ['exp', exp, _exp],
  ['sign', sign, _sign]
].filter(([name, original, fallback]) => original === undefined && fallback !== undefined)
 .map(([name]) => name);

if (tslFallbacksUsed.length > 0) {
  console.log('WebGPU TSL: Used fallbacks from TSL object for:', tslFallbacksUsed.join(', '));
}

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
if (WebGPUModule.AmbientLight) {
  THREE.AmbientLight = WebGPUModule.AmbientLight;
}
if (WebGPUModule.DirectionalLight) {
  THREE.DirectionalLight = WebGPUModule.DirectionalLight;
}
if (WebGPUModule.SpotLight) {
  THREE.SpotLight = WebGPUModule.SpotLight;
}
if (WebGPUModule.PointLight) {
  THREE.PointLight = WebGPUModule.PointLight;
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
THREE.normalLocal = normalLocal;
THREE.attribute = attribute;
THREE.uv = uv;
THREE.mix = mix;
THREE.step = step;
THREE.floor = floor;
THREE.fract = fract;
THREE.mod = mod;
THREE.dot = dot;
THREE.sin = sin;
THREE.cos = cos;
THREE.normalize = normalize;
THREE.max = max;
THREE.min = min;
THREE.pow = pow;
THREE.clamp = clamp;
THREE.abs = abs;
THREE.sqrt = sqrt;
THREE.mul = mul;
THREE.add = add;
THREE.sub = sub;
THREE.div = div;
THREE.reflect = _reflect;
THREE.refract = _refract;
THREE.cameraPosition = cameraPosition;
THREE.cameraProjectionMatrixInverse = cameraProjectionMatrixInverse;
THREE.cameraViewMatrix = cameraViewMatrix;
THREE.cameraWorldMatrix = cameraWorldMatrix;

// TSL control flow and function definition (needed for path tracer)
THREE.Fn = _Fn;
THREE.If = _If;
THREE.Loop = _Loop;
THREE.Break = _Break;
THREE.Return = _Return;

// Additional math functions for path tracing
THREE.cross = _cross;
THREE.length = _length;
THREE.negate = _negate;
THREE.atan2 = _atan2;
THREE.exp = _exp;
THREE.log = _log;
THREE.sign = _sign;

// Comparison and logical operators
THREE.lessThan = lessThan;
THREE.greaterThan = greaterThan;
THREE.equal = equal;
THREE.and = and;
THREE.or = or;
THREE.not = not;
THREE.select = select;

console.log('WebGPU modules loaded successfully');

export { WebGPUModule };
