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

var governments = {};
var requested_gov = -1;

var REPORT_WONDERS_OF_THE_WORLD = 0;
var REPORT_WONDERS_OF_THE_WORLD_LONG = 1;
var REPORT_TOP_CITIES = 2;
var REPORT_DEMOGRAPHIC = 3;
var REPORT_ACHIEVEMENTS = 4;

// Government dialog responsive width constants
var GOVT_DIALOG_MAX_WIDTH = 650;
var GOVT_DIALOG_DESKTOP_MARGIN = 40;
var GOVT_DIALOG_MOBILE_BREAKPOINT = 520;
var GOVT_DIALOG_MOBILE_MARGIN = 20;
var GOVT_DIALOG_MOBILE_MAX_WIDTH = 400;

// Government tab indices
var GOVT_TAB_NATION = 0;
var GOVT_TAB_REVOLUTION = 1;
var GOVT_TAB_TAXRATES = 2;
var GOVT_TAB_WONDERS = 3;
var GOVT_TAB_CITIES = 4;
var GOVT_TAB_DEMOGRAPHICS = 5;
var GOVT_TAB_SPACESHIP = 6;

// Tab switching delay for rendering (in milliseconds)
var TAB_SWITCH_DELAY_MS = 100;

// Track which report tab is active for content updates
var current_report_tab = null;




/**************************************************************************
   Updates the content of the government tabs
**************************************************************************/
function update_govt_tab_content()
{
  if (client_is_observer()) return;

  // Update revolution tab content
  update_revolution_tab_content();
  
  // Update tax rates tab content
  update_taxrates_tab_content();
  
  // Update nation info with government info
  update_nation_govt_info();
}

/**************************************************************************
  Updates the nation info tab with government information
**************************************************************************/
function update_nation_govt_info()
{
  if (client_is_observer() || client.conn.playing == null) return;
  
  const govt = governments[client.conn.playing['government']];
  const govt_html = `
    <div class='govt-overview govt-overview-nation'>
      <p><strong>Current Government:</strong> ${govt['name']}</p>
      <p>${govt['helptext']}</p>
    </div>`;
  
  $("#nation_govt_info").html(govt_html);
}

/**************************************************************************
  Updates the revolution tab content inline
**************************************************************************/
function update_revolution_tab_content()
{
  if (client_is_observer() || client.conn.playing == null) return;

  const dhtml = `
    <div class='govt-dialog-current'>
      <strong>Current government:</strong> ${governments[client.conn.playing['government']]['name']}
    </div>
    <div class='govt-dialog-instructions'>Select a new form of government to start the revolution:</div>
    <div id='governments'>
      <div id='governments_list'></div>
    </div>
    <div style='margin-top: 20px;'>
      <button id='start_revolution_button' class='button' onclick='start_revolution_from_tab();'>Start Revolution!</button>
    </div>`;

  $("#revolution_content").html(dhtml);
  update_govt_dialog();
}

/**************************************************************************
   Starts a revolution from the inline tab
**************************************************************************/
function start_revolution_from_tab()
{
  start_revolution();
  // Refresh the content after revolution
  update_revolution_tab_content();
}

/**************************************************************************
   Gets the index of the government tab in the main tabs
**************************************************************************/
function get_govt_tab_index()
{
  var civTab = $("#civ_tab");
  var index = civTab.parent().children().index(civTab);
  return index >= 0 ? index : 1; // Default to 1 if not found
}

/**************************************************************************
   Switches to the government tab and a specific sub-tab
**************************************************************************/
function switch_to_govt_subtab(subtab_index)
{
  var govt_tab_index = get_govt_tab_index();
  $("#tabs").tabs("option", "active", govt_tab_index);
  
  // Wait for the tab to render, then switch to the sub-tab
  setTimeout(function() {
    if ($("#govt_tabs").length > 0) {
      $("#govt_tabs").tabs("option", "active", subtab_index);
    }
  }, TAB_SWITCH_DELAY_MS);
}

/**************************************************************************
  Shows the revolution dialog by switching to the revolution tab
**************************************************************************/
function show_revolution_dialog()
{
  switch_to_govt_subtab(GOVT_TAB_REVOLUTION);
  
  // Update content after switching
  setTimeout(function() {
    update_revolution_tab_content();
  }, TAB_SWITCH_DELAY_MS * 1.5);
}

