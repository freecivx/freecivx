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
// New comprehensive hex debug system for diagnosing hex map tile issues
// Usage: startHexDebug() - runs automated debug actions
//        hexDebugSummary() - prints debug info to console

var hexDebugData = {
  enabled: false,
  logs: [],
  tileClicks: [],
  unitMoves: [],
  coordConversions: [],
  fogChanges: [],
  screenshotData: null
};

/**
 * Logs a hex debug message with category and data
 */
function hexLog(category, message, data) {
  if (!hexDebugData.enabled) return;
  var entry = {
    timestamp: Date.now(),
    category: category,
    message: message,
    data: data || {}
  };
  hexDebugData.logs.push(entry);
  console.log('[HEX-DEBUG][' + category + '] ' + message, data || '');
}

/**
 * Start hex debug mode - runs automated browser actions to debug hex implementation
 * Call from browser console: startHexDebug()
 */
function startHexDebug() {
  hexDebugData.enabled = true;
  hexDebugData.logs = [];
  hexDebugData.tileClicks = [];
  hexDebugData.unitMoves = [];
  hexDebugData.coordConversions = [];
  hexDebugData.fogChanges = [];
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          HEX MAP DEBUG SESSION STARTED                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('AUTOMATED DEBUG ACTIONS RUNNING...');
  console.log('');
  
  // Log initial state
  hexLog('INIT', 'Debug session started');
  
  // Log map configuration
  if (typeof map !== 'undefined' && map) {
    hexLog('MAP-CONFIG', 'Map configuration', {
      xsize: map.xsize,
      ysize: map.ysize,
      topology: map.topology_id,
      isHex: typeof topo_has_flag !== 'undefined' ? topo_has_flag(TF_HEX) : 'unknown',
      isIso: typeof topo_has_flag !== 'undefined' ? topo_has_flag(TF_ISO) : 'unknown'
    });
  }
  
  // Log hex constants
  hexLog('HEX-CONSTANTS', 'Hex rendering constants', {
    HEX_HEIGHT_FACTOR: typeof HEX_HEIGHT_FACTOR !== 'undefined' ? HEX_HEIGHT_FACTOR : 'undefined',
    HEX_STAGGER: typeof HEX_STAGGER !== 'undefined' ? HEX_STAGGER : 'undefined',
    HEX_CENTER_OFFSET_X: typeof HEX_CENTER_OFFSET_X !== 'undefined' ? HEX_CENTER_OFFSET_X : 'undefined',
    HEX_CENTER_OFFSET_Y: typeof HEX_CENTER_OFFSET_Y !== 'undefined' ? HEX_CENTER_OFFSET_Y : 'undefined',
    MAP_X_OFFSET: MAP_X_OFFSET,
    MAP_Y_OFFSET: MAP_Y_OFFSET
  });
  
  // Log mapview dimensions
  hexLog('MAPVIEW', 'Mapview dimensions', {
    mapview_model_width: typeof mapview_model_width !== 'undefined' ? mapview_model_width : 'undefined',
    mapview_model_height: typeof mapview_model_height !== 'undefined' ? mapview_model_height : 'undefined'
  });
  
  // Test coordinate conversions for sample tiles
  console.log('');
  console.log('TESTING COORDINATE CONVERSIONS...');
  testCoordinateConversions();
  
  // Log unit positions
  console.log('');
  console.log('LOGGING UNIT POSITIONS...');
  logAllUnitPositions();
  
  // Generate ASCII map representation
  console.log('');
  console.log('GENERATING ASCII MAP...');
  generateAsciiMap();
  
  // Capture ASCII screenshot of the canvas
  console.log('');
  console.log('CAPTURING ASCII SCREENSHOT...');
  captureAsciiScreenshotCompact();
  
  console.log('');
  console.log('DEBUG SESSION ACTIVE. Call hexDebugSummary() for full report.');
  console.log('Call captureAsciiScreenshot() for detailed screenshot.');
  console.log('Call stopHexDebug() to end session.');
}

