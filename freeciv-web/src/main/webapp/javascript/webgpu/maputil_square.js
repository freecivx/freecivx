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

// Map coordinate system offsets - used for scene <-> map coordinate conversion
// These must match between map_to_scene_coords() and scene_to_map_coords()
var MAP_X_OFFSET = -470;  // Initial X offset when converting map to scene coordinates
var MAP_Y_OFFSET = 30;    // Initial Y offset when converting map to scene coordinates

// ============= HEX DEBUG LOGGING SYSTEM =============
// Enable/disable hex debugging with: hexDebugEnabled = true/false in browser console
// Set to true for hex map troubleshooting, false for production
var hexDebugEnabled = true;  // Enabled for hex debugging - set to false for production
var hexDebugLogCount = 0;
var hexDebugMaxLogs = 500; // Limit logs to prevent console overflow

// Sampling rate for coordinate conversion logs (0.01 = 1% of conversions logged to reduce noise)
const COORD_LOG_SAMPLE_RATE = 0.01;

function hexDebugLog(category, message, data) {
  if (!hexDebugEnabled || hexDebugLogCount > hexDebugMaxLogs) return;
  hexDebugLogCount++;
  console.log(`[HEX-DEBUG][${category}] ${message}`, data || '');
}

// Log user instructions when game starts (called once)
var hexDebugInstructionsLogged = false;
function hexDebugLogUserInstructions() {
  if (hexDebugInstructionsLogged) return;
  hexDebugInstructionsLogged = true;
  console.log('%c═══════════════════════════════════════════════════════════════', 'color: #00ff00');
  console.log('%c  HEXAGONAL MAP DEBUGGING TELEMETRY ACTIVE', 'color: #00ff00; font-size: 16px; font-weight: bold');
  console.log('%c═══════════════════════════════════════════════════════════════', 'color: #00ff00');
  console.log('%c\n📋 TEST INSTRUCTIONS FOR HEX MAP VERIFICATION:\n', 'color: #ffff00; font-weight: bold');
  console.log('%c  1. SELECT A UNIT: Click on any unit to select it', 'color: #ffffff');
  console.log('%c     → Watch for: [HEX-DEBUG][UNIT-SELECT] logs showing tile coords', 'color: #aaaaaa');
  console.log('%c  2. MOVE UNIT WITH NUMPAD: Use numpad 1-9 (except 5) to move', 'color: #ffffff');
  console.log('%c     → Watch for: [HEX-DEBUG][MOVEMENT] logs showing direction & coords', 'color: #aaaaaa');
  console.log('%c     → HEX DIRECTIONS: Only 6 of 8 directions are valid for hex', 'color: #aaaaaa');
  console.log('%c  3. USE GOTO (right-click): Right-click on map to set destination', 'color: #ffffff');
  console.log('%c     → Watch for: [HEX-DEBUG][GOTO] logs showing path coordinates', 'color: #aaaaaa');
  console.log('%c  4. BUILD CITY: Press B with settler selected', 'color: #ffffff');
  console.log('%c     → Watch for: [HEX-DEBUG][CITY-PLACE] logs showing position', 'color: #aaaaaa');
  console.log('%c  5. EXPLORE FOG OF WAR: Move units to reveal unknown tiles', 'color: #ffffff');
  console.log('%c     → Watch for: [HEX-DEBUG][FOG] logs showing visibility changes', 'color: #aaaaaa');
  console.log('%c  6. CLICK ON MAP: Click anywhere to see coordinate conversion', 'color: #ffffff');
  console.log('%c     → Watch for: [HEX-DEBUG][CLICK-TILE] logs showing coords', 'color: #aaaaaa');
  console.log('%c\n🔍 KEY VARIABLES TO CHECK (type in console):', 'color: #ffff00; font-weight: bold');
  console.log('%c  - map.xsize, map.ysize: Map dimensions', 'color: #ffffff');
  console.log('%c  - topo_has_flag(TF_HEX): Is hex topology?', 'color: #ffffff');
  console.log('%c  - topo_has_flag(TF_ISO): Is isometric?', 'color: #ffffff');
  console.log('%c  - HEX_HEIGHT_FACTOR: Should be ~0.866', 'color: #ffffff');
  console.log('%c  - HEX_STAGGER: Should be 0.5', 'color: #ffffff');
  console.log('%c  - hexDebugEnabled = false: Disable logging', 'color: #ffffff');
  console.log('%c  - hexDebugLogCount = 0: Reset log counter', 'color: #ffffff');
  console.log('%c\n═══════════════════════════════════════════════════════════════\n', 'color: #00ff00');
}

