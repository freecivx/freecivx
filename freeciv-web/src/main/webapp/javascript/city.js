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


var cities = {};
var city_rules = {};
var city_trade_routes = {};

var goods = {};

var active_city = null;
var worklist_dialog_active = false;
var production_selection = [];
var worklist_selection = [];

/* The city_options enum. */
var CITYO_DISBAND      = 0;
var CITYO_NEW_EINSTEIN = 1;
var CITYO_NEW_TAXMAN   = 2;
var CITYO_LAST         = 3;

var FEELING_BASE = 0;		/* before any of the modifiers below */
var FEELING_LUXURY = 1;		/* after luxury */
var FEELING_EFFECT = 2;		/* after building effects */
var FEELING_NATIONALITY = 3;  	/* after citizen nationality effects */
var FEELING_MARTIAL = 4;	/* after units enforce martial order */
var FEELING_FINAL = 5;		/* after wonders (final result) */

var MAX_LEN_WORKLIST = 64;

var INCITE_IMPOSSIBLE_COST = (1000 * 1000 * 1000);

var city_tab_index = 0;
var city_prod_clicks = 0;

var city_screen_updater = new EventAggregator(update_city_screen, 250,
                                              EventAggregator.DP_NONE,
                                              250, 3, 250);

/* Information for mapping workable tiles of a city to local index */
var city_tile_map = null;

var opt_show_unreachable_items = false;

var city_dialog_html = `
<div id="city_tabs">
  <ul>
    <li><a href="#city_tabs-1" onclick="javascript:city_tab_index=0;">Overview</a></li>
    <li><a href="#city_tabs-2" onclick="javascript:city_tab_index=1;">Production</a></li>
    <li><a href="#city_tabs-3" onclick="javascript:city_tab_index=2;">Traderoutes</a></li>
    <li class="extra_tabs_big" onclick="javascript:city_tab_index=3;"><a href="#city_tabs-4">Settings</a></li>
    <li><a href="#city_tabs-5" onclick="javascript:city_tab_index=4;">Governor</a></li>
  </ul>

  <div id="city_tabs-1">
    <div id="city_overview_tab" class="citydlg_tabs">
    <div id="city_viewport">
    <div id="specialist_panel">
    </div>

    <div class="city_panel">
      <div id="city_dialog_info">
	  <div></div>
	  <div style="float:left;">
	  <span id="city_size"></span>
	  <div id='city_production_overview'></div>
	  <div id='city_production_turns_overview'></div>
	</div>
	<div style="float: left; margin-top: -20px; padding-left: 20px;">
	  <table id="city_stats">
	  <tr><td>Food: </td><td id="city_food"></td></tr>
	  <tr><td>Prod: </td><td id="city_prod"></td></tr>
	  <tr><td>Trade: </td><td id="city_trade"></td></tr>
	  <tr><td>Gold:: </td><td id="city_gold"></td></tr>
	  <tr><td>Luxury: </td><td id="city_luxury"></td></tr>
	  <tr><td>Science: </td><td id="city_science"></td></tr>
	  <tr><td>Corruption: </td><td id="city_corruption"></td></tr>
	  <tr><td>Waste: </td><td id="city_waste"></td></tr>
	  <tr><td>Pollution: </td><td id="city_pollution"></td></tr>
      <tr><td>Culture: </td><td id="city_culture"></td></tr>
  	  </table>
        </div>
      </div>

    </div>
    <div id="city_improvements_panel" class="city_panel">
      <div style="clear: left;"></div>
      <div id="city_improvements">
        <div id="city_improvements_title">City Improvements:</div>
        <div id="city_improvements_list"></div>
      </div>

      <div id="city_present_units" >
        <div id="city_present_units_title">Present Units:</div>
        <div id="city_present_units_list"></div>
      </div>

      <div id="city_supported_units" >
        <div id="city_supported_units_title">Supported Units:</div>
        <div id="city_supported_units_list"></div>
      </div>

    </div>


  </div>
  </div>
  </div>
  <div id="city_tabs-2">
    <div id="city_production_tab" class="citydlg_tabs">
      <div id='worklist_left'>
        <div id='worklist_dialog_headline'></div>
        <div id='worklist_heading'>Target Worklist:</div><div id='city_current_worklist'></div>
      </div>
      <div id='worklist_right'>
        <div id='worklist_production_choices'></div>
      </div>
      <div id="worklist_control">
        <button type="button" class="button" onClick="city_insert_in_worklist();" id="city_worklist_insert_btn" title="Insert before first selected task, or first in the list"><i class="fa fa-chevron-left fa-fw"></i></button>
        <div class="wc_spacer"></div>
        <button type="button" class="button" onClick="city_worklist_task_up();" id="city_worklist_up_btn" style="height: 20%;" title="Move selected tasks up"><i class="fa fa-chevron-up fa-fw"></i></button>
        <button type="button" class="button" onClick="city_worklist_task_down();" id="city_worklist_down_btn" style="height: 20%;" title="Move selected tasks down"><i class="fa fa-chevron-down fa-fw"></i></button>
        <div class="wc_spacer"></div>
        <button type="button" class="button" onClick="city_exchange_worklist_task();" id="city_worklist_exchange_btn" title="Change selected tasks"><i class="fa fa-exchange fa-fw"></i></button>
        <div class="wc_spacer"></div>
        <button type="button" class="button" onClick="city_worklist_task_remove();" id="city_worklist_remove_btn" title="Remove selected tasks"><i class="fa fa-trash fa-fw"></i></button>
      </div>
    </div>
  </div>
  <div id="city_tabs-3">
    <div id="city_traderoutes_tab" class="citydlg_tabs"></div>
  </div>
  <div id="city_tabs-4">
    <div id="city_settings_tab" class="citydlg_tabs">
      <div id="city_disband_options" >
        <input id="disbandable_city" type="checkbox" name="disband_city0" value="disband_city0"/>Disband city if built settler at size 1.

        <br>
        <input id='show_unreachable_items' type='checkbox'/>Show unreachable worklist items<br/>

      </div>

    </div>
  </div>

    <div id="city_tabs-5">
        <div id="city_governor_tab" class="citydlg_tabs">
            <form name="cma_vals" id="cma_form" >
                <table border="0">
                    <tbody>
                    <tr>

                        <td>
                            <span style="">
                              <input id="cma_food" class="cma_checkbox" type="checkbox" name="cma_food" value="" onclick="button_pushed_toggle_cma();" />
                              <img style="" class="lowered_gov" src="/images/wheat.png">
                              <b>Food </b>
                            </span>
                        </td>
                        <td>
                            <span style="">
                              <input id="cma_shield" class="cma_checkbox" type="checkbox" name="cma_shield" value="" onclick="button_pushed_toggle_cma();" />
                              <img style="" class="lowered_gov" src="/images/shield14x18.png">
                              <b>Shield </b>
                            </span>
                        </td>
                        <td>
                            <span style="">
                              <input id="cma_trade" class="cma_checkbox" type="checkbox" name="cma_trade" value="" onclick="button_pushed_toggle_cma();" />
                              <img style="" class="lowered_gov" src="/images/trade.png">
                              <b>Trade </b>
                            </span>
                        </td>
                        <td>
                            <span style="">
                              <input id="cma_gold" class="cma_checkbox" type="checkbox" name="cma_gold" value="" onclick="button_pushed_toggle_cma();" />
                              <img style="" class="lowered_gov" src="/images/gold.png">
                              <b>Gold </b>
                           </span>
                        </td>
                        <td>
                            <span style="">
                              <input id="cma_luxury" class="cma_checkbox" type="checkbox" name="cma_luxury" value="" onclick="button_pushed_toggle_cma();" />
                              <img style="" class="lowered_gov" src="/images/lux.png">
                              <b>Luxury </b>
                            </span>
                        </td>
                        <td>
                           <span style="">
                              <input id="cma_science" class="cma_checkbox" type="checkbox" name="cma_science" value="" onclick="button_pushed_toggle_cma();" />
                              <img style="" class="lowered_gov" src="/images/sci.png">
                              <b>Science </b>
                           </span>
                        </td>

                    </tr>
                    </tbody>
                </table>
            </form>


        </div>
    </div>

</div>
`;

/**************************************************************************
 ...
**************************************************************************/
function city_tile(pcity)
{
  if (pcity == null) return null;

  return index_to_tile(pcity['tile']);
}

/**************************************************************************
 ...
**************************************************************************/
function city_owner_player_id(pcity)
{
  if (pcity == null) return null;
  return pcity['owner'];
}

/**************************************************************************
 ...
**************************************************************************/
function city_owner(pcity)
{
  return players[city_owner_player_id(pcity)];
}

