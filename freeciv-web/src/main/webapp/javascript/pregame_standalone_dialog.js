/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2026  The Freeciv-web project

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
 * Standalone pregame dialog for JavaScript server
 * Allows users to configure and start a singleplayer game in standalone mode
 */

// Configuration variables for standalone game
var standalone_config = {
  nation_id: 0, // Default to Roman nation (id: 0)
  map_xsize: 60,
  map_ysize: 60,
  ai_players: 12,
  map_type: "square"  // "square" or "hex" - default to square map tiles
};

/****************************************************************************
  Show the standalone pregame dialog
  This dialog allows configuration of standalone game settings
****************************************************************************/
function show_standalone_pregame_dialog()
{
  // Check if user is logged in (required like "Customize" button)
  if (username == null) {
    swal("Please login first", "You need to login to start a singleplayer game.", "warning");
    return;
  }

  // Build the dialog HTML
  var dialog_html = "<div id='standalone_pregame_settings'>";
  
  // Beta warning for local server mode
  dialog_html += "<div style='margin-bottom: 20px; padding: 12px; background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;'>";
  dialog_html += "<strong style='color: #856404;'><i class='fa fa-exclamation-triangle' aria-hidden='true'></i> Warning:</strong> ";
  dialog_html += "<span style='color: #856404;'>Local server mode is in beta and very unstable.</span>";
  dialog_html += "</div>";
  
  // Nation selection
  dialog_html += "<div style='margin-bottom: 20px;'>";
  dialog_html += "<h3>Nation Selection</h3>";
  dialog_html += "<button id='standalone_pick_nation_button' type='button' class='button'>";
  dialog_html += "<i class='fa fa-flag' aria-hidden='true'></i> Pick Your Nation</button>";
  dialog_html += "<div id='standalone_selected_nation' style='margin-top: 10px; font-weight: bold;'>";
  dialog_html += "Nation: <span style='color: green;'>Roman</span>"; // Default to Roman
  dialog_html += "</div>";
  dialog_html += "</div>";
  
  // Map settings
  dialog_html += "<div style='margin-bottom: 20px;'>";
  dialog_html += "<h3>Map Settings</h3>";
  dialog_html += "<table>";
  dialog_html += "<tr><td><label for='standalone_map_type'>Map Type:</label></td>";
  dialog_html += "<td><select id='standalone_map_type'>";
  dialog_html += "<option value='square' selected>Square map tiles</option>";
  dialog_html += "<option value='hex'>Hex map tiles</option>";
  dialog_html += "</select></td></tr>";
  dialog_html += "<tr><td><label for='standalone_map_xsize'>Map Width:</label></td>";
  dialog_html += "<td><input type='number' id='standalone_map_xsize' value='40' min='20' max='200' /></td></tr>";
  dialog_html += "<tr><td><label for='standalone_map_ysize'>Map Height:</label></td>";
  dialog_html += "<td><input type='number' id='standalone_map_ysize' value='30' min='20' max='200' /></td></tr>";
  dialog_html += "</table>";
  dialog_html += "</div>";
  
  // AI Players setting
  dialog_html += "<div style='margin-bottom: 20px;'>";
  dialog_html += "<h3>AI Players</h3>";
  dialog_html += "<table>";
  dialog_html += "<tr><td><label for='standalone_ai_players'>Number of AI Players:</label></td>";
  dialog_html += "<td><input type='number' id='standalone_ai_players' value='3' min='0' max='10' style='width: 90px;'/></td></tr>";
  dialog_html += "</table>";
  dialog_html += "</div>";
  
  dialog_html += "</div>";

  // Remove existing dialog if any
  $("#standalone_pregame_dialog").remove();
  $("<div id='standalone_pregame_dialog'></div>").appendTo("body");
  
  $("#standalone_pregame_dialog").html(dialog_html);
  $("#standalone_pregame_dialog").attr("title", "Singleplayer Game Settings");
  
  // Show the dialog
  $("#standalone_pregame_dialog").dialog({
    bgiframe: true,
    modal: true,
    width: "70%",
    height: "auto",
    buttons: {
      "Cancel": function() {
        $("#standalone_pregame_dialog").dialog('close');
      },
      "Benchmark": function() {
        setup_standalone_environment();
        start_standalone_game_with_config();
        webgl_benchmark_run();
      },
      "Start Game": function() {
        setup_standalone_environment();
        start_standalone_game_with_config();
      }
    },
    close: function() {
      $("#standalone_pregame_dialog").remove();
    }
  });

  // Set up nation picker button handler
  $("#standalone_pick_nation_button").button().click(function() {
    show_standalone_nation_picker();
  });

  // Initialize the form values from config
  $("#standalone_map_type").val(standalone_config.map_type);
  $("#standalone_map_xsize").val(standalone_config.map_xsize);
  $("#standalone_map_ysize").val(standalone_config.map_ysize);
  $("#standalone_ai_players").val(standalone_config.ai_players);
}

