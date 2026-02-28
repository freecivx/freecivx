# Road and Railroad Rendering Improvements

## Overview
This document describes the improvements made to road and railroad rendering in the Freeciv 3D terrain shaders for both hexagonal and square tile systems.

## Files Modified
- `freeciv-web/src/main/webapp/javascript/webgpu/terrain_shader_hex.js`
- `freeciv-web/src/main/webapp/javascript/webgpu_square/terrain_shader_square.js`

## Changes Made

### 1. Improved Tile-to-Tile Connectivity
**Problem**: Roads and railroads did not extend far enough beyond tile edges, causing gaps when 3+ tiles in a row had roads/railroads.

**Solution**: 
- Increased `edgeExtension` from 0.15 (15%) to 0.25 (25%)
- This ensures roads and railroads extend further beyond tile boundaries
- Guarantees seamless connectivity across multiple consecutive tiles

### 2. Enhanced Single Tile Visibility
**Problem**: Single tile roads/railroads (with no connections) were too small to be visible on the map.

**Solution**:
- Added detection for single tile roads/railroads (roadIndexForDecoding == 1)
- Implemented dynamic hub radius:
  - Normal tiles: 0.055 (for smooth junctions)
  - Single tiles: 0.12 (much larger for visibility)
- Single tile infrastructure now appears as a clearly visible circular marker

### 3. Improved Road Width and Appearance
**Changes**:
- Increased `roadWidth` from 0.06 to 0.065 (better visibility and connectivity)
- Adjusted `edgeSoftness` from 0.008 to 0.01 (smoother anti-aliasing)
- Increased `hubRadius` from 0.05 to 0.055 for connected tiles (smoother junctions)

**Color Improvements**:
- Optimized road colors for Freeciv 3D game aesthetics:
  - Base: RGB(0.50, 0.42, 0.30) - warmer dirt/gravel appearance
  - Mid: RGB(0.38, 0.32, 0.24) - better contrast
  - Dark: RGB(0.26, 0.22, 0.18) - improved depth

### 4. Enhanced Railroad Parameters
**Visual Quality Improvements**:
- `sleeperWidth`: 0.018 → 0.020 (wider sleepers for better visibility)
- `sleeperSpacing`: 0.08 → 0.075 (optimal spacing for visual clarity)
- `railWidth`: 0.012 → 0.014 (wider individual rails)
- `railGap`: 0.042 → 0.045 (optimal gap between rails)

**Color Improvements**:
- Optimized railroad colors for game aesthetics:
  - Rail metal: RGB(0.58, 0.60, 0.64) - metallic steel
  - Rail shine: RGB(0.80, 0.82, 0.85) - enhanced highlights
  - Rail dark: RGB(0.30, 0.32, 0.35) - better depth
  - Sleeper wood: RGB(0.20, 0.16, 0.12) - weathered wood appearance
  - Gravel: RGB(0.34, 0.32, 0.28) - realistic ballast

## Technical Details

### Rendering Approach
The implementation uses Signed Distance Fields (SDF) for procedural rendering:
1. **Central Hub**: Circle at tile center with dynamic radius
2. **Segments**: Capsule SDFs extending from center to tile edges (with extension)
3. **Connectivity**: Each cardinal and diagonal direction is independently rendered based on road index
4. **Blending**: Smooth anti-aliasing using distance field gradients

### Road Index Encoding
- Roads: indices 1-9, 42 (junction)
- Railroads: indices 10-19, 43 (junction)
- 1 = single tile (no connections)
- 2-9 = directional connections (N, NE, E, SE, S, SW, W, NW)
- 42/43 = multi-way junctions

## Benefits

1. **Seamless Connectivity**: Roads and railroads now connect perfectly across 3+ consecutive tiles
2. **Improved Visibility**: Single tile infrastructure is now clearly visible on the map
3. **Better Game Aesthetics**: Optimized colors and dimensions for a polished 3D game appearance
4. **Consistent Rendering**: Both hex and square tile systems use identical parameters
5. **Smoother Junctions**: Improved hub sizing creates better-looking intersections

## Testing Recommendations

To verify the improvements:
1. Create a map with roads/railroads spanning 3+ tiles in various directions
2. Place single tile roads/railroads to verify visibility
3. Test various junction types (2-way, 3-way, 4-way)
4. Verify seamless connectivity at tile boundaries
5. Check visual quality in both hex and square tile modes
