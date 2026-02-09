/**
 * Rapier.js Physics Module Loader
 * 
 * Loads the Rapier.js WASM physics engine for 3D physics simulation.
 * Uses the @dimforge/rapier3d-compat package which embeds WASM inline.
 * 
 * This module is loaded dynamically when physics is enabled.
 * 
 * @see https://rapier.rs/docs/user_guides/javascript/getting_started_js/
 */

// Import RAPIER from the CDN via importmap
import RAPIER from '@dimforge/rapier3d-compat';

// Export to global window object for compatibility with existing code
window.RAPIER = RAPIER;

// Log successful load
console.log('Rapier.js physics module loaded successfully');

export { RAPIER };
