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

var observing = false;
var chosen_nation = -1;
var chosen_style = -1;
var choosing_player = -1;
var ai_skill_level = 3;
var nation_select_id = -1;
var metamessage_changed = false;
var logged_in_with_password = false;
var antialiasing_setting = true;
var password_reset_count = 0;

/****************************************************************************
  ...
****************************************************************************/
function pregame_start_game()
{
  if (client.conn['player_num'] == null) return;

  var test_packet = {"pid" : packet_player_ready, "is_ready" : true,
                     "player_no": client.conn['player_num']};
  var myJSONText = JSON.stringify(test_packet);
  send_request(myJSONText);

  setup_window_size ();
}

/****************************************************************************
  ...
****************************************************************************/
function observe()
{
  if (observing) {
    $("#observe_button").button("option", "label", "Observe Game");
    send_message("/detach");

  } else {
    $("#observe_button").button("option", "label", "Don't observe");
    send_message("/observe");
  }

  observing = !observing;
}

/****************************************************************************
  Show information about the current game
****************************************************************************/
function update_game_info_pregame()
{
  var game_info_html = "";

  if (C_S_PREPARING != client_state()) {
    /* The game has already started. */
    return;
  }

  if (scenario_info != null && scenario_info['is_scenario']) {
    /* Show the scenario description. */
    game_info_html += "<p>";
    game_info_html += scenario_info['description'].replace(/\n/g, "<br>");
    game_info_html += "</p>";

    if (scenario_info['authors']) {
      /* Show the scenario authors. */
      game_info_html += "<p>";
      game_info_html += "Scenario by ";
      game_info_html += scenario_info['authors'].replace(/\n/g, "<br>");
      game_info_html += "</p>";
    }

    if (scenario_info['prevent_new_cities']) {
      /* Make sure that the player is aware that cities can't be built. */
      game_info_html += "<p>";
      game_info_html += scenario_info['name']
                        + " forbids the founding of new cities.";
      game_info_html += "</p>";
    }
  }

  if ($.getUrlVar('action') == "multi") {
    game_info_html += "<p>";
    game_info_html += "<h2>Freecivx.net Multiplayer game</h2>-You are now about to play a multiplayer game.<br>-Please wait until at least 2 players have joined the game, then click the start game button.";
    game_info_html += "</p>";
    game_info_html += "";
  }

  $("#pregame_game_info").html(game_info_html);
  $("#multiplayer_invite_player").button();
  $("#multiplayer_invite_player").click(show_invite_player_dialog);

  /* Update pregame_message_area's height. */
  setup_window_size();


    setInterval(checkInvitations, 120000);
    checkInvitations();
}

/****************************************************************************
  Shows the pick nation dialog.
****************************************************************************/
function update_player_info_pregame()
{
  var id;
  if (C_S_PREPARING == client_state()) {
    var player_html = "";
    for (id in players) {
      var player = players[id];
      if (player != null) {
        if (player['name'].indexOf("AI") != -1) {
          player_html += "<div id='pregame_plr_" + id
		        + "' class='pregame_player_name'><div id='pregame_ai_icon'></div><b>"
                        + player['name'] + "</b></div>";
        } else {
          player_html += "<div id='pregame_plr_" + id
		        + "' class='pregame_player_name'><div id='pregame_player_icon'></div><b>"
                        + player['name'] + "</b></div>";
        }
      }
    }
    $("#pregame_player_list").html(player_html);

    /* show player ready state in pregame dialog */
    for (id in players) {
      var player = players[id];
      var nation_text = "";
      if (player['nation'] in nations) {
        nation_text = " - " + nations[player['nation']]['adjective'];
        var flag_html = $("<canvas id='pregame_nation_flags_" + id + "' width='44' height='30' class='pregame_flags'></canvas>");
        $("#pregame_plr_"+id).prepend(flag_html);
        var flag_canvas = document.getElementById('pregame_nation_flags_' + id);
        if (flag_canvas == null) continue;
        var flag_canvas_ctx = flag_canvas.getContext("2d");
        var tag = "f." + nations[player['nation']]['graphic_str'];
        if (sprites[tag] != null && flag_canvas_ctx != null) {
          flag_canvas_ctx.drawImage(sprites[tag], 0, 0);
        }
      }
      if (player['is_ready'] == true) {
        $("#pregame_plr_"+id).addClass("pregame_player_ready");
        $("#pregame_plr_"+id).attr("title", "Player ready" + nation_text);
      } else if (player['name'].indexOf("AI") == -1) {
          $("#pregame_plr_"+id).attr("title", "Player not ready" + nation_text);
      } else {
          $("#pregame_plr_"+id).attr("title", "AI Player (random nation)");
      }
      $("#pregame_plr_"+id).attr("name", player['name']);
      $("#pregame_plr_"+id).attr("playerid", player['playerno']);

    }
    $(".pregame_player_name").tooltip();

    var pregame_context_items = {
            "pick_nation": {name: "Pick nation"},
            "observe_player": {name: "Observe this player"},
            "take_player": {name: "Take this player"},
            "aitoggle_player": {name: "Aitoggle player"},
            "sep1": "---------",
            "novice": {name: "Novice"},
            "easy": {name: "Easy"},
            "normal": {name: "Normal"},
            "hard": {name: "Hard"},
            "cheating": {name: "Cheating"},
            "sep2": "---------"
       };

      $("#pregame_player_list").contextMenu({
        selector: '.pregame_player_name',
        callback: function(key, options) {
            var name = $(this).attr('name');
            if (name != null && name.indexOf(" ") != -1) name = name.split(" ")[0];
            var playerid = parseInt($(this).attr('playerid'));
            if (key == "take_player") {
              send_message("/take " + name);
            } else if (key == "pick_nation") {
              pick_nation(playerid);
            } else if (key == "aitoggle_player") {
              send_message("/aitoggle " + name);
            } else if (key == "observe_player") {
              send_message("/observe " + name);
            } else if (key == "novice") {
              send_message("/novice " + name);
            } else if (key == "easy") {
              send_message("/easy " + name);
            } else if (key == "normal") {
              send_message("/normal " + name);
            } else if (key == "hard") {
              send_message("/hard " + name);
            } else if (key == "cheating") {
              send_message("/cheating " + name);
            }
        },
        items: pregame_context_items
      });

    /* set state of Start game button depending on if user is ready. */
    if (client.conn['player_num'] != null  && client.conn['player_num'] in players
        && players[client.conn['player_num']]['is_ready'] == true) {
        $("#start_game_button").button( "option", "disabled", true);
    } else {
        $("#start_game_button").button( "option", "disabled", false);
    }
  }
}


