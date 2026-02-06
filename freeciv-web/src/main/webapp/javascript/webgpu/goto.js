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
 * Goto Path Visualization using Shader-Based Tile Highlighting
 * 
 * This module renders goto paths by marking tiles in a texture that the
 * terrain shader uses to draw white edge highlights on path tiles.
 * This approach provides consistent, high-quality path visualization
 * that integrates seamlessly with the hexagonal terrain rendering.
 */

// Texture data for goto path tiles
var goto_tiles_texture = null;
var goto_tiles_data = null;

/****************************************************************************
 Initialize the goto tiles texture.
 Called during map initialization to create the texture that stores goto path data.
 ****************************************************************************/
function init_goto_tiles_texture() {
    if (typeof map === 'undefined' || map == null) return;
    
    // Create RGBA texture data (4 bytes per tile)
    // R channel: 255 if tile is part of goto path, 0 otherwise
    // G channel: reserved for future use (e.g., path segment index)
    // B channel: reserved for future use
    // A channel: set to 255 for RGBA format compatibility (required by THREE.DataTexture)
    goto_tiles_data = new Uint8Array(4 * map.xsize * map.ysize);
    
    // Initialize all tiles as not part of goto path
    for (let i = 0; i < map.xsize * map.ysize; i++) {
        let index = i * 4;
        goto_tiles_data[index] = 0;     // R: not on path
        goto_tiles_data[index + 1] = 0; // G: reserved
        goto_tiles_data[index + 2] = 0; // B: reserved
        goto_tiles_data[index + 3] = 255; // A: full opacity
    }
    
    goto_tiles_texture = new THREE.DataTexture(goto_tiles_data, map.xsize, map.ysize);
    goto_tiles_texture.format = THREE.RGBAFormat;
    goto_tiles_texture.type = THREE.UnsignedByteType;
    goto_tiles_texture.magFilter = THREE.NearestFilter;
    goto_tiles_texture.minFilter = THREE.NearestFilter;
    goto_tiles_texture.flipY = true;
    goto_tiles_texture.needsUpdate = true;
}

/****************************************************************************
 Mark a single tile as part of the goto path.
 @param {Object} tile - The tile to mark
 ****************************************************************************/
function mark_goto_tile(tile) {
    if (goto_tiles_data == null || tile == null) return;
    if (tile.x < 0 || tile.x >= map.xsize || tile.y < 0 || tile.y >= map.ysize) return;
    
    let index = (tile.y * map.xsize + tile.x) * 4;
    goto_tiles_data[index] = 255; // Mark as part of goto path
}

/****************************************************************************
 Clear all goto tile markers from the texture.
 ****************************************************************************/
function clear_goto_texture() {
    if (goto_tiles_data == null) return;
    
    for (let i = 0; i < map.xsize * map.ysize; i++) {
        let index = i * 4;
        goto_tiles_data[index] = 0; // Clear path marker
    }
    
    if (goto_tiles_texture != null) {
        goto_tiles_texture.needsUpdate = true;
    }
}

/****************************************************************************
 Renders goto path by marking tiles in the goto texture.
 The terrain shader will read this texture and render white edge highlights
 on marked tiles.
 
 @param {Object} start_tile - The starting tile of the path
 @param {Array} goto_packet_dir - Array of direction indices for the path
 ****************************************************************************/
function webgl_render_goto_line(start_tile, goto_packet_dir) {
    clear_goto_tiles();
    if (!goto_active) return;
    if (goto_tiles_data == null) {
        init_goto_tiles_texture();
    }
    if (goto_tiles_data == null) return;

    var currentTile = start_tile;
    
    // Mark the starting tile
    if (currentTile != null) {
        mark_goto_tile(currentTile);
    }

    // Iterate through each direction in the path and mark tiles
    for (var stepIdx = 0; stepIdx < goto_packet_dir.length; stepIdx++) {
        if (currentTile == null) break;
        
        var moveDir = goto_packet_dir[stepIdx];
        
        // Skip refuel markers
        if (moveDir == -1) {
            continue;
        }

        // Rotate direction 45 degrees counterclockwise to match the 3D camera perspective,
        // which views the map from the SE direction. This is the same rotation applied
        // to unit controls in control.js (see numpad direction handling around line 2056).
        var rotatedDir = dir_ccw(moveDir);
        
        // Validate the rotated direction is valid for current topology.
        // dir_ccw() returns -1 for invalid input, and is_valid_dir() handles topology checks.
        // Note: DIR_DX/DIR_DY use square grid offsets which work for map coordinates
        // even on hex maps (the hex-specific rendering is handled elsewhere).
        if (!is_valid_dir(rotatedDir)) {
            continue;
        }
        
        // Calculate next tile directly using DIR_DX/DIR_DY instead of mapstep
        var dx = DIR_DX[rotatedDir];
        var dy = DIR_DY[rotatedDir];
        var targetTile = map_pos_to_tile(currentTile['x'] + dx, currentTile['y'] + dy);
        
        if (targetTile != null) {
            // Mark the target tile as part of the goto path
            mark_goto_tile(targetTile);
        }

        // Advance to next tile in path
        currentTile = targetTile;
    }
    
    // Update the texture so the shader can read the new data
    if (goto_tiles_texture != null) {
        goto_tiles_texture.needsUpdate = true;
    }
}

/**************************************************************************
 Removes goto path visualization by clearing the goto tiles texture.
**************************************************************************/
function clear_goto_tiles() {
    clear_goto_texture();
}

/**************************************************************************
 Returns the goto tiles texture for use as a shader uniform.
 @returns {THREE.DataTexture} The goto tiles texture
**************************************************************************/
function get_goto_tiles_texture() {
    if (goto_tiles_texture == null) {
        init_goto_tiles_texture();
    }
    return goto_tiles_texture;
}