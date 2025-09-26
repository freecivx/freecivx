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


var map = {};
var tiles = {};

var DIR8_NORTHWEST = 0;
var DIR8_NORTH = 1;
var DIR8_NORTHEAST = 2;
var DIR8_WEST = 3;
var DIR8_EAST = 4;
var DIR8_SOUTHWEST = 5;
var DIR8_SOUTH = 6;
var DIR8_SOUTHEAST = 7;
var DIR8_LAST = 8;
var DIR8_COUNT = DIR8_LAST;

var DIR6_NORTHEAST = 1;
var DIR6_EAST = 2;
var DIR6_NORTHWEST = 3;
var DIR6_SOUTHEAST = 4;
var DIR6_WEST = 5;
var DIR6_SOUTHWEST = 6;
var DIR6_LAST = 6;
var DIR6_COUNT = DIR6_LAST;

var WRAP_X = 1;
var WRAP_Y = 2;

var TF_ISO = 1;
var TF_HEX = 2;

var T_NONE = 0; /* A special flag meaning no terrain type. */
var T_UNKNOWN = 0; /* An unknown terrain. */

/* The first terrain value. */
var T_FIRST = 0;

/* used to compute neighboring tiles.
 *
 * using
 *   x1 = x + DIR_DX[dir];
 *   y1 = y + DIR_DY[dir];
 * will give you the tile as shown below.
 *   -------
 *   |0|1|2|
 *   |-+-+-|
 *   |3| |4|
 *   |-+-+-|
 *   |5|6|7|
 *   -------
 * Note that you must normalize x1 and y1 yourself.
 */
var DIR_DX = [ -1, 0, 1, -1, 1, -1, 0, 1 ];
var DIR_DY = [ -1, -1, -1, 0, 0, 1, 1, 1 ];

var DIR_HEX_DX = [ 0,  1, 1, 0, 1, -1,  0,  0 ];
var DIR_HEX_DY = [ 0,   -1, 0, -1,  1,  0,  1,  0 ];


/****************************************************************************
  ...
****************************************************************************/
function topo_has_flag(flag)
{
  return ((map['topology_id'] & (flag)) != 0);
}

/****************************************************************************
  ...
****************************************************************************/
function wrap_has_flag(flag)
{
  return ((map['wrap_id'] & (flag)) != 0);
}



/**************************************************************************
  Allocate space for map, and initialise the tiles.
  Uses current map.xsize and map.ysize.
**************************************************************************/
function map_allocate()
{
  tiles = {};

  for (var x = 0; x < map['xsize']; x++) {
    for (var y = 0; y < map['ysize']; y++) {
      var tile = {};
      tile['index'] = x + y * map['xsize'];
      tile['x'] = x;
      tile['y'] = y;
      //tile['nat_x'] = tile['index'] % map['xsize'];
      //tile['nat_y'] = Math.floor(tile['index'] / map['xsize']);
      tile = tile_init(tile);

      tiles[tile['index']] = tile;
    }
  }

  map['startpos_table'] = {};

}

/****************************************************************************
  ...
****************************************************************************/
function tile_init(tile)
{
  tile['known'] = null;  /* tile_known in C side */
  tile['seen'] = {};     /* tile_seen in C side */
  tile['specials'] = [];
  tile['terrain'] = T_UNKNOWN;
  tile['units'] = [];
  tile['owner'] = null;
  tile['claimer'] = null;
  tile['worked'] = null;
  tile['spec_sprite'] = null;
  tile['goto_dir'] = null;
  tile['nuke'] = 0;
  tile['height'] = 0;
  return tile;
}

/****************************************************************************
  ...
****************************************************************************/
function map_init_topology(set_sizes)
{
  var dir;

  map.valid_dirs = {};
  map.cardinal_dirs = {};

  map.num_valid_dirs = 0;
  map.num_cardinal_dirs = 0;
  for (dir = 0; dir < 8; dir++) {
    if (is_valid_dir(dir)) {
      map.valid_dirs[map.num_valid_dirs] = dir;
      map.num_valid_dirs++;
    }
    if (is_cardinal_dir(dir)) {
      map.cardinal_dirs[map.num_cardinal_dirs] = dir;
      map.num_cardinal_dirs++;
    }
  }

}

/****************************************************************************
  ...
****************************************************************************/
function is_valid_dir(dir)
{
  switch (dir) {
  case DIR8_SOUTHEAST:
  case DIR8_NORTHWEST:
    /* These directions are invalid in hex topologies. */
    return !(topo_has_flag(TF_HEX) && !topo_has_flag(TF_ISO));
  case DIR8_NORTHEAST:
  case DIR8_SOUTHWEST:
    /* These directions are invalid in iso-hex topologies. */
    return !(topo_has_flag(TF_HEX) && topo_has_flag(TF_ISO));
  case DIR8_NORTH:
  case DIR8_EAST:
  case DIR8_SOUTH:
  case DIR8_WEST:
    return true;
  default:
    return false;
  }
}

