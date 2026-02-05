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
 * 
 * Enable via: webgpu_debug_enabled = true (set in pregame settings)
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
        console.log('[WebGPU Debug] Tile coordinates (x:y) will now be rendered on the terrain.');
        webgpu_debug_initialized = false;
        init_webgpu_debug();
    } else {
        console.log('[WebGPU Debug] Debug mode DISABLED');
        console.log('[WebGPU Debug] Tile coordinate display turned off.');
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

// Make functions available globally for console access
window.toggle_webgpu_debug = toggle_webgpu_debug;
window.refresh_webgpu_debug_labels = refresh_webgpu_debug_labels;
window.log_webgpu_performance = log_webgpu_performance;
window.log_webgpu_debug_tile_info = log_webgpu_debug_tile_info;
