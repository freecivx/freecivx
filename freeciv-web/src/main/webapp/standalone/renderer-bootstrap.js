/**********************************************************************
    FreecivWorld.net - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2024  The Freeciv-web project

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

***********************************************************************/

/**
 * Renderer bootstrap for standalone testing environment
 * Initializes 3D renderer without server dependencies
 */

var width_offset = 0;
var height_offset = 0;

/**
 * Position camera to properly view the 3D map
 */
function position_camera_for_standalone() {
  console.log("Positioning camera for standalone mode");
  
  // Center on the middle of the map
  const centerX = Math.floor(map.xsize / 2);
  const centerY = Math.floor(map.ysize / 2);
  const centerTile = map_pos_to_tile(centerX, centerY);
  
  if (centerTile && typeof center_tile_mapcanvas_3d === 'function') {
    // Use the standard camera positioning function
    center_tile_mapcanvas_3d(centerTile);
    console.log(`Camera centered on tile (${centerX}, ${centerY})`);
  } else if (centerTile && typeof camera_look_at === 'function') {
    // Fallback to direct camera_look_at function
    const pos = map_to_scene_coords(centerX, centerY);
    camera_look_at(pos.x - 50, 0, pos.y - 50);
    console.log(`Camera positioned at scene coords (${pos.x}, ${pos.y})`);
  } else {
    // Final fallback: manually position camera
    console.warn("Using fallback camera positioning");
    if (typeof camera !== 'undefined' && camera) {
      camera.position.set(20, 30, 20);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
    }
  }
}

/**
 * Bootstrap the standalone 3D renderer
 */
function bootstrap_standalone_renderer() {
  console.log("=== Bootstrapping Standalone Renderer ===");
  
  // Set graphics quality using object destructuring
  Object.assign(window, {
    graphics_quality: QUALITY_HIGH,
    terrain_quality: 8
  });
  
  // Initialize map view dimensions using destructuring
  const { innerWidth: mapview_width, innerHeight: mapview_height } = window;
  
  console.log(`Viewport size: ${mapview_width} x ${mapview_height}`);
  
  // Define initialization steps with modern array methods
  const initSteps = [
    { fn: init_webgl_renderer, name: 'WebGL renderer initialized' },
    { fn: webgl_start_renderer, name: 'WebGL renderer started' },
    { fn: init_webgl_mapview, name: 'WebGL mapview initialized' }
  ];
  
  // Execute initialization steps using array methods
  const success = initSteps.every(step => {
    try {
      step.fn();
      console.log(step.name);
      return true;
    } catch (e) {
      console.error(`Error ${step.name}:`, e);
      alert(`Error ${step.name}: ${e.message}`);
      return false;
    }
  });
  
  if (!success) {
    return;
  }
  
  // Position camera to view the map
  position_camera_for_standalone();
  
  // Start render loop
  start_standalone_render_loop();
  
  // Hide loading overlay using optional chaining
  setTimeout(() => {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }, 500);
  
  console.log("=== Standalone Renderer Bootstrap Complete ===");
}

/**
 * Start the standalone render loop
 */
function start_standalone_render_loop() {
  console.log("Starting render loop");
  
  const animate = () => {
    requestAnimationFrame(animate);
    
    try {
      // Update controls if they exist using typeof check for safety
      if (typeof controls !== 'undefined' && controls?.update) {
        controls.update();
      }
      
      // Render the scene using modern conditional logic
      if (typeof maprenderer !== 'undefined' && maprenderer) {
        const shouldUseAnaglyph = typeof anaglyph_effect !== 'undefined' && anaglyph_effect && 
                                   typeof anaglyph_3d_enabled !== 'undefined' && anaglyph_3d_enabled;
        const renderer = shouldUseAnaglyph ? anaglyph_effect : maprenderer;
        renderer.render(scene, camera);
      }
    } catch (e) {
      console.error("Error in render loop:", e);
    }
  };
  
  animate();
}

/**
 * Initialize the standalone environment
 */
function init_standalone_environment() {
  console.log("=== Initializing Standalone Environment ===");
  
  // Wait for DOM to be ready using cleaner Promise-based approach
  const ensureDOMReady = () => {
    return new Promise(resolve => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      } else {
        resolve();
      }
    });
  };
  
  ensureDOMReady().then(init_standalone_after_dom_ready);
}

/**
 * Continue initialization after DOM is ready
 */
function init_standalone_after_dom_ready() {
  // Set client state to RUNNING (needed by many client functions)
  if (typeof set_client_state === 'function') {
    set_client_state(C_S_RUNNING);
    console.log("Client state set to C_S_RUNNING");
  }
  
  // Initialize mock data
  init_all_mock_data();
  
  // Call control_init if available (sets up keyboard shortcuts, context menus)
  if (typeof control_init === 'function') {
    try {
      control_init();
      console.log("control_init() called successfully");
    } catch (e) {
      console.warn("Error in control_init:", e);
    }
  }
  
  // Initialize WebGL preload
  console.log("Starting WebGL preload...");
  
  try {
    // Call preload function
    webgl_preload();
    
    // Wait for models to load, then bootstrap renderer
    setTimeout(() => {
      bootstrap_standalone_renderer();
    }, 3000); // Give 3 seconds for initial assets to load
    
  } catch (e) {
    console.error("Error during preload:", e);
    alert(`Error during preload: ${e.message}`);
  }
}

/**
 * Show loading progress
 * Note: We don't draw on the canvas here because WebGL will use it.
 * The loading overlay in the HTML handles visual feedback instead.
 */
function show_splash_screen() {
  // Canvas drawing removed - it conflicts with WebGL context
  // The HTML loading overlay provides visual feedback during initialization
  console.log("Splash screen phase (using HTML overlay)");
}

/**
 * Override webgl_preload_complete to skip network init
 */
const original_webgl_preload_complete = window.webgl_preload_complete;
window.webgl_preload_complete = function() {
  if (typeof STANDALONE_MODE !== 'undefined' && STANDALONE_MODE) {
    console.log("Mock webgl_preload_complete - skipping network_init");
    // Don't call network_init in standalone mode
  } else if (original_webgl_preload_complete) {
    original_webgl_preload_complete();
  }
};

console.log("Renderer bootstrap module loaded");
