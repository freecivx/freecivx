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
 * WebGPU Terrain Shader for Square Map Tiles using Three.js Shading Language (TSL)
 * 
 * This shader implements terrain rendering for square-tile Freeciv maps using
 * Three.js Node System which compiles to WGSL for WebGPU.
 * 
 * Features:
 * - Square tile rendering (classic Civ style) - each map tile is a square
 * - Multi-terrain type support with automatic blending
 * - Terrain edge blending at tile borders (smooth transitions between different terrain types)
 * - Beach/coast transitions based on elevation
 * - Roads and railroads rendering using procedural SDF (Signed Distance Fields)
 * - Irrigation and farmland visual indicators
 * - Nation border rendering with distinct colored edge lines
 * - Soft edges between unknown and known map tiles
 * - Square edge grid lines for visual clarity
 * - Vertex color-based fog/visibility
 * - Slope-based brightness with sun direction lighting
 */

function createTerrainShaderSquareTSL(uniforms) {
    // Import TSL functions and nodes from THREE
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
    const BEACH_HIGH = 52.5;
    const BEACH_BLEND_HIGH = 50.4;
    const BEACH_MID = 51.5;
    const WATER_LEVEL = 50.0;
    
    // Beach sand colour (warm golden sand)
    const BEACH_SAND_COLOR = { r: 0.92, g: 0.85, b: 0.65 };
    
    // Precomputed beach zone ranges
    const BEACH_LOWER_RANGE = BEACH_MID - BEACH_BLEND_HIGH;
    const BEACH_UPPER_RANGE = BEACH_HIGH - BEACH_MID;

    // =========================================================================
    // SQUARE TILE CONSTANTS (from SquareConfig in config.js)
    // =========================================================================
    // Using centralized configuration for consistency and maintainability
    const squareConfig = window.SquareConfig || {
        EDGE_WIDTH: 0.018,
        EDGE_BLEND_STRENGTH: 0.12,
        EDGE_COLOR: { r: 0.15, g: 0.12, b: 0.08 },
        TEXTURE_RANDOM_SCALE: 16.0
    };
    
    const TILE_EDGE_WIDTH = squareConfig.EDGE_WIDTH;
    const TILE_EDGE_BLEND_STRENGTH = squareConfig.EDGE_BLEND_STRENGTH;
    const TILE_EDGE_COLOR_R = squareConfig.EDGE_COLOR.r;
    const TILE_EDGE_COLOR_G = squareConfig.EDGE_COLOR.g;
    const TILE_EDGE_COLOR_B = squareConfig.EDGE_COLOR.b;
    const TEXTURE_RANDOM_SCALE = squareConfig.TEXTURE_RANDOM_SCALE;

    // Visibility constants
    const VISIBILITY_UNKNOWN = 0.0;
    const VISIBILITY_FOGGED = 0.54;
    const VISIBILITY_VISIBLE = 1.06;

    // Create texture references
    const maptilesTex = uniforms.maptiles.value;
    const bordersTex = uniforms.borders.value;
    const roadsmapTex = uniforms.roadsmap.value;
    const roadspritesTex = uniforms.roadsprites.value;
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
    // Road/railroad sprites are stored in DataArrayTexture (texture_2d_array) with 16 layers
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

    // Access vertex color for fog of war
    const vertColor = attribute('vertColor');

    // =========================================================================
    // SQUARE TILE COORDINATE SYSTEM
    // =========================================================================
    // Square tiles are simpler - no staggering needed
    // Calculate which tile we're in
    const tileYRaw = mul(map_y_size, uvNode.y);
    const tileY = floor(tileYRaw);
    
    const tileXRaw = mul(map_x_size, uvNode.x);
    const tileX = floor(tileXRaw);
    
    // Local position within the current tile (0 to 1 range)
    const localX = fract(tileXRaw);
    const localY = fract(tileYRaw);

    // =========================================================================
    // SQUARE TILE EDGE GRID LINES
    // =========================================================================
    // Create grid lines at tile edges for visual clarity
    // Check if we're near the edge of the tile
    const nearLeftEdge = step(localX, TILE_EDGE_WIDTH);
    const nearBottomEdge = step(localY, TILE_EDGE_WIDTH);
    
    // Combine to create grid line mask (1 at edges, 0 elsewhere)
    const gridLineMask = max(nearLeftEdge, nearBottomEdge);
    
    // =========================================================================
    // TERRAIN SAMPLING AT TILE CENTER
    // =========================================================================
    const tileCenterU = div(add(tileX, 0.5), map_x_size);
    const tileCenterV = div(add(tileY, 0.5), map_y_size);
    const tileCenterUV = vec2(tileCenterU, tileCenterV);
    
    // Add pseudo-random texture offset for visual variety
    const rndSeed = dot(tileCenterUV, vec2(12.98, 78.233));
    const rnd = fract(mul(sin(rndSeed), 43758.5453));
    const rndOffset = mul(sub(rnd, 0.5), div(1.0, mul(TEXTURE_RANDOM_SCALE, vec2(map_x_size, map_y_size))));
    const sampledUV = add(tileCenterUV, rndOffset);

    // Sample terrain type
    const terrainType = texture(maptilesTex, sampledUV);

    // Texture coordinates for terrain detail
    const dx = localX;
    const dy = localY;

    // Extract terrain type value
    const terrainHere = floor(mul(terrainType.r, 256.0));
    const posY = posNode.y;

    // Texture coordinate node
    const texCoord = vec2(dx, dy);

    // Beach sand colour as vec3
    const beachSandColor = vec3(BEACH_SAND_COLOR.r, BEACH_SAND_COLOR.g, BEACH_SAND_COLOR.b);

    // =========================================================================
    // NEIGHBOR TERRAIN SAMPLING FOR EDGE BLENDING
    // =========================================================================
    // Sample terrain types from 4 neighboring tiles (N, E, S, W)
    const terrainOffsetX = div(1.0, map_x_size);
    const terrainOffsetY = div(1.0, map_y_size);
    
    const neighborTerrainUV_E = vec2(add(tileCenterUV.x, terrainOffsetX), tileCenterUV.y);
    const neighborTerrainUV_W = vec2(sub(tileCenterUV.x, terrainOffsetX), tileCenterUV.y);
    const neighborTerrainUV_N = vec2(tileCenterUV.x, add(tileCenterUV.y, terrainOffsetY));
    const neighborTerrainUV_S = vec2(tileCenterUV.x, sub(tileCenterUV.y, terrainOffsetY));
    
    const terrainTypeE = texture(maptilesTex, neighborTerrainUV_E);
    const terrainTypeW = texture(maptilesTex, neighborTerrainUV_W);
    const terrainTypeN = texture(maptilesTex, neighborTerrainUV_N);
    const terrainTypeS = texture(maptilesTex, neighborTerrainUV_S);
    
    const terrainE = floor(mul(terrainTypeE.r, 256.0));
    const terrainW = floor(mul(terrainTypeW.r, 256.0));
    const terrainN = floor(mul(terrainTypeN.r, 256.0));
    const terrainS = floor(mul(terrainTypeS.r, 256.0));

    // =========================================================================
    // TERRAIN EDGE BLENDING PARAMETERS
    // =========================================================================
    // Edge blend zone: how far from tile edge the blending starts (0-0.5 range)
    const TERRAIN_BLEND_WIDTH = 0.35;
    // Blend strength: how much to blend neighbor terrain (0-1)
    const TERRAIN_BLEND_STRENGTH = 0.5;

    /**
     * Helper function to apply smooth step interpolation: t * t * (3 - 2*t)
     * This creates a smoother transition than linear interpolation
     */
    function smoothStep(t) {
        return mul(mul(t, t), sub(3.0, mul(2.0, t)));
    }
    
    /**
     * Helper function to compute terrain color with optional beach blending
     * Used by both createTerrainLayer and getTerrainColorForType to share logic
     */
    function computeTerrainColor(layerIndex, coord, blendWithBeach) {
        if (blendWithBeach) {
            const baseTerrainColor = texture(terrainAtlasTex, coord).depth(int(layerIndex));
            const aboveWater = step(WATER_LEVEL, posY);
            const lowerBeachT = mul(
                clamp(div(sub(posY, BEACH_BLEND_HIGH), BEACH_LOWER_RANGE), 0.0, 1.0),
                aboveWater
            );
            const upperBeachT = clamp(
                div(sub(posY, BEACH_MID), BEACH_UPPER_RANGE),
                0.0, 1.0
            );
            const coastTex = texture(terrainAtlasTex, coord).depth(int(TERRAIN_ATLAS_COAST));
            const lowerBlend = mix(coastTex, vec4(beachSandColor, 1.0), lowerBeachT);
            return mix(lowerBlend, baseTerrainColor, upperBeachT);
        } else {
            return texture(terrainAtlasTex, coord).depth(int(layerIndex));
        }
    }

    /**
     * Helper function to create terrain selection and blending logic
     */
    function createTerrainLayer(terrainValue, layerIndex, coord, blendWithBeach = true) {
        const step1 = step(terrainValue - 0.5, terrainHere);
        const step2 = step(terrainHere, terrainValue + 0.5);
        const isTerrain = mul(step1, step2);
        const terrainColor = computeTerrainColor(layerIndex, coord, blendWithBeach);
        return { mask: isTerrain, color: terrainColor };
    }
    
    /**
     * Helper function to create terrain layer from terrain_layers DataArrayTexture
     */
    function createTerrainLayerFromArray(terrainValue, layerIndex, coord) {
        const step1 = step(terrainValue - 0.5, terrainHere);
        const step2 = step(terrainHere, terrainValue + 0.5);
        const isTerrain = mul(step1, step2);
        const terrainColor = texture(terrainLayersTex, coord).depth(int(layerIndex));
        return { mask: isTerrain, color: terrainColor };
    }
    
    /**
     * Helper function to get terrain color for a given terrain type value
     * This is used for neighbor terrain blending
     */
    function getTerrainColorForType(tType, coord) {
        // Start with black (unknown terrain)
        let color = vec4(0, 0, 0, 1);
        
        // Helper to check if terrain matches and return color
        function matchTerrain(terrainValue, layerIndex, useCoord, blendWithBeach) {
            const step1 = step(terrainValue - 0.5, tType);
            const step2 = step(tType, terrainValue + 0.5);
            const isTerrain = mul(step1, step2);
            const terrainColor = computeTerrainColor(layerIndex, useCoord, blendWithBeach);
            return { mask: isTerrain, color: terrainColor };
        }
        
        // Helper to check terrain from array texture
        function matchTerrainFromArray(terrainValue, layerIndex, useCoord) {
            const step1 = step(terrainValue - 0.5, tType);
            const step2 = step(tType, terrainValue + 0.5);
            const isTerrain = mul(step1, step2);
            const terrainColor = texture(terrainLayersTex, useCoord).depth(int(layerIndex));
            return { mask: isTerrain, color: terrainColor };
        }
        
        // Match each terrain type
        const layersList = [
            matchTerrain(TERRAIN_GRASSLAND, TERRAIN_ATLAS_GRASSLAND, coord, true),
            matchTerrain(TERRAIN_PLAINS, TERRAIN_ATLAS_PLAINS, coord, true),
            matchTerrain(TERRAIN_DESERT, TERRAIN_ATLAS_DESERT, coord, true),
            matchTerrain(TERRAIN_HILLS, TERRAIN_ATLAS_HILLS, coord, true),
            matchTerrain(TERRAIN_MOUNTAINS, TERRAIN_ATLAS_MOUNTAINS, coord, true),
            matchTerrain(TERRAIN_SWAMP, TERRAIN_ATLAS_SWAMP, coord, true),
            matchTerrain(TERRAIN_FOREST, TERRAIN_ATLAS_FOREST, coord, true),
            matchTerrain(TERRAIN_JUNGLE, TERRAIN_ATLAS_JUNGLE, coord, true),
            matchTerrain(TERRAIN_COAST, TERRAIN_ATLAS_COAST, coord, false),
            matchTerrain(TERRAIN_FLOOR, TERRAIN_ATLAS_OCEAN, coord, false),
            matchTerrain(TERRAIN_LAKE, TERRAIN_ATLAS_COAST, coord, false),
            matchTerrainFromArray(TERRAIN_ARCTIC, TERRAIN_LAYER_ARCTIC, coord),
            matchTerrainFromArray(TERRAIN_TUNDRA, TERRAIN_LAYER_TUNDRA, coord)
        ];
        
        // Combine all terrain layers
        for (const layer of layersList) {
            color = mix(color, layer.color, layer.mask);
        }
        
        return color;
    }

    // Build terrain layers for current tile
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
        createTerrainLayer(TERRAIN_LAKE, TERRAIN_ATLAS_COAST, texCoord, false),
        createTerrainLayerFromArray(TERRAIN_ARCTIC, TERRAIN_LAYER_ARCTIC, texCoord),
        createTerrainLayerFromArray(TERRAIN_TUNDRA, TERRAIN_LAYER_TUNDRA, texCoord)
    ];

    // Combine all terrain layers for current tile
    let finalColor = vec4(0, 0, 0, 1);
    for (const layer of layers) {
        finalColor = mix(finalColor, layer.color, layer.mask);
    }
    
    // =========================================================================
    // TERRAIN EDGE BLENDING (blend terrain textures at tile borders)
    // =========================================================================
    // Get terrain colors for neighboring tiles
    const colorE = getTerrainColorForType(terrainE, texCoord);
    const colorW = getTerrainColorForType(terrainW, texCoord);
    const colorN = getTerrainColorForType(terrainN, texCoord);
    const colorS = getTerrainColorForType(terrainS, texCoord);
    
    // Calculate edge proximity factors (1.0 at edge, 0.0 at center)
    // East edge: localX close to 1.0
    const eastEdgeProximity = clamp(div(sub(localX, sub(1.0, TERRAIN_BLEND_WIDTH)), TERRAIN_BLEND_WIDTH), 0.0, 1.0);
    // West edge: localX close to 0.0
    const westEdgeProximity = clamp(div(sub(TERRAIN_BLEND_WIDTH, localX), TERRAIN_BLEND_WIDTH), 0.0, 1.0);
    // North edge: localY close to 1.0
    const northEdgeProximity = clamp(div(sub(localY, sub(1.0, TERRAIN_BLEND_WIDTH)), TERRAIN_BLEND_WIDTH), 0.0, 1.0);
    // South edge: localY close to 0.0
    const southEdgeProximity = clamp(div(sub(TERRAIN_BLEND_WIDTH, localY), TERRAIN_BLEND_WIDTH), 0.0, 1.0);
    
    // Apply smooth step for more natural blending transition
    const eastBlend = smoothStep(eastEdgeProximity);
    const westBlend = smoothStep(westEdgeProximity);
    const northBlend = smoothStep(northEdgeProximity);
    const southBlend = smoothStep(southEdgeProximity);
    
    // Scale by blend strength
    const eastFactor = mul(eastBlend, TERRAIN_BLEND_STRENGTH);
    const westFactor = mul(westBlend, TERRAIN_BLEND_STRENGTH);
    const northFactor = mul(northBlend, TERRAIN_BLEND_STRENGTH);
    const southFactor = mul(southBlend, TERRAIN_BLEND_STRENGTH);
    
    // Blend neighbor terrain colors into final color
    // Only blend if neighbor terrain is different (non-zero terrain type)
    const hasTerrainE = step(0.5, terrainE);
    const hasTerrainW = step(0.5, terrainW);
    const hasTerrainN = step(0.5, terrainN);
    const hasTerrainS = step(0.5, terrainS);
    
    finalColor = mix(finalColor, colorE, mul(eastFactor, hasTerrainE));
    finalColor = mix(finalColor, colorW, mul(westFactor, hasTerrainW));
    finalColor = mix(finalColor, colorN, mul(northFactor, hasTerrainN));
    finalColor = mix(finalColor, colorS, mul(southFactor, hasTerrainS));

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
    // ROADS AND RAILROADS RENDERING (Procedural SDF-based)
    // =========================================================================
    const roadData = texture(roadsmapTex, tileCenterUV);
    const roadIndex = floor(mul(roadData.r, 256.0));
    
    const hasRoad = mul(step(0.5, roadIndex), step(roadIndex, 9.5));
    const hasRoadJunction = mul(step(41.5, roadIndex), step(roadIndex, 42.5));
    const hasRailroad = mul(step(9.5, roadIndex), step(roadIndex, 19.5));
    const hasRailJunction = mul(step(42.5, roadIndex), step(roadIndex, 43.5));
    
    // Any road or railroad present (for procedural rendering)
    const hasAnyRoad = max(hasRoad, hasRoadJunction);
    const hasAnyRail = max(hasRailroad, hasRailJunction);
    
    // -------------------------------------------------------------------------
    // SDF Helper Functions
    // -------------------------------------------------------------------------
    /**
     * SDF for a circle at position p with radius r
     * Returns: distance to circle edge (negative inside, positive outside)
     */
    function sdCircle(p, r) {
        return sub(p.length(), r);
    }
    
    /**
     * SDF for a box (capsule) from point a to point b with width w
     * Returns: distance to box edge
     */
    function sdBox(p, a, b, w) {
        const pa = sub(p, a);
        const ba = sub(b, a);
        const h = clamp(div(dot(pa, ba), dot(ba, ba)), 0.0, 1.0);
        return sub(sub(pa, mul(ba, h)).length(), w);
    }
    
    // -------------------------------------------------------------------------
    // Decode Road Connectivity from roadIndex
    // -------------------------------------------------------------------------
    // Road indices encoding (from roads.js):
    // DIR8_NORTH=1, DIR8_EAST=4, DIR8_SOUTH=6, DIR8_WEST=3
    // Single tile = 1 (roads) or 10 (railroads)
    // North connection: 2/12, East: 8/18, South: 4/14, West: 6/16
    // Diagonals: NE=3/13, SE=5/15, SW=7/17, NW=9/19
    // 4-way junction: 42 (roads) or 43 (railroads)
    
    const roadIndexForDecoding = hasAnyRail.select(sub(roadIndex, 10.0), roadIndex);
    
    // Decode connections for cardinal directions
    const connectN = roadIndexForDecoding.greaterThanEqual(2.0).and(roadIndexForDecoding.lessThanEqual(2.5))
                     .or(roadIndexForDecoding.greaterThanEqual(32.0)); // junction
    const connectE = roadIndexForDecoding.greaterThanEqual(8.0).and(roadIndexForDecoding.lessThanEqual(8.5))
                     .or(roadIndexForDecoding.greaterThanEqual(32.0)); // junction
    const connectS = roadIndexForDecoding.greaterThanEqual(4.0).and(roadIndexForDecoding.lessThanEqual(4.5))
                     .or(roadIndexForDecoding.greaterThanEqual(32.0)); // junction
    const connectW = roadIndexForDecoding.greaterThanEqual(6.0).and(roadIndexForDecoding.lessThanEqual(6.5))
                     .or(roadIndexForDecoding.greaterThanEqual(32.0)); // junction
    
    // Decode diagonal connections
    const connectNE = roadIndexForDecoding.greaterThanEqual(3.0).and(roadIndexForDecoding.lessThanEqual(3.5));
    const connectSE = roadIndexForDecoding.greaterThanEqual(5.0).and(roadIndexForDecoding.lessThanEqual(5.5));
    const connectSW = roadIndexForDecoding.greaterThanEqual(7.0).and(roadIndexForDecoding.lessThanEqual(7.5));
    const connectNW = roadIndexForDecoding.greaterThanEqual(9.0).and(roadIndexForDecoding.lessThanEqual(9.5));
    
    // -------------------------------------------------------------------------
    // Calculate SDF for Road Shape
    // -------------------------------------------------------------------------
    const roadWidth = 0.08;
    const edgeSoftness = 0.01;
    const hubRadius = 0.06;
    
    // Current position in tile space [0,1]
    const tilePos = vec2(localX, localY);
    const center = vec2(0.5, 0.5);
    
    // Central hub (always present if there's any road/rail)
    const distToHub = sdCircle(sub(tilePos, center), hubRadius);
    
    // Cardinal direction segments
    const northEnd = vec2(0.5, 1.0);
    const southEnd = vec2(0.5, 0.0);
    const eastEnd = vec2(1.0, 0.5);
    const westEnd = vec2(0.0, 0.5);
    
    const distToNorth = sdBox(tilePos, center, northEnd, roadWidth);
    const distToSouth = sdBox(tilePos, center, southEnd, roadWidth);
    const distToEast = sdBox(tilePos, center, eastEnd, roadWidth);
    const distToWest = sdBox(tilePos, center, westEnd, roadWidth);
    
    // Diagonal segments
    const neEnd = vec2(1.0, 1.0);
    const seEnd = vec2(1.0, 0.0);
    const swEnd = vec2(0.0, 0.0);
    const nwEnd = vec2(0.0, 1.0);
    
    const distToNE = sdBox(tilePos, center, neEnd, roadWidth);
    const distToSE = sdBox(tilePos, center, seEnd, roadWidth);
    const distToSW = sdBox(tilePos, center, swEnd, roadWidth);
    const distToNW = sdBox(tilePos, center, nwEnd, roadWidth);
    
    // Union of active segments using min (SDF union operation)
    let distToRoad = distToHub;
    distToRoad = connectN.select(min(distToRoad, distToNorth), distToRoad);
    distToRoad = connectS.select(min(distToRoad, distToSouth), distToRoad);
    distToRoad = connectE.select(min(distToRoad, distToEast), distToRoad);
    distToRoad = connectW.select(min(distToRoad, distToWest), distToRoad);
    distToRoad = connectNE.select(min(distToRoad, distToNE), distToRoad);
    distToRoad = connectSE.select(min(distToRoad, distToSE), distToRoad);
    distToRoad = connectSW.select(min(distToRoad, distToSW), distToRoad);
    distToRoad = connectNW.select(min(distToRoad, distToNW), distToRoad);
    
    // Generate road mask with smooth edges
    const roadMask = clamp(sub(1.0, div(distToRoad, edgeSoftness)), 0.0, 1.0);
    
    // -------------------------------------------------------------------------
    // Road Surface Appearance
    // -------------------------------------------------------------------------
    // Add noise/grunge for realistic appearance
    const noiseScale = 40.0;
    const noiseCoord = mul(add(tilePos, vec2(mul(tileX, 0.5), mul(tileY, 0.5))), noiseScale);
    const noiseValue = fract(mul(sin(dot(noiseCoord, vec2(12.9898, 78.233))), 43758.5453));
    
    // Base road color (asphalt/dirt)
    const roadBaseColor = vec3(0.25, 0.22, 0.18);
    const roadGrungeColor = vec3(0.20, 0.18, 0.15);
    const roadColorWithNoise = mix(roadBaseColor, roadGrungeColor, mul(noiseValue, 0.3));
    
    // -------------------------------------------------------------------------
    // Railroad-Specific Rendering
    // -------------------------------------------------------------------------
    // Only render railroad details if it's a railroad
    const sleeperWidth = 0.015;
    const sleeperSpacing = 0.12;
    
    // Sleepers (ties) - perpendicular to track direction
    // Use distance along the dominant track direction for spacing
    const distAlongN = sub(tilePos.y, 0.5);
    const distAlongS = sub(0.5, tilePos.y);
    const distAlongE = sub(tilePos.x, 0.5);
    const distAlongW = sub(0.5, tilePos.x);
    
    // Calculate sleeper pattern based on distance along path
    // Weight by connection direction to get proper alignment
    // Convert boolean connections to float (1.0 or 0.0) for multiplication
    let distAlong = mul(connectN.select(1.0, 0.0), abs(distAlongN));
    distAlong = add(distAlong, mul(connectS.select(1.0, 0.0), abs(distAlongS)));
    distAlong = add(distAlong, mul(connectE.select(1.0, 0.0), abs(distAlongE)));
    distAlong = add(distAlong, mul(connectW.select(1.0, 0.0), abs(distAlongW)));
    
    const sleeperPattern = step(mod(distAlong, sleeperSpacing), sleeperWidth);
    
    // Railroad colors
    const railMetalColor = vec3(0.45, 0.45, 0.48);  // Metallic grey
    const sleeperWoodColor = vec3(0.20, 0.15, 0.10);  // Dark wood
    
    // Mix rail metal and sleeper wood based on pattern for railroads
    // Use road color for regular roads
    const railColor = mix(railMetalColor, sleeperWoodColor, sleeperPattern);
    const finalRoadColor = hasAnyRail.select(railColor, roadColorWithNoise);
    
    // -------------------------------------------------------------------------
    // Blend Roads/Railroads onto Terrain
    // -------------------------------------------------------------------------
    const activeRoadMask = mul(max(hasAnyRoad, hasAnyRail), roadMask);
    
    finalColor = vec4(
        mix(finalColor.rgb, finalRoadColor, mul(activeRoadMask, 0.9)),
        finalColor.a
    );

    // =========================================================================
    // SLOPE-BASED LIGHTING
    // =========================================================================
    const sunDir = vec3(0.503, 0.704, 0.503);
    const normal = normalLocal;
    const NdotL = max(dot(normal, sunDir), 0.0);
    
    // Ambient light increased by 10%: 0.22 * 1.10 = 0.242
    const ambientLight = 0.242;
    const diffuseStrength = 0.53;
    const lightingFactor = add(ambientLight, mul(NdotL, diffuseStrength));
    
    // Brightness boost of 1.232 (1.12 * 1.10) provides 10% increase in terrain brightness
    const brightnessBoost = 1.232;
    finalColor = vec4(mul(mul(finalColor.rgb, lightingFactor), brightnessBoost), finalColor.a);

    // =========================================================================
    // SQUARE TILE GRID LINES
    // =========================================================================
    const tileEdgeColor = vec3(TILE_EDGE_COLOR_R, TILE_EDGE_COLOR_G, TILE_EDGE_COLOR_B);
    const gridEdgeBlend = mul(gridLineMask, TILE_EDGE_BLEND_STRENGTH);
    finalColor = vec4(
        mix(finalColor.rgb, tileEdgeColor, gridEdgeBlend),
        finalColor.a
    );

    // =========================================================================
    // VISIBILITY BLENDING
    // =========================================================================
    const tileVisibilityTex = texture(maptilesTex, tileCenterUV);
    const tileVisibility = tileVisibilityTex.a;
    const tileVisibilityScaled = mul(tileVisibility, VISIBILITY_VISIBLE);
    
    // Sample 4 neighbors for square tiles (N, E, S, W)
    const neighborOffsetX = div(1.0, map_x_size);
    const neighborOffsetY = div(1.0, map_y_size);
    
    const neighborUV_E = vec2(add(tileCenterUV.x, neighborOffsetX), tileCenterUV.y);
    const neighborUV_W = vec2(sub(tileCenterUV.x, neighborOffsetX), tileCenterUV.y);
    const neighborUV_N = vec2(tileCenterUV.x, add(tileCenterUV.y, neighborOffsetY));
    const neighborUV_S = vec2(tileCenterUV.x, sub(tileCenterUV.y, neighborOffsetY));
    
    const visE = texture(maptilesTex, neighborUV_E).a;
    const visW = texture(maptilesTex, neighborUV_W).a;
    const visN = texture(maptilesTex, neighborUV_N).a;
    const visS = texture(maptilesTex, neighborUV_S).a;
    
    const avgNeighborVis = mul(add(add(add(visE, visW), visN), visS), 0.25);
    
    // Edge proximity for soft blending (distance from center)
    const distFromCenter = max(abs(sub(localX, 0.5)), abs(sub(localY, 0.5)));
    const edgeProximity = clamp(mul(sub(distFromCenter, 0.3), 5.0), 0.0, 1.0);
    
    const softVisibility = mix(tileVisibility, avgNeighborVis, mul(edgeProximity, 0.4));
    const softVisibilityScaled = mul(softVisibility, VISIBILITY_VISIBLE);
    
    const visNormalized = clamp(div(softVisibilityScaled, VISIBILITY_VISIBLE), 0.0, 1.0);
    const visSmooth = smoothStep(visNormalized);
    const smoothVisibility = mul(visSmooth, VISIBILITY_VISIBLE);
    
    // Active city highlighting
    const vertexVisibility = vertColor.x;
    let effectiveVisibility = min(smoothVisibility, vertexVisibility);
    
    const isKnownTerrain = step(0.5, terrainHere);
    effectiveVisibility = max(effectiveVisibility, mul(isKnownTerrain, VISIBILITY_FOGGED));
    
    finalColor = vec4(mul(finalColor.rgb, effectiveVisibility), finalColor.a);

    // =========================================================================
    // NATION BORDERS
    // =========================================================================
    const BORDER_EDGE_THRESHOLD_POS = 0.88;
    const BORDER_EDGE_WIDTH_POS = 0.12;
    const BORDER_EDGE_SHARPNESS = 12.0;
    const BORDER_COLOR_DIFF_THRESHOLD = 0.05;
    const DASH_FREQUENCY = 8.0;
    const DASH_RATIO = 0.6;
    
    const currentBorder = texture(bordersTex, tileCenterUV);
    const borderE = texture(bordersTex, neighborUV_E);
    const borderW = texture(bordersTex, neighborUV_W);
    const borderN = texture(bordersTex, neighborUV_N);
    const borderS = texture(bordersTex, neighborUV_S);
    
    const hasBorder = step(0.1, currentBorder.a);
    
    // Detect border edges
    const borderDiffE = add(add(abs(sub(currentBorder.r, borderE.r)), abs(sub(currentBorder.g, borderE.g))), abs(sub(currentBorder.b, borderE.b)));
    const borderDiffW = add(add(abs(sub(currentBorder.r, borderW.r)), abs(sub(currentBorder.g, borderW.g))), abs(sub(currentBorder.b, borderW.b)));
    const borderDiffN = add(add(abs(sub(currentBorder.r, borderN.r)), abs(sub(currentBorder.g, borderN.g))), abs(sub(currentBorder.b, borderN.b)));
    const borderDiffS = add(add(abs(sub(currentBorder.r, borderS.r)), abs(sub(currentBorder.g, borderS.g))), abs(sub(currentBorder.b, borderS.b)));
    
    const isEdgeE = step(BORDER_COLOR_DIFF_THRESHOLD, borderDiffE);
    const isEdgeW = step(BORDER_COLOR_DIFF_THRESHOLD, borderDiffW);
    const isEdgeN = step(BORDER_COLOR_DIFF_THRESHOLD, borderDiffN);
    const isEdgeS = step(BORDER_COLOR_DIFF_THRESHOLD, borderDiffS);
    
    // Edge factors
    const eastEdgeFactor = mul(isEdgeE, clamp(mul(sub(localX, BORDER_EDGE_THRESHOLD_POS), BORDER_EDGE_SHARPNESS), 0.0, 1.0));
    const westEdgeFactor = mul(isEdgeW, clamp(mul(sub(BORDER_EDGE_WIDTH_POS, localX), BORDER_EDGE_SHARPNESS), 0.0, 1.0));
    const northEdgeFactor = mul(isEdgeN, clamp(mul(sub(localY, BORDER_EDGE_THRESHOLD_POS), BORDER_EDGE_SHARPNESS), 0.0, 1.0));
    const southEdgeFactor = mul(isEdgeS, clamp(mul(sub(BORDER_EDGE_WIDTH_POS, localY), BORDER_EDGE_SHARPNESS), 0.0, 1.0));
    
    const totalEdgeFactor = max(max(max(eastEdgeFactor, westEdgeFactor), northEdgeFactor), southEdgeFactor);
    
    // Dashed pattern
    const dashPatternY = step(fract(mul(localY, DASH_FREQUENCY)), DASH_RATIO);
    const dashPatternX = step(fract(mul(localX, DASH_FREQUENCY)), DASH_RATIO);
    
    const dashedEastEdge = mul(eastEdgeFactor, dashPatternY);
    const dashedWestEdge = mul(westEdgeFactor, dashPatternY);
    const dashedNorthEdge = mul(northEdgeFactor, dashPatternX);
    const dashedSouthEdge = mul(southEdgeFactor, dashPatternX);
    
    const dashedTotalEdgeFactor = max(max(max(dashedEastEdge, dashedWestEdge), dashedNorthEdge), dashedSouthEdge);
    
    const borderLineIntensity = 0.45;
    
    const brightenedBorderColor = vec3(
        min(add(currentBorder.r, 0.3), 1.0),
        min(add(currentBorder.g, 0.3), 1.0),
        min(add(currentBorder.b, 0.3), 1.0)
    );
    
    const shouldShowBorderLine = mul(borders_visible.select(1.0, 0.0), mul(hasBorder, dashedTotalEdgeFactor));
    finalColor = vec4(
        mix(finalColor.rgb, brightenedBorderColor, mul(shouldShowBorderLine, borderLineIntensity)),
        finalColor.a
    );
    
    const shouldShowBorderFill = mul(borders_visible.select(1.0, 0.0), hasBorder);
    const borderFillFactor = mul(shouldShowBorderFill, 0.05);
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
    const SELECTION_EDGE_WIDTH = 0.06;     // Width of the selection edge highlight
    
    // Calculate selection indicator (1.0 if selected, 0.0 if not)
    const selectionActive = shouldHighlightTile.select(1.0, 0.0);
    
    // Create square edge mask for selection highlighting (all four edges)
    // Each edge detection returns 1.0 when within SELECTION_EDGE_WIDTH of that edge
    const nearLeftEdgeSel = step(localX, SELECTION_EDGE_WIDTH);
    const nearRightEdgeSel = step(sub(1.0, localX), SELECTION_EDGE_WIDTH);
    const nearBottomEdgeSel = step(localY, SELECTION_EDGE_WIDTH);
    const nearTopEdgeSel = step(sub(1.0, localY), SELECTION_EDGE_WIDTH);
    // Combine all four edge masks: 1.0 if near any edge, 0.0 otherwise
    const horizontalEdges = max(nearLeftEdgeSel, nearRightEdgeSel);
    const verticalEdges = max(nearBottomEdgeSel, nearTopEdgeSel);
    const squareEdgeMask = max(horizontalEdges, verticalEdges);
    
    // Apply edge highlighting on selected tile
    const scaledEdgeMask = mul(squareEdgeMask, SELECTION_EDGE_INTENSITY);
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
    // OUT-OF-BOUNDS CHECK
    // =========================================================================
    const isOutOfBoundsX = tileX.greaterThanEqual(map_x_size).or(tileX.lessThan(0.0));
    const isOutOfBoundsY = tileY.greaterThanEqual(map_y_size).or(tileY.lessThan(0.0));
    const isOutOfBounds = isOutOfBoundsX.or(isOutOfBoundsY);
    
    finalColor = isOutOfBounds.select(vec4(0.0, 0.0, 0.0, 1.0), finalColor);

    return finalColor;
}

// Export the shader creation function
window.createTerrainShaderSquareTSL = createTerrainShaderSquareTSL;
