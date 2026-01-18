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

console.log("Mock server functions initialized");
