/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.freecivx.com/
    Copyright (C) 2009-2017  The Freeciv-web project

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

var roads_texture;
var roads_data;

/****************************************************************************
 Initialize roads image
****************************************************************************/
function init_roads_image()
{
  roads_data = new Uint8Array( 4 * map.xsize * map.ysize );

  roads_texture = new THREE.DataTexture(roads_data, map.xsize, map.ysize);
  roads_texture.flipY = true;

  for (let x = 0; x < map.xsize; x++) {
    for (let y = 0; y < map.ysize; y++) {
      let index = (y * map.xsize + x) * 4;
      roads_data[index] = 0;
      roads_data[index + 1] = 0;
      roads_data[index + 2] = 0;
      roads_data[index + 3] = 255;
    }
  }
}

/****************************************************************************
  Updates road models for the given tile and optionally for adjacent tiles.
  @param {Tile} ptile - The tile whose road models need to be updated.
  @param {boolean} recursive - If true, also updates adjacent tiles.
****************************************************************************/
function update_roads_tile(ptile, recursive)
{
  let x = ptile.x;
  let y = ptile.y;
  let index = (y * map.xsize + x) * 4;
  let old_value = (roads_data[index] + roads_data[index + 1] + roads_data[index + 2]);

  let color = road_image_color(x, y);
  roads_data[index] = color[0];
  roads_data[index + 1] = color[1];
  roads_data[index + 2] = color[2];

  if ((roads_data[index] + roads_data[index + 1] + roads_data[index + 2] ) != old_value) {
    roads_texture.needsUpdate = true;
    //console.log("updated roads.");
  }

  if (!recursive) return;

  // Use standard 8-connected neighbors for road updates
  // The hex visualization is separate from the tile coordinate system
  let neighbours = [
    { "x": x - 1 , "y": y - 1},
    { "x": x - 1, "y": y },
    { "x": x - 1,  "y": y + 1 },
    { "x": x,  "y": y - 1},
    { "x": x , "y": y + 1},
    { "x": x + 1, "y": y - 1 },
    { "x": x + 1,  "y": y },
    { "x": x + 1,  "y": y + 1},
  ];

  for (let i = 0; i < 8; i++) {
    let coords = neighbours[i];
    if (coords.x < 0 || coords.x >= map.xsize || coords.y < 0 || coords.y >= map.ysize ) {
      continue;
    }
    let ntile = map_pos_to_tile(coords.x, coords.y);
    update_roads_tile(ntile, false);
  }

}