/****************************************************************************
  Shows the pick nation dialog.
****************************************************************************/
function pick_nation(player_id)
{
  if (player_id == null) player_id = client.conn['player_num'];
  var pplayer = players[player_id]; 
  choosing_player = player_id;

  if (pplayer == null) return; 

  var nations_html = "<div id='nation_heading'><span>Select nation for " + pplayer['name'] + ":</span> <br>"
                  + "<input id='nation_autocomplete_box' type='text' size='20'>"
		  + "<div id='nation_choice'></div></div> <div id='nation_list'> ";

  /* prepare a list of flags and nations. */
  var nation_name_list = [];
  for (var nation_id in nations) {
    var pnation = nations[nation_id];
    if (pnation['is_playable']) {
      nations_html += "<div class='nation_pickme_line' onclick='select_nation(" + nation_id + ");'>"
             + "<div id='nation_" + nation_id + "' class='nation_choice'>"
             + "<canvas id='pick_flag_" + nation_id + "' width='44' height='30' class='pick_nation_flags'></canvas>"
             + pnation['adjective'] + "</div></div>";
      nation_name_list.push(pnation['adjective']);
    }
  }

  nations_html += "</div>"
               + "<div id='nation_legend'></div><div id='select_nation_flag'></div>";

  $("#pick_nation_dialog").html(nations_html);
  $("#pick_nation_dialog").attr("title", "Choose your nation wisely.");
  $("#pick_nation_dialog").dialog({
			bgiframe: true,
			modal: true,
			width: is_small_screen() ? "99%" : "70%",
            height: $(window).height() - 150,
			buttons: {
			    "Customize this nation": function() {
                   show_customize_nation_dialog(player_id);
            	}
            				,
				"Play this nation!": function() {
					$("#pick_nation_dialog").dialog('close');
					submit_nation_choice();
				}
			}
		});

  $("#nation_legend").html("Please choose nation for " + pplayer['name'] + ".");


  $("#nation_autocomplete_box").autocomplete({
      source: nation_name_list,
      close: function (event, ui) { update_nation_selection(); }
  });

  if (is_small_screen()) {
    $("#select_nation_flag").hide();
    $("#nation_legend").hide();
    $("#nation_style_choices").hide();
    $("#nation_list").width("80%");
  }

  nation_select_id = setTimeout (update_nation_selection, 150);
  $("#pick_nation_dialog").dialog('open');

  for (var nation_id in nations) {
    var pnation = nations[nation_id];
    if (pnation['is_playable']) {
      var flag_canvas = document.getElementById('pick_flag_' + nation_id);
      var flag_canvas_ctx = flag_canvas.getContext("2d");
      var tag = "f." + pnation['graphic_str'];

      if (tileset[tag] == null) continue;

      flag_canvas_ctx.drawImage(sprites[tag], 0, 0);
    }
  }

  if (chosen_nation != -1) {
    select_nation(chosen_nation);
  }
}

/****************************************************************************
 This function is called when the nation select autocomplete box has been used,
 and it will call select_nation based on the user's choice.
****************************************************************************/
function update_nation_selection()
{
  var nation_name = $("#nation_autocomplete_box").val();
  if (nation_name == null || nation_name.length == 0) return;
  if (C_S_RUNNING == client_state()) return;

  for (var nation_id in nations) {
    var pnation = nations[nation_id];
    if (pnation['is_playable'] && pnation['adjective'].toLowerCase() == nation_name.toLowerCase()) {
      select_nation(nation_id);
      return;
    }
  }
}

/****************************************************************************
  Updates the choose nation dialog with the selected nation.
****************************************************************************/
function select_nation(new_nation_id)
{
  var pnation = nations[new_nation_id];
  $("#nation_legend").html(pnation['legend']);
  $("#nation_autocomplete_box").val(pnation['adjective']);
  $("#nation_" + chosen_nation).css("background-color", "transparent");
  $("#nation_choice").html("Chosen nation: " + pnation['adjective']);

  if (!pnation['customized']) {
    $("#select_nation_flag").html("<img id='nation_flag_choice' src='/images/flags/"
		            + pnation['graphic_str'] + ".svg'>");
  }

  if (chosen_nation != new_nation_id && $("#nation_" + new_nation_id).length > 0) {
    $("#nation_" + new_nation_id).get(0).scrollIntoView();
  }

  chosen_nation = parseFloat(new_nation_id);
  $("#nation_" + chosen_nation).css("background-color", "#FFFFFF");
}

/****************************************************************************
  ...
****************************************************************************/
function submit_nation_choice()
{
  if (chosen_nation == -1 || client.conn['player_num'] == null 
      || choosing_player == null || choosing_player < 0) return;

  var pplayer = players[choosing_player];
  if (pplayer == null) return;

  var leader_name = pplayer['name']; 

  if (pplayer['flags'].isSet(PLRF_AI)) {
    leader_name = nations[chosen_nation]['leader_name'][0];
  }

  var style = nations[chosen_nation]['style'];
  if (chosen_style != -1) {
    style = chosen_style;
  }

  var test_packet = {"pid" : packet_nation_select_req,
                     "player_no" : choosing_player,
                     "nation_no" : chosen_nation,
                     "is_male" : true, /* FIXME */
                     "name" : leader_name,
                     "style" : style};
  send_request(JSON.stringify(test_packet));
  clearInterval(nation_select_id);

}

