/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
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

/**
 * Comprehensive test suite for improved hexagonal coordinate functions
 * Tests boundary conditions, edge cases, and robustness
 */

const fs = require('fs');
const path = require('path');

// Load hexagon utility files
const hexagon_base = fs.readFileSync(path.join(__dirname, '../src/main/webapp/javascript/webgl/maputil_hexagon.js'), 'utf8');
const hexagon_improved = fs.readFileSync(path.join(__dirname, '../src/main/webapp/javascript/webgl/maputil_hexagon_improved.js'), 'utf8');

// Evaluate code in a mock environment
global.map = { xsize: 40, ysize: 30 };
global.mapview_model_width = 1000;
global.mapview_model_height = 750;
global.console = console;

eval(hexagon_base);
eval(hexagon_improved);

console.log("==================================================");
console.log("  IMPROVED HEXAGONAL COORDINATE TEST SUITE");
console.log("==================================================\n");

let totalTests = 0;
let passedTests = 0;

function assertTrue(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`✓ ${message}`);
    passedTests++;
  } else {
    console.log(`✗ FAILED: ${message}`);
  }
}

function assertNotNull(value, message) {
  assertTrue(value !== null && value !== undefined, message);
}

function assertEquals(actual, expected, message) {
  assertTrue(actual === expected, `${message} (expected: ${expected}, got: ${actual})`);
}

// ==================== SHARED UTILITY FUNCTION TESTS ====================

console.log("=== Testing get_hexagon_dimensions() ===");

const dims = get_hexagon_dimensions();
assertNotNull(dims, "get_hexagon_dimensions returns non-null");
assertTrue(dims.hexRadius > 0, "hexRadius is positive");
assertTrue(dims.hexWidth === dims.hexRadius * 2, "hexWidth equals 2 * hexRadius");
assertTrue(dims.hexHeight > 0, "hexHeight is positive");
assertTrue(dims.vertSpace === dims.hexHeight * 0.75, "vertSpace equals 0.75 * hexHeight");

// Test with invalid map
const originalMap = global.map;
global.map = null;
const nullDims = get_hexagon_dimensions();
assertEquals(nullDims, null, "get_hexagon_dimensions returns null for invalid map");
global.map = originalMap;

console.log("");

// ==================== COORDINATE CONVERSION TESTS ====================

console.log("=== Testing Coordinate Conversion Round-Trip (Boundary Cases) ===");

const boundaryTestCases = [
  { x: 0, y: 0, desc: "Top-left corner" },
  { x: map.xsize - 1, y: 0, desc: "Top-right corner" },
  { x: 0, y: map.ysize - 1, desc: "Bottom-left corner" },
  { x: map.xsize - 1, y: map.ysize - 1, desc: "Bottom-right corner" },
  { x: Math.floor(map.xsize / 2), y: 0, desc: "Top center" },
  { x: Math.floor(map.xsize / 2), y: map.ysize - 1, desc: "Bottom center" },
  { x: 0, y: Math.floor(map.ysize / 2), desc: "Left center" },
  { x: map.xsize - 1, y: Math.floor(map.ysize / 2), desc: "Right center" },
  { x: Math.floor(map.xsize / 2), y: Math.floor(map.ysize / 2), desc: "Map center" },
  { x: 1, y: 1, desc: "Near corner (odd row)" },
  { x: 1, y: 2, desc: "Near corner (even row)" },
];

let roundTripPassed = 0;
let roundTripFailed = 0;

boundaryTestCases.forEach(testCase => {
  const scene = map_to_scene_coords_hexagon(testCase.x, testCase.y);
  if (scene) {
    const back = scene_to_map_coords_hexagon(scene.x, scene.y);
    if (back && back.x === testCase.x && back.y === testCase.y) {
      console.log(`✓ ${testCase.desc}: (${testCase.x},${testCase.y}) -> (${Math.round(scene.x)},${Math.round(scene.y)}) -> (${back.x},${back.y})`);
      roundTripPassed++;
      passedTests++;
    } else {
      console.log(`✗ FAILED ${testCase.desc}: (${testCase.x},${testCase.y}) -> scene -> (${back ? back.x : 'null'},${back ? back.y : 'null'})`);
      roundTripFailed++;
    }
    totalTests++;
  }
});

