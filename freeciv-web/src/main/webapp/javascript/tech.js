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


const techs = {};

const tech_canvas_text_font = "18px Arial";

const is_tech_tree_init = false;
const tech_dialog_active = false;

const tech_xscale = 1.2;
const wikipedia_url = "http://en.wikipedia.org/wiki/";

/* TECH_KNOWN is self-explanatory, TECH_PREREQS_KNOWN are those for which all
 * requirements are fulfilled; all others (including those which can never
 * be reached) are TECH_UNKNOWN */
const TECH_UNKNOWN = 0;
const TECH_PREREQS_KNOWN = 1;
const TECH_KNOWN = 2;

const AR_ONE = 0;
const AR_TWO = 1;
const AR_ROOT = 2;
const AR_SIZE = 3;


const TF_BONUS_TECH = 0; /* player gets extra tech if rearched first */
const TF_BRIDGE = 1;    /* "Settler" unit types can build bridges over rivers */
const TF_RAILROAD = 2;  /* "Settler" unit types can build rail roads */
const TF_POPULATION_POLLUTION_INC = 3;  /* Increase the pollution factor created by population by one */
const TF_FARMLAND = 4;  /* "Settler" unit types can build farmland */
const TF_BUILD_AIRBORNE = 5; /* Player can build air units */
const TF_LAST = 6;

/*
  [kept for amusement and posterity]
typedef int Tech_type_id;
  Above typedef replaces old "enum tech_type_id"; see comments about
  Unit_type_id in unit.h, since mainly apply here too, except don't
  use Tech_type_id very widely, and don't use (-1) flag values. (?)
*/
/* [more accurately]
 * Unlike most other indices, the Tech_type_id is widely used, because it
 * so frequently passed to packet and scripting.  The client menu routines
 * sometimes add and substract these numbers.
 */
const A_NONE = 0;
const A_FIRST = 1;
const A_LAST = (MAX_NUM_ADVANCES + 1);
const A_FUTURE = (A_LAST + 1);
const A_UNSET = (A_LAST + 2);
const A_UNKNOWN = (A_LAST + 3);
const A_LAST_REAL = A_UNKNOWN;

const A_NEVER = null;

const tech_canvas = null;
const tech_canvas_ctx = null;

const tech_item_width = 208;
const tech_item_height = 52;
const maxleft = 0;
const clicked_tech_id = null;

const bulbs_output_updater = new EventAggregator(update_bulbs_output_info, 250,
                                               EventAggregator.DP_NONE,
                                               250, 3, 250);

/**************************************************************************
  Returns state of the tech for current pplayer.
  This can be: TECH_KNOWN, TECH_UNKNOWN, or TECH_PREREQS_KNOWN
  Should be called with existing techs or A_FUTURE

  If pplayer is NULL this checks whether any player knows the tech (used
  by the client).
**************************************************************************/
function player_invention_state(pplayer, tech_id)
{

  if (pplayer == null) {
    return TECH_UNKNOWN;
    /* FIXME: add support for global advances
    if (tech != A_FUTURE && game.info.global_advances[tech_id]) {
      return TECH_KNOWN;
    } else {
      return TECH_UNKNOWN;
    }*/
  } else {
    /* Research can be null in client when looking for tech_leakage
     * from player not yet received. */
    if (pplayer['inventions'] != null && pplayer['inventions'][tech_id] != null) {
      return pplayer['inventions'][tech_id];
    } else {
      return TECH_UNKNOWN;
    }
  }
}

/**************************************************************************
 ...
**************************************************************************/
function init_tech_screen()
{
  if (is_small_screen()) tech_canvas_text_font = "20px Arial";
  $("#technologies").width($(window).width() - 20);
  $("#technologies").height($(window).height() - $("#technologies").offset().top - 15);

  if (is_tech_tree_init) return;

  generate_req_tree();

  tech_canvas = document.getElementById('tech_canvas');
  if (tech_canvas == null) {
    console.log("unable to find tech canvas.");
    return;
  }
  tech_canvas_ctx = tech_canvas.getContext("2d");
  if ("imageSmoothingEnabled" in tech_canvas_ctx) {
    // if this Boolean value is false, images won't be smoothed when scaled. This property is true by default.
    tech_canvas_ctx.imageSmoothingEnabled = false;
  }

  const max_width = 0;
  const max_height = 0;
  for (let tech_id in techs) {
    if (!(tech_id+'' in reqtree) || reqtree[tech_id+''] == null) {
      continue;
    }
    const x = reqtree[tech_id+'']['x'];
    const y = reqtree[tech_id+'']['y'];
    if (x > max_width) max_width = x;
    if (y > max_height) max_height = y;
  }

  tech_canvas.width = (max_width + tech_item_width) * tech_xscale;
  tech_canvas.height = max_height + tech_item_height;

  if (is_small_screen()) {
    tech_canvas.width = Math.floor(tech_canvas.width * 0.6);
    tech_canvas.height = Math.floor(tech_canvas.height * 0.6);
    tech_canvas_ctx.scale(0.6,0.6);
    $("#tech_result_text").css("font-size", "85%");
    $("#tech_color_help").css("font-size", "65%");
    $("#tech_progress_box").css("padding-left", "10px");
  }

  is_tech_tree_init = true;
  clicked_tech_id = null;
}

