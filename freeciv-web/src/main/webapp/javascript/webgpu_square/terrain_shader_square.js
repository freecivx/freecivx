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
    
    // Terrain texture references
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
    const ROAD_SPRITE_COLS = 4.0;
    const ROAD_SPRITE_ROWS = 4.0;
    const IRRIGATION_FLAG = 1.0;
    const FARMLAND_FLAG = 2.0;

    // Map size uniforms
    const map_x_size = uniform(uniforms.map_x_size.value);
    const map_y_size = uniform(uniforms.map_y_size.value);
    const borders_visible = uniform(uniforms.borders_visible.value);

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
    
    // Tiled texture coordinates for tundra/arctic
    const tdx = sub(div(mul(map_x_size, uvNode.x), 2.0), mul(0.5, floor(mul(map_x_size, uvNode.x))));
    const tdy = sub(div(mul(map_y_size, uvNode.y), 2.0), mul(0.5, floor(mul(map_y_size, uvNode.y))));

    // Extract terrain type value
    const terrainHere = floor(mul(terrainType.r, 256.0));
    const posY = posNode.y;

    // Texture coordinate nodes
    const texCoord = vec2(dx, dy);
    const texCoordT = vec2(tdx, add(tdy, 0.5));

    // Beach sand colour as vec3
    const beachSandColor = vec3(BEACH_SAND_COLOR.r, BEACH_SAND_COLOR.g, BEACH_SAND_COLOR.b);

    /**
     * Helper function to create terrain selection and blending logic
     */
    function createTerrainLayer(terrainValue, textureNode, coord, blendWithBeach = true) {
        const step1 = step(terrainValue - 0.5, terrainHere);
        const step2 = step(terrainHere, terrainValue + 0.5);
        const isTerrain = mul(step1, step2);
        
        let terrainColor;
        if (blendWithBeach) {
            const baseTerrainColor = texture(textureNode, coord);
            const aboveWater = step(WATER_LEVEL, posY);
            const lowerBeachT = mul(
                clamp(div(sub(posY, BEACH_BLEND_HIGH), BEACH_LOWER_RANGE), 0.0, 1.0),
                aboveWater
            );
            const upperBeachT = clamp(
                div(sub(posY, BEACH_MID), BEACH_UPPER_RANGE),
                0.0, 1.0
            );
            const coastTex = texture(terrainTextures.coast, coord);
            const lowerBlend = mix(coastTex, vec4(beachSandColor, 1.0), lowerBeachT);
            terrainColor = mix(lowerBlend, baseTerrainColor, upperBeachT);
        } else {
            terrainColor = texture(textureNode, coord);
        }
        
        return { mask: isTerrain, color: terrainColor };
    }

    // Build terrain layers
    const layers = [
        createTerrainLayer(TERRAIN_GRASSLAND, terrainTextures.grassland, texCoord, true),
        createTerrainLayer(TERRAIN_PLAINS, terrainTextures.plains, texCoord, true),
        createTerrainLayer(TERRAIN_DESERT, terrainTextures.desert, texCoord, true),
        createTerrainLayer(TERRAIN_HILLS, terrainTextures.hills, texCoord, true),
        createTerrainLayer(TERRAIN_MOUNTAINS, terrainTextures.mountains, texCoord, true),
        createTerrainLayer(TERRAIN_SWAMP, terrainTextures.swamp, texCoord, true),
        createTerrainLayer(TERRAIN_FOREST, terrainTextures.grassland, texCoord, true),
        createTerrainLayer(TERRAIN_JUNGLE, terrainTextures.plains, texCoord, true),
        createTerrainLayer(TERRAIN_COAST, terrainTextures.coast, texCoord, false),
        createTerrainLayer(TERRAIN_FLOOR, terrainTextures.ocean, texCoord, false),
        createTerrainLayer(TERRAIN_LAKE, terrainTextures.coast, texCoord, false),
        createTerrainLayer(TERRAIN_ARCTIC, terrainTextures.arctic, texCoordT, false),
        createTerrainLayer(TERRAIN_TUNDRA, terrainTextures.arctic, vec2(add(tdx, 0.5), tdy), false)
    ];

    // Combine all terrain layers
    let finalColor = vec4(0, 0, 0, 1);
    for (const layer of layers) {
        finalColor = mix(finalColor, layer.color, layer.mask);
    }

    // =========================================================================
    // IRRIGATION AND FARMLAND RENDERING
    // =========================================================================
    const irrigationFlag = floor(mul(terrainType.b, 256.0));
    
    const hasIrrigation = mul(step(0.5, irrigationFlag), step(irrigationFlag, 1.5));
    const irrigationColor = vec3(0.6, 0.85, 0.75);
    finalColor = vec4(
        mix(finalColor.rgb, irrigationColor, mul(hasIrrigation, 0.15)),
        finalColor.a
    );
    
    const hasFarmland = step(1.5, irrigationFlag);
    const farmlandColor = vec3(0.85, 0.78, 0.45);
    finalColor = vec4(
        mix(finalColor.rgb, farmlandColor, mul(hasFarmland, 0.18)),
        finalColor.a
    );

    // =========================================================================
    // ROADS AND RAILROADS RENDERING
    // =========================================================================
    const roadData = texture(roadsmapTex, tileCenterUV);
    const roadIndex = floor(mul(roadData.r, 256.0));
    
    const hasRoad = mul(step(0.5, roadIndex), step(roadIndex, 9.5));
    const hasRoadJunction = mul(step(41.5, roadIndex), step(roadIndex, 42.5));
    
    const spriteU = div(1.0, ROAD_SPRITE_COLS);
    const spriteV = div(1.0, ROAD_SPRITE_ROWS);
    
    const roadSpriteIndex = sub(roadIndex, 1.0);
    const roadCol = mod(roadSpriteIndex, ROAD_SPRITE_COLS);
    const roadRow = floor(div(roadSpriteIndex, ROAD_SPRITE_COLS));
    
    const roadSpriteUV = vec2(
        add(mul(localX, spriteU), mul(roadCol, spriteU)),
        add(mul(localY, spriteV), mul(roadRow, spriteV))
    );
    const roadSprite = texture(roadspritesTex, roadSpriteUV);
    
    const junctionUV = vec2(mul(localX, spriteU), mul(localY, spriteV));
    const roadJunctionSprite = texture(roadspritesTex, junctionUV);
    
    // Blend roads onto terrain
    const roadAlpha = mul(hasRoad, roadSprite.a);
    finalColor = vec4(
        mix(finalColor.rgb, roadSprite.rgb, mul(roadAlpha, 0.9)),
        finalColor.a
    );
    
    const roadJunctionAlpha = mul(hasRoadJunction, roadJunctionSprite.a);
    finalColor = vec4(
        mix(finalColor.rgb, roadJunctionSprite.rgb, mul(roadJunctionAlpha, 0.9)),
        finalColor.a
    );

    // =========================================================================
    // SLOPE-BASED LIGHTING
    // =========================================================================
    const sunDir = vec3(0.503, 0.704, 0.503);
    const normal = normalLocal;
    const NdotL = max(dot(normal, sunDir), 0.0);
    
    const ambientLight = 0.35;
    const diffuseStrength = 0.55;
    const lightingFactor = add(ambientLight, mul(NdotL, diffuseStrength));
    
    const brightnessBoost = 1.08;
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
    const visSmooth = mul(mul(visNormalized, visNormalized), sub(3.0, mul(2.0, visNormalized)));
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
    // OUT-OF-BOUNDS CHECK
    // =========================================================================
    const isOutOfBoundsX = step(map_x_size, tileX).greaterThan(0.5).or(tileX.lessThan(0.0));
    const isOutOfBoundsY = step(map_y_size, tileY).greaterThan(0.5).or(tileY.lessThan(0.0));
    const isOutOfBounds = isOutOfBoundsX.or(isOutOfBoundsY);
    
    finalColor = isOutOfBounds.select(vec4(0.0, 0.0, 0.0, 1.0), finalColor);

    return finalColor;
}

// Export the shader creation function
window.createTerrainShaderSquareTSL = createTerrainShaderSquareTSL;
