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


const num_cardinal_tileset_dirs = 4;
const cardinal_tileset_dirs = [DIR8_NORTH, DIR8_EAST, DIR8_SOUTH, DIR8_WEST];

const NUM_CORNER_DIRS = 4;

const DIR4_TO_DIR8 = [ DIR8_NORTH, DIR8_SOUTH, DIR8_EAST, DIR8_WEST];

const current_select_sprite = 0;
const max_select_sprite = 4;

const explosion_anim_map = {};

/* Items on the mapview are drawn in layers.  Each entry below represents
 * one layer.  The names are basically arbitrary and just correspond to
 * groups of elements in fill_sprite_array().  Callers of fill_sprite_array
 * must call it once for each layer. */
const LAYER_TERRAIN1 = 0;
const LAYER_TERRAIN2 = 1;
const LAYER_TERRAIN3 = 2;
const LAYER_ROADS = 3;
const LAYER_SPECIAL1 = 4;
const LAYER_CITY1 = 5;
const LAYER_SPECIAL2 = 6;
const LAYER_UNIT = 7;
const LAYER_FOG = 8;
const LAYER_SPECIAL3 = 9;
const LAYER_TILELABEL = 10;
const LAYER_CITYBAR = 11;
const LAYER_GOTO = 12;
const LAYER_COUNT = 13;

// these layers are not used at the moment, for performance reasons.
//const LAYER_BACKGROUND =  ; (not in use)
//const LAYER_EDITOR =  ; (not in use)
//let LAYER_GRID* = ; (not in use)

/* An edge is the border between two tiles.  This structure represents one
 * edge.  The tiles are given in the same order as the enumeration name. */
const EDGE_NS = 0; /* North and south */
const EDGE_WE = 1; /* West and east */
const EDGE_UD = 2; /* Up and down (nw/se), for hex_width tilesets */
const EDGE_LR = 3; /* Left and right (ne/sw), for hex_height tilesets */
const EDGE_COUNT = 4;

const MATCH_NONE = 0;
const MATCH_SAME = 1;		/* "boolean" match */
const MATCH_PAIR = 2;
const MATCH_FULL = 3;

const CELL_WHOLE = 0;		/* entire tile */
const CELL_CORNER = 1;	/* corner of tile */

/* Darkness style.  Don't reorder this enum since tilesets depend on it. */
/* No darkness sprites are drawn. */
const DARKNESS_NONE = 0;

/* 1 sprite that is split into 4 parts and treated as a darkness4.  Only
 * works in iso-view. */
const DARKNESS_ISORECT = 1;

/* 4 sprites, one per direction.  More than one sprite per tile may be
 * drawn. */
const DARKNESS_CARD_SINGLE = 2;

/* 15=2^4-1 sprites.  A single sprite is drawn, chosen based on whether
 * there's darkness in _each_ of the cardinal directions. */
const DARKNESS_CARD_FULL = 3;

/* Corner darkness & fog.  3^4 = 81 sprites. */
const DARKNESS_CORNER = 4;

const terrain_match = {"t.l0.hills1" : MATCH_NONE,
"t.l0.mountains1" : MATCH_NONE,
"t.l0.plains1" : MATCH_NONE,
"t.l0.desert1" : MATCH_NONE

};

/**************************************************************************
  Returns true iff the tileset has graphics for the specified tag.
**************************************************************************/
function tileset_has_tag(tagname)
{
  return (sprites[tagname] != null);
}

/**************************************************************************
  Returns the tag name of the sprite of a ruleset entity where the
  preferred tag name is in the 'graphic_str' field, the fall back tag in
  case the tileset don't support the first tag is the 'graphic_alt' field
  and the entity name is stored in the 'name' field.
**************************************************************************/
function tileset_ruleset_entity_tag_str_or_alt(entity, kind_name)
{
  if (entity == null) {
    console.log("No " + kind_name + " to return tag for.");
    return null;
  }

  if (tileset_has_tag(entity['graphic_str'] + "_Idle")) {
    return entity['graphic_str'] + "_Idle";
  }

  if (tileset_has_tag(entity['graphic_str'])) {
    return entity['graphic_str'];
  }

  if (tileset_has_tag(entity['graphic_alt'])) {
    return entity['graphic_alt'];
  }

  if (tileset_has_tag(entity['graphic_alt'] + "_Idle")) {
    return entity['graphic_alt'] + "_Idle";
  }

  console.log("No graphic for " + kind_name + " " + entity['name']);
  return null;
}

/**************************************************************************
  Returns the tag name of the graphic showing the specified Extra on the
  map.
**************************************************************************/
function tileset_extra_graphic_tag(extra)
{
  return tileset_ruleset_entity_tag_str_or_alt(extra, "extra");
}