/****************************************************************************
  ...
****************************************************************************/
function is_cardinal_dir(dir)
{
  switch (dir) {
  case DIR8_NORTH:
  case DIR8_SOUTH:
  case DIR8_EAST:
  case DIR8_WEST:
    return true;
  case DIR8_SOUTHEAST:
  case DIR8_NORTHWEST:
    /* These directions are cardinal in iso-hex topologies. */
    return topo_has_flag(TF_HEX) && topo_has_flag(TF_ISO);
  case DIR8_NORTHEAST:
  case DIR8_SOUTHWEST:
    /* These directions are cardinal in hexagonal topologies. */
    return topo_has_flag(TF_HEX) && !topo_has_flag(TF_ISO);
  }
  return false;
}

/****************************************************************************
  Return the tile for the given cartesian (map) position.
****************************************************************************/
function map_pos_to_tile(x, y)
{
  return tiles[x + y * map['xsize']];
}

/****************************************************************************
  Return the tile for the given index.
****************************************************************************/
function index_to_tile(index)
{
  return tiles[index];
}

/****************************************************************************
  Obscure math.  See explanation in doc/HACKING.
****************************************************************************/
function NATIVE_TO_MAP_POS(nat_x, nat_y)
{
    var pmap_x = Math.floor(((nat_y) + ((nat_y) & 1)) / 2 + (nat_x));
    var pmap_y = Math.floor(nat_y - pmap_x + map['xsize']);
    return {'map_x' : pmap_x, 'map_y' : pmap_y};
}

/****************************************************************************
  ...
****************************************************************************/
function MAP_TO_NATIVE_POS(map_x, map_y)
{
   var pnat_y = Math.floor(map_x + map_y - map['xsize']);
   var pnat_x = Math.floor((2 * map_x - pnat_y - (pnat_y & 1)) / 2);
   return {'nat_y': pnat_y, 'nat_x': pnat_x};
}

/****************************************************************************
  ...
****************************************************************************/
function NATURAL_TO_MAP_POS(nat_x, nat_y)
{
   var pmap_x = Math.floor(((nat_y) + (nat_x)) / 2);
   var pmap_y = Math.floor(nat_y - pmap_x + map['xsize']);
   return {'map_x' : pmap_x, 'map_y' : pmap_y};
}

/****************************************************************************
  ...
****************************************************************************/
function MAP_TO_NATURAL_POS(map_x, map_y)
{
    var pnat_y = Math.floor((map_x) + (map_y) - map['xsize']);
    var pnat_x = Math.floor(2 * (map_x) - pnat_y);

    return {'nat_y' : pnat_y, 'nat_x' : pnat_x};
}

/****************************************************************************
  Return the squared distance for a map vector
****************************************************************************/
function map_vector_to_sq_distance(dx, dy)
{
  if (topo_has_flag(TF_HEX)) {
    map_vector_to_sq_distance = function (dx, dy) {
      var d = map_vector_to_distance(dx, dy);
      return d * d;
    };
  } else {
    map_vector_to_sq_distance = function (dx, dy) {
      return dx*dx + dy*dy;
    };
  }
  return map_vector_to_sq_distance(dx, dy);
}

/****************************************************************************
  Return the distance for a map vector
****************************************************************************/
function map_vector_to_distance(dx, dy)
{
  if (topo_has_flag(TF_HEX)) {
    if (topo_has_flag(TF_ISO)) {
      map_vector_to_distance = function (dx, dy) {
        if ((dx < 0 && dy > 0) || (dx > 0 && dy < 0)) {
          return Math.abs(dx) + Math.abs(dy);
        } else {
          return Math.max(Math.abs(dx), Math.abs(dy));
        }
      };
    } else {
      map_vector_to_distance = function (dx, dy) {
        if ((dx > 0 && dy > 0) || (dx < 0 && dy < 0)) {
          return Math.abs(dx) + Math.abs(dy);
        } else {
          return Math.max(Math.abs(dx), Math.abs(dy));
        }
      }
    }
  } else {
    map_vector_to_distance = function (dx, dy) {
      return Math.max(Math.abs(dx), Math.abs(dy));
    };
  }
  return map_vector_to_distance(dx, dy);
}

/****************************************************************************
  Return a vector of minimum distance between tiles.
****************************************************************************/
function map_distance_vector(tile0, tile1)
{
  var half_world;
  var dx = tile1.x - tile0.x;
  if (wrap_has_flag(WRAP_X)) {
    half_world = Math.floor(map.xsize / 2);
    dx = FC_WRAP(dx + half_world, map.xsize) - half_world;
  }
  var dy = tile1.y - tile0.y;
  if (wrap_has_flag(WRAP_Y)) {
    half_world = Math.floor(map.ysize / 2);
    dx = FC_WRAP(dy + half_world, map.ysize) - half_world;
  }
  return [dx, dy];
}

/****************************************************************************
  Step from the given tile in the given direction.  The new tile is returned,
  or NULL if the direction is invalid or leads off the map.
****************************************************************************/
function mapstep(ptile, dir)
{
  if (!is_valid_dir(dir)) {
    return null;
  }

  return map_pos_to_tile(DIR_DX[dir] + ptile['x'], DIR_DY[dir] + ptile['y']);

}

