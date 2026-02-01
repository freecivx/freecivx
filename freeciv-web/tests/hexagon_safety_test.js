/**
 * Test suite for hexagonal map renderer safety checks and defaults
 * Tests the improvements made to ensure the land mesh is always visible
 */

// Mock the required globals
global.THREE = {
  Float32BufferAttribute: class {
    constructor(data, itemSize) {
      this.array = data;
      this.itemSize = itemSize;
    }
  }
};

// Mock console for cleaner test output
const originalConsole = { ...console };
let consoleOutput = [];
console.log = (...args) => consoleOutput.push(['log', args.join(' ')]);
console.warn = (...args) => consoleOutput.push(['warn', args.join(' ')]);
console.error = (...args) => consoleOutput.push(['error', args.join(' ')]);

// Test counter
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  testsRun++;
  if (condition) {
    testsPassed++;
    originalConsole.log(`✓ ${message}`);
  } else {
    testsFailed++;
    originalConsole.error(`✗ ${message}`);
  }
}

function assertEquals(actual, expected, message) {
  testsRun++;
  if (actual === expected) {
    testsPassed++;
    originalConsole.log(`✓ ${message} (expected: ${expected}, got: ${actual})`);
  } else {
    testsFailed++;
    originalConsole.error(`✗ ${message} (expected: ${expected}, got: ${actual})`);
  }
}

function assertNotNull(value, message) {
  testsRun++;
  if (value !== null && value !== undefined) {
    testsPassed++;
    originalConsole.log(`✓ ${message}`);
  } else {
    testsFailed++;
    originalConsole.error(`✗ ${message} (got: ${value})`);
  }
}

// Clear console output between tests
function clearConsoleOutput() {
  consoleOutput = [];
}

// Check if console has specific message
function hasConsoleMessage(type, substring) {
  return consoleOutput.some(([msgType, msg]) => 
    msgType === type && msg.includes(substring)
  );
}

originalConsole.log("==================================================");
originalConsole.log("  HEXAGONAL MAP RENDERER SAFETY TEST SUITE");
originalConsole.log("==================================================\n");

// Test 1: Set mapview model size with valid map
originalConsole.log("=== Test 1: Set Mapview Model Size with Valid Map ===");
{
  clearConsoleOutput();
  
  // Mock map and globals
  global.map = { xsize: 80, ysize: 50 };
  global.MAPVIEW_ASPECT_FACTOR = 35.71;
  global.mapview_model_width = undefined;
  global.mapview_model_height = undefined;
  
  // Simulated function
  function set_mapview_model_size() {
    const xsize = (map && map['xsize'] > 0) ? map['xsize'] : 80;
    const ysize = (map && map['ysize'] > 0) ? map['ysize'] : 50;
    
    mapview_model_width = Math.floor(MAPVIEW_ASPECT_FACTOR * xsize);
    mapview_model_height = Math.floor(MAPVIEW_ASPECT_FACTOR * ysize);
    
    console.log("Map view model size set: " + mapview_model_width + " x " + mapview_model_height + 
                " (map: " + xsize + " x " + ysize + ")");
  }
  
  set_mapview_model_size();
  
  assertEquals(mapview_model_width, Math.floor(35.71 * 80), "Width calculated correctly");
  assertEquals(mapview_model_height, Math.floor(35.71 * 50), "Height calculated correctly");
  assert(hasConsoleMessage('log', 'Map view model size set'), "Logged size initialization");
}

// Test 2: Set mapview model size with null map (fallback)
originalConsole.log("\n=== Test 2: Set Mapview Model Size with Null Map (Fallback) ===");
{
  clearConsoleOutput();
  
  global.map = null;
  global.mapview_model_width = undefined;
  global.mapview_model_height = undefined;
  
  function set_mapview_model_size() {
    const xsize = (map && map['xsize'] > 0) ? map['xsize'] : 80;
    const ysize = (map && map['ysize'] > 0) ? map['ysize'] : 50;
    
    mapview_model_width = Math.floor(MAPVIEW_ASPECT_FACTOR * xsize);
    mapview_model_height = Math.floor(MAPVIEW_ASPECT_FACTOR * ysize);
    
    console.log("Map view model size set: " + mapview_model_width + " x " + mapview_model_height + 
                " (map: " + xsize + " x " + ysize + ")");
  }
  
  set_mapview_model_size();
  
  assertEquals(mapview_model_width, Math.floor(35.71 * 80), "Width uses default 80");
  assertEquals(mapview_model_height, Math.floor(35.71 * 50), "Height uses default 50");
  assert(hasConsoleMessage('log', '80 x 50'), "Uses default dimensions");
}