/**************************************************************************
  Returns the tag name of the graphic showing the specified unit type.
**************************************************************************/
function tileset_unit_type_graphic_tag(utype)
{
  if (tileset_has_tag(utype['graphic_str'] + "_Idle")) {
    return utype['graphic_str'] + "_Idle";
  }

  if (tileset_has_tag(utype['graphic_alt'] + "_Idle")) {
    return utype['graphic_alt'] + "_Idle";
  }

  console.log("No graphic for unit " + utype['name']);
  return null;
}

/**************************************************************************
  Returns the tag name of the graphic for the unit.
**************************************************************************/
function tileset_unit_graphic_tag(punit)
{
  /* Currently always uses the default "_Idle" sprite */
  return tileset_unit_type_graphic_tag(unit_type(punit));
}

/**************************************************************************
  Returns the tag name of the graphic showing the specified building.
**************************************************************************/
function tileset_building_graphic_tag(pimprovement)
{
  return tileset_ruleset_entity_tag_str_or_alt(pimprovement, "building");
}

/**************************************************************************
  Returns the tag name of the graphic showing the specified tech.
**************************************************************************/
function tileset_tech_graphic_tag(ptech)
{
  return tileset_ruleset_entity_tag_str_or_alt(ptech, "tech");
}

/**************************************************************************
  Returns the tag name of the graphic showing the Extra specified by ID on
  the map.
**************************************************************************/
function tileset_extra_id_graphic_tag(extra_id)
{
  return tileset_extra_graphic_tag(extras[extra_id]);
}

/**************************************************************************
  Returns the tag name of the graphic showing that a unit is building the
  specified Extra.
**************************************************************************/
function tileset_extra_activity_graphic_tag(extra)
{
  if (extra == null) {
    console.log("No extra to return tag for.");
    return null;
  }

  if (tileset_has_tag(extra['activity_gfx'])) {
    return extra['activity_gfx'];
  }

  if (tileset_has_tag(extra['act_gfx_alt'])) {
    return extra['act_gfx_alt'];
  }

  if (tileset_has_tag(extra['act_gfx_alt2'])) {
    return extra['act_gfx_alt2'];
  }

  console.log("No activity graphic for extra " + extra['name']);
  return null;
}

/**************************************************************************
  Returns the tag name of the graphic showing that a unit is building the
  Extra specified by the id.
**************************************************************************/
function tileset_extra_id_activity_graphic_tag(extra_id)
{
  return tileset_extra_activity_graphic_tag(extras[extra_id]);
}


/****************************************************************************
  Add sprites for the base tile to the sprite list.  This doesn't
  include specials or rivers.
****************************************************************************/
function fill_terrain_sprite_layer(layer_num, ptile, pterrain, tterrain_near)
{
  /* FIXME: handle blending and darkness. */

  return fill_terrain_sprite_array(layer_num, ptile, pterrain, tterrain_near);

}

/**********************************************************************
  Determine the sprite_type string.
***********************************************************************/
function check_sprite_type(sprite_type)
{
  if (sprite_type == "corner") {
    return CELL_CORNER;
  }
  if (sprite_type == "single") {
    return CELL_WHOLE;
  }
  if (sprite_type == "whole") {
    return CELL_WHOLE;
  }
  return CELL_WHOLE;
}




/**************************************************************************
  Return the tileset name of the direction.  This is similar to
  dir_get_name but you shouldn't change this or all tilesets will break.
**************************************************************************/
function dir_get_tileset_name(dir)
{
  switch (dir) {
  case DIR8_NORTH:
    return "n";
  case DIR8_NORTHEAST:
    return "ne";
  case DIR8_EAST:
    return "e";
  case DIR8_SOUTHEAST:
    return "se";
  case DIR8_SOUTH:
    return "s";
  case DIR8_SOUTHWEST:
    return "sw";
  case DIR8_WEST:
    return "w";
  case DIR8_NORTHWEST:
    return "nw";
  }

  return "";
}


/****************************************************************************
  Return a directional string for the cardinal directions.  Normally the
  binary value 1000 will be converted into "n1e0s0w0".  This is in a
  clockwise ordering.
****************************************************************************/
function cardinal_index_str(idx)
{
  const c = "";

  for (const i = 0; i < num_cardinal_tileset_dirs; i++) {
    const value = (idx >> i) & 1;

    c += dir_get_tileset_name(cardinal_tileset_dirs[i]) + value;
  }

  return c;
}


