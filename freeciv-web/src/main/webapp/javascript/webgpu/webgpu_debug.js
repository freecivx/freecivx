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
 * WebGPU Debug Module
 * 
 * This module provides debugging tools for the WebGPU hex renderer:
 * - Debug tile label sprites showing tile coordinates (x,y)
 * - Enhanced tile click logging with terrain, units, resources info
 * - WebGPU performance logging
 * - Goto path debugging with detailed console output and visual shader display
 * 
 * Enable via: webgpu_debug_enabled = true (set in pregame settings)
 * 
 * Console commands available when debug mode is enabled:
 * - toggle_webgpu_debug() - Toggle debug mode on/off
 * - refresh_webgpu_debug_labels() - Refresh tile coordinate labels
 * - log_webgpu_performance() - Log WebGPU renderer performance stats
 * - log_webgpu_debug_tile_info(tile) - Log detailed info for a tile
 * - log_webgpu_goto_path(start_tile, dir_array, dest_tile) - Log goto path details
 * - debug_dir_to_name(dir) - Convert direction index to name (e.g., 0 -> "NW")
 * 
 * Goto Path Debug Features:
 * When debug mode is enabled and a goto path is requested:
 * 1. Console shows full path traversal with tile coordinates and directions
 * 2. Direction names are shown (NW, N, NE, W, E, SW, S, SE)
 * 3. Warnings are logged if movements don't match expected direction offsets
 * 4. The terrain shader displays "D# S##" on goto path tiles where:
 *    - D# = Direction index (0=start, 1=NW, 2=N, 3=NE, 4=W, 5=E, 6=SW, 7=S, 8=SE)
 *    - S## = Step index in the path (00 = start, 01 = first move, etc.)
 */

// Store debug tile labels for cleanup
var webgpu_debug_labels = {};
var webgpu_debug_initialized = false;

/**
 * Initialize WebGPU debug mode when game starts
 * Called after the map is rendered
 */
function init_webgpu_debug() {
    if (!webgpu_debug_enabled || webgpu_debug_initialized) {
        return;
    }
    
    console.log('[WebGPU Debug] Debug mode initializing...');
    console.log('[WebGPU Debug] webgpu_debug_enabled = ' + webgpu_debug_enabled);
    webgpu_debug_initialized = true;
    
    // Verify shader debug uniform is set correctly
    if (typeof freeciv_uniforms !== 'undefined' && freeciv_uniforms != null) {
        if (freeciv_uniforms.debug_enabled) {
            console.log('[WebGPU Debug] Shader debug uniform found: debug_enabled = ' + freeciv_uniforms.debug_enabled.value);
        } else {
            console.warn('[WebGPU Debug] Shader debug uniform not found - tile coordinates may not render in shader');
        }
    }
    
    // Create debug labels for visible tiles (sprite overlay)
    update_webgpu_debug_labels();
    
    console.log('[WebGPU Debug] Debug mode enabled. Tile coordinates (x:y) will be rendered on the terrain.');
    console.log('[WebGPU Debug] Goto paths will show detailed debug info: direction (D#) and step index (S##)');
    console.log('[WebGPU Debug] Click on map tiles to see detailed info in console.');
}

/**
 * Create debug labels for all visible map tiles
 * Shows tile coordinates as billboard sprites above each tile
 */
function update_webgpu_debug_labels() {
    if (!webgpu_debug_enabled || scene == null || typeof map === 'undefined' || map == null) {
        return;
    }
    
    // Clear existing labels
    clear_webgpu_debug_labels();
    
    var tiles_labeled = 0;
    var max_labels = 5000; // Limit labels for performance
    
    // Get camera position to only label nearby tiles
    var cam_pos = camera.position.clone();
    var label_radius = 3000; // Only label tiles within this radius of camera
    
    for (var y = 0; y < map.ysize && tiles_labeled < max_labels; y++) {
        for (var x = 0; x < map.xsize && tiles_labeled < max_labels; x++) {
            var ptile = map_pos_to_tile(x, y);
            if (ptile == null) continue;
            
            // Get tile position in scene
            var pos = map_to_scene_coords(x, y);
            if (pos == null) continue;
            
            // Check distance from camera
            var tile_pos = new THREE.Vector3(pos.x, 0, pos.y);
            var dist = cam_pos.distanceTo(tile_pos);
            if (dist > label_radius) continue;
            
            // Only show labels for known tiles
            if (tile_get_known(ptile) === TILE_UNKNOWN) continue;
            
            // Create and position the label sprite at the tile CENTER (not corner)
            var label_sprite = create_debug_tile_label_sprite(x, y);
            if (label_sprite != null) {
                // Calculate tile dimensions for centering
                var tileWidth = mapview_model_width / map.xsize;
                var tileHeight = (mapview_model_height / map.ysize) * HEX_HEIGHT_FACTOR;
                
                // Position label at tile center by adding half tile dimensions
                label_sprite.position.set(pos.x + tileWidth / 2, 50, pos.y + tileHeight / 2); // Elevated above terrain
                label_sprite.name = "debug_tile_label_" + x + "_" + y;
                scene.add(label_sprite);
                webgpu_debug_labels[x + "_" + y] = label_sprite;
                tiles_labeled++;
            }
        }
    }
    
    console.log('[WebGPU Debug] Created ' + tiles_labeled + ' tile debug labels');
}