/****************************************************************************
  Return the direction which is needed for a step on the map from
  start_tile to end_tile.
****************************************************************************/
function get_direction_for_step(start_tile, end_tile)
{
  var dir;

  for (dir = DIR8_NORTHWEST; dir < DIR8_LAST; dir++) {
    var test_tile = mapstep(start_tile, dir);

    if (test_tile == end_tile) {
      return dir;
    }
  }

  return -1;
}

/**************************************************************************
Return the debugging name of the direction.
**************************************************************************/
function dir_get_name(dir)
{
  /* a switch statement is used so the ordering can be changed easily */
  switch (dir) {
  case DIR8_NORTH:
    return "N";
  case DIR8_NORTHEAST:
    return "NE";
  case DIR8_EAST:
    return "E";
  case DIR8_SOUTHEAST:
    return "SE";
  case DIR8_SOUTH:
    return "S";
  case DIR8_SOUTHWEST:
    return "SW";
  case DIR8_WEST:
    return "W";
  case DIR8_NORTHWEST:
    return "NW";
  }

  return "[Undef]";
}

/**************************************************************************
  Returns the next direction clock-wise.
**************************************************************************/
function dir_cw(dir)
{
  /* a switch statement is used so the ordering can be changed easily */
  switch (dir) {
  case DIR8_NORTH:
    return DIR8_NORTHEAST;
  case DIR8_NORTHEAST:
    return DIR8_EAST;
  case DIR8_EAST:
    return DIR8_SOUTHEAST;
  case DIR8_SOUTHEAST:
    return DIR8_SOUTH;
  case DIR8_SOUTH:
    return DIR8_SOUTHWEST;
  case DIR8_SOUTHWEST:
    return DIR8_WEST;
  case DIR8_WEST:
    return DIR8_NORTHWEST;
  case DIR8_NORTHWEST:
    return DIR8_NORTH;
  }

  return -1;
}

/**************************************************************************
  Returns the next direction counter-clock-wise.
**************************************************************************/
function dir_ccw(dir)
{
  /* a switch statement is used so the ordering can be changed easily */
  switch (dir) {
  case DIR8_NORTH:
    return DIR8_NORTHWEST;
  case DIR8_NORTHEAST:
    return DIR8_NORTH;
  case DIR8_EAST:
    return DIR8_NORTHEAST;
  case DIR8_SOUTHEAST:
    return DIR8_EAST;
  case DIR8_SOUTH:
    return DIR8_SOUTHEAST;
  case DIR8_SOUTHWEST:
    return DIR8_SOUTH;
  case DIR8_WEST:
    return DIR8_SOUTHWEST;
  case DIR8_NORTHWEST:
    return DIR8_WEST;
  }
  return -1;
}

/****************************************************************************
  Adjust tile height
****************************************************************************/
function map_tile_height_adjust(ptile)
{
  if (ptile != null && tile_terrain(ptile) != null) {

    if (ptile['height'] == 0) {
      if (is_ocean_tile(ptile)) {
        ptile['height'] = 0.45;
      } else {
        ptile['height'] = 0.55;
      }

    } else {
      // Convert tile height to web client scale.
      ptile['height'] = (840 + ptile['height']) * 0.00037;

      if (is_ocean_tile(ptile) && ptile['height'] > 0.5) {
        ptile['height'] = 0.45;
      } else if (!is_ocean_tile(ptile) && ptile['height'] < 0.5) {
        ptile['height'] = 0.57;
      }
    }

    if (tile_has_extra(ptile, EXTRA_RIVER)) {
      ptile['height'] = 0.488;
    } else if (tile_terrain(ptile)['name'] == "Hills") {
      ptile['height'] =  ptile['height'] * 1.11;
    } else if (tile_terrain(ptile)['name'] == "Mountains") {
      ptile['height'] =  ptile['height'] * 1.17;
    } else if (tile_terrain(ptile)['name'] == "Glacier" || tile_terrain(ptile)['name'] == "Tundra") {
      ptile['height'] = 0.52;
    }
    if (ptile['height'] < 0.4) {
      ptile['height'] = 0.4;
    }

    if (is_ocean_tile(ptile) && is_land_tile_near(ptile)) {
      ptile['height'] = 0.45;
    }
    if (!is_ocean_tile(ptile) && is_ocean_tile_near(ptile) && !tile_has_extra(ptile, EXTRA_RIVER)) {
      ptile['height'] = 0.55;
    }

    if (!is_ocean_tile(ptile) && is_ocean_tile_near(ptile) && tile_has_extra(ptile, EXTRA_RIVER)) {
      ptile['height'] = ptile['height'] * 1.007;
    }
    if (is_ocean_tile(ptile) && is_land_tile_near(ptile) && is_river_tile_near(ptile)) {
      ptile['height'] = ptile['height'] * 1.04;
    }

  }
}

/****************************************************************************
...
****************************************************************************/
function map_tile_distance(ptile1, ptile2)
{
  if (ptile1 == null || ptile2 == null) return 0;

  const dx = ptile2.x - ptile1.x;
  const dy = ptile2.y - ptile1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance;

}