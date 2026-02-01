# Hexagonal Map Tile Shaders

This directory contains WebGL shaders for rendering hexagonal map tiles in Freeciv 3D.

## Files

- `terrain_vertex_shader.glsl` - Vertex shader for hexagonal tiles
- `terrain_fragment_shader.glsl` - Fragment shader for hexagonal tiles

## Overview

The hexagonal shaders are designed to work with pointy-top hexagonal tile geometry.
They are functionally equivalent to the square tile shaders but with key differences
in grid rendering to accommodate the hexagonal tile structure.

## Key Features

### Terrain Rendering
- Multi-layer terrain textures (grassland, plains, desert, mountains, etc.)
- Height-based blending (beaches, snow-capped mountains)
- Terrain improvements (irrigation, farmland)
- River rendering with special water effects

### Infrastructure
- Roads with directional sprite mapping (9 directional sprites)
- Railroads with directional sprite mapping (10 directional sprites)
- Special handling for road intersections

### Visual Effects
- Border rendering with dotted patterns for different civilizations
- Mouse hover highlighting
- Selected tile highlighting
- Fog of war support
- Dynamic lighting with normal mapping
- Specular highlights and ambient occlusion

### Hexagonal-Specific Adaptations
- **No square grid overlay**: Unlike square tiles, hexagonal tiles don't render
  a visible grid pattern. The natural boundaries between hexagons provide
  visual separation.
- **Geometry-based boundaries**: The hexagon edges are defined by the
  underlying mesh geometry, not by shader-drawn lines.
- **Seamless tiling**: Textures repeat seamlessly across hexagonal tiles
  using the same UV coordinate system as square tiles.

## Differences from Square Shaders

The primary differences between hexagonal and square shaders are:

1. **Grid rendering removed**: The square shader includes code to render
   grid lines using fractional position calculations. This is removed in
   the hexagonal shader as the geometry defines the tile boundaries.

2. **Comment updates**: Comments indicate hexagonal-specific behavior
   where grid rendering would otherwise occur.

3. **Vertex shader**: Identical to square shader - all hexagonal-specific
   geometry is handled by the JavaScript geometry generation code.

## Technical Details

### Uniforms
- `maptiles` - Terrain type texture (R: terrain type, G: river modifier, B: improvements)
- `borders` - Civilization border colors
- `roadsmap` - Road and railroad types (RGB channels encode direction data)
- Terrain textures: `grassland`, `plains`, `desert`, `hills`, `mountains`, etc.
- Map dimensions: `map_x_size`, `map_y_size`
- Interaction: `mouse_x`, `mouse_y`, `selected_x`, `selected_y`
- Display options: `borders_visible`

### Vertex Attributes
- `position` - Vertex position in 3D space
- `normal` - Surface normal for lighting
- `uv` - Texture coordinates
- `vertColor` - Vertex color (used for fog of war)

### Output
- Fragment color with lighting and all visual effects applied

## Testing

The hexagonal shaders can be tested using:
- Unit tests in `freeciv-web/tests/hexagon_test.js`
- Visual testing by loading a hexagonal map in the game
- Shader validation tests to ensure proper compilation and uniform handling

## Maintenance Notes

When updating these shaders:
1. Keep them in sync with square shaders for shared features
2. Preserve hexagonal-specific comments and adaptations
3. Test with various terrain types and map sizes
4. Verify border rendering and infrastructure display
5. Check performance on low-end devices (WebGL 2 minimum requirement)
