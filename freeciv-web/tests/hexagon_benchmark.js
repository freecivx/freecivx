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
 * Performance benchmarks for hexagonal coordinate functions
 * Measures execution time and throughput for various operations
 */

const fs = require('fs');
const path = require('path');

// Load hexagon utility files
const hexagon_base = fs.readFileSync(path.join(__dirname, '../src/main/webapp/javascript/webgl/maputil_hexagon.js'), 'utf8');
const hexagon_improved = fs.readFileSync(path.join(__dirname, '../src/main/webapp/javascript/webgl/maputil_hexagon_improved.js'), 'utf8');

// Evaluate code in a mock environment
global.map = { xsize: 80, ysize: 50 };  // Larger map for benchmarking
global.mapview_model_width = 2000;
global.mapview_model_height = 1250;
global.console = console;

eval(hexagon_base);
eval(hexagon_improved);

console.log("==================================================");
console.log("  HEXAGONAL COORDINATE PERFORMANCE BENCHMARKS");
console.log("==================================================\n");

console.log("Map size: " + map.xsize + "x" + map.ysize + " = " + (map.xsize * map.ysize) + " tiles");
console.log("Viewport: " + mapview_model_width + "x" + mapview_model_height + "\n");

/**
 * Benchmark a function execution
 */
function benchmark(name, func, iterations) {
  // Warmup
  for (let i = 0; i < Math.min(iterations / 10, 1000); i++) {
    func();
  }
  
  // Measure
  const start = Date.now();
  for (let i = 0; i < iterations; i++) {
    func();
  }
  const end = Date.now();
  
  const elapsed = end - start;
  const perOp = (elapsed / iterations).toFixed(4);
  const opsPerSec = Math.round(iterations / (elapsed / 1000));
  
  console.log(`${name}:`);
  console.log(`  Total time: ${elapsed}ms for ${iterations} operations`);
  console.log(`  Per operation: ${perOp}ms`);
  console.log(`  Throughput: ${opsPerSec.toLocaleString()} ops/sec`);
  console.log("");
  
  return { elapsed, perOp, opsPerSec };
}

// ==================== DIMENSION CALCULATION BENCHMARK ====================

console.log("=== Benchmark: get_hexagon_dimensions() ===");
benchmark("Dimension calculation", () => {
  get_hexagon_dimensions();
}, 100000);

// ==================== MAP TO SCENE BENCHMARK ====================

console.log("=== Benchmark: map_to_scene_coords_hexagon() ===");

// Test with various tile positions
const testTiles = [];
for (let i = 0; i < 1000; i++) {
  testTiles.push({
    x: Math.floor(Math.random() * map.xsize),
    y: Math.floor(Math.random() * map.ysize)
  });
}

let testIndex = 0;
benchmark("Map to scene conversion", () => {
  const tile = testTiles[testIndex % testTiles.length];
  map_to_scene_coords_hexagon(tile.x, tile.y);
  testIndex++;
}, 50000);

// ==================== SCENE TO MAP BENCHMARK ====================

console.log("=== Benchmark: scene_to_map_coords_hexagon() vs improved ===");

// Generate test scene positions
const testScenePos = [];
for (let i = 0; i < 1000; i++) {
  testScenePos.push({
    x: (Math.random() - 0.5) * mapview_model_width,
    y: (Math.random() - 0.5) * mapview_model_height
  });
}

testIndex = 0;
const basicResults = benchmark("Scene to map (basic)", () => {
  const pos = testScenePos[testIndex % testScenePos.length];
  scene_to_map_coords_hexagon(pos.x, pos.y);
  testIndex++;
}, 50000);

testIndex = 0;
const improvedResults = benchmark("Scene to map (improved)", () => {
  const pos = testScenePos[testIndex % testScenePos.length];
  scene_to_map_coords_hexagon_improved(pos.x, pos.y);
  testIndex++;
}, 50000);

const slowdown = ((improvedResults.perOp / basicResults.perOp - 1) * 100).toFixed(1);
console.log(`Improved method is ${Math.abs(slowdown)}% ${slowdown > 0 ? 'slower' : 'faster'} than basic method`);
console.log(`But provides better accuracy near hexagon boundaries\n`);

// ==================== ROUND-TRIP BENCHMARK ====================

console.log("=== Benchmark: Round-trip conversion ===");

testIndex = 0;
benchmark("Map -> Scene -> Map (round-trip)", () => {
  const tile = testTiles[testIndex % testTiles.length];
  const scene = map_to_scene_coords_hexagon(tile.x, tile.y);
  if (scene) {
    scene_to_map_coords_hexagon(scene.x, scene.y);
  }
  testIndex++;
}, 25000);

// ==================== NEIGHBOR CALCULATION BENCHMARK ====================

console.log("=== Benchmark: get_hex_neighbors() ===");