/****************************************************************************
...
****************************************************************************/
function road_image_color(map_x, map_y)
{
  var ptile = map_pos_to_tile(map_x, map_y);

  // Rivers - rendered first (lowest priority)
  if (ptile != null && tile_has_extra(ptile, EXTRA_RIVER)) {
    // Direction constants: 0=NW, 1=N, 2=NE, 3=W, 4=E, 5=SW, 6=S, 7=SE
    // Sprite mapping: each sprite shows river flowing in specific directions
    // 22=N, 24=E, 26=S, 28=W (cardinals)
    // 23=NE, 25=SE, 27=SW, 29=NW (diagonals)
    // 53=4-way junction, 20=isolated/default

    // Direction to sprite index lookup table
    var spriteMap = [29, 22, 23, 28, 24, 27, 26, 25];  // dir 0-7 -> sprite
    var dirToSprite = function(dir) {
      return spriteMap[dir] || 20;  // default to 20 if invalid direction
    };

    // Check all 8 directions for adjacent rivers
    var connections = [];
    for (let dir = 0; dir < 8; dir++) {
      let checktile = mapstep(ptile, dir);
      if (checktile != null && tile_has_extra(checktile, EXTRA_RIVER)) {
        connections.push(dir);
      }
    }

    // Select appropriate sprite(s) based on connections
    var conn_count = connections.length;
    
    // 3+ connections: use junction sprite
    if (conn_count >= 3) {
      return [53, 0, 0];
    }
    
    // 2 connections: select sprite(s) that show both connections
    if (conn_count === 2) {
      let dir1 = connections[0];
      let dir2 = connections[1];
      
      // Map direction pairs to appropriate sprite indices
      // For straight lines and turns, we use two sprites
      // Cardinals: N=1, E=4, S=6, W=3
      // Diagonals: NW=0, NE=2, SE=7, SW=5
      
      // N-S line
      if ((dir1 === 1 && dir2 === 6) || (dir1 === 6 && dir2 === 1)) {
        return [26, 22, 0];  // S sprite + N sprite for vertical flow
      }
      // E-W line
      if ((dir1 === 3 && dir2 === 4) || (dir1 === 4 && dir2 === 3)) {
        return [24, 28, 0];  // E sprite + W sprite for horizontal flow
      }
      // NE-SW diagonal line
      if ((dir1 === 2 && dir2 === 5) || (dir1 === 5 && dir2 === 2)) {
        return [23, 27, 0];  // NE sprite + SW sprite for diagonal flow
      }
      // NW-SE diagonal line
      if ((dir1 === 0 && dir2 === 7) || (dir1 === 7 && dir2 === 0)) {
        return [29, 25, 0];  // NW sprite + SE sprite for diagonal flow
      }
      
      // For turns and other 2-connection cases, pick the two relevant sprites
      return [dirToSprite(dir1), dirToSprite(dir2), 0];
    }
    
    // 1 connection: show sprite in that direction
    if (conn_count === 1) {
      return [dirToSprite(connections[0]), 0, 0];
    }
    
    // 0 connections: isolated river tile
    return [20, 0, 0];
  }

  // Railroads.
  if (ptile != null && tile_has_extra(ptile, EXTRA_RAIL)) {

    var result = [10, 0, 0]; // single road tile.

    // 1. iterate over adjacent tiles, see if they have railroad.
    var adj_road_count = 0;
    for (let dir = 0; dir < 8; dir++) {
      if (dir != 1 && dir != 3 && dir != 4 && dir != 6) continue;
      let checktile = mapstep(ptile, dir);
      if (checktile != null && tile_has_extra(checktile, EXTRA_RAIL)) {
        if (dir == 1) result[adj_road_count] = 12;
        if (dir == 3) result[adj_road_count] = 18;
        if (dir == 4) result[adj_road_count] = 14;
        if (dir == 6) result[adj_road_count] = 16;
        adj_road_count++;
        if (adj_road_count > 2) {
          let checktile = mapstep(ptile, 6);
          if (checktile != null && tile_has_extra(checktile, EXTRA_RAIL)) return [43,0,0];  //special case, 4 connected rails.
          break;
        }
      }
    }
    for (let dir = 0; dir < 8; dir++) {
      if (dir != 0 && dir != 2 && dir != 5 && dir != 7) continue;
      let checktile = mapstep(ptile, dir);
      if (checktile != null && tile_has_extra(checktile, EXTRA_RAIL)) {
        if (dir == 0) result[adj_road_count] = 19;
        if (dir == 2) result[adj_road_count] = 13;
        if (dir == 5) result[adj_road_count] = 17;
        if (dir == 7) result[adj_road_count] = 15;
        adj_road_count++;
        if (adj_road_count > 2) break;
      }
    }

    return [result[0], result[1], result[2]];
  }

  // Roads
  if (ptile != null && tile_has_extra(ptile, EXTRA_ROAD)) {

    let result = [1, 0, 0]; // single road tile.

    // 1. iterate over adjacent tiles, see if they have road.
    adj_road_count = 0;
    for (var dir = 0; dir < 8; dir++) {
      if (dir != 1 && dir != 3 && dir != 4 && dir != 6) continue;
      let checktile = mapstep(ptile, dir);
      if (checktile != null && tile_has_extra(checktile, EXTRA_ROAD)) {
        if (dir == 1) result[adj_road_count] = 2;
        if (dir == 3) result[adj_road_count] = 8;
        if (dir == 4) result[adj_road_count] = 4;
        if (dir == 6) result[adj_road_count] = 6;
        adj_road_count++;
        if (adj_road_count > 2) {
          let checktile = mapstep(ptile, 6);
          if (checktile != null && tile_has_extra(checktile, EXTRA_ROAD)) return [42,0,0]; //special case, 4 connected roads.
          break;
        }
      }
    }
    for (dir = 0; dir < 8; dir++) {
      if (dir != 0 && dir != 2 && dir != 5 && dir != 7) continue;
      let checktile = mapstep(ptile, dir);
      if (checktile != null && tile_has_extra(checktile, EXTRA_ROAD)) {
        if (dir == 0) result[adj_road_count] = 9;
        if (dir == 2) result[adj_road_count] = 3;
        if (dir == 5) result[adj_road_count] = 7;
        if (dir == 7) result[adj_road_count] = 5;
        adj_road_count++;
        if (adj_road_count > 2) break;
      }
    }

    return [result[0], result[1] , result[2]];
  }
  return [0,0,0]; // no road.

}
