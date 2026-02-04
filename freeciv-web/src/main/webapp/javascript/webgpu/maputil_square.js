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
 * Log detailed tile rendering information for a specific tile
 * Call from browser console: hexLogTile(x, y)
 */
function hexLogTile(tileX, tileY) {
  if (typeof map === 'undefined' || !map) {
    console.log('[HEX-DEBUG] Map not available');
    return null;
  }
  
  var isHex = typeof topo_has_flag !== 'undefined' && topo_has_flag(TF_HEX);
  var isIso = typeof topo_has_flag !== 'undefined' && topo_has_flag(TF_ISO);
  
  var tileWidth = mapview_model_width / map['xsize'];
  var tileHeight = (mapview_model_height / map['ysize']) * (typeof HEX_HEIGHT_FACTOR !== 'undefined' ? HEX_HEIGHT_FACTOR : 1);
  
  var sceneCoords = map_to_scene_coords(tileX, tileY);
  var backToMap = scene_to_map_coords(sceneCoords.x, sceneCoords.y);
  
  var ptile = map_pos_to_tile(tileX, tileY);
  var tileInfo = null;
  if (ptile) {
    tileInfo = {
      index: ptile.index,
      terrain: typeof tile_terrain !== 'undefined' && tile_terrain(ptile) ? tile_terrain(ptile).name : 'unknown',
      known: typeof tile_get_known !== 'undefined' ? tile_get_known(ptile) : 'unknown',
      hasUnits: typeof tile_units !== 'undefined' && tile_units(ptile) ? tile_units(ptile).length : 0,
      hasCity: typeof tile_city !== 'undefined' && tile_city(ptile) ? true : false
    };
  }
  
  var data = {
    tileCoords: { x: tileX, y: tileY },
    isEvenRow: tileY % 2 === 0,
    hexRowOffset: (tileY % 2 === 0) ? tileWidth * (typeof HEX_STAGGER !== 'undefined' ? HEX_STAGGER : 0.5) : 0,
    tileDimensions: { width: tileWidth.toFixed(2), height: tileHeight.toFixed(2) },
    sceneCoords: { x: sceneCoords.x, y: sceneCoords.y },
    tileCenterScene: {
      x: (sceneCoords.x + tileWidth / 2).toFixed(2),
      y: (sceneCoords.y + tileHeight / 2).toFixed(2)
    },
    roundTripMap: { x: backToMap.x, y: backToMap.y },
    roundTripMatch: (backToMap.x === tileX && backToMap.y === tileY),
    topology: { isHex: isHex, isIso: isIso },
    tileData: tileInfo
  };
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ TILE DEBUG INFO: (' + tileX + ', ' + tileY + ')' + ' '.repeat(Math.max(0, 40 - (tileX + '').length - (tileY + '').length)) + '║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║ Odd Row: ' + data.isOddRow + ', Hex Offset: ' + data.hexRowOffset.toFixed(2));
  console.log('║ Tile Size: ' + data.tileDimensions.width + ' x ' + data.tileDimensions.height + ' units');
  console.log('║ Scene Position: (' + data.sceneCoords.x + ', ' + data.sceneCoords.y + ')');
  console.log('║ Tile Center: (' + data.tileCenterScene.x + ', ' + data.tileCenterScene.y + ')');
  console.log('║ Round-Trip Match: ' + data.roundTripMatch);
  if (!data.roundTripMatch) {
    console.log('║ ⚠️  ERROR: Round-trip returned (' + backToMap.x + ', ' + backToMap.y + ')');
  }
  if (tileInfo) {
    console.log('║ Terrain: ' + tileInfo.terrain + ', Known: ' + tileInfo.known);
    console.log('║ Units: ' + tileInfo.hasUnits + ', City: ' + tileInfo.hasCity);
  }
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  hexLog('TILE-DEBUG', 'Tile detailed info', data);
  return data;
}

/**
 * Log hex neighbor calculations for a specific tile
 * Call from browser console: hexLogNeighbors(x, y)
 */
