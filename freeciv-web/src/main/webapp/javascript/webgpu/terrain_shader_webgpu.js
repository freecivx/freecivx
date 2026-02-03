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
 * - Multi-terrain type support with automatic blending
 * - Beach/coast transitions based on elevation
 * - Border overlay rendering
 * - Randomized texture sampling for visual variety
 * - Vertex color-based fog/visibility
 * - Slope-based brightness with sun direction lighting
 * - Hexagonal tile UV transformation (staggered row offset)
 */

function createTerrainShaderTSL(uniforms) {
    // Import TSL functions and nodes from THREE
    // These should be available after three-modules-webgpu.js has loaded
    const { 
        texture, uniform, positionLocal, attribute, uv, normalLocal,
        vec2, vec3, vec4,
        mix, step, floor, fract, mod, dot, sin, cos, normalize, max, pow, clamp,
        mul, add, sub, div
    } = THREE;
    
    // Verify all required TSL functions and nodes are available
    const requiredTSLNames = ['texture', 'uniform', 'positionLocal', 'attribute', 'uv', 'vec2', 'vec3', 'vec4', 'mix', 'step', 'floor', 'fract', 'mod', 'dot', 'sin', 'mul', 'add', 'sub', 'div'];
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

    // Create texture references for reuse (don't call texture() yet)
    const maptilesTex = uniforms.maptiles.value;
    const bordersTex = uniforms.borders.value;
    
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
    // HEXAGONAL UV COORDINATE TRANSFORMATION
    // =========================================================================
    // Calculate the tile Y coordinate to determine row offset
    const tileY = floor(mul(map_y_size, uvNode.y));
    
    // Hex stagger: odd rows are offset by 0.5 tile width
    // isOddRow = tileY % 2 (use fract of tileY/2 and step to check)
    const isOddRow = step(0.25, fract(mul(tileY, 0.5)));
    
    // Calculate hex-adjusted UV coordinates
    // For hex grid, the X coordinate needs adjustment based on row parity
    const hexOffsetX = mul(isOddRow, div(0.5, map_x_size));
    const hexUvX = sub(uvNode.x, hexOffsetX);
    const hexUV = vec2(hexUvX, uvNode.y);

    // Add pseudo-random texture offset for visual variety
    // This prevents tiling artifacts on large uniform terrain areas
    const rndSeed = dot(hexUV, vec2(12.98, 78.233));
    const rnd = fract(mul(sin(rndSeed), 43758.5453));
    const rndOffset = mul(sub(rnd, 0.5), div(1.0, mul(8.0, vec2(map_x_size, map_y_size))));
    const sampledUV = add(hexUV, rndOffset);

    // Sample terrain type and border data using hex-adjusted UVs
    const terrainType = texture(maptilesTex, sampledUV);
    const borderColor = texture(bordersTex, hexUV);

    // Calculate texture coordinates for different tile orientations (hex-adjusted)
    const dx = mod(mul(map_x_size, hexUV.x), 1.0);
    const dy = mod(mul(map_y_size, hexUV.y), 1.0);
    const tdx = sub(div(mul(map_x_size, hexUV.x), 2.0), mul(0.5, floor(mul(map_x_size, hexUV.x))));
    const tdy = sub(div(mul(map_y_size, hexUV.y), 2.0), mul(0.5, floor(mul(map_y_size, hexUV.y))));

    // Extract terrain type value from texture (stored in red channel as 0-255 value)
    const terrainHere = floor(mul(terrainType.r, 256.0));
    const posY = posNode.y;

    // Texture coordinate nodes for hexagonal tiles
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

    return finalColor;
}

// Export the shader creation function
window.createTerrainShaderTSL = createTerrainShaderTSL;
