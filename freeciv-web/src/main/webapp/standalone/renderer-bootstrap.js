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
  
  // Set graphics quality
  graphics_quality = QUALITY_HIGH;
  terrain_quality = 8;
  
  // Initialize map view dimensions
  var mapview_width = window.innerWidth;
  var mapview_height = window.innerHeight;
  
  console.log("Viewport size:", mapview_width, "x", mapview_height);
  
  // Initialize WebGL renderer
  try {
    webgl_start_renderer();
    console.log("WebGL renderer started");
  } catch (e) {
    console.error("Error starting WebGL renderer:", e);
    alert("Error starting WebGL renderer: " + e.message);
    return;
  }
  
  // Initialize map view
  try {
    init_webgl_mapview();
    console.log("WebGL mapview initialized");
  } catch (e) {
    console.error("Error initializing mapview:", e);
    alert("Error initializing mapview: " + e.message);
    return;
  }
  
  // Start render loop
  start_standalone_render_loop();
  
  console.log("=== Standalone Renderer Bootstrap Complete ===");
}

/**
 * Start the standalone render loop
 */
function start_standalone_render_loop() {
  console.log("Starting render loop");
  
  function animate() {
    requestAnimationFrame(animate);
    
    try {
      // Update controls if they exist
      if (typeof controls !== 'undefined' && controls && controls.update) {
        controls.update();
      }
      
      // Render the scene
      if (typeof maprenderer !== 'undefined' && maprenderer) {
        if (typeof anaglyph_effect !== 'undefined' && anaglyph_effect && anaglyph_3d_enabled) {
          anaglyph_effect.render(scene, camera);
        } else {
          maprenderer.render(scene, camera);
        }
      }
    } catch (e) {
      console.error("Error in render loop:", e);
    }
  }
  
  animate();
}

/**
 * Initialize the standalone environment
 */
function init_standalone_environment() {
  console.log("=== Initializing Standalone Environment ===");
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      init_standalone_after_dom_ready();
    });
  } else {
    init_standalone_after_dom_ready();
  }
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
    setTimeout(function() {
      bootstrap_standalone_renderer();
    }, 3000); // Give 3 seconds for initial assets to load
    
  } catch (e) {
    console.error("Error during preload:", e);
    alert("Error during preload: " + e.message);
  }
}

/**
 * Show loading progress
 */
function show_splash_screen() {
  var canvas = document.getElementById('mapcanvas');
  if (canvas) {
    var ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Loading Freeciv-web Standalone...', canvas.width / 2, canvas.height / 2);
    }
  }
  console.log("Showing splash screen");
}

/**
 * Override webgl_preload_complete to skip network init
 */
var original_webgl_preload_complete = window.webgl_preload_complete;
window.webgl_preload_complete = function() {
  if (typeof STANDALONE_MODE !== 'undefined' && STANDALONE_MODE) {
    console.log("Mock webgl_preload_complete - skipping network_init");
    // Don't call network_init in standalone mode
  } else if (original_webgl_preload_complete) {
    original_webgl_preload_complete();
  }
};

console.log("Renderer bootstrap module loaded");