/**************************************************************************
  95% of the time the above function is called to see if active player
  knows specific tech X. This wrapper makes it a lot easier.
**************************************************************************/
function tech_known(tech_str) {
  return (player_invention_state(client.conn.playing, tech_id_by_name(tech_str)) == TECH_KNOWN);
}

/**************************************************************************
 ...
**************************************************************************/
function update_tech_tree()
{
  const hy = 24;
  const hx = 48 + 160;

  tech_canvas_ctx.clearRect(0, 0, 5824, 726);

  for (let tech_id in techs) {
    const ptech = techs[tech_id];
    if (!(tech_id+'' in reqtree) || reqtree[tech_id+''] == null) {
      continue;
    }

    const sx = Math.floor(reqtree[tech_id+'']['x'] * tech_xscale);  //scale in X direction.
    const sy = reqtree[tech_id+'']['y'];
    for (const i = 0; i < ptech['req'].length; i++) {
      const rid = ptech['req'][i];
      if (rid == 0 || reqtree[rid+''] == null) continue;

      const dx = Math.floor(reqtree[rid+'']['x'] * tech_xscale);  //scale in X direction.
      const dy = reqtree[rid+'']['y'];

      // Alternating line colour sequence, each tech gets a different line colour to differentiate.
      const sequence = 1+Math.round(dy/55)+Math.round(dx/45);      // Create a "seed" that bumps up as we span the canvas vertically and horizontally
      sequence = sequence - (sequence-sequence%9);               // This creates a colour number from 0-8 out of our "seed"
      if (reqtree[rid+'']['col'] !== undefined) sequence = reqtree[rid+'']['col']; // Allow reqtree designer to override random colour for some techs

      // known tech connecting to known tech: use black line
      if (tech_known(ptech['rule_name']) && tech_known(techs[rid]['rule_name'])) {
        tech_canvas_ctx.strokeStyle = 'rgb(88, 88, 88)';
        tech_canvas_ctx.lineWidth = 1;
      }
      else { // else differentiate line colours to make tracing them easier
        if (sequence == 9) tech_canvas_ctx.strokeStyle =      'rgba(80, 80, 80, 0.95)';     // grey
        else if (sequence == 8) tech_canvas_ctx.strokeStyle = 'rgba(55, 83, 104, 0.83)';       // egyptian blue
        else if (sequence == 7) tech_canvas_ctx.strokeStyle = 'rgba(81, 146, 187, 0.8)';       // medium teal-blue
        else if (sequence == 6) tech_canvas_ctx.strokeStyle = 'rgba(121, 127, 82, 0.88)';      // olive / ochre
        else if (sequence == 5) tech_canvas_ctx.strokeStyle = 'rgba(138, 36, 78, 0.8)';        // wine
        else if (sequence == 4) tech_canvas_ctx.strokeStyle = 'rgba(80, 161, 80, 0.8)';      // bright sky
        else if (sequence == 3) tech_canvas_ctx.strokeStyle = 'rgba(60, 187, 146, 0.8)';       // bronze sea spray (strong green-cyan)
        else if (sequence == 2) tech_canvas_ctx.strokeStyle = 'rgba(124, 108, 167, 0.95)';     // periwinkle
        else if (sequence == 1) tech_canvas_ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';      // white
        else tech_canvas_ctx.strokeStyle =                    'rgba(150, 91, 79, 0.85)';       // coral / salmon
        tech_canvas_ctx.lineWidth = 3;
      }

      const node_offset = 3;
      tech_canvas_ctx.beginPath();
      tech_canvas_ctx.moveTo(sx, sy + hy);
      tech_canvas_ctx.lineTo(dx + hx+(node_offset+1), dy + hy);
      tech_canvas_ctx.stroke();

      // draw a node (helps indicate which line-colour is the real required tech: because we see a coloured node for it )
      const radius = 2;
      tech_canvas_ctx.lineWidth = 4;
      tech_canvas_ctx.beginPath();
      tech_canvas_ctx.arc(dx + hx+radius+node_offset, dy + hy, radius, 0, 2 * Math.PI, false);
      tech_canvas_ctx.stroke();
    }

  }

  tech_canvas_ctx.lineWidth = 1;

  for (let tech_id in techs) {
    const ptech = techs[tech_id];
    if (!(tech_id+'' in reqtree) || reqtree[tech_id+''] == null) {
      console.log("tech not found");
      continue;
    }

    const x = Math.floor(reqtree[tech_id+'']['x'] * tech_xscale)+2;  //scale in X direction.
    const y = reqtree[tech_id+'']['y']+2;

    /* KNOWN TECHNOLOGY */
    if (player_invention_state(client.conn.playing, ptech['id']) == TECH_KNOWN) {

      const tag = tileset_tech_graphic_tag(ptech);
      tech_canvas_ctx.fillStyle = 'rgb(255, 255, 255)';
      tech_canvas_ctx.fillRect(x-2, y-2, tech_item_width, tech_item_height);
      tech_canvas_ctx.strokeStyle = 'rgb(225, 225, 225)';
      tech_canvas_ctx.strokeRect(x-2, y-2, tech_item_width, tech_item_height);
      mapview_put_tile(tech_canvas_ctx, tag, x+1, y);

      tech_canvas_ctx.font = tech_canvas_text_font;
      tech_canvas_ctx.fillStyle = "rgba(0, 0, 0, 1)";
      tech_canvas_ctx.fillText(ptech['name'], x + 50, y + 15);

      if (x > maxleft) maxleft = x;


    /* TECH WITH KNOWN PREREQS. */
    } else if (player_invention_state(client.conn.playing, ptech['id']) == TECH_PREREQS_KNOWN) {
      const bgcolor = (is_tech_req_for_goal(ptech['id'], client.conn.playing['tech_goal'])) ? "rgb(131, 170, 101)" : "rgb(91, 130, 61)";
      if (client.conn.playing['researching'] == ptech['id']) {
        bgcolor = "rgb(161, 200, 131)";
        tech_canvas_ctx.lineWidth=6;
      }

      const tag = tileset_tech_graphic_tag(ptech);
      tech_canvas_ctx.lineWidth=4;
      tech_canvas_ctx.fillStyle = bgcolor;
      tech_canvas_ctx.fillRect(x-2, y-2, tech_item_width, tech_item_height);
      tech_canvas_ctx.strokeStyle = 'rgb(255, 255, 255)';
      tech_canvas_ctx.strokeRect(x-2, y-2, tech_item_width, tech_item_height);
      tech_canvas_ctx.lineWidth=2;
      mapview_put_tile(tech_canvas_ctx, tag, x+1, y);

      if (client.conn.playing['researching'] == ptech['id']) {
        tech_canvas_ctx.fillStyle = 'rgb(0, 0, 0)';
        tech_canvas_ctx.font = "Bold " + tech_canvas_text_font;
      } else {
        tech_canvas_ctx.font = tech_canvas_text_font;
        tech_canvas_ctx.fillStyle = 'rgb(255, 255, 255)';
      }
      tech_canvas_ctx.fillText(ptech['name'], x + 51, y + 16);

    /* UNKNOWN TECHNOLOGY. */
    } else if (player_invention_state(client.conn.playing, ptech['id']) == TECH_UNKNOWN) {
      let bgcolor = (is_tech_req_for_goal(ptech['id'], client.conn.playing['tech_goal'])) ? "rgb(111, 141, 180)" : "rgb(61, 95, 130)";
      if (client.conn.playing['tech_goal'] == ptech['id']) {
        tech_canvas_ctx.lineWidth=6;
      }

      const tag = tileset_tech_graphic_tag(ptech);
      tech_canvas_ctx.fillStyle =  bgcolor;
      tech_canvas_ctx.fillRect(x-2, y-2, tech_item_width, tech_item_height);
      tech_canvas_ctx.strokeStyle = 'rgb(255, 255, 255)';
      tech_canvas_ctx.strokeRect(x-2, y-2, tech_item_width, tech_item_height);
      tech_canvas_ctx.lineWidth=2;
      mapview_put_tile(tech_canvas_ctx, tag, x+1, y);

      if (client.conn.playing['tech_goal'] == ptech['id']) {
        tech_canvas_ctx.fillStyle = 'rgb(0, 0, 0)';
        tech_canvas_ctx.font = "Bold " + tech_canvas_text_font;
      } else {
        tech_canvas_ctx.fillStyle = 'rgb(255, 255, 255)';
        tech_canvas_ctx.font = tech_canvas_text_font;
      }
      tech_canvas_ctx.fillText(ptech['name'], x + 51, y + 16);
    }

    const tech_things = 0;
    const prunits = get_utypes_from_tech(tech_id);
    for (const i = 0; i < prunits.length; i++) {
      const ptype = prunits[i];

      // Suppress nuclear units if server settings don't allow them:
      if (utype_has_flag(ptype, UTYF_NUCLEAR)) {
        if (!server_settings['nukes_minor']['val']) continue; // Nukes totally turned off in this game, skip them
        if (!server_settings['nukes_major']['val']) {
          if (ptype['bombard_rate']>0) continue;   // if major nukes are OFF, suppress illegal prod choice.
          if (ptype['bombard_rate']<-1) continue;  // if major nukes are OFF, suppress illegal prod choice.
        }
      }

      const sprite = sprites[tileset_unit_type_graphic_tag(ptype)];
      if (sprite != null) {
        tech_canvas_ctx.drawImage(sprite, x + 50 + ((tech_things++) * 30), y + 23, 28, 24);
      }
    }


    const primprovements = get_improvements_from_tech(tech_id);
    for (const i = 0; i < primprovements.length; i++) {
      const pimpr = primprovements[i];
      const sprite = sprites[tileset_building_graphic_tag(pimpr)];
      if (sprite != null) {
        tech_canvas_ctx.drawImage(sprite, x + 50 + ((tech_things++) * 30), y + 23, 28, 24);
      }
    }
  }
}