/**************************************************************************
 Removes a city from the game
**************************************************************************/
function remove_city(pcity_id)
{
  if (pcity_id == null || client.conn.playing == null) return;
  var pcity = cities[pcity_id];
  if (pcity == null) return;

  var update = client.conn.playing.playerno &&
               city_owner(pcity).playerno == client.conn.playing.playerno;
  var ptile = city_tile(cities[pcity_id]);
  delete cities[pcity_id];
  update_city_position(ptile);
  if (update) {
    city_screen_updater.update();
    bulbs_output_updater.update();
  }
}

/**************************************************************************
 ...
**************************************************************************/
function is_city_center(city, tile) {
  return (city['tile'] == tile['index']);
}

/**************************************************************************
 ...
**************************************************************************/
function is_free_worked(city, tile) {
  return (city['tile'] == tile['index']);
}

/**************************************************************************
 ...
 **************************************************************************/
function is_primary_capital(city)
{
  return city['capital'] == CAPITAL_PRIMARY;
}

/**************************************************************************
 ...
**************************************************************************/
function show_city_dialog_by_id(pcity_id)
{
  show_city_dialog(cities[pcity_id]);
}

/**************************************************************************
 Show the city dialog.
**************************************************************************/
function show_city_dialog(pcity)
{
  var turns_to_complete;
  var sprite;
  var punit;

  if (active_city != pcity || active_city == null) {
    city_prod_clicks = 0;
    production_selection = [];
    worklist_selection = [];
  }

  if (active_city != null) close_city_dialog();
  active_city = pcity;
  if (pcity == null) return;
  map_known_dirty = true;

  // reset dialog page.
  $("#city_dialog").remove();
  $("<div id='city_dialog'></div>").appendTo("div#game_page");



  $("#city_dialog").html(city_dialog_html);

  highlight_map_tile_selected(city_tile(pcity).x, city_tile(pcity).y);

  show_city_traderoutes();

  var dialog_buttons = {};
  dialog_buttons = $.extend(dialog_buttons,
  {
     "Change production" : city_change_production,
     "Add to worklist" : city_add_to_worklist
  });

  if (!is_small_screen()) {
    dialog_buttons = $.extend(dialog_buttons,
      {
       "Rename" : rename_city
     });
   } else {
       dialog_buttons = $.extend(dialog_buttons,
         {
          "Next" : next_city
        });
   }
  if (pcity['buy_cost'] > 0) {
    dialog_buttons = $.extend(dialog_buttons, {"Buy (B)": request_city_buy});
  }
  if (!is_small_screen()) {
    dialog_buttons = $.extend(dialog_buttons, {"Previous city": previous_city});
    dialog_buttons = $.extend(dialog_buttons, {"Next city (N)": next_city});
  }

  dialog_buttons = $.extend(dialog_buttons, {"Close (W)": close_city_dialog});

  $("#city_dialog").attr("title", decodeURIComponent(pcity['name'])
                         + " (" + pcity['size'] + ")");
  $("#city_dialog").dialog({
			bgiframe: true,
			modal: false,
			width:  "99.5%" ,
                        height: is_small_screen() ? 250 : 372,
                        close : city_dialog_close_handler,
            position: {my: 'left bottom', at: 'left bottom', of: window},
            buttons: dialog_buttons
                   }).dialogExtend({
                     "minimizable" : true,
                     "closable" : true,
                     "minimize" : function(evt, dlg){ set_default_mapview_active(); },
                     "icons" : {
                       "minimize" : "ui-icon-circle-minus",
                       "restore" : "ui-icon-newwin"
                     }});

  $("#city_dialog").dialog('widget').keydown(city_keyboard_listener);
  $("#city_dialog").dialog('open');
  $("#game_text_input").blur();

  $("#city_tabs").tabs({ active: city_tab_index});

  $(".citydlg_tabs").height(is_small_screen() ? 250 : 242);

  city_worklist_dialog(pcity);
  set_default_mapview_inactive();

  show_city_worked_tiles();

  $("#city_size").html("Population: " + numberWithCommas(city_population(pcity)*1000) + "<br>"
                       + "Size: " + pcity['size'] + "<br>"
                       + "Founded turn: " + pcity['turn_founded'] + "<br>"
                       + "Granary: " + pcity['food_stock'] + "/" + pcity['granary_size'] + "<br>"
                       + "Change in: " + city_turns_to_growth_text(pcity));

  var prod_type = get_city_production_type_sprite(pcity);
  $("#city_production_overview").html("Producing: " + (prod_type != null ? prod_type['type']['name'] : "None"));

  turns_to_complete = get_city_production_time(pcity);

  if (turns_to_complete != FC_INFINITY) {
    $("#city_production_turns_overview").html(turns_to_complete + " turns &nbsp;&nbsp;(" + get_production_progress(pcity) + ")");
  } else {
    $("#city_production_turns_overview").html("-");
  }

  var improvements_html = "";
  for (var z = 0; z < ruleset_control.num_impr_types; z ++) {
    if (pcity['improvements'] != null && pcity['improvements'].isSet(z)) {
       sprite = get_improvement_image_sprite(improvements[z]);
       if (sprite == null) {
         console.log("Missing sprite for improvement " + z);
         continue;
       }

      improvements_html = improvements_html +
       "<div id='city_improvement_element'><div style='background: transparent url("
           + sprite['image-src'] +
           ");background-position:-" + sprite['tileset-x'] + "px -" + sprite['tileset-y']
           + "px;  width: " + sprite['width'] + "px;height: " + sprite['height'] + "px;float:left; '"
           + "title=\"" + improvements[z]['helptext'] + "\" "
	   + "onclick='city_sell_improvement(" + z + ");'>"
           +"</div>" + improvements[z]['name'] + "</div>";
    }
  }
  $("#city_improvements_list").html(improvements_html);

  var punits = tile_units(city_tile(pcity));
  if (punits != null) {
    var present_units_html = "";
    for (var r = 0; r < punits.length; r++) {
      punit = punits[r];
      sprite = get_unit_image_sprite(punit);
      if (sprite == null) {
         console.log("Missing sprite for " + punit);
         continue;
       }

      present_units_html = present_units_html +
       "<div class='game_unit_list_item' title='" + get_unit_city_info(punit)
           + "' style='cursor:pointer;cursor:hand; background: transparent url("
           + sprite['image-src'] +
           ");background-position:-" + sprite['tileset-x'] + "px -" + sprite['tileset-y']
           + "px;  width: " + sprite['width'] + "px;height: " + sprite['height'] + "px;float:left; '"
           + " onclick='city_dialog_activate_unit(units[" + punit['id'] + "]);'"
           +"></div>";
    }
    $("#city_present_units_list").html(present_units_html);
  }

  var sunits = get_supported_units(pcity);
  if (sunits != null) {
    var supported_units_html = "";
    for (var t = 0; t < sunits.length; t++) {
      punit = sunits[t];
      sprite = get_unit_image_sprite(punit);
      if (sprite == null) {
         console.log("Missing sprite for " + punit);
         continue;
       }

      supported_units_html = supported_units_html +
       "<div class='game_unit_list_item' title='" + get_unit_city_info(punit)
           + "' style='cursor:pointer;cursor:hand; background: transparent url("
           + sprite['image-src'] +
           ");background-position:-" + sprite['tileset-x'] + "px -" + sprite['tileset-y']
           + "px;  width: " + sprite['width'] + "px;height: " + sprite['height'] + "px;float:left; '"
           + " onclick='city_dialog_activate_unit(units[" + punit['id'] + "]);'"
           +"></div>";
    }
    $("#city_supported_units_list").html(supported_units_html);
  }
  $(".game_unit_list_item").tooltip({
       position: { my: "left+15 center", at: "right center" }
     });
  $("#city_improvement_element").tooltip();

  if ('prod' in pcity && 'surplus' in pcity) {
    var food_txt = pcity['prod'][O_FOOD] + " ( ";
    if (pcity['surplus'][O_FOOD] > 0) food_txt += "+";
    food_txt += pcity['surplus'][O_FOOD] + ")";

    var shield_txt = pcity['prod'][O_SHIELD] + " ( ";
    if (pcity['surplus'][O_SHIELD] > 0) shield_txt += "+";
    shield_txt += pcity['surplus'][O_SHIELD] + ")";

    var trade_txt = pcity['prod'][O_TRADE] + " ( ";
    if (pcity['surplus'][O_TRADE] > 0) trade_txt += "+";
    trade_txt += pcity['surplus'][O_TRADE] + ")";

    var gold_txt = pcity['prod'][O_GOLD] + " ( ";
    if (pcity['surplus'][O_GOLD] > 0) gold_txt += "+";
    gold_txt += pcity['surplus'][O_GOLD] + ")";

    var luxury_txt = pcity['prod'][O_LUXURY];
    var science_txt = pcity['prod'][O_SCIENCE];

    $("#city_food").html(food_txt);
    $("#city_prod").html(shield_txt);
    $("#city_trade").html(trade_txt);
    $("#city_gold").html(gold_txt);
    $("#city_luxury").html(luxury_txt);
    $("#city_science").html(science_txt);

    $("#city_corruption").html(pcity['waste'][O_TRADE]);
    $("#city_waste").html(pcity['waste'][O_SHIELD]);
    $("#city_pollution").html(pcity['pollution']);
    $("#city_steal").html(pcity['steal']);
    $("#city_culture").html(pcity['culture']);
  }

  /* Handle citizens and specialists */
  var specialist_html = "";
  var citizen_types = ["angry", "unhappy", "content", "happy"];
  for (var s = 0; s < citizen_types.length; s++) {
    if (pcity['ppl_' + citizen_types[s]] == null) continue;
    for (var i = 0; i < pcity['ppl_' + citizen_types[s]][FEELING_FINAL]; i ++) {
      specialist_html = specialist_html +
      "<canvas id='citizen_" + s + "_" + i + "' class='specialist_item' title='One " + citizen_types[s] + " citizen' width='30' height='38'></canvas>";
    }
  }

  for (var u = 0; u < pcity['specialists_size']; u++) {
    var spec_type_name = specialists[u]['plural_name'];
    var spec_gfx_key = "specialist." + specialists[u]['rule_name'] + "_0";
    for (var j = 0; j < pcity['specialists'][u]; j++) {
      sprite = get_specialist_image_sprite(spec_gfx_key);
      specialist_html = specialist_html +
      "<canvas id='specialist_" + u + "_" + j + "' class='specialist_item' style='cursor:pointer;cursor:hand;' title='" + spec_type_name
        + " (click to change)' width='30' height='38' onclick='city_change_specialist(" + pcity['id'] + "," + specialists[u]['id'] + ");'></canvas>";
    }
  }
  specialist_html += "<div style='clear: both;'></div>";
  $("#specialist_panel").html(specialist_html);

  for (var s = 0; s < citizen_types.length; s++) {
    if (pcity['ppl_' + citizen_types[s]] == null) continue;
    for (var i = 0; i < pcity['ppl_' + citizen_types[s]][FEELING_FINAL]; i ++) {
      var citizen_canvas = $("#citizen_"  + s + "_" + i)[0].getContext("2d");
      citizen_canvas.drawImage(sprites["citizen." + citizen_types[s] + "_" + (i % 2)], 0, 0, 15, 20, 0, 0, 30, 38);
    }
  }
  for (var u = 0; u < pcity['specialists_size']; u++) {
    var spec_type_name = specialists[u]['plural_name'];
    var spec_gfx_key = "specialist." + specialists[u]['rule_name'] + "_0";
    for (var j = 0; j < pcity['specialists'][u]; j++) {
      var specialist_canvas = $("#specialist_" + u + "_" + j)[0].getContext("2d");
      specialist_canvas.drawImage(sprites[spec_gfx_key],  0, 0, 15, 20, 0, 0, 30, 38);
    }
  }


  $('#disbandable_city').off();
  $('#disbandable_city').prop('checked',
                              pcity['city_options'] != null && pcity['city_options'].isSet(CITYO_DISBAND));
  $('#disbandable_city').click(function() {
    var options = pcity['city_options'];
    var packet = {
      "pid"     : packet_city_options_req,
      "city_id" : active_city['id'],
      "options" : options.raw
    };

    /* Change the option value referred to by the packet. */
    if ($('#disbandable_city').prop('checked')) {
      options.set(CITYO_DISBAND);
    } else {
      options.unset(CITYO_DISBAND);
    }

    /* Send the (now updated) city options. */
    send_request(JSON.stringify(packet));

  });

  $(".ui-dialog-titlebar").css("padding", "0px");
  $(".ui-dialog-buttonpane").css("margin-top", "-47px");

  if (is_small_screen()) {
   $(".ui-dialog-titlebar").css("font-size", "11px");
   $(".ui-tabs-anchor").css("padding", "1px");
   $(".ui-dialog-titlebar").css("padding", "0px");
   //$(".ui-dialog").height(260);
   $(".citydlg_tabs").height(365);
   $("#city_dialog").height(400);
   $(".ui-dialog-buttonpane").css("font-size", "10px");
   $(".ui-dialog").css("padding", "0px");
   $("#cma_form").css("padding-left", "0px");
   $("#city_dialog").parent().css("margin-top", "-200px");
   $("#city_improvements_panel").hide();
   $("#city_overview_tab").height(330);
   $("#city_production_tab").height(330);
  } else {
    $("#city_dialog").parent().css("margin-top", "60px");
  }

  $("#city_dialog").parent().css("z-index", 100000)
  $(".ui-dialog-buttonset").css("margin-top", "-18px");

  show_city_governor_tab();

  center_tile_city(pcity);

}


