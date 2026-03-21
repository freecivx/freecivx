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
 * Water Module for WebGPU (Hexagonal Map Tiles)
 * 
 * Handles animated water rendering using TSL (Three.js Shading Language).
 * This version is designed for hexagonal map tile topology.
 * 
 * Design goals (Stylized Game Water - Civ-style):
 * - Calm: Gentle, subtle movement instead of big ocean waves
 * - Stylized: Color gradients and caustic patterns for visual interest
 * - Fast: Efficient shader without heavy wave calculations
 * - Game-appropriate: Works well at top-down/isometric strategy game camera angles
 * - Fog of War: Respects map tile visibility (unknown tiles render black)
 * - Hex-aware: Uses hex tile coordinate system for visibility sampling
 * 
 * This stylized water shader uses:
 * - UV-scrolling patterns for gentle surface animation
 * - Layered caustic/ripple effects
 * - Gradient-based color transitions (deep to shallow)
 * - Soft specular highlights without dramatic waves
 * - Tile visibility from maptiles texture (alpha channel)
 */

/****************************************************************************
 Add animated water mesh for WebGPU renderer using TSL shaders (hex topology).
****************************************************************************/
function add_quality_dependent_objects_webgpu() {
  // Get hex height factor from HexConfig (centralized configuration)
  const hexHeightFactor = (typeof window !== 'undefined' && window.HexConfig) 
    ? window.HexConfig.HEIGHT_FACTOR 
    : HEX_HEIGHT_FACTOR;
  
  // Create water plane geometry matching land mesh dimensions
  // Lower segment count (64x64) - stylized water doesn't need high tessellation
  const waterGeometry = new THREE.PlaneGeometry(
    mapview_model_width,
    mapview_model_height * hexHeightFactor,
    64,
    64
  );
  
  const waterMaterial = createWaterMaterialTSL();
  
  water_hq = new THREE.Mesh(waterGeometry, waterMaterial);
  water_hq.rotation.x = -Math.PI * 0.5;
  water_hq.translateOnAxis(new THREE.Vector3(0, 0, 1).normalize(), 50);
  water_hq.translateOnAxis(new THREE.Vector3(1, 0, 0).normalize(), Math.floor(mapview_model_width / 2) - 500);
  water_hq.translateOnAxis(new THREE.Vector3(0, 1, 0).normalize(), -Math.floor(mapview_model_height * hexHeightFactor / 2));
  water_hq.renderOrder = -1;
  water_hq.castShadow = false;
  water_hq.name = "water_surface";
  scene.add(water_hq);
  console.log("Added stylized game water surface (hex topology).");

  // Add a large black ground plane 100 units below the terrain mesh to soften the map border edge
  const groundGeometry = new THREE.PlaneGeometry(
    mapview_model_width * 10,   // 10x map width so it extends far beyond the terrain edge
    mapview_model_height * hexHeightFactor * 10,  // 10x map height so it extends far beyond the terrain edge
    1,
    1
  );
  const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.rotation.x = -Math.PI * 0.5;
  groundMesh.translateOnAxis(new THREE.Vector3(0, 0, 1).normalize(), -100);  // 100 units below terrain base
  groundMesh.translateOnAxis(new THREE.Vector3(1, 0, 0).normalize(), Math.floor(mapview_model_width / 2) - 500);  // centre to match land mesh
  groundMesh.translateOnAxis(new THREE.Vector3(0, 1, 0).normalize(), -Math.floor(mapview_model_height * hexHeightFactor / 2));  // centre to match land mesh
  groundMesh.renderOrder = -2;
  groundMesh.castShadow = false;
  groundMesh.name = "black_ground_plane";
  scene.add(groundMesh);
  console.log("Added black ground plane (hex topology).");
}