/**
 * Create a debug label sprite showing tile coordinates
 * @param {number} x - Tile X coordinate
 * @param {number} y - Tile Y coordinate
 * @returns {THREE.Sprite} The label sprite
 */
function create_debug_tile_label_sprite(x, y) {
    var label_text = "(" + x + "," + y + ")";
    
    var fcanvas = document.createElement("canvas");
    fcanvas.width = 96;
    fcanvas.height = 32;
    var ctx = fcanvas.getContext("2d");
    
    // Semi-transparent dark background for readability
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, fcanvas.width, fcanvas.height);
    
    // Yellow text with black outline
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText(label_text, fcanvas.width / 2, fcanvas.height / 2);
    
    // Fill
    ctx.fillStyle = '#FFFF00';
    ctx.fillText(label_text, fcanvas.width / 2, fcanvas.height / 2);
    
    // Border
    ctx.strokeStyle = '#FFFF00';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, fcanvas.width - 4, fcanvas.height - 4);
    
    var texture = new THREE.Texture(fcanvas);
    texture.needsUpdate = true;
    
    var material = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true,
        depthTest: false
    });
    
    var sprite = new THREE.Sprite(material);
    sprite.scale.set(24, 8, 1);
    return sprite;
}

/**
 * Clear all debug tile labels from the scene
 */
function clear_webgpu_debug_labels() {
    for (var key in webgpu_debug_labels) {
        if (webgpu_debug_labels.hasOwnProperty(key)) {
            var label = webgpu_debug_labels[key];
            if (label != null && scene != null) {
                scene.remove(label);
                if (label.material) {
                    if (label.material.map) {
                        label.material.map.dispose();
                    }
                    label.material.dispose();
                }
            }
        }
    }
    webgpu_debug_labels = {};
}

/**
 * Log detailed debug information for a tile when clicked
 * @param {object} ptile - The tile object
 */