function hexLogNeighbors(tileX, tileY) {
  if (typeof map === 'undefined' || !map) {
    console.log('[HEX-DEBUG] Map not available');
    return null;
  }
  
  var isHex = typeof topo_has_flag !== 'undefined' && topo_has_flag(TF_HEX);
  var isIso = typeof topo_has_flag !== 'undefined' && topo_has_flag(TF_ISO);
  var isOddRow = tileY % 2 === 1;
  
  // Calculate neighbor positions based on hex topology
  var neighbors = [];
  
  if (isHex && !isIso) {
    // Pure hex: N, S, E, W, NE, SW
    var neighborDeltas = [
      { name: 'N', dx: 0, dy: -1 },
      { name: 'S', dx: 0, dy: 1 },
      { name: 'E', dx: 1, dy: 0 },
      { name: 'W', dx: -1, dy: 0 },
      { name: 'NE', dx: isOddRow ? 1 : 0, dy: -1 },
      { name: 'SW', dx: isOddRow ? 0 : -1, dy: 1 }
    ];
    neighbors = neighborDeltas;
  } else if (isHex && isIso) {
    // Iso-hex: N, S, E, W, NW, SE  
    var neighborDeltas = [
      { name: 'N', dx: 0, dy: -1 },
      { name: 'S', dx: 0, dy: 1 },
      { name: 'E', dx: 1, dy: 0 },
      { name: 'W', dx: -1, dy: 0 },
      { name: 'NW', dx: isOddRow ? 0 : -1, dy: -1 },
      { name: 'SE', dx: isOddRow ? 1 : 0, dy: 1 }
    ];
    neighbors = neighborDeltas;
  } else {
    // Square: All 8 directions
    var neighborDeltas = [
      { name: 'N', dx: 0, dy: -1 },
      { name: 'S', dx: 0, dy: 1 },
      { name: 'E', dx: 1, dy: 0 },
      { name: 'W', dx: -1, dy: 0 },
      { name: 'NE', dx: 1, dy: -1 },
      { name: 'NW', dx: -1, dy: -1 },
      { name: 'SE', dx: 1, dy: 1 },
      { name: 'SW', dx: -1, dy: 1 }
    ];
    neighbors = neighborDeltas;
  }
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ NEIGHBOR DEBUG INFO: Tile (' + tileX + ', ' + tileY + ')' + ' '.repeat(Math.max(0, 33 - (tileX + '').length - (tileY + '').length)) + '║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║ Topology: ' + (isHex ? (isIso ? 'Iso-Hex' : 'Pure-Hex') : 'Square'));
  console.log('║ Row Type: ' + (isOddRow ? 'Odd (staggered)' : 'Even'));
  console.log('║');
  console.log('║ NEIGHBORS:');
  
  var neighborData = [];
  for (var i = 0; i < neighbors.length; i++) {
    var n = neighbors[i];
    var nx = tileX + n.dx;
    var ny = tileY + n.dy;
    var valid = nx >= 0 && nx < map.xsize && ny >= 0 && ny < map.ysize;
    var scenePos = valid ? map_to_scene_coords(nx, ny) : null;
    
    console.log('║   ' + n.name.padEnd(3) + ': (' + nx + ', ' + ny + ')' + 
      (valid ? ' Scene: (' + scenePos.x + ', ' + scenePos.y + ')' : ' [out of bounds]'));
    
    neighborData.push({
      direction: n.name,
      tileCoords: { x: nx, y: ny },
      valid: valid,
      scenePos: scenePos
    });
  }
  
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  hexLog('NEIGHBORS-DEBUG', 'Neighbor calculations', {
    centerTile: { x: tileX, y: tileY },
    isOddRow: isOddRow,
    topology: isHex ? (isIso ? 'iso-hex' : 'pure-hex') : 'square',
    neighbors: neighborData
  });
  
  return neighborData;
}

