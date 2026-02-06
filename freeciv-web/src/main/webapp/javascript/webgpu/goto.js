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
 * 
 * The server sends an array of tile indices directly, which avoids
 * any coordinate conversion issues with hexagonal maps.
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
    // G channel: reserved for future use
    // B channel: path step index (0-254), for path order visualization
    // A channel: set to 255 for RGBA format compatibility (required by THREE.DataTexture)
    goto_tiles_data = new Uint8Array(4 * map.xsize * map.ysize);
    
    // Initialize all tiles as not part of goto path
    for (let i = 0; i < map.xsize * map.ysize; i++) {
        let index = i * 4;
        goto_tiles_data[index] = 0;     // R: not on path
        goto_tiles_data[index + 1] = 0; // G: reserved
        goto_tiles_data[index + 2] = 0; // B: step index
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
 @param {number} stepIndex - The step index in the path (0 = start)
 ****************************************************************************/
function mark_goto_tile(tile, stepIndex) {
    if (goto_tiles_data == null || tile == null) return;
    if (tile.x < 0 || tile.x >= map.xsize || tile.y < 0 || tile.y >= map.ysize) return;
    
    let index = (tile.y * map.xsize + tile.x) * 4;
    goto_tiles_data[index] = 255; // R: Mark as part of goto path
    goto_tiles_data[index + 1] = 0; // G: reserved
    
    // Store step index for path order (clamped to 0-254)
    if (stepIndex !== undefined && stepIndex >= 0) {
        goto_tiles_data[index + 2] = Math.min(stepIndex, 254); // B: step index
    }
}

/****************************************************************************
 Clear all goto tile markers from the texture.
 ****************************************************************************/
function clear_goto_texture() {
    if (goto_tiles_data == null) return;
    
    for (let i = 0; i < map.xsize * map.ysize; i++) {
        let index = i * 4;
        goto_tiles_data[index] = 0;     // R: Clear path marker
        goto_tiles_data[index + 1] = 0; // G: Clear reserved
        goto_tiles_data[index + 2] = 0; // B: Clear step index
    }
    
    if (goto_tiles_texture != null) {
        goto_tiles_texture.needsUpdate = true;
    }
}

/****************************************************************************
 Renders goto path by marking tiles in the goto texture.
 The terrain shader will read this texture and render white edge highlights
 on marked tiles.
 
 @param {Array} tile_indices - Array of tile indices for the path (from server)
 ****************************************************************************/
function webgl_render_goto_line(tile_indices) {
    clear_goto_tiles();
    if (!goto_active) return;
    if (goto_tiles_data == null) {
        init_goto_tiles_texture();
    }
    if (goto_tiles_data == null) return;
    if (tile_indices == null || tile_indices.length == 0) return;

    // Mark each tile in the path using the tile indices from the server
    for (var stepIndex = 0; stepIndex < tile_indices.length; stepIndex++) {
        var tileIndex = tile_indices[stepIndex];
        var tile = index_to_tile(tileIndex);
        
        if (tile != null) {
            mark_goto_tile(tile, stepIndex);
        }
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