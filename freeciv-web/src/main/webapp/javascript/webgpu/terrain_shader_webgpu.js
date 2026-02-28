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
 * - Roads and railroads rendering using procedural SDF (Signed Distance Fields)
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
    // Procedural Road Shape using Distance Fields
    // -------------------------------------------------------------------------
    const roadWidth = 0.08;  // Half-width of the road
    const edgeSoftness = 0.01;  // Anti-aliasing
    
    // Current position within tile [0,1]
    const tilePos = vec2(localX, localY);
    const center = vec2(0.5, 0.5);
    const tilePosFromCenter = sub(tilePos, center);
    
    // Central hub - circle at tile center (SDF for circle: length(p) - r)
    const distToCenter = tilePosFromCenter.length();
    const hubRadius = 0.06;
    let distToRoad = sub(distToCenter, hubRadius);
    
    // Helper function to calculate distance to a line segment (as TSL nodes)
    // For a segment from center to edge point, we compute capsule SDF
    // SDF for capsule from point a to b with radius r:
    //   pa = p - a
    //   ba = b - a  
    //   h = saturate(dot(pa, ba) / dot(ba, ba))
    //   return length(pa - ba * h) - r
    
    // North segment (center to top edge)
    const northTarget = vec2(0.5, 1.0);
    const toNorth = sub(northTarget, center);
    const hN = clamp(div(dot(tilePosFromCenter, toNorth), dot(toNorth, toNorth)), 0.0, 1.0);
    const distToNorth = sub(sub(tilePosFromCenter, mul(toNorth, hN)).length(), roadWidth);
    distToRoad = connectN.select(min(distToRoad, distToNorth), distToRoad);
    
    // South segment (center to bottom edge)
    const southTarget = vec2(0.5, 0.0);
    const toSouth = sub(southTarget, center);
    const hS = clamp(div(dot(tilePosFromCenter, toSouth), dot(toSouth, toSouth)), 0.0, 1.0);
    const distToSouth = sub(sub(tilePosFromCenter, mul(toSouth, hS)).length(), roadWidth);
    distToRoad = connectS.select(min(distToRoad, distToSouth), distToRoad);
    
    // East segment (center to right edge)
    const eastTarget = vec2(1.0, 0.5);
    const toEast = sub(eastTarget, center);
    const hE = clamp(div(dot(tilePosFromCenter, toEast), dot(toEast, toEast)), 0.0, 1.0);
    const distToEast = sub(sub(tilePosFromCenter, mul(toEast, hE)).length(), roadWidth);
    distToRoad = connectE.select(min(distToRoad, distToEast), distToRoad);
    
    // West segment (center to left edge)
    const westTarget = vec2(0.0, 0.5);
    const toWest = sub(westTarget, center);
    const hW = clamp(div(dot(tilePosFromCenter, toWest), dot(toWest, toWest)), 0.0, 1.0);
    const distToWest = sub(sub(tilePosFromCenter, mul(toWest, hW)).length(), roadWidth);
    distToRoad = connectW.select(min(distToRoad, distToWest), distToRoad);
    
    // Diagonal segments
    const neTarget = vec2(1.0, 1.0);
    const toNE = sub(neTarget, center);
    const hNE = clamp(div(dot(tilePosFromCenter, toNE), dot(toNE, toNE)), 0.0, 1.0);
    const distToNE = sub(sub(tilePosFromCenter, mul(toNE, hNE)).length(), roadWidth);
    distToRoad = connectNE.select(min(distToRoad, distToNE), distToRoad);
    
    const seTarget = vec2(1.0, 0.0);
    const toSE = sub(seTarget, center);
    const hSE = clamp(div(dot(tilePosFromCenter, toSE), dot(toSE, toSE)), 0.0, 1.0);
    const distToSE = sub(sub(tilePosFromCenter, mul(toSE, hSE)).length(), roadWidth);
    distToRoad = connectSE.select(min(distToRoad, distToSE), distToRoad);
    
    const swTarget = vec2(0.0, 0.0);
    const toSW = sub(swTarget, center);
    const hSW = clamp(div(dot(tilePosFromCenter, toSW), dot(toSW, toSW)), 0.0, 1.0);
    const distToSW = sub(sub(tilePosFromCenter, mul(toSW, hSW)).length(), roadWidth);
    distToRoad = connectSW.select(min(distToRoad, distToSW), distToRoad);
    
    const nwTarget = vec2(0.0, 1.0);
    const toNW = sub(nwTarget, center);
    const hNW = clamp(div(dot(tilePosFromCenter, toNW), dot(toNW, toNW)), 0.0, 1.0);
    const distToNW = sub(sub(tilePosFromCenter, mul(toNW, hNW)).length(), roadWidth);
    distToRoad = connectNW.select(min(distToRoad, distToNW), distToRoad);
    
    // Convert distance to mask (1 = on road, 0 = off road)
    const roadMask = clamp(sub(1.0, div(distToRoad, edgeSoftness)), 0.0, 1.0);
    
    // Create edge highlight for better definition
    const edgeHighlightWidth = 0.015;
    const distToEdge = abs(distToRoad);
    const edgeMask = mul(step(distToEdge, edgeHighlightWidth), roadMask);
    
    // -------------------------------------------------------------------------
    // Road Surface Appearance (procedural texture)
    // -------------------------------------------------------------------------
    // Multi-scale noise for realistic road texture
    const noiseScale1 = 40.0;  // Fine detail
    const noiseScale2 = 8.0;   // Medium detail
    const noiseCoord1 = mul(add(tilePos, vec2(mul(tileX, 0.5), mul(tileY, 0.5))), noiseScale1);
    const noiseCoord2 = mul(add(tilePos, vec2(mul(tileX, 0.3), mul(tileY, 0.3))), noiseScale2);
    
    const noiseValue1 = fract(mul(sin(dot(noiseCoord1, vec2(12.9898, 78.233))), 43758.5453));
    const noiseValue2 = fract(mul(sin(dot(noiseCoord2, vec2(45.1523, 31.789))), 43758.5453));
    const combinedNoise = mul(add(noiseValue1, mul(noiseValue2, 0.5)), 0.667);
    
    // Road base color - warmer brown/tan for dirt roads
    const roadBaseColor = vec3(0.35, 0.30, 0.22);  // Lighter, more visible
    const roadDarkColor = vec3(0.22, 0.19, 0.14);   // Darker variation
    const roadColorWithNoise = mix(roadBaseColor, roadDarkColor, mul(combinedNoise, 0.4));
    
    // Add subtle center line for roads (dashed)
    const centerLineDist = abs(sub(distToRoad, 0.0));  // Distance from center
    const centerLineWidth = 0.008;
    const dashScale = 6.0;
    
    // Calculate position along road for dashed line
    let roadPosAlong = mul(connectN, tilePos.y);
    roadPosAlong = add(roadPosAlong, mul(connectS, sub(1.0, tilePos.y)));
    roadPosAlong = add(roadPosAlong, mul(connectE, tilePos.x));
    roadPosAlong = add(roadPosAlong, mul(connectW, sub(1.0, tilePos.x)));
    
    const dashPattern = step(0.4, fract(mul(roadPosAlong, dashScale)));
    const centerLineMask = mul(step(centerLineDist, centerLineWidth), dashPattern);
    
    // Center line color (yellow/white)
    const centerLineColor = vec3(0.85, 0.80, 0.45);
    const roadColorWithLine = mix(roadColorWithNoise, centerLineColor, mul(centerLineMask, 0.7));
    
    // Add darker edge borders for definition
    const edgeDarkenColor = vec3(0.12, 0.10, 0.08);
    const roadColorWithEdges = mix(roadColorWithLine, edgeDarkenColor, mul(edgeMask, 0.6));
    
    // -------------------------------------------------------------------------
    // Railroad-Specific Rendering (sleepers/ties pattern)
    // -------------------------------------------------------------------------
    const sleeperWidth = 0.018;      // Slightly wider sleepers
    const sleeperSpacing = 0.10;     // Closer spacing for better visibility
    const railWidth = 0.012;         // Width of individual rails
    const railGap = 0.045;           // Gap between two rails
    
    // Calculate distance along the track for sleeper placement
    // Use dominant connection direction to align sleepers perpendicular to track
    let distAlong = mul(mul(connectN, step(0.5, connectN)), abs(sub(tilePos.y, 0.5)));
    distAlong = add(distAlong, mul(mul(connectS, step(0.5, connectS)), abs(sub(tilePos.y, 0.5))));
    distAlong = add(distAlong, mul(mul(connectE, step(0.5, connectE)), abs(sub(tilePos.x, 0.5))));
    distAlong = add(distAlong, mul(mul(connectW, step(0.5, connectW)), abs(sub(tilePos.x, 0.5))));
    
    // Create repeating sleeper pattern (dark wooden ties)
    const sleeperPattern = step(mod(distAlong, sleeperSpacing), sleeperWidth);
    
    // Create rail tracks (two parallel metallic rails)
    // Calculate perpendicular distance to center line
    const distFromCenterLine = abs(distToRoad);
    
    // Create mask for the two parallel rails
    const railMask = step(distFromCenterLine, add(mul(railGap, 0.5), railWidth));
    const railHighlight = sub(1.0, step(distFromCenterLine, sub(mul(railGap, 0.5), railWidth)));
    const doubleRailMask = mul(railMask, railHighlight);
    
    // Railroad colors
    const railMetalColor = vec3(0.50, 0.52, 0.55);      // Bright metallic for rails
    const railShineColor = vec3(0.65, 0.67, 0.70);      // Highlight on rails
    const sleeperWoodColor = vec3(0.18, 0.13, 0.08);    // Dark weathered wood
    const sleeperDarkColor = vec3(0.12, 0.09, 0.06);    // Even darker variation
    
    // Add texture to sleepers
    const sleeperNoise = fract(mul(sin(dot(mul(tilePos, 20.0), vec2(38.456, 67.234))), 43758.5453));
    const sleeperColorVaried = mix(sleeperWoodColor, sleeperDarkColor, mul(sleeperNoise, 0.3));
    
    // Mix rail shine based on viewing angle (center is brighter)
    const railColorShiny = mix(railMetalColor, railShineColor, mul(doubleRailMask, 0.4));
    
    // Combine rails and sleepers
    const railBaseLayer = mix(sleeperColorVaried, railColorShiny, mul(doubleRailMask, 0.95));
    const railColor = mix(railBaseLayer, sleeperColorVaried, mul(sleeperPattern, 0.85));
    
    // Add edge definition to railroad
    const railEdgeColor = vec3(0.08, 0.06, 0.04);
    const railColorWithEdges = mix(railColor, railEdgeColor, mul(edgeMask, 0.5));
    
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
