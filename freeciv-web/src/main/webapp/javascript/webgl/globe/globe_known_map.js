/**********************************************************************
 FreecivX - the web version of Freeciv. http://www.FreecivX.net/
 Copyright (C) 2009-2025  The Freecivx project

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


var globe_known_texture;
var globe_known_data;

/****************************************************************************
 Initialize globe_known image
 ****************************************************************************/
function init_globe_known_image()
{
    globe_known_data = new Uint8Array( 4 * map.xsize * map.ysize );

    globe_known_texture = new THREE.DataTexture(globe_known_data, map.xsize, map.ysize);
    globe_known_texture.flipY = true;

    for (let x = 0; x < map.xsize; x++) {
        for (let y = 0; y < map.ysize; y++) {
            let index = (y * map.xsize + x) * 4;
            globe_known_data[index] = 0;
            globe_known_data[index + 1] = 0;
            globe_known_data[index + 2] = 0;
            globe_known_data[index + 3] = 0;
        }
    }
}

/****************************************************************************
 ...
 ****************************************************************************/
function update_globe_known_tile(ptile)
{
    let x = ptile.x;
    let y = ptile.y;
    let index = (y * map.xsize + x) * 4;
    let old_value = (globe_known_data[index] + globe_known_data[index + 1] + globe_known_data[index + 2]);

    let color = globe_known_image_color(x, y);
    globe_known_data[index] = color[0];
    globe_known_data[index + 1] = color[1];
    globe_known_data[index + 2] = color[2];

    if ((globe_known_data[index] + globe_known_data[index + 1] + globe_known_data[index + 2] ) != old_value) {
        globe_known_texture.needsUpdate = true;
    }

}

/****************************************************************************
 ...
 ****************************************************************************/
function globe_known_image_color(map_x, map_y)
{
    var ptile = map_pos_to_tile(map_x, map_y);

    if (tile_get_known(ptile) == TILE_KNOWN_SEEN) {
        return [255,0,0];
    } else if (tile_get_known(ptile) == TILE_KNOWN_UNSEEN) {
        return [128,0,0];
    } else if (tile_get_known(ptile) == TILE_UNKNOWN) {
        return [0,0,0];
    }
    return [0,0,0];

}
