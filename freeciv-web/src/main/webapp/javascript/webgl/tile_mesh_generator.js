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
var tile_mesh_group = null;  // THREE.Group to hold all tile meshes

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
  // Tiles are in XZ plane (Y is up)
  var centerX = x * hex_width;
  if (y % 2 === 1) {  // Odd rows are offset
    centerX += hex_width / 2;
  }
  var centerZ = y * hex_height * 0.75;  // Vertical spacing for hexagons
  
  var centerY = height * 100;  // Height scaling
  
  // Adjust for map centering (match single-mesh positioning)
  // The map is centered at origin and then translated
  var width_half = (map.xsize * hex_width) / 2;
  var height_half = (map.ysize * hex_height * 0.75) / 2;
  
  centerX -= width_half;
  centerZ -= height_half;
  
  // Create hexagon vertices (6 corners + 1 center)
  var vertices = [];
  var uvs = [];
  var indices = [];
  
  // Center vertex
  vertices.push(centerX, centerY, centerZ);
  uvs.push(0.5, 0.5);
  
  // Six corner vertices (flat-top hexagon)
  for (var i = 0; i < 6; i++) {
    var angle = (Math.PI / 3) * i - Math.PI / 2;  // Start from top
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
  
  // Adjust for map centering
  var width_half = (map.xsize * TILE_SIZE) / 2;
  var height_half = (map.ysize * TILE_SIZE) / 2;
  
  tileX -= width_half;
  tileZ -= height_half;
  
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
  // Ensure required functions are available
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
    // Use shared terrain_material if available, otherwise create fallback once
    var material = (typeof terrain_material !== 'undefined' && terrain_material) 
                   ? terrain_material 
                   : get_fallback_material();
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

// Cached fallback material to avoid memory leaks
var fallback_material = null;

/**
 * Get or create a fallback material when terrain_material is unavailable
 * @returns {THREE.Material} Fallback material
 */
function get_fallback_material() {
  if (!fallback_material) {
    fallback_material = new THREE.MeshBasicMaterial({color: 0x808080});
  }
  return fallback_material;
}

/**
 * Initialize all tile meshes for the map
 * @param {boolean} is_hex - Whether to create hex or square tiles
 */
function init_tile_meshes(is_hex) {
  console.log("Initializing " + (is_hex ? "hexagonal" : "square") + " tile meshes...");
  
  // Create a group to hold all tiles
  if (tile_mesh_group) {
    scene.remove(tile_mesh_group);
  }
  tile_mesh_group = new THREE.Group();
  
  // For now, use simple materials per terrain type for testing
  // TODO: Integrate with the advanced shader system
  var material_cache = {};
  
  for (var y = 0; y < map.ysize; y++) {
    for (var x = 0; x < map.xsize; x++) {
      var key = x + "," + y;
      var ptile = map_pos_to_tile(x, y);
      
      if (!ptile) continue;
      
      var height = ptile['height'] || 0.5;
      
      // Create geometry based on topology
      var geometry;
      if (is_hex) {
        geometry = create_hex_tile_geometry(x, y, height);
      } else {
        geometry = create_square_tile_geometry(x, y, height);
      }
      
      tile_geometries[key] = geometry;
      
      // Get terrain type for basic color
      var terrain = tile_terrain(ptile);
      var terrain_name = terrain ? terrain['name'] : 'unknown';
      
      // Create simple colored material based on terrain
      // TODO: Replace with proper terrain shader material
      var material;
      if (!material_cache[terrain_name]) {
        var color = get_terrain_color(terrain_name);
        material_cache[terrain_name] = new THREE.MeshBasicMaterial({
          color: color,
          side: THREE.DoubleSide
        });
      }
      material = material_cache[terrain_name];
      
      // Create mesh
      var mesh = new THREE.Mesh(geometry, material);
      mesh.receiveShadow = false;
      mesh.castShadow = false;
      tile_meshes[key] = mesh;
      tile_mesh_group.add(mesh);
    }
  }
  
  // Apply the same transformation as the single mesh
  // Tiles are in XZ plane, so no need to rotate
  // But apply translation offset to match single-mesh positioning
  tile_mesh_group.position.set(Math.floor(mapview_model_width / 2) - 500, 0, 0);
  
  if (typeof scene !== 'undefined') {
    scene.add(tile_mesh_group);
  }
  
  console.log("Created " + Object.keys(tile_meshes).length + " tile meshes.");
}

/**
 * Get a basic color for a terrain type (for testing)
 * @param {string} terrain_name - Name of terrain type
 * @returns {number} Color as hex number
 */
function get_terrain_color(terrain_name) {
  var terrain_colors = {
    'Ocean': 0x1e90ff,
    'Coast': 0x4169e1,
    'Deep Ocean': 0x000080,
    'Glacier': 0xf0f8ff,
    'Desert': 0xf4a460,
    'Forest': 0x228b22,
    'Grassland': 0x7cfc00,
    'Hills': 0x8b7355,
    'Jungle': 0x006400,
    'Mountains': 0x696969,
    'Plains': 0x9acd32,
    'Swamp': 0x556b2f,
    'Tundra': 0xdcdcdc,
    'Lake': 0x4682b4,
    'unknown': 0x808080
  };
  
  return terrain_colors[terrain_name] || 0x808080;
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
  if (tile_mesh_group && typeof scene !== 'undefined') {
    scene.remove(tile_mesh_group);
  }
  
  for (var key in tile_meshes) {
    var mesh = tile_meshes[key];
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    // Materials are cached and shared between tiles, so we don't dispose them here
    // to avoid breaking other tiles that reference the same material.
    // Materials will be garbage collected when all references are removed.
  }
  
  tile_meshes = {};
  tile_geometries = {};
  tile_mesh_group = null;
}