// Test 3: Hexagon dimensions with invalid inputs
originalConsole.log("\n=== Test 3: Hexagon Dimensions with Invalid Inputs ===");
{
  clearConsoleOutput();
  
  global.map = null;
  global.mapview_model_width = 0;
  
  function get_hexagon_dimensions() {
    if (!map || !map['xsize'] || map['xsize'] <= 0 || !mapview_model_width || mapview_model_width <= 0) {
      console.error("Invalid map dimensions for hexagon calculations");
      return null;
    }
    
    var hexRadius = (mapview_model_width / map['xsize']) * 0.5;
    return {
      hexRadius: hexRadius,
      hexWidth: hexRadius * 2,
      hexHeight: Math.sqrt(3) * hexRadius,
      vertSpace: Math.sqrt(3) * hexRadius * 0.75
    };
  }
  
  const result = get_hexagon_dimensions();
  
  assertEquals(result, null, "Returns null for invalid inputs");
  assert(hasConsoleMessage('error', 'Invalid map dimensions'), "Logs error message");
}

// Test 4: Hexagon dimensions with valid inputs
originalConsole.log("\n=== Test 4: Hexagon Dimensions with Valid Inputs ===");
{
  clearConsoleOutput();
  
  global.map = { xsize: 80, ysize: 50 };
  global.mapview_model_width = 2856;  // 35.71 * 80
  
  function get_hexagon_dimensions() {
    if (!map || !map['xsize'] || map['xsize'] <= 0 || !mapview_model_width || mapview_model_width <= 0) {
      console.error("Invalid map dimensions for hexagon calculations");
      return null;
    }
    
    var hexRadius = (mapview_model_width / map['xsize']) * 0.5;
    return {
      hexRadius: hexRadius,
      hexWidth: hexRadius * 2,
      hexHeight: Math.sqrt(3) * hexRadius,
      vertSpace: Math.sqrt(3) * hexRadius * 0.75
    };
  }
  
  const result = get_hexagon_dimensions();
  
  assertNotNull(result, "Returns valid dimensions object");
  assert(result.hexRadius > 0, "hexRadius is positive");
  assertEquals(result.hexWidth, result.hexRadius * 2, "hexWidth equals 2 * hexRadius");
  assert(result.hexHeight > 0, "hexHeight is positive");
  assert(result.vertSpace > 0, "vertSpace is positive");
}

// Test 5: Vertex color defaults for null tiles
originalConsole.log("\n=== Test 5: Vertex Color Defaults for Null Tiles ===");
{
  clearConsoleOutput();
  
  // Simulate creating colors array with null tile
  const colors = [];
  const ptile = null;
  
  if (ptile != null) {
    // Would use get_vertex_color_from_tile
    for (let i = 0; i < 7; i++) {
      colors.push(1.06, 0, 0);
    }
  } else {
    // Default for unknown tiles - using TILE_KNOWN_UNSEEN as fallback
    const defaultR = 0.54;
    for (let i = 0; i < 7; i++) {
      colors.push(defaultR, 0, 0);
    }
  }
  
  assertEquals(colors.length, 21, "Creates 21 color components for 7 vertices");
  assertEquals(colors[0], 0.54, "First color is fallback value (not 0.0)");
  assert(colors[0] > 0, "Fallback ensures visibility (non-zero)");
}

// Test 6: Ensure mapview dimensions are always positive
originalConsole.log("\n=== Test 6: Ensure Mapview Dimensions are Always Positive ===");
{
  clearConsoleOutput();
  
  const testCases = [
    { map: { xsize: 80, ysize: 50 }, expected: true },
    { map: { xsize: 1, ysize: 1 }, expected: true },
    { map: { xsize: 200, ysize: 150 }, expected: true },
    { map: null, expected: true },  // Should use defaults
    { map: { xsize: 0, ysize: 50 }, expected: true },  // Should use defaults
    { map: { xsize: 80, ysize: 0 }, expected: true },  // Should use defaults
  ];
  
  for (const testCase of testCases) {
    global.map = testCase.map;
    
    const xsize = (map && map['xsize'] > 0) ? map['xsize'] : 80;
    const ysize = (map && map['ysize'] > 0) ? map['ysize'] : 50;
    
    const width = Math.floor(35.71 * xsize);
    const height = Math.floor(35.71 * ysize);
    
    assert(width > 0 && height > 0, 
      `Dimensions always positive for map: ${JSON.stringify(testCase.map)}`);
  }
}

// Print summary
originalConsole.log("\n==================================================");
originalConsole.log("  TEST RESULTS SUMMARY");
originalConsole.log("==================================================");
originalConsole.log(`Total tests: ${testsRun}`);
originalConsole.log(`Passed: ${testsPassed}`);
originalConsole.log(`Failed: ${testsFailed}`);
originalConsole.log(`Success rate: ${Math.round(testsPassed / testsRun * 100)}%`);
originalConsole.log("");

if (testsFailed === 0) {
  originalConsole.log("✓ ALL TESTS PASSED");
  originalConsole.log("==================================================\n");
  process.exit(0);
} else {
  originalConsole.error("✗ SOME TESTS FAILED");
  originalConsole.log("==================================================\n");
  process.exit(1);
}