/**
 * Stop hex debug mode
 */
function stopHexDebug() {
  hexDebugData.enabled = false;
  console.log('Hex debug session ended. Total logs: ' + hexDebugData.logs.length);
}

/**
 * Test coordinate conversions for a grid of tiles
 */
function testCoordinateConversions() {
  if (typeof map === 'undefined' || !map) {
    hexLog('ERROR', 'Map not available for coordinate testing');
    return;
  }
  
  var testPoints = [];
  var stepX = Math.max(1, Math.floor(map.xsize / 5));
  var stepY = Math.max(1, Math.floor(map.ysize / 5));
  
  for (var y = 0; y < map.ysize; y += stepY) {
    for (var x = 0; x < map.xsize; x += stepX) {
      var sceneCoords = map_to_scene_coords(x, y);
      var backToMap = scene_to_map_coords(sceneCoords.x, sceneCoords.y);
      var roundTrip = (backToMap.x === x && backToMap.y === y);
      
      testPoints.push({
        original: {x: x, y: y},
        scene: sceneCoords,
        backToMap: backToMap,
        roundTripOK: roundTrip,
        isOddRow: y % 2 === 1
      });
      
      hexDebugData.coordConversions.push({
        mapX: x, mapY: y,
        sceneX: sceneCoords.x, sceneY: sceneCoords.y,
        roundTripX: backToMap.x, roundTripY: backToMap.y,
        success: roundTrip
      });
    }
  }
  
  var failures = testPoints.filter(function(p) { return !p.roundTripOK; });
  hexLog('COORD-TEST', 'Coordinate conversion test results', {
    totalTests: testPoints.length,
    passed: testPoints.length - failures.length,
    failed: failures.length,
    failures: failures.slice(0, 5) // Show first 5 failures
  });
}

/**
 * Log positions of all visible units
 */
function logAllUnitPositions() {
  if (typeof units === 'undefined') {
    hexLog('ERROR', 'Units not available');
    return;
  }
  
  var unitList = [];
  for (var unitId in units) {
    var unit = units[unitId];
    if (unit && unit.tile !== undefined) {
      var ptile = index_to_tile(unit.tile);
      if (ptile) {
        var scenePos = map_to_scene_coords(ptile.x, ptile.y);
        unitList.push({
          id: unit.id,
          type: typeof unit_type !== 'undefined' ? unit_type(unit).name : 'unknown',
          tileX: ptile.x,
          tileY: ptile.y,
          tileIndex: ptile.index,
          sceneX: scenePos.x,
          sceneY: scenePos.y,
          isOddRow: ptile.y % 2 === 1
        });
      }
    }
  }
  
  hexLog('UNITS', 'Unit positions logged', {
    count: unitList.length,
    units: unitList.slice(0, 10) // Show first 10 units
  });
}

/**
 * Generate an ASCII representation of the map around the camera focus
 */