/**********************************************************************
  Return the flag graphic to be used by the city.
***********************************************************************/
function get_city_flag_sprite(pcity) {
  const owner_id = pcity['owner'];
  if (owner_id == null) return {};
  const owner = players[owner_id];
  if (owner == null) return {};
  const nation_id = owner['nation'];
  if (nation_id == null) return {};
  const nation = nations[nation_id];
  if (nation == null) return {};
  return {"key" : "f." + nation['graphic_str']};
}

/**********************************************************************
  Return the flag graphic to be used by the base on tile
***********************************************************************/
function get_base_flag_sprite(ptile) {
  const owner_id = ptile['extras_owner'];
  if (owner_id == null) return {};
  const owner = players[owner_id];
  if (owner == null) return {};
  const nation_id = owner['nation'];
  if (nation_id == null) return {};
  const nation = nations[nation_id];
  if (nation == null) return {};
  return {"key" : "f." + nation['graphic_str'],
          "offset_x" : city_flag_offset_x,
          "offset_y" : - city_flag_offset_y};
}

/**********************************************************************
 Returns the sprite key for the number of defending units in a city.
***********************************************************************/
function get_city_occupied_sprite(pcity) {
  const owner_id = pcity['owner'];
  const ptile = city_tile(pcity);
  const punits = tile_units(ptile);

  if (!observing && client.conn.playing != null
      && owner_id != client.conn.playing.playerno && pcity['occupied']) {
    return "citybar.occupied";
  } else if (punits.length == 1) {
    return "citybar.occupancy_1";
  } else if (punits.length == 2) {
    return "citybar.occupancy_2";
  } else if (punits.length >= 3) {
    return "citybar.occupancy_3";
  } else {
    return "citybar.occupancy_0";
  }

}

/**********************************************************************
...
***********************************************************************/
function get_city_food_output_sprite(num) {
  return {"key" : "city.t_food_" + num,
          "offset_x" : normal_tile_width/4,
          "offset_y" : -normal_tile_height/4};
}

/**********************************************************************
...
***********************************************************************/
function get_city_shields_output_sprite(num) {
  return {"key" : "city.t_shields_" + num,
          "offset_x" : normal_tile_width/4,
          "offset_y" : -normal_tile_height/4};
}

/**********************************************************************
...
***********************************************************************/
function get_city_trade_output_sprite(num) {
  return {"key" : "city.t_trade_" + num,
          "offset_x" : normal_tile_width/4,
          "offset_y" : -normal_tile_height/4};
}


/**********************************************************************
  Return the sprite for an invalid city worked tile.
***********************************************************************/
function get_city_invalid_worked_sprite() {
  return {"key" : "grid.unavailable",
          "offset_x" : 0,
          "offset_y" : 0};
}


/**********************************************************************
...
***********************************************************************/
function fill_goto_line_sprite_array(ptile)
{
  return {"key" : "goto_line", "goto_dir" : ptile['goto_dir']};
}




/**********************************************************************
  ...
***********************************************************************/
function get_unit_stack_sprite(punit)
{
  return {"key" : "unit.stack"};
}

/**********************************************************************
  ...
***********************************************************************/
function get_unit_hp_sprite(punit)
{
  const hp = punit['hp'];
  const utype = unit_type(punit);
  const max_hp = utype['hp'];
  const healthpercent = 10 * Math.floor((10 * hp) / max_hp);

  return {"key" : "unit.hp_" + healthpercent};
}

/**********************************************************************
  ...
***********************************************************************/
function get_unit_veteran_sprite(punit)
{
  return {"key" : "unit.vet_" + punit['veteran']};
}

