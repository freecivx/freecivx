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
 * Mock server functionality for standalone testing
 * Stubs out network and server communication functions
 */

/**
 * Mock network initialization - does nothing in standalone mode
 */
function network_init() {
  if (typeof STANDALONE_MODE !== 'undefined' && STANDALONE_MODE) {
    console.log("Mock network_init() - skipping in standalone mode");
    return;
  }
}

/**
 * Mock client state - always returns running state
 */
function client_state() {
  if (typeof STANDALONE_MODE !== 'undefined' && STANDALONE_MODE) {
    return 5; // C_S_RUNNING
  }
  // Fall through to real implementation if not in standalone mode
}

/**
 * Mock WebSocket/network functions
 */
if (typeof STANDALONE_MODE !== 'undefined' && STANDALONE_MODE) {
  
  // Stub send_message if it doesn't exist
  if (typeof send_message === 'undefined') {
    window.send_message = function(message) {
      console.log("Mock send_message:", message);
    };
  }
  
  // Stub other network functions
  window.send_unit_orders = function() {
    console.log("Mock send_unit_orders");
  };
  
  window.send_goto_tile = function() {
    console.log("Mock send_goto_tile");
  };
  
  window.send_unit_do_action = function() {
    console.log("Mock send_unit_do_action");
  };
  
  // Stub jQuery-related functions
  if (typeof $ !== 'undefined') {
    // Mock blockUI if it doesn't exist
    if (!$.blockUI) {
      $.blockUI = function() {
        console.log("Mock $.blockUI()");
      };
    }
    if (!$.unblockUI) {
      $.unblockUI = function() {
        console.log("Mock $.unblockUI()");
      };
    }
  }
}

/**
 * Mock simpleStorage for settings
 */
if (typeof simpleStorage === 'undefined') {
  window.simpleStorage = {
    get: function(key, defaultValue) {
      return defaultValue;
    },
    set: function(key, value) {
      console.log("Mock simpleStorage.set:", key, value);
      return true;
    }
  };
}

/**
 * Mock swal (SweetAlert) for dialogs
 */
if (typeof swal === 'undefined') {
  window.swal = function(message) {
    console.log("Mock swal:", message);
    alert(message);
  };
}

/**
 * Mock screen size detection functions
 */
if (typeof is_small_screen === 'undefined') {
  window.is_small_screen = function() {
    return false;
  };
}

/**
 * Mock touch device detection
 */
if (typeof is_touch_device === 'undefined') {
  window.is_touch_device = function() {
    if(('ontouchstart' in window) || 'onmsgesturechange' in window
        || window.DocumentTouch && document instanceof DocumentTouch) {
      return true;
    } else {
      return false;
    }
  };
}

/**
 * Mock game panel initialization functions
 */
if (typeof init_game_unit_panel === 'undefined') {
  window.init_game_unit_panel = function() {
    console.log("Mock init_game_unit_panel");
  };
}

if (typeof init_chatbox === 'undefined') {
  window.init_chatbox = function() {
    console.log("Mock init_chatbox");
  };
}

/**
 * Mock keyboard input flag
 */
if (typeof keyboard_input === 'undefined') {
  window.keyboard_input = false;
}

/**
 * Mock city population function
 */
if (typeof city_population === 'undefined') {
  window.city_population = function(city) {
    return city ? city.size : 0;
  };
}

/**
 * Mock Detector for WebGL support
 */
if (typeof Detector === 'undefined') {
  window.Detector = {
    webgl: true,
    canvas: true
  };
}

/**
 * Mock client object if not present
 */
if (typeof client === 'undefined') {
  window.client = {
    conn: {
      playing: null
    }
  };
}

/**
 * Mock game_info if not present
 */
if (typeof game_info === 'undefined') {
  window.game_info = {
    turn: 1,
    year: -4000
  };
}

/**
 * Mock server_settings for WebGL rendering
 */
if (typeof server_settings === 'undefined') {
  window.server_settings = {
    borders: {
      is_visible: true
    }
  };
}

/**
 * Mock mapview_slide for camera animations
 * This is normally defined in 2dcanvas/mapview.js but that file
 * is not loaded in standalone mode. The variable is needed by
 * mapview_webgl.js animate_webgl() function.
 * Note: 'prev' and 'start' properties are added here even though the original
 * only initializes them later, because they're accessed by animation code.
 */
