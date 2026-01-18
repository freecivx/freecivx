# Hexagonal Tile Shaders

This directory contains shaders for rendering hexagonal map tiles.

## Files

- `terrain_vertex_shader.glsl` - Vertex shader for hex tile terrain
- `terrain_fragment_shader.glsl` - Fragment shader for hex tile terrain

## Differences from Square Shaders

Hexagonal shaders differ from square shaders in the following ways:

1. **Grid Line Rendering**: Hex tiles have 6-sided borders instead of 4-sided
2. **UV Mapping**: Adjusted for hexagonal tile shape
3. **Neighbor Calculations**: Account for 6 neighbors instead of 8

## Coordinate System

Uses odd-r offset coordinates:
- Odd rows (y % 2 == 1) are offset by half a hex width
- Hex width = base_size * √3
- Hex height = base_size * 2
- Vertical spacing = hex_height * 0.75

## Future Enhancements

- Hexagonal grid line rendering (currently uses square grid lines)
- Optimized UV mapping for hexagonal textures
- Hex-specific neighbor blending
