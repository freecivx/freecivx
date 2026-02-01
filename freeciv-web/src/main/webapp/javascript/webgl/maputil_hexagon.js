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


/****************************************************************************
  Converts from map to scene coordinates (hexagonal tiles).
  Hexagonal tiles use an offset coordinate system where odd rows are shifted.
****************************************************************************/
function map_to_scene_coords_hexagon(x, y)
{
  var result = {};
  
  // Hexagon dimensions
  var hexRadius = (mapview_model_width / map['xsize']) * 0.5;
  var hexWidth = hexRadius * 2;
  var hexHeight = Math.sqrt(3) * hexRadius;
  var vertSpace = hexHeight * 0.75;
  
  // Calculate position with offset for odd rows
  var offsetX = (y % 2) * (hexWidth * 0.5);
  result['x'] = Math.floor(-470 + x * hexWidth + offsetX + hexRadius);
  result['y'] = Math.floor(30 + y * vertSpace);

  return result;
}

/****************************************************************************
  Converts from scene to map coordinates (hexagonal tiles).
  Reverse conversion from scene coords to hexagonal tile coordinates.
****************************************************************************/
function scene_to_map_coords_hexagon(x, y)
{
  var result = {};
  
  // Hexagon dimensions
  var hexRadius = (mapview_model_width / map['xsize']) * 0.5;
  var hexWidth = hexRadius * 2;
  var hexHeight = Math.sqrt(3) * hexRadius;
  var vertSpace = hexHeight * 0.75;
  
  // Approximate row from y coordinate
  var approxY = Math.floor((y - 30) / vertSpace);
  
  // Calculate offset for this row
  var offsetX = (approxY % 2) * (hexWidth * 0.5);
  
  // Calculate x considering the offset
  result['x'] = Math.floor((x + 470 - hexRadius - offsetX) / hexWidth);
  result['y'] = approxY;
  
  // Clamp to map bounds
  if (result['x'] < 0) result['x'] = 0;
  if (result['x'] >= map['xsize']) result['x'] = map['xsize'] - 1;
  if (result['y'] < 0) result['y'] = 0;
  if (result['y'] >= map['ysize']) result['y'] = map['ysize'] - 1;

  return result;
}


/****************************************************************************
  Converts from canvas coordinates to a tile (hexagonal).
****************************************************************************/
function webgl_canvas_pos_to_tile_hexagon(x, y) {
  if (mouse == null || lofiMesh == null) return null;

  mouse.set( ( x / $('#mapcanvas').width() ) * 2 - 1, - ( y / $('#mapcanvas').height() ) * 2 + 1);

  raycaster.setFromCamera( mouse, camera );

  var intersects = raycaster.intersectObject(lofiMesh, false);

  for (var i = 0; i < intersects.length; i++) {
    var intersect = intersects[i];
    var pos = scene_to_map_coords_hexagon(intersect.point.x, intersect.point.z);
    var ptile = map_pos_to_tile(pos['x'], pos['y']);
    if (ptile != null) return ptile;
  }

  return null;
}

/****************************************************************************
  Converts from canvas coordinates to a tile, fast using the water mesh (hexagonal).
****************************************************************************/
function webgl_canvas_pos_to_tile_quick_hexagon(x, y) {
  if (mouse == null || lofiMesh == null) return null;

  raycaster.layers.set(0);

  mouse.set( ( x / $('#mapcanvas').width() ) * 2 - 1, - ( y / $('#mapcanvas').height() ) * 2 + 1);

  raycaster.setFromCamera( mouse, camera );

  var intersects = raycaster.intersectObject(water_hq, false);

  raycaster.layers.set(6);

  for (var i = 0; i < intersects.length; i++) {
    var intersect = intersects[i];
    var pos = scene_to_map_coords_hexagon(intersect.point.x, intersect.point.z);
    var ptile = map_pos_to_tile(pos['x'], pos['y']);
    if (ptile != null) return ptile;
  }

  return null;
}

/****************************************************************************
  Converts from canvas coordinates to Three.js coordinates (hexagonal).
****************************************************************************/
function webgl_canvas_pos_to_map_pos_hexagon(x, y) {
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
