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
  This must match the geometry generation in init_land_geometry_hexagon().
****************************************************************************/
function map_to_scene_coords_hexagon(x, y)
{
  var result = {};
  
  // Hexagon dimensions (must match init_land_geometry_hexagon)
  var hexRadius = (mapview_model_width / map['xsize']) * 0.5;
  var hexWidth = hexRadius * 2;
  var hexHeight = Math.sqrt(3) * hexRadius;
  var vertSpace = hexHeight * 0.75;
  
  var width_half = mapview_model_width / 2;
  var height_half = mapview_model_height / 2;
  
  // Calculate position with offset for odd rows (matches geometry generation)
  var offsetX = (y % 2) * (hexWidth * 0.5);
  var centerX = x * hexWidth + offsetX + hexRadius - width_half;
  var centerY = y * vertSpace - height_half;
  
  result['x'] = Math.floor(centerX);
  result['y'] = Math.floor(centerY);

  return result;
}

/****************************************************************************
  Converts from scene to map coordinates (hexagonal tiles).
  Reverse conversion from scene coords to hexagonal tile coordinates.
  This must match the geometry generation in init_land_geometry_hexagon().
****************************************************************************/
function scene_to_map_coords_hexagon(x, y)
{
  var result = {};
  
  // Hexagon dimensions (must match init_land_geometry_hexagon)
  var hexRadius = (mapview_model_width / map['xsize']) * 0.5;
  var hexWidth = hexRadius * 2;
  var hexHeight = Math.sqrt(3) * hexRadius;
  var vertSpace = hexHeight * 0.75;
  
  var width_half = mapview_model_width / 2;
  var height_half = mapview_model_height / 2;
  
  // Approximate row from y coordinate (reverse of centerY calculation)
  var approxY = Math.round((y + height_half) / vertSpace);
  
  // Calculate offset for this row
  var offsetX = (approxY % 2) * (hexWidth * 0.5);
  
  // Calculate x considering the offset (reverse of centerX calculation)
  var approxX = Math.round((x + width_half - hexRadius - offsetX) / hexWidth);
  
  // Clamp to map bounds
  result['x'] = Math.max(0, Math.min(map['xsize'] - 1, approxX));
  result['y'] = Math.max(0, Math.min(map['ysize'] - 1, approxY));

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
