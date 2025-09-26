/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivX.net/
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

/* The server will send information about its settings. It is stored here.
 * You can look up a setting by its name or by its id number. */
var server_settings = {};

var statsview = null;

/****************************************************************
 The "options" file handles actual "options", and also view options,
 message options, dialog/report settings, cma settings, server settings,
 and global worklists.
*****************************************************************/

/** Defaults for options normally on command line **/

var default_user_name = "";
var default_server_host = "localhost";
//var  default_server_port = DEFAULT_SOCK_PORT;
//var default_metaserver = META_URL;
var default_theme_name = "human";
var default_tileset_name = "";
var default_sound_set_name = "stdsounds";
var default_sound_plugin_name = "";

var sounds_enabled = true;
var show_unit_in_label = true;

var save_options_on_exit = TRUE;
var fullscreen_mode = FALSE;

/** Local Options: **/

var solid_color_behind_units = FALSE;
var sound_bell_at_new_turn = FALSE;
var  smooth_move_unit_msec = 30;
var smooth_center_slide_msec = 200;
var do_combat_animation = TRUE;
var ai_manual_turn_done = TRUE;
var auto_center_on_unit = TRUE;
var auto_center_on_combat = FALSE;
var auto_center_each_turn = TRUE;
var wakeup_focus = TRUE;
var goto_into_unknown = TRUE;
var center_when_popup_city = TRUE;
var concise_city_production = FALSE;
var auto_turn_done = FALSE;
var meta_accelerators = TRUE;
var ask_city_name = TRUE;
var popup_new_cities = TRUE;
var popup_actor_arrival = true;
var keyboardless_goto = TRUE;
var enable_cursor_changes = TRUE;
var separate_unit_selection = FALSE;
var unit_selection_clears_orders = TRUE;
var highlight_our_names = "yellow";

/* This option is currently set by the client - not by the user. */
var update_city_text_in_refresh_tile = TRUE;
var minimap_color = 1;   // draw minimap in primary,secondary, or tertiary colors

var draw_city_outlines = TRUE;
var draw_city_output = FALSE;
var draw_map_grid = FALSE;
var draw_city_names = TRUE;
var draw_city_growth = TRUE;
var draw_city_productions = FALSE;
var draw_city_buycost = FALSE;
var draw_city_traderoutes = FALSE;
var draw_terrain = TRUE;
var draw_coastline = FALSE;
var draw_roads_rails = TRUE;
var draw_irrigation = TRUE;
var draw_mines = TRUE;
var draw_fortress_airbase = TRUE;
var draw_huts = TRUE;
var draw_resources = TRUE;
var draw_pollution = TRUE;
var draw_cities = TRUE;
var draw_units = TRUE;
var draw_focus_unit = FALSE;
var draw_fog_of_war = TRUE;
var draw_borders = TRUE;
var draw_full_citybar = TRUE;
var draw_unit_shields = TRUE;
var player_dlg_show_dead_players = TRUE;
var reqtree_show_icons = TRUE;
var reqtree_curved_lines = FALSE;
var show_buildings = true;

var dialogs_minimized_setting = false;
var tile_info_popup_setting = true;
var options_init = false;

function init_options_dialog()
{
  if (options_init) {
    return;
  }
  options_init = true;

  $("#save_button").button("option", "label", "Save Game (Ctrl+S)");
  $("#surrender_button").button("option", "label", "Surrender Game");
  $("#end_button").button("option", "label", "End Game");
  $("#fullscreen_button").button("option", "label", "Fullscreen");


  var existing_timeout = game_info['timeout'];
  if (existing_timeout == 0) $("#timeout_info").html("(0 = no timeout)");
  $("#timeout_setting").val(existing_timeout);

  $('#timeout_setting').change(function() {
    var new_timeout = parseInt($('#timeout_setting').val());
    if (new_timeout >= 1 && new_timeout <= 29) {
      swal("Invalid timeout specified. Must be 0 or more than 30 seconds.");
    } else {
      send_message("/set timeout " + new_timeout);
    }
  });

  if (audio != null && !audio.source.src) {
    if (!supports_mp3()) {
      audio.load("/music/" + music_list[Math.floor(Math.random() * music_list.length)] + ".ogg");
    } else {
      audio.load("/music/" + music_list[Math.floor(Math.random() * music_list.length)] + ".mp3");
    }
  }

  $(".setting_button").tooltip();


  $('#dialogs_minimized_setting').change(function() {
    dialogs_minimized_setting = this.checked;
    simpleStorage.set('dialogs_minimized_setting', dialogs_minimized_setting);
  });

  $('#tile_info_popup_setting').change(function() {
    tile_info_popup_setting = this.checked;
    simpleStorage.set('tile_info_popup_setting', tile_info_popup_setting);
    if (!tile_info_popup_setting) {
      $("#tile_dialog").remove();
    }
  });
  tile_info_popup_setting = simpleStorage.get("tile_info_popup_setting", "");
  if (tile_info_popup_setting) {
    $("#tile_info_popup_setting").prop("checked", true);
  }


  $('#openai_setting').change(function() {
    openai_enabled = this.checked;
    simpleStorage.set("openai_enabled", openai_enabled);
  });
  var stored_openai_setting = simpleStorage.get("openai_setting", "");
  if (stored_openai_setting != null && !stored_openai_setting ) {
    $("#openai_setting").prop("checked", false);
    openai_setting = false;
  } else {
    $("#openai_setting").prop("checked", true);
  }

  $('#play_sounds_setting').prop('checked', sounds_enabled);

  $('#play_sounds_setting').change(function() {
    sounds_enabled = this.checked;
    simpleStorage.set('sndFX', sounds_enabled);
  })

  $('#borders_setting').prop('checked', draw_borders);
  $('#borders_setting').change(function() {
    draw_borders = this.checked;
    terrain_material.uniforms.borders_visible.value = draw_borders;
    terrain_material.uniforms.borders_visible.needsUpdate = true;
  });

  $('#show_buildings_setting').prop('checked', show_buildings);
  $('#show_buildings_setting').change(function() {
    show_buildings = this.checked;
    update_show_city_buildings();
  });

  if (is_speech_supported()) {
    $('#speech_enabled_setting').prop('checked', speech_enabled);
    $('#speech_enabled_setting').change(function() {
      speech_enabled = this.checked;
    });
  } else {
    $('#speech_enabled_setting').attr('disabled', true);
  }

  $('#graphics_quality_options').change(function() {
    graphics_quality = parseFloat($('#graphics_quality_options').val());
    simpleStorage.set("graphics_quality", graphics_quality);
    if (!webgpu) {
      add_quality_dependent_objects_webgl();
    } else {
      add_quality_dependent_objects_webgpu();
    }

  });
  $("#graphics_quality_options").val(graphics_quality);


}

function show_fps()
{
  if (statsview != null) {
    $(statsview).hide();
    $("#fps_button").text("Show fps");
    statsview = null;
  } else {

    stats = new Stats();
    stats.showPanel( 0);
    document.querySelector("#mapview_canvas_div").appendChild( stats.dom );
    set_default_mapview_active();
    statsview = stats.dom;
    $("#fps_button").text("Hide fps");
    $(statsview).css("top",  ($(window).height() - 60 ) + "px");
    $(statsview).css("left",  "5px");
  }

}