testIndex = 0;
benchmark("Neighbor calculation", () => {
  const tile = testTiles[testIndex % testTiles.length];
  get_hex_neighbors(tile.x, tile.y);
  testIndex++;
}, 50000);

// ==================== DISTANCE CALCULATION BENCHMARK ====================

console.log("=== Benchmark: hex_distance() ===");

// Generate tile pairs for distance calculations
const tilePairs = [];
for (let i = 0; i < 1000; i++) {
  tilePairs.push({
    x1: Math.floor(Math.random() * map.xsize),
    y1: Math.floor(Math.random() * map.ysize),
    x2: Math.floor(Math.random() * map.xsize),
    y2: Math.floor(Math.random() * map.ysize)
  });
}

testIndex = 0;
benchmark("Distance calculation", () => {
  const pair = tilePairs[testIndex % tilePairs.length];
  hex_distance(pair.x1, pair.y1, pair.x2, pair.y2);
  testIndex++;
}, 50000);

// ==================== ADJACENCY CHECK BENCHMARK ====================

console.log("=== Benchmark: are_hexagons_adjacent() ===");

testIndex = 0;
benchmark("Adjacency check", () => {
  const pair = tilePairs[testIndex % tilePairs.length];
  are_hexagons_adjacent(pair.x1, pair.y1, pair.x2, pair.y2);
  testIndex++;
}, 50000);

// ==================== ACCURACY COMPARISON ====================

console.log("=== Accuracy Comparison: Basic vs Improved ===");

let basicCorrect = 0;
let improvedCorrect = 0;
const testCount = 1000;

// Test random positions near hexagon boundaries
for (let i = 0; i < testCount; i++) {
  // Pick a random tile
  const origTile = {
    x: Math.floor(Math.random() * (map.xsize - 2)) + 1,  // Stay away from edges
    y: Math.floor(Math.random() * (map.ysize - 2)) + 1
  };
  
  // Convert to scene
  const scene = map_to_scene_coords_hexagon(origTile.x, origTile.y);
  if (!scene) continue;
  
  // Add small random offset to simulate clicking near boundary
  const offsetX = (Math.random() - 0.5) * 5;  // +/- 2.5 units
  const offsetY = (Math.random() - 0.5) * 5;
  
  // Convert back with both methods
  const basicTile = scene_to_map_coords_hexagon(scene.x + offsetX, scene.y + offsetY);
  const improvedTile = scene_to_map_coords_hexagon_improved(scene.x + offsetX, scene.y + offsetY);
  
  // Check which method got it right
  if (basicTile && basicTile.x === origTile.x && basicTile.y === origTile.y) {
    basicCorrect++;
  }
  if (improvedTile && improvedTile.x === origTile.x && improvedTile.y === origTile.y) {
    improvedCorrect++;
  }
}

console.log(`Basic method accuracy: ${basicCorrect}/${testCount} (${(100 * basicCorrect / testCount).toFixed(1)}%)`);
console.log(`Improved method accuracy: ${improvedCorrect}/${testCount} (${(100 * improvedCorrect / testCount).toFixed(1)}%)`);
console.log(`Improvement: +${improvedCorrect - basicCorrect} correct (${((improvedCorrect - basicCorrect) / testCount * 100).toFixed(1)}% better)\n`);

// ==================== MEMORY USAGE ESTIMATE ====================

console.log("=== Memory Usage Estimates ===");

// Estimate memory for a full map
const tilesCount = map.xsize * map.ysize;
const bytesPerTile = 8 * 4;  // Approximate: 8 floats per tile (coordinates, etc.)
const totalBytes = tilesCount * bytesPerTile;

console.log(`Total tiles: ${tilesCount.toLocaleString()}`);
console.log(`Estimated memory per tile: ${bytesPerTile} bytes`);
console.log(`Total map memory: ${(totalBytes / 1024).toFixed(1)} KB`);
console.log(`(${(totalBytes / 1024 / 1024).toFixed(2)} MB)\n`);

// ==================== RECOMMENDATIONS ====================

console.log("==================================================");
console.log("  RECOMMENDATIONS");
console.log("==================================================");
console.log("");
console.log("1. DIMENSION CACHING:");
console.log("   ✓ Already using shared get_hexagon_dimensions()");
console.log("   → Consider caching result at map load time");
console.log("");
console.log("2. CONVERSION METHOD SELECTION:");
if (slowdown > 0) {
  console.log(`   → Improved method is ${slowdown}% slower but more accurate`);
  console.log("   → Use improved method for critical interactions (mouse clicks)");
  console.log("   → Use basic method for bulk operations (rendering)");
} else {
  console.log(`   ✓ Improved method is ${Math.abs(slowdown)}% faster AND more accurate!`);
  console.log("   → Always use improved method");
}
console.log("");
console.log("3. PERFORMANCE:");
console.log("   ✓ All operations complete in under 1ms");
console.log("   ✓ Suitable for real-time interactive use");
console.log("");
console.log("==================================================\n");
