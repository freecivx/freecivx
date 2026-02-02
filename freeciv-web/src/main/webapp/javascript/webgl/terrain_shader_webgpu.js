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
 */

function createTerrainShaderTSL(uniforms) {
    // Import TSL functions from THREE
    const { texture, uniform, positionLocal, normalLocal, color, uv, 
            vec2, vec3, vec4, float: tslFloat, int: tslInt, 
            mix, step, smoothstep, floor, fract, mod, dot, sin,
            mul, add, sub, div, length, normalize, clamp } = THREE;

    // Define terrain type constants
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

    // Height constants
    const BEACH_HIGH = 50.9;
    const BEACH_BLEND_HIGH = 50.4;
    const BEACH_BLEND_LOW = 49.8;
    const BEACH_LOW = 48.0;

    // Create uniform nodes
    const maptilesNode = texture(uniforms.maptiles.value);
    const bordersNode = texture(uniforms.borders.value);
    const roadsmapNode = texture(uniforms.roadsmap.value);
    const roadspritesNode = texture(uniforms.roadsprites.value);
    const railroadspritesNode = texture(uniforms.railroadsprites.value);
    
    // Terrain texture nodes
    const arcticNode = texture(uniforms.arctic_farmland_irrigation_tundra.value);
    const grasslandNode = texture(uniforms.grassland.value);
    const coastNode = texture(uniforms.coast.value);
    const desertNode = texture(uniforms.desert.value);
    const oceanNode = texture(uniforms.ocean.value);
    const plainsNode = texture(uniforms.plains.value);
    const hillsNode = texture(uniforms.hills.value);
    const mountainsNode = texture(uniforms.mountains.value);
    const swampNode = texture(uniforms.swamp.value);

    const map_x_size = uniform(uniforms.map_x_size.value);
    const map_y_size = uniform(uniforms.map_y_size.value);
    const borders_visible = uniform(uniforms.borders_visible.value);

    // Get UV coordinates
    const uvNode = uv();
    const posNode = positionLocal;

    // Calculate texture coordinates with random offset for variety
    const rndSeed = dot(uvNode, vec2(12.98, 78.233));
    const rnd = fract(mul(sin(rndSeed), 43758.5453));
    const rndOffset = mul(sub(rnd, 0.5), div(1.0, mul(8.0, vec2(map_x_size, map_y_size))));
    const sampledUV = add(uvNode, rndOffset);

    // Sample textures
    const terrainType = maptilesNode.uv(sampledUV);
    const borderColor = bordersNode.uv(uvNode);
    const roadType = roadsmapNode.uv(uvNode);

    // Calculate texture coordinate offsets
    const dx = mod(mul(map_x_size, uvNode.x), 1.0);
    const dy = mod(mul(map_y_size, uvNode.y), 1.0);
    const tdx = sub(div(mul(map_x_size, uvNode.x), 2.0), mul(0.5, floor(mul(map_x_size, uvNode.x))));
    const tdy = sub(div(mul(map_y_size, uvNode.y), 2.0), mul(0.5, floor(mul(map_y_size, uvNode.y))));

    // Extract terrain type value
    const terrainHere = floor(mul(terrainType.r, 256.0));
    const posY = posNode.y;

    // Create texture coordinate nodes
    const texCoord = vec2(dx, dy);
    const texCoordT = vec2(tdx, add(tdy, 0.5));

    // Define terrain selection function using TSL conditional nodes
    // This creates a material that samples different textures based on terrain type
    
    // Grassland terrain
    const isGrassland = step(TERRAIN_GRASSLAND - 0.5, terrainHere).mul(step(terrainHere, TERRAIN_GRASSLAND + 0.5));
    const grasslandColor = mix(
        coastNode.uv(texCoord),
        grasslandNode.uv(texCoord),
        step(BEACH_BLEND_HIGH, posY)
    );

    // Plains terrain
    const isPlains = step(TERRAIN_PLAINS - 0.5, terrainHere).mul(step(terrainHere, TERRAIN_PLAINS + 0.5));
    const plainsColor = mix(
        coastNode.uv(texCoord),
        plainsNode.uv(texCoord),
        step(BEACH_BLEND_HIGH, posY)
    );

    // Desert terrain
    const isDesert = step(TERRAIN_DESERT - 0.5, terrainHere).mul(step(terrainHere, TERRAIN_DESERT + 0.5));
    const desertColor = mix(
        coastNode.uv(texCoord),
        desertNode.uv(texCoord),
        step(BEACH_BLEND_HIGH, posY)
    );

    // Hills terrain
    const isHills = step(TERRAIN_HILLS - 0.5, terrainHere).mul(step(terrainHere, TERRAIN_HILLS + 0.5));
    const hillsColor = mix(
        coastNode.uv(texCoord),
        hillsNode.uv(texCoord),
        step(BEACH_BLEND_HIGH, posY)
    );

    // Mountains terrain
    const isMountains = step(TERRAIN_MOUNTAINS - 0.5, terrainHere).mul(step(terrainHere, TERRAIN_MOUNTAINS + 0.5));
    const mountainsColor = mix(
        coastNode.uv(texCoord),
        mountainsNode.uv(texCoord),
        step(BEACH_BLEND_HIGH, posY)
    );

    // Swamp terrain
    const isSwamp = step(TERRAIN_SWAMP - 0.5, terrainHere).mul(step(terrainHere, TERRAIN_SWAMP + 0.5));
    const swampColor = mix(
        coastNode.uv(texCoord),
        swampNode.uv(texCoord),
        step(BEACH_BLEND_HIGH, posY)
    );

    // Coast terrain
    const isCoast = step(TERRAIN_COAST - 0.5, terrainHere).mul(step(terrainHere, TERRAIN_COAST + 0.5));
    const coastColor = coastNode.uv(texCoord);

    // Ocean/Floor terrain
    const isFloor = step(TERRAIN_FLOOR - 0.5, terrainHere).mul(step(terrainHere, TERRAIN_FLOOR + 0.5));
    const floorColor = oceanNode.uv(texCoord);

    // Arctic terrain
    const isArctic = step(TERRAIN_ARCTIC - 0.5, terrainHere).mul(step(terrainHere, TERRAIN_ARCTIC + 0.5));
    const arcticColor = arcticNode.uv(texCoordT);

    // Combine all terrain types
    let finalColor = vec4(0, 0, 0, 1);
    
    // Build final color by mixing terrain types
    finalColor = mix(finalColor, grasslandColor, isGrassland);
    finalColor = mix(finalColor, plainsColor, isPlains);
    finalColor = mix(finalColor, desertColor, isDesert);
    finalColor = mix(finalColor, hillsColor, isHills);
    finalColor = mix(finalColor, mountainsColor, isMountains);
    finalColor = mix(finalColor, swampColor, isSwamp);
    finalColor = mix(finalColor, coastColor, isCoast);
    finalColor = mix(finalColor, floorColor, isFloor);
    finalColor = mix(finalColor, arcticColor, isArctic);

    // Apply vertex color for fog/visibility
    const vertColor = color(positionLocal);
    finalColor = vec4(mul(finalColor.rgb, vertColor), finalColor.a);

    // Add borders if visible
    const borderMix = mul(borders_visible, borderColor.a);
    finalColor = vec4(
        mix(finalColor.rgb, borderColor.rgb, borderMix),
        finalColor.a
    );

    return finalColor;
}

// Export the shader creation function
window.createTerrainShaderTSL = createTerrainShaderTSL;