/**
 * Log click-to-tile conversion for debugging mouse interaction
 * Call from browser console: hexLogClick(canvasX, canvasY)
 */
function hexLogClick(canvasX, canvasY) {
  if (typeof map === 'undefined' || !map || typeof mouse === 'undefined') {
    console.log('[HEX-DEBUG] Map or mouse not available');
    return null;
  }
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ CLICK-TO-TILE DEBUG: Canvas (' + canvasX + ', ' + canvasY + ')' + ' '.repeat(Math.max(0, 27 - (canvasX + '').length - (canvasY + '').length)) + '║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  
  // Try to get the tile using the raycast method
  var tile = null;
  if (typeof webgl_canvas_pos_to_tile !== 'undefined') {
    tile = webgl_canvas_pos_to_tile(canvasX, canvasY);
  }
  
  if (tile) {
    console.log('║ Result Tile: (' + tile.x + ', ' + tile.y + ') Index: ' + tile.index);
    
    // Get more info about the tile
    var sceneCoords = map_to_scene_coords(tile.x, tile.y);
    console.log('║ Tile Scene Position: (' + sceneCoords.x + ', ' + sceneCoords.y + ')');
    
    if (typeof tile_terrain !== 'undefined' && tile_terrain(tile)) {
      console.log('║ Terrain: ' + tile_terrain(tile).name);
    }
    
    hexLog('CLICK-DEBUG', 'Click to tile conversion', {
      canvasPos: { x: canvasX, y: canvasY },
      tileResult: { x: tile.x, y: tile.y, index: tile.index },
      scenePos: sceneCoords
    });
  } else {
    console.log('║ Result: No tile found at this position');
    hexLog('CLICK-DEBUG', 'Click to tile - no tile found', {
      canvasPos: { x: canvasX, y: canvasY }
    });
  }
  
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  return tile;
}

/**
 * Log rendering constants and verify they are correct for hex maps
 * Call from browser console: hexLogRenderingConstants()
 */
function hexLogRenderingConstants() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ HEX RENDERING CONSTANTS VERIFICATION                       ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  
  var expected = {
    HEX_HEIGHT_FACTOR: Math.sqrt(3) / 2, // ~0.866
    HEX_STAGGER: 0.5
  };
  
  var actual = {
    HEX_HEIGHT_FACTOR: typeof HEX_HEIGHT_FACTOR !== 'undefined' ? HEX_HEIGHT_FACTOR : undefined,
    HEX_STAGGER: typeof HEX_STAGGER !== 'undefined' ? HEX_STAGGER : undefined,
    HEX_CENTER_OFFSET_X: typeof HEX_CENTER_OFFSET_X !== 'undefined' ? HEX_CENTER_OFFSET_X : undefined,
    HEX_CENTER_OFFSET_Y: typeof HEX_CENTER_OFFSET_Y !== 'undefined' ? HEX_CENTER_OFFSET_Y : undefined,
    MAP_X_OFFSET: MAP_X_OFFSET,
    MAP_Y_OFFSET: MAP_Y_OFFSET
  };
  
  console.log('║');
  console.log('║ HEX_HEIGHT_FACTOR:');
  console.log('║   Actual: ' + (actual.HEX_HEIGHT_FACTOR !== undefined ? actual.HEX_HEIGHT_FACTOR.toFixed(6) : 'UNDEFINED'));
  console.log('║   Expected: ' + expected.HEX_HEIGHT_FACTOR.toFixed(6) + ' (sqrt(3)/2)');
  console.log('║   Match: ' + (actual.HEX_HEIGHT_FACTOR !== undefined && Math.abs(actual.HEX_HEIGHT_FACTOR - expected.HEX_HEIGHT_FACTOR) < 0.0001 ? '✓' : '✗'));
  console.log('║');
  console.log('║ HEX_STAGGER:');
  console.log('║   Actual: ' + (actual.HEX_STAGGER !== undefined ? actual.HEX_STAGGER : 'UNDEFINED'));
  console.log('║   Expected: ' + expected.HEX_STAGGER);
  console.log('║   Match: ' + (actual.HEX_STAGGER === expected.HEX_STAGGER ? '✓' : '✗'));
  console.log('║');
  console.log('║ HEX_CENTER_OFFSET_X: ' + (actual.HEX_CENTER_OFFSET_X !== undefined ? actual.HEX_CENTER_OFFSET_X : 'UNDEFINED'));
  console.log('║ HEX_CENTER_OFFSET_Y: ' + (actual.HEX_CENTER_OFFSET_Y !== undefined ? actual.HEX_CENTER_OFFSET_Y : 'UNDEFINED'));
  console.log('║ MAP_X_OFFSET: ' + actual.MAP_X_OFFSET);
  console.log('║ MAP_Y_OFFSET: ' + actual.MAP_Y_OFFSET);
  
  if (typeof map !== 'undefined' && map) {
    var tileWidth = mapview_model_width / map.xsize;
    var tileHeight = (mapview_model_height / map.ysize) * (actual.HEX_HEIGHT_FACTOR || 1);
    console.log('║');
    console.log('║ CALCULATED TILE DIMENSIONS:');
    console.log('║   Tile Width: ' + tileWidth.toFixed(4) + ' units');
    console.log('║   Tile Height: ' + tileHeight.toFixed(4) + ' units');
    console.log('║   Aspect Ratio: ' + (tileWidth / tileHeight).toFixed(4));
    console.log('║   Expected Hex Ratio: ' + (2 / Math.sqrt(3)).toFixed(4) + ' (2/sqrt(3))');
  }
  
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  hexLog('CONSTANTS-DEBUG', 'Rendering constants verification', { expected: expected, actual: actual });
  
  return { expected: expected, actual: actual };
}