/**************************************************************************
 Returns the name and sprite of the current city production.
**************************************************************************/
function get_city_production_type_sprite(pcity)
{
  if (pcity == null) return null; 
  if (pcity['production_kind'] == VUT_UTYPE) {
    var punit_type = unit_types[pcity['production_value']];
    return {"type":punit_type,"sprite":get_unit_type_image_sprite(punit_type)};
  }

  if (pcity['production_kind'] == VUT_IMPROVEMENT) {
    var improvement = improvements[pcity['production_value']];
    return {"type":improvement,"sprite":get_improvement_image_sprite(improvement)};
  }

  return null;
}

/**************************************************************************
 Returns the name of the current city production.
**************************************************************************/
function get_city_production_type(pcity)
{
  if (pcity == null) {
    return null;
  }
  if (pcity['production_kind'] == VUT_UTYPE) {
    var punit_type = unit_types[pcity['production_value']];
    return punit_type;
  }

  if (pcity['production_kind'] == VUT_IMPROVEMENT) {
    var improvement = improvements[pcity['production_value']];
    return improvement;
  }

  return null;
}


/**************************************************************************
 Returns the number of turns to complete current city production.
**************************************************************************/
function get_city_production_time(pcity)
{
 if (pcity == null) return FC_INFINITY;

  if (pcity['production_kind'] == VUT_UTYPE) {
    var punit_type = unit_types[pcity['production_value']];
    return city_turns_to_build(pcity, punit_type, true);
  }

  if (pcity['production_kind'] == VUT_IMPROVEMENT) {
    var improvement = improvements[pcity['production_value']];
    if (improvement['name'] == "Coinage") {
      return FC_INFINITY;
    }

    return city_turns_to_build(pcity, improvement, true);
  }

  return FC_INFINITY;
}


/**************************************************************************
 Returns city production progress, eg. the string "5 / 30"
**************************************************************************/
function get_production_progress(pcity)
{
  if (pcity == null) return " ";

  if (pcity['production_kind'] == VUT_UTYPE) {
    var punit_type = unit_types[pcity['production_value']];
    return pcity['shield_stock'] + "/"
           + universal_build_shield_cost(pcity, punit_type);
  }

  if (pcity['production_kind'] == VUT_IMPROVEMENT) {
    var improvement = improvements[pcity['production_value']];
    if (improvement['name'] == "Coinage") {
      return " ";
    }
    return  pcity['shield_stock'] + "/"
            + universal_build_shield_cost(pcity, improvement);
  }

  return " ";
}

/**************************************************************************
 Returns city production progress, eg. 0.5
**************************************************************************/
function get_production_progress_num(pcity)
{
  if (pcity == null) return 0;

  if (pcity['production_kind'] == VUT_UTYPE) {
    var punit_type = unit_types[pcity['production_value']];
    return pcity['shield_stock'] /
           universal_build_shield_cost(pcity, punit_type);
  }

  if (pcity['production_kind'] == VUT_IMPROVEMENT) {
    var improvement = improvements[pcity['production_value']];
    if (improvement['name'] == "Coinage") {
      return 0;
    }
    return  pcity['shield_stock']  /
            + universal_build_shield_cost(pcity, improvement);
  }

  return 0;
}

