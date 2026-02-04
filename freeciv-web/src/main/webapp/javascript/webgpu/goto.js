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

/****************************************************************************
 Renders a goto line by creating thick quads along the goto path.
 Uses tile center positions based on proper hex coordinate conversion.
 ****************************************************************************/
function webgl_render_goto_line(start_tile, goto_packet_dir) {
    clear_goto_tiles();
    if (!goto_active) return;

    var ptile = start_tile;

    const material = new THREE.MeshBasicMaterial({
        color: 0x55c0ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        depthTest: true,
        depthWrite: false, // Prevent z-fighting issues
    });

    const lineWidth = 1.5; // Line thickness
    const heightOffset = 12.0; // Raise the lines higher in the y-direction for visibility

    for (var i = 0; i < goto_packet_dir.length; i++) {
        if (ptile == null) break;
        var dir = goto_packet_dir[i];

        if (dir == -1) {
            /* Assume that this means refuel. */
            continue;
        }

        var nexttile = mapstep(ptile, dir);
        if (nexttile != null) {
            // Get scene positions for current and next tile
            var currpos = map_to_scene_coords(ptile['x'], ptile['y']);
            var nextpos = map_to_scene_coords(nexttile['x'], nexttile['y']);
            
            // Calculate heights for start and end points
            var startHeight = 5 + ptile['height'] * 100 + heightOffset;
            var endHeight = 5 + nexttile['height'] * 100 + heightOffset;

            // Create start and end vectors at tile centers
            // Note: currpos.x maps to THREE.js X, currpos.y maps to THREE.js Z
            var start = new THREE.Vector3(
                currpos.x + HEX_CENTER_OFFSET_X, 
                startHeight, 
                currpos.y + HEX_CENTER_OFFSET_Y
            );
            var end = new THREE.Vector3(
                nextpos.x + HEX_CENTER_OFFSET_X,
                endHeight,
                nextpos.y + HEX_CENTER_OFFSET_Y
            );

            // Calculate direction vector from start to end
            var direction = new THREE.Vector3().subVectors(end, start);
            var directionXZ = new THREE.Vector3(direction.x, 0, direction.z);
            
            // Calculate perpendicular in XZ plane for line width
            // Rotate direction 90 degrees in XZ plane: (x, z) -> (-z, x)
            var perpendicular;
            var directionXZLength = directionXZ.length();
            
            // Handle edge case where direction is purely vertical (no horizontal component)
            if (directionXZLength < 0.001) {
                // For purely vertical movement, use arbitrary horizontal direction
                perpendicular = new THREE.Vector3(lineWidth, 0, 0);
            } else {
                directionXZ.divideScalar(directionXZLength); // Normalize
                perpendicular = new THREE.Vector3(-directionXZ.z, 0, directionXZ.x).multiplyScalar(lineWidth);
            }

            // Create quad vertices
            var vertices = [
                start.clone().add(perpendicular),  // 0: start left
                start.clone().sub(perpendicular),  // 1: start right
                end.clone().add(perpendicular),    // 2: end left
                end.clone().sub(perpendicular),    // 3: end right
            ];

            // Create geometry for the quad (two triangles)
            const geometry = new THREE.BufferGeometry();
            geometry.name = "goto_line_geometry";
            const position = new Float32Array([
                // First triangle: 0, 1, 2
                vertices[0].x, vertices[0].y, vertices[0].z,
                vertices[1].x, vertices[1].y, vertices[1].z,
                vertices[2].x, vertices[2].y, vertices[2].z,
                // Second triangle: 1, 3, 2
                vertices[1].x, vertices[1].y, vertices[1].z,
                vertices[3].x, vertices[3].y, vertices[3].z,
                vertices[2].x, vertices[2].y, vertices[2].z,
            ]);
            geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));

            // Create the mesh and add to the scene
            const gotoline = new THREE.Mesh(geometry, material);
            gotoline.name = "goto_line";
            scene.add(gotoline);
            goto_lines.push(gotoline);
        }

        // Move to next tile in the path
        ptile = nexttile;
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