# Hexagonal Map Tile Shaders

This directory contains WebGL shaders for rendering hexagonal map tiles in Freeciv 3D.

## Files

- `terrain_vertex_shader.glsl` - Vertex shader for hexagonal tiles
- `terrain_fragment_shader.glsl` - Fragment shader for hexagonal tiles

## Notes

The hexagonal shaders are similar to the square shaders but work with hexagonal tile geometry.
The main difference is in how the geometry is generated, not in the shaders themselves.
The shaders handle texture mapping and lighting for the hexagonal tiles.