/****************************************************************************
  Converts from map to scene coordinates for hexagonal tiles.
  
  Uses offset hex coordinates (odd-r: odd rows shifted right).
  Reference: https://www.redblobgames.com/grids/hexagons/#coordinates-offset
  
  For hex topology, we need to account for:
  - Row stagger (odd rows offset by half tile width)
  - Hex aspect ratio (height = width * sqrt(3)/2)
  
  @param {number} x - Map tile X coordinate
  @param {number} y - Map tile Y coordinate
  @returns {Object} Scene coordinates {x, y}
****************************************************************************/
function map_to_scene_coords(x, y)
{
  var result = {};
  
  // Calculate base position
  const tileWidth = mapview_model_width / map['xsize'];
  const tileHeight = (mapview_model_height / map['ysize']) * HEX_HEIGHT_FACTOR;
  
  // Apply hex row offset for odd rows (odd-r offset coordinate system)
  const rowOffset = (y % 2 === 1) ? tileWidth * HEX_STAGGER : 0;
  
  result['x'] = Math.floor(MAP_X_OFFSET + x * tileWidth + rowOffset);
  result['y'] = Math.floor(MAP_Y_OFFSET + y * tileHeight);

  // Debug logging for coordinate conversion (sampled at COORD_LOG_SAMPLE_RATE to reduce noise)
  if (hexDebugEnabled && hexDebugLogCount < hexDebugMaxLogs && Math.random() < COORD_LOG_SAMPLE_RATE) {
    hexDebugLog('COORD-MAP2SCENE', `Map(${x},${y}) → Scene(${result['x']},${result['y']})`, {
      tileWidth: tileWidth.toFixed(2),
      tileHeight: tileHeight.toFixed(2),
      rowOffset: rowOffset.toFixed(2),
      isOddRow: y % 2 === 1,
      mapSize: `${map['xsize']}x${map['ysize']}`,
      HEX_HEIGHT_FACTOR: HEX_HEIGHT_FACTOR,
      HEX_STAGGER: HEX_STAGGER
    });
  }

  return result;
}

