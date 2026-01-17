/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2016  The Freeciv-web project

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

// Hexagonal map utilities
// Uses offset coordinates (odd-r) for hex tile layout

/****************************************************************************
  Converts from map to scene coordinates for hexagonal tiles.
  Uses odd-r horizontal hexagon layout where odd rows are offset right.
****************************************************************************/
function map_to_scene_coords_hex(x, y)
{
  var result = {};
  // For pointy-top hexagons in odd-r layout:
  // hex_width = size * sqrt(3) (distance between hex centers horizontally)
  // hex_height = size * 1.5 (distance between hex centers vertically)
  
  var hex_width = MAPVIEW_ASPECT_FACTOR * Math.sqrt(3);
  var hex_height = MAPVIEW_ASPECT_FACTOR * 1.5;
  
  // Offset odd rows by half hex width
  var row_offset = (y % 2) * (hex_width / 2);
  
  result['x'] = Math.floor(-470 + x * hex_width + row_offset);
  result['y'] = Math.floor(30 + y * hex_height);

  return result;
}

/****************************************************************************
  Converts from scene to map coordinates for hexagonal tiles.
****************************************************************************/
function scene_to_map_coords_hex(x, y)
{
  var result = {};
  var hex_width = MAPVIEW_ASPECT_FACTOR * Math.sqrt(3);
  var hex_height = MAPVIEW_ASPECT_FACTOR * 1.5;
  
  // Approximate row first
  var row = Math.floor((y - 30) / hex_height);
  
  // Account for row offset
  var row_offset = (row % 2) * (hex_width / 2);
  var col = Math.floor((x + 470 - row_offset) / hex_width);
  
  result['x'] = col;
  result['y'] = row;

  return result;
}


/****************************************************************************
  Converts from canvas coordinates to a tile (hexagonal).
****************************************************************************/
function webgl_canvas_pos_to_tile_hex(x, y) {
  if (mouse == null || lofiMesh == null) return null;

  mouse.set( ( x / $('#mapcanvas').width() ) * 2 - 1, - ( y / $('#mapcanvas').height() ) * 2 + 1);

  raycaster.setFromCamera( mouse, camera );

  var intersects = raycaster.intersectObject(lofiMesh, false);

  for (var i = 0; i < intersects.length; i++) {
    var intersect = intersects[i];
    var pos = scene_to_map_coords_hex(intersect.point.x, intersect.point.z);
    var ptile = map_pos_to_tile(pos['x'], pos['y']);
    if (ptile != null) return ptile;
  }

  return null;
}

/****************************************************************************
  Converts from canvas coordinates to a tile, fast using the water mesh (hexagonal).
****************************************************************************/
function webgl_canvas_pos_to_tile_quick_hex(x, y) {
  if (mouse == null || lofiMesh == null) return null;

  raycaster.layers.set(0);

  mouse.set( ( x / $('#mapcanvas').width() ) * 2 - 1, - ( y / $('#mapcanvas').height() ) * 2 + 1);

  raycaster.setFromCamera( mouse, camera );

  var intersects = raycaster.intersectObject(water_hq, false);

  raycaster.layers.set(6);

  for (var i = 0; i < intersects.length; i++) {
    var intersect = intersects[i];
    var pos = scene_to_map_coords_hex(intersect.point.x, intersect.point.z);
    var ptile = map_pos_to_tile(pos['x'], pos['y']);
    if (ptile != null) return ptile;
  }

  return null;
}

/****************************************************************************
  Converts from canvas coordinates to Three.js coordinates (hexagonal).
****************************************************************************/
function webgl_canvas_pos_to_map_pos_hex(x, y) {
  if (mouse == null || lofiMesh == null || mapview_slide['active']) return null;

  mouse.set( ( x / $('#mapcanvas').width() ) * 2 - 1, - ( y / $('#mapcanvas').height() ) * 2 + 1);

  raycaster.setFromCamera( mouse, camera );

  var intersects = raycaster.intersectObject(lofiMesh);

  if (intersects.length > 0) {
    var intersect = intersects[0];
    return {'x' : intersect.point.x, 'y' : intersect.point.z};
  }

  return null;
}

/****************************************************************************
  Converts from unit['facing'] to number of rotations for hexagonal maps.
  Hexagonal maps have 6 directions instead of 8.
****************************************************************************/
function convert_unit_rotation_hex(facing_dir, unit_type_name)
{
  var rotation_rad = 0;

  // For iso-hex: DIR8_NORTH, EAST, SOUTH, WEST, NORTHWEST, SOUTHEAST (6 directions)
  if (facing_dir == 1) rotation_rad = -4;  // NORTH
  if (facing_dir == 4) rotation_rad = -6;  // EAST
  if (facing_dir == 6) rotation_rad = 0;   // SOUTH
  if (facing_dir == 3) rotation_rad = -2;  // WEST
  if (facing_dir == 0) rotation_rad = -3;  // NORTHWEST
  if (facing_dir == 7) rotation_rad = -7;  // SOUTHEAST

  if (unit_type_name == "Horsemen" || unit_type_name == "Knights" || unit_type_name == "Zeppelin" || unit_type_name == "Galleon"
      || unit_type_name == "Frigate" || unit_type_name == "Destroyer" || unit_type_name == "Battleship" || unit_type_name == "Cruiser"
      || unit_type_name == "AEGIS Cruiser" || unit_type_name == "Carrier" || unit_type_name == "Settlers"  || unit_type_name == "Transport") {
    return rotation_rad * Math.PI * 2 / 6 + Math.PI;
  }

  if (unit_type_name == "Ironclad" || unit_type_name == "Artillery") {
    return rotation_rad * Math.PI * 2 / 6 - (Math.PI / 2);
  }
  if (unit_type_name == "Catapult" || unit_type_name == "Bomber") {
    return rotation_rad * Math.PI * 2 / 6 + (Math.PI / 2);
  }

  return rotation_rad * Math.PI * 2 / 6;
}