/***************************************************************************
  Returns the ruleset directory of the ruleset based on its name.
***************************************************************************/
function ruledir_from_ruleset_name(ruleset_name, fall_back_dir)
{
  /* HACK: find current ruleset dir based on its name. */
  switch (ruleset_name) {
  case "Classic ruleset":
    return "classic";
  case "Civ2Civ3 ruleset":
    return "civ2civ3";
  case "Multiplayer ruleset":
    return "multiplayer";
  case "Webperimental":
    return "webperimental";
  default:
    console.log("Don't know the ruleset dir of \"" + ruleset_name
                + "\". Guessing \"" + fall_back_dir + "\".");
    return fall_back_dir;
  }
}

/***************************************************************************
  Show the full description of the current ruleset.
***************************************************************************/
function show_ruleset_description_full() {
  var id = "#long_help_dialog";

  if (ruleset_control == null) return;

  $(id).remove();
  $("<div id='long_help_dialog'></div>").appendTo("div#pregame_page");

  $(id).html(helpdata_format_current_ruleset());

  $(id).dialog({
                 title   : ruleset_control['name'],
                 buttons : {
                   Close : function () {
                     $(id).dialog('close');
                   }
                 },
                 height  : $("#pregame_settings").dialog("option",
                                                         "height"),
                 width   : "80%"
               });
}