/****************************************************************************
  Converts from scene to map coordinates for hexagonal tiles.
  
  Inverse of map_to_scene_coords(). Uses offset hex coordinates (odd-r).
  Reference: https://www.redblobgames.com/grids/hexagons/#coordinates-offset
  
  For hex tiles, we first determine the rough tile position, then check
  if the point is actually in that hex or a neighboring one using the
  hex distance function.
  
  @param {number} x - Scene X coordinate
  @param {number} y - Scene Y coordinate (actually Z in 3D space)
  @returns {Object} Map tile coordinates {x, y}
****************************************************************************/
function scene_to_map_coords(x, y)
{
  var result = {};
  
  const tileWidth = mapview_model_width / map['xsize'];
  const tileHeight = (mapview_model_height / map['ysize']) * HEX_HEIGHT_FACTOR;
  
  // Account for the MAP_Y_OFFSET in map_to_scene_coords
  const adjustedY = y - MAP_Y_OFFSET;
  
  // Calculate initial Y coordinate estimate
  const tileY = Math.floor(adjustedY / tileHeight);
  
  // Calculate row offset based on Y (odd rows are staggered in odd-r system)
  const rowOffset = (tileY % 2 === 1) ? tileWidth * HEX_STAGGER : 0;
  
  // Account for the MAP_X_OFFSET
  const adjustedX = x - MAP_X_OFFSET - rowOffset;
  
  // Calculate initial X coordinate estimate
  const tileX = Math.floor(adjustedX / tileWidth);
  
  // For hex tiles, we need to check if the click is actually in this tile
  // or in an adjacent tile at the corners. Check the distance from the
  // click point to the center of candidate tiles.
  
  // Get the center position of the estimated tile
  const tileCenterPos = map_to_scene_coords(tileX, tileY);
  const tileCenterX = tileCenterPos['x'] + tileWidth / 2;
  const tileCenterY = tileCenterPos['y'] + tileHeight / 2;
  
  // Check distance to estimated tile center
  const dx = x - tileCenterX;
  const dy = y - tileCenterY;
  
  // Calculate hex-corrected distance (accounting for hex aspect ratio)
  const HEX_ASPECT_RATIO = tileWidth / tileHeight;
  
  // For hex tiles, if the point is near the top/bottom corners,
  // it might be in an adjacent tile. Check neighboring tiles.
  let bestTileX = tileX;
  let bestTileY = tileY;
  let bestDist = dx * dx + (dy * HEX_ASPECT_RATIO) * (dy * HEX_ASPECT_RATIO);
  
  // Check adjacent tiles (up to 6 neighbors for hex)
  const neighbors = [
    { dx: -1, dy: 0 },   // left
    { dx: 1, dy: 0 },    // right
    { dx: 0, dy: -1 },   // up
    { dx: 0, dy: 1 },    // down
    // For odd-r offset, diagonal neighbors depend on row parity
    { dx: (tileY % 2 === 1) ? 0 : -1, dy: -1 }, // upper-left/upper
    { dx: (tileY % 2 === 1) ? 1 : 0, dy: -1 },  // upper-right/upper
    { dx: (tileY % 2 === 1) ? 0 : -1, dy: 1 },  // lower-left/lower
    { dx: (tileY % 2 === 1) ? 1 : 0, dy: 1 },   // lower-right/lower
  ];
  
  for (const neighbor of neighbors) {
    const nx = tileX + neighbor.dx;
    const ny = tileY + neighbor.dy;
    
    if (nx < 0 || nx >= map['xsize'] || ny < 0 || ny >= map['ysize']) continue;
    
    const neighborPos = map_to_scene_coords(nx, ny);
    const neighborCenterX = neighborPos['x'] + tileWidth / 2;
    const neighborCenterY = neighborPos['y'] + tileHeight / 2;
    
    const ndx = x - neighborCenterX;
    const ndy = y - neighborCenterY;
    const neighborDist = ndx * ndx + (ndy * HEX_ASPECT_RATIO) * (ndy * HEX_ASPECT_RATIO);
    
    if (neighborDist < bestDist) {
      bestDist = neighborDist;
      bestTileX = nx;
      bestTileY = ny;
    }
  }
  
  result['x'] = bestTileX;
  result['y'] = bestTileY;

  // Debug logging for scene-to-map conversion
  if (hexDebugEnabled && hexDebugLogCount < hexDebugMaxLogs) {
    hexDebugLog('COORD-SCENE2MAP', `Scene(${x.toFixed(1)},${y.toFixed(1)}) → Map(${result['x']},${result['y']})`, {
      initialEstimate: `(${tileX},${tileY})`,
      correctedTo: `(${bestTileX},${bestTileY})`,
      tileWidth: tileWidth.toFixed(2),
      tileHeight: tileHeight.toFixed(2),
      isOddRow: tileY % 2 === 1,
      distanceToCenter: bestDist.toFixed(2)
    });
  }

  return result;
}


