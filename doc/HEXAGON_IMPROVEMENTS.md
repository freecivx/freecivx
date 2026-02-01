# Hexagonal Map Tiles Renderer Improvements

## Overview
This document summarizes the improvements made to the hexagonal map tiles renderer in Freeciv 3D WebGL implementation.

## Problems Identified

### 1. Coordinate Conversion Issues
The `map_to_scene_coords_hexagon()` and `scene_to_map_coords_hexagon()` functions used hardcoded offset values (-470, +30) that didn't match the geometry generation code, leading to incorrect tile positioning and mouse picking.

### 2. Object Positioning Errors
Units, cities, and selection indicators used hardcoded offsets (-12, -4, etc.) that were specific to square tiles, causing incorrect positioning on hexagonal maps.

### 3. Visual Artifacts in Shaders
The hexagonal fragment shader attempted to render square grid lines, creating visual artifacts that didn't align with hexagonal tile boundaries.

## Solutions Implemented

### 1. Fixed Coordinate Conversions (`maputil_hexagon.js`)

**Changes:**
- Updated `map_to_scene_coords_hexagon()` to calculate positions using `width_half` and `height_half` values, matching the geometry generation in `init_land_geometry_hexagon()`
- Fixed `scene_to_map_coords_hexagon()` to use `Math.round()` instead of `Math.floor()` for more accurate reverse conversion
- Removed duplicate `convert_unit_rotation()` function (already defined in `maputil_square.js`)

**Formula Used:**
```javascript
var width_half = mapview_model_width / 2;
var height_half = mapview_model_height / 2;
var offsetX = (y % 2) * (hexWidth * 0.5);
var centerX = x * hexWidth + offsetX + hexRadius - width_half;
var centerY = y * vertSpace - height_half;
```

### 2. Dynamic Object Positioning (`object_position_handler_square.js`)

**Changes:**
- Added `get_tile_position_offsets()` function that returns appropriate offsets based on `map_tile_type`
- For hexagonal tiles: returns 0 offsets (since `map_to_scene_coords_hexagon()` already returns center positions)
- For square tiles: returns original hardcoded offsets (-12, -4, etc.)
- Updated all unit, city, and selection indicator positioning to use dynamic offsets
- Note: Unified city z-offset to -11 (original code had inconsistent -11 and -10 values in different update paths)

**Benefits:**
- Units appear at correct positions on hexagonal tiles
- Cities render at appropriate locations
- Selection indicators align properly with selected units
- No changes needed to square tile positioning

### 3. Shader Improvements (`shaders_hexagon/terrain_fragment_shader.glsl`)

**Changes:**
- Removed all square grid rendering code (lines using `fract((vPosition.x + 502.0) / 35.71)`)
- Added explanatory comments about why hexagonal tiles don't need explicit grid rendering
- Hexagon boundaries are naturally visible where tiles meet due to geometry edges

**Removed Code Patterns:**
```glsl
// OLD: Square grid rendering
if ((fract((vPosition.x + 502.0) / 35.71) < 0.018 || 
     fract((vPosition.z + 2.0) / 35.71) < 0.018)) {
    terrain_color.rgb = terrain_color.rgb * 1.45;
}

// NEW: Clean, no artificial grid
// Hexagonal tiles don't use square grid rendering
// The hexagon boundaries are naturally visible where tiles meet
```

## Technical Details

### Hexagonal Tile Geometry
- **Hex Radius:** `(mapview_model_width / map.xsize) * 0.5`
- **Hex Width:** `hexRadius * 2`
- **Hex Height:** `Math.sqrt(3) * hexRadius`
- **Vertical Spacing:** `hexHeight * 0.75` (allows proper tile overlap)

### Offset Coordinate System
- Odd rows (y % 2 == 1) are shifted horizontally by half a hex width
- Each hexagon has 7 vertices: 1 center + 6 perimeter vertices at 60° intervals
- 6 triangles are formed from center to each edge pair

### UV Mapping
- Center vertex: `(tx + 0.5) / map.xsize, 1 - ((ty + 0.5) / map.ysize)`
- Perimeter vertices: Adjusted by `0.5 * Math.cos(angle)` and `0.5 * Math.sin(angle)`

## Files Modified

1. **freeciv-web/src/main/webapp/javascript/webgl/maputil_hexagon.js**
   - Fixed coordinate conversion functions
   - Removed duplicate code
   - Added consistent calculations

2. **freeciv-web/src/main/webapp/javascript/webgl/object_position_handler_square.js**
   - Added `get_tile_position_offsets()` function
   - Updated 5 positioning calls to use dynamic offsets
   - Maintains backward compatibility with square tiles

3. **freeciv-web/src/main/webapp/javascript/webgl/shaders_hexagon/terrain_fragment_shader.glsl**
   - Removed 4 instances of square grid rendering
   - Cleaned up visual artifacts
   - Added explanatory comments

## Testing Recommendations

### Manual Testing
1. Start the game in standalone mode with hexagonal tiles (default in `standalone.js`)
2. Verify tile selection works correctly (click on tiles)
3. Check that units appear centered on hexagonal tiles
4. Verify cities render at correct positions
5. Test unit selection indicator positioning
6. Verify no visual grid artifacts appear

### Automated Testing
Consider adding tests for:
- Coordinate conversion roundtrips: `map → scene → map`
- Hexagonal distance calculations
- Neighbor tile finding
- UV coordinate generation
- Object positioning calculations

## Known Limitations

### Not Addressed in This Update
These features may still assume square tiles and could be improved in future updates:

1. **Camera Movement** (`camera_square.js`)
   - Camera panning and zooming might need hexagon-specific adjustments
   
2. **Road Rendering** (`roads_square.js`)
   - Road texture placement assumes square tile adjacency
   
3. **Goto Path Visualization** (`goto_square.js`)
   - Path lines might not align perfectly with hexagonal tile centers
   
4. **Map Controls** (`mapctrl_square.js`)
   - Some map interaction logic assumes square topology

5. **Heightmap Generation**
   - Currently uses same logic for both tile types (works but not optimized)

### Workarounds
The existing implementations will generally work for hexagonal tiles because:
- Dispatcher functions in `maputil_square.js` call appropriate hex/square versions
- Most positioning now uses `map_to_scene_coords()` which is tile-type-aware
- The heightmap is tile-based and works for both topologies

## Future Improvements

1. Create hexagon-specific versions of:
   - `camera_hexagon.js` - Optimized camera movement for hex grids
   - `roads_hexagon.js` - Proper 6-direction road rendering
   - `goto_hexagon.js` - Path visualization aligned to hex centers
   - `mapctrl_hexagon.js` - Hex-aware map interactions

2. Add comprehensive test suite for hexagonal coordinate math

3. Optimize heightmap generation for hexagonal topology

4. Improve hexagonal tile highlighting and effects

## References

- HEX_PLAN.md - Original implementation plan
- Three.js documentation for 3D geometry
- Freeciv server hexagonal topology implementation (C code in `freeciv/freeciv/common/map.c`)

## Authors

- Implementation: Claude 3.5 Sonnet (January 2026)
- Guidance: @andreasrosdal
- Original hexagonal geometry: Freeciv-web contributors