/****************************************************************************
 Shows the pregame settings dialog.
****************************************************************************/
function pregame_settings()
{
  var id = "#pregame_settings";
  $(id).remove();
  $("<div id='pregame_settings'></div>").appendTo("div#pregame_page");

  var dhtml = "<div id='pregame_settings_tabs'>" +
      "   <ul>" +
      "     <li><a href='#pregame_settings_tabs-1'>Game</a></li>" +
      "     <li><a href='#pregame_settings_tabs-2'>3D WebGL,WebGPU</a></li>" +
      "     <li><a href='#pregame_settings_tabs-3'>AI Chat, LLM, Other</a></li>" +
      "   </ul>" +
      "<div id='pregame_settings_tabs-1'><br><table id='settings_table'> " +
      "<tr title='Ruleset version'><td>Ruleset:</td>" +
      "<td><select name='ruleset' id='ruleset'>" +
      "<option value='classic'>Classic</option>" +
      "<option value='civ2civ3'>Civ2Civ3</option>" +
      "</select><a id='ruleset_description'></a></td></tr>" +
      "<tr title='Set metaserver info line'><td>Game title:</td>" +
	  "<td><input type='text' name='metamessage' id='metamessage' size='28' maxlength='42'></td></tr>" +
	  "<tr class='not_pbem' title='Total number of players (including AI players)'><td>Number of Players (including AI):</td>" +
	  "<td><input type='number' name='aifill' id='aifill' size='4' length='3' min='0' max='50' step='1'></td></tr>" +
	  "<tr class='not_pbem' title='Maximum seconds per turn'><td>Timeout (seconds per turn):</td>" +
	  "<td><input type='number' name='timeout' id='timeout' size='4' length='3' min='30' max='3600' step='1'></td></tr>" +
          "<tr class='not_pbem' title='Creates a private game where players need to know this password in order to join.'><td>Password for private game:</td>" +
	  "<td><input type='text' name='password' id='password' size='10' length='10'></td></tr>" +
	  "<tr title='Map size X'><td>Map X size (width):</td>" +
	  "<td><input type='number' name='xsize' id='xsize' size='5' length='3' min='1' max='256' step='1'></td></tr>" +
	  "<tr title='Map size Y'><td>Map Y size (height):</td>" +
	  "<td><input type='number' name='ysize' id='ysize' size='5' length='3' min='1' max='256' step='1'></td></tr>" +
	  "<tr class='not_pbem' title='This setting sets the skill-level of the AI players'><td>AI skill level:</td>" +
	  "<td><select name='skill_level' id='skill_level'>" +
	      "<option value='1'>Restricted</option>" +
	      "<option value='2'>Novice</option>" +
	      "<option value='3'>Easy</option>" +
          "<option value='4'>Normal</option>" +
          "<option value='5'>Hard</option>" +
          "<option value='6'>Cheating</option>" +
	  "</select></td></tr>"+
	  "<tr title='Number of initial techs per player'><td>Tech level:</td>" +
	  "<td><input type='number' name='techlevel' id='techlevel' size='3' length='3' min='0' max='100' step='10'></td></tr>" +
	  "<tr title='This setting gives the approximate percentage of the map that will be made into land.'><td>Landmass:</td>" +
	  "<td><input type='number' name='landmass' id='landmass' size='3' length='3' min='15' max='85' step='10'></td></tr>" +
	  "<tr title='Amount of special resource squares'><td>Specials:</td>" +
	  "<td><input type='number' name='specials' id='specials' size='4' length='4' min='0' max='1000' step='50'></td></tr>" +
      "<tr title='World temperature from 0 to 100. 0 is fully arctic, 100 is fully desert.'><td>Temperature:</td>" +
          "<td><input type='number' name='temperature' id='temperature' size='3' length='3' min='0' max='100' step='10'></td></tr>" +
	  "<tr title='Minimum distance between cities'><td>City mindist :</td>" +
	  "<td><input type='number' name='citymindist' id='citymindist' size='4' length='4' min='1' max='9' step='1'></td></tr>" +
          "<tr title='The game will end at the end of the given turn.'><td>End turn:</td>" +
	  "<td><input type='number' name='endturn' id='endturn' size='4' length='4' min='0' max='32767' step='1'></td></tr>" +
      "<tr id='killstack_area'><td id='killstack_label'></td>" +
          "<td><input type='checkbox' id='killstack_setting'>Enable killstack</td></tr>" +
	  "<tr title='Method used to generate map'><td>Map generator:</td>" +
	  "<td><select name='generator' id='generator'>" +
          "<option value='RANDOM'>Fully random height</option>" +
          "<option value='FRACTAL'>Pseudo-fractal height</option>" +
          "<option value='ISLAND'>Island-based</option>" +
          "<option value='FAIR'>Fair islands</option>" +
          //"<option value='FRACTURE'>Fracture map</option>" + FIXME: this one doesnt work.
    "</select></td></tr>"
    + "</table><br>"+
	  "<span id='settings_info'><i>Freeciv-web can be customized using the command line in many " +
          "other ways also. Type /help in the command line for more information.</i></span></div>" +

      "<div id='pregame_settings_tabs-2'>"+
      "<br><span id='settings_info'><i>3D WebGL requires a fast computer with 3D graphics card, such as Nvidia GeForce and at least 3GB of RAM. " +
      "Here you can configure the 3D WebGL version:</i></span><br><br>" +
	    "<table id='settings_table'>" +
	    "<tr title='Graphics quality level'><td>Graphics quality:</td>" +
        	  "<td><select name='graphics_quality' id='graphics_quality'>" +
              "<option value='2'>Medium</option>" +
              "<option value='3'>High</option>" +
              "</select></td></tr>"+
	    "<tr id='3d_antialiasing_enabled'><td id='3d_antialiasing_label' style='min-width: 150px;'><br></td>" +
        "<td><input type='checkbox' id='3d_antialiasing_setting' checked>Enable antialiasing (game looks nicer, but is slower)</td></tr>" +
        "<tr><td style='min-width: 150px;'>Benchmark of 3D WebGL version:</td>" +
                "<td><button id='bechmark_run' type='button' class='benchmark button'>Run benchmark</button></td></tr>" +
        "<tr id='anaglyph_enabled'><td id='anaglyph_label' style='min-width: 150px;'></td>" +
                "<td><input type='checkbox' id='anaglyph_setting'>Enable Anaglyph 3D (Red+Cyan glasses) "+
                "</td></tr>"+

          "<tr><td style='min-width: 150px;'>Enable experimental WebGPU renderer:</td>" +
          "<td><button id='webgpu_enable' type='button' class='webgpu button'>WebGPU renderer</button></td></tr>" +

         "</table>" +
      "</div>" +

      "<div id='pregame_settings_tabs-3'> <br><br>" +
	    "<table id='settings_table'>" +
	    "<tr id='speech_enabled'><td id='speech_label'></td>" +
        "<td><input type='checkbox' id='speech_setting'>Enable speech audio messages</td></tr>" +
	    "<tr id='voice_row'><td id='voice_label'></td>" +
        "<td><select name='voice' id='voice'></select></td></tr>" +
        "</table>" +
      "</div>"
	  ;
  $(id).html(dhtml);

  $(id).attr("title", "Game Settings");
  $(id).dialog({
			bgiframe: true,
			modal: true,
			width: is_small_screen() ? "98%" : "60%",
            height: is_small_screen() ?  $(window).height() - 40 : $(window).height() - 250,
			 buttons: {
				Ok: function() {
					$("#pregame_settings").dialog('close');
					if (benchmark_start > 0) {
					  $(window).unbind('beforeunload');
                      alert("Reloading game to setup new graphics quality.");
					  location.reload();
					}
				}
			  }
  });

  $("#pregame_settings_tabs").tabs();

  if (game_info != null) {
    $("#aifill").val(game_info['aifill']);
    $("#timeout").val(game_info['timeout']);
    $("#skill_level").val(ai_skill_level);
  }

  if (server_settings['techlevel'] != null
      && server_settings['techlevel']['val'] != null) {
    $("#techlevel").val(server_settings['techlevel']['val']);
  }

  if (server_settings['landmass'] != null
      && server_settings['landmass']['val'] != null) {
    $("#landmass").val(server_settings['landmass']['val']);
  }

  if (server_settings['temperature'] != null
        && server_settings['temperature']['val'] != null) {
        $("#temperature").val(server_settings['temperature']['val']);
    }

  if (server_settings['specials'] != null
      && server_settings['specials']['val'] != null) {
    $("#specials").val(server_settings['specials']['val']);
  }

  if (server_settings['citymindist'] != null
      && server_settings['citymindist']['val'] != null) {
    $("#citymindist").val(server_settings['citymindist']['val']);
  }

  if (server_settings['endturn'] != null
      && server_settings['endturn']['val'] != null) {
    $("#endturn").val(server_settings['endturn']['val']);
  }

  if (server_settings['xsize'] != null
      && server_settings['xsize']['val'] != null) {
    $("#xsize").val(server_settings['xsize']['val']);
  }

  if (server_settings['ysize'] != null
      && server_settings['ysize']['val'] != null) {
    $("#ysize").val(server_settings['ysize']['val']);
  }

  if (server_settings['killstack'] != null
      && server_settings['killstack']['val'] != null) {
    $("#killstack_setting").prop("checked",
                                 server_settings['killstack']['val']);
    $("#killstack_area").prop("title",
                              server_settings['killstack']['extra_help']);
    $("#killstack_label").prop("innerHTML",
                              server_settings['killstack']['short_help']);
  }

  if (server_settings['generator'] != null
      && server_settings['generator']['val'] != null) {
    /* TODO: Should probably be auto generated from setting so help text,
     * alternatives etc is kept up to date. */
    $("#generator").val(server_settings['generator']['support_names'][
                        server_settings['generator']['val']]);
  }

  if (server_settings['topology'] != null
        && server_settings['topology']['val'] != null) {
    if (server_settings['topology']['val'] == 2) {
      $("#topology").val(1); //hex
    } else {
      $("#topology").val(server_settings['topology']['val']);
    }
  }

  $("#3d_antialiasing_label").prop("innerHTML", "Antialiasing:");

  var stored_antialiasing_setting = simpleStorage.get("antialiasing_setting", "");
  if (stored_antialiasing_setting != null && stored_antialiasing_setting == "false") {
      $("#3d_antialiasing_setting").prop("checked", false);
      antialiasing_setting = false;
  }

  $('#3d_antialiasing_setting').change(function() {
    antialiasing_setting = !antialiasing_setting;
    simpleStorage.set("antialiasing_setting", antialiasing_setting ? "true" : "false");
  });

  if (is_speech_supported()) {
    $("#speech_setting").prop("checked", speech_enabled);
    $("#speech_label").prop("innerHTML", "Speech messages:");
    $("#voice_label").prop("innerHTML", "Voice:");
  } else {
    $("#speech_label").prop("innerHTML", "Speech messages:");
    $("#speech_setting").parent().html("Speech Synthesis API is not supported or enabled in your browser.");
  }

  $("#anaglyph_label").prop("innerHTML", "3D Anaglyph glasses:");
  $('#anaglyph_setting').change(function() {
    anaglyph_3d_enabled = !anaglyph_3d_enabled;
  });

  if (server_settings['metamessage'] != null
      && server_settings['metamessage']['val'] != null) {
    $("#metamessage").val(server_settings['metamessage']['val']);
  }

  if (ruleset_control != null) {
    $("#ruleset").val(ruledir_from_ruleset_name(ruleset_control['name'],
                                                "classic"));
  }

  if (scenario_info != null && scenario_info['is_scenario']) {
    /* A scenario may be bound to a ruleset. */
    $("#ruleset").prop("disabled", scenario_info['ruleset_locked']);
  }

  $(id).dialog('open');

  $('#aifill').change(function() {
    if (parseInt($('#aifill').val()) <= 50) {
      send_message("/set aifill " + $('#aifill').val());
    }
  });

  $('#metamessage').change(function() {
    send_message("/metamessage " + $('#metamessage').val());
    metamessage_changed = true;
  });

  $('#metamessage').bind('keyup blur',function(){
    var cleaned_text = $(this).val().replace(/[^a-zA-Z\s\-]/g,'');
    if ($(this).val() != cleaned_text) {
      $(this).val( cleaned_text ); }
    }
  );

  $('#mapview_font').change(function() {
    canvas_text_font =  $('#mapview_font').val();
  });

  $('#xsize').change(function() {
      send_message("/set xsize " + $('#xsize').val());
  });

  $('#ysize').change(function() {
      send_message("/set ysize " + $('#ysize').val());
  });

  $('#timeout').change(function() {
    send_message("/set timeout " + $('#timeout').val());
  });

  $('#techlevel').change(function() {
    send_message("/set techlevel " + $('#techlevel').val());
  });

  $('#specials').change(function() {
    send_message("/set specials " + $('#specials').val());
  });

  $('#landmass').change(function() {
    send_message("/set landmass " + $('#landmass').val());
  });

  $('#temperature').change(function() {
    send_message("/set temperature " + $('#temperature').val());
  });

  $('#citymindist').change(function() {
    send_message("/set citymindist " + $('#citymindist').val());
  });

  $('#endturn').change(function() {
    send_message("/set endturn " + $('#endturn').val());
  });

  $('#generator').change(function() {
    send_message("/set generator " + $('#generator').val());
  });

  $('#topology').change(function() {
    if ($('#topology').val() == 0) {
      send_message("/set topology="); // Not HEX, so it's ISO (but not really iso).
    } else {
      send_message("/set topology " + server_settings['topology']['support_names'][$('#topology').val()]);
    }
  });

  /* Make the long ruleset description available in the pregame. The
   * ruleset's README isn't located at the player's computer. */
  $('#ruleset_description').html(" description");
  $('#ruleset_description').click(show_ruleset_description_full);

  $('#ruleset').change(function() {
    change_ruleset($('#ruleset').val());
  });

  $('#password').change(function() {

    swal({   
      title: "Really set game password?",   
      text: "Setting a password on this game means that other players can not join this game " +
            "unless they know this password. In multiplayer games, be sure to ask the other players " +
            "about setting a password.",   
      type: "warning",   showCancelButton: true,   
      confirmButtonColor: "#DD6B55",   
      confirmButtonText: "Yes, set game password",   
      closeOnConfirm: true }, 
      function(){   
        var pwd_packet = {"pid" : packet_authentication_reply, "password" : $('#password').val()};
        send_request(JSON.stringify(pwd_packet));
        send_message("/metamessage Private password-protected game");
        metamessage_changed = true;
        $("#metamessage").prop('readonly', true);
        $("#metamessage_setting").prop('readonly', true);
        $("#password").prop('readonly', true);
     });
   });


  $('#skill_level').change(function() {
    ai_skill_level = parseFloat($('#skill_level').val());
    if (ai_skill_level == 1) {
      send_message("/restricted");
    } else if (ai_skill_level == 2) {
      send_message("/novice");
    } else if (ai_skill_level == 3) {
      send_message("/easy");
    } else if (ai_skill_level == 4) {
      send_message("/normal");
    } else if (ai_skill_level == 5) {
      send_message("/hard");
    } else if (ai_skill_level == 6) {
      send_message("/cheating");
    }
  });

  $('#killstack_setting').change(function() {
    if ($('#killstack_setting').prop('checked')) {
      send_message("/set killstack enabled");
    } else {
      send_message("/set killstack disabled");
    }
  });


  $('#graphics_quality').change(function() {
    graphics_quality = parseFloat($('#graphics_quality').val());
    simpleStorage.set("graphics_quality", graphics_quality);
    init_webgl_renderer();
  });

  $("#graphics_quality").val(graphics_quality);

  $(".benchmark").click(function() {
    swal({
      title: "Run benchmark?",
      text: "Do you want to run a benchmark now? This will start a new game and run measure the performance of a game playing for 30 turns.",
      type: "warning",
      showCancelButton: true,
      confirmButtonColor: "#DD6B55",
      confirmButtonText: "Yes, run benchmark!",
      closeOnConfirm: true
    },
    function(){
      webgl_benchmark_run();
    });
  });

  $(".benchmark").button();
  $("#show_voice_commands").button();

  $(".webgpu").click(function() {
    window.location.href = window.location.href + '?webgpu=true';
  });
  $(".webgpu").button();

  $(".webgpu").click(function() {
    window.location.href = window.location.href + '?webgpu=true';
  });
  $(".webgpu").button();

  $('#speech_setting').change(function() {
    if ($('#speech_setting').prop('checked')) {
      speech_enabled = true;
      speak_unfiltered("Speech enabled.");
    } else {
      speech_enabled = false;
    }
  });

  $('#voice').change(function() {
    voice = $('#voice').val();
  });

  if (is_speech_supported()) {
    load_voices();
    window.speechSynthesis.onvoiceschanged = function(e) {
      load_voices();
    };
  }

  $("#settings_table").tooltip();

  if (is_touch_device() || is_small_screen()) {
      $('#metamessage').blur();
  }

  $("#show_voice_commands").click(function() {
   show_dialog_message("Voice commands",
     "<b>Voice command - Explanation:</b> <br>" +
     "T, Turn - Turn Done<br>" +
     "Y, Yes, O, Ok   - Yes<br>" +
     "No - No<br>" +
     "B, Build, City   - Build city<br>" +
     "X - Explore<br>" +
     "I, Irrigation  - Irrigation<br>" +
     "Road  - Road<br>" +
     "A, Auto  - Auto settlers<br>" +
     "F, Fortify  - Fortify<br>" +
     "M, Mine  - Mine<br>" +
     "Wait  - Wait<br>" +
     "U, Up  - Move unit up<br>" +
     "D, Down  - Down<br>" +
     "L, Left  - Left<br>" +
     "R, Right  - Right<br>" +
     "N, North  - North<br>" +
     "S, South  - South<br>" +
     "E, East  - East<br>" +
     "W, West  - West<br>" +
     "North West, North East, South East, South West<br>"
      );
  });


}