/**************************************************************************
...
**************************************************************************/
function generate_production_list()
{
  var production_list = [];
  for (var unit_type_id in unit_types) {
    var punit_type = unit_types[unit_type_id];

    /* FIXME: web client doesn't support unit flags yet, so this is a hack: */
    if (punit_type['name'] == "Barbarian Leader" || punit_type['name'] == "Leader") continue;

      production_list.push({"kind": VUT_UTYPE, "value" : punit_type['id'],
                            "text" : punit_type['name'],
	                        "helptext" : punit_type['helptext'],
                            "rule_name" : punit_type['rule_name'],
                            "build_cost" : punit_type['build_cost'],
                            "unit_details" : "Attack:" + punit_type['attack_strength'] + ", Defense:"
                                             + punit_type['defense_strength'] + ", Firepower:"
                                             + punit_type['firepower'],
                            "sprite" : get_unit_type_image_sprite(punit_type)});
  }

  for (var improvement_id in improvements) {
    var pimprovement = improvements[improvement_id];
      var build_cost = pimprovement['build_cost'];
      if (pimprovement['name'] == "Coinage") build_cost = "-";
      production_list.push({"kind": VUT_IMPROVEMENT,
                            "value" : pimprovement['id'],
                            "text" : pimprovement['name'],
	                        "helptext" : pimprovement['helptext'],
                            "rule_name" : pimprovement['rule_name'],
                            "build_cost" : build_cost,
                            "unit_details" : "",
                            "sprite" : get_improvement_image_sprite(pimprovement) });
  }
  return production_list;
}

/**************************************************************************
  Return whether given city can build given unit, ignoring whether unit
  is obsolete.
**************************************************************************/
function can_city_build_unit_direct(pcity, punittype)
{
  /* TODO: implement*/
  return true;
}


/**************************************************************************
  Return whether given city can build given unit; returns FALSE if unit is
  obsolete.
**************************************************************************/
function can_city_build_unit_now(pcity, punittype_id)
{
  return (pcity != null && typeof pcity['can_build_unit'] != 'undefined'
          && pcity['can_build_unit'].isSet(punittype_id));
}


/**************************************************************************
  Return whether given city can build given building; returns FALSE if
  the building is obsolete.
**************************************************************************/
function can_city_build_improvement_now(pcity, pimprove_id)
{
  return (pcity != null && typeof pcity['can_build_improvement'] != 'undefined'
          && pcity['can_build_improvement'].isSet(pimprove_id));
}


/**************************************************************************
  Return whether given city can build given item.
**************************************************************************/
function can_city_build_now(pcity, kind, value)
{
  return kind != null && value != null &&
       ((kind == VUT_UTYPE)
       ? can_city_build_unit_now(pcity, value)
       : can_city_build_improvement_now(pcity, value));
}


/**************************************************************************
  Return TRUE iff the city has this building in it.
**************************************************************************/
function city_has_building(pcity, improvement_id)
{
  return 0 <= improvement_id && improvement_id < ruleset_control.num_impr_types
    && pcity['improvements'] && pcity['improvements'].isSet(improvement_id);
}


/**************************************************************************
 Calculates the turns which are needed to build the requested
 improvement in the city.  GUI Independent.
**************************************************************************/
function city_turns_to_build(pcity, target, include_shield_stock)
{
  var city_shield_surplus =  pcity['surplus'][O_SHIELD];
  var city_shield_stock = include_shield_stock ? pcity['shield_stock'] : 0;
  var cost = universal_build_shield_cost(pcity, target);

  if (include_shield_stock == true && (pcity['shield_stock'] >= cost)) {
    return 1;
  } else if ( pcity['surplus'][O_SHIELD] > 0) {
    return Math.floor((cost - city_shield_stock - 1) / city_shield_surplus + 1);
  } else {
    return FC_INFINITY;
  }
}

/**************************************************************************
 Show buy production in city dialog
**************************************************************************/
function request_city_buy()
{
  var pcity = active_city;
  var pplayer = client.conn.playing;

  // reset dialog page.
  $("#buy_dialog").remove();
  $("<div id='buy_dialog'></div>").appendTo("div#game_page");
  var buy_price_string = "";
  var buy_question_string = "";

  if (pcity['production_kind'] == VUT_UTYPE) {
    var punit_type = unit_types[pcity['production_value']];
    if (punit_type != null) {
      send_city_buy();
      return;
    }
  }
  var improvement = improvements[pcity['production_value']];
  if (improvement != null) {
    buy_price_string = improvement['name'] + " costs " + pcity['buy_cost'] + " gold.";
    buy_question_string = "Buy " + improvement['name'] + " for " + pcity['buy_cost'] + " gold?";
  }

  var treasury_text = "<br>Treasury contains " + pplayer['gold'] + " gold.";

  if (pcity['buy_cost'] > pplayer['gold']) {
    show_dialog_message("Buy It!",
      buy_price_string + treasury_text);
    return;
  }

  var dhtml = buy_question_string + treasury_text;


  $("#buy_dialog").html(dhtml);

  $("#buy_dialog").attr("title", "Buy It!");
  $("#buy_dialog").dialog({
			bgiframe: true,
			modal: true,
			width: is_small_screen() ? "95%" : "50%",
			buttons: {
				"Yes": function() {
						send_city_buy();
						$("#buy_dialog").dialog('close');
				},
				"No": function() {
						$("#buy_dialog").dialog('close');

				}
			}
		});

  $("#buy_dialog").dialog('open');
}


/**************************************************************************
 Buy whatever is being built in the city.
**************************************************************************/
function send_city_buy()
{
  if (active_city != null) {
    var packet = {"pid" : packet_city_buy, "city_id" : active_city['id']};
    send_request(JSON.stringify(packet));
  }
}

/**************************************************************************
 Change city production.
**************************************************************************/
function send_city_change(city_id, kind, value)
{
  var packet = {"pid" : packet_city_change, "city_id" : city_id,
                "production_kind": kind, "production_value" : value};
  send_request(JSON.stringify(packet));
}

/**************************************************************************
 Does a simple close of the city dialog, which will trigger the
  event-based close_city_dialog() further below
**************************************************************************/
function close_city_dialog_trigger()
{
  closed_dialog_already = true;
  $("#city_dialog").dialog('close');
}


/**************************************************************************
 Close dialog.
**************************************************************************/
function close_city_dialog()
{
  $("#city_dialog").dialog('close');
  highlight_map_tile_selected(-1, -1);
}

/**************************************************************************
 Clean up after closing the city dialog.
**************************************************************************/
function city_dialog_close_handler()
{
  if (!globe_view_active) {
    set_default_mapview_active();
  }
  if (active_city != null) {
    setup_window_size ();
    remove_city_worked_tiles();
    active_city = null;

  }
  keyboard_input=true;
  worklist_dialog_active = false;
  map_known_dirty = true;
}

/**************************************************************************
 The city map has been clicked.
**************************************************************************/
function do_city_map_click(ptile)
{
  var packet = null;
  if (ptile['worked'] == active_city['id']) {
    packet = {"pid"     : packet_city_make_specialist,
              "city_id" : active_city['id'],
              "tile_id" : ptile['index']};
  } else {
    packet = {"pid"     : packet_city_make_worker,
              "city_id" : active_city['id'],
              "tile_id" : ptile['index']};
  }
  send_request(JSON.stringify(packet));
}

/**************************************************************************
..
**************************************************************************/
function does_city_have_improvement(pcity, improvement_name)
{
  if (pcity == null || pcity['improvements'] == null) return false;

  for (var z = 0; z < ruleset_control.num_impr_types; z++) {
    if (pcity['improvements'] != null && pcity['improvements'].isSet(z) && improvements[z] != null
        && improvements[z]['name'] == improvement_name) {
      return true;
    }
  }
  return false;
}