function log_webgpu_debug_tile_info(ptile) {
    if (!webgpu_debug_enabled || ptile == null) {
        return;
    }
    
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║          WEBGPU TILE DEBUG INFO                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    
    // Basic tile info
    console.log('Tile Coordinates: (' + ptile.x + ', ' + ptile.y + ')');
    console.log('Tile Index: ' + ptile.index);
    
    // Terrain info
    var terrain = null;
    if (typeof tile_terrain !== 'undefined') {
        terrain = tile_terrain(ptile);
    }
    if (terrain != null) {
        console.log('Terrain Type: ' + terrain.name);
        console.log('Terrain ID: ' + terrain.id);
        if (terrain.graphic_str) {
            console.log('Terrain Graphic: ' + terrain.graphic_str);
        }
    } else {
        console.log('Terrain Type: Unknown');
    }
    
    // Visibility info
    var known = tile_get_known(ptile);
    var known_str = 'Unknown';
    if (known === TILE_KNOWN_SEEN) {
        known_str = 'Visible';
    } else if (known === TILE_KNOWN_UNSEEN) {
        known_str = 'Fogged (known but not visible)';
    }
    console.log('Visibility: ' + known_str);
    
    // Owner info
    if (ptile.owner != null && players[ptile.owner] != null) {
        console.log('Owner: ' + players[ptile.owner].name + ' (Player ' + ptile.owner + ')');
    } else {
        console.log('Owner: None (unclaimed)');
    }
    
    // Units on tile
    var units = tile_units(ptile);
    if (units != null && units.length > 0) {
        console.log('Units on tile: ' + units.length);
        for (var i = 0; i < units.length; i++) {
            var unit = units[i];
            var unit_type = unit_types[unit.type];
            var owner = players[unit.owner];
            console.log('  - ' + unit_type.name + ' (ID: ' + unit.id + ', Owner: ' + owner.name + ', HP: ' + unit.hp + '/' + unit_type.hp + ')');
        }
    } else {
        console.log('Units on tile: None');
    }
    
    // City info
    var city = tile_city(ptile);
    if (city != null) {
        console.log('City: ' + city.name + ' (Size: ' + city.size + ', ID: ' + city.id + ')');
    }
    
    // Resource info
    var resource = tile_resource(ptile);
    if (resource != null && typeof extras !== 'undefined' && extras[resource]) {
        console.log('Resource: ' + extras[resource].name);
    }
    
    // Extras/improvements
    if (ptile.extras != null && typeof ptile.extras.toBitSet === 'function') {
        var tile_extras = ptile.extras.toBitSet();
        if (tile_extras.length > 0) {
            console.log('Extras:');
            for (var j = 0; j < tile_extras.length; j++) {
                var extra_id = tile_extras[j];
                if (typeof extras !== 'undefined' && extras[extra_id]) {
                    console.log('  - ' + extras[extra_id].name);
                }
            }
        }
    }
    
    // Scene position info (for debugging rendering)
    var scene_pos = map_to_scene_coords(ptile.x, ptile.y);
    if (scene_pos != null) {
        console.log('Scene Position: (' + scene_pos.x.toFixed(2) + ', ' + scene_pos.y.toFixed(2) + ')');
    }
    
    // WebGPU-specific debug info
    console.log('');
    console.log('--- WebGPU Renderer Info ---');
    if (typeof maprenderer !== 'undefined' && maprenderer != null) {
        console.log('Renderer Type: WebGPU');
        if (maprenderer.info) {
            console.log('Render Info:', maprenderer.info);
        }
    }
    
    // Log map info
    if (typeof map !== 'undefined' && map != null) {
        console.log('Map Size: ' + map.xsize + ' x ' + map.ysize);
        console.log('Map Topology: ' + (topo_has_flag(TF_HEX) ? 'Hexagonal' : 'Square'));
    }
    
    console.log('════════════════════════════════════════════════════════════');
}

/**
 * Toggle WebGPU debug mode on/off
 * Can be called from browser console: toggle_webgpu_debug()
 */
function toggle_webgpu_debug() {
    webgpu_debug_enabled = !webgpu_debug_enabled;
    
    // Update shader uniform if available
    if (typeof freeciv_uniforms !== 'undefined' && freeciv_uniforms != null && freeciv_uniforms.debug_enabled) {
        freeciv_uniforms.debug_enabled.value = webgpu_debug_enabled;
        console.log('[WebGPU Debug] Updated shader debug_enabled uniform to: ' + webgpu_debug_enabled);
    }
    
    if (webgpu_debug_enabled) {
        console.log('[WebGPU Debug] Debug mode ENABLED');
        console.log('[WebGPU Debug] - Tile coordinates (x:y) will now be rendered on the terrain.');
        console.log('[WebGPU Debug] - Goto paths will show D# (direction) and S## (step index) in cyan.');
        console.log('[WebGPU Debug] - Direction codes: 0=START, 1=NW, 2=N, 3=NE, 4=W, 5=E, 6=SW, 7=S, 8=SE');
        console.log('[WebGPU Debug] - Full goto path details will be logged to console.');
        webgpu_debug_initialized = false;
        init_webgpu_debug();
    } else {
        console.log('[WebGPU Debug] Debug mode DISABLED');
        console.log('[WebGPU Debug] Tile coordinate and goto path debug displays turned off.');
        clear_webgpu_debug_labels();
        webgpu_debug_initialized = false;
    }
    
    return webgpu_debug_enabled;
}

/**
 * Refresh debug labels (e.g., after camera movement)
 * Call this when the visible area changes significantly
 */
function refresh_webgpu_debug_labels() {
    if (!webgpu_debug_enabled) {
        return;
    }
    update_webgpu_debug_labels();
}

/**
 * Log WebGPU performance statistics
 */
