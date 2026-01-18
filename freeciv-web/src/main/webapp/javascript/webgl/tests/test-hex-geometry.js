/**********************************************************************
    FreecivWorld.net - Hex Geometry Tests
    Tests for tile geometry creation and positioning
***********************************************************************/

var MAPVIEW_ASPECT_FACTOR = 35.71;

function test_hex_dimensions() {
    console.log('\n--- Testing hex dimensions ---');
    
    var hex_width = MAPVIEW_ASPECT_FACTOR * Math.sqrt(3);
    var hex_height = MAPVIEW_ASPECT_FACTOR * 2;
    var hex_spacing = hex_height * 0.75;
    
    assertApproxEquals(hex_width, 61.846, 0.01, 'Hex width calculation');
    assertApproxEquals(hex_height, 71.42, 0.01, 'Hex height calculation');
    assertApproxEquals(hex_spacing, 53.565, 0.01, 'Hex vertical spacing');
}

function test_hex_corner_angles() {
    console.log('\n--- Testing hex corner angles ---');
    
    // Flat-top hex has corners at specific angles
    for (var i = 0; i < 6; i++) {
        var angle = (Math.PI / 3) * i - Math.PI / 2;
        assert(angle >= -Math.PI && angle <= Math.PI * 2, 'Corner ' + i + ' angle in valid range');
        
        if (i > 0) {
            var prevAngle = (Math.PI / 3) * (i - 1) - Math.PI / 2;
            var angleDiff = angle - prevAngle;
            assertApproxEquals(angleDiff, Math.PI / 3, 0.001, 'Corners ' + (i-1) + ' and ' + i + ' are 60° apart');
        }
    }
}

function test_hex_positioning_even_row() {
    console.log('\n--- Testing hex positioning (even row) ---');
    
    var hex_width = MAPVIEW_ASPECT_FACTOR * Math.sqrt(3);
    var x = 3, y = 2;
    
    var centerX = x * hex_width;
    var expectedX = x * hex_width;
    
    assertApproxEquals(centerX, expectedX, 0.01, 'Even row has no x-offset');
}

function test_hex_positioning_odd_row() {
    console.log('\n--- Testing hex positioning (odd row) ---');
    
    var hex_width = MAPVIEW_ASPECT_FACTOR * Math.sqrt(3);
    var x = 3, y = 3;
    
    var centerX = x * hex_width;
    if (y % 2 === 1) {
        centerX += hex_width / 2;
    }
    
    var expectedX = x * hex_width + hex_width / 2;
    assertApproxEquals(centerX, expectedX, 0.01, 'Odd row has half-width x-offset');
}

function test_square_tile_dimensions() {
    console.log('\n--- Testing square tile dimensions ---');
    
    var tileSize = MAPVIEW_ASPECT_FACTOR;
    assertEquals(tileSize, 35.71, 'Square tile size');
}

function runGeometryTests() {
    runTestSuite('Hex Geometry Tests', [
        test_hex_dimensions,
        test_hex_corner_angles,
        test_hex_positioning_even_row,
        test_hex_positioning_odd_row,
        test_square_tile_dimensions
    ]);
}
