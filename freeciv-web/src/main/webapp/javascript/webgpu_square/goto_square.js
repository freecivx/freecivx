/**********************************************************************
    Freecivx.com - the web version of Freeciv. http://www.freecivx.com/
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
var GOTO_LINE_COLOR_SQUARE = 0xffffff;        // White color for the path
var GOTO_LINE_WIDTH_SQUARE = 1.5;             // Width of path line
var GOTO_HEIGHT_OFFSET_SQUARE = 10.0;         // Height above terrain
var GOTO_ARROW_HEAD_LENGTH_SQUARE = 9;        // Length of flat arrowhead triangle
var GOTO_ARROW_HEAD_WIDTH_SQUARE = 5;         // Half-width of flat arrowhead triangle
var GOTO_DASH_LENGTH_SQUARE = 8;              // Length of each dash segment
var GOTO_GAP_LENGTH_SQUARE = 5;              // Length of each gap between dashes

// Pathfinding constants are defined in webgpu/pathfinding.js

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
 Draws a dashed thick line (as mesh quads) from startPos to endPos.
 Alternates between dash and gap segments to create a dashed effect.
 Adds created meshes directly to the scene and appends them to goto_lines_square.

 @param {THREE.Vector3} startPos   - Start of the line segment
 @param {THREE.Vector3} endPos     - End of the line segment
 @param {THREE.Material} material  - Material to use for dash quads
 @param {number}         lineWidth - Half-width of the line
 ****************************************************************************/
function draw_dashed_line_square(startPos, endPos, material, lineWidth) {
    var direction = new THREE.Vector3().subVectors(endPos, startPos).normalize();
    var perpendicular = new THREE.Vector3(-direction.z, 0, direction.x)
                          .normalize().multiplyScalar(lineWidth);
    var totalLen = startPos.distanceTo(endPos);
    var step = 0;
    var isDash = true;

    while (step < totalLen) {
        var segLen = isDash ? GOTO_DASH_LENGTH_SQUARE : GOTO_GAP_LENGTH_SQUARE;
        var actualLen = Math.min(segLen, totalLen - step);
        var dashStart = startPos.clone().add(direction.clone().multiplyScalar(step));
        var dashEnd   = startPos.clone().add(direction.clone().multiplyScalar(step + actualLen));

        if (isDash && actualLen > 0.1) {
            var v = [
                dashStart.clone().add(perpendicular),
                dashStart.clone().sub(perpendicular),
                dashEnd.clone().add(perpendicular),
                dashEnd.clone().sub(perpendicular)
            ];
            var geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                v[0].x, v[0].y, v[0].z,
                v[1].x, v[1].y, v[1].z,
                v[2].x, v[2].y, v[2].z,
                v[1].x, v[1].y, v[1].z,
                v[3].x, v[3].y, v[3].z,
                v[2].x, v[2].y, v[2].z
            ]), 3));
            var dash = new THREE.Mesh(geometry, material);
            dash.name = "goto_line_square";
            scene.add(dash);
            goto_lines_square.push(dash);
        }

        step += segLen;
        isDash = !isDash;
    }
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

    var material = new THREE.MeshBasicMaterial({
        color: GOTO_LINE_COLOR_SQUARE,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
    });

    // End the dashed line at the arrowhead base
    var direction = new THREE.Vector3().subVectors(destPos, startPos).normalize();
    var arrowBase = destPos.clone().sub(direction.clone().multiplyScalar(GOTO_ARROW_HEAD_LENGTH_SQUARE));

    draw_dashed_line_square(startPos, arrowBase, material, GOTO_LINE_WIDTH_SQUARE);

    // Add arrow head at destination
    create_goto_arrow_head_square(destPos, direction);
}

/****************************************************************************
 Creates a flat triangular arrowhead at the destination point.
 The triangle lies in the XZ plane, giving a clear arrow shape when viewed
 from above.
 @param {THREE.Vector3} position  - Tip position of the arrowhead (destination)
 @param {THREE.Vector3} direction - Normalised direction the arrow is pointing
 ****************************************************************************/
function create_goto_arrow_head_square(position, direction) {
    var perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
    var tip   = position.clone();
    var base  = tip.clone().sub(direction.clone().multiplyScalar(GOTO_ARROW_HEAD_LENGTH_SQUARE));
    var left  = base.clone().add(perpendicular.clone().multiplyScalar(GOTO_ARROW_HEAD_WIDTH_SQUARE));
    var right = base.clone().sub(perpendicular.clone().multiplyScalar(GOTO_ARROW_HEAD_WIDTH_SQUARE));

    var arrowGeometry = new THREE.BufferGeometry();
    arrowGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        tip.x,   tip.y,   tip.z,
        left.x,  left.y,  left.z,
        right.x, right.y, right.z
    ]), 3));

    var arrowMaterial = new THREE.MeshBasicMaterial({
        color: GOTO_LINE_COLOR_SQUARE,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
    });

    var arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.name = "goto_arrow_head_square";
    scene.add(arrow);
    goto_lines_square.push(arrow);
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
 Renders the client-side goto path for square maps as a sequence of white
 dashed line segments following the Dijkstra-computed route.

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

    /* Draw dashed line segments per step in the path. */
    for (var j = 0; j < path_tiles.length - 1; j++) {
        var startPos = get_tile_center_position_square(path_tiles[j]);
        var endPos   = get_tile_center_position_square(path_tiles[j + 1]);
        if (startPos == null || endPos == null) continue;

        var direction    = new THREE.Vector3().subVectors(endPos, startPos).normalize();

        // For the last segment, stop the dashes at the arrowhead base
        var segEnd = endPos;
        if (j == path_tiles.length - 2) {
            segEnd = endPos.clone().sub(direction.clone().multiplyScalar(GOTO_ARROW_HEAD_LENGTH_SQUARE));
        }

        draw_dashed_line_square(startPos, segEnd, material, lineWidth);
    }

    /* Arrow head pointing into the destination tile. */
    var lastPos = get_tile_center_position_square(path_tiles[path_tiles.length - 1]);
    var prevPos = get_tile_center_position_square(path_tiles[path_tiles.length - 2]);
    if (lastPos != null && prevPos != null) {
        var arrowDir = new THREE.Vector3().subVectors(lastPos, prevPos).normalize();
        create_goto_arrow_head_square(lastPos, arrowDir);
    }
}
