/**********************************************************************
    Freecivx.com - the web version of Freeciv. http://www.freecivx.com/
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
        vec2, vec3, vec4, int, float,
        mix, step, floor, fract, mod, dot, sin, cos, normalize, max, min, pow, clamp, abs,
        mul, add, sub, div,
        smoothstep, hash, fwidth,
        Fn
    } = THREE;
    
    // Verify all required TSL functions and nodes are available
    const requiredTSLNames = [
        'texture', 'uniform', 'positionLocal', 'attribute', 'uv', 'normalLocal',
        'vec2', 'vec3', 'vec4', 'int', 'float',
        'mix', 'step', 'floor', 'fract', 'mod', 'dot', 'sin', 'cos', 'normalize', 'max', 'min', 'pow', 'clamp', 'abs',
        'mul', 'add', 'sub', 'div',
        'smoothstep', 'hash', 'fwidth',
        'Fn'
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
    const roadspritesTex = uniforms.roadsprites.value;
    const riverspritesTex = uniforms.riversprites.value;
    const railroadspritesTex = uniforms.railroadsprites.value;
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
    // Road/railroad/river sprites are stored in DataArrayTexture (texture_2d_array) with 16 layers
    // Each layer is a separate sprite from the original 4x4 grid
    // Sprite indices: 1-9 for roads, 10-19 for railroads, 20-29 for rivers, 42/43/53 for junctions
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
    const tileYRaw = map_y_size.mul(uvNode.y);
    const tileY = tileYRaw.floor();
    
    // Hex stagger: mesh geometry offsets odd rows by 0.5 tile width
    // However, UV.y is inverted (1 - meshRow/gridY), so we need to calculate
    // the original mesh row parity. The mesh row ≈ (map_y_size - 1 - tileY),
    // so isOddRow = ((map_y_size - 1) - tileY) % 2
    // This ensures row 0 is normal and row 1+ alternates correctly
    const isOddRow = map_y_size.sub(1.0).sub(tileY).mod(2.0);
    
    // Calculate hex-adjusted UV coordinates
    // Remove the stagger from UV to get the logical tile X coordinate
    const hexOffsetX = isOddRow.mul(float(0.5).div(map_x_size));
    const hexUvX = uvNode.x.sub(hexOffsetX);
    const hexUV = vec2(hexUvX, uvNode.y);
    
    // Calculate the tile X coordinate
    const tileXRaw = map_x_size.mul(hexUvX);
    const tileX = tileXRaw.floor();
    
    // =========================================================================
    // HEXAGONAL CELL LOCAL COORDINATES
    // =========================================================================
    // Calculate position within the current hex cell (0 to 1 range)
    // This is used for hex shape masking and edge detection
    const localX = tileXRaw.fract();
    const localY = tileYRaw.fract();
    
    // Transform local coordinates to hex-centered system (-0.5 to 0.5 range)
    // Center is at (0, 0), corners at edges
    const centeredX = localX.sub(0.5);
    const centeredY = localY.sub(0.5);
    
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
    const hexY = centeredY.mul(HEX_ASPECT);
    
    // Calculate distance to three pairs of hex edges using dot products with edge normals
    // Edge 1: vertical edges (normal = (1, 0)) - horizontal direction edges
    const dist1 = hexX.abs();
    
    // Edge 2: top-right and bottom-left edges (normal = (0.5, sqrt(3)/2))
    const dist2 = hexX.mul(0.5).add(hexY.mul(HEX_SQRT3_OVER_2)).abs();
    
    // Edge 3: top-left and bottom-right edges (normal = (-0.5, sqrt(3)/2))
    const dist3 = hexX.mul(-0.5).add(hexY.mul(HEX_SQRT3_OVER_2)).abs();
    
    // The distance to hex edge is the maximum of these three distances
    // For a pointy-top hex with inradius 0.5, points inside have max(dist1,dist2,dist3) < 0.5
    const hexDist = dist1.max(dist2).max(dist3);
    
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
    const isHorizontalEdge = step(dist2.max(dist3), dist1);
    // mix(a, b, t): method form is a.mix(b, t) — diagonal width at t=0, horizontal at t=1
    const effectiveEdgeWidth = float(HEX_EDGE_WIDTH_DIAGONAL).mix(HEX_EDGE_WIDTH_HORIZONTAL, isHorizontalEdge);
    const edgeStart = float(hexInradius).sub(effectiveEdgeWidth);
    
    // Smooth step from interior to edge using THREE's smoothstep() TSL function.
    // fwidth() provides a screen-space derivative for adaptive anti-aliasing: the AA
    // band narrows automatically when zoomed in (sharper edges) and widens when zoomed
    // out (softer edges), eliminating both aliasing and over-blurring.
    const hexDistFw = fwidth(hexDist);
    const hexEdgeMask = smoothstep(edgeStart.sub(hexDistFw), hexInradius, hexDist);
    
    // =========================================================================
    // TERRAIN SAMPLING AT HEX TILE CENTER
    // =========================================================================
    // Sample terrain type from the center of the current hex tile
    // This ensures consistent terrain per hex, not per pixel
    const tileCenterU = tileX.add(0.5).div(map_x_size);
    const tileCenterV = tileY.add(0.5).div(map_y_size);
    
    // Add back the hex stagger offset for odd rows when sampling
    const tileCenterUStaggered = tileCenterU.add(hexOffsetX);
    const tileCenterUV = vec2(tileCenterUStaggered, tileCenterV);
    
    // Add pseudo-random texture offset for visual variety within tiles
    // Uses THREE's hash() TSL function for a more robust pseudo-random value than sin-based hashing
    // TEXTURE_RANDOM_SCALE controls amplitude: larger value = smaller random offset
    const rnd = hash(tileCenterUV);
    const rndOffset = rnd.sub(0.5).mul(float(1.0).div(vec2(map_x_size, map_y_size).mul(TEXTURE_RANDOM_SCALE)));
    const sampledUV = tileCenterUV.add(rndOffset);

    // Sample terrain type using hex tile center
    const terrainType = texture(maptilesTex, sampledUV);

    // Calculate texture coordinates for terrain detail within the hex
    // dx/dy: Local position within the current hex tile (0-1 range)
    // Used for standard terrain texture sampling
    const dx = localX;
    const dy = localY;

    // Extract terrain type value from texture (stored in red channel as 0-255 value)
    const terrainHere = terrainType.r.mul(256.0).floor();
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
            const coastTex = texture(terrainAtlasTex, coord).depth(int(TERRAIN_ATLAS_COAST));

            // 1.0 when above water level, 0.0 when underwater
            const aboveWater = step(WATER_LEVEL, posY);

            // Shoreline gradient: 0.0 at water level (beach sand), 1.0 at BEACH_HIGH (full terrain)
            // Guarantees land tiles above water always show terrain, never coast/water texture.
            // Range: BEACH_HIGH - WATER_LEVEL = 52.5 - 50.0 = 2.5
            const SHORELINE_RANGE = BEACH_HIGH - WATER_LEVEL;
            const shorelineT = clamp(div(sub(posY, WATER_LEVEL), SHORELINE_RANGE), 0.0, 1.0);

            // Above water: blend from beach sand (shoreline) to full terrain texture
            const aboveWaterColor = mix(vec4(beachSandColor, 1.0), baseTerrainColor, shorelineT);

            // Below water: show coast texture; above water: shoreline sand→terrain gradient
            terrainColor = mix(coastTex, aboveWaterColor, aboveWater);
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
    const irrigationFlag = terrainType.b.mul(256.0).floor();
    
    // Irrigation: sample irrigation texture from terrain_layers and blend over terrain
    const hasIrrigation = step(0.5, irrigationFlag).mul(step(irrigationFlag, 1.5));
    const irrigationTexColor = texture(terrainLayersTex, texCoord).depth(int(TERRAIN_LAYER_IRRIGATION));
    finalColor = vec4(finalColor.rgb.mix(irrigationTexColor.rgb, hasIrrigation.mul(irrigationTexColor.a)), finalColor.a);
    
    // Farmland: sample farmland texture from terrain_layers and blend over terrain
    const hasFarmland = step(1.5, irrigationFlag);
    const farmlandTexColor = texture(terrainLayersTex, texCoord).depth(int(TERRAIN_LAYER_FARMLAND));
    finalColor = vec4(finalColor.rgb.mix(farmlandTexColor.rgb, hasFarmland.mul(farmlandTexColor.a)), finalColor.a);

    // =========================================================================
    // ROADS AND RAILROADS RENDERING (using texture_2d_array)
    // =========================================================================
    // Sample road/railroad/river data from roadsmap texture at tile center
    // The roadsmap stores sprite indices in RGB channels:
    // - R channel: primary road/rail/river sprite index (1-9 roads, 10-19 rails, 20-29 rivers, 42/43/53 junctions)
    // - G channel: secondary connection sprite index
    // - B channel: tertiary connection sprite index
    const roadData = texture(roadsmapTex, tileCenterUV);
    const roadIndex = roadData.r.mul(256.0).floor();
    const roadIndex2 = roadData.g.mul(256.0).floor();
    const roadIndex3 = roadData.b.mul(256.0).floor();
    
    // Determine if this tile has rivers (indices 20-29, 53), roads (indices 1-9, 42) or railroads (indices 10-19, 43)
    const hasRiver = step(19.5, roadIndex).mul(step(roadIndex, 29.5));
    const hasRiverJunction = step(52.5, roadIndex).mul(step(roadIndex, 53.5));
    const hasRoad = step(0.5, roadIndex).mul(step(roadIndex, 9.5));
    const hasRoadJunction = step(41.5, roadIndex).mul(step(roadIndex, 42.5));
    const hasRailroad = step(9.5, roadIndex).mul(step(roadIndex, 19.5));
    const hasRailJunction = step(42.5, roadIndex).mul(step(roadIndex, 43.5));
    
    // Second texture from G channel
    const hasRiver2 = step(19.5, roadIndex2).mul(step(roadIndex2, 29.5));
    const hasRiverJunction2 = step(52.5, roadIndex2).mul(step(roadIndex2, 53.5));
    const hasRoad2 = step(0.5, roadIndex2).mul(step(roadIndex2, 9.5));
    const hasRoadJunction2 = step(41.5, roadIndex2).mul(step(roadIndex2, 42.5));
    const hasRailroad2 = step(9.5, roadIndex2).mul(step(roadIndex2, 19.5));
    const hasRailJunction2 = step(42.5, roadIndex2).mul(step(roadIndex2, 43.5));
    
    // Third texture from B channel
    const hasRiver3 = step(19.5, roadIndex3).mul(step(roadIndex3, 29.5));
    const hasRiverJunction3 = step(52.5, roadIndex3).mul(step(roadIndex3, 53.5));
    const hasRoad3 = step(0.5, roadIndex3).mul(step(roadIndex3, 9.5));
    const hasRoadJunction3 = step(41.5, roadIndex3).mul(step(roadIndex3, 42.5));
    const hasRailroad3 = step(9.5, roadIndex3).mul(step(roadIndex3, 19.5));
    const hasRailJunction3 = step(42.5, roadIndex3).mul(step(roadIndex3, 43.5));
    
    // Calculate layer indices for texture array sampling
    // Roads, railroads and rivers are now stored in DataArrayTexture with 16 layers (4x4 grid)
    // Layer index = row * 4 + col, where sprite index determines row and col
    // Rivers: indices 20-29 -> layer index = (index-20) since they map to layers 0-9
    // Roads: indices 1-9 -> layer index = (index-1) since they map to layers 0-8
    // Railroads: indices 10-19 -> layer index = (index-10) since they map to layers 0-9
    // Junctions: index 42/43/53 use layer 0 (top-left sprite)
    // Indices are clamped to valid ranges for cross-platform safety: some WebGPU
    // implementations have undefined behaviour on out-of-bounds array access.
    
    // River sprite layer selection (indices 20-29 for regular rivers)
    const riverLayerIndex = int(roadIndex.sub(20.0).clamp(0.0, 9.0));
    const riverLayerIndex2 = int(roadIndex2.sub(20.0).clamp(0.0, 9.0));
    const riverLayerIndex3 = int(roadIndex3.sub(20.0).clamp(0.0, 9.0));
    
    // Road sprite layer selection (indices 1-9 for regular roads)
    const roadLayerIndex = int(roadIndex.sub(1.0).clamp(0.0, 8.0));
    const roadLayerIndex2 = int(roadIndex2.sub(1.0).clamp(0.0, 8.0));
    const roadLayerIndex3 = int(roadIndex3.sub(1.0).clamp(0.0, 8.0));
    
    // Railroad sprite layer selection (indices 10-19 for regular railroads)
    const railLayerIndex = int(roadIndex.sub(10.0).clamp(0.0, 9.0));
    const railLayerIndex2 = int(roadIndex2.sub(10.0).clamp(0.0, 9.0));
    const railLayerIndex3 = int(roadIndex3.sub(10.0).clamp(0.0, 9.0));
    
    // Sample river sprite using texture array with vec2 UV and integer layer index
    // For texture_2d_array (DataArrayTexture), pass layer index as third parameter
    // localX, localY are the UV coordinates within the tile (0-1 range)
    const riverSpriteUV = vec2(localX, localY);
    const riverSprite = texture(riverspritesTex, riverSpriteUV).depth(riverLayerIndex);
    const riverSprite2 = texture(riverspritesTex, riverSpriteUV).depth(riverLayerIndex2);
    const riverSprite3 = texture(riverspritesTex, riverSpriteUV).depth(riverLayerIndex3);
    
    // Sample road sprite using texture array with vec2 UV and integer layer index
    // For texture_2d_array (DataArrayTexture), pass layer index as third parameter
    // localX, localY are the UV coordinates within the tile (0-1 range)
    const roadSpriteUV = vec2(localX, localY);
    const roadSprite = texture(roadspritesTex, roadSpriteUV).depth(roadLayerIndex);
    const roadSprite2 = texture(roadspritesTex, roadSpriteUV).depth(roadLayerIndex2);
    const roadSprite3 = texture(roadspritesTex, roadSpriteUV).depth(roadLayerIndex3);
    
    // Sample railroad sprite using texture array
    const railSpriteUV = vec2(localX, localY);
    const railSprite = texture(railroadspritesTex, railSpriteUV).depth(railLayerIndex);
    const railSprite2 = texture(railroadspritesTex, railSpriteUV).depth(railLayerIndex2);
    const railSprite3 = texture(railroadspritesTex, railSpriteUV).depth(railLayerIndex3);
    
    // Junction sprites - 4-way junctions use layer 0 (top-left sprite in original grid)
    const junctionUV = vec2(localX, localY);
    const riverJunctionSprite = texture(riverspritesTex, junctionUV).depth(int(0));
    const roadJunctionSprite = texture(roadspritesTex, junctionUV).depth(int(0));
    const railJunctionSprite = texture(railroadspritesTex, junctionUV).depth(int(0));

    // =========================================================================
    // SPRITE BLENDING HELPER (modern Fn() pattern)
    // =========================================================================
    // Fn() compiles this into a named GPU function rather than inlining the same
    // three-operation expression 18 times. The compiled WGSL/GLSL shader is
    // smaller, and the function is reused across all road/river/railroad layers.
    //   base    – current vec4 terrain colour
    //   sprite  – sampled sprite vec4 (rgb + alpha)
    //   hasMask – 1.0 when this sprite type is active, 0.0 otherwise
    const blendSpriteOnTerrain = Fn(([base, sprite, hasMask]) => {
        const alpha = hasMask.mul(sprite.a).mul(0.9);
        return vec4(base.rgb.mix(sprite.rgb, alpha), base.a);
    });

    // Blend rivers onto terrain first (lowest layer, rendered before roads)
    finalColor = blendSpriteOnTerrain(finalColor, riverSprite, hasRiver);
    finalColor = blendSpriteOnTerrain(finalColor, riverSprite2, hasRiver2);
    finalColor = blendSpriteOnTerrain(finalColor, riverSprite3, hasRiver3);

    // Blend river junctions (index 53)
    finalColor = blendSpriteOnTerrain(finalColor, riverJunctionSprite, hasRiverJunction);
    finalColor = blendSpriteOnTerrain(finalColor, riverJunctionSprite, hasRiverJunction2);
    finalColor = blendSpriteOnTerrain(finalColor, riverJunctionSprite, hasRiverJunction3);

    // Blend regular roads (indices 1-9) and road junctions (index 42)
    finalColor = blendSpriteOnTerrain(finalColor, roadSprite, hasRoad);
    finalColor = blendSpriteOnTerrain(finalColor, roadSprite2, hasRoad2);
    finalColor = blendSpriteOnTerrain(finalColor, roadSprite3, hasRoad3);
    finalColor = blendSpriteOnTerrain(finalColor, roadJunctionSprite, hasRoadJunction);
    finalColor = blendSpriteOnTerrain(finalColor, roadJunctionSprite, hasRoadJunction2);
    finalColor = blendSpriteOnTerrain(finalColor, roadJunctionSprite, hasRoadJunction3);

    // Blend railroads (indices 10-19) and railroad junctions (index 43)
    finalColor = blendSpriteOnTerrain(finalColor, railSprite, hasRailroad);
    finalColor = blendSpriteOnTerrain(finalColor, railSprite2, hasRailroad2);
    finalColor = blendSpriteOnTerrain(finalColor, railSprite3, hasRailroad3);
    finalColor = blendSpriteOnTerrain(finalColor, railJunctionSprite, hasRailJunction);
    finalColor = blendSpriteOnTerrain(finalColor, railJunctionSprite, hasRailJunction2);
    finalColor = blendSpriteOnTerrain(finalColor, railJunctionSprite, hasRailJunction3);


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
    const NdotL = normal.dot(sunDir).max(0.0);
    
    // Apply ambient + diffuse lighting model for natural terrain appearance
    // ambient: base brightness for surfaces not directly facing sun
    // diffuse: sun-facing surfaces get additional brightness
    // Total range: 0.30 (in shadow) to 0.92 (fully lit)
    const ambientLight = 0.30;
    const diffuseStrength = 0.62;
    const lightingFactor = NdotL.mul(diffuseStrength).add(ambientLight);
    
    // Apply lighting to terrain color for natural appearance
    // Brightness boost: slightly above 1.0 to increase overall terrain brightness
    const brightnessBoost = 1.15;
    finalColor = vec4(finalColor.rgb.mul(lightingFactor).mul(brightnessBoost), finalColor.a);

    // Apply contrast enhancement for more vivid, natural terrain appearance
    // Formula: (color - 0.5) * contrast + 0.5, clamped to [0,1]
    const TERRAIN_CONTRAST = 1.08;
    const contrastedColor = finalColor.rgb.sub(0.5).mul(TERRAIN_CONTRAST).add(0.5).clamp(0.0, 1.0);
    finalColor = vec4(contrastedColor, finalColor.a);

    // Apply saturation boost for more vivid, natural terrain colours
    const TERRAIN_SATURATION = 1.08;
    const lumWeights = vec3(0.2126, 0.7152, 0.0722);
    const lumValue = finalColor.rgb.dot(lumWeights);
    const saturatedColor = vec3(lumValue).mix(finalColor.rgb, TERRAIN_SATURATION).clamp(0.0, 1.0);
    finalColor = vec4(saturatedColor, finalColor.a);

    // =========================================================================
    // HEXAGONAL EDGE HIGHLIGHTING (Civ 6 Style)
    // =========================================================================
    // Apply subtle darkening at hex edges to create visible hex tile boundaries
    // This gives the distinctive Civilization 6 hexagonal map appearance
    const hexEdgeColor = vec3(HEX_EDGE_COLOR_R, HEX_EDGE_COLOR_G, HEX_EDGE_COLOR_B);
    
    // Blend hex edge color with terrain based on edge mask
    // The edge mask is strongest at hex boundaries and fades toward center
    const hexEdgeBlend = hexEdgeMask.mul(HEX_EDGE_BLEND_STRENGTH);
    finalColor = vec4(finalColor.rgb.mix(hexEdgeColor, hexEdgeBlend), finalColor.a);

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
    
    // =========================================================================
    // SOFT EDGES BETWEEN UNKNOWN AND KNOWN TILES
    // =========================================================================
    // Sample visibility from neighboring hex tiles to create soft blending
    // at the boundary between unknown (black) tiles and known/visible tiles.
    // This creates a gradual fade rather than a hard edge.
    
    // Calculate neighbor sampling offsets (in UV space)
    const neighborOffsetX = float(1.0).div(map_x_size);
    const neighborOffsetY = float(1.0).div(map_y_size);
    
    // Sample 6 hex neighbors' visibility for edge softening
    // We sample at offsets corresponding to hex neighbor directions
    const neighborUV_E = vec2(tileCenterUV.x.add(neighborOffsetX), tileCenterUV.y);
    const neighborUV_W = vec2(tileCenterUV.x.sub(neighborOffsetX), tileCenterUV.y);
    const neighborUV_NE = vec2(tileCenterUV.x.add(neighborOffsetX.mul(0.5)), tileCenterUV.y.add(neighborOffsetY));
    const neighborUV_NW = vec2(tileCenterUV.x.sub(neighborOffsetX.mul(0.5)), tileCenterUV.y.add(neighborOffsetY));
    const neighborUV_SE = vec2(tileCenterUV.x.add(neighborOffsetX.mul(0.5)), tileCenterUV.y.sub(neighborOffsetY));
    const neighborUV_SW = vec2(tileCenterUV.x.sub(neighborOffsetX.mul(0.5)), tileCenterUV.y.sub(neighborOffsetY));
    
    // Sample neighbor visibilities
    const visE = texture(maptilesTex, neighborUV_E).a;
    const visW = texture(maptilesTex, neighborUV_W).a;
    const visNE = texture(maptilesTex, neighborUV_NE).a;
    const visNW = texture(maptilesTex, neighborUV_NW).a;
    const visSE = texture(maptilesTex, neighborUV_SE).a;
    const visSW = texture(maptilesTex, neighborUV_SW).a;
    
    // Calculate average neighbor visibility
    const avgNeighborVis = visE.add(visW).add(visNE).add(visNW).add(visSE).add(visSW).mul(1.0 / 6.0);
    
    // Create soft edge factor based on distance from hex center
    // At hex edges, blend with neighbor visibility for softer transitions
    // hexDist is the distance to hex edge (0 at center, 0.5 at edge)
    const edgeProximity = hexDist.sub(0.3).mul(5.0).clamp(0.0, 1.0);  // 0 at center, 1 near edge
    
    // Blend current tile visibility with neighbor average at edges
    // This creates soft transitions at boundaries between unknown and known tiles
    const softVisibility = hexVisibility.mix(avgNeighborVis, edgeProximity.mul(0.4));
    
    // Apply smoothstep curve for softer edges within the visible/fogged regions using THREE's smoothstep().
    // smoothstep(0, 1, t) = t² × (3 - 2t) — an S-curve that eases in and out.
    const visSmooth = smoothstep(0.0, 1.0, softVisibility.mul(VISIBILITY_VISIBLE).clamp(0.0, 1.0));
    
    // Scale back to original range to maintain brightness levels
    const smoothVisibility = visSmooth.mul(VISIBILITY_VISIBLE);
    
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
    let effectiveVisibility = smoothVisibility.min(vertexVisibility);
    
    // If terrain type is known (terrainHere > 0), the tile is at least known (not unknown).
    // Ensure minimum visibility of VISIBILITY_FOGGED for known terrain.
    const isKnownTerrain = step(0.5, terrainHere);
    effectiveVisibility = effectiveVisibility.max(isKnownTerrain.mul(VISIBILITY_FOGGED));
    
    // Apply the visibility to the terrain color
    finalColor = vec4(finalColor.rgb.mul(effectiveVisibility), finalColor.a);

    // =========================================================================
    // NATION BORDERS WITH HEX-EDGE-ALIGNED DASHED BORDER LINES
    // =========================================================================
    // Border lines follow the actual hexagonal edges using the hex SDF face
    // classification computed above (dist1, dist2, dist3 and their signs).
    // Each of the 6 hex faces is mapped to the corresponding hex neighbor direction.

    const BORDER_COLOR_DIFF_THRESHOLD = 0.05;  // Minimum RGB difference to detect nation boundary

    // Dashed line constants - fewer, clearer dashes along each hex edge
    const DASH_FREQUENCY = 6.0;   // Dashes per hex edge
    const DASH_RATIO = 0.55;      // 55 % dash, 45 % gap for visible contrast

    // Sample border color for current tile and all 6 hex neighbours
    const currentBorder = texture(bordersTex, tileCenterUV);
    const borderE  = texture(bordersTex, neighborUV_E);
    const borderW  = texture(bordersTex, neighborUV_W);
    const borderNE = texture(bordersTex, neighborUV_NE);
    const borderNW = texture(bordersTex, neighborUV_NW);
    const borderSE = texture(bordersTex, neighborUV_SE);
    const borderSW = texture(bordersTex, neighborUV_SW);

    // Check if this tile has a border (non-zero alpha)
    const hasBorder = step(0.1, currentBorder.a);

    // Detect nation boundaries: 1.0 when neighbour belongs to a different nation
    // Use method chaining for the colour-difference sum; free step() for clear edge/x ordering
    const isEdgeE  = step(BORDER_COLOR_DIFF_THRESHOLD, currentBorder.r.sub(borderE.r).abs().add(currentBorder.g.sub(borderE.g).abs()).add(currentBorder.b.sub(borderE.b).abs()));
    const isEdgeW  = step(BORDER_COLOR_DIFF_THRESHOLD, currentBorder.r.sub(borderW.r).abs().add(currentBorder.g.sub(borderW.g).abs()).add(currentBorder.b.sub(borderW.b).abs()));
    const isEdgeNE = step(BORDER_COLOR_DIFF_THRESHOLD, currentBorder.r.sub(borderNE.r).abs().add(currentBorder.g.sub(borderNE.g).abs()).add(currentBorder.b.sub(borderNE.b).abs()));
    const isEdgeNW = step(BORDER_COLOR_DIFF_THRESHOLD, currentBorder.r.sub(borderNW.r).abs().add(currentBorder.g.sub(borderNW.g).abs()).add(currentBorder.b.sub(borderNW.b).abs()));
    const isEdgeSE = step(BORDER_COLOR_DIFF_THRESHOLD, currentBorder.r.sub(borderSE.r).abs().add(currentBorder.g.sub(borderSE.g).abs()).add(currentBorder.b.sub(borderSE.b).abs()));
    const isEdgeSW = step(BORDER_COLOR_DIFF_THRESHOLD, currentBorder.r.sub(borderSW.r).abs().add(currentBorder.g.sub(borderSW.g).abs()).add(currentBorder.b.sub(borderSW.b).abs()));

    // -----------------------------------------------------------------------
    // HEX FACE CLASSIFICATION via signed SDF distances
    // dist1 = |hexX|            → left (W) / right (E) vertical edges
    // dist2 = |hexX*0.5 + hexY*0.866| → upper-right (NE) / lower-left (SW)
    // dist3 = |-hexX*0.5 + hexY*0.866| → upper-left (NW) / lower-right (SE)
    // The dominant distance determines which hex face the pixel lies on.
    // -----------------------------------------------------------------------
    // Signed (pre-abs) distances – used to distinguish the two faces in each pair
    const d2Signed = hexX.mul(0.5).add(hexY.mul(HEX_SQRT3_OVER_2));   // >0 = NE, <0 = SW
    const d3Signed = hexX.mul(-0.5).add(hexY.mul(HEX_SQRT3_OVER_2));  // >0 = NW, <0 = SE

    // Classify which of the three distance pairs is dominant (max)
    const dist1Dom = step(dist2, dist1).mul(step(dist3, dist1));  // dist1 >= dist2 AND dist1 >= dist3
    const dist2Dom = step(dist1, dist2).mul(step(dist3, dist2));  // dist2 >= dist1 AND dist2 >= dist3
    const dist3Dom = step(dist1, dist3).mul(step(dist2, dist3));  // dist3 >= dist1 AND dist3 >= dist2

    // Map to one of the 6 hex faces using dominant distance + sign
    const onEFace  = dist1Dom.mul(step(0.0, hexX));                               // right vertical edge
    const onWFace  = dist1Dom.mul(float(1.0).sub(step(0.0, hexX)));               // left vertical edge
    const onNEFace = dist2Dom.mul(step(0.0, d2Signed));                           // upper-right diagonal
    const onSWFace = dist2Dom.mul(float(1.0).sub(step(0.0, d2Signed)));           // lower-left diagonal
    const onNWFace = dist3Dom.mul(step(0.0, d3Signed));                           // upper-left diagonal
    const onSEFace = dist3Dom.mul(float(1.0).sub(step(0.0, d3Signed)));           // lower-right diagonal

    // -----------------------------------------------------------------------
    // NARROW BORDER LINE MASK at the hex edge (tighter than hexEdgeMask)
    // -----------------------------------------------------------------------
    const BORDER_LINE_WIDTH = 0.04;  // Border line width as fraction of hex inradius
    const borderEdgeStart = float(hexInradius).sub(BORDER_LINE_WIDTH);
    // Use THREE's smoothstep() for cleaner, hardware-accelerated S-curve computation
    const hexBorderMask = smoothstep(borderEdgeStart, hexInradius, hexDist);

    // -----------------------------------------------------------------------
    // DASH PATTERNS aligned with each hex edge direction
    // E/W vertical edges  → dashes vary along Y
    // NE/SW diagonal edges → dashes vary along the NE-SW tangent direction
    // NW/SE diagonal edges → dashes vary along the NW-SE tangent direction
    // -----------------------------------------------------------------------
    const dashVertical = step(localY.mul(DASH_FREQUENCY).fract(), DASH_RATIO);
    const dashNESW = step(localX.mul(-HEX_SQRT3_OVER_2).add(localY.mul(0.5)).mul(DASH_FREQUENCY).fract(), DASH_RATIO);
    const dashNWSE = step(localX.mul(HEX_SQRT3_OVER_2).add(localY.mul(0.5)).mul(DASH_FREQUENCY).fract(), DASH_RATIO);

    // -----------------------------------------------------------------------
    // COMBINE – border line appears where: correct face + border line mask + nation boundary + dash
    // -----------------------------------------------------------------------
    const borderFactorE  = isEdgeE.mul(onEFace).mul(hexBorderMask.mul(dashVertical));
    const borderFactorW  = isEdgeW.mul(onWFace).mul(hexBorderMask.mul(dashVertical));
    const borderFactorNE = isEdgeNE.mul(onNEFace).mul(hexBorderMask.mul(dashNESW));
    const borderFactorSW = isEdgeSW.mul(onSWFace).mul(hexBorderMask.mul(dashNESW));
    const borderFactorNW = isEdgeNW.mul(onNWFace).mul(hexBorderMask.mul(dashNWSE));
    const borderFactorSE = isEdgeSE.mul(onSEFace).mul(hexBorderMask.mul(dashNWSE));

    const hexBorderLineFactor = borderFactorE.max(borderFactorW).max(borderFactorNE).max(borderFactorSW).max(borderFactorNW).max(borderFactorSE);

    // Border line intensity – brighter and more opaque for clear visibility
    const borderLineIntensity = 0.65;

    // Brighten nation colour for the border line using method chaining
    const brightenedBorderColor = vec3(
        currentBorder.r.add(0.3).min(1.0),
        currentBorder.g.add(0.3).min(1.0),
        currentBorder.b.add(0.3).min(1.0)
    );

    // Apply border line where borders are visible and at nation edges
    const shouldShowBorderLine = borders_visible.select(1.0, 0.0).mul(hasBorder).mul(hexBorderLineFactor);
    finalColor = vec4(finalColor.rgb.mix(brightenedBorderColor, shouldShowBorderLine.mul(borderLineIntensity)), finalColor.a);

    // Subtle territory fill tint
    const shouldShowBorderFill = borders_visible.select(1.0, 0.0).mul(hasBorder);
    finalColor = vec4(finalColor.rgb.mix(currentBorder.rgb, shouldShowBorderFill.mul(0.05)), finalColor.a);

    // =========================================================================
    // SELECTED TILE HIGHLIGHTING
    // =========================================================================
    // Highlight the currently selected tile based on selected_x and selected_y uniforms
    // A value of -1 indicates no selection, otherwise the tile at (selected_x, selected_y) is highlighted
    const hasSelection = selected_x.greaterThanEqual(0.0).and(selected_y.greaterThanEqual(0.0));
    // Use epsilon-based comparison (0.5) for float precision tolerance
    // tileX/tileY are floored floats (e.g., 5.0), selected_x/selected_y are uniform integers (e.g., 5)
    const xMatch = tileX.sub(selected_x).abs().lessThan(0.5);
    const yMatch = tileY.sub(selected_y).abs().lessThan(0.5);
    const isSelectedTile = xMatch.and(yMatch);
    const shouldHighlightTile = hasSelection.and(isSelectedTile);
    
    // Selection highlight color (golden/yellow tint for visibility)
    const SELECTION_HIGHLIGHT_COLOR = vec3(1.0, 0.9, 0.5);
    const SELECTION_EDGE_INTENSITY = 0.8;  // Strong edge highlight
    const SELECTION_FILL_INTENSITY = 0.15; // Subtle fill highlight
    
    // Calculate selection visibility factor (1.0 if selected, 0.0 if not)
    const selectionActive = shouldHighlightTile.select(1.0, 0.0);
    
    // Apply edge highlighting on selected tile (using hexEdgeMask for edge detection)
    finalColor = vec4(finalColor.rgb.mix(SELECTION_HIGHLIGHT_COLOR, selectionActive.mul(hexEdgeMask).mul(SELECTION_EDGE_INTENSITY)), finalColor.a);
    
    // Apply subtle fill highlighting to the entire selected tile
    finalColor = vec4(finalColor.rgb.mix(SELECTION_HIGHLIGHT_COLOR, selectionActive.mul(SELECTION_FILL_INTENSITY)), finalColor.a);

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
