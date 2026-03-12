/**********************************************************************
    FreecivWorld.net - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2022  The FreecivWorld.net project

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
 * City Rendering Module for WebGPU
 * 
 * Handles city-related 3D rendering including:
 * - City worked tile indicators
 * - City labels and UI elements
 * - City walls scaling and models
 * - City buildings visibility toggle
 */

/** @type {Object.<number, THREE.Mesh>} Map of tile index to worked tile mesh */
const city_worked_positions = {};

/** @type {boolean} Whether city labels are currently visible */
let city_labels_visible = true;

/****************************************************************************
 Displays visual indicators for tiles worked by the active city.
 Shows output information and highlights tiles worked by other cities.
****************************************************************************/
function show_city_worked_tiles()
{
  if (active_city == null) return;

  if (city_tile(active_city) != null && city_label_positions[city_tile(active_city)['index']] != null) {
    city_label_positions[city_tile(active_city)['index']].visible = false;
  }
  
  // Material for tiles worked by other cities
  const other_city_material = typeof createRingMaterial === 'function'
    ? createRingMaterial(0xc33b3b, { transparent: true, opacity: 0.4 })
    : new THREE.MeshBasicMaterial({ color: 0xc33b3b, transparent: true, opacity: 0.4 });

  for (const tile_id in tiles) {
    const ptile = tiles[tile_id];
    if (active_city != null && ptile != null && ptile['worked'] != null
          && active_city['id'] == ptile['worked'] && active_city['output_food'] != null) {
      const ctile = city_tile(active_city);
      const d = map_distance_vector(ctile, ptile);
      const idx = get_city_dxy_to_index(d[0], d[1], active_city);
      const pos = map_to_scene_coords(ptile['x'], ptile['y']);
      let height = 5 + ptile['height'] * 100;
      if (ctile['index'] == ptile['index']) {
        height += 15;
      }

      let food_output = active_city['output_food'][idx];
      let shield_output = active_city['output_shield'][idx];
      let trade_output = active_city['output_trade'][idx];

      // Scale output values by granularity (ruleset may use large values)
      food_output = Math.floor(food_output / game_info.granularity);
      shield_output = Math.floor(shield_output / game_info.granularity);
      trade_output = Math.floor(trade_output / game_info.granularity);

      if (city_worked_positions[ptile['index']] == null) {
        const mesh = create_city_worked_sprite(food_output, shield_output, trade_output);
        city_worked_positions[ptile['index']] = mesh;
        mesh.position.set(pos['x'] + HEX_CENTER_OFFSET_X, height + 10, pos['y'] + HEX_CENTER_OFFSET_Y - 4);
        if (scene != null) {
          mesh.name = "City worked tile " + ptile['index'];
          scene.add(mesh);
        }
      }
    } else if (active_city != null && ptile != null && ptile['worked'] != null
                && active_city['id'] != ptile['worked'] && ptile['worked'] > 0) {
      // Tile worked by another city
      const ctile = city_tile(active_city);
      const d = map_distance_vector(ctile, ptile);
      const idx = get_city_dxy_to_index(d[0], d[1], active_city);
      const pos = map_to_scene_coords(ptile['x'], ptile['y']);
      const height = 5 + ptile['height'] * 100;

      if (city_worked_positions[ptile['index']] == null && Math.abs(d[0]) <= 2 && Math.abs(d[1]) <= 2) {
        const mesh = new THREE.Mesh(new THREE.RingGeometry(1, 15, 30), other_city_material);
        city_worked_positions[ptile['index']] = mesh;
        mesh.position.set(pos['x'] + HEX_CENTER_OFFSET_X - 12, height + 3, pos['y'] + HEX_CENTER_OFFSET_Y - 9);
        mesh.rotation.x = -1 * Math.PI / 2;
        if (scene != null) {
          mesh.name = "Other city worked tile " + ptile['index'];
          scene.add(mesh);
        }
      }


    }
  }

}


/****************************************************************************
 Removes all city worked tile indicators from the scene.
 Called when closing the city view.
****************************************************************************/
function remove_city_worked_tiles() {
  for (const workedid in city_worked_positions) {
    if (city_worked_positions[workedid] != null && scene != null) {
      scene.remove(city_worked_positions[workedid]);
    }
    delete city_worked_positions[workedid];
  }

  if (active_city != null && city_tile(active_city) != null && city_label_positions[city_tile(active_city)['index']] != null) {
      city_label_positions[city_tile(active_city)['index']].visible = true;
  }
}

/****************************************************************************
 Checks if the given tile is within the city radius of the active city.
 
 @param {Tile} ptile - The tile to check
 @param {City} active_city - The city to check against
 @returns {boolean} True if tile is within city working radius
****************************************************************************/
function is_city_tile(ptile, active_city)
{
  const ctile = city_tile(active_city);
  const d = map_distance_vector(ptile, ctile);

  // Exclude corner tiles (diagonal distance of 2,2)
  if ((d[0] == 2 && d[1] == 2) || (d[0] == -2 && d[1] == -2) || (d[0] == -2 && d[1] == 2) || (d[0] == 2 && d[1] == -2)) {
    return false;
  }

  // Check if within city radius (2 tiles in each direction)
  if (d[0] <= 2 && d[1] <= 2 && d[0] >= -2 && d[1] >= -2) {
    return true;
  }
  return false;
}

/****************************************************************************
 Toggles visibility of city labels on the map.
****************************************************************************/
function hide_city_labels() {
  if (city_labels_visible) {
    for (const cid in city_label_positions) {
      const city_label = city_label_positions[cid];
      city_label.visible = false;
    }
    city_labels_visible = false;
    $("#city_labels_hide_button").text("Show city labels");
  } else {
    for (const cid in city_label_positions) {
      const city_label = city_label_positions[cid];
      city_label.visible = true;
    }
    city_labels_visible = true;
    $("#city_labels_hide_button").text("Hide city labels");
  }
}

/**
 * Returns the appropriate scale for city walls based on city size and style.
 * 
 * @param {City} pcity - The city object
 * @returns {number} Scale factor for city walls model
 */
function get_citywalls_scale(pcity)
{
  const style = get_citywalls_models(pcity);
  let scale = 9;
  
  // Scale walls based on city size
  if (pcity['size'] >= 3 && pcity['size'] <= 6) {
    scale = 9.5;
  } else if (pcity['size'] > 6 && pcity['size'] <= 9) {
    scale = 10.5;
  } else if (pcity['size'] > 9 && pcity['size'] <= 11) {
    scale = 11.0;
  } else if (pcity['size'] > 11) {
    scale = 12.5;
  }
  
  // Apply style-specific scaling
  if (style === "citywalls_stone") {
    return scale;
  } else if (style === "citywalls_roman") {
    return scale * 0.19;
  }
  
  return scale;
}

/**
 * Returns the city walls model name based on city style.
 * 
 * @param {City} pcity - The city object
 * @returns {string} Model name for city walls
 */
function get_citywalls_models(pcity) {
  if (pcity['style'] === 0 || pcity['style'] === 5) {
    return "citywalls_stone";
  } else {
    return "citywalls_roman";
  }
}

/****************************************************************************
 Toggles visibility of city buildings on the map.
****************************************************************************/
function update_show_city_buildings() {
  const visible = show_buildings;
  
  for (const key in city_building_positions) {
    if (city_building_positions[key] != null) {
      city_building_positions[key].visible = visible;
    }
  }
}