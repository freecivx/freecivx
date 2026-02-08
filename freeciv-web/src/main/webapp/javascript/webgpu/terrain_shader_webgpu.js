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
 * - Roads and railroads rendering from sprite sheets
 * - Irrigation and farmland visual indicators
 * - Nation border rendering with distinct colored edge lines
 * - Soft edges between unknown and known map tiles
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
    // Beach appears at shoreline where land meets water
    const BEACH_HIGH = 52.5;        // Upper limit of beach zone (above this = full land texture)
    const BEACH_BLEND_HIGH = 50.4;  // Lower limit of beach zone (slightly above water to start beach blend)
    const BEACH_MID = 51.5;         // Middle of beach zone (peak sand color)
    // Water surface level must match water mesh position in mapview_webgpu.js (line 130)
    // Terrain below this level is underwater and should not display beach colors
    const WATER_LEVEL = 50.0;
    
    // Beach sand colour (warm golden sand) - precomputed for efficiency
    const BEACH_SAND_COLOR = { r: 0.92, g: 0.85, b: 0.65 };
    
    // Precomputed beach zone ranges for shader efficiency
    const BEACH_LOWER_RANGE = BEACH_MID - BEACH_BLEND_HIGH;  // ≈ 1.1
    const BEACH_UPPER_RANGE = BEACH_HIGH - BEACH_MID;        // ≈ 1.0

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

    // Visibility constants (matching vertex color values from tile_visibility_handler.js)
    // These values are set in get_vertex_color_from_tile() and interpolated across vertices
    const VISIBILITY_UNKNOWN = 0.0;   // Tile is unknown (black)
    const VISIBILITY_FOGGED = 0.54;   // Tile was seen but currently not visible (fogged)
    const VISIBILITY_VISIBLE = 1.06;  // Tile is fully visible (slightly > 1.0 for brightness boost)

    // Create texture references for reuse (don't call texture() yet)
    const maptilesTex = uniforms.maptiles.value;
    const bordersTex = uniforms.borders.value;
    const roadsmapTex = uniforms.roadsmap.value;
    const roadspritesTex = uniforms.roadsprites.value;
    
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
    
    // =========================================================================
    // INFRASTRUCTURE CONSTANTS
    // =========================================================================
    // Road sprite sheet layout: 4x4 grid, sprite indices 1-9 for roads, 10-19 for railroads
    const ROAD_SPRITE_COLS = 4.0;
    const ROAD_SPRITE_ROWS = 4.0;
    // Irrigation/Farmland flags from maptiles blue channel
    const IRRIGATION_FLAG = 1.0;
    const FARMLAND_FLAG = 2.0;

    // Map size uniforms
    const map_x_size = uniform(uniforms.map_x_size.value);
    const map_y_size = uniform(uniforms.map_y_size.value);
    const borders_visible = uniform(uniforms.borders_visible.value);

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

    // Precompute beach sand colour as vec3 for reuse in terrain layers
    const beachSandColor = vec3(BEACH_SAND_COLOR.r, BEACH_SAND_COLOR.g, BEACH_SAND_COLOR.b);

    /**
     * Helper function to create terrain selection and blending logic
     * 
     * @param {number} terrainValue - The terrain type ID to match (e.g., TERRAIN_GRASSLAND)
     * @param {object} textureNode - TSL texture node for this terrain type
     * @param {object} coord - TSL vec2 coordinate node for texture sampling
     * @param {boolean} blendWithBeach - If true, blends with beach sand colour at shore elevations
     * @returns {object} Object with mask (selection boolean) and color (sampled texture) nodes
     * 
     * Uses step functions to create smooth transitions between terrain types.
     * When blendWithBeach is true, terrain at elevations in the beach zone
     * transitions to a warm sand colour, creating natural beach areas.
     */
    function createTerrainLayer(terrainValue, textureNode, coord, blendWithBeach = true) {
        // Create float mask for this terrain type (ensure it's a float, not boolean)
        // Split step() operations and use mul() to ensure float multiplication
        const step1 = step(terrainValue - 0.5, terrainHere);
        const step2 = step(terrainHere, terrainValue + 0.5);
        const isTerrain = mul(step1, step2);
        
        // Sample terrain texture
        let terrainColor;
        if (blendWithBeach) {
            // Get base terrain texture
            const baseTerrainColor = texture(textureNode, coord);
            
            // Calculate beach blend factor based on elevation
            // Creates a smooth gradient: coast -> beach sand -> land texture
            // Below WATER_LEVEL: underwater terrain - use coast/water texture, no beach
            // WATER_LEVEL to BEACH_MID: blend coast to sand (only above water)
            // BEACH_MID to BEACH_HIGH: blend sand to terrain
            // Above BEACH_HIGH: full terrain texture
            
            // Check if terrain is underwater (below water level)
            // Returns 1.0 when above water, 0.0 when underwater
            const aboveWater = step(WATER_LEVEL, posY);
            
            // Lower beach zone (coast to sand) - smooth transition
            // Uses precomputed BEACH_LOWER_RANGE for efficiency
            // Only apply beach blending when above water
            const lowerBeachT = mul(
                clamp(div(sub(posY, BEACH_BLEND_HIGH), BEACH_LOWER_RANGE), 0.0, 1.0),
                aboveWater  // Zero out beach blending when underwater
            );
            // Upper beach zone (sand to terrain) - smooth transition
            // Uses precomputed BEACH_UPPER_RANGE for efficiency
            const upperBeachT = clamp(
                div(sub(posY, BEACH_MID), BEACH_UPPER_RANGE),
                0.0, 1.0
            );
            
            // Blend: coast texture -> sand -> terrain texture
            // When underwater (aboveWater=0), lowerBeachT=0 so result is pure coast texture
            const coastTex = texture(terrainTextures.coast, coord);
            const lowerBlend = mix(coastTex, vec4(beachSandColor, 1.0), lowerBeachT);
            terrainColor = mix(lowerBlend, baseTerrainColor, upperBeachT);
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
    // IRRIGATION AND FARMLAND RENDERING
    // =========================================================================
    // The maptiles texture blue channel stores irrigation/farmland flags:
    // - 0 = none
    // - 1 = irrigation
    // - 2 = farmland
    // We render a subtle tint overlay to indicate these improvements
    const irrigationFlag = floor(mul(terrainType.b, 256.0));
    
    // Irrigation: subtle blue-green tint (water channels)
    const hasIrrigation = mul(step(0.5, irrigationFlag), step(irrigationFlag, 1.5));
    const irrigationColor = vec3(0.6, 0.85, 0.75);  // Blue-green tint
    finalColor = vec4(
        mix(finalColor.rgb, irrigationColor, mul(hasIrrigation, 0.15)),
        finalColor.a
    );
    
    // Farmland: golden/wheat colored tint (cultivated fields)
    const hasFarmland = step(1.5, irrigationFlag);
    const farmlandColor = vec3(0.85, 0.78, 0.45);  // Golden wheat color
    finalColor = vec4(
        mix(finalColor.rgb, farmlandColor, mul(hasFarmland, 0.18)),
        finalColor.a
    );

    // =========================================================================
    // ROADS AND RAILROADS RENDERING
    // =========================================================================
    // Sample road/railroad data from roadsmap texture at tile center
    // The roadsmap stores sprite indices in RGB channels:
    // - R channel: primary road/rail sprite index (1-9 roads, 10-19 rails, 42/43 junctions)
    // - G channel: secondary connection sprite index
    // - B channel: tertiary connection sprite index
    const roadData = texture(roadsmapTex, tileCenterUV);
    const roadIndex = floor(mul(roadData.r, 256.0));
    
    // Determine if this tile has roads (indices 1-9, 42) or railroads (indices 10-19, 43)
    const hasRoad = mul(step(0.5, roadIndex), step(roadIndex, 9.5));
    const hasRoadJunction = mul(step(41.5, roadIndex), step(roadIndex, 42.5));
    
    // Map sprite index to sprite sheet coordinates
    // The sprite sheet is a 4x4 grid (16 sprites total)
    // Roads: indices 1-9 map to different directional sprites
    // Railroads: indices 10-19 map to different directional sprites
    // Junction special cases: 42 = road 4-way, 43 = rail 4-way (both use row 0, col 0)
    
    // Calculate sprite UV coordinates within tile
    // Each sprite is 1/4 of the texture in both dimensions (4x4 grid)
    const spriteU = div(1.0, ROAD_SPRITE_COLS);
    const spriteV = div(1.0, ROAD_SPRITE_ROWS);
    
    // Road sprite selection (indices 1-9 for regular roads)
    // For junctions (index 42), we handle separately with junctionUV
    const roadSpriteIndex = sub(roadIndex, 1.0);  // Convert 1-based to 0-based (0-8)
    const roadCol = mod(roadSpriteIndex, ROAD_SPRITE_COLS);
    const roadRow = floor(div(roadSpriteIndex, ROAD_SPRITE_COLS));
    
    // Railroad sprite selection (indices 10-19 for regular railroads)
    // For junctions (index 43), we handle separately with junctionUV
    const railSpriteIndex = sub(roadIndex, 10.0);  // Convert 10-based to 0-based (0-9)
    const railCol = mod(railSpriteIndex, ROAD_SPRITE_COLS);
    const railRow = floor(div(railSpriteIndex, ROAD_SPRITE_COLS));
    
    // Sample road sprite for regular roads (scale local coords to sprite sheet)
    const roadSpriteUV = vec2(
        add(mul(localX, spriteU), mul(roadCol, spriteU)),
        add(mul(localY, spriteV), mul(roadRow, spriteV))
    );
    const roadSprite = texture(roadspritesTex, roadSpriteUV);
    
    // Sample railroad sprite for regular railroads
    const railSpriteUV = vec2(
        add(mul(localX, spriteU), mul(railCol, spriteU)),
        add(mul(localY, spriteV), mul(railRow, spriteV))
    );
    
    // Junction sprites - 4-way junctions use position 0,0 in sprite sheet (top-left)
    const junctionUV = vec2(mul(localX, spriteU), mul(localY, spriteV));
    const roadJunctionSprite = texture(roadspritesTex, junctionUV);
    
    // Blend regular roads onto terrain (only where sprite alpha > 0)
    // hasRoad is 1 for indices 1-9, hasRoadJunction is separate
    const roadAlpha = mul(hasRoad, roadSprite.a);
    finalColor = vec4(
        mix(finalColor.rgb, roadSprite.rgb, mul(roadAlpha, 0.9)),
        finalColor.a
    );
    
    // Blend road junctions separately (index 42 only)
    const roadJunctionAlpha = mul(hasRoadJunction, roadJunctionSprite.a);
    finalColor = vec4(
        mix(finalColor.rgb, roadJunctionSprite.rgb, mul(roadJunctionAlpha, 0.9)),
        finalColor.a
    );


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
    // Brightness boost makes terrain colours more vibrant and visible
    const brightnessBoost = 1.35;
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

    // =========================================================================
    // HEXAGONAL VISIBILITY BLENDING (Hex-Aligned Unknown Tile Edges)
    // =========================================================================
    // Sample visibility from maptiles texture alpha channel at hex tile center.
    // This ensures visibility boundaries follow hexagonal tile edges instead of
    // the square vertex grid, creating proper Civ 6-style hex-aligned fog of war.
    //
    // The maptiles texture stores visibility in the alpha channel:
    // - 0 = TILE_UNKNOWN (black)
    // - 138/255 ≈ 0.541 = TILE_KNOWN_UNSEEN (fogged)
    // - 255/255 = 1.0 = TILE_KNOWN_SEEN (visible)
    //
    // By sampling at the hex tile center (tileCenterUV), we get a single visibility
    // value for the entire hexagonal tile, creating crisp hex-aligned boundaries.
    
    // Sample visibility from maptiles texture alpha channel at hex tile center
    // tileCenterUV already accounts for hex stagger offset
    const tileVisibilityTex = texture(maptilesTex, tileCenterUV);
    const hexVisibility = tileVisibilityTex.a;  // Alpha channel contains visibility
    
    // Convert texture value (0-1) to visibility scale
    // Texture stores: 0=unknown, ~0.541=fogged, 1.0=visible
    // After scaling by VISIBILITY_VISIBLE (1.06): 0, ~0.57, 1.06
    const hexVisibilityScaled = mul(hexVisibility, VISIBILITY_VISIBLE);
    
    // =========================================================================
    // SOFT EDGES BETWEEN UNKNOWN AND KNOWN TILES
    // =========================================================================
    // Sample visibility from neighboring hex tiles to create soft blending
    // at the boundary between unknown (black) tiles and known/visible tiles.
    // This creates a gradual fade rather than a hard edge.
    
    // Calculate neighbor sampling offsets (in UV space)
    const neighborOffsetX = div(1.0, map_x_size);
    const neighborOffsetY = div(1.0, map_y_size);
    
    // Sample 6 hex neighbors' visibility for edge softening
    // We sample at offsets corresponding to hex neighbor directions
    const neighborUV_E = vec2(add(tileCenterUV.x, neighborOffsetX), tileCenterUV.y);
    const neighborUV_W = vec2(sub(tileCenterUV.x, neighborOffsetX), tileCenterUV.y);
    const neighborUV_NE = vec2(add(tileCenterUV.x, mul(neighborOffsetX, 0.5)), add(tileCenterUV.y, neighborOffsetY));
    const neighborUV_NW = vec2(sub(tileCenterUV.x, mul(neighborOffsetX, 0.5)), add(tileCenterUV.y, neighborOffsetY));
    const neighborUV_SE = vec2(add(tileCenterUV.x, mul(neighborOffsetX, 0.5)), sub(tileCenterUV.y, neighborOffsetY));
    const neighborUV_SW = vec2(sub(tileCenterUV.x, mul(neighborOffsetX, 0.5)), sub(tileCenterUV.y, neighborOffsetY));
    
    // Sample neighbor visibilities
    const visE = texture(maptilesTex, neighborUV_E).a;
    const visW = texture(maptilesTex, neighborUV_W).a;
    const visNE = texture(maptilesTex, neighborUV_NE).a;
    const visNW = texture(maptilesTex, neighborUV_NW).a;
    const visSE = texture(maptilesTex, neighborUV_SE).a;
    const visSW = texture(maptilesTex, neighborUV_SW).a;
    
    // Calculate average neighbor visibility
    const avgNeighborVis = mul(add(add(add(add(add(visE, visW), visNE), visNW), visSE), visSW), div(1.0, 6.0));
    
    // Create soft edge factor based on distance from hex center
    // At hex edges, blend with neighbor visibility for softer transitions
    // hexDist is the distance to hex edge (0 at center, 0.5 at edge)
    const edgeProximity = clamp(mul(sub(hexDist, 0.3), 5.0), 0.0, 1.0);  // 0 at center, 1 near edge
    
    // Blend current tile visibility with neighbor average at edges
    // This creates soft transitions at boundaries between unknown and known tiles
    const softVisibility = mix(hexVisibility, avgNeighborVis, mul(edgeProximity, 0.4));
    const softVisibilityScaled = mul(softVisibility, VISIBILITY_VISIBLE);
    
    // Apply smoothstep curve for softer edges within the visible/fogged regions
    // This maintains smooth transitions for brightness while using hex-sampled visibility
    const visNormalized = clamp(div(softVisibilityScaled, VISIBILITY_VISIBLE), 0.0, 1.0);
    // Smoothstep formula: t² × (3 - 2t) creates an S-curve that eases in and out
    const visSmooth = mul(mul(visNormalized, visNormalized), sub(3.0, mul(2.0, visNormalized)));
    
    // Scale back to original range to maintain brightness levels
    const smoothVisibility = mul(visSmooth, VISIBILITY_VISIBLE);
    
    // =========================================================================
    // ACTIVE CITY HIGHLIGHTING (Vertex Color Based)
    // =========================================================================
    // The vertex color (vertColor) is used for active city highlighting:
    // - When a city is selected, tiles belonging to the city remain at full brightness
    // - Other tiles are dimmed to 0.30 brightness
    // This uses vertex interpolation which provides smooth transitions at tile boundaries
    // 
    // We compare the vertex color with the hex visibility to detect active city dimming:
    // - If vertColor.x < hexVisibilityScaled, the tile is being dimmed for active city view
    // - In this case, use the dimmed vertex color value instead of the texture visibility
    const vertexVisibility = vertColor.x;
    
    // Use the minimum of hex visibility and vertex visibility
    // This allows active city highlighting to dim tiles that would otherwise be visible
    const effectiveVisibility = min(smoothVisibility, vertexVisibility);
    
    // Apply the visibility to the terrain color
    finalColor = vec4(mul(finalColor.rgb, effectiveVisibility), finalColor.a);

    // =========================================================================
    // NATION BORDERS WITH DISTINCT BORDER LINES
    // =========================================================================
    // Render map borders for each nation color with a distinct border line
    // at the edge of the player's nation map tiles.
    //
    // We detect border edges by comparing the current tile's owner with neighbors.
    // Where ownership changes, we draw a colored border line.
    
    // Border edge detection constants - narrower lines for less intrusive borders
    const BORDER_EDGE_THRESHOLD_POS = 0.88;    // Position threshold for E/W edge detection (0.88 = last 12% of tile, narrower)
    const BORDER_EDGE_WIDTH_POS = 0.12;        // Position for W edge (first 12% of tile, narrower)
    const BORDER_EDGE_SHARPNESS = 12.0;        // Sharpness factor for edge falloff (sharper for narrower lines)
    const BORDER_DIAGONAL_SHARPNESS = 6.0;     // Sharpness factor for diagonal edges
    const BORDER_CORNER_THRESHOLD = 0.6;       // Center threshold for corner detection (narrower corners)
    const BORDER_COLOR_DIFF_THRESHOLD = 0.05;  // Minimum RGB difference to detect nation boundary
    
    // Dashed line pattern constants
    const DASH_FREQUENCY = 8.0;                // Number of dashes per tile edge
    const DASH_RATIO = 0.6;                    // Ratio of dash to gap (0.6 = 60% dash, 40% gap)
    
    // Sample border color (nation color) for current tile and neighbors
    const currentBorder = texture(bordersTex, tileCenterUV);
    const borderE = texture(bordersTex, neighborUV_E);
    const borderW = texture(bordersTex, neighborUV_W);
    const borderNE = texture(bordersTex, neighborUV_NE);
    const borderNW = texture(bordersTex, neighborUV_NW);
    const borderSE = texture(bordersTex, neighborUV_SE);
    const borderSW = texture(bordersTex, neighborUV_SW);
    
    // Check if this tile has a border (non-default alpha)
    const hasBorder = step(0.1, currentBorder.a);
    
    // Detect border edges by comparing RGB values with neighbors
    // Compare all three color channels for accurate nation detection
    // Red channel differences
    const borderDiffRE = abs(sub(currentBorder.r, borderE.r));
    const borderDiffRW = abs(sub(currentBorder.r, borderW.r));
    const borderDiffRNE = abs(sub(currentBorder.r, borderNE.r));
    const borderDiffRNW = abs(sub(currentBorder.r, borderNW.r));
    const borderDiffRSE = abs(sub(currentBorder.r, borderSE.r));
    const borderDiffRSW = abs(sub(currentBorder.r, borderSW.r));
    
    // Green channel differences
    const borderDiffGE = abs(sub(currentBorder.g, borderE.g));
    const borderDiffGW = abs(sub(currentBorder.g, borderW.g));
    const borderDiffGNE = abs(sub(currentBorder.g, borderNE.g));
    const borderDiffGNW = abs(sub(currentBorder.g, borderNW.g));
    const borderDiffGSE = abs(sub(currentBorder.g, borderSE.g));
    const borderDiffGSW = abs(sub(currentBorder.g, borderSW.g));
    
    // Blue channel differences
    const borderDiffBE = abs(sub(currentBorder.b, borderE.b));
    const borderDiffBW = abs(sub(currentBorder.b, borderW.b));
    const borderDiffBNE = abs(sub(currentBorder.b, borderNE.b));
    const borderDiffBNW = abs(sub(currentBorder.b, borderNW.b));
    const borderDiffBSE = abs(sub(currentBorder.b, borderSE.b));
    const borderDiffBSW = abs(sub(currentBorder.b, borderSW.b));
    
    // Combine all color channel differences (RGB sum) for threshold comparison
    const isEdgeE = step(BORDER_COLOR_DIFF_THRESHOLD, add(add(borderDiffRE, borderDiffGE), borderDiffBE));
    const isEdgeW = step(BORDER_COLOR_DIFF_THRESHOLD, add(add(borderDiffRW, borderDiffGW), borderDiffBW));
    const isEdgeNE = step(BORDER_COLOR_DIFF_THRESHOLD, add(add(borderDiffRNE, borderDiffGNE), borderDiffBNE));
    const isEdgeNW = step(BORDER_COLOR_DIFF_THRESHOLD, add(add(borderDiffRNW, borderDiffGNW), borderDiffBNW));
    const isEdgeSE = step(BORDER_COLOR_DIFF_THRESHOLD, add(add(borderDiffRSE, borderDiffGSE), borderDiffBSE));
    const isEdgeSW = step(BORDER_COLOR_DIFF_THRESHOLD, add(add(borderDiffRSW, borderDiffGSW), borderDiffBSW));
    
    // Calculate directional edge factors based on position within hex
    // This creates border lines at the actual hex edges facing different directions
    
    // East edge: line appears at right side of tile (x near 1.0)
    const eastEdgeFactor = mul(isEdgeE, clamp(mul(sub(localX, BORDER_EDGE_THRESHOLD_POS), BORDER_EDGE_SHARPNESS), 0.0, 1.0));
    // West edge: line appears at left side of tile (x near 0)  
    const westEdgeFactor = mul(isEdgeW, clamp(mul(sub(BORDER_EDGE_WIDTH_POS, localX), BORDER_EDGE_SHARPNESS), 0.0, 1.0));
    // NE edge: appears at upper-right corner region
    const neEdgeFactor = mul(isEdgeNE, mul(clamp(mul(sub(localX, BORDER_CORNER_THRESHOLD), BORDER_DIAGONAL_SHARPNESS), 0.0, 1.0), clamp(mul(sub(localY, BORDER_CORNER_THRESHOLD), BORDER_DIAGONAL_SHARPNESS), 0.0, 1.0)));
    // NW edge: appears at upper-left corner region
    const nwEdgeFactor = mul(isEdgeNW, mul(clamp(mul(sub(BORDER_CORNER_THRESHOLD, localX), BORDER_DIAGONAL_SHARPNESS), 0.0, 1.0), clamp(mul(sub(localY, BORDER_CORNER_THRESHOLD), BORDER_DIAGONAL_SHARPNESS), 0.0, 1.0)));
    // SE edge: appears at lower-right corner region
    const seEdgeFactor = mul(isEdgeSE, mul(clamp(mul(sub(localX, BORDER_CORNER_THRESHOLD), BORDER_DIAGONAL_SHARPNESS), 0.0, 1.0), clamp(mul(sub(BORDER_CORNER_THRESHOLD, localY), BORDER_DIAGONAL_SHARPNESS), 0.0, 1.0)));
    // SW edge: appears at lower-left corner region
    const swEdgeFactor = mul(isEdgeSW, mul(clamp(mul(sub(BORDER_CORNER_THRESHOLD, localX), BORDER_DIAGONAL_SHARPNESS), 0.0, 1.0), clamp(mul(sub(BORDER_CORNER_THRESHOLD, localY), BORDER_DIAGONAL_SHARPNESS), 0.0, 1.0)));
    
    // Combine all edge factors
    const totalEdgeFactor = max(max(max(max(max(eastEdgeFactor, westEdgeFactor), neEdgeFactor), nwEdgeFactor), seEdgeFactor), swEdgeFactor);
    
    // Create dashed line pattern using position along the edge
    // For E/W edges, use Y position; for diagonal edges, use combined X+Y
    // The dash pattern is created by taking the fractional part of (position * frequency)
    // and comparing it to the dash ratio
    const dashPatternY = step(fract(mul(localY, DASH_FREQUENCY)), DASH_RATIO);
    const dashPatternX = step(fract(mul(localX, DASH_FREQUENCY)), DASH_RATIO);
    const dashPatternDiagonal = step(fract(mul(add(localX, localY), DASH_FREQUENCY)), DASH_RATIO);
    
    // Apply dash pattern to each edge type:
    // - E/W edges use Y-based pattern (dashes along vertical edges)
    // - Diagonal edges use combined pattern
    const dashedEastEdge = mul(eastEdgeFactor, dashPatternY);
    const dashedWestEdge = mul(westEdgeFactor, dashPatternY);
    const dashedNEEdge = mul(neEdgeFactor, dashPatternDiagonal);
    const dashedNWEdge = mul(nwEdgeFactor, dashPatternDiagonal);
    const dashedSEEdge = mul(seEdgeFactor, dashPatternDiagonal);
    const dashedSWEdge = mul(swEdgeFactor, dashPatternDiagonal);
    
    // Combine all dashed edge factors
    const dashedTotalEdgeFactor = max(max(max(max(max(dashedEastEdge, dashedWestEdge), dashedNEEdge), dashedNWEdge), dashedSEEdge), dashedSWEdge);
    
    // Use hex edge mask to concentrate border lines at hex boundaries
    const borderLineFactor = mul(dashedTotalEdgeFactor, hexEdgeMask);
    
    // Border line width and intensity
    const borderLineIntensity = 0.45;  // How opaque the border line is (more transparent)
    
    // Brighten the nation color for the border line (make it more visible)
    const brightenedBorderColor = vec3(
        min(add(currentBorder.r, 0.3), 1.0),
        min(add(currentBorder.g, 0.3), 1.0),
        min(add(currentBorder.b, 0.3), 1.0)
    );
    
    // Apply border line only where borders are visible and at nation edges
    const shouldShowBorderLine = mul(borders_visible.select(1.0, 0.0), mul(hasBorder, borderLineFactor));
    finalColor = vec4(
        mix(finalColor.rgb, brightenedBorderColor, mul(shouldShowBorderLine, borderLineIntensity)),
        finalColor.a
    );
    
    // Also apply subtle area fill for border territories (more transparent)
    const shouldShowBorderFill = mul(borders_visible.select(1.0, 0.0), hasBorder);
    const borderFillFactor = mul(shouldShowBorderFill, 0.05);  // Very subtle territory tint
    finalColor = vec4(
        mix(finalColor.rgb, currentBorder.rgb, borderFillFactor),
        finalColor.a
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