if (typeof mapview_slide === 'undefined') {
  window.mapview_slide = {
    active: false,
    dx: 0,
    dy: 0,
    i: 0,
    max: 100,
    slide_time: 700,
    prev: 0,
    start: 0
  };
}

/**
 * Mock spaceship variables for animation
 * These are normally defined in spacerace.js which is not loaded in standalone mode
 */
if (typeof spaceship_launched === 'undefined') {
  window.spaceship_launched = null;
  window.spaceship_speed = 1.0;
  window.spaceship_acc = 1.01;
}

/**
 * Mock benchmark variables
 * These are normally defined in benchmark.js which is not loaded in standalone mode
 */
if (typeof initial_benchmark_enabled === 'undefined') {
  window.initial_benchmark_enabled = false;
  window.benchmark_enabled = false;
  window.benchmark_frames_count = 0;
}

/**
 * Mock get_city_flag_sprite function
 * This is normally defined in 2dcanvas/tilespec.js which is not loaded in standalone mode
 */
if (typeof get_city_flag_sprite === 'undefined') {
  window.get_city_flag_sprite = function(pcity) {
    // Return a simple mock sprite structure
    return {
      key: 'city_flag',
      x: 0,
      y: 0,
      width: 32,
      height: 32
    };
  };
}

/**
 * Mock update_city_screen function
 * This is normally defined in city.js but needs to be available early for EventAggregator
 */
if (typeof update_city_screen === 'undefined') {
  window.update_city_screen = function() {
    // Do nothing in standalone mode
  };
}

/**
 * Mock sprites object for 2D canvas sprites
 * This is normally defined in 2dcanvas/mapview.js which is not loaded in standalone mode
 */
if (typeof sprites === 'undefined') {
  window.sprites = {};
  
  // Create a mock canvas image for sprites
  var mock_canvas = document.createElement('canvas');
  mock_canvas.width = 48;
  mock_canvas.height = 32;
  var mock_ctx = mock_canvas.getContext('2d');
  mock_ctx.fillStyle = 'rgba(0, 0, 0, 0)';
  mock_ctx.fillRect(0, 0, 48, 32);
  
  // Add default sprite entries that might be needed
  window.sprites['city_flag'] = mock_canvas;
  window.sprites['occupied'] = mock_canvas;
}

/**
 * Mock get_city_occupied_sprite function
 * This is normally defined in 2dcanvas/tilespec.js
 */
if (typeof get_city_occupied_sprite === 'undefined') {
  window.get_city_occupied_sprite = function(pcity) {
    return 'occupied';
  };
}

/**
 * Mock add_spaceship function
 * This is normally defined in spacerace.js which is not loaded in standalone mode
 */
if (typeof add_spaceship === 'undefined') {
  window.add_spaceship = function(ptile, pcity, scene) {
    // Do nothing in standalone mode - spaceship visualization not needed
  };
}

/**
 * Initialize mapview model dimensions
 * These are needed for scene coordinate conversions but not initialized elsewhere
 */
if (typeof STANDALONE_MODE !== 'undefined' && STANDALONE_MODE) {
  // Calculate model dimensions based on map size
  // The MAPVIEW_ASPECT_FACTOR determines the scene scaling
  window.mapview_model_width = 1000;  // Standard width for the 3D scene
  window.mapview_model_height = 1000; // Standard height for the 3D scene
  console.log(`Mapview model dimensions set: ${mapview_model_width} x ${mapview_model_height}`);
}

/**
 * Mock jQuery custom functions used by civclient.js
 * Note: Real jQuery and plugins are now loaded in standalone HTML,
 * so we only need to mock custom helper functions
 */
if (typeof $ !== 'undefined') {
  // Mock getUrlVar for URL parameter parsing (custom function, not a standard jQuery method)
  if (!$.getUrlVar) {
    $.getUrlVar = function(key) {
      console.log("Mock $.getUrlVar called for:", key);
      return null; // Return null for all URL vars in standalone mode
    };
  }
}

/**
 * Mock functions called by civclient.js
 */
