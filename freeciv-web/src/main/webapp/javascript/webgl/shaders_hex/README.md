WebGL Hexagonal Shaders for Freeciv-web 
=============================

These are the WebGL fragment and vertex shaders used by Freeciv-web for hexagonal tile rendering. 
The shaders are at Glsl ES version 3.

Hexagonal Terrain
=================
The terrain shaders implement the rendering of hexagonal tile terrain types on the game map. 
These shaders are used when the map topology is set to hexagonal (TF_HEX).

* terrain_vertex_shader.glsl - Vertex shader for hex tiles
* terrain_fragment_shader.glsl - Fragment shader for hex tiles

Key Differences from Square Shaders
====================================
1. Grid lines are rendered as hexagons instead of squares
2. UV mapping accounts for hexagonal tile shape
3. Neighbor calculations handle 6 neighbors instead of 8
4. Coordinate system uses offset coordinates (odd-r) for proper hexagonal layout

Hexagonal Grid Math
===================
The shaders use pointy-top hexagons in an offset coordinate system:
- Width = size * √3 (approx 1.732 * size)
- Height = size * 2
- Odd rows are offset by half a hex width
- Each hex has 6 neighbors (not 8 like square tiles)
