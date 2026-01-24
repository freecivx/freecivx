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