function log_webgpu_performance() {
    if (!webgpu_debug_enabled) {
        return;
    }
    
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║          WEBGPU PERFORMANCE STATISTICS                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    
    if (typeof maprenderer !== 'undefined' && maprenderer != null && maprenderer.info) {
        var info = maprenderer.info;
        console.log('Render calls:', info.render ? info.render.calls : 'N/A');
        console.log('Triangles:', info.render ? info.render.triangles : 'N/A');
        console.log('Points:', info.render ? info.render.points : 'N/A');
        console.log('Lines:', info.render ? info.render.lines : 'N/A');
        console.log('Frame:', info.render ? info.render.frame : 'N/A');
        console.log('Textures:', info.memory ? info.memory.textures : 'N/A');
        console.log('Geometries:', info.memory ? info.memory.geometries : 'N/A');
    }
    
    if (typeof scene !== 'undefined' && scene != null) {
        console.log('Scene children:', scene.children.length);
    }
    
    console.log('Debug labels count:', Object.keys(webgpu_debug_labels).length);
    console.log('════════════════════════════════════════════════════════════');
}

/**
 * Convert direction index to human-readable direction name
 * Direction indices: 0=NW, 1=N, 2=NE, 3=W, 4=E, 5=SW, 6=S, 7=SE
 * @param {number} dir - Direction index (0-7)
 * @returns {string} - Direction name (e.g., "N", "NE", "E")
 */
function debug_dir_to_name(dir) {
    var dir_names = ["NW", "N", "NE", "W", "E", "SW", "S", "SE"];
    if (dir >= 0 && dir < 8) {
        return dir_names[dir];
    } else if (dir === -1) {
        return "REFUEL";
    }
    return "INVALID(" + dir + ")";
}

/**
 * Log detailed goto path information for debugging
 * Called when a goto path is requested/rendered
 * 
 * @param {Object} start_tile - The starting tile of the path
 * @param {Array} goto_packet_dir - Array of direction indices for the path
 * @param {Object} dest_tile - The destination tile (optional)
 */
function log_webgpu_goto_path(start_tile, goto_packet_dir, dest_tile) {
    if (!webgpu_debug_enabled) {
        return;
    }
    
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║          WEBGPU GOTO PATH DEBUG INFO                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    
    // Log request info
    if (start_tile != null) {
        console.log('Start Tile: (' + start_tile.x + ', ' + start_tile.y + ') index=' + start_tile.index);
    } else {
        console.log('Start Tile: NULL (error!)');
    }
    
    if (dest_tile != null) {
        console.log('Destination Tile: (' + dest_tile.x + ', ' + dest_tile.y + ') index=' + dest_tile.index);
    }
    
    // Log direction array
    if (goto_packet_dir != null && goto_packet_dir.length > 0) {
        console.log('Path Length: ' + goto_packet_dir.length + ' steps');
        
        // Build direction string with names
        var dir_str = goto_packet_dir.map(function(dir, idx) {
            return debug_dir_to_name(dir);
        }).join(' -> ');
        console.log('Directions: ' + dir_str);
        
        // Log raw direction array for detailed debugging
        console.log('Direction Indices (raw): [' + goto_packet_dir.join(', ') + ']');
    } else {
        console.log('Path: EMPTY or NULL');
    }
    
    // Log full tile-by-tile path traversal
    console.log('');
    console.log('--- Full Path Traversal ---');
    
    var currentTile = start_tile;
    var path_tiles = [];
    
    if (currentTile != null) {
        path_tiles.push({
            step: 0,
            tile: currentTile,
            dir: 'START',
            dir_idx: -2
        });
        console.log('Step 0: START at (' + currentTile.x + ', ' + currentTile.y + ')');
    }
    
    if (goto_packet_dir != null) {
        for (var stepIdx = 0; stepIdx < goto_packet_dir.length; stepIdx++) {
            if (currentTile == null) {
                console.warn('Step ' + (stepIdx + 1) + ': ERROR - currentTile is NULL, path broken!');
                break;
            }
            
            var moveDir = goto_packet_dir[stepIdx];
            var dir_name = debug_dir_to_name(moveDir);
            
            // Skip refuel markers
            if (moveDir === -1) {
                console.log('Step ' + (stepIdx + 1) + ': REFUEL (stay at current tile)');
                path_tiles.push({
                    step: stepIdx + 1,
                    tile: currentTile,
                    dir: 'REFUEL',
                    dir_idx: moveDir
                });
                continue;
            }
            
            // Get the next tile using mapstep
            var targetTile = null;
            if (typeof mapstep !== 'undefined') {
                targetTile = mapstep(currentTile, moveDir);
            }
            
            if (targetTile != null) {
                // Calculate expected position based on direction
                var expected_dx = typeof DIR_DX !== 'undefined' ? DIR_DX[moveDir] : '?';
                var expected_dy = typeof DIR_DY !== 'undefined' ? DIR_DY[moveDir] : '?';
                var actual_dx = targetTile.x - currentTile.x;
                var actual_dy = targetTile.y - currentTile.y;
                
                console.log('Step ' + (stepIdx + 1) + ': ' + dir_name + ' (dir=' + moveDir + ')' +
                    ' from (' + currentTile.x + ',' + currentTile.y + ')' +
                    ' -> (' + targetTile.x + ',' + targetTile.y + ')' +
                    ' [expected dx=' + expected_dx + ',dy=' + expected_dy + 
                    ', actual dx=' + actual_dx + ',dy=' + actual_dy + ']');
                
                // Warn if actual movement doesn't match expected
                if (expected_dx !== '?' && expected_dy !== '?' && 
                    (actual_dx !== expected_dx || actual_dy !== expected_dy)) {
                    console.warn('  WARNING: Movement mismatch! Expected dx=' + expected_dx + 
                        ',dy=' + expected_dy + ' but got dx=' + actual_dx + ',dy=' + actual_dy);
                }
                
                path_tiles.push({
                    step: stepIdx + 1,
                    tile: targetTile,
                    dir: dir_name,
                    dir_idx: moveDir
                });
            } else {
                console.error('Step ' + (stepIdx + 1) + ': ' + dir_name + ' (dir=' + moveDir + ')' +
                    ' from (' + currentTile.x + ',' + currentTile.y + ')' +
                    ' -> NULL (invalid direction or off map!)');
                
                // Check if direction is valid for current topology
                if (typeof is_valid_dir !== 'undefined') {
                    var is_valid = is_valid_dir(moveDir);
                    console.error('  is_valid_dir(' + moveDir + ') = ' + is_valid);
                }
            }
            
            // Advance to next tile in path
            currentTile = targetTile;
        }
    }
    
    // Summary
    console.log('');
    console.log('--- Path Summary ---');
    console.log('Total tiles in path: ' + path_tiles.length);
    
    // Log tiles as coordinate list for easy visualization
    var coord_list = path_tiles.map(function(p) {
        return '(' + p.tile.x + ',' + p.tile.y + ')';
    }).join(' -> ');
    console.log('Tile coordinates: ' + coord_list);
    
    // Check for potential issues
    if (dest_tile != null && currentTile != null) {
        if (currentTile.x !== dest_tile.x || currentTile.y !== dest_tile.y) {
            console.warn('WARNING: Final tile (' + currentTile.x + ',' + currentTile.y + 
                ') does not match destination (' + dest_tile.x + ',' + dest_tile.y + ')!');
        } else {
            console.log('Path ends correctly at destination.');
        }
    }
    
    console.log('════════════════════════════════════════════════════════════');
    
    return path_tiles;
}

