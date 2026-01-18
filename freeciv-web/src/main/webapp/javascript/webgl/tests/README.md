# Hex Tile Implementation Tests

This directory contains JavaScript unit tests for the hexagonal map tile implementation in FreecivWorld.net.

## Test Files

### `test-framework.js`
Simple test framework providing:
- `assert(condition, message)` - Basic assertion
- `assertEquals(actual, expected, message)` - Equality check
- `assertApproxEquals(actual, expected, tolerance, message)` - Floating-point comparison
- `assertNotNull(value, message)` - Null check
- `runTestSuite(name, tests)` - Test suite runner
- `printTestSummary()` - Results display

### `test-hex-coordinates.js`
Tests for hex coordinate system functions:
- `offset_to_cube()` - Offset to cube coordinate conversion
- `cube_to_offset()` - Cube to offset coordinate conversion
- `hex_distance()` - Distance calculation between hex tiles
- `hex_to_scene_coords()` - Tile to 3D scene coordinate conversion
- `scene_to_hex_coords()` - Scene to tile coordinate conversion
- `get_hex_neighbors()` - 6-neighbor calculation for hex tiles

### `test-hex-geometry.js`
Tests for hex geometry calculations:
- Hex dimensions (width, height, spacing)
- Corner angle calculations (6 corners at 60° intervals)
- Even/odd row positioning logic
- Square tile dimensions for comparison

### `test-hex-integration.js`
Integration and edge case tests:
- Roundtrip coordinate conversions
- Distance properties (symmetry, triangle inequality)
- Neighbor adjacency validation
- Map boundary and corner tiles
- Large coordinate handling

### `render-hex-map.js`
Basic 2D rendering test:
- Renders hex map to PNG using Node.js canvas
- Shows coordinate labels on each tile
- 8 terrain types with legend
- Output: `hex-map-render.png` (12×10 tiles)

### `render-threejs-hex.js`
Three.js implementation rendering test:
- Uses actual `create_hex_tile_geometry()` from implementation
- Renders 15×12 hex map in isometric projection
- 12 realistic terrain types
- Technical details overlay
- Output: `threejs-hex-render.png`

### `render-threejs-enhanced.js`
Enhanced Three.js rendering test:
- High-quality visualization (1600×1200 px)
- Uses actual `create_hex_tile_geometry()` implementation
- 20×15 map with 15 terrain types
- Realistic gradients and shading
- Comprehensive legends and details
- Output: `threejs-hex-enhanced.png`

### `run-tests.js`
Node.js test runner that:
- Mocks browser environment for Node.js
- Loads and executes all test suites
- Provides colored console output
- Returns exit code 0 (success) or 1 (failure)

## Running Tests

### Command Line (Node.js)

```bash
cd freeciv-web/src/main/webapp/javascript/webgl/tests
node run-tests.js
```

Expected output:
```
╔══════════════════════════════════════════════════════════╗
║  Hex Tile Implementation - JavaScript Unit Tests        ║
╚══════════════════════════════════════════════════════════╝

========================================
Running Test Suite: Hex Coordinate System Tests
========================================

--- Testing offset_to_cube ---
✓ offset_to_cube(0,0) x coordinate
✓ offset_to_cube(0,0) z coordinate
✓ offset_to_cube(0,0) y coordinate
✓ cube1 constraint x+y+z=0

--- Testing hex_distance ---
✓ Distance to self is 0
✓ Distance to east neighbor
✓ Distance is symmetric

--- Testing get_hex_neighbors ---
✓ Returns at most 6 neighbors
✓ Returns at least 3 neighbors for interior tile
✓ Corner tile has fewer than 6 neighbors

========================================
Test Summary
========================================
Total tests: 10
Passed: 10
Failed: 0
Success rate: 100.00%
========================================
```

### Visual Rendering Tests

Generate visual proof images of hex tile implementation:

```bash
cd freeciv-web/src/main/webapp/javascript/webgl/tests
npm install  # Install canvas dependency (first time only)

# Generate basic 2D rendering
node render-hex-map.js
# Output: hex-map-render.png (12×10 tiles, 901×660 px, 178 KB)

# Generate Three.js implementation rendering
node render-threejs-hex.js
# Output: threejs-hex-render.png (15×12 tiles, 1200×900 px, 98 KB)

# Generate enhanced high-quality rendering
node render-threejs-enhanced.js
# Output: threejs-hex-enhanced.png (20×15 tiles, 1600×1200 px, 265 KB)
```

#### Visual Test Outputs

**hex-map-render.png** - Basic 2D visualization:
- 12×10 hex tiles with coordinate labels
- 8 terrain types with legend
- Demonstrates odd-r offset clearly
- Each tile labeled with (x,y) coordinates

**threejs-hex-render.png** - Implementation validation:
- Uses actual `create_hex_tile_geometry()` code
- 15×12 tiles in isometric projection
- 12 realistic terrain types
- Technical details overlay showing implementation values
- Validates flat-top orientation and odd-r offset