console.log(`\nRound-trip test: ${roundTripPassed} passed, ${roundTripFailed} failed\n`);

// ==================== IMPROVED CONVERSION TESTS ====================

console.log("=== Testing Improved Conversion Accuracy ===");

// Test that improved method returns same or better results
let improvedMatchCount = 0;
const testPoints = [
  { x: 0, y: 0 },
  { x: 10, y: 5 },
  { x: 20, y: 15 },
  { x: 39, y: 29 },
  { x: 5, y: 1 },
  { x: 5, y: 2 },
];

testPoints.forEach(pt => {
  const scene = map_to_scene_coords_hexagon(pt.x, pt.y);
  if (scene) {
    const basic = scene_to_map_coords_hexagon(scene.x, scene.y);
    const improved = scene_to_map_coords_hexagon_improved(scene.x, scene.y);
    
    if (basic && improved) {
      const basicMatch = (basic.x === pt.x && basic.y === pt.y);
      const improvedMatch = (improved.x === pt.x && improved.y === pt.y);
      
      if (improvedMatch) {
        improvedMatchCount++;
      }
      
      const status = improvedMatch ? "✓" : "✗";
      console.log(`${status} Tile (${pt.x},${pt.y}): basic=(${basic.x},${basic.y}), improved=(${improved.x},${improved.y})`);
      
      // Improved should be at least as good as basic
      assertTrue(improvedMatch || !basicMatch, `Improved method for tile (${pt.x},${pt.y})`);
    }
  }
});

console.log(`\nImproved method accuracy: ${improvedMatchCount}/${testPoints.length} exact matches\n`);

// ==================== NULL SAFETY TESTS ====================

console.log("=== Testing Null Safety and Error Handling ===");

// Test with null map
global.map = null;
const nullResult1 = map_to_scene_coords_hexagon(5, 5);
assertEquals(nullResult1, null, "map_to_scene_coords_hexagon handles null map");

const nullResult2 = scene_to_map_coords_hexagon(100, 100);
assertEquals(nullResult2, null, "scene_to_map_coords_hexagon handles null map");

const nullResult3 = scene_to_map_coords_hexagon_improved(100, 100);
assertEquals(nullResult3, null, "scene_to_map_coords_hexagon_improved handles null map");

global.map = originalMap;
console.log("");

// ==================== HEX NEIGHBOR TESTS ====================

console.log("=== Testing Hexagon Neighbor Calculations ===");

// Test neighbor count
const centerTile = { x: 20, y: 15 };
const centerNeighbors = get_hex_neighbors(centerTile.x, centerTile.y);
assertEquals(centerNeighbors.length, 6, "Center tile has 6 neighbors");

// Test corner tiles (should have fewer neighbors)
const cornerTile = { x: 0, y: 0 };
const cornerNeighbors = get_hex_neighbors(cornerTile.x, cornerTile.y);
assertTrue(cornerNeighbors.length < 6, "Corner tile has fewer than 6 neighbors");
assertTrue(cornerNeighbors.length >= 2, "Corner tile has at least 2 neighbors");

// Test edge tiles
const edgeTile = { x: 0, y: 15 };
const edgeNeighbors = get_hex_neighbors(edgeTile.x, edgeTile.y);
assertTrue(edgeNeighbors.length < 6, "Edge tile has fewer than 6 neighbors");
assertTrue(edgeNeighbors.length >= 3, "Edge tile has at least 3 neighbors");

// Test invalid inputs
const invalidNeighbors = get_hex_neighbors(-1, -1);
assertEquals(invalidNeighbors.length, 0, "Invalid tile coordinates return empty array");

// Verify all neighbors are within bounds
centerNeighbors.forEach(neighbor => {
  assertTrue(neighbor.x >= 0 && neighbor.x < map.xsize, `Neighbor x=${neighbor.x} is in bounds`);
  assertTrue(neighbor.y >= 0 && neighbor.y < map.ysize, `Neighbor y=${neighbor.y} is in bounds`);
});

