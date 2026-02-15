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
 * Water Module for WebGPU
 * 
 * Handles animated water rendering using TSL (Three.js Shading Language).
 * 
 * Design goals (Stylized Game Water - Civ-style):
 * - Calm: Gentle, subtle movement instead of big ocean waves
 * - Stylized: Color gradients and caustic patterns for visual interest
 * - Fast: Efficient shader without heavy wave calculations
 * - Game-appropriate: Works well at top-down/isometric strategy game camera angles
 * 
 * This stylized water shader uses:
 * - UV-scrolling patterns for gentle surface animation
 * - Layered caustic/ripple effects
 * - Gradient-based color transitions (deep to shallow)
 * - Soft specular highlights without dramatic waves
 */

/****************************************************************************
 Add animated water mesh for WebGPU renderer using TSL shaders.
****************************************************************************/
function add_quality_dependent_objects_webgpu() {
  // Create water plane geometry matching land mesh dimensions
  // Lower segment count (64x64) - stylized water doesn't need high tessellation
  var waterGeometry = new THREE.PlaneGeometry(
    mapview_model_width,
    mapview_model_height * HEX_HEIGHT_FACTOR,
    64,
    64
  );
  
  var waterMaterial = createWaterMaterialTSL();
  
  water_hq = new THREE.Mesh(waterGeometry, waterMaterial);
  water_hq.rotation.x = -Math.PI * 0.5;
  water_hq.translateOnAxis(new THREE.Vector3(0, 0, 1).normalize(), 50);
  water_hq.translateOnAxis(new THREE.Vector3(1, 0, 0).normalize(), Math.floor(mapview_model_width / 2) - 500);
  water_hq.translateOnAxis(new THREE.Vector3(0, 1, 0).normalize(), -Math.floor(mapview_model_height * HEX_HEIGHT_FACTOR / 2));
  water_hq.renderOrder = -1;
  water_hq.castShadow = false;
  water_hq.name = "water_surface";
  scene.add(water_hq);
  console.log("Added stylized game water surface.");
}

/****************************************************************************
 Create stylized water material using TSL (Three.js Shading Language).
 
 Stylized approach inspired by strategy games (Civilization, Age of Empires):
 - No big animated waves - instead uses subtle UV-scrolling patterns
 - Layered caustic/cell-noise for visual interest
 - Smooth color gradients from deep ocean to shallow coastal waters
 - Gentle specular highlights that don't dominate the scene
 - Works well at various camera distances and angles
****************************************************************************/
function createWaterMaterialTSL() {
  const { uniform, uv, vec3, vec4, sin, cos, mix, fract, clamp, pow, sqrt, mul, add, sub, abs, floor } = THREE;
  
  // Time uniform for animation
  const timeUniform = uniform(0.0);
  window.waterTimeUniform = timeUniform;
  
  const uvNode = uv();
  
  // ==== COLOR PALETTE (Stylized Game Colors) ====
  const deepOcean = vec3(0.04, 0.12, 0.28);     // Deep blue
  const midOcean = vec3(0.08, 0.25, 0.45);      // Medium blue
  const shallowWater = vec3(0.15, 0.45, 0.55);  // Teal/turquoise
  const surfaceHighlight = vec3(0.35, 0.60, 0.72); // Light surface tint
  const causticColor = vec3(0.50, 0.75, 0.85);  // Caustic highlight
  
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
  const causticScale = 12.0;
  const causticSpeed = 0.08;  // Very slow movement
  
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
  const rippleScale = 25.0;
  const rippleSpeed = 0.15;
  
  const ripple1 = sin(add(mul(add(mul(uvNode.x, 1.0), mul(uvNode.y, 0.5)), rippleScale), mul(timeUniform, rippleSpeed)));
  const ripple2 = sin(add(mul(add(mul(uvNode.x, 0.7), mul(uvNode.y, 1.0)), mul(rippleScale, 0.8)), mul(timeUniform, mul(rippleSpeed, 1.3))));
  const rippleValue = mul(add(ripple1, ripple2), 0.1);  // Very subtle
  
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
  const colorWithCaustics = mix(baseColor, causticColor, mul(causticIntensity, 0.15));
  
  // ==== GENTLE SPECULAR ====
  // Soft sun reflection based on ripples (not dramatic)
  const specularBase = clamp(add(rippleValue, 0.5), 0.0, 1.0);
  const specular = mul(pow(specularBase, 8.0), 0.08);  // Very soft
  const specularTint = mul(vec3(1.0, 0.98, 0.95), specular);
  
  // ==== SURFACE SHIMMER ====
  // Adds subtle brightness variation across the surface
  const shimmerU = add(mul(uvNode.x, 40.0), mul(timeUniform, 0.2));
  const shimmerV = add(mul(uvNode.y, 35.0), mul(timeUniform, 0.15));
  const shimmer = mul(fract(mul(sin(add(shimmerU, shimmerV)), 43758.5)), 0.03);
  
  // ==== EDGE DARKENING (Vignette) ====
  // Slight darkening at edges for depth
  const cx = sub(uvNode.x, 0.5);
  const cy = sub(uvNode.y, 0.5);
  const edgeDist = sqrt(add(mul(cx, cx), mul(cy, cy)));
  const edgeDarken = clamp(mul(edgeDist, 0.15), 0.0, 0.1);
  
  // ==== FINAL COMPOSITION ====
  const colorWithSpecular = add(colorWithCaustics, specularTint);
  const colorWithShimmer = add(colorWithSpecular, vec3(shimmer, shimmer, shimmer));
  const finalColor = sub(colorWithShimmer, vec3(edgeDarken, edgeDarken, edgeDarken));
  
  // Constant opacity for clean, game-like appearance
  const opacity = 0.72;
  
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
  }
}
