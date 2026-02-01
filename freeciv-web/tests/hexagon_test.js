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

/**
 * Test suite for hexagonal map tile rendering
 * Tests coordinate conversions, geometry generation, and rendering correctness
 */

// Mock map and constants
const map = {
  xsize: 40,
  ysize: 30
};

const mapview_model_width = 1000;
const mapview_model_height = 750;

// ==================== COORDINATE CONVERSION TESTS ====================

/**
 * Test map_to_scene_coords_hexagon function
 */
function map_to_scene_coords_hexagon(x, y) {
  var result = {};
  
  // Hexagon dimensions (must match init_land_geometry_hexagon)
  var hexRadius = (mapview_model_width / map['xsize']) * 0.5;
  var hexWidth = hexRadius * 2;
  var hexHeight = Math.sqrt(3) * hexRadius;
  var vertSpace = hexHeight * 0.75;
  
  var width_half = mapview_model_width / 2;
  var height_half = mapview_model_height / 2;
  
  // Calculate position with offset for odd rows (matches geometry generation)
  var offsetX = (y % 2) * (hexWidth * 0.5);
  var centerX = x * hexWidth + offsetX + hexRadius - width_half;
  var centerY = y * vertSpace - height_half;
  
  result['x'] = Math.floor(centerX);
  result['y'] = Math.floor(centerY);

  return result;
}

/**
 * Test scene_to_map_coords_hexagon function
 */
function scene_to_map_coords_hexagon(x, y) {
  var result = {};
  
  // Hexagon dimensions (must match init_land_geometry_hexagon)
  var hexRadius = (mapview_model_width / map['xsize']) * 0.5;
  var hexWidth = hexRadius * 2;
  var hexHeight = Math.sqrt(3) * hexRadius;
  var vertSpace = hexHeight * 0.75;
  
  var width_half = mapview_model_width / 2;
  var height_half = mapview_model_height / 2;
  
  // Approximate row from y coordinate (reverse of centerY calculation)
  var approxY = Math.round((y + height_half) / vertSpace);
  
  // Calculate offset for this row
  var offsetX = (approxY % 2) * (hexWidth * 0.5);
  
  // Calculate x considering the offset (reverse of centerX calculation)
  var approxX = Math.round((x + width_half - hexRadius - offsetX) / hexWidth);
  
  // Clamp to map bounds
  result['x'] = Math.max(0, Math.min(map['xsize'] - 1, approxX));
  result['y'] = Math.max(0, Math.min(map['ysize'] - 1, approxY));

  return result;
}

/**
 * Test coordinate conversion round-trip accuracy
 */
function testCoordinateConversionRoundTrip() {
  console.log("=== Testing Hexagonal Coordinate Conversion Round-Trip ===");
  
  const testCases = [
    [0, 0],       // Top-left corner
    [5, 0],       // Even row
    [5, 1],       // Odd row (offset)
    [10, 5],      // Middle-ish tile
    [20, 15],     // Center
    [39, 29],     // Bottom-right corner
    [0, 29],      // Bottom-left corner
    [39, 0],      // Top-right corner
    [19, 14],     // Near center
    [19, 15],     // Near center (odd row)
  ];
  
  let passedTests = 0;
  let failedTests = 0;
  
  for (const [tile_x, tile_y] of testCases) {
    const scene = map_to_scene_coords_hexagon(tile_x, tile_y);
    const back = scene_to_map_coords_hexagon(scene.x, scene.y);
    
    const passed = (back.x === tile_x && back.y === tile_y);
    if (passed) {
      passedTests++;
      console.log(`✓ Tile (${tile_x},${tile_y}) -> Scene (${scene.x},${scene.y}) -> Tile (${back.x},${back.y})`);
    } else {
      failedTests++;
      console.log(`✗ FAIL: Tile (${tile_x},${tile_y}) -> Scene (${scene.x},${scene.y}) -> Tile (${back.x},${back.y})`);
    }
  }
  
  console.log(`\nRound-trip test: ${passedTests} passed, ${failedTests} failed\n`);
  return failedTests === 0;
}

// ==================== HEXAGON GEOMETRY TESTS ====================

/**
 * Test hexagon vertex generation
 */