/****************************************************************************
  Converts from canvas coordinates to a tile.
****************************************************************************/
function webgl_canvas_pos_to_tile(x, y) {
  if (mouse == null || lofiMesh == null) return null;

  mouse.set( ( x / $('#mapcanvas').width() ) * 2 - 1, - ( y / $('#mapcanvas').height() ) * 2 + 1);

  raycaster.setFromCamera( mouse, camera );

  var intersects = raycaster.intersectObject(lofiMesh, false);

  for (var i = 0; i < intersects.length; i++) {
    var intersect = intersects[i];
    var pos = scene_to_map_coords(intersect.point.x, intersect.point.z);
    var ptile = map_pos_to_tile(pos['x'], pos['y']);
    if (ptile != null) {
      // Log tile click for debugging
      if (hexDebugEnabled && hexDebugLogCount < hexDebugMaxLogs) {
        hexDebugLog('CLICK-TILE', `Canvas(${x},${y}) → Tile(${ptile['x']},${ptile['y']}) index=${ptile['index']}`, {
          intersectPoint: { x: intersect.point.x.toFixed(2), z: intersect.point.z.toFixed(2) },
          mapPos: pos,
          tileIndex: ptile['index'],
          isOddRow: ptile['y'] % 2 === 1
        });
      }
      return ptile;
    }
  }

  return null;
}

/****************************************************************************
  Converts from canvas coordinates to a tile, fast using the water mesh.
****************************************************************************/
function webgl_canvas_pos_to_tile_quick(x, y) {
  if (mouse == null || lofiMesh == null) return null;

  raycaster.layers.set(0);

  mouse.set( ( x / $('#mapcanvas').width() ) * 2 - 1, - ( y / $('#mapcanvas').height() ) * 2 + 1);

  raycaster.setFromCamera( mouse, camera );

  var intersects = raycaster.intersectObject(water_hq, false);

  raycaster.layers.set(6);

  for (var i = 0; i < intersects.length; i++) {
    var intersect = intersects[i];
    var pos = scene_to_map_coords(intersect.point.x, intersect.point.z);
    var ptile = map_pos_to_tile(pos['x'], pos['y']);
    if (ptile != null) return ptile;
  }

  return null;
}

/****************************************************************************
  Converts from canvas coordinates to Three.js coordinates.
****************************************************************************/
function webgl_canvas_pos_to_map_pos(x, y) {
  if (mouse == null || lofiMesh == null || mapview_slide['active']) return null;

  mouse.set( ( x / $('#mapcanvas').width() ) * 2 - 1, - ( y / $('#mapcanvas').height() ) * 2 + 1);

  raycaster.setFromCamera( mouse, camera );

  var intersects = raycaster.intersectObject(lofiMesh);

  if (intersects.length > 0) {
    var intersect = intersects[0];
    return {'x' : intersect.point.x, 'y' : intersect.point.z};
  }

  return null;
}

/****************************************************************************
  Converts from unit['facing'] to number of rotations of 1/8 parts of full circle rotations (2PI),
  then to radians;
****************************************************************************/
function convert_unit_rotation(facing_dir, unit_type_name)
{
  var rotation_rad = 0;

  if (facing_dir == 0) rotation_rad = -3;
  if (facing_dir == 1) rotation_rad = -4;
  if (facing_dir == 2) rotation_rad = -5;
  if (facing_dir == 4) rotation_rad = -6;
  if (facing_dir == 7) rotation_rad = -7;
  if (facing_dir == 6) rotation_rad = 0;
  if (facing_dir == 5) rotation_rad = -1;
  if (facing_dir == 3) rotation_rad = -2;

  if (unit_type_name == "Horsemen" || unit_type_name == "Knights" || unit_type_name == "Zeppelin" || unit_type_name == "Galleon"
      || unit_type_name == "Frigate" || unit_type_name == "Destroyer" || unit_type_name == "Battleship" || unit_type_name == "Cruiser"
      || unit_type_name == "AEGIS Cruiser" || unit_type_name == "Carrier" || unit_type_name == "Settlers"  || unit_type_name == "Transport") {
    return rotation_rad * Math.PI * 2 / 8 + Math.PI;
  }

  if (unit_type_name == "Ironclad" || unit_type_name == "Artillery") {
    return rotation_rad * Math.PI * 2 / 8 - (Math.PI / 2);
  }
  if (unit_type_name == "Catapult" || unit_type_name == "Bomber") {
    return rotation_rad * Math.PI * 2 / 8 + (Math.PI / 2);
  }


  return rotation_rad * Math.PI * 2 / 8

}
