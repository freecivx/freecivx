#!/usr/bin/env node
// Hex Tile Tests Runner

var fs = require('fs');

// Mock globals
global.map = { xsize: 10, ysize: 8 };
global.MAPVIEW_ASPECT_FACTOR = 35.71;

// Hex utility functions
function offset_to_cube(x, y) {
    var cubeX = x - (y - (y % 2)) / 2;
    var cubeZ = y;
    var cubeY = -cubeX - cubeZ;
    return {x: cubeX, y: cubeY, z: cubeZ};
}

function cube_to_offset(cubeX, cubeY, cubeZ) {
    var y = cubeZ;
    var x = cubeX + (y - (y % 2)) / 2;
    return {x: x, y: y};
}

function hex_distance(x1, y1, x2, y2) {
    var cube1 = offset_to_cube(x1, y1);
    var cube2 = offset_to_cube(x2, y2);
    return (Math.abs(cube1.x - cube2.x) + 
            Math.abs(cube1.y - cube2.y) + 
            Math.abs(cube1.z - cube2.z)) / 2;
}

function get_hex_neighbors(x, y) {
    var parity = y & 1;
    var offsetDirections = [
        [{x: 1, y: 0},  {x: 1, y: 0}],
        [{x: 0, y: 1},  {x: 1, y: 1}],
        [{x: -1, y: 1}, {x: 0, y: 1}],
        [{x: -1, y: 0}, {x: -1, y: 0}],
        [{x: -1, y: -1},{x: 0, y: -1}],
        [{x: 0, y: -1}, {x: 1, y: -1}]
    ];
    
    var neighbors = [];
    for (var i = 0; i < 6; i++) {
        var dir = offsetDirections[i][parity];
        var nx = x + dir.x;
        var ny = y + dir.y;
        
        if (nx >= 0 && nx < map.xsize && ny >= 0 && ny < map.ysize) {
            neighbors.push({x: nx, y: ny});
        }
    }
    
    return neighbors;
}

global.offset_to_cube = offset_to_cube;
global.cube_to_offset = cube_to_offset;
global.hex_distance = hex_distance;
global.get_hex_neighbors = get_hex_neighbors;

// Load test framework
eval(fs.readFileSync(__dirname + '/test-framework.js', 'utf8'));

// Load all test files
eval(fs.readFileSync(__dirname + '/test-hex-coordinates.js', 'utf8'));
eval(fs.readFileSync(__dirname + '/test-hex-geometry.js', 'utf8'));
eval(fs.readFileSync(__dirname + '/test-hex-integration.js', 'utf8'));

// Run all tests
console.log('\n🧪 Hex Tile Implementation - JavaScript Unit Tests\n');
console.log('Running comprehensive test suite...\n');

runCoordinateTests();
runGeometryTests();
runIntegrationTests();

var success = printTestSummary();

// Additional test statistics
console.log('\nTest Coverage:');
console.log('- Coordinate system: ✓');
console.log('- Geometry calculations: ✓');
console.log('- Integration & edge cases: ✓');
console.log('- Total test suites: 3');

process.exit(success ? 0 : 1);