/**************************************************************************
  Shows the Request city name dialog to the user.
**************************************************************************/
function city_name_dialog(suggested_name, unit_id) {
  // reset dialog page.
  $("#city_name_dialog").remove();
  $("<div id='city_name_dialog'></div>").appendTo("div#game_page");

  $("#city_name_dialog").html($("<div>What should we call our new city?</div>"
                              + "<input id='city_name_req' type='text'>"));

  /* A suggested city name can contain an apostrophe ("'"). That character
   * is also used for single quotes. It shouldn't be added unescaped to a
   * string that later is interpreted as HTML. */
  /* TODO: Forbid city names containing an apostrophe or make sure that all
   * JavaScript using city names handles it correctly. Look for places
   * where a city name string is added to a string that later is
   * interpreted as HTML. Avoid the situation by directly using JavaScript
   * like below or by escaping the string. */
  $("#city_name_req").attr("value", suggested_name);

  $("#city_name_dialog").attr("title", "Build New City");
  $("#city_name_dialog").dialog({
			bgiframe: true,
			modal: true,
			width: "300",
			close: function() {
				keyboard_input=true;
                act_sel_queue_done(unit_id);
			},
			buttons: [	{
					text: "Cancel",
				        click: function() {
						$("#city_name_dialog").remove();
                        keyboard_input=true;
                        act_sel_queue_done(unit_id);
					}
				},{
					text: "Ok",
				        click: function() {
						var name = $("#city_name_req").val();
						if (name.length == 0 || name.length >= MAX_LEN_CITYNAME - 6
						    || encodeURIComponent(name).length  >= MAX_LEN_CITYNAME - 6) {
						  swal("City name is invalid. Please try a different shorter name.");
						  return;
						}

                        var actor_unit = game_find_unit_by_number(unit_id);
                        request_unit_do_action(ACTION_FOUND_CITY,
                          unit_id, actor_unit['tile'], 0,
                          encodeURIComponent(name));
						$("#city_name_dialog").remove();
						keyboard_input=true;
                        act_sel_queue_done(unit_id);
					}
					}
				]
		});

  $("#city_name_req").attr('maxlength', MAX_LEN_NAME);

  $("#city_name_dialog").dialog('open');

  $(document).keydown(function(e) {
    if (e.keyCode === 13 && $('#city_name_dialog').is(':visible')) {
      var name = $("#city_name_req").val();
      var actor_unit = game_find_unit_by_number(unit_id);
      request_unit_do_action(ACTION_FOUND_CITY,
        unit_id, actor_unit['tile'], 0, encodeURIComponent(name));
	  $("#city_name_dialog").remove();
      keyboard_input=true;
      act_sel_queue_done(unit_id);
    }
  });

  blur_input_on_touchdevice();
  keyboard_input=false;

}

/**************************************************************************
..
**************************************************************************/
function next_city()
{
  if (!client.conn.playing) return;

  city_screen_updater.fireNow();

  var next_row = $('#cities_list_' + active_city['id']).next();
  if (next_row.length === 0) {
    // Either the city is not in the list anymore or it was the last item.
    // Anyway, go to the beginning
    next_row = $('#city_table tbody tr').first();
  }
  if (next_row.length > 0) {
    // If there's a city
    show_city_dialog(cities[next_row.attr('id').substr(12)]);
  }
}

/**************************************************************************
..
**************************************************************************/
function previous_city()
{
  if (!client.conn.playing) return;

  city_screen_updater.fireNow();

  var prev_row = $('#cities_list_' + active_city['id']).prev();
  if (prev_row.length === 0) {
    // Either the city is not in the list anymore or it was the last item.
    // Anyway, go to the end
    prev_row = $('#city_table tbody tr').last();
  }
  if (prev_row.length > 0) {
    // If there's a city
    show_city_dialog(cities[prev_row.attr('id').substr(12)]);
  }
}

/**************************************************************************
..
**************************************************************************/
function city_sell_improvement(improvement_id)
{
  if ('confirm' in window) {
    var agree=confirm("Are you sure you want to sell this building?");
    if (agree) {
      var packet = {"pid" : packet_city_sell, "city_id" : active_city['id'],
                  "build_id": improvement_id};
      send_request(JSON.stringify(packet));
    }
  } else {
    var packet = {"pid" : packet_city_sell, "city_id" : active_city['id'],
                "build_id": improvement_id};
    send_request(JSON.stringify(packet));
  }
}

/**************************************************************************
  Create text describing city growth.
**************************************************************************/
function city_turns_to_growth_text(pcity)
{
  var turns = pcity['granary_turns'];

  if (turns == 0) {
    return "blocked";
  } else if (turns > 1000000) {
    return "never";
  } else if (turns < 0) {
    return "Starving in " + Math.abs(turns) + " turns";
  } else {
    return turns + " turns";
  }
}

/**************************************************************************
  Returns an index for a flat array containing x,y data.
  dx,dy are displacements from the center, r is the "radius" of the data
  in the array. That is, for r=0, the array would just have the center;
  for r=1 it'd be (-1,-1), (-1,0), (-1,1), (0,-1), (0,0), etc.
  There's no check for coherence.
**************************************************************************/
function dxy_to_center_index(dx, dy, r)
{
  return (dx + r) * (2 * r + 1) + dy + r;
}

/**************************************************************************
  Converts from coordinate offset from city center (dx, dy),
  to index.
**************************************************************************/
function get_city_dxy_to_index(dx, dy, pcity)
{
  build_city_tile_map(pcity.city_radius_sq);
  var city_tile_map_index = dxy_to_center_index(dx, dy, city_tile_map.radius);
  var ctile = city_tile(active_city);
  return get_city_tile_map_for_pos(ctile.x, ctile.y)[city_tile_map_index];
}

/**************************************************************************
  Builds city_tile_map info for a given squared city radius.
**************************************************************************/
function build_city_tile_map(radius_sq)
{
  if (city_tile_map == null || city_tile_map.radius_sq < radius_sq) {
    var r = Math.floor(Math.sqrt(radius_sq));
    var vectors = [];

    for (var dx = -r; dx <= r; dx++) {
      for (var dy = -r; dy <= r; dy++) {
        var d_sq = map_vector_to_sq_distance(dx, dy);
        if (d_sq <= radius_sq) {
          vectors.push([dx, dy, d_sq, dxy_to_center_index(dx, dy, r)]);
        }
      }
    }

    vectors.sort(function (a, b) {
      var d = a[2] - b[2];
      if (d !== 0) return d;
      d = a[0] - b[0];
      if (d !== 0) return d;
      return a[1] - b[1];
    });

    var base_map = [];
    for (var i = 0; i < vectors.length; i++) {
      base_map[vectors[i][3]] = i;
    }

    city_tile_map = {
      radius_sq: radius_sq,
      radius: r,
      base_sorted: vectors,
      maps: [base_map]
    };
  }
}

/**************************************************************************
  Helper for get_city_tile_map_for_pos.
  From position, radius and size, returns an array with delta_min,
  delta_max and clipped tile_map index.
**************************************************************************/
function delta_tile_helper(pos, r, size)
{
  var d_min = -pos;
  var d_max = (size-1) - pos;
  var i = 0;
  if (d_min > -r) {
    i = r + d_min;
  } else if (d_max < r) {
    i = 2*r - d_max;
  }
  return [d_min, d_max, i];
}

/**************************************************************************
  Builds the city_tile_map with the given delta limits.
  Helper for get_city_tile_map_for_pos.
**************************************************************************/
function build_city_tile_map_with_limits(dx_min, dx_max, dy_min, dy_max)
{
  var clipped_map = [];
  var v = city_tile_map.base_sorted;
  var vl = v.length;
  var index = 0;
  for (var vi = 0; vi < vl; vi++) {
    var tile_data = v[vi];
    if (tile_data[0] >= dx_min && tile_data[0] <= dx_max &&
        tile_data[1] >= dy_min && tile_data[1] <= dy_max) {
      clipped_map[tile_data[3]] = index;
      index++;
    }
  }
  return clipped_map;
}

/**************************************************************************
  Returns the mapping of position from city center to index in city_info.
**************************************************************************/
function get_city_tile_map_for_pos(x, y)
{
  if (wrap_has_flag(WRAP_X)) {
    if (wrap_has_flag(WRAP_Y)) {

      // Torus
      get_city_tile_map_for_pos = function (x, y) {
        return city_tile_map.maps[0];
      };

    } else {

      // Cylinder with N-S axis
      get_city_tile_map_for_pos = function (x, y) {
        var r = city_tile_map.radius;
        var d = delta_tile_helper(y, r, map.ysize)
        if (city_tile_map.maps[d[2]] == null) {
          var m = build_city_tile_map_with_limits(-r, r, d[0], d[1]);
          city_tile_map.maps[d[2]] = m;
        }
        return city_tile_map.maps[d[2]];
      };

    }
  } else {
    if (wrap_has_flag(WRAP_Y)) {

      // Cylinder with E-W axis
      get_city_tile_map_for_pos = function (x, y) {
        var r = city_tile_map.radius;
        var d = delta_tile_helper(x, r, map.xsize)
        if (city_tile_map.maps[d[2]] == null) {
          var m = build_city_tile_map_with_limits(d[0], d[1], -r, r);
          city_tile_map.maps[d[2]] = m;
        }
        return city_tile_map.maps[d[2]];
      };

    } else {

      // Flat
      get_city_tile_map_for_pos = function (x, y) {
        var r = city_tile_map.radius;
        var dx = delta_tile_helper(x, r, map.xsize)
        var dy = delta_tile_helper(y, r, map.ysize)
        var map_i = (2*r + 1) * dx[2] + dy[2];
        if (city_tile_map.maps[map_i] == null) {
          var m = build_city_tile_map_with_limits(dx[0], dx[1], dy[0], dy[1]);
          city_tile_map.maps[map_i] = m;
        }
        return city_tile_map.maps[map_i];
      };

    }
  }

  return get_city_tile_map_for_pos(x, y);
}

