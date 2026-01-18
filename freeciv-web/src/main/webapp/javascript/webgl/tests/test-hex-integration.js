/**********************************************************************
    FreecivWorld.net - Hex Integration Tests
    Tests for hex utility integration and edge cases
***********************************************************************/

function test_roundtrip_conversions() {
    console.log('\n--- Testing roundtrip conversions ---');
    
    // Test multiple coordinates
    var coords = [[0, 0], [3, 4], [5, 2], [7, 7]];
    
    for (var i = 0; i < coords.length; i++) {
        var x = coords[i][0];
        var y = coords[i][1];
        
        var cube = offset_to_cube(x, y);
        var back = cube_to_offset(cube.x, cube.y, cube.z);
        
        assertEquals(back.x, x, 'Roundtrip x for (' + x + ',' + y + ')');
        assertEquals(back.y, y, 'Roundtrip y for (' + x + ',' + y + ')');
    }
}

function test_hex_distance_properties() {
    console.log('\n--- Testing hex distance properties ---');
    
    // Distance is always non-negative
    var dist = hex_distance(2, 3, 5, 6);
    assert(dist >= 0, 'Distance is non-negative');
    
    // Triangle inequality: dist(A,C) <= dist(A,B) + dist(B,C)
    var d_ac = hex_distance(0, 0, 4, 4);
    var d_ab = hex_distance(0, 0, 2, 2);
    var d_bc = hex_distance(2, 2, 4, 4);
    assert(d_ac <= d_ab + d_bc, 'Triangle inequality holds');
}

function test_neighbor_directions() {
    console.log('\n--- Testing neighbor directions ---');
    
    // Test that neighbors are actually adjacent (distance 1)
    var x = 5, y = 4;
    var neighbors = get_hex_neighbors(x, y);
    
    for (var i = 0; i < neighbors.length; i++) {
        var dist = hex_distance(x, y, neighbors[i].x, neighbors[i].y);
        assertEquals(dist, 1, 'Neighbor ' + i + ' is distance 1');
    }
}

function test_edge_cases() {
    console.log('\n--- Testing edge cases ---');
    
    // Test map boundaries
    var corner = get_hex_neighbors(0, 0);
    assert(corner.length > 0, 'Corner tile has some neighbors');
    assert(corner.length < 6, 'Corner tile has fewer than 6 neighbors');
    
    // Test large coordinates
    var largeCube = offset_to_cube(100, 100);
    assertNotNull(largeCube, 'Large coordinates work');
    assert(largeCube.x + largeCube.y + largeCube.z === 0, 'Large cube coordinates valid');
}

function test_parity_based_neighbors() {
    console.log('\n--- Testing parity-based neighbor offsets ---');
    
    // Even row neighbors
    var evenNeighbors = get_hex_neighbors(5, 2);
    
    // Odd row neighbors  
    var oddNeighbors = get_hex_neighbors(5, 3);
    
    // Both should have same count if in middle of map
    assert(evenNeighbors.length > 0, 'Even row has neighbors');
    assert(oddNeighbors.length > 0, 'Odd row has neighbors');
}

function runIntegrationTests() {
    runTestSuite('Hex Integration Tests', [
        test_roundtrip_conversions,
        test_hex_distance_properties,
        test_neighbor_directions,
        test_edge_cases,
        test_parity_based_neighbors
    ]);
}