/****************************************************************************
 Create stylized water material using TSL (Three.js Shading Language).
 
 Stylized approach inspired by strategy games (Civilization, Age of Empires):
 - No big animated waves - instead uses subtle UV-scrolling patterns
 - Layered caustic/cell-noise for visual interest
 - Smooth color gradients from deep ocean to shallow coastal waters
 - Gentle specular highlights that don't dominate the scene
 - Works well at various camera distances and angles
 - Hex-aware: Uses hexagonal tile coordinate system for visibility sampling
****************************************************************************/
function createWaterMaterialTSL() {
  const { uniform, uv, vec2, vec3, vec4, sin, cos, mix, fract, clamp, pow, sqrt, mul, add, sub, abs, floor, texture, mod, max, div, step } = THREE;
  
  // Time uniform for animation
  const timeUniform = uniform(0.0);
  window.waterTimeUniform = timeUniform;
  
  const uvNode = uv();
  
  // ==== MAP TILE VISIBILITY SYSTEM ====
  // Access maptiles texture for visibility (uses global maptiletypes texture)
  // Visibility is stored in alpha channel: 0=unknown, ~0.541=fogged, 1.0=visible
  const maptilesTex = maptiletypes;
  const map_x_size = uniform(map['xsize']);
  const map_y_size = uniform(map['ysize']);
  
  // Hexagonal tile constants from HexConfig (centralized configuration)
  const hexConfig = window.HexConfig || {
    SQRT3_OVER_2: 0.866025,
    HEIGHT_FACTOR: Math.sqrt(3) / 2
  };
  const HEX_SQRT3_OVER_2 = hexConfig.SQRT3_OVER_2; // sqrt(3)/2
  const HEX_MESH_HEIGHT_FACTOR = HEX_SQRT3_OVER_2;
  const HEX_ASPECT = 1.0 / HEX_MESH_HEIGHT_FACTOR; // ~1.1547
  
  // Calculate which tile row we're in (used for stagger offset)
  const tileYRaw = mul(map_y_size, uvNode.y);
  const tileY = floor(tileYRaw);
  
  // Hex stagger: odd rows offset by 0.5 tile width
  // Mesh row parity: (map_y_size - 1 - tileY) % 2 determines odd row offset
  const isOddRow = mod(sub(sub(map_y_size, 1.0), tileY), 2.0);
  
  // Calculate hex-adjusted UV coordinates
  const hexOffsetX = mul(isOddRow, div(0.5, map_x_size));
  const hexUvX = sub(uvNode.x, hexOffsetX);
  
  // Calculate tile coordinates
  const tileXRaw = mul(map_x_size, hexUvX);
  const tileX = floor(tileXRaw);
  
  // Calculate tile center UV for visibility sampling
  const tileCenterX = div(add(tileX, 0.5), map_x_size);
  const tileCenterY = div(add(tileY, 0.5), map_y_size);
  // Re-apply stagger offset for correct texture sampling
  const tileCenterXWithStagger = add(tileCenterX, hexOffsetX);
  const tileCenterUV = vec2(tileCenterXWithStagger, tileCenterY);
  
  // Sample visibility from maptiles texture alpha channel
  const tileVisibility = texture(maptilesTex, tileCenterUV).a;
  
  // Visibility scale factor (matches terrain shader VISIBILITY_VISIBLE = 1.10)
  const VISIBILITY_VISIBLE = 1.10;
  const visibility = mul(tileVisibility, VISIBILITY_VISIBLE);
  
  // ==== COLOR PALETTE (Stylized Game Colors from WaterConfig) ====
  const waterConfig = window.WaterConfig || null;
  const deepOcean = waterConfig 
    ? vec3(waterConfig.COLORS.DEEP_OCEAN.r, waterConfig.COLORS.DEEP_OCEAN.g, waterConfig.COLORS.DEEP_OCEAN.b)
    : vec3(0.05, 0.14, 0.32);
  const midOcean = waterConfig
    ? vec3(waterConfig.COLORS.MID_OCEAN.r, waterConfig.COLORS.MID_OCEAN.g, waterConfig.COLORS.MID_OCEAN.b)
    : vec3(0.10, 0.28, 0.50);
  const shallowWater = waterConfig
    ? vec3(waterConfig.COLORS.SHALLOW.r, waterConfig.COLORS.SHALLOW.g, waterConfig.COLORS.SHALLOW.b)
    : vec3(0.18, 0.50, 0.60);
  const surfaceHighlight = waterConfig
    ? vec3(waterConfig.COLORS.SURFACE.r, waterConfig.COLORS.SURFACE.g, waterConfig.COLORS.SURFACE.b)
    : vec3(0.35, 0.60, 0.72);
  const causticColor = waterConfig
    ? vec3(waterConfig.COLORS.CAUSTIC.r, waterConfig.COLORS.CAUSTIC.g, waterConfig.COLORS.CAUSTIC.b)
    : vec3(0.50, 0.75, 0.85);
  
  // ==== PROCEDURAL NOISE FUNCTIONS ====
  // Simple hash function for pseudo-random values
  function hash(p) {
    return fract(mul(sin(mul(p, 127.1)), 43758.5453));
  }
  
  // Smooth noise using hash
  function noise2D(x, y) {
    const ix = floor(x);
    const iy = floor(y);
    const fx = fract(x);
    const fy = fract(y);
    
    // Smooth interpolation curve
    const ux = mul(mul(fx, fx), sub(3.0, mul(2.0, fx)));
    const uy = mul(mul(fy, fy), sub(3.0, mul(2.0, fy)));
    
    // Corner values
    const a = hash(add(ix, mul(iy, 157.0)));
    const b = hash(add(add(ix, 1.0), mul(iy, 157.0)));
    const c = hash(add(ix, mul(add(iy, 1.0), 157.0)));
    const d = hash(add(add(ix, 1.0), mul(add(iy, 1.0), 157.0)));
    
    // Bilinear interpolation
    const mixAB = mix(a, b, ux);
    const mixCD = mix(c, d, ux);
    return mix(mixAB, mixCD, uy);
  }
  
  // ==== CAUSTIC PATTERN ====
  // Creates cell-like caustic patterns that slowly drift
  const causticScale = waterConfig ? waterConfig.CAUSTICS.SCALE : 12.0;
  const causticSpeed = waterConfig ? waterConfig.CAUSTICS.SPEED : 0.08;
  
  // Layer 1: Primary caustic pattern
  const causticU1 = add(mul(uvNode.x, causticScale), mul(timeUniform, causticSpeed));
  const causticV1 = add(mul(uvNode.y, causticScale), mul(timeUniform, mul(causticSpeed, 0.7)));
  const caustic1 = noise2D(causticU1, causticV1);
  
  // Layer 2: Secondary caustic (different scale and direction)
  const causticU2 = sub(mul(uvNode.x, mul(causticScale, 1.5)), mul(timeUniform, mul(causticSpeed, 0.5)));
  const causticV2 = add(mul(uvNode.y, mul(causticScale, 1.3)), mul(timeUniform, mul(causticSpeed, 0.3)));
  const caustic2 = noise2D(causticU2, causticV2);
  
  // Combine caustics for cell-like pattern
  const causticPattern = mul(add(caustic1, caustic2), 0.5);
  const causticIntensity = clamp(mul(sub(causticPattern, 0.3), 2.5), 0.0, 1.0);
  
  // ==== GENTLE SURFACE RIPPLES ====
  // Very subtle ripple movement (not waves, just surface shimmer)
  const rippleScale = waterConfig ? waterConfig.RIPPLES.SCALE : 25.0;
  const rippleSpeed = waterConfig ? waterConfig.RIPPLES.SPEED : 0.15;
  const rippleAmplitude = waterConfig ? waterConfig.RIPPLES.AMPLITUDE : 0.1;
  
  const ripple1 = sin(add(mul(add(mul(uvNode.x, 1.0), mul(uvNode.y, 0.5)), rippleScale), mul(timeUniform, rippleSpeed)));
  const ripple2 = sin(add(mul(add(mul(uvNode.x, 0.7), mul(uvNode.y, 1.0)), mul(rippleScale, 0.8)), mul(timeUniform, mul(rippleSpeed, 1.3))));
  const rippleValue = mul(add(ripple1, ripple2), rippleAmplitude);
  
  // ==== BASE COLOR GRADIENT ====
  // Create natural variation using position and ripples
  const positionFactor = mul(add(uvNode.x, uvNode.y), 0.3);
  const variation = add(positionFactor, rippleValue);
  const normalizedVariation = clamp(add(0.5, mul(variation, 0.2)), 0.0, 1.0);
  
  // Three-way gradient: deep -> mid -> shallow
  const deepToMid = mix(deepOcean, midOcean, clamp(mul(normalizedVariation, 1.5), 0.0, 1.0));
  const baseColor = mix(deepToMid, shallowWater, clamp(sub(mul(normalizedVariation, 1.5), 0.5), 0.0, 1.0));
  
  // ==== ADD CAUSTIC HIGHLIGHTS ====
  // Caustics brighten the water subtly
  const causticIntensityFactor = waterConfig ? waterConfig.CAUSTICS.INTENSITY : 0.15;
  const colorWithCaustics = mix(baseColor, causticColor, mul(causticIntensity, causticIntensityFactor));
  
  // ==== GENTLE SPECULAR ====
  // Soft sun reflection based on ripples (not dramatic)
  const specularPower = waterConfig ? waterConfig.SPECULAR.POWER : 8.0;
  const specularIntensity = waterConfig ? waterConfig.SPECULAR.INTENSITY : 0.08;
  const specularBase = clamp(add(rippleValue, 0.5), 0.0, 1.0);
  const specular = mul(pow(specularBase, specularPower), specularIntensity);
  const specularTint = mul(vec3(1.0, 0.98, 0.95), specular);
  
  // ==== SURFACE SHIMMER ====
  // Adds subtle brightness variation across the surface
  const shimmerScale = waterConfig ? waterConfig.SHIMMER.SCALE : 40.0;
  const shimmerSpeed = waterConfig ? waterConfig.SHIMMER.SPEED : 0.2;
  const shimmerIntensity = waterConfig ? waterConfig.SHIMMER.INTENSITY : 0.03;
  const shimmerU = add(mul(uvNode.x, shimmerScale), mul(timeUniform, shimmerSpeed));
  const shimmerV = add(mul(uvNode.y, mul(shimmerScale, 0.875)), mul(timeUniform, mul(shimmerSpeed, 0.75)));
  const shimmer = mul(fract(mul(sin(add(shimmerU, shimmerV)), 43758.5)), shimmerIntensity);
  
  // ==== EDGE DARKENING (Vignette) ====
  // Slight darkening at edges for depth
  // Use Chebyshev distance (max(|cx|,|cy|)) instead of Euclidean sqrt for better
  // performance and a square falloff that matches tile-based game viewports.
  const edgeDarkenStrength = waterConfig ? waterConfig.EDGE.DARKEN : 0.15;
  const edgeMax = waterConfig ? waterConfig.EDGE.MAX : 0.1;
  const cx = sub(uvNode.x, 0.5);
  const cy = sub(uvNode.y, 0.5);
  const edgeDist = max(abs(cx), abs(cy));
  const edgeDarken = clamp(mul(edgeDist, edgeDarkenStrength), 0.0, edgeMax);
  
  // ==== FINAL COMPOSITION ====
  const colorWithSpecular = add(colorWithCaustics, specularTint);
  const colorWithShimmer = add(colorWithSpecular, vec3(shimmer, shimmer, shimmer));
  const colorBeforeVisibility = sub(colorWithShimmer, vec3(edgeDarken, edgeDarken, edgeDarken));
  
  // Apply 24.2% brightness boost to water (1.15 * 1.08) for better visibility and more natural appearance
  const waterBrightnessBoost = 1.242;
  const brightenedWaterColor = mul(colorBeforeVisibility, waterBrightnessBoost);
  
  // Apply tile visibility - unknown tiles render as black
  // visibility ranges from 0 (unknown/black) to 1.10 (fully visible with brightness boost)
  const finalColor = mul(brightenedWaterColor, visibility);
  
  // Constant opacity for clean, game-like appearance
  const opacity = waterConfig ? waterConfig.OPACITY.BASE : 0.72;
  
  // Create material
  const waterMaterial = new THREE.MeshBasicNodeMaterial();
  waterMaterial.colorNode = vec4(finalColor, opacity);
  waterMaterial.transparent = true;
  waterMaterial.side = THREE.DoubleSide;
  waterMaterial.depthWrite = false;
  
  return waterMaterial;
}

/****************************************************************************
 Update water animation time uniform. Called from render loop.
****************************************************************************/
function updateWaterAnimation(deltaTime) {
  if (window.waterTimeUniform && window.waterTimeUniform.value !== undefined) {
    window.waterTimeUniform.value += deltaTime;
    // Wrap time to prevent float precision loss in sin() after long play sessions.
    // 1000 seconds keeps values well within float32 precision range.
    if (window.waterTimeUniform.value > 1000.0) {
      window.waterTimeUniform.value -= 1000.0;
    }
  }
}