/**************************************************************************
  Initializes the civilization dialog with nation info and government tabs
**************************************************************************/
function init_civ_dialog()
{
  if (!client_is_observer() && client.conn.playing != null) {

    const pplayer = client.conn.playing;
    const pnation = nations[pplayer['nation']];
    const tag = pnation['graphic_str'];

    const civ_description = `<div>${nations[pplayer['nation']]['legend']}</div><br>`;
    const nation_title = `${pplayer['name']} rules the ${nations[pplayer['nation']]['adjective']} with government form ${governments[client.conn.playing['government']]['name']}`;
    
    $("#nation_title").html(nation_title);
    $("#civ_dialog_text").html(civ_description);
    if (!pnation['customized']) {
        $("#civ_dialog_flag").html(`<img src='/images/flags/${tag}.svg' width='220'>`);
    }
  } else {
    $("#nation_title").html("Observing");
    $("#civ_dialog_text").html("");
    $("#civ_dialog_flag").html("");
  }

  // Initialize the government tabs
  if ($("#govt_tabs").length > 0) {
    $("#govt_tabs").tabs({
      activate: function(event, ui) {
        handle_govt_tab_activation(ui.newPanel.attr('id'));
      }
    });
    update_govt_tab_content();
  }

}


/**************************************************************************
  Updates the government dialog with available governments
**************************************************************************/
function update_govt_dialog()
{
  if (client_is_observer()) return;

  let governments_list_html = "";

  for (const govt_id in governments) {
    const govt = governments[govt_id];
    governments_list_html += `<button class='govt_button' id='govt_id_${govt['id']}' 
                  onclick='set_req_government(${govt['id']});' 
                  title='${govt['helptext']}'>${govt['name']}</button>`;
  }

  $("#governments_list").html(governments_list_html);

  for (const govt_id in governments) {
    const govt = governments[govt_id];
    if (!can_player_get_gov(govt_id)) {
      $(`#govt_id_${govt['id']}`).button({ disabled: true, label: govt['name'], icon: govt['rule_name'], iconPosition: "beginning"});
    } else if (requested_gov == govt_id) {
      $(`#govt_id_${govt['id']}`).button({label: govt['name'], icon: govt['rule_name'], iconPosition: "beginning"}).css("background", "green");
    } else if (client.conn.playing['government'] == govt_id) {
      $(`#govt_id_${govt['id']}`).button({label: govt['name'], icon: govt['rule_name'], iconPosition: "beginning"}).css("background", "#BBBBFF").css("font-weight", "bolder");
    } else {
      $(`#govt_id_${govt['id']}`).button({label: govt['name'], icon: govt['rule_name'], iconPosition: "beginning"});
    }
  }
  $(".govt_button").tooltip();

}


/**************************************************************************
  Starts a revolution with the selected government
**************************************************************************/
function start_revolution()
{
  if (requested_gov != -1) {
    send_player_change_government(requested_gov);
    requested_gov = -1;
  }
}

/**************************************************************************
  Sets the requested government
**************************************************************************/
function set_req_government(gov_id)
{
  requested_gov = gov_id;
  update_govt_dialog();
}

/**************************************************************************
  Sends a request to change the player's government
**************************************************************************/
function send_player_change_government(govt_id)
{
  const packet = {
    "pid": packet_player_change_government,
    "government": govt_id
  };
  send_request(JSON.stringify(packet));
}

/**************************************************************************
 Returns the max tax rate for a given government.
 FIXME: This shouldn't be hardcoded, but instead fetched
 from the effects.
**************************************************************************/
function government_max_rate(govt_id)
{
  if (govt_id == 0) {
    // Anarchy
    return 100;
  } else if (govt_id == 1) {
    //Despotism
    return 60;
  } else if (govt_id == 2) {
    // Monarchy
    return 70;
  } else if (govt_id == 3) {
    //Communism
    return 80;
  } else if (govt_id == 4) {
    //Republic
    return 80;
  } else if (govt_id == 5) {
    //Democracy
    return 100;
  }

  return 100;
}

/**************************************************************************
  Returns true iff the player can get the specified government.

  Uses the JavaScript implementation of the requirement system. Is
  therefore limited to the requirement types and ranges the JavaScript
  requirement system can evaluate.
**************************************************************************/
function can_player_get_gov(govt_id)
{
  return (player_has_wonder(client.conn.playing.playerno, 63) //hack for statue of liberty
          || are_reqs_active(client.conn.playing,
                      null,
                      null,
                      null,
                      null,
                      null,
                      null,
                      governments[govt_id]["reqs"],
                      RPT_CERTAIN));
}

/**************************************************************************
  Handles tab activation to load content on demand
**************************************************************************/
function handle_govt_tab_activation(tab_id)
{
  if (client_is_observer()) return;
  
  switch(tab_id) {
    case 'govt_tabs-wonders':
      load_wonders_tab();
      break;
    case 'govt_tabs-cities':
      load_cities_tab();
      break;
    case 'govt_tabs-demographics':
      load_demographics_tab();
      break;
    case 'govt_tabs-spaceship':
      load_spaceship_tab();
      break;
  }
}