function generateAsciiMap() {
  if (typeof map === 'undefined' || !map) {
    hexLog('ERROR', 'Map not available for ASCII generation');
    return;
  }
  
  var width = Math.min(20, map.xsize);
  var height = Math.min(10, map.ysize);
  var startX = 0;
  var startY = 0;
  
  // Try to center on player's first unit
  if (typeof units !== 'undefined') {
    for (var unitId in units) {
      var unit = units[unitId];
      if (unit && unit.tile !== undefined) {
        var ptile = index_to_tile(unit.tile);
        if (ptile) {
          startX = Math.max(0, ptile.x - Math.floor(width / 2));
          startY = Math.max(0, ptile.y - Math.floor(height / 2));
          break;
        }
      }
    }
  }
  
  var asciiLines = [];
  asciiLines.push('ASCII MAP (hex stagger shown with indentation):');
  asciiLines.push('Legend: . = land, ~ = ocean, ? = unknown, U = unit, C = city');
  asciiLines.push('');
  
  for (var y = startY; y < startY + height && y < map.ysize; y++) {
    var indent = (y % 2 === 1) ? '  ' : ''; // Hex stagger for odd rows
    var line = indent;
    
    for (var x = startX; x < startX + width && x < map.xsize; x++) {
      var ptile = map_pos_to_tile(x, y);
      var char = '?';
      
      if (ptile) {
        if (tile_get_known(ptile) === TILE_UNKNOWN) {
          char = '?';
        } else if (tile_city(ptile)) {
          char = 'C';
        } else if (tile_units(ptile) && tile_units(ptile).length > 0) {
          char = 'U';
        } else if (is_ocean_tile(ptile)) {
          char = '~';
        } else {
          char = '.';
        }
      }
      line += char + '   '; // Extra spacing for hex tiles
    }
    asciiLines.push('Row ' + y.toString().padStart(2, '0') + ': ' + line);
  }
  
  hexLog('ASCII-MAP', asciiLines.join('\n'));
}

/**
 * Capture the game canvas and convert to ASCII art for debugging
 * Call from browser console: captureAsciiScreenshot()
 */
function captureAsciiScreenshot() {
  var canvas = document.getElementById('mapcanvas');
  if (!canvas) {
    console.log('[HEX-DEBUG] Canvas not found');
    return null;
  }
  
  // Get the WebGPU/WebGL context and read pixels
  var width = canvas.width;
  var height = canvas.height;
  
  // Target ASCII dimensions (characters)
  var asciiWidth = 120;
  var asciiHeight = 40;
  
  // Create a temporary 2D canvas to read pixels
  var tempCanvas = document.createElement('canvas');
  tempCanvas.width = asciiWidth;
  tempCanvas.height = asciiHeight;
  var ctx = tempCanvas.getContext('2d');
  
  // Draw the game canvas scaled down to ASCII dimensions
  ctx.drawImage(canvas, 0, 0, asciiWidth, asciiHeight);
  
  // Get pixel data
  var imageData;
  try {
    imageData = ctx.getImageData(0, 0, asciiWidth, asciiHeight);
  } catch (e) {
    console.log('[HEX-DEBUG] Cannot read canvas pixels (CORS or security restriction)');
    return null;
  }
  
  var pixels = imageData.data;
  
  // ASCII character ramp from dark to light
  var asciiChars = ' .:-=+*#%@';
  
  var asciiLines = [];
  asciiLines.push('╔' + '═'.repeat(asciiWidth + 2) + '╗');
  asciiLines.push('║ ASCII SCREENSHOT (' + width + 'x' + height + ' → ' + asciiWidth + 'x' + asciiHeight + ')' + ' '.repeat(Math.max(0, asciiWidth - 45)) + ' ║');
  asciiLines.push('╠' + '═'.repeat(asciiWidth + 2) + '╣');
  
  for (var y = 0; y < asciiHeight; y++) {
    var line = '║ ';
    for (var x = 0; x < asciiWidth; x++) {
      var idx = (y * asciiWidth + x) * 4;
      var r = pixels[idx];
      var g = pixels[idx + 1];
      var b = pixels[idx + 2];
      var a = pixels[idx + 3];
      
      // Calculate brightness (0-255)
      var brightness = (0.299 * r + 0.587 * g + 0.114 * b) * (a / 255);
      
      // Map brightness to ASCII character
      var charIndex = Math.floor((brightness / 255) * (asciiChars.length - 1));
      line += asciiChars[charIndex];
    }
    line += ' ║';
    asciiLines.push(line);
  }
  
  asciiLines.push('╚' + '═'.repeat(asciiWidth + 2) + '╝');
  
  var asciiArt = asciiLines.join('\n');
  
  // Store in debug data
  hexDebugData.screenshotData = {
    timestamp: Date.now(),
    originalSize: { width: width, height: height },
    asciiSize: { width: asciiWidth, height: asciiHeight },
    ascii: asciiArt
  };
  
  console.log('\n' + asciiArt + '\n');
  hexLog('SCREENSHOT', 'ASCII screenshot captured', {
    originalSize: width + 'x' + height,
    asciiSize: asciiWidth + 'x' + asciiHeight
  });
  
  return asciiArt;
}