/**************************************************************************
...
**************************************************************************/
function city_change_specialist(city_id, from_specialist_id)
{
  var city_message = {"pid": packet_city_change_specialist,
                      "city_id" : city_id,
                      "from" : from_specialist_id,
                      "to" : (from_specialist_id + 1) % 3};
  send_request(JSON.stringify(city_message));
}


/**************************************************************************
...  (simplified)
**************************************************************************/
function city_can_buy(pcity)
{
  var improvement = improvements[pcity['production_value']];

  return (!pcity['did_buy'] && pcity['turn_founded'] != game_info['turn']
          && improvement['name'] != "Coinage");

}

/**************************************************************************
 Returns how many thousand citizen live in this city.
**************************************************************************/
function city_population(pcity)
{
  /*  Sum_{i=1}^{n} i  ==  n*(n+1)/2  */
  return pcity['size'] * (pcity['size'] + 1) * 5;
}


/**************************************************************************
 Rename a city
**************************************************************************/
function rename_city()
{
  if (active_city == null) return;

  // reset dialog page.
  $("#city_name_dialog").remove();
  $("<div id='city_name_dialog'></div>").appendTo("div#game_page");

  $("#city_name_dialog").html($("<div>What should we call this city?</div>"
                                + "<input id='city_name_req' type='text'>"));
  /* The city name can contain an apostrophe ("'"). That character is also
   * used for single quotes. It shouldn't be added unescaped to a
   * string that later is interpreted as HTML. */
  $("#city_name_req").attr("value", active_city['name']);
  $("#city_name_dialog").attr("title", "Rename City");
  $("#city_name_dialog").dialog({
			bgiframe: true,
			modal: true,
			width: "300",
			close: function() {
				keyboard_input=true;
			},
			buttons: [	{
					text: "Cancel",
				        click: function() {
						$("#city_name_dialog").remove();
        					keyboard_input=true;
					}
				},{
					text: "Ok",
				        click: function() {
						var name = $("#city_name_req").val();
						if (name.length == 0 || name.length >= MAX_LEN_NAME - 4
						    || encodeURIComponent(name).length  >= MAX_LEN_NAME - 4) {
						  swal("City name is invalid");
						  return;
						}

						var packet = {"pid" : packet_city_rename, "name" : encodeURIComponent(name), "city_id" : active_city['id'] };
						send_request(JSON.stringify(packet));
						$("#city_name_dialog").remove();
						keyboard_input=true;
					}
					}
				]
		});
  $("#city_name_req").attr('maxlength', MAX_LEN_NAME);

  $("#city_name_dialog").dialog('open');

  $('#city_name_dialog').keyup(function(e) {
    if (e.keyCode == 13) {
      var name = $("#city_name_req").val();
      var packet = {"pid" : packet_city_rename, "name" : encodeURIComponent(name), "city_id" : active_city['id'] };
      send_request(JSON.stringify(packet));
      $("#city_name_dialog").remove();
      keyboard_input=true;
    }
  });
}

/**************************************************************************
 Shows traderoutes of active city
**************************************************************************/
function show_city_traderoutes()
{
  var msg;
  var routes;

  if (active_city == null) {
    /* No city to show. */
    return;
  }

  routes = city_trade_routes[active_city['id']];

  if (active_city['traderoute_count'] != 0
      && routes == null) {
    /* This city is supposed to have trade routes. It doesn't.  */
    console.log("Can't find the trade routes " + active_city['name']
                + " is said to have");
    return;
  }

  msg = "";
  for (var i = 0; i < active_city['traderoute_count']; i++) {
    var tcity_id;
    var tcity;
    var good;
    
    if (routes[i] == null) continue;

    tcity_id = routes[i]['partner'];

    if (tcity_id == 0 || tcity_id == null) {
      continue;
    }

    good = goods[routes[i]['goods']];
    if (good == null) {
      console.log("Missing good type " + routes[i]['goods']);
      good = {'name': "Unknown"};
    }

    tcity = cities[tcity_id];
    if (tcity == null) continue;
    msg += good['name'] + " trade with " + tcity['name'];
    msg += " gives " + routes[i]['value'] + " gold each turn." + "<br>";
  }

  if (msg == "") {
    msg = "No traderoutes.";
    msg += " (Open the Manual, select Economy and then Trade ";
    msg += "if you want to learn more about trade and trade routes.)";
  }

  $("#city_traderoutes_tab").html(msg);
}

/**************************************************************************
 Populates data to the production tab in the city dialog.
**************************************************************************/
function city_worklist_dialog(pcity)
{
  if (pcity == null) return;
  var universals_list = [];
  var kind;
  var value;

  if (pcity['worklist'] != null && pcity['worklist'].length != 0) {
    var work_list = pcity['worklist'];
    for (var i = 0; i < work_list.length; i++) {
      var work_item = work_list[i];
      kind = work_item['kind'];
      value = work_item['value'];
      if (kind == null || value == null || work_item.length == 0) continue;
      if (kind == VUT_IMPROVEMENT) {
        var pimpr = improvements[value];
	var build_cost = pimpr['build_cost'];
	if (pimpr['name'] == "Coinage") build_cost = "-";
	universals_list.push({"name" : pimpr['name'],
		"kind" : kind,
		"value" : value,
		"helptext" : pimpr['helptext'],
		"build_cost" : build_cost,
		"sprite" : get_improvement_image_sprite(pimpr)});
      } else if (kind == VUT_UTYPE) {
        var putype = unit_types[value];
        universals_list.push({"name" : putype['name'],
		"kind" : kind,
		"value" : value,
		"helptext" : putype['helptext'],
		"build_cost" : putype['build_cost'],
		"sprite" : get_unit_type_image_sprite(putype)});
      } else {
        console.log("unknown kind: " + kind);
      }
    }
  }

  var worklist_html = "";
  for (var j = 0; j < universals_list.length; j++) {
    var universal = universals_list[j];
    var sprite = universal['sprite'];
    if (sprite == null) {
      console.log("Missing sprite for " + universal[j]['name']);
      continue;
    }

    worklist_html += "<li class='prod_choice_list_item kindvalue_item ui-widget-content"
     + (can_city_build_now(pcity, universal['kind'], universal['value']) ?
        "" : " cannot_build_item")
     + "' data-wlitem='" + j + "' "
     + " title=\"" +  universal['name'] + " " + universal['helptext'] + "\">"
     + "<div class='production_list_item_sub' style=' background: transparent url("
           + sprite['image-src'] +
           ");background-position:-" + sprite['tileset-x'] + "px -" + sprite['tileset-y']
           + "px;  width: " + sprite['width'] + "px;height: " + sprite['height'] + "px;'"
           +"></div>"
     + "</li>";
  }

  $("#city_current_worklist").html(worklist_html);

  populate_worklist_production_choices(pcity);

  $('#show_unreachable_items').off('click');
  $('#show_unreachable_items').click(function() {
    opt_show_unreachable_items = !opt_show_unreachable_items;
    $('#show_unreachable_items').prop('checked', opt_show_unreachable_items);
    // TODO: properly update the selection only when needed,
    //       instead of always emptying it.
    if (production_selection.length !== 0) {
      production_selection = [];
      update_worklist_actions();
    }
    populate_worklist_production_choices(pcity);
  });
  $('#show_unreachable_items').prop('checked', opt_show_unreachable_items);

  worklist_dialog_active = true;
  var turns_to_complete = get_city_production_time(pcity);
  var prod_type = get_city_production_type_sprite(pcity);
  var prod_img_html = "";
  if (prod_type != null) { 
    sprite = prod_type['sprite'];
    prod_img_html = "<div style='background: transparent url("
           + sprite['image-src']
           + ");background-position:-" + sprite['tileset-x'] + "px -" + sprite['tileset-y']
           + "px;  width: " + sprite['width'] + "px;height: " + sprite['height'] + "px;float: left; '>"
           +"</div>";
  }

  var headline = prod_img_html + "<div id='prod_descr'>" // universal_build_shield_cost(pcity, target); // pcity['shield_stock']
    + (is_small_screen() ? " " : " Production: <b>")
    + (prod_type != null ? prod_type['type']['name'] : "None")
    + "</b> ("
    + pcity['shield_stock'] + "/"
    + universal_build_shield_cost(pcity, unit_types[pcity['production_value']], true) + ")"

  if (turns_to_complete != FC_INFINITY) {
    headline += ", turns: " + turns_to_complete + ", cost: " + pcity['buy_cost'];
  }

  $("#worklist_dialog_headline").html(headline + "</div>");

  $(".production_list_item_sub").tooltip({
       position: { my: "left+15 center", at: "right center" }
     });

  if (is_touch_device()) {
    $("#prod_buttons").html("<x-small>Click to change production, next clicks will add to worklist on mobile.</x-small>");
  }

  $(".button").button();

  var tab_h = $("#city_production_tab").height();
  $("#city_current_worklist").height(tab_h - 120);
  $("#worklist_production_choices").height(tab_h - 47);
  $("#worklist_control").height("190px");

  var worklist_items = $("#city_current_worklist .prod_choice_list_item");
  var max_selection = Math.min(MAX_LEN_WORKLIST, worklist_items.length);
  for (var k = 0; k < worklist_selection.length; k++) {
    if (worklist_selection[k] >= max_selection) {
      worklist_selection.splice(k, worklist_selection.length - k);
      break;
    }
    worklist_items.eq(worklist_selection[k]).addClass("ui-selected");
  }

  if (!is_touch_device()) {
    $("#city_current_worklist").selectable({
       filter: "li",
       selected: handle_current_worklist_select,
       unselected: handle_current_worklist_unselect
    });
  } else {
    worklist_items.click(handle_current_worklist_click);
  }

  worklist_items.dblclick(handle_current_worklist_direct_remove);

  update_worklist_actions();
}

