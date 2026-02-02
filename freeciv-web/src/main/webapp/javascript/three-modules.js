/**
 * Three.js Module Loader
 * 
 * Centralizes all Three.js imports for the Freeciv-web application.
 * This file is loaded with a timestamp parameter in index.jsp for cache-busting.
 * 
 * Note: The imports below do not include timestamp parameters because:
 * 1. This is a static .js file that cannot access JSP template variables
 * 2. The timestamp on the script tag loading this file provides cache-busting
 * 3. ES6 modules have their own caching handled by the browser
 * 4. This pattern prepares for future Vite build integration where imports are bundled
 */

import * as THREEModule from 'three';
import { GLTFLoader } from '/javascript/webgl/libs/GLTFLoader.js';
import { DRACOLoader } from '/javascript/webgl/libs/DRACOLoader.js';
import { OrbitControls } from '/javascript/webgl/libs/OrbitControls.js';
import { AnaglyphEffect } from '/javascript/webgl/effects/AnaglyphEffect.js';

// Create a mutable copy of THREE for potential extensions
// ES6 module namespace objects are frozen, so we need a mutable copy
// Note: This is a shallow copy - nested objects are copied by reference
const THREE = { ...THREEModule };

// Export to global window object for compatibility with existing code
window.THREE = THREE;
window.GLTFLoader = GLTFLoader;
window.DRACOLoader = DRACOLoader;
window.OrbitControls = OrbitControls;
window.AnaglyphEffect = AnaglyphEffect;

// WebGPU loading function
// This dynamically imports the WebGPU module loader when needed
let webgpuLoadingPromise = null;

function loadWebGPUSupport() {
  // Return cached promise if already loading
  if (webgpuLoadingPromise) {
    return webgpuLoadingPromise;
  }
  
  // Check if WebGPU is supported
  if (typeof navigator !== 'undefined' && navigator.gpu) {
    webgpuLoadingPromise = (async () => {
      try {
        // Import the WebGPU module loader
        await import('/javascript/three-modules-webgpu.js');
        console.log('WebGPU support loaded successfully');
        return true;
      } catch (error) {
        console.log('WebGPU modules not available, using WebGL only:', error);
        return false;
      }
    })();
  } else {
    // WebGPU not supported by browser
    console.log('WebGPU not supported by browser, using WebGL only');
    webgpuLoadingPromise = Promise.resolve(false);
  }
  
  return webgpuLoadingPromise;
}

// Export the loading function so other modules can wait for it
window.waitForWebGPU = loadWebGPUSupport;

export { THREE, GLTFLoader, DRACOLoader, OrbitControls, AnaglyphEffect };
