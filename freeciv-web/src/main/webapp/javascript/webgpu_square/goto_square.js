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
 * Goto Path Visualization for Square Map Tiles
 * 
 * This module renders goto paths for square map tiles by drawing
 * a path from start to destination with full path visualization.
 */

var goto_lines_square = [];

// Arrow styling constants for square maps
var GOTO_LINE_COLOR_SQUARE = 0x55c0ff;     // Cyan color for the path
var GOTO_LINE_WIDTH_SQUARE = 1.5;          // Width of path line
var GOTO_HEIGHT_OFFSET_SQUARE = 10.0;      // Height above terrain

// BFS pathfinding constants
var GOTO_MAX_BFS_TILES = 500;              // Maximum tiles explored by client-side BFS
var GOTO_AVG_MOVES_PER_TURN = 3;          // Estimated unit moves per turn for turn display

/****************************************************************************
 Get the 3D scene position for a tile, centered on the tile (square maps).
 @param {Object} tile - The map tile
 @returns {THREE.Vector3} The 3D position in scene coordinates
 ****************************************************************************/
function get_tile_center_position_square(tile) {
    if (tile == null) return null;
    
    var pos = map_to_scene_coords(tile['x'], tile['y']);
    if (pos == null) return null;
    
    // Calculate height at this tile
    var height = GOTO_HEIGHT_OFFSET_SQUARE;
    if (tile['height'] !== undefined) {
        height += tile['height'] * 100;
    }
    
    // Square tiles have centers at half tile width/height
    var tileWidth = mapview_model_width / map['xsize'];
    var tileHeight = mapview_model_height / map['ysize'];
    
    return new THREE.Vector3(
        pos['x'] + tileWidth / 2,
        height,
        pos['y'] + tileHeight / 2
    );
}

/****************************************************************************
 Renders goto path for square map tiles as an arrow from start to destination.
 
 @param {Object} start_tile - The starting tile of the path
 @param {Object} dest_tile - The destination tile of the path
 ****************************************************************************/
function webgl_render_goto_line_square(start_tile, dest_tile) {
    clear_goto_tiles_square();
    if (!goto_active) return;
    if (start_tile == null || dest_tile == null) return;

    // Get 3D positions for start and destination
    var startPos = get_tile_center_position_square(start_tile);
    var destPos = get_tile_center_position_square(dest_tile);
    
    if (startPos == null || destPos == null) return;

    const material = new THREE.MeshBasicMaterial({
        color: GOTO_LINE_COLOR_SQUARE,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
    });

    const lineWidth = GOTO_LINE_WIDTH_SQUARE;

    // Calculate direction and perpendicular
    var direction = new THREE.Vector3().subVectors(destPos, startPos).normalize();
    var perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize().multiplyScalar(lineWidth);

    var vertices = [
        startPos.clone().add(perpendicular),
        startPos.clone().sub(perpendicular),
        destPos.clone().add(perpendicular),
        destPos.clone().sub(perpendicular),
    ];

    // Create geometry for the quad
    const geometry = new THREE.BufferGeometry();
    const position = new Float32Array([
        vertices[0].x, vertices[0].y, vertices[0].z,
        vertices[1].x, vertices[1].y, vertices[1].z,
        vertices[2].x, vertices[2].y, vertices[2].z,

        vertices[1].x, vertices[1].y, vertices[1].z,
        vertices[3].x, vertices[3].y, vertices[3].z,
        vertices[2].x, vertices[2].y, vertices[2].z,
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));

    // Create the mesh and add to the scene
    const gotoline = new THREE.Mesh(geometry, material);
    gotoline.name = "goto_line_square";
    scene.add(gotoline);
    goto_lines_square.push(gotoline);
    
    // Add arrow head at destination
    create_goto_arrow_head_square(destPos, direction);
}

/****************************************************************************
 Creates an arrow head cone at the destination point.
 @param {THREE.Vector3} position - Position of the arrow head
 @param {THREE.Vector3} direction - Direction the arrow is pointing
 ****************************************************************************/
function create_goto_arrow_head_square(position, direction) {
    var coneGeometry = new THREE.ConeGeometry(3, 6, 8);
    var coneMaterial = new THREE.MeshBasicMaterial({
        color: GOTO_LINE_COLOR_SQUARE,
        transparent: true,
        opacity: 0.9
    });
    
    var cone = new THREE.Mesh(coneGeometry, coneMaterial);
    cone.name = "goto_arrow_head_square";
    
    // Position the cone at the destination
    cone.position.copy(position);
    
    // Orient the cone to point in the direction of travel
    var up = new THREE.Vector3(0, 1, 0);
    var quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
    cone.quaternion.copy(quaternion);
    
    // Move cone back slightly so its tip is at the destination
    cone.position.sub(direction.clone().multiplyScalar(3));
    
    scene.add(cone);
    goto_lines_square.push(cone);
}

/**************************************************************************
 Removes goto lines and clears goto tiles for square maps.
**************************************************************************/
function clear_goto_tiles_square() {
    if (scene != null && goto_lines_square != null) {
        for (var i = 0; i < goto_lines_square.length; i++) {
            scene.remove(goto_lines_square[i]);
            if (goto_lines_square[i].geometry) {
                goto_lines_square[i].geometry.dispose();
            }
            if (goto_lines_square[i].material) {
                goto_lines_square[i].material.dispose();
            }
        }
        goto_lines_square = [];
    }
}