/**************************************************************************
  Change the ruleset to
**************************************************************************/
function change_ruleset(to) {
    send_message("/rulesetdir " + to);
    // reset some ruleset defined settings.
    send_message("/set nationset all");

    swal("Ruleset changed. Settings have been reset.");

    setTimeout(pregame_settings, 800);
  }


/**************************************************************************
 Shows the Freeciv intro dialog.
**************************************************************************/
function show_intro_dialog(title, message) {

  if ($.getUrlVar('autostart') == "true") {
    autostart = true;
    return;
  }

  // reset dialog page.
  $("#dialog").remove();
  $("<div id='dialog'></div>").appendTo("div#game_page");

  var intro_html = message + "<br><br><table><tr><td>Player name:</td><td><input id='username_req' type='text' size='18' maxlength='31'></td></tr>"
      +  "<tr id='password_row'><td>Password:</td><td id='password_td'></td></tr></table>";

  $("#dialog").html(intro_html);

  $('#username_req').on('input', function() {
        this.value = this.value.toLowerCase();
  });

  var stored_username = simpleStorage.get("username", "");
  if (stored_username != null && stored_username != false) {
    $("#username_req").val(stored_username);
      if ($.getUrlVar('civserverport') != null) {
          pregame_handle_user(false);
          $("#fciv-intro").hide();
      }
  }
  $("#password_row").show();
  $("#password_td").html("<input id='password_req' type='password' size='18' maxlength='200' > <br> <div id='login_process'></div>");

  var stored_password = simpleStorage.get("password", "");
  if (stored_password != null && stored_password != false) {
    $("#password_req").val(stored_password);

  }
  var join_game_customize_text = "";
  if ($.getUrlVar('action') == "multi") {
    join_game_customize_text = "Join Game " + $.getUrlVar('civserverport');
  } else {
    join_game_customize_text = "Customize";
  }

  $("#dialog").attr("title", title);
  $("#dialog").dialog({
			bgiframe: false,
			modal: true,
			width: is_small_screen() ? "85%" : "38%",
            position: { my: "center", at: "center-0 center-100", of: window },
			buttons:
			[
			  {
				  text : "Start Game",
				  click : function() {
                     if (is_touch_device()) {
                       BigScreen.toggle();
                     }
					dialog_close_trigger = "button";
					autostart = true;
					pregame_handle_user(true);
                    $("#fciv-intro").hide();
				  },
				  icon: "ui-icon-play"
			  },
			  {
				  text : join_game_customize_text,
				  click : function() {
                    if (is_touch_device()) {
                      BigScreen.toggle();
                    }
					dialog_close_trigger = "button";
					pregame_handle_user(false);
				},
				icon :"ui-icon-gear"
			  },
              {
                  text : "New user",
                  click : function() {
                  	$("#fciv-intro").hide();
                    show_new_user_account_dialog();
                },
                icon : "ui-icon-person"
              },
              {
                text : "Load",
                click : function() {
                  dialog_close_trigger = "button";
                  pregame_handle_user(false);
                  wait_for_text("You are logged in as", function () {
                    show_load_game_dialog();
                  });
                },
                icon : "ui-icon-disk"
              }
			]

		}).dialogExtend({
                       "minimizable" : false,
                       "closable" : false
                               });

  if (($.getUrlVar('action') == "multi")
         && $.getUrlVar('load') != "tutorial") {
    $(".ui-dialog-buttonset button").first().hide();
  }

  if (is_small_screen()) {
    /* some fixes for pregame screen on small devices.*/
    $("#freeciv_logo").remove();
    $("#pregame_message_area").css("width", "73%");
    $("#observe_button").remove();
    $("#fciv-intro-txt").text("FreecivX.net is a open source empire-building strategy game inspired by the history of human civilization.");
  }

  $("#dialog").dialog('open');

  $('#dialog').keyup(function(e) {
    if (e.keyCode == 13) {
      dialog_close_trigger = "button";
      autostart = true;
      pregame_handle_user(false);
    }
  });

  if ($.getUrlVar('action') == "observe") {
    $(".ui-dialog-buttonset button").first().remove();
    $(".ui-dialog-buttonset button").first().button("option", "label", "Observe Game");
  }

  blur_input_on_touchdevice();

  $(".ui-widget-overlay").css("background-image", "url('/images/backgrounds/freecivx-splash-c.jpg')");
  $(".ui-widget-overlay").css("background-position", "center");
  $(".ui-widget-overlay").css("background-repeat", "no-repeat");
  $(".ui-widget-overlay").css("background-size", "cover");
  $(".ui-widget-overlay").css("opacity", "1.0");

  $(window).on("resize", function () {
    $("#dialog").dialog("option", "position", { my: "center", at: "center", of: window });
  });

  $("#pregame_custom_scrollbar_div").mCustomScrollbar({theme:"3d"});
  add_chatbox_text({message: 'Welcome to FreecivX. You can enter game commands, chat with players or ask the AI. Try the /help command or ask the AI. FreecivX is a free open source strategy game forked from Freeciv.', event : E_CHAT_MSG});
  $("#pregame_page").show();

}

