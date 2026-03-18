/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.freecivx.com/
    Copyright (C) 2009-2017  The Freeciv-web project

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

var QUALITY_MEDIUM = 2; // medium quality.
var QUALITY_HIGH = 3;   // best quality, add features which require high-end graphics hardware here.

var graphics_quality = QUALITY_HIGH;

var terrain_quality = 8; // 8 is slow, 7 has problems with rivers.

var anaglyph_3d_enabled = false;

// When true, only the 2D map renderer is used (no WebGPU or mobile device).
var use_2d_only = false;

var DEFAULT_CAMERA_HEIGHT = 450; // default 3D camera Y position

// stats is defined in webgpu/mapview_common.js

/****************************************************************************
  Init the Freeciv-web WebGPU renderer
****************************************************************************/
function init_webgl_renderer()
{
  if (!navigator.gpu || is_small_screen()) {
    use_2d_only = true;
    if (!navigator.gpu) {
      console.log("WebGPU not supported by browser, using 2D map renderer.");
      $("#intro_extra_txt").text("WebGPU is not supported by your browser. The 2D map will be used.");
    } else {
      console.log("Mobile device detected, using 2D map renderer.");
    }
    return;
  }

  renderer_type = "webgpu";
  console.log("WebGPU renderer initialized");

  var stored_graphics_quality_setting = simpleStorage.get("graphics_quality", "");
  if (stored_graphics_quality_setting != null && stored_graphics_quality_setting > 0) {
    graphics_quality = stored_graphics_quality_setting;
  } else {
    // Use responsive graphics quality based on screen width
    graphics_quality = ($(window).width() <= 800) ? QUALITY_MEDIUM : QUALITY_HIGH;
  }

}


/****************************************************************************
  Preload is complete.
****************************************************************************/
function webgl_preload_complete()
{
  $.unblockUI();

  network_init();

}

/****************************************************************************
 Init the map renderer.  Uses 2D-only mode when WebGPU is unavailable or
 the device is a small/mobile screen.
 ****************************************************************************/
async function renderer_init() {
  console.log("renderer_init()");

  if (use_2d_only) {
    // Hide the 3D map tab and activate the 2D map tab.
    $("#map_tab").hide();
    $("#tabs").tabs("option", "active", 1);
    init_game_unit_panel();
    init_chatbox();
    setTimeout(function() {
      advance_unit_focus();
      $("#game_text_input").blur();
    }, 100);
    setTimeout(function() { $.unblockUI(); }, 700);
    return;
  }

  renderer_type = "webgpu";

  if (C_S_RUNNING === client_state() || C_S_OVER === client_state()) {

    // Wait for WebGPU modules to load before starting renderer
    if (window.waitForWebGPU) {
      console.log("Waiting for WebGPU modules to load...");
      const webgpuLoaded = await window.waitForWebGPU();
      if (!webgpuLoaded) {
        swal("WebGPU modules failed to load. Please refresh the page and try again.");
        console.log("WebGPU failed to load");
        return;
      }
      webgpu_start_renderer();
      await init_webgpu_mapview();
    } else {
      swal("WebGPU loader not available. Please refresh the page and try again.");
      console.log("WebGPU loader not available");
      return;
    }

    init_webgl_mapctrl();
    init_game_unit_panel();
    init_chatbox();

    // Delay unit focus to ensure units are fully loaded from server
    // This addresses timing issues where the camera position might not be set
    // correctly if units aren't available yet
    setTimeout(function() {
      camera.position.y = DEFAULT_CAMERA_HEIGHT;
      advance_unit_focus();
      $("#game_text_input").blur();
    }, 100);

    setTimeout("$('#mapcanvas').fadeIn(2500); $.unblockUI();", 700);

  }
}

