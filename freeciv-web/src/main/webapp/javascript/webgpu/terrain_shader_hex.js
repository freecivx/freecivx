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
 * - Roads and railroads rendering using UV-based texture mapping (optimized, no SDF)
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
        vec2, vec3, vec4, int,
        mix, step, floor, fract, mod, dot, sin, cos, normalize, max, min, pow, clamp, abs,
        mul, add, sub, div
    } = THREE;
    
    // Verify all required TSL functions and nodes are available
    const requiredTSLNames = [
        'texture', 'uniform', 'positionLocal', 'attribute', 'uv', 'normalLocal',
        'vec2', 'vec3', 'vec4', 'int',
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
    // HEXAGONAL TILE CONSTANTS (from HexConfig in config.js)
    // =========================================================================
    // Using centralized configuration for consistency and maintainability
    // Pointy-top hexagons (Civ 6 style): flat sides on left/right, points on top/bottom
    // For a pointy-top hex with radius R (center to corner):
    // - width = R * sqrt(3) = R * 1.732
    // - height = R * 2
    // We normalize so that one tile maps to roughly 1.0 in UV space per tile
    const hexConfig = window.HexConfig || {
        SQRT3_OVER_2: 0.866025,
        EDGE_WIDTH: 0.045,
        EDGE_SOFTNESS: 0.025,
        EDGE_BLEND_STRENGTH: 0.32,
        EDGE_COLOR: { r: 0.15, g: 0.12, b: 0.08 }
    };
    
    const HEX_SQRT3_OVER_2 = hexConfig.SQRT3_OVER_2; // sqrt(3)/2 ≈ 0.866 - used for hex edge normals
    // HEX_MESH_HEIGHT_FACTOR matches the mesh geometry compression factor (sqrt(3)/2)
    // The mesh compresses Y by this factor, so tiles appear wider than tall in world space
    const HEX_MESH_HEIGHT_FACTOR = HEX_SQRT3_OVER_2;
    // To draw a proper pointy-top hex (taller than wide) that looks correct after mesh compression,
    // we need to stretch the hex in UV space by the inverse of the compression factor
    // This counteracts the mesh compression so the final rendered hex has correct proportions
    const HEX_ASPECT = 1.0 / HEX_MESH_HEIGHT_FACTOR; // ≈ 1.1547 - Y-coordinate scale factor for hex geometry
    const HEX_EDGE_WIDTH = hexConfig.EDGE_WIDTH; // Width of hex edge highlight (as fraction of tile)
    const HEX_EDGE_SOFTNESS = hexConfig.EDGE_SOFTNESS; // Edge anti-aliasing softness
    const HEX_EDGE_BLEND_STRENGTH = hexConfig.EDGE_BLEND_STRENGTH; // How strongly hex edges darken the terrain (0-1)
    const HEX_EDGE_COLOR_R = hexConfig.EDGE_COLOR.r; // Red component of edge darkening color
    const HEX_EDGE_COLOR_G = hexConfig.EDGE_COLOR.g; // Green component of edge darkening color  
    const HEX_EDGE_COLOR_B = hexConfig.EDGE_COLOR.b; // Blue component of edge darkening color
    const TEXTURE_RANDOM_SCALE = 16.0; // Divisor for random texture offset - larger = less variation

    // Visibility constants (matching vertex color values from tile_visibility_handler.js)
    // These values are set in get_vertex_color_from_tile() and interpolated across vertices
    const VISIBILITY_UNKNOWN = 0.0;   // Tile is unknown (black)
    const VISIBILITY_FOGGED = 0.54;   // Tile was seen but currently not visible (fogged)
    const VISIBILITY_VISIBLE = 1.0;   // Tile is fully visible

    // Create texture references for reuse (don't call texture() yet)
    const maptilesTex = uniforms.maptiles.value;
    const bordersTex = uniforms.borders.value;
    const roadsmapTex = uniforms.roadsmap.value;
    const terrainLayersTex = uniforms.terrain_layers.value;
    const terrainAtlasTex = uniforms.terrain_atlas.value;
    
    // Terrain atlas layer indices (matching tiletype_terrains order)
    // Layer indices: 0=coast, 1=ocean, 2=desert, 3=grassland, 4=hills, 5=mountains, 6=plains, 7=swamp, 8=forest, 9=jungle
    const TERRAIN_ATLAS_COAST = 0;
    const TERRAIN_ATLAS_OCEAN = 1;
    const TERRAIN_ATLAS_DESERT = 2;
    const TERRAIN_ATLAS_GRASSLAND = 3;
    const TERRAIN_ATLAS_HILLS = 4;
    const TERRAIN_ATLAS_MOUNTAINS = 5;
    const TERRAIN_ATLAS_PLAINS = 6;
    const TERRAIN_ATLAS_SWAMP = 7;
    const TERRAIN_ATLAS_FOREST = 8;
    const TERRAIN_ATLAS_JUNGLE = 9;
    
    // Terrain layer indices for terrain_layers DataArrayTexture
    // Layer indices: 0 = arctic, 1 = tundra, 2 = farmland, 3 = irrigation
    const TERRAIN_LAYER_ARCTIC = 0;
    const TERRAIN_LAYER_TUNDRA = 1;
    const TERRAIN_LAYER_FARMLAND = 2;
    const TERRAIN_LAYER_IRRIGATION = 3;
    
    // =========================================================================
    // INFRASTRUCTURE CONSTANTS
    // =========================================================================
    // Road/railroad sprites are stored in DataArrayTexture (texture_2d_array) with 16 layers
    // Each layer is a separate sprite from the original 4x4 grid
    // Sprite indices: 1-9 for roads, 10-19 for railroads, 42/43 for junctions
    // Irrigation/Farmland flags from maptiles blue channel
    const IRRIGATION_FLAG = 1.0;
    const FARMLAND_FLAG = 2.0;

    // Map size uniforms
    const map_x_size = uniform(uniforms.map_x_size.value);
    const map_y_size = uniform(uniforms.map_y_size.value);
    const borders_visible = uniform(uniforms.borders_visible.value);
    
    // Selected tile uniforms for highlighting (exported globally for dynamic updates)
    const selected_x = uniform(uniforms.selected_x.value);
    const selected_y = uniform(uniforms.selected_y.value);
    // Export uniform nodes globally so they can be updated from mapctrl.js
    window.terrain_selected_x_uniform = selected_x;
    window.terrain_selected_y_uniform = selected_y;

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

    // Extract terrain type value from texture (stored in red channel as 0-255 value)
    const terrainHere = floor(mul(terrainType.r, 256.0));
    const posY = posNode.y;

    // Texture coordinate node for hexagonal tiles
    const texCoord = vec2(dx, dy);

    // Precompute beach sand colour as vec3 for reuse in terrain layers
    const beachSandColor = vec3(BEACH_SAND_COLOR.r, BEACH_SAND_COLOR.g, BEACH_SAND_COLOR.b);

    /**
     * Helper function to create terrain selection and blending logic
     * Uses terrain_atlas DataArrayTexture for efficient texture sampling.
     * 
     * @param {number} terrainValue - The terrain type ID to match (e.g., TERRAIN_GRASSLAND)
     * @param {number} layerIndex - The layer index in terrain_atlas texture (0-9, see TERRAIN_ATLAS_* constants above)
     * @param {object} coord - TSL vec2 coordinate node for texture sampling
     * @param {boolean} blendWithBeach - If true, blends with beach sand colour at shore elevations
     * @returns {object} Object with mask (selection boolean) and color (sampled texture) nodes
     * 
     * Uses step functions to create smooth transitions between terrain types.
     * When blendWithBeach is true, terrain at elevations in the beach zone
     * transitions to a warm sand colour, creating natural beach areas.
     */
    function createTerrainLayer(terrainValue, layerIndex, coord, blendWithBeach = true) {
        // Create float mask for this terrain type (ensure it's a float, not boolean)
        // Split step() operations and use mul() to ensure float multiplication
        const step1 = step(terrainValue - 0.5, terrainHere);
        const step2 = step(terrainHere, terrainValue + 0.5);
        const isTerrain = mul(step1, step2);
        
        // Sample terrain texture from atlas
        let terrainColor;
        if (blendWithBeach) {
            // Get base terrain texture from atlas
            const baseTerrainColor = texture(terrainAtlasTex, coord).depth(int(layerIndex));
            
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
            const coastTex = texture(terrainAtlasTex, coord).depth(int(TERRAIN_ATLAS_COAST));
            const lowerBlend = mix(coastTex, vec4(beachSandColor, 1.0), lowerBeachT);
            terrainColor = mix(lowerBlend, baseTerrainColor, upperBeachT);
        } else {
            terrainColor = texture(terrainAtlasTex, coord).depth(int(layerIndex));
        }
        
        return { mask: isTerrain, color: terrainColor };
    }
    
    /**
     * Helper function to create terrain layer from terrain_layers DataArrayTexture
     * 
     * @param {number} terrainValue - The terrain type ID to match (e.g., TERRAIN_ARCTIC)
     * @param {number} layerIndex - The layer index in terrain_layers texture (0-3)
     * @param {object} coord - TSL vec2 coordinate node for texture sampling
     * @returns {object} Object with mask (selection boolean) and color (sampled texture) nodes
     */
    function createTerrainLayerFromArray(terrainValue, layerIndex, coord) {
        const step1 = step(terrainValue - 0.5, terrainHere);
        const step2 = step(terrainHere, terrainValue + 0.5);
        const isTerrain = mul(step1, step2);
        
        // Sample from terrain_layers DataArrayTexture by passing layer index as third parameter
        const terrainColor = texture(terrainLayersTex, coord).depth(int(layerIndex));
        
        return { mask: isTerrain, color: terrainColor };
    }

    // Build terrain layers - including all terrain types from WebGL shader
    // Note: TERRAIN_INACCESSIBLE (0) renders as black (default finalColor)
    const layers = [
        createTerrainLayer(TERRAIN_GRASSLAND, TERRAIN_ATLAS_GRASSLAND, texCoord, true),
        createTerrainLayer(TERRAIN_PLAINS, TERRAIN_ATLAS_PLAINS, texCoord, true),
        createTerrainLayer(TERRAIN_DESERT, TERRAIN_ATLAS_DESERT, texCoord, true),
        createTerrainLayer(TERRAIN_HILLS, TERRAIN_ATLAS_HILLS, texCoord, true),
        createTerrainLayer(TERRAIN_MOUNTAINS, TERRAIN_ATLAS_MOUNTAINS, texCoord, true),
        createTerrainLayer(TERRAIN_SWAMP, TERRAIN_ATLAS_SWAMP, texCoord, true),
        createTerrainLayer(TERRAIN_FOREST, TERRAIN_ATLAS_FOREST, texCoord, true),
        createTerrainLayer(TERRAIN_JUNGLE, TERRAIN_ATLAS_JUNGLE, texCoord, true),
        createTerrainLayer(TERRAIN_COAST, TERRAIN_ATLAS_COAST, texCoord, false),
        createTerrainLayer(TERRAIN_FLOOR, TERRAIN_ATLAS_OCEAN, texCoord, false),
        createTerrainLayer(TERRAIN_LAKE, TERRAIN_ATLAS_COAST, texCoord, false), // Lake uses coast texture
        createTerrainLayerFromArray(TERRAIN_ARCTIC, TERRAIN_LAYER_ARCTIC, texCoord),
        createTerrainLayerFromArray(TERRAIN_TUNDRA, TERRAIN_LAYER_TUNDRA, texCoord)
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
    // We render textures from terrain_layers DataArrayTexture overlaid on the terrain
    const irrigationFlag = floor(mul(terrainType.b, 256.0));
    
    // Irrigation: sample irrigation texture from terrain_layers and blend over terrain
    const hasIrrigation = mul(step(0.5, irrigationFlag), step(irrigationFlag, 1.5));
    const irrigationTexColor = texture(terrainLayersTex, texCoord).depth(int(TERRAIN_LAYER_IRRIGATION));
    finalColor = vec4(
        mix(finalColor.rgb, irrigationTexColor.rgb, mul(hasIrrigation, irrigationTexColor.a)),
        finalColor.a
    );
    
    // Farmland: sample farmland texture from terrain_layers and blend over terrain
    const hasFarmland = step(1.5, irrigationFlag);
    const farmlandTexColor = texture(terrainLayersTex, texCoord).depth(int(TERRAIN_LAYER_FARMLAND));
    finalColor = vec4(
        mix(finalColor.rgb, farmlandTexColor.rgb, mul(hasFarmland, farmlandTexColor.a)),
        finalColor.a
    );

    // =========================================================================
    // ROADS AND RAILROADS RENDERING (Procedural - using math only)
    // =========================================================================
    // Sample road data from roadsmap texture
    const roadData = texture(roadsmapTex, tileCenterUV);
    const roadIndex = floor(mul(roadData.r, 256.0));
    
    // Detect road types based on index ranges
    // Roads: 1-9, 42; Railroads: 10-19, 43
    const hasRoad = mul(step(0.5, roadIndex), step(roadIndex, 9.5));
    const hasRoadJunction = mul(step(41.5, roadIndex), step(roadIndex, 42.5));
    const hasRailroad = mul(step(9.5, roadIndex), step(roadIndex, 19.5));
    const hasRailJunction = mul(step(42.5, roadIndex), step(roadIndex, 43.5));
    
    // Combined road/rail flags
    const hasAnyRoad = max(hasRoad, hasRoadJunction);
    const hasAnyRail = max(hasRailroad, hasRailJunction);
    const hasAnyInfrastructure = max(hasAnyRoad, hasAnyRail);
    
    // -------------------------------------------------------------------------
    // Decode Road Connectivity from roadIndex
    // -------------------------------------------------------------------------
    // Road encoding: 1=single, 2=N, 3=NE, 4=S, 5=SE, 6=W, 7=SW, 8=E, 9=NW, 42=junction
    // Rail encoding: Same but +10 (10=single, 12=N, etc., 43=junction)
    const roadIndexForDecoding = hasAnyRail.select(sub(roadIndex, 10.0), roadIndex);
    
    // Decode connections (each direction has a specific index value or junction)
    const connectN = roadIndexForDecoding.greaterThanEqual(2.0).and(roadIndexForDecoding.lessThanEqual(2.5))
                     .or(roadIndexForDecoding.greaterThanEqual(32.0)); // junction
    const connectE = roadIndexForDecoding.greaterThanEqual(8.0).and(roadIndexForDecoding.lessThanEqual(8.5))
                     .or(roadIndexForDecoding.greaterThanEqual(32.0)); // junction
    const connectS = roadIndexForDecoding.greaterThanEqual(4.0).and(roadIndexForDecoding.lessThanEqual(4.5))
                     .or(roadIndexForDecoding.greaterThanEqual(32.0)); // junction
    const connectW = roadIndexForDecoding.greaterThanEqual(6.0).and(roadIndexForDecoding.lessThanEqual(6.5))
                     .or(roadIndexForDecoding.greaterThanEqual(32.0)); // junction
    
    // Diagonal connections
    const connectNE = roadIndexForDecoding.greaterThanEqual(3.0).and(roadIndexForDecoding.lessThanEqual(3.5));
    const connectSE = roadIndexForDecoding.greaterThanEqual(5.0).and(roadIndexForDecoding.lessThanEqual(5.5));
    const connectSW = roadIndexForDecoding.greaterThanEqual(7.0).and(roadIndexForDecoding.lessThanEqual(7.5));
    const connectNW = roadIndexForDecoding.greaterThanEqual(9.0).and(roadIndexForDecoding.lessThanEqual(9.5));
    
    // -------------------------------------------------------------------------
    // UV-Based Road Rendering (Flow Map Technique - No SDF)
    // -------------------------------------------------------------------------
    const roadWidth = 0.10;  // Full width of the road (doubled from half-width)
    const edgeSoftness = 0.008;  // Anti-aliasing (slightly sharper)
    
    // Current position within tile [0,1]
    const tilePos = vec2(localX, localY);
    const center = vec2(0.5, 0.5);
    
    // Add procedural winding using UV offset (much cheaper than per-pixel distance)
    const windingScale = 8.0;
    const windingCoord = mul(add(tilePos, vec2(mul(tileX, 0.5), mul(tileY, 0.5))), windingScale);
    const windingNoise = fract(mul(sin(dot(windingCoord, vec2(12.9898, 78.233))), 43758.5453));
    const windingOffsetUV = mul(sub(windingNoise, 0.5), 0.06);
    
    // Instead of calculating distance fields, we create UV coordinates
    // along each direction and blend them based on connectivity
    
    // Initialize with zero (no road)
    let roadIntensity = 0.0;
    let roadU = 0.0;  // Along-road coordinate (for patterns like center lines)
    let roadV = 0.0;  // Across-road coordinate (for width control)
    
    // North direction: U = y (along), V = (x - 0.5) (across)
    const uvN_u = sub(tilePos.y, 0.5);  // 0 at center, 0.5 at edge
    const uvN_v = add(sub(tilePos.x, 0.5), mul(windingOffsetUV, hasAnyRoad));
    const maskN = mul(
        step(0.0, uvN_u),  // Only in north half
        clamp(sub(1.0, div(abs(uvN_v), mul(roadWidth, 0.5))), 0.0, 1.0)
    );
    roadIntensity = connectN.select(max(roadIntensity, maskN), roadIntensity);
    roadU = connectN.select(mix(roadU, add(uvN_u, 0.5), maskN), roadU);
    roadV = connectN.select(mix(roadV, uvN_v, maskN), roadV);
    
    // South direction: U = (0.5 - y) (along), V = (x - 0.5) (across)
    const uvS_u = sub(0.5, tilePos.y);
    const uvS_v = add(sub(tilePos.x, 0.5), mul(windingOffsetUV, hasAnyRoad));
    const maskS = mul(
        step(uvS_u, 0.0).not(),
        clamp(sub(1.0, div(abs(uvS_v), mul(roadWidth, 0.5))), 0.0, 1.0)
    );
    roadIntensity = connectS.select(max(roadIntensity, maskS), roadIntensity);
    roadU = connectS.select(mix(roadU, add(uvS_u, 0.5), maskS), roadU);
    roadV = connectS.select(mix(roadV, uvS_v, maskS), roadV);
    
    // East direction: U = (x - 0.5) (along), V = (y - 0.5) (across)
    const uvE_u = sub(tilePos.x, 0.5);
    const uvE_v = add(sub(tilePos.y, 0.5), mul(windingOffsetUV, hasAnyRoad));
    const maskE = mul(
        step(0.0, uvE_u),
        clamp(sub(1.0, div(abs(uvE_v), mul(roadWidth, 0.5))), 0.0, 1.0)
    );
    roadIntensity = connectE.select(max(roadIntensity, maskE), roadIntensity);
    roadU = connectE.select(mix(roadU, add(uvE_u, 0.5), maskE), roadU);
    roadV = connectE.select(mix(roadV, uvE_v, maskE), roadV);
    
    // West direction: U = (0.5 - x) (along), V = (y - 0.5) (across)
    const uvW_u = sub(0.5, tilePos.x);
    const uvW_v = add(sub(tilePos.y, 0.5), mul(windingOffsetUV, hasAnyRoad));
    const maskW = mul(
        step(uvW_u, 0.0).not(),
        clamp(sub(1.0, div(abs(uvW_v), mul(roadWidth, 0.5))), 0.0, 1.0)
    );
    roadIntensity = connectW.select(max(roadIntensity, maskW), roadIntensity);
    roadU = connectW.select(mix(roadU, add(uvW_u, 0.5), maskW), roadU);
    roadV = connectW.select(mix(roadV, uvW_v, maskW), roadV);
    
    // Diagonal directions - use rotated UVs
    // NE: rotate 45 degrees
    const uvNE_u = mul(add(sub(tilePos.x, 0.5), sub(tilePos.y, 0.5)), 0.707);
    const uvNE_v = mul(sub(sub(tilePos.y, 0.5), sub(tilePos.x, 0.5)), 0.707);
    const maskNE = mul(
        mul(step(0.0, uvNE_u), mul(step(0.0, sub(tilePos.x, 0.5)), step(0.0, sub(tilePos.y, 0.5)))),
        clamp(sub(1.0, div(abs(uvNE_v), mul(roadWidth, 0.5))), 0.0, 1.0)
    );
    roadIntensity = connectNE.select(max(roadIntensity, maskNE), roadIntensity);
    roadU = connectNE.select(mix(roadU, add(uvNE_u, 0.5), maskNE), roadU);
    roadV = connectNE.select(mix(roadV, uvNE_v, maskNE), roadV);
    
    // SE: rotate -45 degrees
    const uvSE_u = mul(add(sub(tilePos.x, 0.5), sub(0.5, tilePos.y)), 0.707);
    const uvSE_v = mul(add(sub(tilePos.y, 0.5), sub(tilePos.x, 0.5)), 0.707);
    const maskSE = mul(
        mul(step(0.0, uvSE_u), mul(step(0.0, sub(tilePos.x, 0.5)), step(tilePos.y, 0.5))),
        clamp(sub(1.0, div(abs(uvSE_v), mul(roadWidth, 0.5))), 0.0, 1.0)
    );
    roadIntensity = connectSE.select(max(roadIntensity, maskSE), roadIntensity);
    roadU = connectSE.select(mix(roadU, add(uvSE_u, 0.5), maskSE), roadU);
    roadV = connectSE.select(mix(roadV, uvSE_v, maskSE), roadV);
    
    // SW: rotate 135 degrees
    const uvSW_u = mul(sub(sub(0.5, tilePos.x), sub(tilePos.y, 0.5)), 0.707);
    const uvSW_v = mul(add(sub(0.5, tilePos.y), sub(0.5, tilePos.x)), 0.707);
    const maskSW = mul(
        mul(step(0.0, uvSW_u), mul(step(tilePos.x, 0.5), step(tilePos.y, 0.5))),
        clamp(sub(1.0, div(abs(uvSW_v), mul(roadWidth, 0.5))), 0.0, 1.0)
    );
    roadIntensity = connectSW.select(max(roadIntensity, maskSW), roadIntensity);
    roadU = connectSW.select(mix(roadU, add(uvSW_u, 0.5), maskSW), roadU);
    roadV = connectSW.select(mix(roadV, uvSW_v, maskSW), roadV);
    
    // NW: rotate 225 degrees
    const uvNW_u = mul(sub(sub(0.5, tilePos.x), sub(0.5, tilePos.y)), 0.707);
    const uvNW_v = mul(sub(sub(tilePos.y, 0.5), sub(tilePos.x, 0.5)), 0.707);
    const maskNW = mul(
        mul(step(0.0, uvNW_u), mul(step(tilePos.x, 0.5), step(0.0, sub(tilePos.y, 0.5)))),
        clamp(sub(1.0, div(abs(uvNW_v), mul(roadWidth, 0.5))), 0.0, 1.0)
    );
    roadIntensity = connectNW.select(max(roadIntensity, maskNW), roadIntensity);
    roadU = connectNW.select(mix(roadU, add(uvNW_u, 0.5), maskNW), roadU);
    roadV = connectNW.select(mix(roadV, uvNW_v, maskNW), roadV);
    
    // Apply soft edge falloff
    const roadMask = clamp(div(roadIntensity, add(edgeSoftness, 0.001)), 0.0, 1.0);
    
    // Create edge highlight using UV gradient
    const edgeMask = mul(roadMask, sub(1.0, pow(roadMask, 8.0)));
    
    // -------------------------------------------------------------------------
    // Road Surface Appearance (procedural texture)
    // -------------------------------------------------------------------------
    // Multi-scale noise for realistic road texture with more variation
    const noiseScale1 = 50.0;  // Fine detail (increased)
    const noiseScale2 = 12.0;  // Medium detail
    const noiseScale3 = 3.0;   // Large variations
    const noiseCoord1 = mul(add(tilePos, vec2(mul(tileX, 0.5), mul(tileY, 0.5))), noiseScale1);
    const noiseCoord2 = mul(add(tilePos, vec2(mul(tileX, 0.3), mul(tileY, 0.3))), noiseScale2);
    const noiseCoord3 = mul(add(tilePos, vec2(mul(tileX, 0.7), mul(tileY, 0.7))), noiseScale3);
    
    const noiseValue1 = fract(mul(sin(dot(noiseCoord1, vec2(12.9898, 78.233))), 43758.5453));
    const noiseValue2 = fract(mul(sin(dot(noiseCoord2, vec2(45.1523, 31.789))), 43758.5453));
    const noiseValue3 = fract(mul(sin(dot(noiseCoord3, vec2(67.234, 98.456))), 43758.5453));
    const combinedNoise = mul(add(add(noiseValue1, mul(noiseValue2, 0.6)), mul(noiseValue3, 0.3)), 0.526);
    
    // Road base color - higher contrast brown/tan for dirt roads
    const roadBaseColor = vec3(0.45, 0.37, 0.26);     // Lighter, more saturated base
    const roadMidColor = vec3(0.34, 0.28, 0.20);      // Mid tone with better contrast
    const roadDarkColor = vec3(0.22, 0.18, 0.14);     // Darker variation with more contrast
    
    // Use noise to blend between three color levels for more realistic appearance
    const roadColor1 = mix(roadBaseColor, roadMidColor, step(0.35, combinedNoise));
    const roadColorWithNoise = mix(roadColor1, roadDarkColor, mul(step(0.70, combinedNoise), 0.8));
    
    // Add subtle center line for roads (dashed) - using UV coordinates
    const centerLineWidth = 0.016;  // Width in UV space
    const dashScale = 6.0;
    
    // Detect if this is a junction (multiple connections)
    const connectionCount = add(add(add(
        connectN.select(1.0, 0.0),
        connectS.select(1.0, 0.0)),
        add(connectE.select(1.0, 0.0),
        connectW.select(1.0, 0.0))),
        add(add(connectNE.select(1.0, 0.0),
        connectSE.select(1.0, 0.0)),
        add(connectSW.select(1.0, 0.0),
        connectNW.select(1.0, 0.0))));
    const isJunction = step(2.5, connectionCount);  // 3+ connections = junction
    
    // Create dashed center line using roadU coordinate
    const dashPattern = step(0.4, fract(mul(roadU, dashScale)));
    const centerLineDist = abs(roadV);  // Distance from center in UV space
    const centerLineMask = mul(mul(step(centerLineDist, centerLineWidth), dashPattern), sub(1.0, isJunction));
    
    // Center line color (yellow/white)
    const centerLineColor = vec3(0.90, 0.85, 0.50);
    const roadColorWithLine = mix(roadColorWithNoise, centerLineColor, mul(centerLineMask, 0.75));
    
    // Add darker edge borders for definition (higher contrast)
    const edgeDarkenColor = vec3(0.10, 0.08, 0.06);  // Darker edges for better contrast
    const roadColorWithEdges = mix(roadColorWithLine, edgeDarkenColor, mul(edgeMask, 0.7));
    
    // -------------------------------------------------------------------------
    // Railroad-Specific Rendering (sleepers/ties pattern)
    // -------------------------------------------------------------------------
    const sleeperWidth = 0.016;      // Narrower sleepers for refined look
    const sleeperSpacing = 0.09;     // Tighter spacing for better definition
    const railWidth = 0.010;         // Narrower individual rails
    const railGap = 0.038;           // Narrower gap between rails
    
    // Calculate distance along the track for sleeper placement
    // Use roadU coordinate (along-road) for sleeper spacing
    const distAlong = roadU;
    
    // Create repeating sleeper pattern (dark wooden ties)
    const sleeperMod = mod(mul(distAlong, 2.0), sleeperSpacing);  // Scale for proper spacing
    const sleeperPattern = step(sleeperMod, sleeperWidth);
    
    // Create rail tracks (two parallel metallic rails)
    // Use UV coordinate (roadV) for perpendicular distance
    const distFromCenterLine = abs(roadV);
    
    // Create mask for the two parallel rails with improved definition
    const railOuterEdge = add(mul(railGap, 0.5), railWidth);
    const railInnerEdge = sub(mul(railGap, 0.5), railWidth);
    const railMask = step(distFromCenterLine, railOuterEdge);
    const railGapMask = step(distFromCenterLine, railInnerEdge);
    const doubleRailMask = mul(railMask, sub(1.0, railGapMask));
    
    // Add subtle highlights to rail center for 3D effect
    const railCenterDist = abs(sub(distFromCenterLine, mul(railGap, 0.5)));
    const railCenterHighlight = clamp(sub(1.0, mul(railCenterDist, 100.0)), 0.0, 1.0);
    
    // Railroad colors - higher contrast
    const railMetalColor = vec3(0.52, 0.54, 0.58);      // Brighter metallic for rails
    const railShineColor = vec3(0.75, 0.77, 0.80);      // Enhanced highlight on rails
    const railDarkColor = vec3(0.30, 0.32, 0.35);       // Darker rail edges for contrast
    const sleeperWoodColor = vec3(0.16, 0.12, 0.08);    // Darker weathered wood
    const sleeperDarkColor = vec3(0.10, 0.08, 0.05);    // Very dark variation for contrast
    const gravelColor = vec3(0.28, 0.26, 0.22);         // Lighter gravel/ballast for contrast
    
    // Add texture to sleepers with variation
    const sleeperNoise = fract(mul(sin(dot(mul(tilePos, 20.0), vec2(38.456, 67.234))), 43758.5453));
    const sleeperColorVaried = mix(sleeperWoodColor, sleeperDarkColor, mul(sleeperNoise, 0.4));
    
    // Enhanced rail color with center highlight and edge darkening
    const railBaseColor = mix(railMetalColor, railShineColor, mul(railCenterHighlight, 0.6));
    const railColorShiny = mix(railBaseColor, railDarkColor, mul(sub(1.0, railCenterHighlight), 0.3));
    
    // Combine rails, sleepers, and gravel ballast
    const railBaseLayer = mix(gravelColor, railColorShiny, mul(doubleRailMask, 0.98));
    const railColor = mix(railBaseLayer, sleeperColorVaried, mul(sleeperPattern, 0.90));
    
    // Add edge definition to railroad (higher contrast)
    const railEdgeColor = vec3(0.06, 0.05, 0.03);  // Darker edges for better definition
    const railColorWithEdges = mix(railColor, railEdgeColor, mul(edgeMask, 0.6));
    
    // Choose road or rail color
    const finalRoadColor = hasAnyRail.select(railColorWithEdges, roadColorWithEdges);
    
    // -------------------------------------------------------------------------
    // Blend Roads/Railroads onto Terrain
    // -------------------------------------------------------------------------
    const activeRoadMask = mul(hasAnyInfrastructure, roadMask);
    
    finalColor = vec4(
        mix(finalColor.rgb, finalRoadColor, mul(activeRoadMask, 0.9)),
        finalColor.a
    );

    // =========================================================================
    // RIVERS RENDERING (Procedural - using math only)
    // =========================================================================
    // Sample river data from riversmap texture
    const riversmapTex = uniforms.riversmap.value;
    const riverData = texture(riversmapTex, tileCenterUV);
    const riverIndex = floor(mul(riverData.r, 256.0));
    
    // Detect river presence (1-9 for directional, 42 for junction)
    const hasRiver = mul(step(0.5, riverIndex), step(riverIndex, 9.5));
    const hasRiverJunction = mul(step(41.5, riverIndex), step(riverIndex, 42.5));
    const hasAnyRiver = max(hasRiver, hasRiverJunction);
    
    // -------------------------------------------------------------------------
    // Decode River Connectivity from riverIndex
    // -------------------------------------------------------------------------
    // River encoding: 1=single, 2=N, 3=NE, 4=S, 5=SE, 6=W, 7=SW, 8=E, 9=NW, 42=junction
    const riverIndexForDecoding = riverIndex;
    
    // Decode connections (each direction has a specific index value or junction)
    const riverConnectN = riverIndexForDecoding.greaterThanEqual(2.0).and(riverIndexForDecoding.lessThanEqual(2.5))
                         .or(riverIndexForDecoding.greaterThanEqual(32.0)); // junction
    const riverConnectE = riverIndexForDecoding.greaterThanEqual(8.0).and(riverIndexForDecoding.lessThanEqual(8.5))
                         .or(riverIndexForDecoding.greaterThanEqual(32.0)); // junction
    const riverConnectS = riverIndexForDecoding.greaterThanEqual(4.0).and(riverIndexForDecoding.lessThanEqual(4.5))
                         .or(riverIndexForDecoding.greaterThanEqual(32.0)); // junction
    const riverConnectW = riverIndexForDecoding.greaterThanEqual(6.0).and(riverIndexForDecoding.lessThanEqual(6.5))
                         .or(riverIndexForDecoding.greaterThanEqual(32.0)); // junction
    
    // Diagonal connections
    const riverConnectNE = riverIndexForDecoding.greaterThanEqual(3.0).and(riverIndexForDecoding.lessThanEqual(3.5));
    const riverConnectSE = riverIndexForDecoding.greaterThanEqual(5.0).and(riverIndexForDecoding.lessThanEqual(5.5));
    const riverConnectSW = riverIndexForDecoding.greaterThanEqual(7.0).and(riverIndexForDecoding.lessThanEqual(7.5));
    const riverConnectNW = riverIndexForDecoding.greaterThanEqual(9.0).and(riverIndexForDecoding.lessThanEqual(9.5));
    
    // -------------------------------------------------------------------------
    // UV-Based River Rendering (Flow Map Technique - No SDF)
    // Strategy: Same as roads but with wider width and stronger winding
    // -------------------------------------------------------------------------
    const riverWidth = 0.12;  // Full width of the river (wider than roads)
    const riverEdgeSoftness = 0.015;  // Softer edges for water
    
    // Add strong procedural winding to rivers for natural meandering appearance
    const riverWindingScale = 6.0;
    const riverWindingCoord = mul(add(tilePos, vec2(mul(tileX, 0.5), mul(tileY, 0.5))), riverWindingScale);
    const riverWindingNoise1 = fract(mul(sin(dot(riverWindingCoord, vec2(12.9898, 78.233))), 43758.5453));
    const riverWindingNoise2 = fract(mul(sin(dot(mul(riverWindingCoord, 1.3), vec2(45.123, 31.789))), 43758.5453));
    const riverWindingOffsetUV = mul(sub(add(riverWindingNoise1, mul(riverWindingNoise2, 0.5)), 0.75), 0.12);
    
    // Initialize river with zero
    let riverIntensity = 0.0;
    let riverU = 0.0;
    let riverV = 0.0;
    
    // North direction
    const uvRiverN_u = sub(tilePos.y, 0.5);
    const uvRiverN_v = add(sub(tilePos.x, 0.5), riverWindingOffsetUV);
    const maskRiverN = mul(
        step(0.0, uvRiverN_u),
        clamp(sub(1.0, div(abs(uvRiverN_v), mul(riverWidth, 0.5))), 0.0, 1.0)
    );
    riverIntensity = riverConnectN.select(max(riverIntensity, maskRiverN), riverIntensity);
    riverU = riverConnectN.select(mix(riverU, add(uvRiverN_u, 0.5), maskRiverN), riverU);
    riverV = riverConnectN.select(mix(riverV, uvRiverN_v, maskRiverN), riverV);
    
    // South direction
    const uvRiverS_u = sub(0.5, tilePos.y);
    const uvRiverS_v = add(sub(tilePos.x, 0.5), riverWindingOffsetUV);
    const maskRiverS = mul(
        step(uvRiverS_u, 0.0).not(),
        clamp(sub(1.0, div(abs(uvRiverS_v), mul(riverWidth, 0.5))), 0.0, 1.0)
    );
    riverIntensity = riverConnectS.select(max(riverIntensity, maskRiverS), riverIntensity);
    riverU = riverConnectS.select(mix(riverU, add(uvRiverS_u, 0.5), maskRiverS), riverU);
    riverV = riverConnectS.select(mix(riverV, uvRiverS_v, maskRiverS), riverV);
    
    // East direction
    const uvRiverE_u = sub(tilePos.x, 0.5);
    const uvRiverE_v = add(sub(tilePos.y, 0.5), riverWindingOffsetUV);
    const maskRiverE = mul(
        step(0.0, uvRiverE_u),
        clamp(sub(1.0, div(abs(uvRiverE_v), mul(riverWidth, 0.5))), 0.0, 1.0)
    );
    riverIntensity = riverConnectE.select(max(riverIntensity, maskRiverE), riverIntensity);
    riverU = riverConnectE.select(mix(riverU, add(uvRiverE_u, 0.5), maskRiverE), riverU);
    riverV = riverConnectE.select(mix(riverV, uvRiverE_v, maskRiverE), riverV);
    
    // West direction
    const uvRiverW_u = sub(0.5, tilePos.x);
    const uvRiverW_v = add(sub(tilePos.y, 0.5), riverWindingOffsetUV);
    const maskRiverW = mul(
        step(uvRiverW_u, 0.0).not(),
        clamp(sub(1.0, div(abs(uvRiverW_v), mul(riverWidth, 0.5))), 0.0, 1.0)
    );
    riverIntensity = riverConnectW.select(max(riverIntensity, maskRiverW), riverIntensity);
    riverU = riverConnectW.select(mix(riverU, add(uvRiverW_u, 0.5), maskRiverW), riverU);
    riverV = riverConnectW.select(mix(riverV, uvRiverW_v, maskRiverW), riverV);
    
    // Diagonal NE
    const uvRiverNE_u = mul(add(sub(tilePos.x, 0.5), sub(tilePos.y, 0.5)), 0.707);
    const uvRiverNE_v = mul(sub(sub(tilePos.y, 0.5), sub(tilePos.x, 0.5)), 0.707);
    const maskRiverNE = mul(
        mul(step(0.0, uvRiverNE_u), mul(step(0.0, sub(tilePos.x, 0.5)), step(0.0, sub(tilePos.y, 0.5)))),
        clamp(sub(1.0, div(abs(uvRiverNE_v), mul(riverWidth, 0.5))), 0.0, 1.0)
    );
    riverIntensity = riverConnectNE.select(max(riverIntensity, maskRiverNE), riverIntensity);
    riverU = riverConnectNE.select(mix(riverU, add(uvRiverNE_u, 0.5), maskRiverNE), riverU);
    riverV = riverConnectNE.select(mix(riverV, uvRiverNE_v, maskRiverNE), riverV);
    
    // Diagonal SE
    const uvRiverSE_u = mul(add(sub(tilePos.x, 0.5), sub(0.5, tilePos.y)), 0.707);
    const uvRiverSE_v = mul(add(sub(tilePos.y, 0.5), sub(tilePos.x, 0.5)), 0.707);
    const maskRiverSE = mul(
        mul(step(0.0, uvRiverSE_u), mul(step(0.0, sub(tilePos.x, 0.5)), step(tilePos.y, 0.5))),
        clamp(sub(1.0, div(abs(uvRiverSE_v), mul(riverWidth, 0.5))), 0.0, 1.0)
    );
    riverIntensity = riverConnectSE.select(max(riverIntensity, maskRiverSE), riverIntensity);
    riverU = riverConnectSE.select(mix(riverU, add(uvRiverSE_u, 0.5), maskRiverSE), riverU);
    riverV = riverConnectSE.select(mix(riverV, uvRiverSE_v, maskRiverSE), riverV);
    
    // Diagonal SW
    const uvRiverSW_u = mul(sub(sub(0.5, tilePos.x), sub(tilePos.y, 0.5)), 0.707);
    const uvRiverSW_v = mul(add(sub(0.5, tilePos.y), sub(0.5, tilePos.x)), 0.707);
    const maskRiverSW = mul(
        mul(step(0.0, uvRiverSW_u), mul(step(tilePos.x, 0.5), step(tilePos.y, 0.5))),
        clamp(sub(1.0, div(abs(uvRiverSW_v), mul(riverWidth, 0.5))), 0.0, 1.0)
    );
    riverIntensity = riverConnectSW.select(max(riverIntensity, maskRiverSW), riverIntensity);
    riverU = riverConnectSW.select(mix(riverU, add(uvRiverSW_u, 0.5), maskRiverSW), riverU);
    riverV = riverConnectSW.select(mix(riverV, uvRiverSW_v, maskRiverSW), riverV);
    
    // Diagonal NW
    const uvRiverNW_u = mul(sub(sub(0.5, tilePos.x), sub(0.5, tilePos.y)), 0.707);
    const uvRiverNW_v = mul(sub(sub(tilePos.y, 0.5), sub(tilePos.x, 0.5)), 0.707);
    const maskRiverNW = mul(
        mul(step(0.0, uvRiverNW_u), mul(step(tilePos.x, 0.5), step(0.0, sub(tilePos.y, 0.5)))),
        clamp(sub(1.0, div(abs(uvRiverNW_v), mul(riverWidth, 0.5))), 0.0, 1.0)
    );
    riverIntensity = riverConnectNW.select(max(riverIntensity, maskRiverNW), riverIntensity);
    riverU = riverConnectNW.select(mix(riverU, add(uvRiverNW_u, 0.5), maskRiverNW), riverU);
    riverV = riverConnectNW.select(mix(riverV, uvRiverNW_v, maskRiverNW), riverV);
    
    // Apply soft edge falloff
    const riverMask = clamp(div(riverIntensity, add(riverEdgeSoftness, 0.001)), 0.0, 1.0);
    
    // -------------------------------------------------------------------------
    // River Appearance: Blue water with Yellow/Sandy shoreline
    // -------------------------------------------------------------------------
    // Multi-scale noise for water texture variation
    const riverNoiseScale1 = 30.0;
    const riverNoiseScale2 = 8.0;
    const riverNoiseCoord1 = mul(add(tilePos, vec2(mul(tileX, 0.5), mul(tileY, 0.5))), riverNoiseScale1);
    const riverNoiseCoord2 = mul(add(tilePos, vec2(mul(tileX, 0.3), mul(tileY, 0.3))), riverNoiseScale2);
    
    const riverNoiseValue1 = fract(mul(sin(dot(riverNoiseCoord1, vec2(12.9898, 78.233))), 43758.5453));
    const riverNoiseValue2 = fract(mul(sin(dot(riverNoiseCoord2, vec2(45.1523, 31.789))), 43758.5453));
    const riverCombinedNoise = mul(add(riverNoiseValue1, mul(riverNoiseValue2, 0.5)), 0.667);
    
    // River water colors - vibrant blue with depth variation
    const riverDeepBlue = vec3(0.15, 0.35, 0.65);      // Deep water blue
    const riverLightBlue = vec3(0.25, 0.50, 0.75);     // Lighter blue for shallow areas
    const riverWaterColor = mix(riverDeepBlue, riverLightBlue, mul(riverCombinedNoise, 0.6));
    
    // Shoreline/beach color - warm yellow/sandy
    const riverShorelineColor = vec3(0.85, 0.75, 0.45);  // Yellow-sandy beach
    
    // Create UV-based gradient for shoreline effect
    // Inner river (center) = blue water
    // Outer river (edges) = yellow sandy shoreline
    const shorelineBlendDist = 0.04;  // Width of shoreline transition zone in UV space
    const distToRiverEdge = abs(riverV);  // Use riverV (across-river coordinate)
    const shorelineFactor = clamp(div(distToRiverEdge, shorelineBlendDist), 0.0, 1.0);
    
    // Blend from water (center) to shoreline (edges)
    const riverColor = mix(riverWaterColor, riverShorelineColor, shorelineFactor);
    
    // Add subtle shimmer/sparkle to water surface
    const shimmerScale = 50.0;
    const shimmerCoord = mul(add(tilePos, vec2(mul(tileX, 0.7), mul(tileY, 0.7))), shimmerScale);
    const shimmerNoise = fract(mul(sin(dot(shimmerCoord, vec2(67.234, 98.456))), 43758.5453));
    const shimmer = mul(step(0.92, shimmerNoise), 0.2);  // Occasional bright spots
    const riverColorWithShimmer = add(riverColor, vec3(shimmer, shimmer, shimmer));
    
    // -------------------------------------------------------------------------
    // Blend Rivers onto Terrain
    // -------------------------------------------------------------------------
    const activeRiverMask = mul(hasAnyRiver, riverMask);
    
    finalColor = vec4(
        mix(finalColor.rgb, riverColorWithShimmer, mul(activeRiverMask, 0.95)),
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
    
    // Apply ambient + diffuse lighting model for natural terrain appearance
    // ambient: base brightness for surfaces not directly facing sun (increased by 10%: 0.22 * 1.10 = 0.242)
    // diffuse: sun-facing surfaces get additional brightness
    // Total range: 0.242 (in shadow) to 0.772 (fully lit)
    const ambientLight = 0.242;
    const diffuseStrength = 0.53;
    const lightingFactor = add(ambientLight, mul(NdotL, diffuseStrength));
    
    // Apply lighting to terrain color for natural appearance
    // Brightness boost of 1.232 (1.12 * 1.10) provides 10% increase in terrain brightness
    const brightnessBoost = 1.232;
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
    let effectiveVisibility = min(smoothVisibility, vertexVisibility);
    
    // If terrain type is known (terrainHere > 0), the tile is at least known (not unknown).
    // Ensure minimum visibility of VISIBILITY_FOGGED for known terrain.
    const isKnownTerrain = step(0.5, terrainHere);
    effectiveVisibility = max(effectiveVisibility, mul(isKnownTerrain, VISIBILITY_FOGGED));
    
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
    // SELECTED TILE HIGHLIGHTING
    // =========================================================================
    // Highlight the currently selected tile based on selected_x and selected_y uniforms
    // A value of -1 indicates no selection, otherwise the tile at (selected_x, selected_y) is highlighted
    const hasSelection = selected_x.greaterThanEqual(0.0).and(selected_y.greaterThanEqual(0.0));
    // Use epsilon-based comparison (0.5) for float precision tolerance
    // tileX/tileY are floored floats (e.g., 5.0), selected_x/selected_y are uniform integers (e.g., 5)
    const xMatch = abs(sub(tileX, selected_x)).lessThan(0.5);
    const yMatch = abs(sub(tileY, selected_y)).lessThan(0.5);
    const isSelectedTile = xMatch.and(yMatch);
    const shouldHighlightTile = hasSelection.and(isSelectedTile);
    
    // Selection highlight color (golden/yellow tint for visibility)
    const SELECTION_HIGHLIGHT_COLOR = vec3(1.0, 0.9, 0.5);
    const SELECTION_EDGE_INTENSITY = 0.8;  // Strong edge highlight
    const SELECTION_FILL_INTENSITY = 0.15; // Subtle fill highlight
    
    // Calculate selection visibility factor (1.0 if selected, 0.0 if not)
    const selectionActive = shouldHighlightTile.select(1.0, 0.0);
    
    // Apply edge highlighting on selected tile (using hexEdgeMask for edge detection)
    const scaledEdgeMask = mul(hexEdgeMask, SELECTION_EDGE_INTENSITY);
    const selectionEdgeFactor = mul(selectionActive, scaledEdgeMask);
    finalColor = vec4(
        mix(finalColor.rgb, SELECTION_HIGHLIGHT_COLOR, selectionEdgeFactor),
        finalColor.a
    );
    
    // Apply subtle fill highlighting to the entire selected tile
    const selectionFillFactor = mul(selectionActive, SELECTION_FILL_INTENSITY);
    finalColor = vec4(
        mix(finalColor.rgb, SELECTION_HIGHLIGHT_COLOR, selectionFillFactor),
        finalColor.a
    );

    // =========================================================================
    // OUT-OF-BOUNDS CHECK - Render black where no tiles exist
    // =========================================================================
    // Check if the current pixel is outside the valid map tile range
    // Valid tiles are in range [0, map_size-1] for both X and Y
    // Areas outside this range should be rendered as black
    const isOutOfBoundsX = tileX.greaterThanEqual(map_x_size).or(tileX.lessThan(0.0));
    const isOutOfBoundsY = tileY.greaterThanEqual(map_y_size).or(tileY.lessThan(0.0));
    const isOutOfBounds = isOutOfBoundsX.or(isOutOfBoundsY);
    
    // If out of bounds, return black; otherwise return the computed color
    finalColor = isOutOfBounds.select(vec4(0.0, 0.0, 0.0, 1.0), finalColor);

    return finalColor;
}

// Export the shader creation function
window.createTerrainShaderTSL = createTerrainShaderTSL;
