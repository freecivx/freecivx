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

import * as THREE from 'three';
import { GLTFLoader } from '/javascript/webgl/libs/GLTFLoader.js';
import { DRACOLoader } from '/javascript/webgl/libs/DRACOLoader.js';
import { OrbitControls } from '/javascript/webgl/libs/OrbitControls.js';
import { AnaglyphEffect } from '/javascript/webgl/effects/AnaglyphEffect.js';

// Export to global window object for compatibility with existing code
window.THREE = THREE;
window.GLTFLoader = GLTFLoader;
window.DRACOLoader = DRACOLoader;
window.OrbitControls = OrbitControls;
window.AnaglyphEffect = AnaglyphEffect;

// Track WebGPU loading state
let webgpuLoadingPromise = null;

// Conditionally load WebGPU support asynchronously
function loadWebGPUSupport() {
  // Return cached promise if already loading
  if (webgpuLoadingPromise) {
    return webgpuLoadingPromise;
  }
  
  // Check if WebGPU is supported
  if (typeof navigator !== 'undefined' && navigator.gpu) {
    webgpuLoadingPromise = (async () => {
      try {
        // Import WebGPU module (which is referenced in import map as "three/webgpu")
        const webgpuModule = await import('three/webgpu');
        
        // Import TSL module which depends on three/webgpu
        const tslModule = await import('/javascript/webgpu/libs/threejs/three.tsl.min.js');
        
        // Add WebGPU exports to THREE
        THREE.WebGPURenderer = webgpuModule.WebGPURenderer;
        THREE.MeshBasicNodeMaterial = webgpuModule.MeshBasicNodeMaterial;
        
        // Add all TSL exports to THREE
        Object.assign(THREE, tslModule);
        
        // Update global reference
        window.THREE = THREE;
        
        console.log('WebGPU support loaded successfully');
        return true;
      } catch (error) {
        console.log('WebGPU modules not available, using WebGL only:', error);
        return false;
      }
    })();
  } else {
    // WebGPU not supported
    webgpuLoadingPromise = Promise.resolve(false);
  }
  
  return webgpuLoadingPromise;
}

// Start loading WebGPU modules immediately (don't await)
loadWebGPUSupport();

// Export the loading function so other modules can wait for it
window.waitForWebGPU = loadWebGPUSupport;

export { THREE, GLTFLoader, DRACOLoader, OrbitControls, AnaglyphEffect };