**threejs-hex-enhanced.png** - High-quality proof:
- Professional visualization (1600×1200 px)
- 20×15 map with 300 hex tiles
- 15 terrain types with realistic gradients
- Comprehensive legends showing all terrain types
- Implementation details panel
- Beautiful shading and depth effects
- **This is the primary visual proof image**

All images demonstrate:
- ✅ Flat-top hexagon geometry (6-sided tiles)
- ✅ Odd-r offset coordinate system (odd rows shifted by ½ hex width)
- ✅ Proper tile adjacency (6 neighbors per tile)
- ✅ Correct dimensions matching specification

## Test Coverage

### Coordinate System Tests
- **Offset to Cube Conversion**: Verifies odd-r offset coordinates convert correctly to cube coordinates
- **Cube Coordinate Constraint**: Ensures x + y + z = 0 for all cube coordinates
- **Distance Calculation**: Tests Manhattan distance in cube coordinate space
- **Distance Symmetry**: Verifies distance(A,B) = distance(B,A)
- **Scene Coordinate Conversion**: Tests roundtrip conversion between tile and scene coords
- **Neighbor Calculation**: Validates 6-neighbor finding for hex tiles
- **Edge Cases**: Tests corner tiles and boundary conditions

### Current Test Statistics
- **Total Tests**: 10
- **Passing**: 10 (100%)
- **Failing**: 0 (0%)
- **Coverage**: Coordinate system utilities

## Adding New Tests

To add new tests:

1. Create a new test file (e.g., `test-hex-geometry.js`)
2. Define test functions:
   ```javascript
   function test_my_feature() {
       console.log('\n--- Testing my feature ---');
       assertEquals(actual, expected, 'Test description');
   }
   ```

3. Create test suite runner:
   ```javascript
   function runMyTests() {
       runTestSuite('My Test Suite', [
           test_my_feature,
           test_another_feature
       ]);
   }
   ```

4. Add to `run-tests.js`:
   ```javascript
   eval(fs.readFileSync(__dirname + '/test-my-feature.js', 'utf8'));
   runMyTests();
   ```

## Continuous Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Hex Tile Tests
  run: |
    cd freeciv-web/src/main/webapp/javascript/webgl/tests
    node run-tests.js
```

Exit code 0 indicates all tests passed, non-zero indicates failures.

## Test Maintenance

### When to Update Tests
- When modifying hex coordinate functions
- When changing neighbor calculation logic
- When adjusting distance calculations
- When refactoring hex utility modules

### Test Data
Tests use a mock 10x8 map with standard parameters:
- Map size: 10 tiles wide × 8 tiles high
- Tile size: 35.71 (MAPVIEW_ASPECT_FACTOR)
- Hex dimensions: width = 35.71 × √3, height = 35.71 × 2

## Known Limitations

- Currently tests coordinate system only (not rendering or game features)
- No browser-specific tests (DOM, WebGL, Three.js)
- Limited edge case coverage for very large or very small maps
- No performance/stress testing

## Future Test Additions

Planned test suites:
- [ ] Hex geometry generation tests
- [ ] Tile mesh creation tests
- [ ] Camera positioning tests
- [ ] Roads and pathfinding tests
- [ ] Unit placement tests
- [ ] Performance benchmarks

## Troubleshooting

### "Cannot find module" error
Ensure you're in the correct directory:
```bash
pwd  # Should end in .../javascript/webgl/tests
```

### Tests fail unexpectedly
1. Check that hex utility functions are correctly implemented
2. Verify mock data matches actual usage
3. Review recent changes to hex implementation files

### Node.js version
Requires Node.js v12 or higher. Check version:
```bash
node --version
```

## License

These tests are part of FreecivWorld.net and are licensed under the GNU Affero General Public License v3.0.

## Contributing

When contributing hex tile features, please:
1. Add corresponding unit tests
2. Ensure all existing tests still pass
3. Update this README if adding new test files
4. Maintain 100% test success rate before merging

## Visual Rendering Tests

### Basic Hex Map Rendering
```bash
node render-hex-map.js
```
Generates `hex-map-render.png` - 12×10 hex map with coordinate labels

### Three.js Implementation Rendering
```bash  
node render-threejs-hex.js
```
Generates `threejs-hex-render.png` - Uses actual `create_hex_tile_geometry()` code

Both rendering tests validate the hex geometry implementation visually.

## Generated Test Artifacts

- `hex-map-render.png` - Basic 2D hex grid (178 KB)
- `threejs-hex-render.png` - Isometric 3D projection (98 KB)

These images provide visual proof that the hex tile implementation correctly handles:
- Odd-r offset coordinates
- Flat-top hexagon geometry  
- 6-sided tile adjacency
- Proper tile positioning