/**************************************************************************
 Determines if the technology 'check_tech_id' is a requirement
 for reaching the technology 'goal_tech_id'.
**************************************************************************/
function is_tech_req_for_goal(check_tech_id, goal_tech_id)
{
  if (check_tech_id == goal_tech_id) return true;
  if (goal_tech_id == 0 || check_tech_id == 0) return false;

    const goal_tech = techs[goal_tech_id];
    if (goal_tech == null) return false;

    for (const i = 0; i < goal_tech['research_reqs'].length; i++) {
      const rid = goal_tech['research_reqs'][i]['value'];
      if (check_tech_id == rid) {
        return true;
      } else if (is_tech_req_for_goal(check_tech_id, rid)) {
        return true;
      }
    }

    return false;

}

/**************************************************************************
 Determines if the technology 'check_tech_id' is a direct requirement
 for reaching the technology 'next_tech_id'.
**************************************************************************/
function is_tech_req_for_tech(check_tech_id, next_tech_id)
{
  if (check_tech_id == next_tech_id) return false;
  if (next_tech_id == 0 || check_tech_id == 0) return false;

    const next_tech = techs[next_tech_id];
    if (next_tech == null) return false;

    for (const i = 0; i < next_tech['research_reqs'].length; i++) {
      const rid = next_tech['research_reqs'][i]['value'];
      if (check_tech_id == rid) {
        return true;
      }
    }

    return false;

}