/**************************************************************************
 Update the production choices.
**************************************************************************/
function populate_worklist_production_choices(pcity)
{
  var production_list = generate_production_list();
  var production_html = "";
  for (var a = 0; a < production_list.length; a++) {
    var sprite = production_list[a]['sprite'];
    if (sprite == null) {
      console.log("Missing sprite for " + production_list[a]['value']);
      continue;
    }
    var kind = production_list[a]['kind'];
    var value = production_list[a]['value'];
    var can_build = can_city_build_now(pcity, kind, value);

    if (can_build || opt_show_unreachable_items) {
      production_html += "<li class='prod_choice_list_item kindvalue_item ui-widget-content "
       + (can_build ? "" : " cannot_build_item")
       + "' data-value='" + value + "' data-kind='" + kind + "'>"
       + "<div class='production_list_item_sub ' title='" + html_safe(cleaned_text(production_list[a]['helptext']))
       +  (production_list[a]['build_cost'] > 0 ? " \nCost: " + production_list[a]['build_cost']  : "") + " \n"
       + production_list[a]['unit_details'] + "' style=' background: transparent url("
           + sprite['image-src'] +
           ");background-position:-" + sprite['tileset-x'] + "px -" + sprite['tileset-y']
           + "px;  width: " + sprite['width'] + "px;height: " + sprite['height'] + "px;'"
           +"></div><br>"
           +"<div >" + production_list[a]['text'] + "</div>"
           + "</li>";
     }
  }
  production_html += "</div>";

  $("#worklist_production_choices").html(production_html);
  $("#worklist_production_choices .production_list_item_sub").tooltip({
                                        position: { my: "left+15 center", at: "right center" }
  });

  if (!is_touch_device()) {
    $("#worklist_production_choices").selectable({
       filter: "li",
       selected: handle_worklist_select,
       unselected: handle_worklist_unselect
    });

    if (production_selection.length > 0) {
      var prod_items = $("#worklist_production_choices .kindvalue_item");
      var sel = [];
      production_selection.forEach(function (v) {
        sel.push("[data-value='" + v.value + "']" +
                 "[data-kind='"  + v.kind  + "']");
      });
      prod_items.filter(sel.join(",")).addClass("ui-selected");
    }

    $(".kindvalue_item").dblclick(function() {
      var value = parseFloat($(this).data('value'));
      var kind = parseFloat($(this).data('kind'));
      send_city_change(pcity['id'], kind, value);
    });
  } else {
    $(".kindvalue_item").click(function() {
      var value = parseFloat($(this).data('value'));
      var kind = parseFloat($(this).data('kind'));
      if (city_prod_clicks == 0) {
        send_city_change(pcity['id'], kind, value);
      } else {
        send_city_worklist_add(pcity['id'], kind, value);
      }
      city_prod_clicks += 1;

    });
  }
}

/**************************************************************************
 Handle selection in the production list.
**************************************************************************/
function extract_universal(element)
{
  return {
    value: parseFloat($(element).data("value")),
    kind:  parseFloat($(element).data("kind"))
  };
}

function find_universal_in_worklist(universal, worklist)
{
  for (var i = 0; i < worklist.length; i++) {
    if (worklist[i].kind === universal.kind &&
        worklist[i].value === universal.value) {
      return i;
    }
  }
  return -1;
}

function handle_worklist_select(event, ui)
{
  var selected = extract_universal(ui.selected);
  var idx = find_universal_in_worklist(selected, production_selection);
  if (idx < 0) {
    production_selection.push(selected);
    update_worklist_actions();
  }
}

function handle_worklist_unselect(event, ui)
{
  var selected = extract_universal(ui.unselected);
  var idx = find_universal_in_worklist(selected, production_selection);
  if (idx >= 0) {
    production_selection.splice(idx, 1);
    update_worklist_actions();
  }
}

/**************************************************************************
 Handles the selection of another item in the tasklist.
**************************************************************************/
function handle_current_worklist_select(event, ui)
{
  var idx = parseInt($(ui.selected).data('wlitem'), 10);
  var i = worklist_selection.length - 1;
  while (i >= 0 && worklist_selection[i] > idx)
    i--;
  if (i < 0 || worklist_selection[i] < idx) {
    worklist_selection.splice(i + 1, 0, idx);
    update_worklist_actions();
  }
}

/**************************************************************************
 Handles the removal of an item from the selection in the tasklist.
**************************************************************************/
function handle_current_worklist_unselect(event, ui)
{
  var idx = parseInt($(ui.unselected).data('wlitem'), 10);
  var i = worklist_selection.length - 1;
  while (i >= 0 && worklist_selection[i] > idx)
    i--;
  if (i >= 0 && worklist_selection[i] === idx) {
    worklist_selection.splice(i, 1);
    update_worklist_actions();
  }
}

/**************************************************************************
 Handles an item selection from the tasklist (for touch devices).
**************************************************************************/
function handle_current_worklist_click(event)
{
  event.stopPropagation();

  var element = $(this);
  var item = parseInt(element.data('wlitem'), 10);

  if (worklist_selection.length === 1 && worklist_selection[0] === item) {
     element.removeClass('ui-selected');
     worklist_selection = [];
  } else {
     element.siblings().removeClass('ui-selected');
     element.addClass('ui-selected');
     worklist_selection = [item];
  }

  update_worklist_actions();
}

/**************************************************************************
 Enables/disables buttons in production tab.
**************************************************************************/
function update_worklist_actions()
{
  if (worklist_selection.length > 0) {
    $("#city_worklist_up_btn").button("enable");
    $("#city_worklist_remove_btn").button("enable");

    if (worklist_selection[worklist_selection.length - 1] ===
        active_city['worklist'].length - 1) {
      $("#city_worklist_down_btn").button("disable");
    } else {
      $("#city_worklist_down_btn").button("enable");
    }

  } else {
    $("#city_worklist_up_btn").button("disable");
    $("#city_worklist_down_btn").button("disable");
    $("#city_worklist_exchange_btn").button("disable");
    $("#city_worklist_remove_btn").button("disable");
  }

  if (production_selection.length > 0) {
    $("#city_add_to_worklist_btn").button("enable");
    $("#city_worklist_insert_btn").button("enable");

    if (production_selection.length == worklist_selection.length ||
        worklist_selection.length == 1) {
      $("#city_worklist_exchange_btn").button("enable");
    } else {
      $("#city_worklist_exchange_btn").button("disable");
    }

  } else {
    $("#city_add_to_worklist_btn").button("disable");
    $("#city_worklist_insert_btn").button("disable");
    $("#city_worklist_exchange_btn").button("disable");
  }

  if (production_selection.length === 1) {
    $(":button:contains('Change production')").prop("disabled", false).removeClass("ui-state-disabled");
    $(":button:contains('Add to worklist')").prop("disabled", false).removeClass("ui-state-disabled");
  } else {
    $(":button:contains('Change production')").prop("disabled", true).addClass("ui-state-disabled");
    $(":button:contains('Add to worklist')").prop("disabled", true).addClass("ui-state-disabled");
  }
}

/**************************************************************************
 Notifies the server about a change in the city worklist.
**************************************************************************/
function send_city_worklist(city_id)
{
  var worklist = cities[city_id]['worklist'];
  var overflow = worklist.length - MAX_LEN_WORKLIST;
  if (overflow > 0) {
    worklist.splice(MAX_LEN_WORKLIST, overflow);
  }

  send_request(JSON.stringify({pid     : packet_city_worklist,
                               city_id : city_id,
                               worklist: worklist}));
}

