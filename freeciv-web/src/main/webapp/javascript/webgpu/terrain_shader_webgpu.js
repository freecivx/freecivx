/**********************************************************************
    FreecivWorld.net - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2024  The Freeciv-web project

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

***********************************************************************/

/**
 * WebGPU Terrain Shader using Three.js Shading Language (TSL)
 * 
 * This shader implements terrain rendering for the Freeciv map using
 * Three.js Node System which compiles to WGSL for WebGPU.
 * 
 * Features:
 * - Hexagonal tile rendering (Civ 6 style) - each map tile is a hexagon
 * - Multi-terrain type support with automatic blending
 * - Beach/coast transitions based on elevation
 * - Border overlay rendering
 * - Hexagonal edge highlighting for visual clarity
 * - Vertex color-based fog/visibility
 * - Slope-based brightness with sun direction lighting
 * - Staggered row layout (odd-r offset coordinate system)
 * 
 * Hexagon Mathematics:
 * - Uses pointy-top hexagons (flat sides left/right, points top/bottom)
 * - Aspect ratio: width = 1.0, height = sqrt(3) ≈ 1.732
 * - Odd rows are offset by half a tile width (odd-r offset coordinates)
 * - Reference: https://www.redblobgames.com/grids/hexagons/
 */

function createTerrainShaderTSL(uniforms) {
    // Import TSL functions and nodes from THREE
    // These should be available after three-modules-webgpu.js has loaded
    const { 
        texture, uniform, positionLocal, attribute, uv, normalLocal,
        vec2, vec3, vec4,
        mix, step, floor, fract, mod, dot, sin, cos, normalize, max, min, pow, clamp, abs,
        mul, add, sub, div
    } = THREE;
    
    // Verify all required TSL functions and nodes are available
    const requiredTSLNames = [
        'texture', 'uniform', 'positionLocal', 'attribute', 'uv', 'normalLocal',
        'vec2', 'vec3', 'vec4',
        'mix', 'step', 'floor', 'fract', 'mod', 'dot', 'sin', 'cos', 'normalize', 'max', 'min', 'pow', 'clamp', 'abs',
        'mul', 'add', 'sub', 'div'
    ];
    const missing = requiredTSLNames.filter(name => THREE[name] === undefined);
    if (missing.length > 0) {
        console.error('Missing TSL functions/nodes:', missing);
        throw new Error(`Required TSL functions/nodes not available: ${missing.join(', ')}. Ensure three-modules-webgpu.js has loaded successfully.`);
    }

    // Define terrain type constants (matching game logic)
    const TERRAIN_INACCESSIBLE = 0.0;
    const TERRAIN_LAKE = 10.0;
    const TERRAIN_COAST = 20.0;
    const TERRAIN_FLOOR = 30.0;
    const TERRAIN_ARCTIC = 40.0;
    const TERRAIN_DESERT = 50.0;
    const TERRAIN_FOREST = 60.0;
    const TERRAIN_GRASSLAND = 70.0;
    const TERRAIN_HILLS = 80.0;
    const TERRAIN_JUNGLE = 90.0;
    const TERRAIN_MOUNTAINS = 100.0;
    const TERRAIN_PLAINS = 110.0;
    const TERRAIN_SWAMP = 120.0;
    const TERRAIN_TUNDRA = 130.0;

    // Height constants for beach blending
    const BEACH_HIGH = 50.9;
    const BEACH_BLEND_HIGH = 50.4;

    // =========================================================================
    // HEXAGONAL TILE CONSTANTS
    // =========================================================================
    // Pointy-top hexagons (Civ 6 style): flat sides on left/right, points on top/bottom
    // For a pointy-top hex with radius R (center to corner):
    // - width = R * sqrt(3) = R * 1.732
    // - height = R * 2
    // We normalize so that one tile maps to roughly 1.0 in UV space per tile
    const HEX_SQRT3_OVER_2 = 0.866025; // sqrt(3)/2 ≈ 0.866 - used for hex edge normals
    // HEX_MESH_HEIGHT_FACTOR matches the mesh geometry compression factor (sqrt(3)/2)
    // The mesh compresses Y by this factor, so tiles appear wider than tall in world space
    const HEX_MESH_HEIGHT_FACTOR = HEX_SQRT3_OVER_2;
    // To draw a proper pointy-top hex (taller than wide) that looks correct after mesh compression,
    // we need to stretch the hex in UV space by the inverse of the compression factor
    // This counteracts the mesh compression so the final rendered hex has correct proportions
    const HEX_ASPECT = 1.0 / HEX_MESH_HEIGHT_FACTOR; // ≈ 1.1547 - Y-coordinate scale factor for hex geometry
    const HEX_EDGE_WIDTH = 0.045; // Width of hex edge highlight (as fraction of tile) - increased for better horizontal visibility
    const HEX_EDGE_SOFTNESS = 0.025; // Edge anti-aliasing softness
    const HEX_EDGE_BLEND_STRENGTH = 0.32; // How strongly hex edges darken the terrain (0-1) - slightly reduced for balance
    const HEX_EDGE_COLOR_R = 0.15; // Red component of edge darkening color
    const HEX_EDGE_COLOR_G = 0.12; // Green component of edge darkening color  
    const HEX_EDGE_COLOR_B = 0.08; // Blue component of edge darkening color
    const TEXTURE_RANDOM_SCALE = 16.0; // Divisor for random texture offset - larger = less variation

    // =========================================================================
    // GOTO PATH HIGHLIGHTING CONSTANTS
    // =========================================================================
    // These control the white edge highlight effect for goto path tiles
    // Note: GOTO_EDGE_WIDTH must be > 0 to avoid division by zero in edge calculations
    const GOTO_EDGE_WIDTH = 0.08;       // Width of the white edge highlight (as fraction of tile, must be > 0)
    const GOTO_EDGE_SOFTNESS = 0.03;    // Edge anti-aliasing softness
    const GOTO_EDGE_BRIGHTNESS = 0.95;  // Brightness of the white edge (0-1)
    const GOTO_FILL_BRIGHTNESS = 0.25;  // Subtle fill brightness for goto tiles (0-1)

    // Create texture references for reuse (don't call texture() yet)
    const maptilesTex = uniforms.maptiles.value;
    const bordersTex = uniforms.borders.value;
    const gotoTilesTex = uniforms.goto_tiles.value;
    
    // Terrain texture references - organized by terrain type
    const terrainTextures = {
        arctic: uniforms.arctic_farmland_irrigation_tundra.value,
        grassland: uniforms.grassland.value,
        coast: uniforms.coast.value,
        desert: uniforms.desert.value,
        ocean: uniforms.ocean.value,
        plains: uniforms.plains.value,
        hills: uniforms.hills.value,
        mountains: uniforms.mountains.value,
        swamp: uniforms.swamp.value
    };

    // Map size uniforms
    const map_x_size = uniform(uniforms.map_x_size.value);
    const map_y_size = uniform(uniforms.map_y_size.value);
    const borders_visible = uniform(uniforms.borders_visible.value);
    const debug_enabled = uniform(uniforms.debug_enabled.value);

    // Get UV coordinates and position
    const uvNode = uv();
    const posNode = positionLocal;

    // Access vertex color for fog of war (stored in vertColor attribute)
    // The vertColor attribute contains visibility information:
    // - 0.0 = unknown (black)
    // - 0.54 = unseen but known (fogged)
    // - 1.06 = fully visible
    const vertColor = attribute('vertColor');

    // =========================================================================
    // HEXAGONAL TILE COORDINATE SYSTEM (Offset Coordinates - Odd-R)
    // =========================================================================
    // Each map tile is rendered as a hexagon using the odd-r offset coordinate system.
    // In this system:
    // - Hexagons are pointy-top (flat sides left/right)
    // - Odd rows are shifted right by half a tile width
    // - Each tile has 6 neighbors in hex directions
    //
    // Reference: https://www.redblobgames.com/grids/hexagons/#coordinates-offset
    
    // Calculate which tile row we're in (used for stagger offset)
    const tileYRaw = mul(map_y_size, uvNode.y);
    const tileY = floor(tileYRaw);
    
    // Hex stagger: mesh geometry offsets odd rows by 0.5 tile width
    // However, UV.y is inverted (1 - meshRow/gridY), so we need to calculate
    // the original mesh row parity. The mesh row ≈ (map_y_size - 1 - tileY),
    // so isOddRow = ((map_y_size - 1) - tileY) % 2
    // This ensures row 0 is normal and row 1+ alternates correctly
    const isOddRow = mod(sub(sub(map_y_size, 1.0), tileY), 2.0);
    
    // Calculate hex-adjusted UV coordinates
    // Remove the stagger from UV to get the logical tile X coordinate
    const hexOffsetX = mul(isOddRow, div(0.5, map_x_size));
    const hexUvX = sub(uvNode.x, hexOffsetX);
    const hexUV = vec2(hexUvX, uvNode.y);
    
    // Calculate the tile X coordinate
    const tileXRaw = mul(map_x_size, hexUvX);
    const tileX = floor(tileXRaw);
    
    // =========================================================================
    // HEXAGONAL CELL LOCAL COORDINATES
    // =========================================================================
    // Calculate position within the current hex cell (0 to 1 range)
    // This is used for hex shape masking and edge detection
    const localX = fract(tileXRaw);
    const localY = fract(tileYRaw);
    
    // Transform local coordinates to hex-centered system (-0.5 to 0.5 range)
    // Center is at (0, 0), corners at edges
    const centeredX = sub(localX, 0.5);
    const centeredY = sub(localY, 0.5);
    
    // =========================================================================
    // HEXAGONAL DISTANCE FUNCTION (Signed Distance Field)
    // =========================================================================
    // Calculate signed distance to hexagon edge for pointy-top hex
    // A pointy-top hexagon has vertices at 30°, 90°, 150°, 210°, 270°, 330°
    // The hex is inscribed in a circle, so we check distance to 3 edge pairs
    //
    // For a regular pointy-top hexagon centered at origin with inradius 0.5:
    // The three edge normal directions are at 0°, 60°, and 120°
    // Edge normals: (1,0), (0.5, sqrt(3)/2), (-0.5, sqrt(3)/2)
    
    // Scale Y coordinate to account for the mesh's height compression
    // The mesh compresses tiles by HEX_MESH_HEIGHT_FACTOR in the Y direction,
    // making tiles appear wider than tall. To draw hexes that look correct
    // after this compression (pointy-top hexes should be taller than wide),
    // we stretch the hex shape in UV space by HEX_ASPECT (the inverse factor)
    const hexX = centeredX;
    const hexY = mul(centeredY, HEX_ASPECT);
    
    // Calculate distance to three pairs of hex edges using dot products with edge normals
    // Edge 1: vertical edges (normal = (1, 0)) - horizontal direction edges
    const dist1 = abs(hexX);
    
    // Edge 2: top-right and bottom-left edges (normal = (0.5, sqrt(3)/2))
    const dist2 = abs(add(mul(hexX, 0.5), mul(hexY, HEX_SQRT3_OVER_2)));
    
    // Edge 3: top-left and bottom-right edges (normal = (-0.5, sqrt(3)/2))
    const dist3 = abs(add(mul(hexX, -0.5), mul(hexY, HEX_SQRT3_OVER_2)));
    
    // The distance to hex edge is the maximum of these three distances
    // For a pointy-top hex with inradius 0.5, points inside have max(dist1,dist2,dist3) < 0.5
    const hexDist = max(max(dist1, dist2), dist3);
    
    // =========================================================================
    // HEX EDGE MASK FOR VISUAL BORDERS BETWEEN TILES
    // =========================================================================
    // Create a soft edge mask that's 0 at hex interior and 1 at edges
    // This creates the distinctive Civ 6-style hex tile borders
    //
    // Use different edge widths for horizontal (X) vs diagonal (Y-influenced) edges
    // to balance visual appearance after mesh compression
    const hexInradius = 0.5; // Radius from center to edge midpoint
    
    // Calculate directionally-weighted edge distance for balanced appearance
    // The Y-direction edges appear thicker due to mesh compression, so we use
    // a blended approach: horizontal edges (dist1) get full width, 
    // diagonal edges (dist2, dist3) get slightly reduced width
    const HEX_EDGE_WIDTH_HORIZONTAL = 0.05;  // Wider edges on left/right for better X visibility
    const HEX_EDGE_WIDTH_DIAGONAL = 0.035;   // Narrower edges on top/bottom to reduce Y edge prominence
    
    // Determine which edge is active and blend edge widths accordingly
    // When dist1 is the dominant edge (horizontal), use wider edge
    // When dist2 or dist3 is dominant (diagonal), use narrower edge
    const isHorizontalEdge = step(max(dist2, dist3), dist1);
    const effectiveEdgeWidth = mix(HEX_EDGE_WIDTH_DIAGONAL, HEX_EDGE_WIDTH_HORIZONTAL, isHorizontalEdge);
    const edgeStart = sub(hexInradius, effectiveEdgeWidth);
    
    // Smooth step from interior to edge
    // hexEdgeMask = smoothstep(edgeStart, hexInradius, hexDist)
    // Using manual smoothstep: t = clamp((x-edge0)/(edge1-edge0), 0, 1); return t*t*(3-2*t)
    const edgeT = clamp(div(sub(hexDist, edgeStart), effectiveEdgeWidth), 0.0, 1.0);
    const hexEdgeMask = mul(mul(edgeT, edgeT), sub(3.0, mul(2.0, edgeT)));
    
    // =========================================================================
    // TERRAIN SAMPLING AT HEX TILE CENTER
    // =========================================================================
    // Sample terrain type from the center of the current hex tile
    // This ensures consistent terrain per hex, not per pixel
    const tileCenterU = div(add(tileX, 0.5), map_x_size);
    const tileCenterV = div(add(tileY, 0.5), map_y_size);
    
    // Add back the hex stagger offset for odd rows when sampling
    const tileCenterUStaggered = add(tileCenterU, hexOffsetX);
    const tileCenterUV = vec2(tileCenterUStaggered, tileCenterV);
    
    // Add pseudo-random texture offset for visual variety within tiles
    // TEXTURE_RANDOM_SCALE controls amplitude: larger value = smaller random offset
    const rndSeed = dot(tileCenterUV, vec2(12.98, 78.233));
    const rnd = fract(mul(sin(rndSeed), 43758.5453));
    const rndOffset = mul(sub(rnd, 0.5), div(1.0, mul(TEXTURE_RANDOM_SCALE, vec2(map_x_size, map_y_size))));
    const sampledUV = add(tileCenterUV, rndOffset);

    // Sample terrain type using hex tile center
    const terrainType = texture(maptilesTex, sampledUV);
    const borderColor = texture(bordersTex, hexUV);

    // Calculate texture coordinates for terrain detail within the hex
    // dx/dy: Local position within the current hex tile (0-1 range)
    // Used for standard terrain texture sampling
    const dx = localX;
    const dy = localY;
    
    // tdx/tdy: Diagonal texture coordinates for tundra/arctic terrain types
    // These create a 2x2 tile pattern by mapping each tile to a quadrant of the texture atlas
    // The formula calculates: (tile_position / 2) - (floor(tile_position) * 0.5)
    // This gives values in [0, 0.5] range that repeat every 2 tiles
    const tdx = sub(div(mul(map_x_size, hexUV.x), 2.0), mul(0.5, floor(mul(map_x_size, hexUV.x))));
    const tdy = sub(div(mul(map_y_size, hexUV.y), 2.0), mul(0.5, floor(mul(map_y_size, hexUV.y))));

    // Extract terrain type value from texture (stored in red channel as 0-255 value)
    const terrainHere = floor(mul(terrainType.r, 256.0));
    const posY = posNode.y;

    // Texture coordinate nodes for hexagonal tiles
    // texCoord: Standard coordinates for most terrain types
    // texCoordT: Offset coordinates for arctic/tundra (uses 2x2 texture atlas pattern)
    const texCoord = vec2(dx, dy);
    const texCoordT = vec2(tdx, add(tdy, 0.5));

    /**
     * Helper function to create terrain selection and blending logic
     * 
     * @param {number} terrainValue - The terrain type ID to match (e.g., TERRAIN_GRASSLAND)
     * @param {object} textureNode - TSL texture node for this terrain type
     * @param {object} coord - TSL vec2 coordinate node for texture sampling
     * @param {boolean} blendWithCoast - If true, blends with coast texture at lower elevations
     * @returns {object} Object with mask (selection boolean) and color (sampled texture) nodes
     * 
     * Uses step functions to create smooth transitions between terrain types.
     * When blendWithCoast is true, terrain at elevations below BEACH_BLEND_HIGH
     * transitions to coast texture, creating natural beach areas.
     */
    function createTerrainLayer(terrainValue, textureNode, coord, blendWithCoast = true) {
        // Create float mask for this terrain type (ensure it's a float, not boolean)
        // Split step() operations and use mul() to ensure float multiplication
        const step1 = step(terrainValue - 0.5, terrainHere);
        const step2 = step(terrainHere, terrainValue + 0.5);
        const isTerrain = mul(step1, step2);
        
        // Sample terrain texture
        let terrainColor;
        if (blendWithCoast) {
            // Blend with coast texture at lower elevations (beaches)
            terrainColor = mix(
                texture(terrainTextures.coast, coord),
                texture(textureNode, coord),
                step(BEACH_BLEND_HIGH, posY)
            );
        } else {
            terrainColor = texture(textureNode, coord);
        }
        
        return { mask: isTerrain, color: terrainColor };
    }

    // Build terrain layers - including all terrain types from WebGL shader
    // Note: TERRAIN_INACCESSIBLE (0) renders as black (default finalColor)
    const layers = [
        createTerrainLayer(TERRAIN_GRASSLAND, terrainTextures.grassland, texCoord, true),
        createTerrainLayer(TERRAIN_PLAINS, terrainTextures.plains, texCoord, true),
        createTerrainLayer(TERRAIN_DESERT, terrainTextures.desert, texCoord, true),
        createTerrainLayer(TERRAIN_HILLS, terrainTextures.hills, texCoord, true),
        createTerrainLayer(TERRAIN_MOUNTAINS, terrainTextures.mountains, texCoord, true),
        createTerrainLayer(TERRAIN_SWAMP, terrainTextures.swamp, texCoord, true),
        createTerrainLayer(TERRAIN_FOREST, terrainTextures.grassland, texCoord, true), // Forest uses grassland texture
        createTerrainLayer(TERRAIN_JUNGLE, terrainTextures.plains, texCoord, true), // Jungle uses plains texture
        createTerrainLayer(TERRAIN_COAST, terrainTextures.coast, texCoord, false),
        createTerrainLayer(TERRAIN_FLOOR, terrainTextures.ocean, texCoord, false),
        createTerrainLayer(TERRAIN_LAKE, terrainTextures.coast, texCoord, false), // Lake uses coast texture
        createTerrainLayer(TERRAIN_ARCTIC, terrainTextures.arctic, texCoordT, false),
        createTerrainLayer(TERRAIN_TUNDRA, terrainTextures.arctic, vec2(add(tdx, 0.5), tdy), false) // Tundra uses arctic with offset
    ];

    // Combine all terrain layers
    // Starts with black (0,0,0,1) which handles TERRAIN_INACCESSIBLE and unknown tiles
    let finalColor = vec4(0, 0, 0, 1);
    for (const layer of layers) {
        finalColor = mix(finalColor, layer.color, layer.mask);
    }

    // =========================================================================
    // SLOPE-BASED LIGHTING WITH SUN DIRECTION
    // =========================================================================
    // Calculate lighting based on terrain slope and sun direction
    // Sun direction: coming from southeast, elevated position (typical daytime sun)
    // Original (0.5, 0.7, 0.5), normalized = (0.503, 0.704, 0.503)
    const sunDir = vec3(0.503, 0.704, 0.503);
    
    // Access vertex normal for slope calculation
    // normalLocal gives us the surface normal which indicates slope direction
    const normal = normalLocal;
    
    // Calculate diffuse lighting using Lambert's law: max(0, N·L)
    // This gives brighter surfaces facing the sun and darker surfaces facing away
    const NdotL = max(dot(normal, sunDir), 0.0);
    
    // Apply ambient + diffuse lighting model
    // ambient: base brightness so shadows aren't completely black (0.45)
    // diffuse: sun-facing surfaces get additional brightness (0.65)
    // Total range: 0.45 (in shadow) to 1.10 (fully lit)
    const ambientLight = 0.45;
    const diffuseStrength = 0.65;
    const lightingFactor = add(ambientLight, mul(NdotL, diffuseStrength));
    
    // Apply lighting to terrain color, making terrain brighter overall
    // Also add a slight brightness boost (1.1x) to make terrain more vibrant
    const brightnessBoost = 1.1;
    finalColor = vec4(mul(mul(finalColor.rgb, lightingFactor), brightnessBoost), finalColor.a);

    // =========================================================================
    // HEXAGONAL EDGE HIGHLIGHTING (Civ 6 Style)
    // =========================================================================
    // Apply subtle darkening at hex edges to create visible hex tile boundaries
    // This gives the distinctive Civilization 6 hexagonal map appearance
    const hexEdgeColor = vec3(HEX_EDGE_COLOR_R, HEX_EDGE_COLOR_G, HEX_EDGE_COLOR_B);
    
    // Blend hex edge color with terrain based on edge mask
    // The edge mask is strongest at hex boundaries and fades toward center
    const hexEdgeBlend = mul(hexEdgeMask, HEX_EDGE_BLEND_STRENGTH);
    finalColor = vec4(
        mix(finalColor.rgb, hexEdgeColor, hexEdgeBlend),
        finalColor.a
    );

    // Apply vertex color for fog/visibility effects
    // Vertex color is stored in the vertColor attribute and represents visibility/fog of war
    // vertColor.x = 0.0 means unknown (black)
    // vertColor.x = 0.54 means unseen but known (fogged)
    // vertColor.x = 1.06 means fully visible
    // We use only the x component as that's where the visibility value is stored
    finalColor = vec4(mul(finalColor.rgb, vertColor.x), finalColor.a);

    // Overlay borders if visible
    // Blend border color with terrain color at low opacity for subtle borders
    // This matches the WebGL shader behavior which blends borders at 0.10 or 0.70 opacity
    // We use a fixed blend of 0.15 for WebGPU (slightly more visible than WebGL's 0.10)
    const shouldShowBorders = mul(borders_visible.select(1.0, 0.0), borderColor.a);
    // Reduce the border influence by multiplying with a low opacity factor
    const borderBlendFactor = mul(shouldShowBorders, 0.15);
    finalColor = vec4(
        mix(finalColor.rgb, borderColor.rgb, borderBlendFactor),
        finalColor.a
    );

    // =========================================================================
    // GOTO PATH HIGHLIGHTING
    // =========================================================================
    // Sample the goto tiles texture to check if this tile is part of the goto path
    // The goto_tiles texture has R channel = 255 for tiles on the path, 0 otherwise
    // NOTE: We use tileCenterUV (exact tile center) instead of sampledUV (which has random offset)
    // to ensure accurate tile-by-tile path detection without sampling artifacts
    const gotoTileValue = texture(gotoTilesTex, tileCenterUV);
    const isGotoTile = step(0.5, gotoTileValue.r); // 1.0 if on goto path, 0.0 otherwise
    
    // Calculate goto path edge highlight using hex distance
    // Create a bright white edge around the hexagon for goto path tiles
    const gotoEdgeStart = sub(0.5, GOTO_EDGE_WIDTH);
    const gotoEdgeT = clamp(div(sub(hexDist, gotoEdgeStart), GOTO_EDGE_WIDTH), 0.0, 1.0);
    // Manual smoothstep implementation: t*t*(3-2*t) where t is clamped to [0,1]
    // This creates a smooth interpolation curve for anti-aliased edges
    const gotoEdgeMask = mul(mul(gotoEdgeT, gotoEdgeT), sub(3.0, mul(2.0, gotoEdgeT)));
    
    // Create a subtle fill for the entire goto tile interior
    const gotoFillIntensity = mul(sub(1.0, gotoEdgeMask), GOTO_FILL_BRIGHTNESS);
    
    // Combine edge and fill for final goto highlight intensity
    const gotoHighlightIntensity = add(mul(gotoEdgeMask, GOTO_EDGE_BRIGHTNESS), gotoFillIntensity);
    
    // White color for goto path highlight
    const gotoHighlightColor = vec3(1.0, 1.0, 1.0);
    
    // Apply goto highlight only to tiles that are part of the goto path
    const gotoBlendAmount = mul(isGotoTile, gotoHighlightIntensity);
    finalColor = vec4(
        mix(finalColor.rgb, gotoHighlightColor, gotoBlendAmount),
        finalColor.a
    );

    // =========================================================================
    // DEBUG MODE: TILE COORDINATE DISPLAY
    // =========================================================================
    // When webgpu_debug_enabled is true, render tile coordinates (x:y) as text
    // using a 7-segment style digit display in the shader
    
    // 7-segment display encoding for digits 0-9
    // Each digit is represented as a 7-bit value where each bit represents a segment:
    //   Segment layout:   --0--
    //                    |     |
    //                    5     1
    //                    |     |
    //                     --6--
    //                    |     |
    //                    4     2
    //                    |     |
    //                     --3--
    // Digit encodings: 0=0x3F, 1=0x06, 2=0x5B, 3=0x4F, 4=0x66, 5=0x6D, 6=0x7D, 7=0x07, 8=0x7F, 9=0x6F
    
    /**
     * Helper function to create a 7-segment digit mask at a given position
     * @param {node} digitValue - The digit to display (0-9)
     * @param {node} pixelX - Current pixel X position within digit area (0-1)
     * @param {node} pixelY - Current pixel Y position within digit area (0-1)
     * @returns {node} - 1.0 if pixel should be lit, 0.0 otherwise
     */
    function renderDigit(digitValue, pixelX, pixelY) {
        // Segment dimensions (relative to digit cell)
        const segW = 0.7;  // Segment width (horizontal segments)
        const segH = 0.12; // Segment height/thickness
        const segL = 0.35; // Segment length (vertical segments)
        
        // Helper: Create a horizontal segment
        function hSeg(cx, cy) {
            const inX = step(sub(cx, div(segW, 2.0)), pixelX).mul(step(pixelX, add(cx, div(segW, 2.0))));
            const inY = step(sub(cy, div(segH, 2.0)), pixelY).mul(step(pixelY, add(cy, div(segH, 2.0))));
            return mul(inX, inY);
        }
        
        // Helper: Create a vertical segment
        function vSeg(cx, cy) {
            const inX = step(sub(cx, div(segH, 2.0)), pixelX).mul(step(pixelX, add(cx, div(segH, 2.0))));
            const inY = step(sub(cy, div(segL, 2.0)), pixelY).mul(step(pixelY, add(cy, div(segL, 2.0))));
            return mul(inX, inY);
        }
        
        // Define segment positions (centered in 0-1 range)
        const centerX = 0.5;
        const topY = 0.88;
        const midY = 0.5;
        const botY = 0.12;
        const leftX = 0.18;
        const rightX = 0.82;
        const topMidY = 0.69;
        const botMidY = 0.31;
        
        // Create all 7 segments
        const seg0 = hSeg(centerX, topY);     // Top
        const seg1 = vSeg(rightX, topMidY);   // Top-right
        const seg2 = vSeg(rightX, botMidY);   // Bottom-right
        const seg3 = hSeg(centerX, botY);     // Bottom
        const seg4 = vSeg(leftX, botMidY);    // Bottom-left
        const seg5 = vSeg(leftX, topMidY);    // Top-left
        const seg6 = hSeg(centerX, midY);     // Middle
        
        // Digit segment patterns (which segments are on for each digit)
        // 0: segments 0,1,2,3,4,5 (all except middle)
        // 1: segments 1,2
        // 2: segments 0,1,6,4,3
        // 3: segments 0,1,6,2,3
        // 4: segments 5,6,1,2
        // 5: segments 0,5,6,2,3
        // 6: segments 0,5,4,3,2,6
        // 7: segments 0,1,2
        // 8: all segments
        // 9: segments 0,1,2,3,5,6
        
        // Use step functions to select segments based on digit value
        const is0 = mul(step(digitValue, 0.5), step(-0.5, digitValue));
        const is1 = mul(step(digitValue, 1.5), step(0.5, digitValue));
        const is2 = mul(step(digitValue, 2.5), step(1.5, digitValue));
        const is3 = mul(step(digitValue, 3.5), step(2.5, digitValue));
        const is4 = mul(step(digitValue, 4.5), step(3.5, digitValue));
        const is5 = mul(step(digitValue, 5.5), step(4.5, digitValue));
        const is6 = mul(step(digitValue, 6.5), step(5.5, digitValue));
        const is7 = mul(step(digitValue, 7.5), step(6.5, digitValue));
        const is8 = mul(step(digitValue, 8.5), step(7.5, digitValue));
        const is9 = mul(step(digitValue, 9.5), step(8.5, digitValue));
        
        // Segment 0 (top): on for 0,2,3,5,6,7,8,9
        const s0on = add(add(add(add(add(add(add(is0, is2), is3), is5), is6), is7), is8), is9);
        // Segment 1 (top-right): on for 0,1,2,3,4,7,8,9
        const s1on = add(add(add(add(add(add(add(is0, is1), is2), is3), is4), is7), is8), is9);
        // Segment 2 (bottom-right): on for 0,1,3,4,5,6,7,8,9
        const s2on = add(add(add(add(add(add(add(add(is0, is1), is3), is4), is5), is6), is7), is8), is9);
        // Segment 3 (bottom): on for 0,2,3,5,6,8,9
        const s3on = add(add(add(add(add(add(is0, is2), is3), is5), is6), is8), is9);
        // Segment 4 (bottom-left): on for 0,2,6,8
        const s4on = add(add(add(is0, is2), is6), is8);
        // Segment 5 (top-left): on for 0,4,5,6,8,9
        const s5on = add(add(add(add(add(is0, is4), is5), is6), is8), is9);
        // Segment 6 (middle): on for 2,3,4,5,6,8,9
        const s6on = add(add(add(add(add(add(is2, is3), is4), is5), is6), is8), is9);
        
        // Combine segments with their on/off states
        const digitMask = add(
            add(add(mul(seg0, s0on), mul(seg1, s1on)), add(mul(seg2, s2on), mul(seg3, s3on))),
            add(add(mul(seg4, s4on), mul(seg5, s5on)), mul(seg6, s6on))
        );
        
        return clamp(digitMask, 0.0, 1.0);
    }
    
    // Render colon character
    function renderColon(pixelX, pixelY) {
        const dotRadius = 0.12;
        const centerX = 0.5;
        const topDotY = 0.65;
        const botDotY = 0.35;
        
        // Create two dots for colon
        const topDist = add(mul(sub(pixelX, centerX), sub(pixelX, centerX)), 
                           mul(sub(pixelY, topDotY), sub(pixelY, topDotY)));
        const botDist = add(mul(sub(pixelX, centerX), sub(pixelX, centerX)), 
                           mul(sub(pixelY, botDotY), sub(pixelY, botDotY)));
        
        const topDot = step(topDist, mul(dotRadius, dotRadius));
        const botDot = step(botDist, mul(dotRadius, dotRadius));
        
        return clamp(add(topDot, botDot), 0.0, 1.0);
    }
    
    // Calculate the debug display area (center of each tile)
    // The display shows "XX:YY" format where XX and YY are 2-digit coordinates
    const debugAreaWidth = 0.8;   // 80% of tile width
    const debugAreaHeight = 0.25; // 25% of tile height  
    const debugAreaX = sub(localX, div(sub(1.0, debugAreaWidth), 2.0));  // Centered X
    const debugAreaY = sub(localY, div(sub(1.0, debugAreaHeight), 2.0)); // Centered Y
    
    // Normalize to debug area coordinates (0-1 within the debug display area)
    const debugNormX = div(debugAreaX, debugAreaWidth);
    const debugNormY = div(debugAreaY, debugAreaHeight);
    
    // Check if pixel is within the debug display area
    const inDebugAreaX = mul(step(0.0, debugNormX), step(debugNormX, 1.0));
    const inDebugAreaY = mul(step(0.0, debugNormY), step(debugNormY, 1.0));
    const inDebugArea = mul(inDebugAreaX, inDebugAreaY);
    
    // Character layout: [X tens] [X ones] [:] [Y tens] [Y ones]
    // Each character takes 1/5 of the width
    const charWidth = 0.2;
    const charIndex = floor(mul(debugNormX, 5.0));
    const charLocalX = fract(mul(debugNormX, 5.0)); // 0-1 within current character
    const charLocalY = debugNormY;
    
    // Get tile coordinates (need to flip Y to match game coordinate system)
    const displayTileX = tileX;
    const displayTileY = sub(map_y_size, add(tileY, 1.0)); // Flip Y axis: (map_y_size - 1 - tileY)
    
    // Extract digits for X coordinate (tens and ones)
    const xTens = floor(div(displayTileX, 10.0));
    const xOnes = sub(displayTileX, mul(xTens, 10.0));
    
    // Extract digits for Y coordinate (tens and ones)
    const yTens = floor(div(displayTileY, 10.0));
    const yOnes = sub(displayTileY, mul(yTens, 10.0));
    
    // Render each character based on charIndex
    const isChar0 = mul(step(charIndex, 0.5), step(-0.5, charIndex)); // X tens
    const isChar1 = mul(step(charIndex, 1.5), step(0.5, charIndex));  // X ones
    const isChar2 = mul(step(charIndex, 2.5), step(1.5, charIndex));  // Colon
    const isChar3 = mul(step(charIndex, 3.5), step(2.5, charIndex));  // Y tens
    const isChar4 = mul(step(charIndex, 4.5), step(3.5, charIndex));  // Y ones
    
    // Render the appropriate digit/character for each position
    const char0Mask = mul(isChar0, renderDigit(xTens, charLocalX, charLocalY));
    const char1Mask = mul(isChar1, renderDigit(xOnes, charLocalX, charLocalY));
    const char2Mask = mul(isChar2, renderColon(charLocalX, charLocalY));
    const char3Mask = mul(isChar3, renderDigit(yTens, charLocalX, charLocalY));
    const char4Mask = mul(isChar4, renderDigit(yOnes, charLocalX, charLocalY));
    
    // Combine all character masks
    const textMask = add(add(add(add(char0Mask, char1Mask), char2Mask), char3Mask), char4Mask);
    
    // Apply debug overlay: yellow text on semi-transparent dark background
    const debugBgColor = vec3(0.0, 0.0, 0.0);       // Black background
    const debugTextColor = vec3(1.0, 1.0, 0.0);     // Yellow text
    const bgOpacity = 0.5;  // 50% opacity for background
    
    // Create the debug display color
    const debugDisplayColor = mix(
        mix(finalColor.rgb, debugBgColor, mul(inDebugArea, bgOpacity)),
        debugTextColor,
        mul(inDebugArea, textMask)
    );
    
    // Only apply debug display when debug mode is enabled
    finalColor = debug_enabled.select(
        vec4(debugDisplayColor, finalColor.a),
        finalColor
    );

    // =========================================================================
    // DEBUG MODE: GOTO PATH DIRECTION DISPLAY
    // =========================================================================
    // When debug mode is enabled and tile is part of goto path, show direction info
    // The goto_tiles texture encodes:
    //   R channel: 255 if on path (isGotoTile)
    //   G channel: direction + 1 (1-8, or 0 for start tile)
    //   B channel: step index (0-254)
    
    // Extract direction and step info from goto texture
    // Direction is stored as (direction_index + 1) in G channel, scaled 0-1
    // Values: 0 = start, 1-8 = directions (NW=1, N=2, NE=3, W=4, E=5, SW=6, S=7, SE=8)
    const gotoDirection = floor(mul(gotoTileValue.g, 255.1)); // Convert 0-1 to 0-8
    const gotoStepIndex = floor(mul(gotoTileValue.b, 255.1)); // Convert 0-1 to 0-254
    
    // Define positions for goto debug display (below the coordinate display)
    const gotoDebugAreaY = sub(localY, div(sub(1.0, 0.35), 2.0)); // Shifted down for second line
    const gotoDebugNormY = div(add(gotoDebugAreaY, 0.15), 0.25); // Offset down from coordinate display
    
    // Check if in goto debug display area (below coordinate display)
    const inGotoDebugY = mul(step(0.0, gotoDebugNormY), step(gotoDebugNormY, 1.0));
    const inGotoDebugArea = mul(mul(inDebugAreaX, inGotoDebugY), isGotoTile);
    
    // Direction encoding for display: show as single digit (0-8) or letter symbol
    // We'll display "D#" where # is direction, and "S##" where ## is step (simplified)
    
    // Use charIndex from coordinate display code for positioning
    // Reuse the character rendering infrastructure
    // Display format: "D# S##" (Direction, Space, Step)
    const gotoCharIndex = floor(mul(debugNormX, 5.0));
    const gotoCharLocalX = fract(mul(debugNormX, 5.0));
    
    // For goto debug, we show:
    // Position 0: D (direction label)
    // Position 1: direction digit (0-8)
    // Position 2: space (empty)
    // Position 3: step tens digit
    // Position 4: step ones digit
    
    const isGotoChar0 = mul(step(gotoCharIndex, 0.5), step(-0.5, gotoCharIndex)); // D
    const isGotoChar1 = mul(step(gotoCharIndex, 1.5), step(0.5, gotoCharIndex));  // direction digit
    const isGotoChar2 = mul(step(gotoCharIndex, 2.5), step(1.5, gotoCharIndex));  // space
    const isGotoChar3 = mul(step(gotoCharIndex, 3.5), step(2.5, gotoCharIndex));  // step tens
    const isGotoChar4 = mul(step(gotoCharIndex, 4.5), step(3.5, gotoCharIndex));  // step ones
    
    // Extract step digits
    const stepTens = floor(div(gotoStepIndex, 10.0));
    const stepOnes = sub(gotoStepIndex, mul(stepTens, 10.0));
    
    // Render "D" as a custom pattern (simplified rectangle with gap)
    function renderLetterD(pixelX, pixelY) {
        // Vertical bar on left
        const leftBar = mul(step(0.15, pixelX), step(pixelX, 0.35)).mul(
            mul(step(0.1, pixelY), step(pixelY, 0.9))
        );
        // Top horizontal bar
        const topBar = mul(step(0.15, pixelX), step(pixelX, 0.7)).mul(
            mul(step(0.75, pixelY), step(pixelY, 0.9))
        );
        // Bottom horizontal bar
        const botBar = mul(step(0.15, pixelX), step(pixelX, 0.7)).mul(
            mul(step(0.1, pixelY), step(pixelY, 0.25))
        );
        // Right curved section (simplified as vertical bar)
        const rightBar = mul(step(0.55, pixelX), step(pixelX, 0.75)).mul(
            mul(step(0.25, pixelY), step(pixelY, 0.75))
        );
        return clamp(add(add(add(leftBar, topBar), botBar), rightBar), 0.0, 1.0);
    }
    
    // Render the goto debug characters
    const gotoChar0Mask = mul(isGotoChar0, renderLetterD(gotoCharLocalX, gotoDebugNormY));
    const gotoChar1Mask = mul(isGotoChar1, renderDigit(gotoDirection, gotoCharLocalX, gotoDebugNormY));
    const gotoChar3Mask = mul(isGotoChar3, renderDigit(stepTens, gotoCharLocalX, gotoDebugNormY));
    const gotoChar4Mask = mul(isGotoChar4, renderDigit(stepOnes, gotoCharLocalX, gotoDebugNormY));
    
    // Combine goto debug character masks
    const gotoTextMask = add(add(add(gotoChar0Mask, gotoChar1Mask), gotoChar3Mask), gotoChar4Mask);
    
    // Apply goto debug overlay: cyan text for goto path info (different color to distinguish from coord display)
    const gotoDebugTextColor = vec3(0.0, 1.0, 1.0); // Cyan text for goto info
    
    // Create the goto debug display color
    const gotoDebugDisplayColor = mix(
        finalColor.rgb,
        gotoDebugTextColor,
        mul(inGotoDebugArea, gotoTextMask)
    );
    
    // Only apply goto debug display when debug mode is enabled AND tile is on goto path
    finalColor = debug_enabled.select(
        vec4(
            mul(isGotoTile, gotoDebugDisplayColor).add(mul(sub(1.0, isGotoTile), finalColor.rgb)),
            finalColor.a
        ),
        finalColor
    );

    // =========================================================================
    // OUT-OF-BOUNDS CHECK - Render black where no tiles exist
    // =========================================================================
    // Check if the current pixel is outside the valid map tile range
    // Valid tiles are in range [0, map_size-1] for both X and Y
    // Areas outside this range should be rendered as black
    const isOutOfBoundsX = step(map_x_size, tileX).greaterThan(0.5).or(tileX.lessThan(0.0));
    const isOutOfBoundsY = step(map_y_size, tileY).greaterThan(0.5).or(tileY.lessThan(0.0));
    const isOutOfBounds = isOutOfBoundsX.or(isOutOfBoundsY);
    
    // If out of bounds, return black; otherwise return the computed color
    finalColor = isOutOfBounds.select(vec4(0.0, 0.0, 0.0, 1.0), finalColor);

    return finalColor;
}

// Export the shader creation function
window.createTerrainShaderTSL = createTerrainShaderTSL;