/**************************************************************************
 ...
**************************************************************************/
function update_tech_screen()
{

  if (client_is_observer() || client.conn.playing == null) {
    show_observer_tech_dialog();
    return;
  }

  init_tech_screen();
  update_tech_tree();


  const research_goal_text = "No research target selected.<br>Please select a technology now";
  if (techs[client.conn.playing['researching']] != null) {
    research_goal_text = "Researching: " + techs[client.conn.playing['researching']]['name'];
  }
  if (techs[client.conn.playing['tech_goal']] != null) {
    research_goal_text = research_goal_text + "<br>Research Goal: "
        + techs[client.conn.playing['tech_goal']]['name'];
  }
  $("#tech_goal_box").html(research_goal_text);

  $("#tech_progress_text").html("Research progress: "
                                + client.conn.playing['bulbs_researched']
                                + " / "
                                + client.conn.playing['researching_cost']);

  const pct_progress = 100 * (client.conn.playing['bulbs_researched']
                            / client.conn.playing['researching_cost']);

  $("#progress_fg").css("width", pct_progress  + "%");

  if (clicked_tech_id != null) {
    $("#tech_result_text").html("<span id='tech_advance_helptext'>" + get_advances_text(clicked_tech_id) + "</span>");
    $("#tech_advance_helptext").tooltip({ disabled: false });
  } else if (techs[client.conn.playing['researching']] != null) {
    $("#tech_result_text").html("<span id='tech_advance_helptext'>" + get_advances_text(client.conn.playing['researching']) + "</span>");
    $("#tech_advance_helptext").tooltip({ disabled: false });
  }

  $("#tech_tab_item").css("color", "#000000");

  /* scroll the tech tree, so that the current research targets are on the screen..  */
  maxleft = maxleft - 280;
  if (maxleft < 0) maxleft = 0;
  if (!tech_dialog_active) {
    setTimeout(scroll_tech_tree,10);
  }

  tech_dialog_active = true;

}

