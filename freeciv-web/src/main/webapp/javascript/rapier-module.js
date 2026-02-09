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

// Initialize RAPIER WASM module before exporting
// This ensures the module is fully ready when physics.js uses it
(async () => {
    try {
        await RAPIER.init();
        // Export to global window object only after initialization
        window.RAPIER = RAPIER;
        console.log('Rapier.js physics module loaded and initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Rapier.js WASM module:', error);
    }
})();

export { RAPIER };