/**************************************************************************
  Validate username
**************************************************************************/
function pregame_handle_user(close_pregame)
{
  var check_username = $("#username_req").val();
  if (check_username == null || check_username.length == 0) {
      $("#login_process").text("Please sign up as a new player. Username not found.");
    return;
  }
  $("#fciv-intro").hide();

  if ($.getUrlVar('action') === "local") {
      username = $("#username_req").val();
      $("#dialog").dialog('close');
      $("#password_req").val("");
      simpleStorage.set("password", "");
      $("#fciv-intro").hide();
      init_sprites();
      if (close_pregame) {
          $("#pregame_page").hide();
      }
      return;
  }

  $.ajax({
   type: 'POST',
   url: "/validate_user?userstring=" + check_username,
   success: function(data, textStatus, request){
      if (data == "user_does_not_exist") {
          $("#login_process").text("Please sign up as a new player. Username not found.");

          if (window.location.hostname === "localhost") {
              username = $("#username_req").val();
              $("#dialog").dialog('close');
              init_sprites();
              if (close_pregame) {
                  $("#pregame_page").hide();
              }
          }

      } else {
        username = $("#username_req").val().trim();
        var password = $("#password_req").val();
        if (password == null) {
          var stored_password = simpleStorage.get("password", "");
          if (stored_password != null && stored_password != false) {
            password = stored_password;
          }
        }

        if (password != null && password.length > 2) {
          var shaObj = new jsSHA("SHA-512", "TEXT");
          shaObj.update(password);
          var sha_password = encodeURIComponent(shaObj.getHash("HEX"));

          $.ajax({
           type: 'POST',
           url: "/login_user?username=" + encodeURIComponent(username) + "&sha_password=" + sha_password,
           success: function(data, textStatus, request){
               if (data != null && data.substring(0,2) == "OK") {
                 userid = data.split(",")[1];
                 simpleStorage.set("userid", userid);
                 simpleStorage.set("username", username);
                 simpleStorage.set("password", password);
                 /* Login OK! */
                 if (validate_username()) {
                   if (!is_touch_device()) $("#pregame_text_input").focus();
                   $("#dialog").dialog('close');
                   init_sprites();
                   if (close_pregame) {
                     $("#pregame_page").hide();
                   }
                 }
                 logged_in_with_password = true;
               } else {
                   $("#login_process").text("Please sign up as a new player. Username not found.");
               }

             },
           error: function (request, textStatus, errorThrown) {
             swal("Login user failed.");
           }
          });
        }

        $("#password_row").show();
        $("#password_req").focus();
        $("#password_td").html("<input id='password_req' type='password' size='25' maxlength='200'>  &nbsp; Account required, enter password.");
      }
    },
   error: function (request, textStatus, errorThrown) {
     console.log("For programmers and server admins: "
                 + "Please check if the meta server is running properly.");
     swal("Account not found. Please check username and password, and make sure that you verify your account by clicking on the link in the e-mail you got.");
   }
  });

}


