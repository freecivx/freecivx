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
 */

function createTerrainShaderTSL(uniforms) {
    // Import TSL functions from THREE
    const { 
        texture, uniform, positionLocal, color, uv, 
        vec2, vec3, vec4,
        mix, step, floor, fract, mod, dot, sin,
        mul, add, sub, div
    } = THREE;

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

    // Create texture sampler nodes
    const maptilesNode = texture(uniforms.maptiles.value);
    const bordersNode = texture(uniforms.borders.value);
    
    // Terrain texture nodes - organized by terrain type
    const terrainTextures = {
        arctic: texture(uniforms.arctic_farmland_irrigation_tundra.value),
        grassland: texture(uniforms.grassland.value),
        coast: texture(uniforms.coast.value),
        desert: texture(uniforms.desert.value),
        ocean: texture(uniforms.ocean.value),
        plains: texture(uniforms.plains.value),
        hills: texture(uniforms.hills.value),
        mountains: texture(uniforms.mountains.value),
        swamp: texture(uniforms.swamp.value)
    };

    // Map size uniforms
    const map_x_size = uniform(uniforms.map_x_size.value);
    const map_y_size = uniform(uniforms.map_y_size.value);
    const borders_visible = uniform(uniforms.borders_visible.value);

    // Get UV coordinates and position
    const uvNode = uv();
    const posNode = positionLocal;

    // Add pseudo-random texture offset for visual variety
    // This prevents tiling artifacts on large uniform terrain areas
    const rndSeed = dot(uvNode, vec2(12.98, 78.233));
    const rnd = fract(mul(sin(rndSeed), 43758.5453));
    const rndOffset = mul(sub(rnd, 0.5), div(1.0, mul(8.0, vec2(map_x_size, map_y_size))));
    const sampledUV = add(uvNode, rndOffset);

    // Sample terrain type and border data
    const terrainType = maptilesNode.sample(sampledUV);
    const borderColor = bordersNode.sample(uvNode);

    // Calculate texture coordinates for different tile orientations
    const dx = mod(mul(map_x_size, uvNode.x), 1.0);
    const dy = mod(mul(map_y_size, uvNode.y), 1.0);
    const tdx = sub(div(mul(map_x_size, uvNode.x), 2.0), mul(0.5, floor(mul(map_x_size, uvNode.x))));
    const tdy = sub(div(mul(map_y_size, uvNode.y), 2.0), mul(0.5, floor(mul(map_y_size, uvNode.y))));

    // Extract terrain type value from texture (stored in red channel as 0-255 value)
    const terrainHere = floor(mul(terrainType.r, 256.0));
    const posY = posNode.y;

    // Texture coordinate nodes
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
        // Create boolean mask for this terrain type
        const isTerrain = step(terrainValue - 0.5, terrainHere).mul(step(terrainHere, terrainValue + 0.5));
        
        // Sample terrain texture
        let terrainColor;
        if (blendWithCoast) {
            // Blend with coast texture at lower elevations (beaches)
            terrainColor = mix(
                terrainTextures.coast.sample(coord),
                textureNode.sample(coord),
                step(BEACH_BLEND_HIGH, posY)
            );
        } else {
            terrainColor = textureNode.sample(coord);
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
        createTerrainLayer(TERRAIN_COAST, terrainTextures.coast, texCoord, false),
        createTerrainLayer(TERRAIN_FLOOR, terrainTextures.ocean, texCoord, false),
        createTerrainLayer(TERRAIN_ARCTIC, terrainTextures.arctic, texCoordT, false)
    ];

    // Combine all terrain layers
    let finalColor = vec4(0, 0, 0, 1);
    for (const layer of layers) {
        finalColor = mix(finalColor, layer.color, layer.mask);
    }

    // Apply vertex color for fog/visibility effects
    const vertColor = color(positionLocal);
    finalColor = vec4(mul(finalColor.rgb, vertColor), finalColor.a);

    // Overlay borders if visible
    const borderMix = mul(borders_visible, borderColor.a);
    finalColor = vec4(
        mix(finalColor.rgb, borderColor.rgb, borderMix),
        finalColor.a
    );

    return finalColor;
}

// Export the shader creation function
window.createTerrainShaderTSL = createTerrainShaderTSL;
