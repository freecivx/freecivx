/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
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

// stats is defined in webgpu/mapview_common.js

/****************************************************************************
  Init the Freeciv-web WebGPU renderer
****************************************************************************/
function init_webgl_renderer()
{
  // WebGPU is required - no WebGL fallback
  if (!navigator.gpu) {
    swal("WebGPU is not supported by your browser. Please use a modern browser with WebGPU support (Chrome 113+, Edge 113+, Firefox 122+).");
    console.log("WebGPU not supported by browser");
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

  if (is_standalone_mode()) {
    show_standalone_pregame_dialog();
  }

}

/****************************************************************************
 Init the map renderer (WebGPU only)
 ****************************************************************************/
async function renderer_init() {
  console.log("renderer_init()");
  
  // WebGPU is required - no fallback
  if (!navigator.gpu) {
    swal("WebGPU is not supported by your browser. Please use a modern browser with WebGPU support (Chrome 113+, Edge 113+, Firefox 122+).");
    console.log("WebGPU not supported by browser");
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
    keyboard_input=true;

    // Delay unit focus to ensure units are fully loaded from server
    // This addresses timing issues where the camera position might not be set
    // correctly if units aren't available yet
    setTimeout(function() {
      camera.position.y = 450;
      advance_unit_focus();
      $("#game_text_input").blur();
    }, 100);

    setTimeout("$('#mapcanvas').fadeIn(2500); $.unblockUI();", 700);

  }
}