/**************************************************************************
 Returns for example "Bronze working allows building phalanx."
**************************************************************************/
function get_advances_text(tech_id)
{
  const num = (value) => value === null ? 'null' : value;
  const tech_span = (name, unit_id, impr_id, title) =>
    `<span ${title ? `title='${title}'` : ''}`
    + ` onclick='show_tech_info_dialog("${name}", ${num(unit_id)}, ${num(impr_id)})'>${name}</span>`;

  const is_valid_and_required = (next_tech_id) =>
    reqtree.hasOwnProperty(next_tech_id) && is_tech_req_for_tech(tech_id, next_tech_id);

  const format_list_with_intro = (intro, list) =>
    (list = list.filter(Boolean)).length ? (intro + ' ' + list.join(', ')) : '';

  const ptech = techs[tech_id];
  const cost = Math.floor(ptech.cost);
  const saved = 0;

  // Adjust tech cost for sciencebox
  if (game_info["sciencebox"] != 100)   {
    cost = ptech.cost * game_info["sciencebox"] / 100;
    cost = Math.floor(cost);
  }

  // Shows what the server tells us the cost really is (e.g., tech_leak, other effects)
  if (!client_is_observer()) {
    if (client.conn.playing.advance_costs) {
      if (client.conn.playing.advance_costs[tech_id]) {
        cost = client.conn.playing.advance_costs[tech_id];
        saved = client.conn.playing.advance_saved_bulbs[tech_id];
      }
    }
  }
  // Shows bulbs saved into the tech, if you have them
  if (saved) cost = "" + saved + "/" + cost + "";

  return tech_span(ptech.name, null, null) + ' (' + cost + ')'
    + format_list_with_intro(' enables',
      [
        format_list_with_intro('', get_utypes_from_tech(tech_id)
          .map(unit => tech_span(unit.name, unit.id, null,
            "A:"+fractionalize(utype_real_base_attack_strength(unit)) +" D:"+fractionalize(utype_real_base_defense_strength(unit)) +(unit.firepower>1?" F:"+unit.firepower:"") +" H:"+unit.hp
            +" M:"+move_points_text(unit.move_rate+(unit.move_bonus[0]?unit.move_bonus[0]:0),true)+(unit.fuel?"("+unit.fuel+")":"")
            +(unit.transport_capacity?" C:"+unit.transport_capacity:"") +" Cost:"+unit.build_cost +"\n\n"
            + html_safe(cleaned_text(unit.helptext))))),
        format_list_with_intro('', get_improvements_from_tech(tech_id)
          .map(impr => tech_span(impr.name, null, impr.id,
            "Cost:"+impr.build_cost+" Upkeep:"+impr.upkeep + "\n\n"
            + html_safe(cleaned_text(impr.helptext))))),
        format_list_with_intro('', Object.keys(techs)
          .filter(is_valid_and_required)
          .map(tid => techs[tid])
          .map(tech => tech_span(tech.name, null, null, tech.rule_name+" ("+Math.trunc(tech.cost)+") "
          + uncapitalize(html_safe(cleaned_text(tech.helptext))))))
      ]) + '.';
}

/**************************************************************************
 ...
**************************************************************************/
function scroll_tech_tree()
{
  $("#technologies").scrollLeft(maxleft);
}


/**************************************************************************
 ...
**************************************************************************/
function send_player_research(tech_id)
{
  const packet = {"pid" : packet_player_research, "tech" : tech_id};
  send_request(JSON.stringify(packet));
  $("#tech_dialog").dialog('close');
}

/**************************************************************************
 ...
**************************************************************************/
function send_player_tech_goal(tech_id)
{
  const packet = {"pid" : packet_player_tech_goal, "tech" : tech_id};
  send_request(JSON.stringify(packet));
}

/****************************************************************************
  This function is triggered when the mouse is clicked on the tech canvas.
****************************************************************************/
function tech_mapview_mouse_click(e)
{

  let rightclick;
  if (!e) const e = window.event;
  if (e.which) {
    rightclick = (e.which == 3);
  } else if (e.button) {
    rightclick = (e.button == 2);
  }

  if (rightclick) {
    if (mouse_x > $(window).width() / 2) {
      $("#technologies").scrollLeft($("#technologies").scrollLeft() + 150);
    } else {
        $("#technologies").scrollLeft($("#technologies").scrollLeft() - 150);
    }
    return;
  }

   if (tech_canvas != null) {
    const tech_mouse_x = mouse_x - $("#technologies").offset().left + $("#technologies").scrollLeft();
    const tech_mouse_y = mouse_y - $("#technologies").offset().top + $("#technologies").scrollTop();

    for (let tech_id in techs) {
      const ptech = techs[tech_id];
      if (!(tech_id+'' in reqtree)) continue;

      const x = Math.floor(reqtree[tech_id+'']['x'] * tech_xscale)+2;  //scale in X direction.
      const y = reqtree[tech_id+'']['y']+2;

      if (is_small_screen()) {
        x = x * 0.6;
        y = y * 0.6;
      }

      if (tech_mouse_x > x && tech_mouse_x < x + tech_item_width
          && tech_mouse_y > y && tech_mouse_y < y + tech_item_height) {
        if (player_invention_state(client.conn.playing, ptech['id']) == TECH_PREREQS_KNOWN) {
          send_player_research(ptech['id']);
        } else if (player_invention_state(client.conn.playing, ptech['id']) == TECH_UNKNOWN) {
          send_player_tech_goal(ptech['id']);
        }
        clicked_tech_id = ptech['id'];
      }
    }
  }

  update_tech_screen();

}