if (typeof STANDALONE_MODE !== 'undefined' && STANDALONE_MODE) {
  
  // Mock motd_init (message of the day initialization)
  if (typeof motd_init === 'undefined') {
    window.motd_init = function() {
      console.log("Mock motd_init");
    };
  }
  
  // Mock checkInvitations (multiplayer invitations)
  if (typeof checkInvitations === 'undefined') {
    window.checkInvitations = function() {
      console.log("Mock checkInvitations");
    };
  }
  
  // Mock update_game_status_panel (top panel with turn info)
  if (typeof update_game_status_panel === 'undefined') {
    window.update_game_status_panel = function() {
      // Do nothing - we don't have the full UI in standalone mode
    };
  }
  
  // Mock speak (text-to-speech)
  if (typeof speak === 'undefined') {
    window.speak = function(text) {
      // Mock text-to-speech - do nothing in standalone
    };
  }
  
  // Mock show_intro_dialog (welcome dialog)
  if (typeof show_intro_dialog === 'undefined') {
    window.show_intro_dialog = function(title, message) {
      console.log("Mock intro dialog:", title, message);
    };
  }
  
  // Mock set_client_page (page switching)
  if (typeof set_client_page === 'undefined') {
    window.set_client_page = function(page) {
      console.log("Mock set_client_page:", page);
    };
  }
  
  // Mock PAGE_GAME constant
  if (typeof PAGE_GAME === 'undefined') {
    window.PAGE_GAME = 'game';
  }
  
  // Mock renderer_init (normally initializes 2D canvas renderer)
  if (typeof renderer_init === 'undefined') {
    window.renderer_init = function() {
      console.log("Mock renderer_init (2D canvas not used in standalone)");
    };
  }
  
  // Mock message_log (required by client_main.js)
  if (typeof message_log === 'undefined') {
    // Create a mock EventAggregator that does nothing
    window.message_log = {
      update: function(packet) {
        // Do nothing in standalone mode - no chatbox to update
      },
      clear: function() {
        // Do nothing in standalone mode
      },
      fireNow: function() {
        // Do nothing in standalone mode
      }
    };
  }
  
  // Mock clear_chatbox
  if (typeof clear_chatbox === 'undefined') {
    window.clear_chatbox = function() {
      // Do nothing in standalone mode
    };
  }
  
  // Mock show_new_game_message
  if (typeof show_new_game_message === 'undefined') {
    window.show_new_game_message = function() {
      console.log("Mock show_new_game_message");
    };
  }
  
  // Mock update_metamessage_on_gamestart
  if (typeof update_metamessage_on_gamestart === 'undefined') {
    window.update_metamessage_on_gamestart = function() {
      // Do nothing in standalone mode
    };
  }
  
  // Mock observing flag
  if (typeof observing === 'undefined') {
    window.observing = false;
  }
  
  // Mock game_loaded flag
  if (typeof game_loaded === 'undefined') {
    window.game_loaded = false;
  }
  
  // Mock unitpanel_active flag
  if (typeof unitpanel_active === 'undefined') {
    window.unitpanel_active = false;
  }
  
  // Mock center_on_any_city
  if (typeof center_on_any_city === 'undefined') {
    window.center_on_any_city = function() {
      console.log("Mock center_on_any_city");
    };
  }
  
  // Mock advance_unit_focus
  if (typeof advance_unit_focus === 'undefined') {
    window.advance_unit_focus = function() {
      console.log("Mock advance_unit_focus");
    };
  }
  
  // Mock show_endgame_dialog
  if (typeof show_endgame_dialog === 'undefined') {
    window.show_endgame_dialog = function() {
      console.log("Mock show_endgame_dialog");
    };
  }
  
  // Mock game_init
  if (typeof game_init === 'undefined') {
    window.game_init = function() {
      console.log("Mock game_init");
    };
  }
  
  // Mock timeoutTimerId
  if (typeof timeoutTimerId === 'undefined') {
    window.timeoutTimerId = null;
  }
  
  // Mock update_timeout
  if (typeof update_timeout === 'undefined') {
    window.update_timeout = function() {
      // Do nothing in standalone mode
    };
  }
  
  // Mock mapview_window_resized
  if (typeof mapview_window_resized === 'undefined') {
    window.mapview_window_resized = function() {
      console.log("Mock mapview_window_resized");
    };
  }
  
  // Mock orientation_changed
  if (typeof orientation_changed === 'undefined') {
    window.orientation_changed = function() {
      console.log("Mock orientation_changed");
    };
  }
  
  // Mock send_end_turn
  if (typeof send_end_turn === 'undefined') {
    window.send_end_turn = function() {
      console.log("Mock send_end_turn");
    };
  }
}

console.log("Mock server functions initialized");
