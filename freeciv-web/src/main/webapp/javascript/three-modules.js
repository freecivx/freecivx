/**
 * Modern Three.js module imports
 * This file exports Three.js and its addons for use in the application
 * 
 * Note: This file uses import maps to resolve 'three' to the local Three.js file.
 * It provides a cleaner way to manage Three.js imports compared to inline scripts.
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