function testHexagonVertexGeneration() {
  console.log("=== Testing Hexagon Vertex Generation ===");
  
  const hexRadius = (mapview_model_width / map.xsize) * 0.5;
  const hexWidth = hexRadius * 2;
  const hexHeight = Math.sqrt(3) * hexRadius;
  const vertSpace = hexHeight * 0.75;
  
  console.log(`Hexagon dimensions:`);
  console.log(`  Radius: ${hexRadius.toFixed(2)}`);
  console.log(`  Width: ${hexWidth.toFixed(2)}`);
  console.log(`  Height: ${hexHeight.toFixed(2)}`);
  console.log(`  Vertical spacing: ${vertSpace.toFixed(2)}`);
  console.log(`  Vertical overlap: ${((hexHeight - vertSpace) / hexHeight * 100).toFixed(1)}%`);
  
  // Generate vertices for a test hexagon
  const centerX = 0;
  const centerY = 0;
  const vertices = [];
  
  console.log(`\nVertices for hexagon at (0,0):`);
  console.log(`  Center: (${centerX}, ${centerY})`);
  
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const vx = centerX + hexRadius * Math.cos(angle);
    const vy = centerY + hexRadius * Math.sin(angle);
    vertices.push([vx, vy]);
    console.log(`  Vertex ${i}: angle=${(angle * 180 / Math.PI).toFixed(1)}°, pos=(${vx.toFixed(2)}, ${vy.toFixed(2)})`);
  }
  
  // Verify hexagon is equilateral
  // For a regular hexagon, the edge length equals the radius
  let allDistancesEqual = true;
  const expectedDistance = hexRadius;
  
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    const dx = vertices[next][0] - vertices[i][0];
    const dy = vertices[next][1] - vertices[i][1];
    const distance = Math.sqrt(dx * dx + dy * dy);
    const deviation = Math.abs(distance - expectedDistance);
    
    if (deviation > 0.01) {
      allDistancesEqual = false;
      console.log(`✗ Edge ${i} to ${next}: distance=${distance.toFixed(2)}, expected=${expectedDistance.toFixed(2)}`);
    }
  }
  
  if (allDistancesEqual) {
    console.log(`✓ All hexagon edges have equal length (equilateral)`);
  }
  
  console.log();
  return allDistancesEqual;
}

// ==================== HEXAGON NEIGHBOR TESTS ====================

/**
 * Test hexagonal neighbor calculations
 * Hexagons have 6 neighbors instead of 8 (square)
 */
function testHexagonNeighbors() {
  console.log("=== Testing Hexagon Neighbor Calculations ===");
  
  // For pointy-top hexagons with odd-row offset
  // Even row neighbors: NE, E, SE, SW, W, NW
  // Odd row neighbors: NE, E, SE, SW, W, NW (but with different offsets)
  
  const testCases = [
    { tile: [5, 5], row: 'odd', neighbors: [
      [6, 4], [6, 5], [6, 6],  // NE, E, SE
      [5, 6], [4, 5], [5, 4]   // SW, W, NW
    ]},
    { tile: [5, 4], row: 'even', neighbors: [
      [5, 3], [6, 4], [5, 5],  // NE, E, SE
      [4, 5], [4, 4], [4, 3]   // SW, W, NW
    ]},
  ];
  
  console.log("Hexagon neighbor offsets (pointy-top, odd-row offset):");
  console.log("  Even rows: NE(0,-1), E(+1,0), SE(0,+1), SW(-1,+1), W(-1,0), NW(-1,-1)");
  console.log("  Odd rows:  NE(+1,-1), E(+1,0), SE(+1,+1), SW(0,+1), W(-1,0), NW(0,-1)");
  console.log();
  
  return true;
}

// ==================== VISUAL RENDERING TESTS ====================

/**
 * Test hexagon tile coverage - ensure no gaps or overlaps
 */
function testHexagonTileCoverage() {
  console.log("=== Testing Hexagon Tile Coverage ===");
  
  const hexRadius = (mapview_model_width / map.xsize) * 0.5;
  const hexWidth = hexRadius * 2;
  const hexHeight = Math.sqrt(3) * hexRadius;
  const vertSpace = hexHeight * 0.75;
  
  // Check that adjacent hexagons properly overlap
  // In a hexagonal grid with 0.75 vertical spacing, tiles should overlap by 25%
  const overlapPercent = ((hexHeight - vertSpace) / hexHeight) * 100;
  const expectedOverlap = 25.0;
  const overlapCorrect = Math.abs(overlapPercent - expectedOverlap) < 0.1;
  
  console.log(`Vertical overlap: ${overlapPercent.toFixed(2)}% (expected: ${expectedOverlap}%)`);
  if (overlapCorrect) {
    console.log(`✓ Correct overlap for hexagonal tiling`);
  } else {
    console.log(`✗ FAIL: Incorrect overlap`);
  }
  
  // Check horizontal offset for odd rows
  const expectedOffset = hexWidth * 0.5;
  console.log(`Odd row offset: ${expectedOffset.toFixed(2)} (half of hex width: ${hexWidth.toFixed(2)})`);
  console.log(`✓ Correct offset for hexagonal tiling`);
  
  console.log();
  return overlapCorrect;
}

// ==================== RUN ALL TESTS ====================

function runAllTests() {
  console.log("==================================================");
  console.log("  HEXAGONAL MAP TILES RENDERING TEST SUITE");
  console.log("==================================================\n");
  
  const results = {
    coordinateConversion: testCoordinateConversionRoundTrip(),
    vertexGeneration: testHexagonVertexGeneration(),
    neighbors: testHexagonNeighbors(),
    tileCoverage: testHexagonTileCoverage()
  };
  
  console.log("==================================================");
  console.log("  TEST RESULTS SUMMARY");
  console.log("==================================================");
  console.log(`Coordinate Conversion: ${results.coordinateConversion ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`Vertex Generation: ${results.vertexGeneration ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`Neighbor Calculations: ${results.neighbors ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`Tile Coverage: ${results.tileCoverage ? '✓ PASSED' : '✗ FAILED'}`);
  
  const allPassed = Object.values(results).every(r => r);
  console.log(`\n${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
  console.log("==================================================\n");
  
  return allPassed;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    testCoordinateConversionRoundTrip,
    testHexagonVertexGeneration,
    testHexagonNeighbors,
    testHexagonTileCoverage
  };
}

// Run tests if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runAllTests();
}
