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

/* Common tileset configuration for all supported 2D tilesets.
 * amplio2 is the default tileset. */

var tileset_confg = {};

tileset_confg['amplio2'] = {
  "tile_width"        : 96,
  "tile_height"       : 48,
  "name"              : "amplio2",
  "image_count"       : 2,
  "normal_tile_width" : 96,
  "normal_tile_height": 48,
  "small_tile_width"  : 15,
  "small_tile_height" : 20
};

tileset_confg['trident'] = {
  "tile_width"        : 30,
  "tile_height"       : 30,
  "name"              : "trident",
  "image_count"       : 2,
  "normal_tile_width" : 30,
  "normal_tile_height": 30,
  "small_tile_width"  : 15,
  "small_tile_height" : 20
};

/* Default to amplio2 */
var tileset_name        = tileset_confg['amplio2']['name'];
var tileset_image_count = tileset_confg['amplio2']['image_count'];
var tileset_tile_width  = tileset_confg['amplio2']['tile_width'];
var tileset_tile_height = tileset_confg['amplio2']['tile_height'];
var normal_tile_width   = tileset_confg['amplio2']['normal_tile_width'];
var normal_tile_height  = tileset_confg['amplio2']['normal_tile_height'];
var small_tile_width    = tileset_confg['amplio2']['small_tile_width'];
var small_tile_height   = tileset_confg['amplio2']['small_tile_height'];
