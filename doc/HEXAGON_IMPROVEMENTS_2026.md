# Hexagonal Map Tiles Renderer - Improvements and Testing

## Date
February 1, 2026

## Summary
This document describes the improvements made to the hexagonal map tiles renderer in Freeciv 3D, building upon the work done in PR #182.

## Issues Found and Fixed

### 1. Heightmap Scale Inconsistency (FIXED)

**Problem**: In `mapview_webgl.js`, the hexagonal tile geometry functions (`init_land_geometry_hexagon` and `update_land_geometry_hexagon`) were using an incorrect heightmap scale calculation:

```javascript
// BEFORE (INCORRECT):
let heightmap_scale = (mesh_quality === 2) ? (mesh_quality * 2) : 1; // = 4 when mesh_quality is 2

// AFTER (CORRECT):
let heightmap_scale = (mesh_quality === 2) ? 2 : 1; // = 2 when mesh_quality is 2
```

**Impact**: 
- When using low-quality (lofi) meshes with `mesh_quality = 2`, the heightmap index calculation would be:
  - **Before**: `(ty * 4) * heightmap_resolution_x + (tx * 4)` 
  - **After**: `(ty * 2) * heightmap_resolution_x + (tx * 2)`
- The incorrect scale of 4 would cause out-of-bounds or incorrect heightmap lookups
- This mismatch meant hexagonal tiles were not consistent with square tiles, which correctly use scale 2

**Files Modified**:
- `freeciv-web/src/main/webapp/javascript/webgl/mapview_webgl.js` (lines 247 and 395)

**Changes**:
```javascript
// Line 247 in init_land_geometry_hexagon():
let heightmap_scale = (mesh_quality === 2) ? 2 : 1; // Scale factor 2 for low-fi, 1 for high-fi

// Line 395 in update_land_geometry_hexagon():
const heightmap_scale = (mesh_quality === 2) ? 2 : 1; // Match init_land_geometry_hexagon scale
```

## Testing

### Test Suite Created
Created comprehensive test suite in `freeciv-web/tests/hexagon_test.js` to validate:

1. **Coordinate Conversion Round-Trip Tests**
   - Tests 10 different tile positions including corners, edges, and center
   - Verifies that `map → scene → map` conversion is accurate
   - **Result**: ✓ All 10 tests PASSED

2. **Hexagon Vertex Generation**
   - Validates hexagon dimensions and proportions
   - Checks that all edges are equal length (equilateral hexagon)
   - Verifies vertical overlap (25%) and horizontal offset (50%)
   - **Result**: ✓ PASSED

3. **Neighbor Calculations**
   - Documents neighbor offset patterns for even and odd rows
   - Explains pointy-top hexagon topology with odd-row offset
   - **Result**: ✓ PASSED

4. **Tile Coverage**
   - Verifies correct 25% vertical overlap for proper tiling
   - Confirms half-width horizontal offset for odd rows
   - **Result**: ✓ PASSED

### Running Tests
```bash
cd freeciv-web/tests
node hexagon_test.js
```

All tests pass successfully!

## Code Architecture Review

### Hexagonal Tile System Components

1. **Coordinate Conversion** (`maputil_hexagon.js`)
   - `map_to_scene_coords_hexagon(x, y)` - Converts tile coords to 3D scene positions
   - `scene_to_map_coords_hexagon(x, y)` - Reverse conversion with rounding
   - Uses odd-row offset coordinate system

2. **Geometry Generation** (`mapview_webgl.js`)
   - `init_land_geometry_hexagon(geometry, mesh_quality)` - Creates initial hexagon meshes
   - `update_land_geometry_hexagon(geometry, mesh_quality)` - Updates vertex positions
   - Each hexagon: 1 center vertex + 6 perimeter vertices = 7 vertices total
   - 6 triangles per hexagon (center to each edge pair)

3. **Dispatcher Functions** (`maputil_square.js`)
   - `map_to_scene_coords()` - Routes to hex or square version based on `map_tile_type`
   - `scene_to_map_coords()` - Similar routing logic
   - `webgl_canvas_pos_to_tile()` - Mouse picking dispatcher
   - `webgl_canvas_pos_to_tile_quick()` - Fast picking dispatcher

4. **Object Positioning** (`object_position_handler_square.js`)
   - `get_tile_position_offsets()` - Returns appropriate offsets for tile type
   - Hexagonal tiles use 0 offsets (already centered)
   - Square tiles use original hardcoded offsets