/**************************************************************************
 ...
**************************************************************************/
function get_tech_infobox_html(tech_id)
{
  const infobox_html = "";
  const ptech = techs[tech_id];
  const tag = tileset_tech_graphic_tag(ptech);

  if (tag == null) return null;
  const tileset_x = tileset[tag][0];
  const tileset_y = tileset[tag][1];
  const width = tileset[tag][2];
  const height = tileset[tag][3];
  const i = tileset[tag][4];
  const image_src = "/tileset/freeciv-web-tileset-" + tileset_name + "-" + i + get_tileset_file_extention() + "?ts=" + ts;
  if (is_small_screen()) {
    infobox_html += "<div class='specific_tech' onclick='send_player_research(" + tech_id + ");' title='"
	   + get_advances_text(tech_id).replace(/(<([^>]+)>)/ig,"") + "'>"
	   +  ptech['name']
	   + "</div>";
  } else {
    infobox_html += "<div class='specific_tech' onclick='send_player_research(" + tech_id + ");' title='"
	   + get_advances_text(tech_id).replace(/(<([^>]+)>)/ig,"") + "'>"
           + "<div class='tech_infobox_image' style='background: transparent url("
           + image_src
	   + ");background-position:-" + tileset_x + "px -" + tileset_y
           + "px;  width: " + width + "px;height: " + height + "px;'"
           + "'></div>"
	   +  ptech['name']
	   + "</div>";
  }

  return infobox_html;
}

/**************************************************************************
 This will show the tech gained dialog for normal games. This will store 
 the gained tech, for pbem games, to be displayed at beginning of next turn.
**************************************************************************/
function queue_tech_gained_dialog(tech_gained_id)
{
  if (client_is_observer() || C_S_RUNNING != client_state()) return;

  show_tech_gained_dialog(tech_gained_id);

}

/**************************************************************************
 ...
**************************************************************************/
function show_tech_gained_dialog(tech_gained_id)
{
  if (client_is_observer() || C_S_RUNNING != client_state()) return;

  $("#tech_tab_item").css("color", "#aa0000");
  const pplayer = client.conn.playing;
  const tech = techs[tech_gained_id];
  if (tech == null) return;

  const title = tech['name'] + " discovered!";
  const message = "The " + nations[pplayer['nation']]['adjective'] + " have discovered " + tech['name'] + ".<br>";
  message += "<span id='tech_advance_helptext'>" + get_advances_text(tech_gained_id) + "</span>";

  const tech_choices = [];
  for (let next_tech_id in techs) {
    const ntech = techs[next_tech_id];
    if (!(next_tech_id+'' in reqtree)) continue;
    if (player_invention_state(client.conn.playing, ntech['id']) == TECH_PREREQS_KNOWN) {
      tech_choices.push(ntech);
    }
  }

  message += "<br>You can now research:<br><div id='tech_gained_choice'>";
  for (const i = 0; i < tech_choices.length; i++) {
    message += get_tech_infobox_html(tech_choices[i]['id']);
  }
  message += "</div>";

  // reset dialog page.
  $("#tech_dialog").remove();
  $("<div id='tech_dialog'></div>").appendTo("div#game_page");

  $("#tech_dialog").html(message);
  $("#tech_dialog").attr("title", title);
  $("#tech_dialog").dialog({
			bgiframe: true,
			modal: false,
			width: is_small_screen() ? "90%" : "60%",
			buttons: [
			 {
                text : "Close",
                click : function() {
                  $("#tech_dialog").dialog('close');
                  $("#game_text_input").blur();
                }
            },{
				text : "Show Technology Tree",
				click : function() {
                  $("#tabs").tabs("option", "active", 2);
                  set_default_mapview_inactive();
                  update_tech_screen();
				  $("#tech_dialog").dialog('close');
                }
              }
             ]
		}).dialogExtend({
                     "minimizable" : true,
                     "closable" : true,
                     "icons" : {
                       "minimize" : "ui-icon-circle-minus",
                       "restore" : "ui-icon-newwin"
                     }});

  $("#tech_dialog").dialog('open');
  $("#game_text_input").blur();
  $("#tech_advance_helptext").tooltip({ disabled: false });
  $(".specific_tech").tooltip({ disabled: false });

  if (dialogs_minimized_setting) {
    $("#tech_dialog").dialogExtend("minimize");
  }

}

