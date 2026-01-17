/**********************************************************************
'use strict';

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

/* The server will send information about its settings. It is stored here.
 * You can look up a setting by its name or by its id number. */
const server_settings = {};

const statsview = null;

/****************************************************************
 The "options" file handles actual "options", and also view options,
 message options, dialog/report settings, cma settings, server settings,
 and global worklists.
*****************************************************************/

/** Defaults for options normally on command line **/

const default_user_name = "";
const default_server_host = "localhost";
//const default_server_port = DEFAULT_SOCK_PORT;
//const default_metaserver = META_URL;
const default_theme_name = "human";
const default_tileset_name = "";
const default_sound_set_name = "stdsounds";
const default_sound_plugin_name = "";

const sounds_enabled = true;
const show_unit_in_label = true;

const save_options_on_exit = TRUE;
const fullscreen_mode = FALSE;

/** Local Options: **/

const solid_color_behind_units = FALSE;
const sound_bell_at_new_turn = FALSE;
const smooth_move_unit_msec = 30;
const smooth_center_slide_msec = 200;
const do_combat_animation = TRUE;
const ai_manual_turn_done = TRUE;
const auto_center_on_unit = TRUE;
const auto_center_on_combat = FALSE;
const auto_center_each_turn = TRUE;
const wakeup_focus = TRUE;
const goto_into_unknown = TRUE;
const center_when_popup_city = TRUE;
const concise_city_production = FALSE;
const auto_turn_done = FALSE;
const meta_accelerators = TRUE;
const ask_city_name = TRUE;
const popup_new_cities = TRUE;
const popup_actor_arrival = true;
const keyboardless_goto = TRUE;
const enable_cursor_changes = TRUE;
const separate_unit_selection = FALSE;
const unit_selection_clears_orders = TRUE;
const highlight_our_names = "yellow";

/* This option is currently set by the client - not by the user. */
const update_city_text_in_refresh_tile = TRUE;
const minimap_color = 1;   // draw minimap in primary,secondary, or tertiary colors

const draw_city_outlines = TRUE;
const draw_city_output = FALSE;
const draw_map_grid = FALSE;
const draw_city_names = TRUE;
const draw_city_growth = TRUE;
const draw_city_productions = FALSE;
const draw_city_buycost = FALSE;
const draw_city_traderoutes = FALSE;
const draw_terrain = TRUE;
const draw_coastline = FALSE;
const draw_roads_rails = TRUE;
const draw_irrigation = TRUE;
const draw_mines = TRUE;
const draw_fortress_airbase = TRUE;
const draw_huts = TRUE;
const draw_resources = TRUE;
const draw_pollution = TRUE;
const draw_cities = TRUE;
const draw_units = TRUE;
const draw_focus_unit = FALSE;
const draw_fog_of_war = TRUE;
const draw_borders = TRUE;
const draw_full_citybar = TRUE;
const draw_unit_shields = TRUE;
const player_dlg_show_dead_players = TRUE;
const reqtree_show_icons = TRUE;
const reqtree_curved_lines = FALSE;
const show_buildings = true;

const dialogs_minimized_setting = false;
const tile_info_popup_setting = true;
const options_init = false;

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


  const existing_timeout = game_info['timeout'];
  if (existing_timeout == 0) $("#timeout_info").html("(0 = no timeout)");
  $("#timeout_setting").val(existing_timeout);

  $('#timeout_setting').change(function() {
    const new_timeout = parseInt($('#timeout_setting').val());
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
  const stored_openai_setting = simpleStorage.get("openai_setting", "");
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

    add_quality_dependent_objects_webgl();

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
