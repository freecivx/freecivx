/**********************************************************************
    FreecivWorld.net - Hex Coordinate System Tests
***********************************************************************/

var map = { xsize: 10, ysize: 8 };
var MAPVIEW_ASPECT_FACTOR = 35.71;
var HEX_WIDTH = MAPVIEW_ASPECT_FACTOR * Math.sqrt(3);
var HEX_HEIGHT = MAPVIEW_ASPECT_FACTOR * 2;
var HEX_VERTICAL_SPACING = HEX_HEIGHT * 0.75;

function test_offset_to_cube() {
    console.log('\n--- Testing offset_to_cube ---');
    
    var cube1 = offset_to_cube(0, 0);
    assertEquals(cube1.x, 0, 'offset_to_cube(0,0) x coordinate');
    assertEquals(cube1.z, 0, 'offset_to_cube(0,0) z coordinate');
    assertEquals(cube1.y, 0, 'offset_to_cube(0,0) y coordinate');
    
    assert(cube1.x + cube1.y + cube1.z === 0, 'cube1 constraint x+y+z=0');
}

function test_hex_distance() {
    console.log('\n--- Testing hex_distance ---');
    
    assertEquals(hex_distance(0, 0, 0, 0), 0, 'Distance to self is 0');
    assertEquals(hex_distance(0, 0, 1, 0), 1, 'Distance to east neighbor');
    
    var dist1 = hex_distance(2, 3, 5, 6);
    var dist2 = hex_distance(5, 6, 2, 3);
    assertEquals(dist1, dist2, 'Distance is symmetric');
}

function test_get_hex_neighbors() {
    console.log('\n--- Testing get_hex_neighbors ---');
    
    var neighbors = get_hex_neighbors(5, 4);
    assert(neighbors.length <= 6, 'Returns at most 6 neighbors');
    assert(neighbors.length >= 3, 'Returns at least 3 neighbors for interior tile');
    
    var corner_neighbors = get_hex_neighbors(0, 0);
    assert(corner_neighbors.length < 6, 'Corner tile has fewer than 6 neighbors');
}

function runCoordinateTests() {
    runTestSuite('Hex Coordinate System Tests', [
        test_offset_to_cube,
        test_hex_distance,
        test_get_hex_neighbors
    ]);
}
