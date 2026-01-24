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

export { THREE, GLTFLoader, DRACOLoader, OrbitControls, AnaglyphEffect };
