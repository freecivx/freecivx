/**********************************************************************
    FreecivX - the 3D web version of Freeciv. http://www.FreecivX.net/
    Copyright (C) 2009-2025  The Freeciv-web project

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



varying vec2 vUv;
varying vec3 vPosition;
uniform sampler2D maptiles, borders, roadsmap, roadsprites, railroadsprites, globe_known;
uniform sampler2D arctic_farmland_irrigation_tundra, grassland, coast, desert, ocean, plains, hills, mountains, swamp;
uniform float map_x_size, map_y_size;
uniform bool borders_visible;
uniform int mouse_x;
uniform int mouse_y;

void main() {
    vec4 terrain_type = texture(maptiles, vUv);
    vec4 border_color = borders_visible ? texture(borders, vUv) : vec4(0);
    vec3 color;
    vec2 dxdy = vec2(mod(map_x_size * vUv.x, 1.0), mod(map_y_size * vUv.y, 1.0));
    vec2 tdxdy = vec2(
    (map_x_size * vUv.x / 2.0) - 0.5 * floor(map_x_size * vUv.x),
    (map_y_size * vUv.y / 2.0) - 0.5 * floor(map_y_size * vUv.y));
    float shade_factor = 1.4;

    if (texture(globe_known, vUv).r == 0.0) {
        gl_FragColor = vec4(0.1, 0.1, 0.15, 1.0);
        return;
    } else if (abs(texture(globe_known, vUv).r - 0.5) < 0.01) {
        shade_factor *= 0.6;
    }

    float terrain_here = floor(terrain_type.r * 256.0);
    if (terrain_here == 70.0) color = texture(grassland, dxdy).rgb;
    else if (terrain_here == 110.0) color = texture(plains, dxdy).rgb;
    else if (terrain_here == 20.0) color = texture(coast, dxdy).rgb;
    else if (terrain_here == 30.0) color = texture(ocean, dxdy).rgb;
    else if (terrain_here == 40.0) color = texture(arctic_farmland_irrigation_tundra, vec2(tdxdy.x, tdxdy.y + 0.5)).rgb;
    else if (terrain_here == 50.0) color = texture(desert, dxdy).rgb;
    else if (terrain_here == 80.0) color = texture(hills, dxdy).rgb;
    else if (terrain_here == 100.0) color = texture(mountains, dxdy).rgb;
    else if (terrain_here == 120.0) color = texture(swamp, dxdy).rgb;
    else color = texture(plains, dxdy).rgb;


    if (mouse_x >= 0 && mouse_y >= 0 && mouse_x == int(floor(map_x_size * (1.0 - vUv.x))) && mouse_y == int(floor(map_y_size * (1.05 - vUv.y)))) {
        shade_factor += 0.7;
    }


    if (borders_visible && !(border_color.r > 0.546875 && border_color.r < 0.5625 && border_color.b == 0.0 && border_color.g == 0.0)) {
        vec4 border_e = texture(borders, vec2(vUv.x + (0.06 / map_x_size), vUv.y));
        vec4 border_w = texture(borders, vec2(vUv.x - (0.06 / map_x_size), vUv.y));
        vec4 border_n = texture(borders, vec2(vUv.x, vUv.y + (0.06 / map_x_size)));
        vec4 border_s = texture(borders, vec2(vUv.x, vUv.y - (0.06 / map_x_size)));

        bool is_different_border =
        border_n.rgb != border_color.rgb ||
        border_s.rgb != border_color.rgb ||
        border_e.rgb != border_color.rgb ||
        border_w.rgb != border_color.rgb;

        if (is_different_border) {
            float dot_pattern = step(0.5, mod(vUv.x * 1000.0 + vUv.y * 1000.0, 3.0)); // Increased frequency for clarity
            if (dot_pattern > 0.5) {
                color = mix(color, border_color.rgb, 0.75); // Make borders more distinct
            }
        } else {
            color = mix(color, border_color.rgb, 0.10);
        }
    }

    gl_FragColor = vec4(color * shade_factor, 1.0);
}