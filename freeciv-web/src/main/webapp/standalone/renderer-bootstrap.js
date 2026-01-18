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
  // Initialize mock data
  init_all_mock_data();
  
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
 */
function show_splash_screen() {
  const canvas = document.getElementById('mapcanvas');
  const ctx = canvas?.getContext('2d');
  
  if (ctx) {
    const { width, height } = canvas;
    // Use modern canvas drawing with method chaining where possible
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    Object.assign(ctx, {
      fillStyle: '#ffffff',
      font: '20px Arial',
      textAlign: 'center'
    });
    
    ctx.fillText('Loading Freeciv-web Standalone...', width / 2, height / 2);
  }
  
  console.log("Showing splash screen");
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
