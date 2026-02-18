# Heightmap Generation: Hex vs Square Topology Separation

## Overview

This document describes the separation of heightmap generation code for hexagonal and square map tile topologies in the Freeciv 3D renderer.

## Implementation Date
- February 2026
- Implemented as part of the Freeciv 3D improvements initiative

## Background

Previously, the heightmap generation code was unified in a single file (`heightmap.js`) with conditional logic to handle both hex and square topologies. This made the code harder to maintain and understand, as the differences between the topologies were scattered throughout the implementation.

## Changes Made

### File Structure

**Before:**
- `freeciv-web/src/main/webapp/javascript/webgpu/heightmap.js` - Unified heightmap generation with conditionals

**After:**
- `freeciv-web/src/main/webapp/javascript/webgpu/heightmap.js` - Heightmap generation for **hex topology only**
- `freeciv-web/src/main/webapp/javascript/webgpu_square/heightmap_square.js` - Heightmap generation for **square topology only**

### Key Differences Between Topologies

| Feature | Hex Topology | Square Topology |
|---------|-------------|-----------------|
| River Depth Factor | 0.98 | 0.95 (deeper) |
| River Bank Factor | 1.045 | 1.08 (steeper) |
| Visual Result | Gentle rivers | Narrower, more defined rivers |
| Coordinate System | May use row staggering | Direct 1:1 mapping |
| Neighbor Count | 6 (filtered by `is_valid_dir()`) | 8 |

### Updated Function Calls

The calling code in `mapview_common.js` and `mapview_webgpu.js` now detects the map topology and calls the appropriate heightmap function:

```javascript
// Use appropriate heightmap update based on map topology
var useHexTopology = typeof is_hex === 'function' && is_hex();

if (useHexTopology) {
  update_heightmap(terrain_quality);
} else if (typeof update_heightmap_square === 'function') {
  update_heightmap_square(terrain_quality);
} else {
  // Fallback to hex
  update_heightmap(terrain_quality);
}
```

### Benefits

1. **Code Clarity**: Each topology has its own dedicated implementation without conditional logic
2. **Maintainability**: Easier to modify one topology without affecting the other
3. **Optimization**: Each implementation can be optimized for its specific topology
4. **Consistency**: Follows the existing pattern of `*_square.js` files in the `webgpu_square/` directory
5. **Reduced Complexity**: No need to track topology state within the heightmap functions

## Technical Details

### Hex Topology (`heightmap.js`)

The hex topology heightmap generation:
- Uses gentler river depth (0.98 factor) for better visual balance with hex tile staggering
- Uses moderate river bank steepness (1.045 factor)
- Designed to work with the hexagonal coordinate system
- Console output: "Updating heightmap (hex topology)..."

### Square Topology (`heightmap_square.js`)

The square topology heightmap generation:
- Uses deeper rivers (0.95 factor) for better visual definition on square grids
- Uses steeper river banks (1.08 factor) for narrower river appearance
- Designed for direct 8-neighbor connectivity (N, NE, E, SE, S, SW, W, NW)
- Uses bilinear interpolation for sub-tile positions
- Console output: "Updating heightmap (square topology)..."

## Testing

To test the changes:

1. **Hex Topology**: Start a game with hex map tiles (default)
   - Check console for "Updating heightmap (hex topology)..."
   - Verify rivers appear with gentle depth

2. **Square Topology**: Start a game with square map tiles
   - Check console for "Updating heightmap (square topology)..."
   - Verify rivers appear narrower and more defined

## Related Files

- `freeciv-web/src/main/webapp/javascript/webgpu/heightmap.js` - Hex heightmap
- `freeciv-web/src/main/webapp/javascript/webgpu_square/heightmap_square.js` - Square heightmap
- `freeciv-web/src/main/webapp/javascript/webgpu/mapview_common.js` - Caller (terrain update)
- `freeciv-web/src/main/webapp/javascript/webgpu/mapview_webgpu.js` - Caller (initialization)
- `freeciv-web/src/main/webapp/javascript/map.js` - Topology detection (`is_hex()`)

## Future Improvements

Potential future enhancements:
- Fine-tune river depth and bank factors based on player feedback
- Consider different interpolation methods for each topology
- Add topology-specific terrain feature rendering
- Optimize heightmap generation for very large maps

## References

- See `doc/HEX_TOPOLOGY_COMPARISON.md` for details on hex vs square topology differences
- See `doc/HEX_PLAN.md` for the overall hex topology implementation plan