console.log("");

// ==================== HEX DISTANCE TESTS ====================

console.log("=== Testing Hexagon Distance Calculations ===");

// Test distance to self
const dist0 = hex_distance(5, 5, 5, 5);
assertEquals(dist0, 0, "Distance to self is 0");

// Test distance to immediate neighbors
const tile = { x: 10, y: 10 };
const neighbors = get_hex_neighbors(tile.x, tile.y);
neighbors.forEach(neighbor => {
  const dist = hex_distance(tile.x, tile.y, neighbor.x, neighbor.y);
  assertEquals(dist, 1, `Distance to neighbor (${neighbor.x},${neighbor.y}) is 1`);
});

// Test distance symmetry
const dist1to2 = hex_distance(5, 5, 10, 10);
const dist2to1 = hex_distance(10, 10, 5, 5);
assertEquals(dist1to2, dist2to1, "Distance is symmetric");

// Test invalid coordinates
const invalidDist = hex_distance(-1, -1, 5, 5);
assertEquals(invalidDist, -1, "Invalid coordinates return -1");

console.log("");

// ==================== HEX ADJACENCY TESTS ====================

console.log("=== Testing Hexagon Adjacency ===");

// Test self-adjacency
const selfAdj = are_hexagons_adjacent(5, 5, 5, 5);
assertEquals(selfAdj, false, "Tile is not adjacent to itself");

// Test neighbor adjacency
const tile2 = { x: 15, y: 15 };
const neighbors2 = get_hex_neighbors(tile2.x, tile2.y);
neighbors2.forEach(neighbor => {
  const isAdj = are_hexagons_adjacent(tile2.x, tile2.y, neighbor.x, neighbor.y);
  assertTrue(isAdj, `Tile (${tile2.x},${tile2.y}) is adjacent to neighbor (${neighbor.x},${neighbor.y})`);
});

// Test distant tiles
const distantAdj = are_hexagons_adjacent(0, 0, 39, 29);
assertEquals(distantAdj, false, "Distant tiles are not adjacent");

console.log("");

// ==================== EDGE CASE TESTS ====================

console.log("=== Testing Edge Cases ===");

// Test odd vs even row differences
const evenRowTile = { x: 10, y: 10 };
const oddRowTile = { x: 10, y: 11 };

const evenNeighbors = get_hex_neighbors(evenRowTile.x, evenRowTile.y);
const oddNeighbors = get_hex_neighbors(oddRowTile.x, oddRowTile.y);

// Both should have 6 neighbors if not at edge
if (evenRowTile.x > 0 && evenRowTile.x < map.xsize - 1) {
  assertEquals(evenNeighbors.length, 6, "Even row interior tile has 6 neighbors");
}
if (oddRowTile.x > 0 && oddRowTile.x < map.xsize - 1) {
  assertEquals(oddNeighbors.length, 6, "Odd row interior tile has 6 neighbors");
}

// Test that odd and even rows have different neighbor patterns
const evenHasNorthEast = evenNeighbors.some(n => n.x === evenRowTile.x && n.y === evenRowTile.y - 1);
const oddHasNorthEast = oddNeighbors.some(n => n.x === oddRowTile.x + 1 && n.y === oddRowTile.y - 1);
assertTrue(evenHasNorthEast, "Even row has NE neighbor at (x, y-1)");
assertTrue(oddHasNorthEast, "Odd row has NE neighbor at (x+1, y-1)");

console.log("");

// ==================== SUMMARY ====================

console.log("==================================================");
console.log("  TEST RESULTS SUMMARY");
console.log("==================================================");
console.log(`Total tests: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${totalTests - passedTests}`);
console.log(`Success rate: ${Math.round(100 * passedTests / totalTests)}%`);

if (passedTests === totalTests) {
  console.log("\n✓ ALL TESTS PASSED");
  console.log("==================================================\n");
  process.exit(0);
} else {
  console.log("\n✗ SOME TESTS FAILED");
  console.log("==================================================\n");
  process.exit(1);
}
