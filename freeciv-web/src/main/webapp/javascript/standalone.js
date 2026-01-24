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

var standalone_mode = true;

/**************************************************************************
 * Initialize standalone mode
 * Called when the standalone HTML page loads
 **************************************************************************/
function init_standalone() {
  console.log("Initializing Freeciv-web in standalone mode");
  
  // Set global flag for other modules to detect standalone mode
  if (typeof window !== 'undefined') {
    window.is_standalone = true;
  }
  
  // Initialize any standalone-specific settings
  setup_standalone_environment();
}

/**************************************************************************
 * Setup standalone environment
 * Configure any standalone-specific settings and overrides
 **************************************************************************/
function setup_standalone_environment() {
  console.log("Setting up standalone environment");
  
  // Standalone mode can work with or without server connection
  // By default, we'll still try to connect to a server if configured
  
  // Override or extend functions as needed for standalone operation
  if (typeof setup_window_size === 'function') {
    // Ensure window sizing works in standalone mode
    $(window).on('resize', function() {
      setup_window_size();
    });
  }
}

/**************************************************************************
 * Check if running in standalone mode
 * Other modules can call this to detect standalone operation
 **************************************************************************/
function is_standalone_mode() {
  return standalone_mode === true || (typeof window !== 'undefined' && window.is_standalone === true);
}

/**************************************************************************
 * Standalone-specific event handlers
 **************************************************************************/
$(document).ready(function() {
  if (is_standalone_mode()) {
    console.log("Document ready in standalone mode");
    init_standalone();
  }
});