/**********************************************************************
  ...
***********************************************************************/
function get_unit_activity_sprite(punit)
{
  const activity = punit['activity'];
  const act_tgt = punit['activity_tgt'];

  switch (activity) {
    /* TODO: Use target specific sprites. */
    case ACTIVITY_CLEAN:
    case ACTIVITY_POLLUTION:
     return {"key" : "unit.pollution"};

    case ACTIVITY_FALLOUT:
      return {"key" : "unit.fallout"};

    case ACTIVITY_MINE:
      return {"key"      : -1 == act_tgt ?
                             "unit.plant" :
                             tileset_extra_id_activity_graphic_tag(act_tgt)};

    case ACTIVITY_PLANT:
      return {"key" : "unit.plant"};

    case ACTIVITY_IRRIGATE:
      return {"key" : -1 == act_tgt ?
                        "unit.irrigate" :
                        tileset_extra_id_activity_graphic_tag(act_tgt)};

    case ACTIVITY_CULTIVATE:
      return {"key" : "unit.cultivate"};

    case ACTIVITY_FORTIFIED:
      return {"key" : "unit.fortified"};

    case ACTIVITY_BASE:
      return {"key" : tileset_extra_id_activity_graphic_tag(act_tgt)};

    case ACTIVITY_SENTRY:
      return {"key" : "unit.sentry"};

    case ACTIVITY_PILLAGE:
      return {"key" : "unit.pillage"};

    case ACTIVITY_GOTO:
      return {"key" : "unit.goto"};

    case ACTIVITY_EXPLORE:
      return {"key" : "unit.auto_explore"};

    case ACTIVITY_TRANSFORM:
      return {"key" : "unit.transform"};

    case ACTIVITY_FORTIFYING:
      return {"key" : "unit.fortifying"};

    case ACTIVITY_GEN_ROAD:
      return {"key" : tileset_extra_id_activity_graphic_tag(act_tgt)};

    case ACTIVITY_CONVERT:
      return {"key" : "unit.convert"};
  }

  if (unit_has_goto(punit)) {
      return {"key" : "unit.goto"};
  }

  switch (punit['ssa_controller']) {
  case SSA_NONE:
    break;
  //case SSA_AUTOSETTLER:
  //  return {"key" : "unit.auto_settler"};
  case SSA_AUTOEXPLORE:
    return {"key" : "unit.auto_explore"};
  }

  return null;
}

/****************************************************************************
 ...
****************************************************************************/
function get_city_info_text(pcity)
{
  return {"key" : "city_text", "city" : pcity,
  		  "offset_x": citybar_offset_x, "offset_y" : citybar_offset_y};
}

/****************************************************************************
 ...
****************************************************************************/
function get_tile_label_text(ptile)
{
  return {"key" : "tile_label", "tile" : ptile,
  		  "offset_x": tilelabel_offset_x, "offset_y" : tilelabel_offset_y};
}


/****************************************************************************
 ...
****************************************************************************/
function get_unit_image_sprite(punit)
{
  return get_unit_type_image_sprite(unit_type(punit));

}


/****************************************************************************
 ...
****************************************************************************/
function get_unit_type_image_sprite(punittype)
{
  const tag = tileset_unit_type_graphic_tag(punittype);

  if (tag == null) {
    return null;
  }

  const tileset_x = tileset[tag][0];
  const tileset_y = tileset[tag][1];
  const width = tileset[tag][2];
  const height = tileset[tag][3];
  const i = tileset[tag][4];
  return {"tag": tag,
            "image-src" : "/tileset/freeciv-web-tileset-" + tileset_name + "-" + i + get_tileset_file_extention() + "?ts=" + ts,
            "tileset-x" : tileset_x,
            "tileset-y" : tileset_y,
            "width" : width,
            "height" : height
            };
}

/****************************************************************************
 ...
****************************************************************************/
function get_improvement_image_sprite(pimprovement)
{
  const tag = tileset_building_graphic_tag(pimprovement);

  if (tag == null) {
    return null;
  }

  const tileset_x = tileset[tag][0];
  const tileset_y = tileset[tag][1];
  const width = tileset[tag][2];
  const height = tileset[tag][3];
  const i = tileset[tag][4];
  return {"tag": tag,
            "image-src" : "/tileset/freeciv-web-tileset-" + tileset_name + "-" + i + get_tileset_file_extention() + "?ts=" + ts,
            "tileset-x" : tileset_x,
            "tileset-y" : tileset_y,
            "width" : width,
            "height" : height
            };
}

/****************************************************************************
 ...
****************************************************************************/
function get_specialist_image_sprite(tag)
{
  if (tileset[tag] == null) return null;

  const tileset_x = tileset[tag][0];
  const tileset_y = tileset[tag][1];
  const width = tileset[tag][2];
  const height = tileset[tag][3];
  const i = tileset[tag][4];
  return {"tag": tag,
            "image-src" : "/tileset/freeciv-web-tileset-" + tileset_name + "-" + i + get_tileset_file_extention() + "?ts=" + ts,
            "tileset-x" : tileset_x,
            "tileset-y" : tileset_y,
            "width" : width,
            "height" : height
            };
}


/****************************************************************************
 ...
****************************************************************************/
function get_technology_image_sprite(ptech)
{
  const tag = tileset_tech_graphic_tag(ptech);

  if (tag == null) return null;

  const tileset_x = tileset[tag][0];
  const tileset_y = tileset[tag][1];
  const width = tileset[tag][2];
  const height = tileset[tag][3];
  const i = tileset[tag][4];
  return {"tag": tag,
            "image-src" : "/tileset/freeciv-web-tileset-" + tileset_name + "-" + i + get_tileset_file_extention() + "?ts=" + ts,
            "tileset-x" : tileset_x,
            "tileset-y" : tileset_y,
            "width" : width,
            "height" : height
            };
}

