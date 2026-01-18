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
 * Per-tile mesh generator for both square and hexagonal tiles.
 * This module creates individual mesh objects for each map tile.
 */

// Storage for all tile meshes
var tile_meshes = {};  // Keyed by "x,y" string
var tile_geometries = {};  // Keyed by "x,y" string

// Tile rendering constants
var TILE_SIZE = MAPVIEW_ASPECT_FACTOR;  // Base tile size

/**
 * Generate a hexagonal tile geometry
 * @param {number} x - Tile x coordinate
 * @param {number} y - Tile y coordinate
 * @param {number} height - Tile height from heightmap
 * @returns {THREE.BufferGeometry} Hex tile geometry
 */
function create_hex_tile_geometry(x, y, height) {
  var geometry = new THREE.BufferGeometry();
  
  // Hex dimensions
  var hex_width = TILE_SIZE * Math.sqrt(3);
  var hex_height = TILE_SIZE * 2;
  
  // Calculate center position using odd-r offset coordinates
  var centerX = x * hex_width;
  if (y % 2 === 1) {  // Odd rows are offset
    centerX += hex_width / 2;
  }
  var centerZ = y * hex_height * 0.75;  // Vertical spacing for hexagons
  
  var centerY = height * 100;  // Height scaling
  
  // Create hexagon vertices (6 corners + 1 center)
  var vertices = [];
  var uvs = [];
  var indices = [];
  
  // Center vertex
  vertices.push(centerX, centerY, centerZ);
  uvs.push(0.5, 0.5);
  
  // Six corner vertices
  for (var i = 0; i < 6; i++) {
    var angle = (Math.PI / 3) * i;
    var vx = centerX + TILE_SIZE * Math.cos(angle);
    var vz = centerZ + TILE_SIZE * Math.sin(angle);
    vertices.push(vx, centerY, vz);
    
    // UV coordinates
    uvs.push(0.5 + 0.5 * Math.cos(angle), 0.5 + 0.5 * Math.sin(angle));
    
    // Create triangle from center to this corner and next corner
    var nextIdx = (i + 1) % 6 + 1;
    indices.push(0, i + 1, nextIdx);
  }
  
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return geometry;
}

/**
 * Generate a square tile geometry
 * @param {number} x - Tile x coordinate
 * @param {number} y - Tile y coordinate
 * @param {number} height - Tile height from heightmap
 * @returns {THREE.BufferGeometry} Square tile geometry
 */
function create_square_tile_geometry(x, y, height) {
  var geometry = new THREE.BufferGeometry();
  
  // Calculate tile position
  var tileX = x * TILE_SIZE;
  var tileZ = y * TILE_SIZE;
  var tileY = height * 100;  // Height scaling
  
  // Create square tile vertices (4 corners)
  var halfSize = TILE_SIZE / 2;
  var vertices = [
    tileX - halfSize, tileY, tileZ - halfSize,  // 0: top-left
    tileX + halfSize, tileY, tileZ - halfSize,  // 1: top-right
    tileX + halfSize, tileY, tileZ + halfSize,  // 2: bottom-right
    tileX - halfSize, tileY, tileZ + halfSize   // 3: bottom-left
  ];
  
  var uvs = [
    0, 0,  // top-left
    1, 0,  // top-right
    1, 1,  // bottom-right
    0, 1   // bottom-left
  ];
  
  // Two triangles to form a square
  var indices = [
    0, 1, 2,  // First triangle
    0, 2, 3   // Second triangle
  ];
  
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return geometry;
}

/**
 * Create or update a tile mesh
 * @param {number} x - Tile x coordinate
 * @param {number} y - Tile y coordinate
 * @param {boolean} is_hex - Whether to create hex or square tile
 * @returns {THREE.Mesh} The tile mesh
 */
function create_or_update_tile_mesh(x, y, is_hex) {
  if (typeof map_pos_to_tile !== 'function') {
    console.error("map_pos_to_tile function not available");
    return null;
  }
  
  var key = x + "," + y;
  var ptile = map_pos_to_tile(x, y);
  
  if (!ptile) return null;
  
  var height = ptile['height'] || 0.5;
  
  // Create geometry based on topology
  var geometry;
  if (is_hex) {
    geometry = create_hex_tile_geometry(x, y, height);
  } else {
    geometry = create_square_tile_geometry(x, y, height);
  }
  
  tile_geometries[key] = geometry;
  
  // Create or update mesh
  var mesh = tile_meshes[key];
  if (!mesh) {
    // Use the global terrain_material if available
    var material = (typeof terrain_material !== 'undefined') ? terrain_material : new THREE.MeshBasicMaterial({color: 0x808080});
    mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = false;
    mesh.castShadow = false;
    tile_meshes[key] = mesh;
    if (typeof scene !== 'undefined') {
      scene.add(mesh);
    }
  } else {
    mesh.geometry.dispose();
    mesh.geometry = geometry;
  }
  
  return mesh;
}

/**
 * Initialize all tile meshes for the map
 * @param {boolean} is_hex - Whether to create hex or square tiles
 */
function init_tile_meshes(is_hex) {
  console.log("Initializing " + (is_hex ? "hexagonal" : "square") + " tile meshes...");
  
  for (var y = 0; y < map.ysize; y++) {
    for (var x = 0; x < map.xsize; x++) {
      create_or_update_tile_mesh(x, y, is_hex);
    }
  }
  
  console.log("Created " + Object.keys(tile_meshes).length + " tile meshes.");
}

/**
 * Update a specific tile's geometry (e.g., when height changes)
 * @param {number} x - Tile x coordinate
 * @param {number} y - Tile y coordinate
 * @param {boolean} is_hex - Whether tile is hex or square
 */
function update_tile_mesh(x, y, is_hex) {
  create_or_update_tile_mesh(x, y, is_hex);
}

/**
 * Clean up all tile meshes (call when changing topology or ending game)
 */
function cleanup_tile_meshes() {
  for (var key in tile_meshes) {
    var mesh = tile_meshes[key];
    if (typeof scene !== 'undefined') {
      scene.remove(mesh);
    }
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material && mesh.material.dispose) {
      // Don't dispose shared material
      // mesh.material.dispose();
    }
  }
  
  tile_meshes = {};
  tile_geometries = {};
}