/**************************************************************************
 ...
**************************************************************************/
function show_wikipedia_dialog(tech_name)
{
  $("#tech_tab_item").css("color", "#aa0000");
  if (freeciv_wiki_docs == null || freeciv_wiki_docs[tech_name] == null) return;

  const message = "<b>Wikipedia on <a href='" + wikipedia_url
	  + freeciv_wiki_docs[tech_name]['title']
	  + "' target='_new'>" + freeciv_wiki_docs[tech_name]['title']
	  + "</a></b><br>";
  if (freeciv_wiki_docs[tech_name]['image'] != null) {
    message += "<img id='wiki_image' src='/images/wiki/" + freeciv_wiki_docs[tech_name]['image'] + "'><br>";
  }

  message += freeciv_wiki_docs[tech_name]['summary'];

  // reset dialog page.
  $("#wiki_dialog").remove();
  $("<div id='wiki_dialog'></div>").appendTo("div#game_page");

  $("#wiki_dialog").html(message);
  $("#wiki_dialog").attr("title", tech_name);
  $("#wiki_dialog").dialog({
			bgiframe: true,
			modal: true,
			width: is_small_screen() ? "90%" : "60%",
			buttons: {
				Ok: function() {
					$("#wiki_dialog").dialog('close');
				}
			}
		});

  $("#wiki_dialog").dialog('open');
  $("#wiki_dialog").css("max-height", $(window).height() - 100);
  $("#game_text_input").blur();
}

/**************************************************************************
 Shows info about a tech, unit or improvement based on helptext and wikipedia.
**************************************************************************/
function show_tech_info_dialog(tech_name, unit_type_id, improvement_id)
{
  $("#tech_tab_item").css("color", "#aa0000");

  const message = "";

  if (unit_type_id != null) {
     const punit_type = unit_types[unit_type_id];
     message += "<b>Unit info</b>: " + punit_type['helptext'] + "<br><br>"
     + "Cost: " + punit_type['build_cost']
     + "<br>Attack: " + punit_type['attack_strength']
     + "<br>Defense: " + punit_type['defense_strength']
     + "<br>Firepower: " + punit_type['firepower']
     + "<br>Hitpoints: " + punit_type['hp']
     + "<br>Moves: " + move_points_text(punit_type['move_rate'])
     + "<br>Vision: " + punit_type['vision_radius_sq']
     + "<br><br>";
  }

  if (improvement_id != null) message += "<b>Improvement info</b>: " + improvements[improvement_id]['helptext'] + "<br><br>";

  if (freeciv_wiki_docs[tech_name] != null) {
    message += "<b>Wikipedia on <a href='" + wikipedia_url
	  + freeciv_wiki_docs[tech_name]['title']
	  + "' target='_new' style='color: black;'>" + freeciv_wiki_docs[tech_name]['title']
	  + "</a>:</b><br>";

    if (freeciv_wiki_docs[tech_name]['image'] != null) {
      message += "<img id='wiki_image' src='/images/wiki/" + freeciv_wiki_docs[tech_name]['image'] + "'><br>";
    }

    message += freeciv_wiki_docs[tech_name]['summary'];
  }

  // reset dialog page.
  $("#wiki_dialog").remove();
  $("<div id='wiki_dialog'></div>").appendTo("div#game_page");

  $("#wiki_dialog").html(message);
  $("#wiki_dialog").attr("title", tech_name);
  $("#wiki_dialog").dialog({
			bgiframe: true,
			modal: true,
			width: is_small_screen() ? "95%" : "70%",
			height: $(window).height() - 60,
			buttons: {
				Ok: function() {
					$("#wiki_dialog").dialog('close');
				}
			}
		});

  $("#wiki_dialog").dialog('open');
  $("#game_text_input").blur();
}


/**************************************************************************
 ...
**************************************************************************/
function update_tech_dialog_cursor()
{
    tech_canvas.style.cursor = "default";
    const tech_mouse_x = mouse_x - $("#technologies").offset().left + $("#technologies").scrollLeft();
    const tech_mouse_y = mouse_y - $("#technologies").offset().top + $("#technologies").scrollTop();

    for (let tech_id in techs) {
      const ptech = techs[tech_id];
      if (!(tech_id+'' in reqtree)) continue;

      const x = Math.floor(reqtree[tech_id+'']['x'] * tech_xscale)+2;  //scale in X direction.
      const y = reqtree[tech_id+'']['y']+2;

      if (is_small_screen()) {
        x = x * 0.6;
        y = y * 0.6;
      }

      if (tech_mouse_x > x && tech_mouse_x < x + tech_item_width
          && tech_mouse_y > y && tech_mouse_y < y + tech_item_height) {
        if (player_invention_state(client.conn.playing, ptech['id']) == TECH_PREREQS_KNOWN) {
          tech_canvas.style.cursor = "pointer";
        } else if (player_invention_state(client.conn.playing, ptech['id']) == TECH_UNKNOWN) {
          tech_canvas.style.cursor = "pointer";
        } else {
          tech_canvas.style.cursor = "not-allowed";
        }
        $("#tech_result_text").html("<span id='tech_advance_helptext'>" + get_advances_text(ptech['id']) + "</span>");
        $("#tech_advance_helptext").tooltip({ disabled: false });
      }
    }
}