/****************************************************************************
  Show nation picker for standalone mode
****************************************************************************/
function show_standalone_nation_picker()
{
  if (nations == null || Object.keys(nations).length == 0) {
    swal("Nations not loaded", "Please wait for the game data to load.", "warning");
    return;
  }

  // Build nation list HTML
  var nations_html = "<div id='standalone_nation_list'>";
  nations_html += "<input type='text' id='standalone_nation_search' placeholder='Search nations...' style='width: 100%; margin-bottom: 10px;' />";
  nations_html += "<div id='standalone_nations_container' style='height: 400px; overflow-y: auto;'>";
  
  var nation_name_list = [];
  for (var nation_id in nations) {
    var pnation = nations[nation_id];
    if (pnation['is_playable']) {
      nations_html += "<div class='nation_pickme_line' onclick='select_standalone_nation(" + nation_id + ");'>"
             + "<div id='standalone_nation_" + nation_id + "' class='nation_choice'>"
             + "<canvas id='standalone_flag_" + nation_id + "' width='44' height='30' class='pick_nation_flags'></canvas>"
             + pnation['adjective'] + "</div></div>";
      nation_name_list.push(pnation['adjective']);
    }
  }
  
  nations_html += "</div></div>";

  // Create or update dialog
  $("#standalone_nation_picker_dialog").remove();
  $("<div id='standalone_nation_picker_dialog'></div>").appendTo("body");
  
  $("#standalone_nation_picker_dialog").html(nations_html);
  $("#standalone_nation_picker_dialog").attr("title", "Choose your nation");
  
  $("#standalone_nation_picker_dialog").dialog({
    bgiframe: true,
    modal: true,
    width: "85%",
    height: $(window).height() - 150,
    buttons: {
      "Select Nation": function() {
        if (standalone_config.nation_id != -1) {
          $("#standalone_nation_picker_dialog").dialog('close');
          // Update the main dialog to show selected nation
          var pnation = nations[standalone_config.nation_id];
          if (pnation) {
            $("#standalone_selected_nation").html("Nation: <span style='color: green;'>" + pnation['adjective'] + "</span>");
          }
        } else {
          swal("No nation selected", "Please select a nation first.", "warning");
        }
      }
    },
    close: function() {
      $("#standalone_nation_picker_dialog").remove();
    }
  });

  // Draw nation flags
  for (nation_id in nations) {
    pnation = nations[nation_id];
    if (pnation['is_playable']) {
      var flag_canvas = document.getElementById('standalone_flag_' + nation_id);
      if (flag_canvas != null) {
        var flag_ctx = flag_canvas.getContext('2d');
        var tag = "f." + pnation['graphic_str'];
        
        if (tileset[tag] != null && sprites[tag] != null) {
          flag_ctx.drawImage(sprites[tag], 0, 0);
        }
      }
    }
  }

  // Set up search functionality
  $("#standalone_nation_search").on("input", function() {
    var search_term = $(this).val().toLowerCase();
    $(".nation_pickme_line").each(function() {
      var nation_text = $(this).text().toLowerCase();
      if (nation_text.indexOf(search_term) !== -1) {
        $(this).show();
      } else {
        $(this).hide();
      }
    });
  });
}

/****************************************************************************
  Select a nation in the standalone nation picker
****************************************************************************/
function select_standalone_nation(nation_id)
{
  // Remove selection from all nations
  $("[id^='standalone_nation_']").removeClass('nation_selected');
  
  // Add selection to chosen nation
  $("#standalone_nation_" + nation_id).addClass('nation_selected');
  
  // Store the selection
  standalone_config.nation_id = nation_id;
}

/****************************************************************************
  Start the standalone game with configured settings
****************************************************************************/
function start_standalone_game_with_config()
{
  // Validate nation selection
  if (standalone_config.nation_id == -1) {
    swal("Nation required", "Please select a nation before starting the game.", "warning");
    return;
  }

  // Get settings from form
  standalone_config.map_type = $("#standalone_map_type").val();
  standalone_config.map_xsize = parseInt($("#standalone_map_xsize").val());
  standalone_config.map_ysize = parseInt($("#standalone_map_ysize").val());
  standalone_config.ai_players = parseInt($("#standalone_ai_players").val());

  // Validate settings
  if (isNaN(standalone_config.map_xsize) || standalone_config.map_xsize < 20 || standalone_config.map_xsize > 1000) {
    swal("Invalid map width", "Map width must be between 20 and 1000.", "error");
    return;
  }
  if (isNaN(standalone_config.map_ysize) || standalone_config.map_ysize < 20 || standalone_config.map_ysize > 1000) {
    swal("Invalid map height", "Map height must be between 20 and 1000.", "error");
    return;
  }
  if (isNaN(standalone_config.ai_players) || standalone_config.ai_players < 0 || standalone_config.ai_players > 1000) {
    swal("Invalid AI players", "Number of AI players must be between 0 and 1000.", "error");
    return;
  }

  // Close the dialog
  $("#standalone_pregame_dialog").dialog('close');

  // Update standalone constants with configured values
  STANDALONE_MAP_WIDTH = standalone_config.map_xsize;
  STANDALONE_MAP_HEIGHT = standalone_config.map_ysize;
  STANDALONE_AI_PLAYERS = standalone_config.ai_players;
  STANDALONE_MAP_TYPE = standalone_config.map_type;

  // Set standalone mode flag
  standalone_mode = true;
  
  // Store the chosen nation for use during game initialization
  chosen_nation = standalone_config.nation_id;

  console.log("[Standalone Pregame] Starting game with config:", standalone_config);

  try {
    init_standalone();
    
    // Setup the standalone environment (network overrides, etc.)
    if (typeof setup_standalone_environment !== 'function') {
      throw new Error("setup_standalone_environment function not found.");
    }
    setup_standalone_environment();
    
    // Start the standalone game with a slight delay to allow sprites to load
    var delay = (typeof STANDALONE_STARTUP_DELAY_MS !== 'undefined') ? STANDALONE_STARTUP_DELAY_MS : 1000;

    start_standalone_game();

  } catch (error) {
    console.error("Error starting singleplayer standalone game:", error);
    swal("Error", "Failed to start singleplayer game: " + error.message, "error");
  }
}
