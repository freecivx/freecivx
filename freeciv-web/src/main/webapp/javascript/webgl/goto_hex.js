/**********************************************************************
    FreecivWorld.net - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2024  The Freeciv-web project

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
 * Goto path visualization for hexagonal maps
 * Renders unit movement paths on hex grids
 */

// Storage for hex goto path meshes
var hex_goto_path_meshes = [];

/**
 * Create a goto path line on hex map
 * @param {array} path - Array of tile coordinates [{x, y}, ...]
 * @param {number} color - Path line color (hex number)
 */
function create_hex_goto_path(path, color) {
  // Clear existing path
  clear_hex_goto_path();
  
  if (!path || path.length < 2) return;
  
  // Create line geometry connecting hex tile centers
  var points = [];
  
  for (var i = 0; i < path.length; i++) {
    var coords = map_to_scene_coords_hex(path[i].x, path[i].y);
    points.push(new THREE.Vector3(coords.x, coords.y + 5, coords.z));
  }
  
  // Create line from points
  var geometry = new THREE.BufferGeometry().setFromPoints(points);
  var material = new THREE.LineBasicMaterial({
    color: color || 0x00ff00,
    linewidth: 3,
    opacity: 0.8,
    transparent: true
  });
  
  var line = new THREE.Line(geometry, material);
  hex_goto_path_meshes.push(line);
  
  if (typeof scene !== 'undefined') {
    scene.add(line);
  }
  
  // Add arrow markers at each waypoint
  for (var i = 1; i < path.length; i++) {
    var arrow = create_hex_goto_arrow(path[i - 1], path[i], color);
    if (arrow) {
      hex_goto_path_meshes.push(arrow);
      if (typeof scene !== 'undefined') {
        scene.add(arrow);
      }
    }
  }
}

/**
 * Create an arrow marker between two hex tiles
 * @param {object} fromTile - Starting tile {x, y}
 * @param {object} toTile - Ending tile {x, y}
 * @param {number} color - Arrow color
 * @returns {THREE.Object3D} Arrow mesh
 */
function create_hex_goto_arrow(fromTile, toTile, color) {
  var fromCoords = map_to_scene_coords_hex(fromTile.x, fromTile.y);
  var toCoords = map_to_scene_coords_hex(toTile.x, toTile.y);
  
  // Calculate direction
  var direction = new THREE.Vector3(
    toCoords.x - fromCoords.x,
    toCoords.y - fromCoords.y,
    toCoords.z - fromCoords.z
  ).normalize();
  
  // Position arrow at midpoint, slightly above terrain
  var midpoint = new THREE.Vector3(
    (fromCoords.x + toCoords.x) / 2,
    (fromCoords.y + toCoords.y) / 2 + 10,
    (fromCoords.z + toCoords.z) / 2
  );
  
  // Create simple cone as arrow
  var arrowGeometry = new THREE.ConeGeometry(5, 15, 4);
  var arrowMaterial = new THREE.MeshBasicMaterial({
    color: color || 0x00ff00,
    opacity: 0.8,
    transparent: true
  });
  
  var arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
  arrow.position.copy(midpoint);
  
  // Rotate arrow to point in movement direction
  arrow.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction
  );
  
  return arrow;
}

/**
 * Clear all hex goto path visualizations
 */
function clear_hex_goto_path() {
  for (var i = 0; i < hex_goto_path_meshes.length; i++) {
    var mesh = hex_goto_path_meshes[i];
    if (typeof scene !== 'undefined') {
      scene.remove(mesh);
    }
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      mesh.material.dispose();
    }
  }
  hex_goto_path_meshes = [];
}

/**
 * Update hex goto path (called when path changes)
 * @param {array} newPath - New path array
 * @param {number} color - Path color
 */
function update_hex_goto_path(newPath, color) {
  create_hex_goto_path(newPath, color);
}
