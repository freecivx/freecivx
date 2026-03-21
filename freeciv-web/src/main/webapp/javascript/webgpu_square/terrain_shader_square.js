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
 * - Roads and railroads rendering from sprite sheets
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
    // Sprite indices: 1-9 for roads, 10-19 for railroads, 20-29 for rivers, 42/43/53 for junctions
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
    const tileYRaw = map_y_size.mul(uvNode.y);
    const tileY = tileYRaw.floor();
    
    const tileXRaw = map_x_size.mul(uvNode.x);
    const tileX = tileXRaw.floor();
    
    // Local position within the current tile (0 to 1 range)
    const localX = tileXRaw.fract();
    const localY = tileYRaw.fract();

    // =========================================================================
    // SQUARE TILE EDGE GRID LINES
    // =========================================================================
    // Create grid lines at tile edges using fwidth() for adaptive anti-aliasing.
    // fwidth() returns the rate of change per screen pixel, so the AA band is
    // exactly one pixel wide at any zoom level — crisp when zoomed in, soft when zoomed out.
    const localXFw = fwidth(localX);
    const localYFw = fwidth(localY);
    const nearLeftEdge = float(1.0).sub(smoothstep(float(TILE_EDGE_WIDTH).sub(localXFw), float(TILE_EDGE_WIDTH).add(localXFw), localX));
    const nearBottomEdge = float(1.0).sub(smoothstep(float(TILE_EDGE_WIDTH).sub(localYFw), float(TILE_EDGE_WIDTH).add(localYFw), localY));
    
    // Combine to create grid line mask (1 at edges, 0 elsewhere)
    const gridLineMask = nearLeftEdge.max(nearBottomEdge);
    
    // =========================================================================
    // TERRAIN SAMPLING AT TILE CENTER
    // =========================================================================
    const tileCenterU = tileX.add(0.5).div(map_x_size);
    const tileCenterV = tileY.add(0.5).div(map_y_size);
    const tileCenterUV = vec2(tileCenterU, tileCenterV);
    
    // Add pseudo-random texture offset for visual variety.
    // Uses THREE's hash() TSL function for a more robust pseudo-random value than sin-based hashing.
    const rnd = hash(tileCenterUV);
    const rndOffset = rnd.sub(0.5).mul(float(1.0).div(vec2(map_x_size, map_y_size).mul(TEXTURE_RANDOM_SCALE)));
    const sampledUV = tileCenterUV.add(rndOffset);

    // Sample terrain type
    const terrainType = texture(maptilesTex, sampledUV);

    // Texture coordinates for terrain detail
    const dx = localX;
    const dy = localY;

    // Extract terrain type value
    const terrainHere = terrainType.r.mul(256.0).floor();
    const posY = posNode.y;

    // Texture coordinate node
    const texCoord = vec2(dx, dy);

    // Beach sand colour as vec3
    const beachSandColor = vec3(BEACH_SAND_COLOR.r, BEACH_SAND_COLOR.g, BEACH_SAND_COLOR.b);

    // =========================================================================
    // NEIGHBOR TERRAIN SAMPLING FOR EDGE BLENDING
    // =========================================================================
    // Sample terrain types from 4 neighboring tiles (N, E, S, W)
    const terrainOffsetX = float(1.0).div(map_x_size);
    const terrainOffsetY = float(1.0).div(map_y_size);
    
    const neighborTerrainUV_E = vec2(tileCenterUV.x.add(terrainOffsetX), tileCenterUV.y);
    const neighborTerrainUV_W = vec2(tileCenterUV.x.sub(terrainOffsetX), tileCenterUV.y);
    const neighborTerrainUV_N = vec2(tileCenterUV.x, tileCenterUV.y.add(terrainOffsetY));
    const neighborTerrainUV_S = vec2(tileCenterUV.x, tileCenterUV.y.sub(terrainOffsetY));
    
    const terrainTypeE = texture(maptilesTex, neighborTerrainUV_E);
    const terrainTypeW = texture(maptilesTex, neighborTerrainUV_W);
    const terrainTypeN = texture(maptilesTex, neighborTerrainUV_N);
    const terrainTypeS = texture(maptilesTex, neighborTerrainUV_S);
    
    const terrainE = terrainTypeE.r.mul(256.0).floor();
    const terrainW = terrainTypeW.r.mul(256.0).floor();
    const terrainN = terrainTypeN.r.mul(256.0).floor();
    const terrainS = terrainTypeS.r.mul(256.0).floor();

    // =========================================================================
    // TERRAIN EDGE BLENDING PARAMETERS
    // =========================================================================
    // Edge blend zone: how far from tile edge the blending starts (0-0.5 range)
    const TERRAIN_BLEND_WIDTH = 0.35;
    // Blend strength: how much to blend neighbor terrain (0-1)
    const TERRAIN_BLEND_STRENGTH = 0.5;

    /**
     * Helper function to compute terrain color with optional beach blending
     * Used by both createTerrainLayer and getTerrainColorForType to share logic
     */
    function computeTerrainColor(layerIndex, coord, blendWithBeach) {
        if (blendWithBeach) {
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
            return mix(coastTex, aboveWaterColor, aboveWater);
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
        const isTerrain = step1.mul(step2);
        const terrainColor = texture(terrainLayersTex, coord).depth(int(layerIndex));
        return { mask: isTerrain, color: terrainColor };
    }
    
    /**
     * Helper function to get terrain color for a given terrain type value.
     * Wrapped in Fn() so it compiles to a single GPU function called for each
     * of the 4 cardinal neighbors, rather than being inlined 4 times.
     */
    const getTerrainColorForTypeFn = Fn(([tType, coord]) => {
        // Start with black (unknown terrain)
        let color = vec4(0, 0, 0, 1);
        
        // Helper to check if terrain matches and return color (atlas)
        function matchTerrain(terrainValue, layerIndex, blendWithBeach) {
            const isTerrain = step(terrainValue - 0.5, tType).mul(step(tType, terrainValue + 0.5));
            return { mask: isTerrain, color: computeTerrainColor(layerIndex, coord, blendWithBeach) };
        }
        
        // Helper to check terrain from array texture
        function matchTerrainFromArray(terrainValue, layerIndex) {
            const isTerrain = step(terrainValue - 0.5, tType).mul(step(tType, terrainValue + 0.5));
            return { mask: isTerrain, color: texture(terrainLayersTex, coord).depth(int(layerIndex)) };
        }
        
        // Match each terrain type and accumulate
        const layersList = [
            matchTerrain(TERRAIN_GRASSLAND, TERRAIN_ATLAS_GRASSLAND, true),
            matchTerrain(TERRAIN_PLAINS, TERRAIN_ATLAS_PLAINS, true),
            matchTerrain(TERRAIN_DESERT, TERRAIN_ATLAS_DESERT, true),
            matchTerrain(TERRAIN_HILLS, TERRAIN_ATLAS_HILLS, true),
            matchTerrain(TERRAIN_MOUNTAINS, TERRAIN_ATLAS_MOUNTAINS, true),
            matchTerrain(TERRAIN_SWAMP, TERRAIN_ATLAS_SWAMP, true),
            matchTerrain(TERRAIN_FOREST, TERRAIN_ATLAS_FOREST, true),
            matchTerrain(TERRAIN_JUNGLE, TERRAIN_ATLAS_JUNGLE, true),
            matchTerrain(TERRAIN_COAST, TERRAIN_ATLAS_COAST, false),
            matchTerrain(TERRAIN_FLOOR, TERRAIN_ATLAS_OCEAN, false),
            matchTerrain(TERRAIN_LAKE, TERRAIN_ATLAS_COAST, false),
            matchTerrainFromArray(TERRAIN_ARCTIC, TERRAIN_LAYER_ARCTIC),
            matchTerrainFromArray(TERRAIN_TUNDRA, TERRAIN_LAYER_TUNDRA)
        ];
        
        for (const layer of layersList) {
            color = color.mix(layer.color, layer.mask);
        }
        
        return color;
    });

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
        finalColor = finalColor.mix(layer.color, layer.mask);
    }
    
    // =========================================================================
    // TERRAIN EDGE BLENDING (blend terrain textures at tile borders)
    // =========================================================================
    // Get terrain colors for neighboring tiles using the Fn() GPU function
    const colorE = getTerrainColorForTypeFn(terrainE, texCoord);
    const colorW = getTerrainColorForTypeFn(terrainW, texCoord);
    const colorN = getTerrainColorForTypeFn(terrainN, texCoord);
    const colorS = getTerrainColorForTypeFn(terrainS, texCoord);
    
    // Calculate edge proximity factors (1.0 at edge, 0.0 at center) using method chaining
    // East edge: localX close to 1.0
    const eastEdgeProximity = localX.sub(float(1.0).sub(TERRAIN_BLEND_WIDTH)).div(TERRAIN_BLEND_WIDTH).clamp(0.0, 1.0);
    // West edge: localX close to 0.0
    const westEdgeProximity = float(TERRAIN_BLEND_WIDTH).sub(localX).div(TERRAIN_BLEND_WIDTH).clamp(0.0, 1.0);
    // North edge: localY close to 1.0
    const northEdgeProximity = localY.sub(float(1.0).sub(TERRAIN_BLEND_WIDTH)).div(TERRAIN_BLEND_WIDTH).clamp(0.0, 1.0);
    // South edge: localY close to 0.0
    const southEdgeProximity = float(TERRAIN_BLEND_WIDTH).sub(localY).div(TERRAIN_BLEND_WIDTH).clamp(0.0, 1.0);
    
    // Apply smooth step for more natural blending transition using THREE's smoothstep()
    // Scale by blend strength
    const eastFactor = smoothstep(0.0, 1.0, eastEdgeProximity).mul(TERRAIN_BLEND_STRENGTH);
    const westFactor = smoothstep(0.0, 1.0, westEdgeProximity).mul(TERRAIN_BLEND_STRENGTH);
    const northFactor = smoothstep(0.0, 1.0, northEdgeProximity).mul(TERRAIN_BLEND_STRENGTH);
    const southFactor = smoothstep(0.0, 1.0, southEdgeProximity).mul(TERRAIN_BLEND_STRENGTH);
    
    // Blend neighbor terrain colors into final color
    // Only blend if neighbor terrain is non-zero
    const hasTerrainE = step(0.5, terrainE);
    const hasTerrainW = step(0.5, terrainW);
    const hasTerrainN = step(0.5, terrainN);
    const hasTerrainS = step(0.5, terrainS);
    
    finalColor = finalColor.mix(colorE, eastFactor.mul(hasTerrainE));
    finalColor = finalColor.mix(colorW, westFactor.mul(hasTerrainW));
    finalColor = finalColor.mix(colorN, northFactor.mul(hasTerrainN));
    finalColor = finalColor.mix(colorS, southFactor.mul(hasTerrainS));

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
    // ROADS, RAILROADS AND RIVERS RENDERING (using texture_2d_array)
    // =========================================================================
    const roadData = texture(roadsmapTex, tileCenterUV);
    const roadIndex = roadData.r.mul(256.0).floor();
    const roadIndex2 = roadData.g.mul(256.0).floor();
    const roadIndex3 = roadData.b.mul(256.0).floor();
    
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
    const riverSpriteUV = vec2(localX, localY);
    const riverSprite = texture(riverspritesTex, riverSpriteUV).depth(riverLayerIndex);
    const riverSprite2 = texture(riverspritesTex, riverSpriteUV).depth(riverLayerIndex2);
    const riverSprite3 = texture(riverspritesTex, riverSpriteUV).depth(riverLayerIndex3);
    
    // Sample road sprite using texture array with vec2 UV and integer layer index
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
    // three-operation expression 18 times, reducing compiled shader size.
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
    // SLOPE-BASED LIGHTING
    // =========================================================================
    const sunDir = vec3(0.503, 0.704, 0.503);
    const normal = normalLocal;
    const NdotL = normal.dot(sunDir).max(0.0);
    
    // Ambient light and diffuse for more natural, brighter terrain
    // Total range: 0.30 (in shadow) to 0.92 (fully lit)
    const ambientLight = 0.30;
    const diffuseStrength = 0.62;
    const lightingFactor = NdotL.mul(diffuseStrength).add(ambientLight);
    
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
    // SQUARE TILE GRID LINES
    // =========================================================================
    const tileEdgeColor = vec3(TILE_EDGE_COLOR_R, TILE_EDGE_COLOR_G, TILE_EDGE_COLOR_B);
    finalColor = vec4(finalColor.rgb.mix(tileEdgeColor, gridLineMask.mul(TILE_EDGE_BLEND_STRENGTH)), finalColor.a);

    // =========================================================================
    // VISIBILITY BLENDING
    // =========================================================================
    const tileVisibilityTex = texture(maptilesTex, tileCenterUV);
    const tileVisibility = tileVisibilityTex.a;
    
    // Neighbor UV offsets (also used by the borders section below)
    const neighborOffsetX = float(1.0).div(map_x_size);
    const neighborOffsetY = float(1.0).div(map_y_size);
    
    const neighborUV_E = vec2(tileCenterUV.x.add(neighborOffsetX), tileCenterUV.y);
    const neighborUV_W = vec2(tileCenterUV.x.sub(neighborOffsetX), tileCenterUV.y);
    const neighborUV_N = vec2(tileCenterUV.x, tileCenterUV.y.add(neighborOffsetY));
    const neighborUV_S = vec2(tileCenterUV.x, tileCenterUV.y.sub(neighborOffsetY));
    
    // Reuse the neighbor terrain-type samples taken earlier (same UV positions as
    // neighborUV_E/W/N/S) to read visibility from the alpha channel.  This avoids
    // four redundant maptilesTex reads per fragment.
    const visE = terrainTypeE.a;
    const visW = terrainTypeW.a;
    const visN = terrainTypeN.a;
    const visS = terrainTypeS.a;
    
    const avgNeighborVis = visE.add(visW).add(visN).add(visS).mul(0.25);
    
    // Edge proximity for soft blending (distance from center)
    const distFromCenter = localX.sub(0.5).abs().max(localY.sub(0.5).abs());
    const edgeProximity = distFromCenter.sub(0.3).mul(5.0).clamp(0.0, 1.0);
    
    const softVisibility = tileVisibility.mix(avgNeighborVis, edgeProximity.mul(0.4));
    
    // Use THREE's smoothstep() for a hardware-accelerated S-curve
    const visSmooth = smoothstep(0.0, 1.0, softVisibility.mul(VISIBILITY_VISIBLE).clamp(0.0, 1.0));
    const smoothVisibility = visSmooth.mul(VISIBILITY_VISIBLE);
    
    // Active city highlighting
    const vertexVisibility = vertColor.x;
    let effectiveVisibility = smoothVisibility.min(vertexVisibility);
    
    const isKnownTerrain = step(0.5, terrainHere);
    effectiveVisibility = effectiveVisibility.max(isKnownTerrain.mul(VISIBILITY_FOGGED));
    
    finalColor = vec4(finalColor.rgb.mul(effectiveVisibility), finalColor.a);

    // =========================================================================
    // NATION BORDERS
    // =========================================================================
    const BORDER_EDGE_THRESHOLD_POS = 0.90;
    const BORDER_EDGE_WIDTH_POS = 0.10;
    const BORDER_EDGE_SHARPNESS = 14.0;
    const BORDER_COLOR_DIFF_THRESHOLD = 0.05;
    const DASH_FREQUENCY = 8.0;
    const DASH_RATIO = 0.6;
    
    const currentBorder = texture(bordersTex, tileCenterUV);
    const borderE = texture(bordersTex, neighborUV_E);
    const borderW = texture(bordersTex, neighborUV_W);
    const borderN = texture(bordersTex, neighborUV_N);
    const borderS = texture(bordersTex, neighborUV_S);
    
    const hasBorder = step(0.1, currentBorder.a);
    
    // Detect border edges using method chaining for colour-difference sum
    const isEdgeE = step(BORDER_COLOR_DIFF_THRESHOLD, currentBorder.r.sub(borderE.r).abs().add(currentBorder.g.sub(borderE.g).abs()).add(currentBorder.b.sub(borderE.b).abs()));
    const isEdgeW = step(BORDER_COLOR_DIFF_THRESHOLD, currentBorder.r.sub(borderW.r).abs().add(currentBorder.g.sub(borderW.g).abs()).add(currentBorder.b.sub(borderW.b).abs()));
    const isEdgeN = step(BORDER_COLOR_DIFF_THRESHOLD, currentBorder.r.sub(borderN.r).abs().add(currentBorder.g.sub(borderN.g).abs()).add(currentBorder.b.sub(borderN.b).abs()));
    const isEdgeS = step(BORDER_COLOR_DIFF_THRESHOLD, currentBorder.r.sub(borderS.r).abs().add(currentBorder.g.sub(borderS.g).abs()).add(currentBorder.b.sub(borderS.b).abs()));
    
    // Edge factors using method chaining
    const eastEdgeFactor  = isEdgeE.mul(localX.sub(BORDER_EDGE_THRESHOLD_POS).mul(BORDER_EDGE_SHARPNESS).clamp(0.0, 1.0));
    const westEdgeFactor  = isEdgeW.mul(float(BORDER_EDGE_WIDTH_POS).sub(localX).mul(BORDER_EDGE_SHARPNESS).clamp(0.0, 1.0));
    const northEdgeFactor = isEdgeN.mul(localY.sub(BORDER_EDGE_THRESHOLD_POS).mul(BORDER_EDGE_SHARPNESS).clamp(0.0, 1.0));
    const southEdgeFactor = isEdgeS.mul(float(BORDER_EDGE_WIDTH_POS).sub(localY).mul(BORDER_EDGE_SHARPNESS).clamp(0.0, 1.0));
    
    // Dashed pattern
    const dashPatternY = step(localY.mul(DASH_FREQUENCY).fract(), DASH_RATIO);
    const dashPatternX = step(localX.mul(DASH_FREQUENCY).fract(), DASH_RATIO);
    
    const dashedTotalEdgeFactor = eastEdgeFactor.mul(dashPatternY).max(westEdgeFactor.mul(dashPatternY)).max(northEdgeFactor.mul(dashPatternX)).max(southEdgeFactor.mul(dashPatternX));
    
    const borderLineIntensity = 0.45;
    
    const brightenedBorderColor = vec3(
        currentBorder.r.add(0.3).min(1.0),
        currentBorder.g.add(0.3).min(1.0),
        currentBorder.b.add(0.3).min(1.0)
    );
    
    const shouldShowBorderLine = borders_visible.select(1.0, 0.0).mul(hasBorder).mul(dashedTotalEdgeFactor);
    finalColor = vec4(finalColor.rgb.mix(brightenedBorderColor, shouldShowBorderLine.mul(borderLineIntensity)), finalColor.a);
    
    const shouldShowBorderFill = borders_visible.select(1.0, 0.0).mul(hasBorder);
    finalColor = vec4(finalColor.rgb.mix(currentBorder.rgb, shouldShowBorderFill.mul(0.05)), finalColor.a);

    // =========================================================================
    // SELECTED TILE HIGHLIGHTING
    // =========================================================================
    // Highlight the currently selected tile based on selected_x and selected_y uniforms
    // A value of -1 indicates no selection, otherwise the tile at (selected_x, selected_y) is highlighted
    const hasSelection = selected_x.greaterThanEqual(0.0).and(selected_y.greaterThanEqual(0.0));
    // Use epsilon-based comparison (0.5) for float precision tolerance
    const xMatch = tileX.sub(selected_x).abs().lessThan(0.5);
    const yMatch = tileY.sub(selected_y).abs().lessThan(0.5);
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
    const nearRightEdgeSel = step(float(1.0).sub(localX), SELECTION_EDGE_WIDTH);
    const nearBottomEdgeSel = step(localY, SELECTION_EDGE_WIDTH);
    const nearTopEdgeSel = step(float(1.0).sub(localY), SELECTION_EDGE_WIDTH);
    // Combine all four edge masks: 1.0 if near any edge, 0.0 otherwise
    const squareEdgeMask = nearLeftEdgeSel.max(nearRightEdgeSel).max(nearBottomEdgeSel).max(nearTopEdgeSel);
    
    // Apply edge highlighting on selected tile
    finalColor = vec4(finalColor.rgb.mix(SELECTION_HIGHLIGHT_COLOR, selectionActive.mul(squareEdgeMask).mul(SELECTION_EDGE_INTENSITY)), finalColor.a);
    
    // Apply subtle fill highlighting to the entire selected tile
    finalColor = vec4(finalColor.rgb.mix(SELECTION_HIGHLIGHT_COLOR, selectionActive.mul(SELECTION_FILL_INTENSITY)), finalColor.a);

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
