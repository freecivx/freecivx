/**********************************************************************
    FreecivX - the 3D web version of Freeciv. http://www.FreecivX.net/
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

precision highp float;

in vec3 vNormal;
in vec3 vColor;
in vec2 vUv;
in vec3 vPosition;
in vec3 vPosition_camera;

uniform sampler2D maptiles;
uniform sampler2D borders;
uniform sampler2D roadsmap;
uniform sampler2D roadsprites;
uniform sampler2D railroadsprites;

uniform sampler2D arctic_farmland_irrigation_tundra;
uniform sampler2D grassland;
uniform sampler2D coast;
uniform sampler2D desert;
uniform sampler2D ocean; //floor
uniform sampler2D plains;
uniform sampler2D hills;
uniform sampler2D mountains;
uniform sampler2D swamp;
// Some systems only support 16 textures.

uniform float map_x_size;
uniform float map_y_size;

uniform int mouse_x;
uniform int mouse_y;

uniform int selected_x;
uniform int selected_y;

uniform bool borders_visible;

float terrain_inaccessible = 0.0;
float terrain_lake = 10.0;
float terrain_coast = 20.0;
float terrain_floor = 30.0;
float terrain_arctic = 40.0;
float terrain_desert = 50.0;
float terrain_forest = 60.0;
float terrain_grassland = 70.0;
float terrain_hills = 80.0;
float terrain_jungle = 90.0;
float terrain_mountains = 100.0;
float terrain_plains = 110.0;
float terrain_swamp = 120.0;
float terrain_tundra = 130.0;

float is_river_modifier = 10.0 / 255.0;

// roads
float roadtype_1 = 1.0;
float roadtype_2 = 2.0;
float roadtype_3 = 3.0;
float roadtype_4 = 4.0;
float roadtype_5 = 5.0;
float roadtype_6 = 6.0;
float roadtype_7 = 7.0;
float roadtype_8 = 8.0;
float roadtype_9 = 9.0;
float roadtype_all = 42.0;

// railroads
float roadtype_10 = 10.0;
float roadtype_11 = 11.0;
float roadtype_12 = 12.0;
float roadtype_13 = 13.0;
float roadtype_14 = 14.0;
float roadtype_15 = 15.0;
float roadtype_16 = 16.0;
float roadtype_17 = 17.0;
float roadtype_18 = 18.0;
float roadtype_19 = 19.0;
float railtype_all = 43.0;

float beach_high = 50.9;
float beach_blend_high = 50.4;
float beach_blend_low = 49.8;
float beach_low = 48.0;
float blend_amount = 0.0;

float mountains_low_begin = 74.0;
float mountains_low_end = 74.5;
float mountains_high = 75.10;

vec3 light = vec3(0.8, 0.6, 0.7);

vec2 texture_coord;

float dx = 0.0;
float dy = 0.0;

float mdx = 0.0;
float mdy = 0.0;
float tdx = 0.0;
float tdy = 0.0;

float terrain_here;
float road_here_r;
float road_here_g;
float road_here_b;

float sprite_pos0_x = 0.0;
float sprite_pos0_y = 0.75;
float sprite_pos1_x = 0.25;
float sprite_pos1_y = 0.75;
float sprite_pos2_x = 0.5;
float sprite_pos2_y = 0.75;
float sprite_pos3_x = 0.75;
float sprite_pos3_y = 0.75;
float sprite_pos4_x = 0.0;
float sprite_pos4_y = 0.5;
float sprite_pos5_x = 0.25;
float sprite_pos5_y = 0.5;
float sprite_pos6_x = 0.5;
float sprite_pos6_y = 0.5;
float sprite_pos7_x = 0.75;
float sprite_pos7_y = 0.5;
float sprite_pos8_x = 0.0;
float sprite_pos8_y = 0.25;
float sprite_pos9_x = 0.25;
float sprite_pos9_y = 0.25;
float sprite_pos10_x = 0.5;
float sprite_pos10_y = 0.25;
float sprite_pos11_x = 0.75;
float sprite_pos11_y = 0.25;
float sprite_pos12_x = 0.0;
float sprite_pos12_y = 0.0;
float sprite_pos13_x = 0.25;
float sprite_pos13_y = 0.0;
float sprite_pos14_x = 0.5;
float sprite_pos14_y = 0.0;
float sprite_pos15_x = 0.75;
float sprite_pos15_y = 0.0;

vec4 border_e;
vec4 border_w;
vec4 border_n;
vec4 border_s;

out vec4 fragColor;

void main()
{

    if (vColor.r == 0.0) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);

        if (mouse_x >= 0 && mouse_y >= 0 && mouse_x == int(floor((map_x_size * vUv.x ))) && mouse_y == int(floor((map_y_size * (1.0 - vUv.y) )))) {
            fragColor.rgba = vec4(0.3, 0.3, 0.3, 1.0);
        }
        if ( (fract((vPosition.x + 502.0) / 35.71) < 0.028 || fract((vPosition.z + 2.0) / 35.71) < 0.028)) {
            fragColor.rgba = vec4(0.03, 0.03, 0.03, 1.0);
        }

        return;
    }

    float rnd = fract(sin(dot(vUv, vec2(12.98, 78.233))) * 43758.5453);
    vec2 rndOffset = (vec2(rnd) - 0.5) / (8.0 * vec2(map_x_size, map_y_size));
    vec4 terrain_type = texture(maptiles, vUv + rndOffset);
    vec4 border_color = borders_visible ? texture(borders, vUv) : vec4(0);
    vec4 road_type = texture(roadsmap, vec2(vUv.x, vUv.y));

    vec3 c;
    vec4 terrain_color;

    if (terrain_type.g == is_river_modifier) {
        beach_high = 50.45;
        beach_blend_high = 50.20;
    }

    dx = mod(map_x_size * vUv.x, 1.0);
    dy = mod(map_y_size * vUv.y, 1.0);
    mdx = (map_x_size * vUv.x / 4.0) - 0.25 * floor((map_x_size * vUv.x ));
    mdy = (map_y_size * vUv.y / 4.0) - 0.25 * floor((map_y_size * vUv.y ));
    tdx = (map_x_size * vUv.x / 2.0) - 0.5 * floor((map_x_size * vUv.x ));
    tdy = (map_y_size * vUv.y / 2.0) - 0.5 * floor((map_y_size * vUv.y ));

    // Set pixel color based on tile type.
    terrain_here = floor(terrain_type.r  * 256.0);
    if (terrain_here == terrain_grassland) {
      if (vPosition.y > beach_blend_high ) {
        texture_coord = vec2(dx , dy);
          terrain_color = texture(grassland, texture_coord);
      } else {
          texture_coord = vec2(dx  , dy);
          terrain_color = texture(coast, texture_coord);
      }
    } else if (terrain_here == terrain_plains) {
      if (vPosition.y > beach_blend_high ) {
          texture_coord = vec2(dx , dy);
          terrain_color = texture(plains, texture_coord);
      } else {
          texture_coord = vec2(dx , dy);
          terrain_color = texture(coast, texture_coord);
      }
    } else if (terrain_here == terrain_lake) {
        if (vPosition.y < beach_blend_high ) {
            texture_coord = vec2(dx  , dy );
            terrain_color = texture(coast, texture_coord);
        } else {
            texture_coord = vec2(dx , dy);
            terrain_color = texture(plains, texture_coord);
        }
    } else if (terrain_here == terrain_coast) {
        if (vPosition.y < beach_blend_high ) {
            texture_coord = vec2(dx , dy );
            terrain_color = texture(coast, texture_coord);
            if ((fract((vPosition.x + 502.0) / 35.71) < 0.018 || fract((vPosition.z + 2.0) / 35.71) < 0.018)) {
                terrain_color.rgb = terrain_color.rgb * 1.45;  // render tile grid.
            }

        } else {
            texture_coord = vec2(dx , dy);
            terrain_color = texture(plains, texture_coord);
        }
    } else if (terrain_here == terrain_floor) {
        if (vPosition.y < beach_blend_high ) {
            texture_coord = vec2(dx , dy);
            terrain_color = texture(ocean, texture_coord);
            if ((fract((vPosition.x + 502.0) / 35.71) < 0.018 || fract((vPosition.z + 2.0) / 35.71) < 0.018)) {
                terrain_color.rgb = terrain_color.rgb * 1.7;  // render tile grid.
            }
        } else {
            texture_coord = vec2(dx  , dy );
            terrain_color = texture(plains, texture_coord);
        }
    } else if (terrain_here == terrain_arctic) {
        texture_coord = vec2(tdx, tdy + 0.5);
        terrain_color = texture(arctic_farmland_irrigation_tundra, texture_coord);
    } else if (terrain_here == terrain_desert) {
        if (vPosition.y > beach_blend_high ) {
            texture_coord = vec2(dx , dy);
            terrain_color = texture(desert, texture_coord);
        } else {
            texture_coord = vec2(dx , dy);
            terrain_color = texture(coast, texture_coord);
        }
    } else if (terrain_here == terrain_forest) {
        if (vPosition.y > beach_blend_high ) {
            texture_coord = vec2(dx , dy);
            terrain_color = texture(grassland, texture_coord);
        } else {
            texture_coord = vec2(dx  , dy );
            terrain_color = texture(coast, texture_coord);
        }
    } else if (terrain_here == terrain_hills) {
        if (vPosition.y > beach_blend_high ) {
            texture_coord = vec2(dx  , dy );
            terrain_color = texture(hills, texture_coord);
        } else {
            texture_coord = vec2(dx , dy);
            terrain_color = texture(coast, texture_coord);
        }
    } else if (terrain_here == terrain_jungle) {
        if (vPosition.y > beach_blend_high ) {
            texture_coord = vec2(dx  , dy );
            terrain_color = texture(plains, texture_coord);
        } else {
            texture_coord = vec2(dx , dy );
            terrain_color = texture(coast, texture_coord);
        }
    } else if (terrain_here == terrain_mountains) {
        if (vPosition.y > beach_blend_high ) {
            texture_coord = vec2(dx  , dy );
            terrain_color = texture(mountains, texture_coord);
        } else {
            texture_coord = vec2(dx  , dy );
            terrain_color = texture(coast, texture_coord);
        }
    } else if (terrain_here == terrain_swamp) {
        if (vPosition.y > beach_blend_high ) {
            texture_coord = vec2(dx  , dy );
            terrain_color = texture(swamp, texture_coord);
        } else {
            texture_coord = vec2(dx  , dy );
            terrain_color = texture(coast, texture_coord);
        }
    } else if (terrain_here == terrain_tundra) {
        if (vPosition.y > beach_blend_high ) {
            texture_coord = vec2(tdx + 0.5 , tdy );
            terrain_color = texture(arctic_farmland_irrigation_tundra, texture_coord);
        } else {
            texture_coord = vec2(dx  , dy );
            terrain_color = texture(coast, texture_coord);
        }
    } else {
        if (vPosition.y > beach_blend_high ) {
            texture_coord = vec2(dx , dy ) * 2.0;
            terrain_color = texture(plains, texture_coord);
        } else {
            texture_coord = vec2(dx , dy );
            terrain_color = texture(coast, texture_coord);
        }
    }

    c = terrain_color.rgb;

    if (vPosition.y > mountains_high) {
        // snow in mountains texture over a certain height threshold.
        blend_amount = ((3.0 - (mountains_high - vPosition.y)) / 3.0) - 1.0;

        vec4 Ca = texture(arctic_farmland_irrigation_tundra, vec2(tdx, tdy + 0.5));
        vec4 Cb = texture(mountains, vec2(dx , dy));
        c = mix(Ca.rgb, Cb.rgb, (1.0 - blend_amount));
    } else if (vPosition.y > mountains_low_begin) {
        if (vPosition.y < mountains_low_end) {
            vec4 Cmountain = texture(mountains, vec2(dx , dy));
            c = mix(terrain_color.rgb, Cmountain.rgb, smoothstep(mountains_low_begin, mountains_low_end, vPosition.y));
        } else {
            // mountain texture over a certain height threshold.
            vec4 Cb = texture(mountains, vec2(dx , dy));
            c = Cb.rgb;
        }
    }


    if ( (fract((vPosition.x + 502.0) / 35.71) < 0.018 || fract((vPosition.z + 2.0) / 35.71) < 0.018)) {
        c = c - 0.085;  // render tile grid.
    }


    // render the beach.
    if (vPosition.y < beach_high && vPosition.y > beach_low && terrain_here != terrain_arctic) {
        texture_coord = vec2(dx , dy);
        if (vPosition.y > beach_blend_high) {
            blend_amount = ((beach_high - beach_blend_high) - (beach_high - vPosition.y)) / (beach_high - beach_blend_high);
            vec4 Cbeach = texture(desert, texture_coord) * 1.4;
            c = mix(terrain_color.rgb, Cbeach.rgb, (1.0 - blend_amount));
        } else if (terrain_type.g == is_river_modifier) {
            vec4 Cbeach = texture(coast, texture_coord);
            c = Cbeach.rgb * 2.4;
        } else if (vPosition.y < beach_blend_low) {
            blend_amount = (beach_blend_low - vPosition.y) / 2.0;
            vec4 Cbeach = texture(coast, texture_coord) * 3.5;
            c = mix(terrain_color.rgb, Cbeach.rgb, (1.0 - blend_amount));

        } else {
            vec4 Cbeach = texture(desert, texture_coord);
            c = Cbeach.rgb * 1.38;
        }
    }

    if (terrain_type.b == (1.0 / 255.0)) {
        // render Irrigation.
        texture_coord = vec2(tdx, tdy);
        vec4 t1 = texture(arctic_farmland_irrigation_tundra , texture_coord);
        c = mix(c, vec3(t1), t1.a);
    } else if (terrain_type.b ==(2.0 / 255.0)) {
        // render farmland.
        texture_coord = vec2(tdx + 0.5, tdy + 0.5);
        vec4 t1 = texture(arctic_farmland_irrigation_tundra, texture_coord);
        c = mix(c, vec3(t1), t1.a);
    }

    // Roads
    road_here_r = floor(road_type.r * 256.0);
    road_here_g = floor(road_type.g * 256.0);
    road_here_b = floor(road_type.b * 256.0);
    if (road_here_r == 0.0 || vPosition.y < beach_blend_low) {
        // no roads
    } else if (road_here_r == roadtype_1 && road_here_g == 0.0 &&  road_here_b == 0.0) {
        // a single road tile.
        texture_coord = vec2(mdx + sprite_pos0_x , mdy + sprite_pos0_y);
        vec4 t1 = texture(roadsprites, texture_coord);
        c = mix(c, vec3(t1), t1.a);
    } else if (road_here_r == roadtype_all) {
        // a road tile with 4 connecting roads.
        texture_coord = vec2(mdx + sprite_pos1_x , mdy + sprite_pos1_y);
        vec4 t1 = texture(roadsprites, texture_coord);
        c = mix(c, vec3(t1), t1.a);
        texture_coord = vec2(mdx + sprite_pos3_x , mdy + sprite_pos3_y);
        t1 = texture(roadsprites, texture_coord);
        c = mix(c, vec3(t1), t1.a);
        texture_coord = vec2(mdx + sprite_pos5_x , mdy + sprite_pos5_y);
        t1 = texture(roadsprites, texture_coord);
        c = mix(c, vec3(t1), t1.a);
        texture_coord = vec2(mdx + sprite_pos7_x , mdy + sprite_pos7_y);
        t1 = texture(roadsprites, texture_coord);
        c = mix(c, vec3(t1), t1.a);
    } else if (road_here_r == railtype_all) {
        // a rail tile with 4 connecting rails.
        texture_coord = vec2(mdx + sprite_pos1_x , mdy + sprite_pos1_y);
        vec4 t1 = texture(railroadsprites, texture_coord);
        c = mix(c, vec3(t1), t1.a);
        texture_coord = vec2(mdx + sprite_pos3_x , mdy + sprite_pos3_y);
        t1 = texture(railroadsprites, texture_coord);
        c = mix(c, vec3(t1), t1.a);
        texture_coord = vec2(mdx + sprite_pos5_x , mdy + sprite_pos5_y);
        t1 = texture(railroadsprites, texture_coord);
        c = mix(c, vec3(t1), t1.a);
        texture_coord = vec2(mdx + sprite_pos7_x , mdy + sprite_pos7_y);
        t1 = texture(railroadsprites, texture_coord);
        c = mix(c, vec3(t1), t1.a);
    } else if (road_here_r > 0.0 && road_here_r < roadtype_10) {
        // Roads
        if (road_here_r == roadtype_2 || road_here_g == roadtype_2 || road_here_b == roadtype_2) {
            texture_coord = vec2(mdx + sprite_pos1_x , mdy + sprite_pos1_y);
            vec4 t1 = texture(roadsprites, texture_coord);
            c = mix(c, vec3(t1), t1.a);
        }
        if (road_here_r == roadtype_3 || road_here_g == roadtype_3 || road_here_b == roadtype_3) {
            texture_coord = vec2(mdx + sprite_pos2_x , mdy + sprite_pos2_y);
            vec4 t1 = texture(roadsprites, texture_coord);
            c = mix(c, vec3(t1), t1.a);
        }
        if (road_here_r == roadtype_4 || road_here_g == roadtype_4 || road_here_b == roadtype_4) {
            texture_coord = vec2(mdx + sprite_pos3_x , mdy + sprite_pos3_y);
            vec4 t1 = texture(roadsprites, texture_coord);
            c = mix(c, vec3(t1), t1.a);
        }
        if (road_here_r == roadtype_5 || road_here_g == roadtype_5 || road_here_b == roadtype_5) {
            texture_coord = vec2(mdx + sprite_pos4_x , mdy + sprite_pos4_y);
            vec4 t1 = texture(roadsprites, texture_coord);
            c = mix(c, vec3(t1), t1.a);
        }
        if (road_here_r == roadtype_6 || road_here_g == roadtype_6 || road_here_b == roadtype_6) {
            texture_coord = vec2(mdx + sprite_pos5_x , mdy + sprite_pos5_y);
            vec4 t1 = texture(roadsprites, texture_coord);
            c = mix(c, vec3(t1), t1.a);
        }
        if (road_here_r == roadtype_7 || road_here_g == roadtype_7 || road_here_b == roadtype_7) {
            texture_coord = vec2(mdx + sprite_pos6_x , mdy + sprite_pos6_y);
            vec4 t1 = texture(roadsprites, texture_coord);
            c = mix(c, vec3(t1), t1.a);
        }
        if (road_here_r == roadtype_8 || road_here_g == roadtype_8 || road_here_b == roadtype_8) {
            texture_coord = vec2(mdx + sprite_pos7_x , mdy + sprite_pos7_y);
            vec4 t1 = texture(roadsprites, texture_coord);
            c = mix(c, vec3(t1), t1.a);
        }
        if (road_here_r == roadtype_9 || road_here_g == roadtype_9 || road_here_b == roadtype_9) {
            texture_coord = vec2(mdx + sprite_pos8_x , mdy + sprite_pos8_y);
            vec4 t1 = texture(roadsprites, texture_coord);
            c = mix(c, vec3(t1), t1.a);
        }
    } else if (road_here_r >= roadtype_10 && road_here_r < roadtype_all) {
        // Railroads
        if (road_here_r == roadtype_10 && road_here_g == 0.0 &&  road_here_b == 0.0) {
            texture_coord = vec2(mdx + sprite_pos0_x , mdy + sprite_pos0_y);
            vec4 t1 = texture(railroadsprites, texture_coord);
            c = mix(c, vec3(t1), t1.a);
        }
        if (road_here_r == roadtype_12 || road_here_g == roadtype_12 || road_here_b == roadtype_12) {
            texture_coord = vec2(mdx + sprite_pos1_x , mdy + sprite_pos1_y);
            vec4 t1 = texture(railroadsprites, texture_coord);
            c = mix(c, vec3(t1), t1.a);
        }
        if (road_here_r == roadtype_13 || road_here_g == roadtype_13 || road_here_b == roadtype_13) {
            texture_coord = vec2(mdx + sprite_pos2_x , mdy + sprite_pos2_y);
            vec4 t1 = texture(railroadsprites, texture_coord);
            c = mix(c, vec3(t1), t1.a);
        }
        if (road_here_r == roadtype_14 || road_here_g == roadtype_14 || road_here_b == roadtype_14) {
            texture_coord = vec2(mdx + sprite_pos3_x , mdy + sprite_pos3_y);
            vec4 t1 = texture(railroadsprites, texture_coord);
            c = mix(c, vec3(t1), t1.a);
        }
        if (road_here_r == roadtype_15 || road_here_g == roadtype_15 || road_here_b == roadtype_15) {
            texture_coord = vec2(mdx + sprite_pos4_x , mdy + sprite_pos4_y);
            vec4 t1 = texture(railroadsprites, texture_coord);
            c = mix(c, vec3(t1), t1.a);
        }
        if (road_here_r == roadtype_16 || road_here_g == roadtype_16 || road_here_b == roadtype_16) {
            texture_coord = vec2(mdx + sprite_pos5_x , mdy + sprite_pos5_y);
            vec4 t1 = texture(railroadsprites, texture_coord);
            c = mix(c, vec3(t1), t1.a);
        }
        if (road_here_r == roadtype_17 || road_here_g == roadtype_17 || road_here_b == roadtype_17) {
            texture_coord = vec2(mdx + sprite_pos6_x , mdy + sprite_pos6_y);
            vec4 t1 = texture(railroadsprites, texture_coord);
            c = mix(c, vec3(t1), t1.a);
        }
        if (road_here_r == roadtype_18 || road_here_g == roadtype_18 || road_here_b == roadtype_18) {
            texture_coord = vec2(mdx + sprite_pos7_x , mdy + sprite_pos7_y);
            vec4 t1 = texture(railroadsprites, texture_coord);
            c = mix(c, vec3(t1), t1.a);
        }
        if (road_here_r == roadtype_19 || road_here_g == roadtype_19 || road_here_b == roadtype_19) {
            texture_coord = vec2(mdx + sprite_pos8_x , mdy + sprite_pos8_y);
            vec4 t1 = texture(railroadsprites, texture_coord);
            c = mix(c, vec3(t1), t1.a);
        }
    }

    // Borders
    if (borders_visible && !(border_color.r > 0.546875 && border_color.r < 0.5625 && border_color.b == 0.0 && border_color.g == 0.0)) {
        border_e = texture(borders, vec2(vUv.x + (0.06 / map_x_size), vUv.y));
        border_w = texture(borders, vec2(vUv.x - (0.06 / map_x_size), vUv.y));
        border_n = texture(borders, vec2(vUv.x, vUv.y + (0.06 / map_x_size)));
        border_s = texture(borders, vec2(vUv.x, vUv.y - (0.06 / map_x_size)));

        bool is_different_border =
        border_n.r != border_color.r || border_n.g != border_color.g || border_n.b != border_color.b ||
        border_s.r != border_color.r || border_s.g != border_color.g || border_s.b != border_color.b ||
        border_e.r != border_color.r || border_e.g != border_color.g || border_e.b != border_color.b ||
        border_w.r != border_color.r || border_w.g != border_color.g || border_w.b != border_color.b;

        if (is_different_border) {
            // Apply dotted pattern with twice the frequency
            float dot_pattern = step(0.5, mod(vUv.x * 1000.0 + vUv.y * 1000.0, 4.0)); // Increase scaling to 1000.0 for higher frequency
            if (dot_pattern > 0.5) {
                c = border_color.rgb; // Render border color for dots
            }
        } else if (vPosition_camera.z > 1000.0) {
            c = mix(c, border_color.rgb, 0.70);
        } else {
            c = mix(c, border_color.rgb, 0.10);
        }
    }

    // specular component, ambient occlusion and fade out underwater terrain
    float x = 1.0 - clamp((vPosition.y - 38.) / 15., 0., 1.);
    vec4 Cb = texture(coast, vec2(dx  , dy)) * 0.5;
    c = mix(c, Cb.rgb, x);

    float shade_factor = 0.58 + 1.60 * max(0., dot(vNormal, normalize(light)));

    if (mouse_x >= 0 && mouse_y >= 0 && mouse_x == int(floor((map_x_size * vUv.x ))) && mouse_y == int(floor((map_y_size * (1.0 - vUv.y) )))) {
        shade_factor += 0.7;
    }
    if (selected_x >= 0 && selected_y >= 0 && selected_x == int(floor((map_x_size * vUv.x ))) && selected_y == int(floor((map_y_size * (1.0 - vUv.y) )))) {
        shade_factor += 1.5;
    }

    // Fog of war, and unknown tiles, are stored as a vertex color in vColor.r.
    c = c * vColor.r;

    fragColor = vec4(c * shade_factor, 1.0);

}

