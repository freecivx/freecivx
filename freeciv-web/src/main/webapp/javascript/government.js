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
var GOVT_TAB_OVERVIEW = 0;
var GOVT_TAB_REVOLUTION = 1;
var GOVT_TAB_TAXRATES = 2;
var GOVT_TAB_REPORTS = 3;




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
  
  // Update overview tab
  update_govt_overview_tab_content();
}

/**************************************************************************
   Updates the overview tab content
**************************************************************************/
function update_govt_overview_tab_content()
{
  if (client_is_observer() || client.conn.playing == null) return;
  
  var govt = governments[client.conn.playing['government']];
  var overview_html = "<div class='govt-overview'>";
  overview_html += "<p><strong>Current Government:</strong> " + govt['name'] + "</p>";
  overview_html += "<p>" + govt['helptext'] + "</p>";
  overview_html += "</div>";
  
  $("#govt_tabs-overview").html(overview_html);
}

/**************************************************************************
   Updates the revolution tab content inline
**************************************************************************/
function update_revolution_tab_content()
{
  if (client_is_observer() || client.conn.playing == null) return;

  var dhtml = "<div class='govt-dialog-current'>"
      + "<strong>Current government:</strong> " + governments[client.conn.playing['government']]['name']
	  + "</div>"
      + "<div class='govt-dialog-instructions'>Select a new form of government to start the revolution:</div>"
  + "<div id='governments'>"
  + "<div id='governments_list'>"
  + "</div></div>"
  + "<div style='margin-top: 20px;'>"
  + "<button id='start_revolution_button' class='button' onclick='start_revolution_from_tab();'>Start Revolution!</button>"
  + "</div>";

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
  var index = $("#civ_tab").parent().children().index($("#civ_tab"));
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
  }, 100);
}

/**************************************************************************
   ...
**************************************************************************/
function show_revolution_dialog()
{
  switch_to_govt_subtab(GOVT_TAB_REVOLUTION);
  
  // Update content after switching
  setTimeout(function() {
    update_revolution_tab_content();
  }, 150);
}

/**************************************************************************
   ...
**************************************************************************/
function init_civ_dialog()
{
  if (!client_is_observer() && client.conn.playing != null) {

    var pplayer = client.conn.playing;
    var pnation = nations[pplayer['nation']];
    var tag = pnation['graphic_str'];

    var civ_description = "<div>" + nations[pplayer['nation']]['legend']  +"</div><br>";
    $("#nation_title").html(pplayer['name'] + " rules the " + nations[pplayer['nation']]['adjective']
                            	    + " with government form " + governments[client.conn.playing['government']]['name']);
    $("#civ_dialog_text").html(civ_description);
    if (!pnation['customized']) {
        $("#civ_dialog_flag").html("<img src='/images/flags/" + tag + ".svg' width='220'>");
    }
  } else {
    $("#civ_dialog_text").html("Observing.");

  }

  // Initialize the government tabs
  if ($("#govt_tabs").length > 0) {
    $("#govt_tabs").tabs();
    update_govt_tab_content();
  }

}


/**************************************************************************
   ...
**************************************************************************/
function update_govt_dialog()
{
  var govt;
  var govt_id;
  if (client_is_observer()) return;

  var governments_list_html = "";

  for (govt_id in governments) {
    govt = governments[govt_id];
    governments_list_html += "<button class='govt_button' id='govt_id_" + govt['id'] + "' "
	                  + "onclick='set_req_government(" + govt['id'] + ");' "
			  + "title='" + govt['helptext'] + "'>" +  govt['name'] + "</button>";
  }

  $("#governments_list").html(governments_list_html);

  for (govt_id in governments) {
    govt = governments[govt_id];
    if (!can_player_get_gov(govt_id)) {
      $("#govt_id_" + govt['id'] ).button({ disabled: true, label: govt['name'], icon: govt['rule_name'], iconPosition: "beginning"});
    } else if (requested_gov == govt_id) {
    $("#govt_id_" + govt['id'] ).button({label: govt['name'], icon: govt['rule_name'], iconPosition: "beginning"}).css("background", "green");
    } else if (client.conn.playing['government'] == govt_id) {
      $("#govt_id_" + govt['id'] ).button({label: govt['name'], icon: govt['rule_name'], iconPosition: "beginning"}).css("background", "#BBBBFF").css("font-weight", "bolder");
    } else {
      $("#govt_id_" + govt['id'] ).button({label: govt['name'], icon: govt['rule_name'], iconPosition: "beginning"});
    }
  }
  $(".govt_button").tooltip();

}


/**************************************************************************
   ...
**************************************************************************/
function start_revolution()
{
  if (requested_gov != -1) {
    send_player_change_government(requested_gov);
    requested_gov = -1;
  }
}

/**************************************************************************
   ...
**************************************************************************/
function set_req_government(gov_id)
{
  requested_gov = gov_id;
  update_govt_dialog();
}

/**************************************************************************
 ...
**************************************************************************/
function send_player_change_government(govt_id)
{
  var packet = {"pid" : packet_player_change_government,
                "government" : govt_id };
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
 ...
**************************************************************************/
function request_report(rtype)
{
  var packet = {"pid"  : packet_report_req,
                "type" : rtype};
  send_request(JSON.stringify(packet));
}