/**************************************************************************
  Loads wonders report into tab
**************************************************************************/
function load_wonders_tab()
{
  $("#wonders_content").html("<p>Loading Wonders report...</p>");
  request_report(REPORT_WONDERS_OF_THE_WORLD_LONG);
  
  // Store which tab we're loading for
  current_report_tab = 'wonders';
}

/**************************************************************************
  Loads top cities report into tab
**************************************************************************/
function load_cities_tab()
{
  $("#cities_content").html("<p>Loading Top Cities report...</p>");
  request_report(REPORT_TOP_CITIES);
  
  // Store which tab we're loading for
  current_report_tab = 'cities';
}

/**************************************************************************
  Loads demographics report into tab
**************************************************************************/
function load_demographics_tab()
{
  $("#demographics_content").html("<p>Loading Demographics report...</p>");
  request_report(REPORT_DEMOGRAPHIC);
  
  // Store which tab we're loading for
  current_report_tab = 'demographics';
}

/**************************************************************************
  Loads spaceship info into tab
**************************************************************************/
function load_spaceship_tab()
{
  if (client_is_observer()) return;

  var spaceship = spaceship_info[client.conn.playing['playerno']];
  var message = "";

  message += "<div class='spaceship-info'>";
  message += "<h3>Spaceship</h3>";
  message += "<p><strong>Progress:</strong> " + get_spaceship_state_text(spaceship['sship_state']) + "</p>";
  message += "<p><strong>Success probability:</strong> " + Math.floor(spaceship['success_rate'] * 100) + "%</p>";
  message += "<p><strong>Travel time:</strong> " + Math.floor(spaceship['travel_time']) + " years</p>";
  message += "<p><strong>Components:</strong> " + spaceship['components'] + "</p>";
  message += "<p><strong>Energy Rate:</strong> " + Math.floor(spaceship['energy_rate'] * 100) + "%</p>";
  message += "<p><strong>Support Rate:</strong> " + Math.floor(spaceship['support_rate'] * 100) + "%</p>";
  message += "<p><strong>Habitation:</strong> " + spaceship['habitation'] + "</p>";
  message += "<p><strong>Life Support:</strong> " + spaceship['life_support'] + "</p>";
  message += "<p><strong>Mass:</strong> " + spaceship['mass'] + " tons</p>";
  message += "<p><strong>Modules:</strong> " + spaceship['modules'] + "</p>";
  message += "<p><strong>Population:</strong> " + spaceship['population'] + "</p>";
  message += "<p><strong>Propulsion:</strong> " + spaceship['propulsion'] + "</p>";
  message += "<p><strong>Solar Panels:</strong> " + spaceship['solar_panels'] + "</p>";
  message += "<p><strong>Structurals:</strong> " + spaceship['structurals'] + "</p>";
  if (spaceship['launch_year'] != 9999) message += "<p><strong>Launch year:</strong> " + spaceship['launch_year'] + "</p>";

  if (game_info['victory_conditions'] == 0) {
    message = "<div class='spaceship-info'><p>Spaceship victory disabled.</p>";
  }

  message += "<p style='margin-top: 15px;'><em>Launch a spaceship to Alpha Centauri! To build a spaceship build the Apollo program wonder, Factory, then lots of Space Components, Space Modules and Space Structurals (10+ each) in a city. "
   + "For help, see the Space Race page in the manual.</em></p>";

  if (spaceship['sship_state'] == SSHIP_STARTED && spaceship['success_rate'] > 0) {
    message += "<div style='margin-top: 20px;'>";
    message += "<button id='launch_spaceship_button' class='button' onclick='launch_spaceship_from_tab();'>Launch Spaceship!</button>";
    message += "</div>";
  }
  message += "</div>";

  $("#spaceship_content").html(message);
}

/**************************************************************************
  Launches spaceship from the tab
**************************************************************************/
function launch_spaceship_from_tab()
{
  launch_spaceship();
  // Refresh the content after launch
  setTimeout(function() {
    load_spaceship_tab();
  }, 1000);
}

/**************************************************************************
  Displays report content in the appropriate tab
**************************************************************************/
function show_report_in_tab(headline, message)
{
  if (current_report_tab == 'wonders') {
    $("#wonders_content").html("<div class='report-content'><h3>" + headline + "</h3>" + message + "</div>");
  } else if (current_report_tab == 'cities') {
    $("#cities_content").html("<div class='report-content'><h3>" + headline + "</h3>" + message + "</div>");
  } else if (current_report_tab == 'demographics') {
    $("#demographics_content").html("<div class='report-content'><h3>" + headline + "</h3>" + message + "</div>");
  }
  current_report_tab = null;
}


/**************************************************************************
  Requests a report from the server
**************************************************************************/
function request_report(rtype)
{
  const packet = {
    "pid": packet_report_req,
    "type": rtype
  };
  send_request(JSON.stringify(packet));
}