/**************************************************************************
...
**************************************************************************/
function send_city_worklist_add(city_id, kind, value)
{
  var pcity = cities[city_id];
  if (pcity['worklist'].length >= MAX_LEN_WORKLIST) {
    return;
  }

  pcity['worklist'].push({"kind" : kind, "value" : value});

  send_city_worklist(city_id);
}

/**************************************************************************
...
**************************************************************************/
function city_change_production()
{
  if (production_selection.length === 1) {
    send_city_change(active_city['id'], production_selection[0].kind,
                     production_selection[0].value);
  }
}


/**************************************************************************
...
**************************************************************************/
function city_add_to_worklist()
{
  if (production_selection.length > 0) {
    active_city['worklist'] = active_city['worklist'].concat(production_selection);
    send_city_worklist(active_city['id']);
  }
}

/**************************************************************************
 Handles dblclick-issued removal
**************************************************************************/
function handle_current_worklist_direct_remove()
{
  var idx = parseInt($(this).data('wlitem'), 10);
  active_city['worklist'].splice(idx, 1);

  // User may dblclick a task while having other selected
  var i = worklist_selection.length - 1;
  while (i >= 0 && worklist_selection[i] > idx) {
    worklist_selection[i]--;
    i--;
  }
  if (i >= 0 && worklist_selection[i] === idx) {
    worklist_selection.splice(i, 1);
  }

  send_city_worklist(active_city['id']);
}

/**************************************************************************
 Inserts selected production items into the worklist.
 Inserts at the beginning if no worklist items are selected, or just before
 the first one if there's a selection.
**************************************************************************/
function city_insert_in_worklist()
{
  var count = Math.min(production_selection.length, MAX_LEN_WORKLIST);
  if (count === 0) return;

  var i;
  var wl = active_city['worklist'];

  if (worklist_selection.length === 0) {

    wl.splice.apply(wl, [0, 0].concat(production_selection));

    // Initialize the selection with the inserted items
    for (i = 0; i < count; i++) {
      worklist_selection.push(i);
    }

  } else {

    wl.splice.apply(wl, [worklist_selection[0], 0].concat(production_selection));

    for (i = 0; i < worklist_selection.length; i++) {
      worklist_selection[i] += count;
    }
  }

  send_city_worklist(active_city['id']);
}

/**************************************************************************
 Moves the selected tasks one place up.
 If the first task is selected, the current production is changed.
 TODO: Some combinations may send unnecessary updates.
 TODO: If change + worklist, we reopen the dialog twice and the second
       does not keep the tab.
**************************************************************************/
function city_worklist_task_up()
{
  var count = worklist_selection.length;
  if (count === 0) return;

  var swap;
  var wl = active_city['worklist'];

  if (worklist_selection[0] === 0) {
    worklist_selection.shift();
    if (wl[0].kind !== active_city['production_kind'] ||
        wl[0].value !== active_city['production_value']) {
      swap = wl[0];
      wl[0] = {
        kind : active_city['production_kind'],
        value: active_city['production_value']
      };

      send_city_change(active_city['id'], swap.kind, swap.value);
    }
    count--;
  }

  for (var i = 0; i < count; i++) {
    var task_idx = worklist_selection[i];
    swap = wl[task_idx - 1];
    wl[task_idx - 1] = wl[task_idx];
    wl[task_idx] = swap;
    worklist_selection[i]--;
  }

  send_city_worklist(active_city['id']);
}

/**************************************************************************
 Moves the selected tasks one place down.
**************************************************************************/
function city_worklist_task_down()
{
  var count = worklist_selection.length;
  if (count === 0) return;

  var swap;
  var wl = active_city['worklist'];

  if (worklist_selection[--count] === wl.length - 1) return;

  while (count >= 0) {
    var task_idx = worklist_selection[count];
    swap = wl[task_idx + 1];
    wl[task_idx + 1] = wl[task_idx];
    wl[task_idx] = swap;
    worklist_selection[count]++;
    count--;
  }

  send_city_worklist(active_city['id']);
}

/**************************************************************************
 Removes the selected tasks, changing them for the selected production.
**************************************************************************/
function city_exchange_worklist_task()
{
  var prod_l = production_selection.length;
  if (prod_l === 0) return;

  var i;
  var same = true;
  var wl = active_city['worklist'];
  var task_l = worklist_selection.length;
  if (prod_l === task_l) {
    for (i = 0; i < prod_l; i++) {
      if (same &&
          (wl[worklist_selection[i]].kind !== production_selection[i].kind ||
           wl[worklist_selection[i]].value !== production_selection[i].value)) {
        same = false;
      }
      wl[worklist_selection[i]] = production_selection[i];
    }
  } else if (task_l === 1) {
    i = worklist_selection[0];
    wl.splice.apply(wl, [i, 1].concat(production_selection));
    same = false;
    while (--prod_l) {
      worklist_selection.push(++i);
    }
  }

  if (!same) {
    send_city_worklist(active_city['id']);
  }
}

/**************************************************************************
 Removes the selected tasks.
**************************************************************************/
function city_worklist_task_remove()
{
  var count = worklist_selection.length;
  if (count === 0) return;

  var wl = active_city['worklist'];

  while (--count >= 0) {
    wl.splice(worklist_selection[count], 1);
  }
  worklist_selection = [];

  send_city_worklist(active_city['id']);
}



/**********************************************************************//**
  Return TRUE iff the city is unhappy.  An unhappy city will fall
  into disorder soon.
**************************************************************************/
function city_unhappy(pcity)
{
  return (pcity['ppl_happy'][FEELING_FINAL]
          < pcity['ppl_unhappy'][FEELING_FINAL]
            + 2 * pcity['ppl_angry'][FEELING_FINAL]);
}

/**************************************************************************
 Returns the city state: Celebrating, Disorder or Peace.
**************************************************************************/
function get_city_state(pcity) 
{
  if (pcity == null) return;

  if (pcity['was_happy'] && pcity['size'] >= 3) {
    return "Celebrating";
  } else if (pcity['unhappy']) {
    return "Disorder";
  } else {
    return "Peace";
  }
}


/**************************************************************************
 Callback to handle keyboard events for the city dialog.
**************************************************************************/
function city_keyboard_listener(ev)
{
  // Check if focus is in chat field, where these keyboard events are ignored.
  if ($('input:focus').length > 0 || !keyboard_input) return;

  if (C_S_RUNNING != client_state()) return;

  if (!ev) ev = window.event;
  var keyboard_key = String.fromCharCode(ev.keyCode);
  var key_code = ev.keyCode;

  if (active_city != null) {

    switch (key_code) {
        case 27:
              ev.stopPropagation();
              close_city_dialog();
              break;
    }

     switch (keyboard_key) {
       case 'N':
         next_city();
         ev.stopPropagation();
         break;

       case 'B':
         request_city_buy();
         ev.stopPropagation();
         break;

       case 'W': // same command as ESC above (code 27)
         ev.stopPropagation();
         close_city_dialog_trigger();
         break;


      }
  }
}

/**************************************************************************
 Returns the 3d model name for the given city.
**************************************************************************/
function city_to_3d_model_name(pcity)
{
  var size = 0;
  if (pcity['size'] >=3 && pcity['size'] <=6) {
    size = 1;
  } else if (pcity['size'] > 6 && pcity['size'] <= 9) {
    size = 2;
  } else if (pcity['size'] > 9 && pcity['size'] <= 11) {
    size = 3;
  } else if (pcity['size'] > 11) {
    size = 4;
  }

  var style_id = pcity['style'];
  if (style_id == -1) style_id = 0;
  var city_rule = city_rules[style_id];

  var city_style_name = "european";
  if (city_rule['rule_name'] == "Modern") {
    city_style_name = "modern";
  }
  if (city_rule['rule_name'] == "Classical") {
    city_style_name = "roman";

    if (is_primary_capital(pcity)) {
      return "city_roman_capital";
    }
  }
  if (city_rule['rule_name'] == "Babylonian") {
    city_style_name = "babylonian";
  }
  if (city_rule['rule_name'] == "Asian") {
    city_style_name = "chinese";
  }
  if (city_rule['rule_name'] == "Industrial") {
    city_style_name = "european_industrial";
  }

  if (city_rule['rule_name'] == "PostModern") {
    city_style_name = "postmodern";
  }


  return "city_" + city_style_name + "_" + size;
}

/**************************************************************************
 ...
**************************************************************************/
function get_num_cities()
{
  var count = 0;

  for (var city_id in cities){
    var pcity = cities[city_id];
    if (client.conn.playing != null && city_owner(pcity) != null && city_owner(pcity).playerno == client.conn.playing.playerno) {
      count++;
    }
  }
  return count;
}