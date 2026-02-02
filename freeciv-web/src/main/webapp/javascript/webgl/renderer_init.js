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

var stats = null;

/****************************************************************************
  Init the Freeciv-web WebGL renderer
****************************************************************************/
function init_webgl_renderer()
{
  // Check for URL parameter override first (renderer_type_override is a global variable injected by JSP)
  if (typeof renderer_type_override !== 'undefined' && renderer_type_override !== '') {
    renderer_type = renderer_type_override;
    console.log("Renderer type set from URL parameter: " + renderer_type);
    // Note: We don't save URL parameter to storage to allow temporary overrides
  } else {
    // Check renderer type preference from storage
    var stored_renderer_type = simpleStorage.get("renderer_type", "");
    if (stored_renderer_type != null && stored_renderer_type == "webgpu") {
      if (!navigator.gpu) {
        console.log("WebGPU not supported, falling back to WebGL");
        simpleStorage.set("renderer_type", "webgl");
        renderer_type = "webgl";
      } else {
        renderer_type = "webgpu";
      }
    } else {
      renderer_type = "webgl";
    }
  }

  if (renderer_type === "webgl" && !Detector.webgl) {
    swal("3D WebGL not supported by your browser or you don't have a 3D graphics card. ");
    return;
  }

  var stored_graphics_quality_setting = simpleStorage.get("graphics_quality", "");
  if (stored_graphics_quality_setting != null && stored_graphics_quality_setting > 0) {
    graphics_quality = stored_graphics_quality_setting;
  } else if (is_small_screen()) {
    graphics_quality = QUALITY_MEDIUM;
  } else {
    graphics_quality = QUALITY_HIGH; //default value
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
 Init the map renderer
 ****************************************************************************/
async function renderer_init() {
  console.log("renderer_init()");
  
  // Load renderer type preference
  var stored_renderer_type = simpleStorage.get("renderer_type", "");
  if (stored_renderer_type != null && stored_renderer_type == "webgpu") {
    if (!navigator.gpu) {
      console.log("WebGPU not supported, falling back to WebGL");
      renderer_type = "webgl";
    } else {
      renderer_type = "webgpu";
    }
  } else {
    renderer_type = "webgl";
  }

  if (renderer_type === "webgl" && !Detector.webgl) {
    swal("3D WebGL not supported by your browser or you don't have a 3D graphics card. ");
    console.log("3D WebGL not supported by your browser or you don't have a 3D graphics card. ");
    return;
  }

  if (C_S_RUNNING === client_state() || C_S_OVER === client_state()) {

    if (renderer_type === "webgpu") {
      // Wait for WebGPU modules to load before starting renderer
      if (window.waitForWebGPU) {
        console.log("Waiting for WebGPU modules to load...");
        const webgpuLoaded = await window.waitForWebGPU();
        if (!webgpuLoaded) {
          console.log("WebGPU failed to load, falling back to WebGL");
          renderer_type = "webgl";
          // Update stored preference to prevent repeated WebGPU attempts
          simpleStorage.set("renderer_type", "webgl");
          webgl_start_renderer();
          init_webgl_mapview();
        } else {
          webgpu_start_renderer();
          init_webgpu_mapview();
        }
      } else {
        console.log("WebGPU loader not available, falling back to WebGL");
        renderer_type = "webgl";
        // Update stored preference to prevent repeated WebGPU attempts
        simpleStorage.set("renderer_type", "webgl");
        webgl_start_renderer();
        init_webgl_mapview();
      }
    } else {
      webgl_start_renderer();
      init_webgl_mapview();
    }

    init_webgl_mapctrl();
    init_game_unit_panel();
    init_chatbox();
    keyboard_input=true;

    setTimeout("$('#mapcanvas').fadeIn(2500); $.unblockUI();", 700);

  }
}

