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

// Map coordinate system offsets - used for scene <-> map coordinate conversion
// These must match between map_to_scene_coords() and scene_to_map_coords()
var MAP_X_OFFSET = -470;  // Initial X offset when converting map to scene coordinates
var MAP_Y_OFFSET = 30;    // Initial Y offset when converting map to scene coordinates

/****************************************************************************
  Converts from map to scene coordinates for hexagonal tiles.
  
  Uses offset hex coordinates (odd-r: odd rows shifted right).
  Reference: https://www.redblobgames.com/grids/hexagons/#coordinates-offset
  
  For hex topology, we need to account for:
  - Row stagger (odd rows offset by half tile width)
  - Hex aspect ratio (height = width * sqrt(3)/2)
  
  @param {number} x - Map tile X coordinate
  @param {number} y - Map tile Y coordinate
  @returns {Object} Scene coordinates {x, y}
****************************************************************************/
function map_to_scene_coords(x, y)
{
  var result = {};
  
  // Calculate base position
  const tileWidth = mapview_model_width / map['xsize'];
  const tileHeight = (mapview_model_height / map['ysize']) * HEX_HEIGHT_FACTOR;
  
  // Apply hex row offset for odd rows (odd-r offset coordinate system)
  const rowOffset = (y % 2 === 1) ? tileWidth * HEX_STAGGER : 0;
  
  result['x'] = Math.floor(MAP_X_OFFSET + x * tileWidth + rowOffset);
  result['y'] = Math.floor(MAP_Y_OFFSET + y * tileHeight);

  return result;
}

/****************************************************************************
  Converts from scene to map coordinates for hexagonal tiles.
  
  Inverse of map_to_scene_coords(). Uses offset hex coordinates (odd-r).
  Reference: https://www.redblobgames.com/grids/hexagons/#coordinates-offset
  
  @param {number} x - Scene X coordinate
  @param {number} y - Scene Y coordinate (actually Z in 3D space)
  @returns {Object} Map tile coordinates {x, y}
****************************************************************************/
function scene_to_map_coords(x, y)
{
  var result = {};
  
  const tileWidth = mapview_model_width / map['xsize'];
  const tileHeight = (mapview_model_height / map['ysize']) * HEX_HEIGHT_FACTOR;
  
  // Account for the MAP_Y_OFFSET in map_to_scene_coords
  const adjustedY = y - MAP_Y_OFFSET;
  
  // Calculate Y coordinate directly from scene position
  const tileY = Math.floor(adjustedY / tileHeight);
  
  // Calculate row offset based on Y (odd rows are staggered in odd-r system)
  const rowOffset = (tileY % 2 === 1) ? tileWidth * HEX_STAGGER : 0;
  
  // Account for the MAP_X_OFFSET in map_to_scene_coords (negate it to reverse the offset)
  const adjustedX = x - MAP_X_OFFSET - rowOffset;
  
  // Calculate X accounting for hex offset
  result['x'] = Math.floor(adjustedX / tileWidth);
  result['y'] = tileY;

  return result;
}


/****************************************************************************
  Converts from canvas coordinates to a tile.
****************************************************************************/
function webgl_canvas_pos_to_tile(x, y) {
  if (mouse == null || lofiMesh == null) return null;

  mouse.set( ( x / $('#mapcanvas').width() ) * 2 - 1, - ( y / $('#mapcanvas').height() ) * 2 + 1);

  raycaster.setFromCamera( mouse, camera );

  var intersects = raycaster.intersectObject(lofiMesh, false);

  for (var i = 0; i < intersects.length; i++) {
    var intersect = intersects[i];
    var pos = scene_to_map_coords(intersect.point.x, intersect.point.z);
    var ptile = map_pos_to_tile(pos['x'], pos['y']);
    if (ptile != null) return ptile;
  }

  return null;
}

/****************************************************************************
  Converts from canvas coordinates to a tile, fast using the water mesh.
****************************************************************************/
function webgl_canvas_pos_to_tile_quick(x, y) {
  if (mouse == null || lofiMesh == null) return null;

  raycaster.layers.set(0);

  mouse.set( ( x / $('#mapcanvas').width() ) * 2 - 1, - ( y / $('#mapcanvas').height() ) * 2 + 1);

  raycaster.setFromCamera( mouse, camera );

  var intersects = raycaster.intersectObject(water_hq, false);

  raycaster.layers.set(6);

  for (var i = 0; i < intersects.length; i++) {
    var intersect = intersects[i];
    var pos = scene_to_map_coords(intersect.point.x, intersect.point.z);
    var ptile = map_pos_to_tile(pos['x'], pos['y']);
    if (ptile != null) return ptile;
  }

  return null;
}

/****************************************************************************
  Converts from canvas coordinates to Three.js coordinates.
****************************************************************************/
function webgl_canvas_pos_to_map_pos(x, y) {
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
  Converts from unit['facing'] to number of rotations of 1/8 parts of full circle rotations (2PI),
  then to radians;
****************************************************************************/
function convert_unit_rotation(facing_dir, unit_type_name)
{
  var rotation_rad = 0;

  if (facing_dir == 0) rotation_rad = -3;
  if (facing_dir == 1) rotation_rad = -4;
  if (facing_dir == 2) rotation_rad = -5;
  if (facing_dir == 4) rotation_rad = -6;
  if (facing_dir == 7) rotation_rad = -7;
  if (facing_dir == 6) rotation_rad = 0;
  if (facing_dir == 5) rotation_rad = -1;
  if (facing_dir == 3) rotation_rad = -2;

  if (unit_type_name == "Horsemen" || unit_type_name == "Knights" || unit_type_name == "Zeppelin" || unit_type_name == "Galleon"
      || unit_type_name == "Frigate" || unit_type_name == "Destroyer" || unit_type_name == "Battleship" || unit_type_name == "Cruiser"
      || unit_type_name == "AEGIS Cruiser" || unit_type_name == "Carrier" || unit_type_name == "Settlers"  || unit_type_name == "Transport") {
    return rotation_rad * Math.PI * 2 / 8 + Math.PI;
  }

  if (unit_type_name == "Ironclad" || unit_type_name == "Artillery") {
    return rotation_rad * Math.PI * 2 / 8 - (Math.PI / 2);
  }
  if (unit_type_name == "Catapult" || unit_type_name == "Bomber") {
    return rotation_rad * Math.PI * 2 / 8 + (Math.PI / 2);
  }


  return rotation_rad * Math.PI * 2 / 8

}