/**************************************************************************
 Shows the create new user account with password dialog.
**************************************************************************/
function show_new_user_account_dialog(gametype)
{

  var title = "New user account";
  var message = "Create a new Freecivx.net user account:<br><br>"
                + "<table><tr><td>Username:</td><td><input id='username' type='text' size='25' maxlength='30'></td></tr>"
                + "<tr><td>Email:</td><td><input id='email' type='email' size='25' maxlength='64' ></td></tr>"
                + "<tr><td>Password:</td><td><input id='password' type='password' size='25'></td></tr>"
                + "<tr><td>Confim password:</td><td><input id='confirm_password' type='password' size='25'></td></tr></table><br>"
                + "<div id='username_validation_result' style='display:none;'></div>"
                + "Please verify your e-mail by clicking in the link in the e-mail you will get from us. Remember your username and password, since you will need this to log in later."
                + "<br>"
                + "<div id='new_user_extra_info'><small><ul><li>It is free and safe to create a new account on FreecivX.net.</li>"
                + "<li>A user account allows you to save and load games, and play in ranked multiplayer games.</li>"
                + "<li>You will not receive any spam and your e-mail address will be kept safe. Your password is stored securely as a secure hash.</li>"
                + "</ul></small></div>";

  // reset dialog page.
  $("#dialog").remove();
  $("<div id='dialog'></div>").appendTo("div#game_page");

  $("#dialog").html(message);
  $("#dialog").attr("title", title);
  $("#dialog").dialog({
			bgiframe: true,
			modal: true,
			width: is_small_screen() ? "90%" : "60%",
			buttons:
			{
                "Cancel" : function() {
	                  init_common_intro_dialog();
				},
				"New user" : function() {
				      create_new_freeciv_user_account_request("normal");

				}
			}
		});

  $("#dialog").dialog('open');


  $('#username').on('input', function() {
      this.value = this.value.toLowerCase();
  });

  $("#username").blur(function() {
   $.ajax({
     type: 'POST',
     url: "/validate_user?userstring=" + $("#username").val(),
     success: function(data, textStatus, request) {
        if (data != "user_does_not_exist") {
          $("#username_validation_result").html("The username is already taken. Please choose another username.");
          $("#username_validation_result").show();
          $(".ui-dialog-buttonset button").button("disable");
        } else {
          $("#email").blur(function() {
          $.ajax({
            type: 'POST',
            url: "/validate_user?userstring=" + $("#email").val(),
            success: function(data, textStatus, request) {
               if (data == "invitation") {
                 $("#username_validation_result").html("");
                 $("#username_validation_result").hide();
                 $(".ui-dialog-buttonset button").button("enable");
               } else {
                 $("#username_validation_result").html("The e-mail is already registered. Please choose another.");
                 $("#username_validation_result").show();
                 $(".ui-dialog-buttonset button").button("disable");

               }
             }
           });
         });
        }
      }
    });
  });

  if (is_small_screen()) {
    $("#new_user_extra_info").hide();
  }

}

