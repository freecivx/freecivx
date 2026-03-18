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

/**
 * Represents a Freeciv terrain type on the client side.
 * Fields mirror PACKET_RULESET_TERRAIN defined in packets.def.
 */
class Terrain {
  constructor(packet) {
    // Fields from PACKET_RULESET_TERRAIN (packets.def)
    this.id = 0;
    this.tclass = 0;
    this.flags = 0;
    this.native_to = 0;
    this.name = "";
    this.rule_name = "";
    this.graphic_str = "";
    this.graphic_alt = "";
    this.movement_cost = 0;
    this.defense_bonus = 0;
    this.output = [];
    this.num_resources = 0;
    this.resources = [];
    this.resource_freq = [];
    this.road_output_incr_pct = [];
    this.base_time = 0;
    this.road_time = 0;
    this.cultivate_result = 0;
    this.cultivate_time = 0;
    this.plant_result = 0;
    this.plant_time = 0;
    this.irrigation_food_incr = 0;
    this.irrigation_time = 0;
    this.mining_shield_incr = 0;
    this.mining_time = 0;
    this.animal = 0;
    this.transform_result = 0;
    this.transform_time = 0;
    this.placing_time = 0;
    this.pillage_time = 0;
    this.extra_count = 0;
    this.extra_removal_times = [];
    this.color_red = 0;
    this.color_green = 0;
    this.color_blue = 0;
    this.helptext = [];
    Object.assign(this, packet);
  }

  /**
   * Update this terrain with data from a new server packet.
   */
  update(packet) {
    Object.assign(this, packet);
  }
}

var terrains = {};
var resources = {};
var terrain_control = {};

/**************************************************************************
 ...
**************************************************************************/
function tile_set_terrain(ptile, pterrain)
{
  ptile['terrain'] = pterrain;
}

/**************************************************************************
 ...
**************************************************************************/
function tile_terrain(ptile)
{
  return terrains[ptile['terrain']];
}

/**************************************************************************
 ...
**************************************************************************/
function tile_terrain_near(ptile)
{
  var tterrain_near = [];
  for (var dir = 0; dir < 8; dir++) {
    var tile1 = mapstep(ptile, dir);
    if (tile1 != null && tile_get_known(tile1) != TILE_UNKNOWN) {
      var terrain1 = tile_terrain(tile1);

      if (null != terrain1) {
        tterrain_near[dir] = terrain1;
        continue;
      }
    }
    /* At the edges of the (known) map, pretend the same terrain continued
     * past the edge of the map. */
    tterrain_near[dir] = tile_terrain(ptile);
  }

  return tterrain_near;
}

/**************************************************************************
 ...
**************************************************************************/
function is_ocean_tile(ptile)
{
  if (ptile == null) return false;
  var pterrain = tile_terrain(ptile);
  return (pterrain['graphic_str'] == "floor" || pterrain['graphic_str'] == "coast");
}

/**************************************************************************
 ...
**************************************************************************/
function is_ocean_tile_near(ptile)
{
  for (var dir = 0; dir < 8; dir++) {
    var tile1 = mapstep(ptile, dir);
    if (is_ocean_tile(tile1)) {
      return true;
    }
  }
  return false;
}

/**************************************************************************
 ...
**************************************************************************/
function is_land_tile_near(ptile)
{
  for (var dir = 0; dir < 8; dir++) {
    var tile1 = mapstep(ptile, dir);
    if (!is_ocean_tile(tile1)) {
      return true;
    }
  }
  return false;
}

/**************************************************************************
 ...
**************************************************************************/
function is_river_tile_near(ptile)
{
  for (var dir = 0; dir < 8; dir++) {
    var tile1 = mapstep(ptile, dir);
    if (tile_has_extra(tile1, EXTRA_RIVER)) {
      return true;
    }
  }
  return false;
}