/**
 * Log goto path request information (called when user initiates goto)
 * @param {number} unit_id - The unit ID requesting the path
 * @param {number} dst_x - Destination X coordinate
 * @param {number} dst_y - Destination Y coordinate
 */
function log_webgpu_goto_request(unit_id, dst_x, dst_y) {
    if (!webgpu_debug_enabled) {
        return;
    }
    
    console.log('[WebGPU Debug] Goto path requested: unit_id=' + unit_id + 
        ', destination=(' + dst_x + ', ' + dst_y + ')');
    
    // Log unit info if available
    if (typeof units !== 'undefined' && units[unit_id] != null) {
        var punit = units[unit_id];
        var unit_tile = null;
        if (typeof index_to_tile !== 'undefined') {
            unit_tile = index_to_tile(punit.tile);
        }
        if (unit_tile != null) {
            console.log('[WebGPU Debug] Unit location: (' + unit_tile.x + ', ' + unit_tile.y + ')');
        }
        if (typeof unit_types !== 'undefined' && unit_types[punit.type] != null) {
            console.log('[WebGPU Debug] Unit type: ' + unit_types[punit.type].name);
        }
    }
}

// Make functions available globally for console access
window.toggle_webgpu_debug = toggle_webgpu_debug;
window.refresh_webgpu_debug_labels = refresh_webgpu_debug_labels;
window.log_webgpu_performance = log_webgpu_performance;
window.log_webgpu_debug_tile_info = log_webgpu_debug_tile_info;
window.log_webgpu_goto_path = log_webgpu_goto_path;
window.log_webgpu_goto_request = log_webgpu_goto_request;
window.debug_dir_to_name = debug_dir_to_name;
