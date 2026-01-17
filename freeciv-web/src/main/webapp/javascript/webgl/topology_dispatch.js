/**********************************************************************
    Freeciv-web - Topology dispatch layer
    Copyright (C) 2009-2024  The Freeciv-web project

    This file provides topology-aware wrappers that dispatch to the
    appropriate square or hex implementation based on the current
    map topology.

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
  Topology-aware coordinate conversion from map to scene
****************************************************************************/
function map_to_scene_coords(x, y) {
  if (use_hex_topology) {
    return map_to_scene_coords_hex(x, y);
  } else {
    return map_to_scene_coords_square(x, y);
  }
}

/****************************************************************************
  Topology-aware coordinate conversion from scene to map
****************************************************************************/
function scene_to_map_coords(x, y) {
  if (use_hex_topology) {
    return scene_to_map_coords_hex(x, y);
  } else {
    return scene_to_map_coords_square(x, y);
  }
}

/****************************************************************************
  Topology-aware canvas position to tile conversion
****************************************************************************/
function webgl_canvas_pos_to_tile(x, y) {
  if (use_hex_topology) {
    return webgl_canvas_pos_to_tile_hex(x, y);
  } else {
    return webgl_canvas_pos_to_tile_square(x, y);
  }
}

/****************************************************************************
  Topology-aware quick canvas position to tile conversion
****************************************************************************/
function webgl_canvas_pos_to_tile_quick(x, y) {
  if (use_hex_topology) {
    return webgl_canvas_pos_to_tile_quick_hex(x, y);
  } else {
    return webgl_canvas_pos_to_tile_quick_square(x, y);
  }
}

/****************************************************************************
  Topology-aware canvas position to map position conversion
****************************************************************************/
function webgl_canvas_pos_to_map_pos(x, y) {
  if (use_hex_topology) {
    return webgl_canvas_pos_to_map_pos_hex(x, y);
  } else {
    return webgl_canvas_pos_to_map_pos_square(x, y);
  }
}

/****************************************************************************
  Topology-aware unit rotation conversion
****************************************************************************/
function convert_unit_rotation(facing_dir, unit_type_name) {
  if (use_hex_topology) {
    return convert_unit_rotation_hex(facing_dir, unit_type_name);
  } else {
    return convert_unit_rotation_square(facing_dir, unit_type_name);
  }
}

/****************************************************************************
  Topology-aware center tile on mapcanvas
****************************************************************************/
function center_tile_mapcanvas_3d(ptile) {
  if (use_hex_topology) {
    return center_tile_mapcanvas_3d_hex(ptile);
  } else {
    return center_tile_mapcanvas_3d_square(ptile);
  }
}

/****************************************************************************
  Topology-aware camera look at
****************************************************************************/
function camera_look_at(x, y, z) {
  if (use_hex_topology) {
    return camera_look_at_hex(x, y, z);
  } else {
    return camera_look_at_square(x, y, z);
  }
}

/****************************************************************************
  Topology-aware city centering
****************************************************************************/
function center_tile_city(city) {
  if (use_hex_topology) {
    return center_tile_city_hex(city);
  } else {
    return center_tile_city_square(city);
  }
}

/****************************************************************************
  Topology-aware enable mapview slide
****************************************************************************/
function enable_mapview_slide_3d(ptile) {
  if (use_hex_topology) {
    return enable_mapview_slide_3d_hex(ptile);
  } else {
    return enable_mapview_slide_3d_square(ptile);
  }
}

/****************************************************************************
  Topology-aware update map slide
****************************************************************************/
function update_map_slide_3d() {
  if (use_hex_topology) {
    return update_map_slide_3d_hex();
  } else {
    return update_map_slide_3d_square();
  }
}