/**************************************************************************
 ...
**************************************************************************/
function show_observer_tech_dialog()
{
  $("#tech_info_box").hide();
  $("#tech_canvas").hide();
  const msg = "<h2>Research</h2>";
  for (let player_id in players) {
    const pplayer = players[player_id];
    const pname = pplayer['name'];
    const pr = research_get(pplayer);
    if (pr == null) continue;

    const researching = pr['researching'];
    if (techs[researching] != null)  {
      msg += pname + ": " + techs[researching]['name'] + "<br>";
    }
  }
  $("#technologies").html(msg);
  $("#technologies").css("color", "black");
}

/**************************************************************************
 Calculates current research output.

 Returns:
    self_bulbs: current "gross" bulbs output from player
    self_upkeep: upkeep cost for player (to deduce from self_bulbs)
    pooled: whether there's pooled research AND other players in the team
    team_bulbs: total bulbs output from the team, player included
    team_upkeep: total upkeep cost for the team, player included
**************************************************************************/
function get_current_bulbs_output()
{
  const self_bulbs = 0;
  const self_upkeep = 0;
  const pooled = false;
  const team_bulbs = 0;
  const team_upkeep = 0;

  if (!client_is_observer() && client.conn.playing != null) {

    const cplayer = client.conn.playing.playerno;
    for (let city_id in cities){
      const city = cities[city_id];
      if(city.owner === cplayer) {
        self_bulbs += city.prod[O_SCIENCE];
      }
    }
    self_upkeep = client.conn.playing.tech_upkeep;

    if (game_info['team_pooled_research']) {
      const team = client.conn.playing.team;
      for (let player_id in players) {
        const player = players[player_id];
        if (player.team === team && player.is_alive) {
          team_upkeep += player.tech_upkeep;
          if (player.playerno !== cplayer) {
            pooled = true;
          }
        }
      }
      if (pooled) {
        team_bulbs = research_data[team].total_bulbs_prod;
      }
    }

    if (!pooled) {
      /* With no team mates, player's total_bulbs_prod may not be accurate
       * because the server doesn't send an update research info packet for
       * tax rates or specialist changes.
       */
      team_bulbs = self_bulbs;
      team_upkeep = self_upkeep;
    }
  }

  return {
    self_bulbs: self_bulbs, self_upkeep,
    pooled: pooled, team_bulbs,
    team_upkeep: team_upkeep
  };
}

/**************************************************************************
 Returns a textual description of current bulbs output.
**************************************************************************/
function get_current_bulbs_output_text(cbo)
{
  if (cbo === undefined) {
    cbo = get_current_bulbs_output();
  }

  let text;
  if (cbo.self_bulbs === 0 && cbo.self_upkeep === 0) {
    text = "No bulbs researched";
  } else {
    text = cbo.self_bulbs;
    const net = cbo.self_bulbs - cbo.self_upkeep;
    if (cbo.self_upkeep !== 0) {
      text = text + " - " + cbo.self_upkeep + " = " + net;
    }
    if (1 == Math.abs(net)) {
      text = text + " bulb/turn";
    } else {
      text = text + " bulbs/turn";
    }
  }
  if (cbo.pooled) {
    text = text + " (" + (cbo.team_bulbs - cbo.team_upkeep) + " team total)";
  }

  if (cbo.team_bulbs > 0 && client.conn.playing['researching_cost'] != 0) {
    const turns_left = Math.ceil((client.conn.playing['researching_cost'] - client.conn.playing['bulbs_researched']) / cbo.team_bulbs);
    const turns_left_plural = (turns_left > 1) ? " turns)" : " turn)";
    const turns_left_text = " ("+turns_left+turns_left_plural;
    text = text + turns_left_text;
  }

  return text;
}

/**************************************************************************
 Updates bulbs output info.
**************************************************************************/
function update_bulbs_output_info()
{
  const cbo = get_current_bulbs_output();
  $('#bulbs_output').html(get_current_bulbs_output_text(cbo));
  update_net_bulbs(cbo.self_bulbs - cbo.self_upkeep);
}

/**************************************************************************
 Finds tech id by exact name.
 Null if not found.
**************************************************************************/
function tech_id_by_name(tname)
{
  for (let tech_id in techs) {
    if (tname == techs[tech_id]['name']) return tech_id;
  }
  return null;
}