/**
 * Capture a smaller, more compact ASCII screenshot
 * Call from browser console: captureAsciiScreenshotCompact()
 */
function captureAsciiScreenshotCompact() {
  var canvas = document.getElementById('mapcanvas');
  if (!canvas) {
    console.log('[HEX-DEBUG] Canvas not found');
    return null;
  }
  
  var width = canvas.width;
  var height = canvas.height;
  
  // Smaller target for compact view
  var asciiWidth = 60;
  var asciiHeight = 20;
  
  var tempCanvas = document.createElement('canvas');
  tempCanvas.width = asciiWidth;
  tempCanvas.height = asciiHeight;
  var ctx = tempCanvas.getContext('2d');
  
  ctx.drawImage(canvas, 0, 0, asciiWidth, asciiHeight);
  
  var imageData;
  try {
    imageData = ctx.getImageData(0, 0, asciiWidth, asciiHeight);
  } catch (e) {
    console.log('[HEX-DEBUG] Cannot read canvas pixels');
    return null;
  }
  
  var pixels = imageData.data;
  
  // Block characters for more detail
  var blockChars = ' ░▒▓█';
  
  var asciiLines = [];
  asciiLines.push('┌' + '─'.repeat(asciiWidth) + '┐');
  
  for (var y = 0; y < asciiHeight; y++) {
    var line = '│';
    for (var x = 0; x < asciiWidth; x++) {
      var idx = (y * asciiWidth + x) * 4;
      var r = pixels[idx];
      var g = pixels[idx + 1];
      var b = pixels[idx + 2];
      var a = pixels[idx + 3];
      
      var brightness = (0.299 * r + 0.587 * g + 0.114 * b) * (a / 255);
      var charIndex = Math.floor((brightness / 255) * (blockChars.length - 1));
      line += blockChars[charIndex];
    }
    line += '│';
    asciiLines.push(line);
  }
  
  asciiLines.push('└' + '─'.repeat(asciiWidth) + '┘');
  
  var asciiArt = asciiLines.join('\n');
  console.log('\n' + asciiArt + '\n');
  
  return asciiArt;
}

/**
 * Print comprehensive hex debug summary to console
 * Call from browser console: hexDebugSummary()
 */
