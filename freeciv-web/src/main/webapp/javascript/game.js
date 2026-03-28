/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.freecivx.com/
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

var game_info = null;
var calendar_info = null;
var game_rules = null;
var ruleset_control = null;
var ruleset_summary = null;
var ruleset_description = null;

// IDENTITY_NUMBER_ZERO is defined in fc_types.js

function game_init()
{
  map = {};
  terrains = {};
  resources = {};
  players = {};
  units = {};
  unit_types = {};
  connections = {};
  client.conn = {};

}

function game_find_city_by_number(id)
{
  return cities[id];
}

/**************************************************************************
  Find unit out of all units in game: now uses fast idex method,
  instead of looking through all units of all players.
**************************************************************************/
function game_find_unit_by_number(id)
{
  return units[id];
}

/**************************************************************************
 Count the # of thousand citizen in a civilisation.
**************************************************************************/
function civ_population(playerno) {
  var population = 0;

  for (var city_id in cities) {
    var pcity = cities[city_id];
    if (playerno == pcity['owner']) {
      population += city_population(pcity);
    }
  }
  return numberWithCommas(population * 1000);
}


/**************************************************************************
  ...
**************************************************************************/
function update_game_status_panel() {

  if (C_S_RUNNING != client_state()) return;

  var status_html = "";

  if (client.conn.playing != null) {
    var pplayer = client.conn.playing;
    var tax = client.conn.playing['tax'];
    var lux = client.conn.playing['luxury'];
    var sci = client.conn.playing['science'];

    var net_income = pplayer['expected_income'];
    if (pplayer['expected_income'] > 0) {
      net_income = "+" + pplayer['expected_income'];
    }

    var pnation = nations[pplayer['nation']];
    var flag_file = pnation['graphic_str'] + ".svg";
    var gov_name = governments[client.conn.playing['government']]['name'];

    var gov_img_map = {
      "Anarchy": "anarchy", "Despotism": "despotism", "Monarchy": "monarchy",
      "Communism": "communism", "Republic": "republic", "Democracy": "democracy",
      "Fundamentalism": "fundamentalism", "Theocracy": "theocracy",
      "Federation": "federation", "Nationalism": "nationalism"
    };
    var gov_img = gov_img_map[gov_name] || "despotism";

    // Player name + flag
    status_html += "<span class='status-player'>";
    status_html += "<b class='status-player-name'>" + pplayer['name'] + "</b>";
    status_html += "<img src='/images/flags/" + flag_file + "' class='status-flag' title='" + pnation['adjective'] + "'>";
    status_html += "</span>";

    // Government (clickable)
    status_html += "<span class='status-gov' onclick='javascript:show_revolution_dialog()' title='" + gov_name + "'>";
    status_html += "<img class='lowered_gov' src='/images/gov." + gov_img + ".png'>";
    status_html += "</span>";

    // Population
    status_html += "<span class='status-item status-population'>";
    status_html += "<i class='fas fa-person status-icon' title='Population'></i>";
    status_html += "<b>" + civ_population(client.conn.playing.playerno) + "</b>";
    status_html += "</span>";

    // Year / Turn
    status_html += "<span class='status-item status-year'>";
    status_html += "<i class='far fa-clock status-icon' title='Year (turn)'></i>";
    status_html += "<b>" + get_year_string() + "</b>";
    status_html += "</span>";

    // Gold
    var gold_class = pplayer['expected_income'] >= 0 ? "" : "negative_net_income";
    status_html += "<span class='status-item status-gold'>";
    status_html += "<i class='fas fa-coins status-icon' title='Gold (net income)'></i>";
    status_html += "<b class='" + gold_class + "' title='Gold (net income)'>";
    status_html += pplayer['gold'] + " (" + net_income + ")</b>";
    status_html += "</span>";

    // Rates: tax / luxury / science
    status_html += "<span class='status-item status-rates'>";
    status_html += "<i class='fas fa-landmark status-icon' title='Tax rate'></i><b>" + tax + "</b>%";
    status_html += "<i class='fas fa-music status-icon' title='Luxury rate'></i><b>" + lux + "</b>%";
    status_html += "<i class='fas fa-flask status-icon' title='Science rate'></i><b>" + sci + "</b>%";
    status_html += "</span>";

  } else if (server_settings != null && server_settings['metamessage'] != null) {
    status_html += server_settings['metamessage']['val'] + " Observing - ";
    status_html += "Turn: <b>" + game_info['turn'] + "</b>";
  }

  if ($(window).width() - sum_width() > 700) {
    if ($("#game_status_panel_top").length) {
      $("#game_status_panel_top").show();
      $("#game_status_panel_bar").hide();
      $("#game_status_panel_top").html(status_html);
    }
  } else {
    if ($("#game_status_panel_bar").length) {
      $("#game_status_panel_top").hide();
      $("#game_status_panel_bar").show();
      $("#game_status_panel_bar").css("width", $(window).width());
      $("#game_status_panel_bar").html(status_html);
    }
  }

  var page_title = "Freecivx.com - " + username + "  turn:" + game_info['turn'];
  if (server_settings['metamessage'] != null) {
    page_title += server_settings['metamessage']['val'];
  }
  document.title = page_title;


}

/**************************************************************************
  Returns the year and turn as a string.
**************************************************************************/
function get_year_string()
{
  var year_string = "";
  if (game_info['year'] < 0) {
    year_string = Math.abs(game_info['year'])
                  + calendar_info['negative_year_label'] + " ";
  } else if (game_info['year'] >= 0) {
    year_string = game_info['year']
                  + calendar_info['positive_year_label'] + " ";
  }
  year_string += "Turn:" + game_info['turn'];
  return year_string;
}

/**************************************************************************
  Return timeout value for the current turn.
**************************************************************************/
function current_turn_timeout()
{
  if (game_info['turn'] == 1 && game_info['first_timeout'] != -1) {
    return game_info['first_timeout'];
  } else {
    return game_info['timeout'];
  }
}



/**************************************************************************
  ...
**************************************************************************/
function sum_width()
{
  var sum=0;
  $("#tabs_menu").children().each( function(){
    if ($(this).is(":visible") && $(this).attr('id') != "game_status_panel_top") sum += $(this).width();
  });
  return sum;
}

