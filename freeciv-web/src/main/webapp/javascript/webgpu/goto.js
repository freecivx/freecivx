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

/**
 * Goto Path Visualization using Arrow Line
 * 
 * This module renders goto paths by drawing a straight arrow line from
 * the unit's current position to the destination tile. This provides
 * clear visual feedback of the goto path start and end points.
 */

// The goto arrow line object in the scene
var goto_arrow_line = null;
// The goto arrow head (cone) object in the scene  
var goto_arrow_head = null;
// Group containing all goto visualization objects
var goto_arrow_group = null;

// Arrow styling constants
var GOTO_ARROW_COLOR = 0x00ff00;  // Green color for the arrow
// Note: WebGL/WebGPU linewidth is often limited to 1 on many platforms/browsers.
// The arrow head (cone) provides the primary visual weight regardless of line width.
var GOTO_ARROW_LINE_WIDTH = 3;    // Line width (may be clamped to 1 on some platforms)
var GOTO_ARROW_HEAD_LENGTH = 6;   // Length of the arrow head cone
var GOTO_ARROW_HEAD_RADIUS = 3;   // Radius of the arrow head cone base
var GOTO_ARROW_HEIGHT_OFFSET = 25; // Height above terrain for the arrow

/****************************************************************************
 Initialize the goto arrow visualization.
 Creates the arrow group and adds it to the scene.
 ****************************************************************************/
function init_goto_arrow() {
    if (goto_arrow_group != null) return;
    
    goto_arrow_group = new THREE.Group();
    goto_arrow_group.name = "goto_arrow_group";
    goto_arrow_group.visible = false;
    
    if (scene != null) {
        scene.add(goto_arrow_group);
    }
}

/****************************************************************************
 Get the 3D scene position for a tile, centered on the tile.
 @param {Object} tile - The map tile
 @returns {THREE.Vector3} The 3D position in scene coordinates
 ****************************************************************************/
function get_tile_center_position(tile) {
    if (tile == null) return null;
    
    var pos = map_to_scene_coords(tile['x'], tile['y']);
    if (pos == null) return null;
    
    // Get hex center offsets for proper centering
    var centerOffsets = getHexCenterOffsets();
    
    // Calculate height at this tile (using tile height if available)
    var height = GOTO_ARROW_HEIGHT_OFFSET;
    if (tile['height'] !== undefined) {
        height += tile['height'] * 100;
    }
    
    return new THREE.Vector3(
        pos['x'] + centerOffsets.x,
        height,
        pos['y'] + centerOffsets.y
    );
}

/****************************************************************************
 Renders goto path as a straight arrow line from start tile to destination.
 Routes to appropriate implementation based on map topology (hex vs square).
 
 @param {Object} start_tile - The starting tile of the path (unit position)
 @param {Object} dest_tile - The destination tile of the path
 ****************************************************************************/
function webgl_render_goto_line(start_tile, dest_tile) {
    // Route to square implementation if not hex topology
    if (typeof is_hex === 'function' && !is_hex()) {
        if (typeof webgl_render_goto_line_square === 'function') {
            webgl_render_goto_line_square(start_tile, dest_tile);
            return;
        }
    }
    
    // Hex map implementation
    // Clear any existing goto visualization
    clear_goto_tiles();
    
    if (!goto_active) return;
    if (start_tile == null) return;
    if (dest_tile == null) return;
    
    // Initialize the arrow group if needed
    if (goto_arrow_group == null) {
        init_goto_arrow();
    }
    
    // Get 3D positions for start and destination
    var startPos = get_tile_center_position(start_tile);
    var destPos = get_tile_center_position(dest_tile);
    
    if (startPos == null || destPos == null) return;
    
    // Create the arrow line
    create_goto_arrow(startPos, destPos);
}

/****************************************************************************
 Creates the goto arrow from start position to destination position.
 
 @param {THREE.Vector3} startPos - The starting 3D position
 @param {THREE.Vector3} destPos - The destination 3D position
 ****************************************************************************/