function hexDebugSummary() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                    HEX MAP DEBUG SUMMARY                           ║');
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  
  // Map Configuration
  console.log('║ MAP CONFIGURATION                                                  ║');
  if (typeof map !== 'undefined' && map) {
    console.log('║   Map Size: ' + map.xsize + ' x ' + map.ysize + ' tiles');
    console.log('║   Topology ID: ' + map.topology_id);
    console.log('║   Is Hex: ' + (typeof topo_has_flag !== 'undefined' ? topo_has_flag(TF_HEX) : 'N/A'));
    console.log('║   Is Isometric: ' + (typeof topo_has_flag !== 'undefined' ? topo_has_flag(TF_ISO) : 'N/A'));
  } else {
    console.log('║   Map not loaded');
  }
  
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  
  // Hex Constants
  console.log('║ HEX RENDERING CONSTANTS                                            ║');
  console.log('║   HEX_HEIGHT_FACTOR: ' + (typeof HEX_HEIGHT_FACTOR !== 'undefined' ? HEX_HEIGHT_FACTOR.toFixed(4) : 'undefined') + ' (expected: 0.8660)');
  console.log('║   HEX_STAGGER: ' + (typeof HEX_STAGGER !== 'undefined' ? HEX_STAGGER : 'undefined') + ' (expected: 0.5)');
  console.log('║   HEX_CENTER_OFFSET_X: ' + (typeof HEX_CENTER_OFFSET_X !== 'undefined' ? HEX_CENTER_OFFSET_X : 'undefined'));
  console.log('║   HEX_CENTER_OFFSET_Y: ' + (typeof HEX_CENTER_OFFSET_Y !== 'undefined' ? HEX_CENTER_OFFSET_Y : 'undefined'));
  console.log('║   MAP_X_OFFSET: ' + MAP_X_OFFSET);
  console.log('║   MAP_Y_OFFSET: ' + MAP_Y_OFFSET);
  
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  
  // Tile Dimensions
  console.log('║ TILE DIMENSIONS                                                    ║');
  if (typeof mapview_model_width !== 'undefined' && typeof map !== 'undefined' && map) {
    var tileW = mapview_model_width / map.xsize;
    var tileH = (mapview_model_height / map.ysize) * (typeof HEX_HEIGHT_FACTOR !== 'undefined' ? HEX_HEIGHT_FACTOR : 1);
    console.log('║   Mapview Width: ' + mapview_model_width);
    console.log('║   Mapview Height: ' + mapview_model_height);
    console.log('║   Tile Width: ' + tileW.toFixed(2) + ' units');
    console.log('║   Tile Height: ' + tileH.toFixed(2) + ' units');
  } else {
    console.log('║   Mapview dimensions not available');
  }
  
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  
  // Direction Info for Hex
  console.log('║ HEX DIRECTION INFO                                                 ║');
  var isHex = typeof topo_has_flag !== 'undefined' && topo_has_flag(TF_HEX);
  var isIso = typeof topo_has_flag !== 'undefined' && topo_has_flag(TF_ISO);
  if (isHex && isIso) {
    console.log('║   Topology: Iso-Hex (TF_ISO | TF_HEX)');
    console.log('║   Valid Directions: N, S, E, W, NW, SE (6 dirs)');
    console.log('║   Numpad Mapping: 8=N, 2=S, 6=E, 4=W, 7=NW, 3=SE');
    console.log('║   Invalid: NE (numpad 9), SW (numpad 1)');
  } else if (isHex) {
    console.log('║   Topology: Pure-Hex (TF_HEX only)');
    console.log('║   Valid Directions: N, S, E, W, NE, SW (6 dirs)');
    console.log('║   Numpad Mapping: 8=N, 2=S, 6=E, 4=W, 9=NE, 1=SW');
    console.log('║   Invalid: NW (numpad 7), SE (numpad 3)');
  } else {
    console.log('║   Topology: Square (not hex)');
    console.log('║   All 8 directions valid');
  }
  
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  
  // Debug Session Data
  console.log('║ DEBUG SESSION DATA                                                 ║');
  console.log('║   Debug Enabled: ' + hexDebugData.enabled);
  console.log('║   Total Logs: ' + hexDebugData.logs.length);
  console.log('║   Coord Conversions Tested: ' + hexDebugData.coordConversions.length);
  
  if (hexDebugData.coordConversions.length > 0) {
    var failures = hexDebugData.coordConversions.filter(function(c) { return !c.success; });
    console.log('║   Coord Round-Trip Failures: ' + failures.length);
  }
  
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  
  // Known Issues
  console.log('║ KNOWN PROBLEM AREAS TO VERIFY                                      ║');
  console.log('║   [ ] Units placed incorrectly on hex tiles');
  console.log('║   [ ] Numpad movement directions wrong');
  console.log('║   [ ] Unknown fog of war tiles not hexagonal');
  console.log('║   [ ] Click-to-tile mapping incorrect');
  console.log('║   [ ] Goto path rendering issues');
  
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('To start automated debug: startHexDebug()');
  console.log('To see all debug logs: console.table(hexDebugData.logs)');
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
    if (ptile != null) return ptile;
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
