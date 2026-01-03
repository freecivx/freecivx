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
 ****************************************************************************/
function webgl_render_goto_line(start_tile, goto_packet_dir) {
    clear_goto_tiles();
    if (!goto_active) return;

    var ptile = start_tile;

    const material = new THREE.MeshBasicMaterial({
        color: 0x55c0ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8, // Slight transparency
    });

    const lineWidth = 1.0; // Slightly thinner lines
    const heightOffset = 10.0; // Raise the lines higher in the y-direction
    const leftOffset = -5.0; // Move the lines slightly to the left

    for (var i = 0; i < goto_packet_dir.length; i++) {
        if (ptile == null) break;
        var dir = goto_packet_dir[i];

        if (dir == -1) {
            /* Assume that this means refuel. */
            continue;
        }

        var nexttile = mapstep(ptile, dir);
        if (nexttile != null) {
            var currpos = map_to_scene_coords(ptile['x'], ptile['y']);
            var nextpos = map_to_scene_coords(nexttile['x'], nexttile['y']);
            var height = 5 + ptile['height'] * 100;

            // Apply left offset and height adjustment
            var start = new THREE.Vector3(currpos.x + leftOffset, height + heightOffset, currpos.y);
            var end = new THREE.Vector3(
                nextpos.x + leftOffset,
                height + heightOffset + (nexttile['height'] - ptile['height']) * 50,
                nextpos.y
            );

            var direction = new THREE.Vector3().subVectors(end, start).normalize();
            var perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize().multiplyScalar(lineWidth);

            var vertices = [
                start.clone().add(perpendicular),
                start.clone().sub(perpendicular),
                end.clone().add(perpendicular),
                end.clone().sub(perpendicular),
            ];

            // Create geometry for the quad
            const geometry = new THREE.BufferGeometry();
            const position = new Float32Array([
                vertices[0].x, vertices[0].y, vertices[0].z, // Top left
                vertices[1].x, vertices[1].y, vertices[1].z, // Bottom left
                vertices[2].x, vertices[2].y, vertices[2].z, // Top right

                vertices[1].x, vertices[1].y, vertices[1].z, // Bottom left
                vertices[3].x, vertices[3].y, vertices[3].z, // Bottom right
                vertices[2].x, vertices[2].y, vertices[2].z, // Top right
            ]);
            geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));

            // Create the mesh and add to the scene
            const gotoline = new THREE.Mesh(geometry, material);
            scene.add(gotoline);
            goto_lines.push(gotoline);
        }

        ptile = mapstep(ptile, dir);
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