/****************************************************************************
 Compute a client-side goto path for square maps using BFS.
 Avoids ocean tiles (unless the destination itself is ocean).
 Returns a path object compatible with the server goto_path format:
   { unit_id, dest, length, dir[], turns }
 or null if no path is found.

 @param {Object} punit    - The unit to move
 @param {Object} dest_tile - The destination tile
 @returns {Object|null}
 ****************************************************************************/
function compute_client_goto_path(punit, dest_tile) {
    var start_tile = index_to_tile(punit['tile']);
    if (start_tile == null || dest_tile == null) return null;
    if (start_tile['index'] == dest_tile['index']) return null;

    /* BFS – avoid ocean tiles except when they are the destination. */
    var visited = {};
    visited[start_tile['index']] = {parent_idx: -1, dir: -1};
    var queue = [start_tile];
    var found = false;
    var explored = 0;

    while (queue.length > 0 && explored < GOTO_MAX_BFS_TILES) {
        var current = queue.shift();
        explored++;

        if (current['index'] == dest_tile['index']) {
            found = true;
            break;
        }

        for (var dir = 0; dir < DIR8_LAST; dir++) {
            if (!is_valid_dir(dir)) continue;
            var next_tile = mapstep(current, dir);
            if (next_tile == null) continue;
            if (visited[next_tile['index']] != null) continue;
            /* Skip ocean tiles unless this is the destination. */
            if (is_ocean_tile(next_tile) && next_tile['index'] != dest_tile['index']) continue;
            visited[next_tile['index']] = {parent_idx: current['index'], dir: dir};
            queue.push(next_tile);
        }
    }

    if (!found) return null;

    /* Reconstruct the direction list by walking back through visited. */
    var dirs = [];
    var cur_idx = dest_tile['index'];
    while (visited[cur_idx]['parent_idx'] != -1) {
        dirs.unshift(visited[cur_idx]['dir']);
        cur_idx = visited[cur_idx]['parent_idx'];
    }
    if (dirs.length == 0) return null;

    return {
        'unit_id': punit['id'],
        'dest'   : dest_tile['index'],
        'length' : dirs.length,
        'dir'    : dirs,
        'turns'  : Math.max(1, Math.ceil(dirs.length / GOTO_AVG_MOVES_PER_TURN))
    };
}

/****************************************************************************
 Renders the client-side goto path for square maps as a sequence of blue
 line segments following the BFS-computed route.

 @param {Object} punit - The unit to move
 @param {Object} path  - Path object from compute_client_goto_path
 ****************************************************************************/
function webgl_render_goto_path_square(punit, path) {
    clear_goto_tiles_square();
    if (!goto_active || punit == null || path == null) return;

    var start_tile = index_to_tile(punit['tile']);
    if (start_tile == null) return;

    /* Reconstruct the tile sequence from the direction list. */
    var path_tiles = [start_tile];
    var current = start_tile;
    for (var i = 0; i < path['length']; i++) {
        current = mapstep(current, path['dir'][i]);
        if (current == null) break;
        path_tiles.push(current);
    }
    if (path_tiles.length < 2) return;

    var material = new THREE.MeshBasicMaterial({
        color: GOTO_LINE_COLOR_SQUARE,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
    });

    var lineWidth = GOTO_LINE_WIDTH_SQUARE;

    /* Draw one quad-strip segment per step in the path. */
    for (var j = 0; j < path_tiles.length - 1; j++) {
        var startPos = get_tile_center_position_square(path_tiles[j]);
        var endPos   = get_tile_center_position_square(path_tiles[j + 1]);
        if (startPos == null || endPos == null) continue;

        var direction    = new THREE.Vector3().subVectors(endPos, startPos).normalize();
        var perpendicular = new THREE.Vector3(-direction.z, 0, direction.x)
                              .normalize().multiplyScalar(lineWidth);

        var v = [
            startPos.clone().add(perpendicular),
            startPos.clone().sub(perpendicular),
            endPos.clone().add(perpendicular),
            endPos.clone().sub(perpendicular)
        ];

        var geometry = new THREE.BufferGeometry();
        var positions = new Float32Array([
            v[0].x, v[0].y, v[0].z,
            v[1].x, v[1].y, v[1].z,
            v[2].x, v[2].y, v[2].z,
            v[1].x, v[1].y, v[1].z,
            v[3].x, v[3].y, v[3].z,
            v[2].x, v[2].y, v[2].z
        ]);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        var seg = new THREE.Mesh(geometry, material);
        seg.name = "goto_line_square";
        scene.add(seg);
        goto_lines_square.push(seg);
    }

    /* Arrow head pointing into the destination tile. */
    var lastPos = get_tile_center_position_square(path_tiles[path_tiles.length - 1]);
    var prevPos = get_tile_center_position_square(path_tiles[path_tiles.length - 2]);
    if (lastPos != null && prevPos != null) {
        var arrowDir = new THREE.Vector3().subVectors(lastPos, prevPos).normalize();
        create_goto_arrow_head_square(lastPos, arrowDir);
    }
}
