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

var goto_lines = [];

// Minimum horizontal distance threshold for direction calculations
var GOTO_MIN_HORIZ_DIST = 0.001;

/****************************************************************************
 Computes the 3D scene position for the center of a given tile.
 This directly calculates the center without relying on global offset variables.
 
 @param {Object} tile - The tile object with x, y, and height properties
 @param {number} heightOffset - Additional height to add above the terrain
 @returns {THREE.Vector3} - The 3D position at the tile's center
 ****************************************************************************/
function compute_tile_center_3d(tile, heightOffset) {
    if (tile == null || typeof map === 'undefined') return null;
    
    // Get tile dimensions from map
    var tileW = mapview_model_width / map['xsize'];
    var tileH = (mapview_model_height / map['ysize']) * HEX_HEIGHT_FACTOR;
    
    // Compute half-tile offsets for centering
    var halfTileW = tileW * 0.5;
    var halfTileH = tileH * 0.5;
    
    // Get corner position from standard conversion
    var cornerPos = map_to_scene_coords(tile['x'], tile['y']);
    
    // Compute center by adding half-tile offsets
    var centerX = cornerPos['x'] + halfTileW;
    var centerZ = cornerPos['y'] + halfTileH;
    
    // Compute Y (height) based on terrain elevation
    var terrainY = 5 + tile['height'] * 100 + heightOffset;
    
    return new THREE.Vector3(centerX, terrainY, centerZ);
}

/****************************************************************************
 Creates a ribbon segment (quad) between two 3D points.
 
 @param {THREE.Vector3} pointA - Start point
 @param {THREE.Vector3} pointB - End point  
 @param {number} ribbonWidth - Half-width of the ribbon
 @returns {Float32Array} - Vertex positions for two triangles forming the quad
 ****************************************************************************/
function build_ribbon_segment(pointA, pointB, ribbonWidth) {
    // Compute horizontal direction vector (ignoring Y)
    var horizDirX = pointB.x - pointA.x;
    var horizDirZ = pointB.z - pointA.z;
    var horizLen = Math.sqrt(horizDirX * horizDirX + horizDirZ * horizDirZ);
    
    // Compute perpendicular vector in XZ plane for ribbon width
    var perpX, perpZ;
    if (horizLen > GOTO_MIN_HORIZ_DIST) {
        // Normalize and rotate 90 degrees: (dx, dz) -> (-dz, dx)
        perpX = (-horizDirZ / horizLen) * ribbonWidth;
        perpZ = (horizDirX / horizLen) * ribbonWidth;
    } else {
        // Fallback for vertical-only movement
        perpX = ribbonWidth;
        perpZ = 0;
    }
    
    // Build four corner vertices of the quad
    var v0x = pointA.x + perpX, v0y = pointA.y, v0z = pointA.z + perpZ;
    var v1x = pointA.x - perpX, v1y = pointA.y, v1z = pointA.z - perpZ;
    var v2x = pointB.x + perpX, v2y = pointB.y, v2z = pointB.z + perpZ;
    var v3x = pointB.x - perpX, v3y = pointB.y, v3z = pointB.z - perpZ;
    
    // Return vertices for two triangles: (v0,v1,v2) and (v1,v3,v2)
    return new Float32Array([
        v0x, v0y, v0z,
        v1x, v1y, v1z,
        v2x, v2y, v2z,
        v1x, v1y, v1z,
        v3x, v3y, v3z,
        v2x, v2y, v2z
    ]);
}

/****************************************************************************
 Renders goto path as a series of ribbon segments connecting tile centers.
 ****************************************************************************/
function webgl_render_goto_line(start_tile, goto_packet_dir) {
    clear_goto_tiles();
    if (!goto_active) return;

    var currentTile = start_tile;
    
    // Visual parameters
    var ribbonWidth = 1.5;
    var elevationBoost = 12.0;

    // Shared material for all segments
    var ribbonMaterial = new THREE.MeshBasicMaterial({
        color: 0x55c0ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        depthTest: true,
        depthWrite: false
    });

    // Iterate through each direction in the path
    for (var stepIdx = 0; stepIdx < goto_packet_dir.length; stepIdx++) {
        if (currentTile == null) break;
        
        var moveDir = goto_packet_dir[stepIdx];
        
        // Skip refuel markers
        if (moveDir == -1) {
            continue;
        }

        var targetTile = mapstep(currentTile, moveDir);
        if (targetTile != null) {
            // Compute 3D center positions for both tiles
            var startPos3D = compute_tile_center_3d(currentTile, elevationBoost);
            var endPos3D = compute_tile_center_3d(targetTile, elevationBoost);
            
            if (startPos3D != null && endPos3D != null) {
                // Build ribbon geometry between the two points
                var ribbonVerts = build_ribbon_segment(startPos3D, endPos3D, ribbonWidth);
                
                var ribbonGeom = new THREE.BufferGeometry();
                ribbonGeom.setAttribute('position', new THREE.BufferAttribute(ribbonVerts, 3));
                
                var ribbonMesh = new THREE.Mesh(ribbonGeom, ribbonMaterial);
                ribbonMesh.name = "goto_path_segment";
                
                scene.add(ribbonMesh);
                goto_lines.push(ribbonMesh);
            }
        }

        // Advance to next tile in path
        currentTile = targetTile;
    }
}



/**************************************************************************
 Removes goto lines and clears goto tiles.
**************************************************************************/
function clear_goto_tiles()
{
  if (scene != null && goto_lines != null) {
    for (var i = 0; i < goto_lines.length; i++) {
      scene.remove(goto_lines[i]);
    }
    goto_lines = [];
  }
}