function create_goto_arrow(startPos, destPos) {
    if (goto_arrow_group == null) {
        init_goto_arrow();
    }
    
    // Clear previous arrow objects from the group
    while (goto_arrow_group.children.length > 0) {
        goto_arrow_group.remove(goto_arrow_group.children[0]);
    }
    
    // Calculate direction vector and length
    var direction = new THREE.Vector3().subVectors(destPos, startPos);
    var length = direction.length();
    
    if (length < 1) {
        // Start and end are too close, don't draw arrow
        goto_arrow_group.visible = false;
        return;
    }
    
    // Normalize direction
    var dirNormalized = direction.clone().normalize();
    
    // Create arrow line (from start to just before the arrow head)
    var lineEndPos = new THREE.Vector3().copy(destPos).sub(
        dirNormalized.clone().multiplyScalar(GOTO_ARROW_HEAD_LENGTH * 0.8)
    );
    
    var lineGeometry = new THREE.BufferGeometry();
    var lineVertices = new Float32Array([
        startPos.x, startPos.y, startPos.z,
        lineEndPos.x, lineEndPos.y, lineEndPos.z
    ]);
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(lineVertices, 3));
    lineGeometry.name = "goto_line_geometry";
    
    var lineMaterial = new THREE.LineBasicMaterial({
        color: GOTO_ARROW_COLOR,
        linewidth: GOTO_ARROW_LINE_WIDTH,
        depthTest: true,
        depthWrite: true
    });
    
    goto_arrow_line = new THREE.Line(lineGeometry, lineMaterial);
    goto_arrow_line.name = "goto_arrow_line";
    goto_arrow_group.add(goto_arrow_line);
    
    // Create arrow head (cone)
    var coneGeometry = new THREE.ConeGeometry(
        GOTO_ARROW_HEAD_RADIUS,
        GOTO_ARROW_HEAD_LENGTH,
        8  // radial segments
    );
    coneGeometry.name = "goto_cone_geometry";
    
    var coneMaterial = new THREE.MeshBasicMaterial({
        color: GOTO_ARROW_COLOR,
        depthTest: true,
        depthWrite: true
    });
    
    goto_arrow_head = new THREE.Mesh(coneGeometry, coneMaterial);
    goto_arrow_head.name = "goto_arrow_head";
    
    // Position the cone at the destination
    goto_arrow_head.position.copy(destPos);
    
    // Orient the cone to point in the direction of travel
    // ConeGeometry points up (0, 1, 0) by default, so we need to rotate it
    var up = new THREE.Vector3(0, 1, 0);
    var quaternion = new THREE.Quaternion().setFromUnitVectors(up, dirNormalized);
    goto_arrow_head.quaternion.copy(quaternion);
    
    // Move cone back slightly so its tip is at the destination
    goto_arrow_head.position.sub(dirNormalized.clone().multiplyScalar(GOTO_ARROW_HEAD_LENGTH / 2));
    
    goto_arrow_group.add(goto_arrow_head);
    
    // Make the group visible
    goto_arrow_group.visible = true;
}

/**************************************************************************
 Removes goto path visualization by hiding the arrow.
 Also clears square map goto tiles if using square topology.
**************************************************************************/
function clear_goto_tiles() {
    // Clear square map goto tiles if in square mode
    if (typeof is_hex === 'function' && !is_hex() && typeof clear_goto_tiles_square === 'function') {
        clear_goto_tiles_square();
        return;
    }
    
    // Hex map cleanup
    if (goto_arrow_group != null) {
        goto_arrow_group.visible = false;
        
        // Clear all children from the group
        while (goto_arrow_group.children.length > 0) {
            var child = goto_arrow_group.children[0];
            if (child.geometry && typeof child.geometry.dispose === 'function') {
                child.geometry.dispose();
            }
            if (child.material && typeof child.material.dispose === 'function') {
                child.material.dispose();
            }
            goto_arrow_group.remove(child);
        }
    }
}