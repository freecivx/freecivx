/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2015  The Freeciv-web project

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
 * Standalone-specific initialization and functionality
 * This module provides the necessary glue code for running Freeciv-web
 * in standalone mode without a full server infrastructure.
 */

var standalone_mode = false;

// Configuration constants for standalone mode
var STANDALONE_STARTUP_DELAY_MS = 1000;  // Increased delay to allow textures to load
var STANDALONE_MAP_WIDTH = 40;          // Map width in tiles
var STANDALONE_MAP_HEIGHT = 30;         // Map height in tiles


/**************************************************************************
 * Initialize standalone mode
 * Called when the standalone HTML page loads
 **************************************************************************/
function init_standalone() {
  console.log("[Standalone] Initializing Freeciv-web in standalone mode");
  console.log("[Standalone] Startup delay: " + STANDALONE_STARTUP_DELAY_MS + "ms");

  standalone_mode = true;

  init_sprites();


}

/**************************************************************************
 * Setup standalone environment
 * Configure any standalone-specific settings and overrides
 **************************************************************************/
function setup_standalone_environment() {
  console.log("[Standalone] Setting up standalone environmentMap dimensions: " + STANDALONE_MAP_WIDTH + "x" + STANDALONE_MAP_HEIGHT);
  
  // Override network_init to prevent websocket connection
  if (typeof network_init !== 'undefined') {
    var original_network_init = network_init;
    network_init = function() {
      console.log("[Standalone] Skipping network initialization in standalone mode");
      // Don't call original network_init
    };
  }

  // Override send_request to handle packets locally in standalone mode
  // Only override if we're actually in standalone mode
  if (typeof send_request !== 'undefined' && is_standalone_mode()) {
    send_request = function(packet_payload) {
      console.log("[Standalone] Intercepting send_request");
      
      // Parse the JSON packet
      var packet;
      try {
        packet = JSON.parse(packet_payload);
      } catch (e) {
        console.error("[Standalone] Failed to parse packet:", e);
        return;
      }
      
      // Handle unit orders packet (movement)
      if (packet.pid === packet_unit_orders) {
        console.log("[Standalone] Handling unit movement locally");
        server_handle_unit_orders(packet);
        return;
      }
      
      // For other packets, log but don't process in standalone mode
      console.log("[Standalone] Ignoring packet type:", packet.pid);
    };
  }

    $(window).on('resize', function() {
      setup_window_size();
    });

    // Remove pregame intro elements
    $("#fciv-intro").remove();
    $("#game_text_input").blur();

    $("#dialog").dialog('close');
    $("#pregame_page").hide();

}

/**************************************************************************
 * Check if running in standalone mode
 * Other modules can call this to detect standalone operation
 **************************************************************************/
function is_standalone_mode() {
  return standalone_mode === true;
}

/**************************************************************************
 * Start standalone game with mock data
 **************************************************************************/
function start_standalone_game() {
  console.log("[Standalone] Starting standalone game with mock data");
  
  // Initialize game structures
  console.log("[Standalone] Calling game_init()");
  game_init();
  
  // Create mock data
  console.log("[Standalone] Creating mock game data");
  create_mock_game_data();
  
  // Validate tile heights to prevent NaN errors in geometry
  var invalidTiles = 0;
  for (var index in tiles) {
    if (tiles[index].height === undefined || tiles[index].height === null || isNaN(tiles[index].height)) {
      console.error("[Standalone] Invalid height for tile " + index + ": " + tiles[index].height);
      tiles[index].height = 0.5; // Fix invalid heights
      invalidTiles++;
    }
  }
  if (invalidTiles > 0) {
    console.warn("[Standalone] Fixed " + invalidTiles + " tiles with invalid heights");
  } else {
    console.log("[Standalone] All " + Object.keys(tiles).length + " tiles have valid heights");
  }
  
  // Initialize WebGL loader and resources before starting the game
  // This is necessary because in standalone mode we bypass the normal
  // tileset preloading flow that initializes these resources
  console.log("[Standalone] Initializing WebGL resources");
  initialize_standalone_webgl();

  console.log("[Standalone] Setting client state to C_S_RUNNING");
  set_client_state(C_S_RUNNING);
  console.log("[Standalone] Standalone game started successfully");

  
  advance_unit_focus();
  console.log("[Standalone] Advance unit focus called");
}


/**************************************************************************
 * Create mock game data for standalone mode
 **************************************************************************/
function create_mock_game_data() {
  console.log("[Standalone] Creating mock game data using JavaScript server");
  
  // Use the JavaScript server to create the game
  server_create_game({
    mapWidth: STANDALONE_MAP_WIDTH,
    mapHeight: STANDALONE_MAP_HEIGHT,
    numPlayers: 3
  });
  
  console.log("[Standalone] Mock game data created successfully");
}


/**************************************************************************
 * Initialize WebGL resources for standalone mode
 * This initializes the GLTFLoader and other resources that would normally
 * be initialized during tileset preloading
 **************************************************************************/
function initialize_standalone_webgl() {
  console.log("[Standalone] Initializing WebGL resources for standalone mode");


  // Initialize the GLTF loader if it hasn't been initialized yet
  if (!loader) {
    console.log("[Standalone] Creating GLTFLoader");
    loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/javascript/webgl/libs/');
    dracoLoader.setDecoderConfig({ type: 'wasm' });
    loader.setDRACOLoader(dracoLoader);
    console.log("[Standalone] GLTFLoader initialized");
  } else {
    console.log("[Standalone] GLTFLoader already exists");
  }
  
  // Initialize webgl_textures if not already initialized
  if (!window.webgl_textures) {
    console.log("[Standalone] Creating webgl_textures object");
    window.webgl_textures = {};
  } else {
    console.log("[Standalone] webgl_textures already initialized with " + Object.keys(window.webgl_textures).length + " textures");
  }

  
  // Initialize webgl_models if not already initialized  
  if (!window.webgl_models) {
    console.log("[Standalone] Creating webgl_models object");
    window.webgl_models = {};
  } else {
    console.log("[Standalone] webgl_models already initialized with " + Object.keys(window.webgl_models).length + " models");
  }
  
  console.log("[Standalone] WebGL resources initialized for standalone mode");
}