### Hexagon Mathematics

**Dimensions**:
```javascript
hexRadius = (mapview_model_width / map.xsize) * 0.5
hexWidth = hexRadius * 2
hexHeight = Math.sqrt(3) * hexRadius
vertSpace = hexHeight * 0.75  // 25% overlap
```

**Offset Coordinate System**:
- Odd rows (y % 2 == 1) are shifted right by `hexWidth * 0.5`
- Pointy-top hexagons (vertices at top and bottom)
- Vertices at angles: 0°, 60°, 120°, 180°, 240°, 300°

**Position Calculation**:
```javascript
offsetX = (y % 2) * (hexWidth * 0.5)
centerX = x * hexWidth + offsetX + hexRadius - width_half
centerY = y * vertSpace - height_half
```

## Additional Improvements

### New Utilities Created

Created `maputil_hexagon_improved.js` with advanced features:

1. **Improved Scene-to-Map Conversion**
   - `scene_to_map_coords_hexagon_improved()` - Distance-based hex picking
   - Checks 3x3 grid of candidate tiles
   - Selects nearest hexagon center for more accurate mouse picking

2. **Hex Neighbor Functions**
   - `get_hex_neighbors(tile_x, tile_y)` - Returns array of up to 6 neighbors
   - Handles even/odd row offset differences
   - Respects map boundaries

3. **Distance Calculation**
   - `hex_distance(x1, y1, x2, y2)` - Accurate hex distance using cube coordinates
   - `are_hexagons_adjacent(x1, y1, x2, y2)` - Adjacency checker

These utilities can be integrated if needed for improved mouse picking or pathfinding.

## Verification

### Correctness Verification

✓ **Coordinate Conversion**: Round-trip tests pass for all test cases
✓ **Heightmap Access**: Now uses correct scale factor matching square tiles  
✓ **Geometry Generation**: Produces proper regular hexagons with correct proportions
✓ **Tile Coverage**: Hexagons tile correctly with 25% vertical overlap
✓ **Consistency**: Hexagon and square implementations now use same heightmap scale logic

### Known Limitations (Inherited from Previous Work)

These limitations were documented in PR #182 and still apply:

1. **Camera Movement** (`camera_square.js`) - May need hex-specific adjustments
2. **Road Rendering** (`roads_square.js`) - Assumes square tile adjacency
3. **Goto Path** (`goto_square.js`) - May not align perfectly with hex centers
4. **Map Controls** (`mapctrl_square.js`) - Some logic assumes square topology

However, these generally work due to the dispatcher pattern routing calls to appropriate hex/square implementations.

## Files Modified

1. **freeciv-web/src/main/webapp/javascript/webgl/mapview_webgl.js**
   - Fixed heightmap_scale calculation (2 lines changed)

## Files Created

1. **freeciv-web/tests/hexagon_test.js**
   - Comprehensive test suite for hexagonal coordinate math
   - 320+ lines of test code

2. **freeciv-web/src/main/webapp/javascript/webgl/maputil_hexagon_improved.js**
   - Advanced hexagon utilities for future enhancements
   - Distance-based picking, neighbor finding, distance calculation

## Recommendations for Future Work

1. **Integrate Improved Picking**: Consider using `scene_to_map_coords_hexagon_improved()` for more accurate mouse selection near hex boundaries

2. **Add More Tests**: Extend test suite to cover:
   - Edge case scenarios (map wraparound if supported)
   - Performance benchmarks
   - Visual regression tests

3. **Hexagon-Specific Features**: As noted in PR #182 documentation, consider creating:
   - `camera_hexagon.js` - Optimized camera for hex grids
   - `roads_hexagon.js` - Proper 6-direction road rendering
   - `goto_hexagon.js` - Hex-aware path visualization

4. **Documentation**: Add inline JSDoc comments to hexagon functions for better IDE support

## Conclusion

The heightmap scale bug has been fixed, bringing hexagonal tile rendering in line with square tile implementation. Comprehensive tests verify the correctness of coordinate conversions and geometry generation. The hexagonal tile renderer is now more robust and consistent with the rest of the codebase.

## Credits

- Bug fix and testing: Claude 3.5 Sonnet (via GitHub Copilot)
- Guidance: @andreasrosdal
- Original hexagonal tile implementation: Freeciv-web contributors (PR #182)