/**************************************************************************
  This will try to create a new Freeciv-web user account with password.
**************************************************************************/
function create_new_freeciv_user_account_request(action_type)
{
  username = $("#username").val().trim().toLowerCase();
  var password = $("#password").val().trim();
  var confirm_password = $("#confirm_password").val().trim();
  var email = $("#email").val().trim();

  $("#username_validation_result").show();
  if (!is_username_valid_show(username)) {
    return false;
  }
  if (!validateEmail(email)) {
    $("#username_validation_result").html("Invalid email address.");
    return false;
  } else if (password == null || password.length <= 2 ) {
    $("#username_validation_result").html("Your password is too short.");
    return false;
  } else if (password != confirm_password) {
    $("#username_validation_result").html("The passwords do not match.");
    return false;
  }

  $("#username_validation_result").html("");
  $("#username_validation_result").hide();

  $("#dialog").parent().hide();

  var shaObj = new jsSHA("SHA-512", "TEXT");
  shaObj.update(password);
  var sha_password = encodeURIComponent(shaObj.getHash("HEX"));

  $.ajax({
   type: 'POST',
   url: "/create_user?username=" + encodeURIComponent(username) + "&email=" + encodeURIComponent(email)
            + "&password=" + sha_password,
   success: function(data, textStatus, request){
       simpleStorage.set("username", username);
       simpleStorage.set("password", password);
       if (data.substring(0,2) == "OK") {
         userid = data.split(",")[1];
         simpleStorage.set("userid", userid);
       }

       $("#dialog").dialog('close');
       logged_in_with_password = true;
       init_sprites();
      },
   error: function (request, textStatus, errorThrown) {
     $("#dialog").parent().show();
     swal("Creating new user failed.");
   }
  });
}

/**************************************************************************
  Customize nation: choose nation name and upload new flag.
**************************************************************************/
function show_customize_nation_dialog(player_id) {
  if (chosen_nation == -1 || client.conn['player_num'] == null
      || choosing_player == null || choosing_player < 0) return;

  var pnation = nations[chosen_nation];

  // reset dialog page.
  $("#dialog").remove();
  $("<div id='dialog'></div>").appendTo("div#game_page");

  var message = "<br>"
       + "Upload new flag: <input type='file' id='newFlagFileInput'><br><br>"
       + "For best results scale the image to 29 x 20 pixels before uploading. <br><br>"
       + "(Note: the customized nation and flag will only be active during the current game session and will not be visible to other players.)";

  $("#dialog").html(message);
  $("#dialog").attr("title", "Customize nation: " + pnation['adjective']);
  $("#dialog").dialog({
			bgiframe: true,
			modal: true,
			width: is_small_screen() ? "90%" : "50%",
			buttons:
			{
                "Cancel" : function() {
                  $("#dialog").dialog('close');
                  pick_nation(player_id);
				},
				"OK" : function() {
				    handle_customized_nation(player_id);
				}
			}
		});

  $("#dialog").dialog('open');
}

/**************************************************************************
  Customize nation: choose nation name and upload new flag.
**************************************************************************/
function handle_customized_nation(player_id)
{
  var fileInput = document.getElementById('newFlagFileInput');
  var file = fileInput.files[0];

  if (file == null) {
    swal("Please upload a image file!");
    return;
  }

  if (!(window.FileReader)) {
    swal("Uploading files not supported");
    return;
  }

  var extension = file.name.substring(file.name.lastIndexOf('.'));
  console.log("New flag: " + file.type + " with extention " + extension);

  if (extension == '.png' || extension == '.bmp' || extension == '.jpg' || extension == '.jpeg' || extension == '.JPG') {
    var reader = new FileReader();
    reader.onload = function(e) {
      handle_new_flag(reader.result, player_id);
    };
    reader.readAsDataURL(file);
  } else {
    $.unblockUI();
    swal("Image file " + file.name + "  not supported: " + file.type);
  }

}

/**************************************************************************
  Update flag sprites based on user uploaded flags.
**************************************************************************/
function handle_new_flag(image_data, player_id) {
  var pnation = nations[chosen_nation];
  var flag_tag = "f." + pnation['graphic_str'];
  var shield_tag = "f.shield." + pnation['graphic_str'];

  var new_flag_canvas = document.createElement('canvas');
  new_flag_canvas.width = sprites[flag_tag].width;
  new_flag_canvas.height = sprites[flag_tag].height;
  sprites[flag_tag] = new_flag_canvas;
  var ctx_flag = new_flag_canvas.getContext("2d");

  var new_shield_canvas = document.createElement('canvas');
  new_shield_canvas.width = sprites[shield_tag].width;
  new_shield_canvas.height = sprites[shield_tag].height;
  sprites[shield_tag] = new_shield_canvas;
  var ctx_shield = new_shield_canvas.getContext("2d");

  var img = new Image();
  img.onload = function() {
      ctx_flag.drawImage(img, 0, 0, this.width, this.height, 0, 0, new_flag_canvas.width, new_flag_canvas.height);
      ctx_shield.drawImage(img, 0, 0, this.width, this.height, 0, 0, new_shield_canvas.width, new_shield_canvas.height);

      $("#dialog").dialog('close');
      pick_nation(player_id);
  };
  img.src = image_data;

  nations[chosen_nation]['customized'] = true;

}




/**************************************************************************
 Determines if the email is valid
**************************************************************************/
function validateEmail(email) {
    var checkemail = email;
    if (checkemail != null) checkemail = checkemail.replace("+", "");  // + is allowed.
    var re = /^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i;
    return re.test(checkemail);
}