/**
 * Generate a visual hex grid representation showing tile boundaries
 * Call from browser console: hexLogGrid(startX, startY, width, height)
 */
function hexLogGrid(startX, startY, gridWidth, gridHeight) {
  startX = startX || 0;
  startY = startY || 0;
  gridWidth = gridWidth || 8;
  gridHeight = gridHeight || 6;
  
  if (typeof map === 'undefined' || !map) {
    console.log('[HEX-DEBUG] Map not available');
    return;
  }
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ HEX GRID VISUALIZATION                                     ║');
  console.log('║ Start: (' + startX + ',' + startY + ') Size: ' + gridWidth + 'x' + gridHeight + ' '.repeat(Math.max(0, 30 - (startX + '').length - (startY + '').length - (gridWidth + '').length - (gridHeight + '').length)) + '║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  
  var tileWidth = mapview_model_width / map.xsize;
  var isHex = typeof topo_has_flag !== 'undefined' && topo_has_flag(TF_HEX);
  
  // Create ASCII representation of hex grid
  for (var y = startY; y < startY + gridHeight && y < map.ysize; y++) {
    var isOddRow = y % 2 === 1;
    var indent = isOddRow ? '  ' : '';
    var line = indent;
    
    for (var x = startX; x < startX + gridWidth && x < map.xsize; x++) {
      var scenePos = map_to_scene_coords(x, y);
      // Show first digit of X position for quick visual reference
      var char = (Math.floor(scenePos.x / 100) % 10).toString();
      
      if (isHex) {
        line += ' /' + char + '\\ ';
      } else {
        line += '[' + char + ']';
      }
    }
    
    console.log('║ Row ' + y.toString().padStart(2) + (isOddRow ? ' (odd) ' : ' (even)') + ': ' + line);
  }
  
  console.log('║');
  console.log('║ Legend: Numbers show scene X position (hundreds digit)');
  if (isHex) {
    console.log('║ Hex shape: / \\ shows stagger pattern');
  }
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  hexLog('GRID-DEBUG', 'Grid visualization', {
    startX: startX, startY: startY,
    gridWidth: gridWidth, gridHeight: gridHeight
  });
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
    var indent = (y % 2 === 0) ? '  ' : ''; // Hex stagger for even rows
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
 * 
 * For WebGPU/WebGL canvases, we use toDataURL() since direct drawImage doesn't work.
 * The renderer must be created with preserveDrawingBuffer: true for this to work.
 */
function captureAsciiScreenshot() {
  // Use maprenderer.domElement which is the actual WebGPU/WebGL canvas
  var canvas = typeof maprenderer !== 'undefined' && maprenderer ? maprenderer.domElement : null;
  if (!canvas) {
    console.log('[HEX-DEBUG] WebGPU renderer canvas not found. Is the game loaded?');
    return null;
  }
  
  var width = canvas.width;
  var height = canvas.height;
  
  // Target ASCII dimensions (characters) - high resolution version
  var asciiWidth = 160;
  var asciiHeight = 50;
  
  console.log('[HEX-DEBUG] Capturing screenshot from WebGPU canvas (' + width + 'x' + height + ')...');
  
  // For WebGPU/WebGL canvases, we need to use toDataURL and load as image
  var dataURL;
  try {
    dataURL = canvas.toDataURL('image/png');
  } catch (e) {
    console.log('[HEX-DEBUG] Cannot get canvas data URL: ' + e.message);
    return null;
  }
  
  // Create an image from the data URL and process it asynchronously
  var img = new Image();
  img.onload = function() {
    // Create a temporary 2D canvas to process the image
    var tempCanvas = document.createElement('canvas');
    tempCanvas.width = asciiWidth;
    tempCanvas.height = asciiHeight;
    var ctx = tempCanvas.getContext('2d');
    
    // Draw the image scaled down to ASCII dimensions
    ctx.drawImage(img, 0, 0, asciiWidth, asciiHeight);
    
    // Get pixel data
    var imageData;
    try {
      imageData = ctx.getImageData(0, 0, asciiWidth, asciiHeight);
    } catch (e) {
      console.log('[HEX-DEBUG] Cannot read canvas pixels: ' + e.message);
      return;
    }
    
    var pixels = imageData.data;
    
    // Extended ASCII character ramp from dark to light (more detail)
    var asciiChars = ' .\'`^",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$';
    
    var asciiLines = [];
    asciiLines.push('╔' + '═'.repeat(asciiWidth + 2) + '╗');
    asciiLines.push('║ HEX MAP ASCII SCREENSHOT (' + width + 'x' + height + ' → ' + asciiWidth + 'x' + asciiHeight + ')' + ' '.repeat(Math.max(0, asciiWidth - 55)) + ' ║');
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
    hexLog('SCREENSHOT', 'ASCII screenshot captured (high-res)', {
      originalSize: width + 'x' + height,
      asciiSize: asciiWidth + 'x' + asciiHeight
    });
  };
  
  img.onerror = function() {
    console.log('[HEX-DEBUG] Failed to load canvas image data');
  };
  
  img.src = dataURL;
  
  return 'Screenshot capture initiated (async). Check console for output.';
}

/**
 * Capture a smaller, more compact ASCII screenshot
 * Call from browser console: captureAsciiScreenshotCompact()
 * 
 * For WebGPU/WebGL canvases, we use toDataURL() since direct drawImage doesn't work.
 */
function captureAsciiScreenshotCompact() {
  // Use maprenderer.domElement which is the actual WebGPU/WebGL canvas
  var canvas = typeof maprenderer !== 'undefined' && maprenderer ? maprenderer.domElement : null;
  if (!canvas) {
    console.log('[HEX-DEBUG] WebGPU renderer canvas not found. Is the game loaded?');
    return null;
  }
  
  var width = canvas.width;
  var height = canvas.height;
  
  // Smaller target for compact view
  var asciiWidth = 80;
  var asciiHeight = 25;
  
  console.log('[HEX-DEBUG] Capturing compact screenshot from WebGPU canvas...');
  
  // For WebGPU/WebGL canvases, we need to use toDataURL and load as image
  var dataURL;
  try {
    dataURL = canvas.toDataURL('image/png');
  } catch (e) {
    console.log('[HEX-DEBUG] Cannot get canvas data URL: ' + e.message);
    return null;
  }
  
  // Create an image from the data URL and process it asynchronously
  var img = new Image();
  img.onload = function() {
    var tempCanvas = document.createElement('canvas');
    tempCanvas.width = asciiWidth;
    tempCanvas.height = asciiHeight;
    var ctx = tempCanvas.getContext('2d');
    
    ctx.drawImage(img, 0, 0, asciiWidth, asciiHeight);
    
    var imageData;
    try {
      imageData = ctx.getImageData(0, 0, asciiWidth, asciiHeight);
    } catch (e) {
      console.log('[HEX-DEBUG] Cannot read canvas pixels: ' + e.message);
      return;
    }
    
    var pixels = imageData.data;
    
    // Block characters for more detail
    var blockChars = ' ░▒▓█';
    
    var asciiLines = [];
    asciiLines.push('┌─ HEX MAP COMPACT (' + width + 'x' + height + ') ' + '─'.repeat(Math.max(0, asciiWidth - 30)) + '┐');
    
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
    
    hexLog('SCREENSHOT-COMPACT', 'Compact ASCII screenshot captured', {
      originalSize: width + 'x' + height,
      asciiSize: asciiWidth + 'x' + asciiHeight
    });
  };
  
  img.onerror = function() {
    console.log('[HEX-DEBUG] Failed to load canvas image data');
  };
  
  img.src = dataURL;
  
  return 'Compact screenshot capture initiated (async). Check console for output.';
}

/**
 * Capture a high-resolution ASCII screenshot with color approximation
 * Call from browser console: captureAsciiScreenshotHiRes()
 * 
 * This version uses a larger character set and higher resolution for better detail.
 */
function captureAsciiScreenshotHiRes() {
  // Use maprenderer.domElement which is the actual WebGPU/WebGL canvas
  var canvas = typeof maprenderer !== 'undefined' && maprenderer ? maprenderer.domElement : null;
  if (!canvas) {
    console.log('[HEX-DEBUG] WebGPU renderer canvas not found. Is the game loaded?');
    return null;
  }
  
  var width = canvas.width;
  var height = canvas.height;
  
  // High resolution target (200x60 characters)
  var asciiWidth = 200;
  var asciiHeight = 60;
  
  console.log('[HEX-DEBUG] Capturing high-res screenshot from WebGPU canvas (' + width + 'x' + height + ')...');
  
  // For WebGPU/WebGL canvases, we need to use toDataURL and load as image
  var dataURL;
  try {
    dataURL = canvas.toDataURL('image/png');
  } catch (e) {
    console.log('[HEX-DEBUG] Cannot get canvas data URL: ' + e.message);
    return null;
  }
  
  // Create an image from the data URL and process it asynchronously
  var img = new Image();
  img.onload = function() {
    var tempCanvas = document.createElement('canvas');
    tempCanvas.width = asciiWidth;
    tempCanvas.height = asciiHeight;
    var ctx = tempCanvas.getContext('2d');
    
    ctx.drawImage(img, 0, 0, asciiWidth, asciiHeight);
    
    var imageData;
    try {
      imageData = ctx.getImageData(0, 0, asciiWidth, asciiHeight);
    } catch (e) {
      console.log('[HEX-DEBUG] Cannot read canvas pixels: ' + e.message);
      return;
    }
    
    var pixels = imageData.data;
    
    // Extended character set for maximum detail (dark to light)
    var asciiChars = ' .\'`^",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$';
    
    var asciiLines = [];
    // Use repeat method for consistent border width
    asciiLines.push('╔' + '═'.repeat(asciiWidth + 2) + '╗');
    var titleLine = '║ HIGH-RES HEX MAP ASCII SCREENSHOT (' + width + 'x' + height + ' → ' + asciiWidth + 'x' + asciiHeight + ')';
    asciiLines.push(titleLine + ' '.repeat(Math.max(0, asciiWidth - titleLine.length + 3)) + '║');
    asciiLines.push('╠' + '═'.repeat(asciiWidth + 2) + '╣');
    
    for (var y = 0; y < asciiHeight; y++) {
      var line = '║ ';
      for (var x = 0; x < asciiWidth; x++) {
        var idx = (y * asciiWidth + x) * 4;
        var r = pixels[idx];
        var g = pixels[idx + 1];
        var b = pixels[idx + 2];
        var a = pixels[idx + 3];
        
        // Calculate brightness with gamma correction for better visual output
        var brightness = Math.pow((0.299 * r + 0.587 * g + 0.114 * b) / 255, 0.8) * 255 * (a / 255);
        
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
      ascii: asciiArt,
      type: 'high-res'
    };
    
    console.log('\n' + asciiArt + '\n');
    hexLog('SCREENSHOT-HIRES', 'High-resolution ASCII screenshot captured', {
      originalSize: width + 'x' + height,
      asciiSize: asciiWidth + 'x' + asciiHeight
    });
  };
  
  img.onerror = function() {
    console.log('[HEX-DEBUG] Failed to load canvas image data');
  };
  
  img.src = dataURL;
  
  return 'High-res screenshot capture initiated (async). Check console for output.';
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
  
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  
  // Available Debug Functions
  console.log('║ AVAILABLE DEBUG FUNCTIONS                                          ║');
  console.log('║   startHexDebug()              - Run automated debug session       ║');
  console.log('║   stopHexDebug()               - End debug session                 ║');
  console.log('║   hexDebugSummary()            - Show this summary                 ║');
  console.log('║   captureAsciiScreenshot()     - Standard ASCII screenshot (160x50)║');
  console.log('║   captureAsciiScreenshotCompact() - Compact screenshot (80x25)     ║');
  console.log('║   captureAsciiScreenshotHiRes() - High-res screenshot (200x60)     ║');
  console.log('║   hexLogTile(x, y)             - Debug specific tile               ║');
  console.log('║   hexLogNeighbors(x, y)        - Debug tile neighbors              ║');
  console.log('║   hexLogClick(canvasX, canvasY) - Debug click-to-tile conversion   ║');
  console.log('║   hexLogRenderingConstants()   - Verify rendering constants        ║');
  console.log('║   hexLogGrid(x, y, w, h)       - ASCII hex grid visualization      ║');
  console.log('║   console.table(hexDebugData.logs) - View all debug logs           ║');
  
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Quick start: Run startHexDebug() to begin automated debug session.');
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
  
  // Apply hex row offset for even rows (even-r offset coordinate system)
  // Freeciv uses even-r where even rows are staggered
  const rowOffset = (y % 2 === 0) ? tileWidth * HEX_STAGGER : 0;
  
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
  
  // Calculate row offset based on Y (even rows are staggered in even-r system)
  const rowOffset = (tileY % 2 === 0) ? tileWidth * HEX_STAGGER : 0;
  
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
  
  // Check adjacent tiles including all possible hex neighbors.
  // We check a wider neighborhood to account for potential estimation errors
  // at tile boundaries. For hex grids, the actual neighbors depend on row parity,
  // but since our initial estimate might be off by one row, we check all possible
  // neighbor positions from both even and odd row perspectives.
  const neighbors = [
    { dx: -1, dy: 0 },   // left
    { dx: 1, dy: 0 },    // right
    { dx: 0, dy: -1 },   // up (covers both row parities)
    { dx: 0, dy: 1 },    // down (covers both row parities)
    // Include all diagonal neighbors for both even and odd row scenarios
    { dx: -1, dy: -1 },  // upper-left (even row neighbor)
    { dx: 1, dy: -1 },   // upper-right (odd row neighbor)
    { dx: -1, dy: 1 },   // lower-left (even row neighbor)
    { dx: 1, dy: 1 },    // lower-right (odd row neighbor)
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