/****************************************************************************
 ...
****************************************************************************/
function get_nation_flag_sprite(pnation)
{
  const tag = "f." + pnation['graphic_str'];

  if (tileset[tag] == null) return null;

  const tileset_x = tileset[tag][0];
  const tileset_y = tileset[tag][1];
  const width = tileset[tag][2];
  const height = tileset[tag][3];
  const i = tileset[tag][4];
  return {"tag": tag,
            "image-src" : "/tileset/freeciv-web-tileset-" + tileset_name + "-" + i + get_tileset_file_extention() + "?ts=" + ts,
            "tileset-x" : tileset_x,
            "tileset-y" : tileset_y,
            "width" : width,
            "height" : height
            };
}

/****************************************************************************
 ...
****************************************************************************/
function get_treaty_agree_thumb_up()
{
  const tag = "treaty.agree_thumb_up";

  const tileset_x = tileset[tag][0];
  const tileset_y = tileset[tag][1];
  const width = tileset[tag][2];
  const height = tileset[tag][3];
  const i = tileset[tag][4];
  return {"tag": tag,
            "image-src" : "/tileset/freeciv-web-tileset-" + tileset_name + "-" + i + get_tileset_file_extention() + "?ts=" + ts,
            "tileset-x" : tileset_x,
            "tileset-y" : tileset_y,
            "width" : width,
            "height" : height
            };
}

/****************************************************************************
 ...
****************************************************************************/
function get_treaty_disagree_thumb_down()
{
  const tag = "treaty.disagree_thumb_down";

  const tileset_x = tileset[tag][0];
  const tileset_y = tileset[tag][1];
  const width = tileset[tag][2];
  const height = tileset[tag][3];
  const i = tileset[tag][4];
  return {"tag": tag,
            "image-src" : "/tileset/freeciv-web-tileset-" + tileset_name + "-" + i + get_tileset_file_extention() + "?ts=" + ts,
            "tileset-x" : tileset_x,
            "tileset-y" : tileset_y,
            "width" : width,
            "height" : height
            };
}

/****************************************************************************
  Assigns the nation's color based on the color of the flag, currently
  the most common color in the flag is chosen.
****************************************************************************/
function assign_nation_color(nation_id)
{

  const nation = nations[nation_id];
  if (nation == null || nation['color'] != null) return;

  const flag_key = "f." + nation['graphic_str'];
  const flag_sprite = sprites[flag_key];
  if (flag_sprite == null) return;
  const c = flag_sprite.getContext('2d');
  const width = tileset[flag_key][2];
  const height = tileset[flag_key][3];
  const color_counts = {};
  /* gets the flag image data, except for the black border. */
  if (c == null) return;
  const img_data = c.getImageData(1, 1, width-2, height-2).data;

  /* count the number of each pixel's color */
  for (const i = 0; i < img_data.length; i += 4) {
    const current_color = "rgb(" + img_data[i] + "," + img_data[i+1] + ","
                        + img_data[i+2] + ")";
    if (current_color in color_counts) {
      color_counts[current_color] = color_counts[current_color] + 1;
    } else {
      color_counts[current_color] = 1;
    }
  }

  const max = -1;
  const max_color = null;

  for (let current_color in color_counts) {
    if (color_counts[current_color] > max) {
      max = color_counts[current_color];
      max_color = current_color;
    }
  }



  nation['color'] = max_color;
  color_counts = null;
  img_data = null;

}


/****************************************************************************
...
****************************************************************************/
function is_color_collision(color_a, color_b)
{
  const distance_threshold = 20;

  if (color_a == null || color_b == null) return false;

  const pcolor_a = color_rbg_to_list(color_a);
  const pcolor_b = color_rbg_to_list(color_b);

  const color_distance = Math.sqrt( Math.pow(pcolor_a[0] - pcolor_b[0], 2)
		  + Math.pow(pcolor_a[1] - pcolor_b[1], 2)
		  + Math.pow(pcolor_a[2] - pcolor_b[2], 2));

  return (color_distance <= distance_threshold);
}

/****************************************************************************
...
****************************************************************************/
function color_rbg_to_list(pcolor)
{
  if (pcolor == null) return null;
  const color_rgb = pcolor.match(/\d+/g);
  color_rgb[0] = parseFloat(color_rgb[0]);
  color_rgb[1] = parseFloat(color_rgb[1]);
  color_rgb[2] = parseFloat(color_rgb[2]);
  return color_rgb;
}

