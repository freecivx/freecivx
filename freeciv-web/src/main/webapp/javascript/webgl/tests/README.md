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

### Browser (Visual Test Runner)

Open `../test-runner.html` (if created) in a web browser for interactive testing with visual feedback.

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
