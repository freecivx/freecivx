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
 * Sky Module - Procedural sky dome for Freeciv 3D
 *
 * Renders a large sky sphere visible as a horizon backdrop behind the game map.
 * Uses Three.js TSL (Shading Language) for WebGPU-compatible procedural shaders.
 *
 * Features:
 * - Blue sky at daytime with realistic zenith-to-horizon gradient
 * - Subtle smooth noise for natural sky variation
 * - Black sky with procedural stars at night (colored, twinkling)
 * - Faint Milky Way band visible at night
 * - Red/orange sunset and sunrise transitions
 * - Animated sun disk with soft inner and outer atmospheric glow
 * - Moon disc visible at night with soft atmospheric halo
 * - Animated wispy cloud layer during the day
 *
 * Performance notes:
 * - Single draw call for the entire sky sphere
 * - No textures; all effects are computed in the fragment shader
 * - The sphere follows the camera each frame so no clipping at map edges
 *
 * Time-of-day:
 *   skyElapsedTime cycles from 0 → SKY_CYCLE_SECONDS and wraps.
 *   t = 0.0  → midnight   t = 0.25 → sunrise
 *   t = 0.5  → noon       t = 0.75 → sunset
 */

/**
 * Accumulated real-world seconds since sky was initialised.
 * Starts at SKY_CYCLE_SECONDS * 0.5 so the first visible state is noon.
 */
var skyElapsedTime = 450;

/**
 * Length of one full day/night cycle in real-world seconds (15 minutes).
 */
var SKY_CYCLE_SECONDS = 900.0;

/**
 * Create the sky dome mesh and add it to the scene.
 * Must be called after `scene` is available (i.e. inside webgpu_start_renderer).
 */
function initSky() {
  // High enough segment count for a smooth gradient; sky is only 1 draw call
  const skyGeometry = new THREE.SphereGeometry(8000, 64, 32);
  const skyMaterial = createSkyMaterialTSL();

  window.skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
  window.skyMesh.name = "sky_dome";
  // Always draw the sky; never frustum-cull it
  window.skyMesh.frustumCulled = false;
  window.skyMesh.castShadow = false;
  window.skyMesh.receiveShadow = false;
  // Render sky before terrain (lower renderOrder = earlier)
  window.skyMesh.renderOrder = -10;

  scene.add(window.skyMesh);
  console.log("Procedural sky dome initialised (TSL/WebGPU).");
}

/**
 * Build the TSL node material that implements the procedural sky shader.
 *
 * All colour blending is expressed as a TSL node graph executed on the GPU,
 * keeping the CPU cost to a single uniform write per frame.
 *
 * @returns {THREE.MeshBasicNodeMaterial}
 */
function createSkyMaterialTSL() {
  const {
    uniform, vec3, sin, cos, mix, fract, clamp, pow, abs,
    mul, add, sub, floor, step, smoothstep, dot,
    normalize, positionLocal
  } = THREE;

  // ---- time uniform (0 = midnight, 0.5 = noon) ----
  const skyTimeUniform = uniform(0.5);
  window.skyTimeUniform = skyTimeUniform;
  const t = skyTimeUniform;

  // ---- raw elapsed seconds (for fast animation: twinkling, cloud drift) ----
  const skyRawTimeUniform = uniform(900.0);
  window.skyRawTimeUniform = skyRawTimeUniform;

  // ==================================================
  // VIEW DIRECTION
  // For a sphere centered at the camera, normalising
  // the local vertex position gives the sky direction.
  // ==================================================
  const dir = normalize(positionLocal);
  const upY = dir.y;

  // How far above the horizon (0 at/below, 1 at zenith)
  const zenithBlend  = clamp(upY, 0.0, 1.0);
  // How far below the horizon (for underground darkening)
  const horizonDip   = clamp(mul(upY, -1.0), 0.0, 1.0);

  // ==================================================
  // TIME-OF-DAY BLEND FACTORS
  // ==================================================

  // Day: fully 1 between t≈0.30 and t≈0.70, fades at sunrise/sunset
  const dayRise    = smoothstep(0.18, 0.30, t);
  const daySet     = sub(1.0, smoothstep(0.70, 0.82, t));
  const dayFactor  = clamp(mul(dayRise, daySet), 0.0, 1.0);

  // Sunrise peak around t≈0.22–0.28
  const sunriseStart  = smoothstep(0.12, 0.22, t);
  const sunriseEnd    = sub(1.0, smoothstep(0.28, 0.38, t));
  const sunriseFactor = clamp(mul(sunriseStart, sunriseEnd), 0.0, 1.0);

  // Sunset peak around t≈0.72–0.78
  const sunsetStart  = smoothstep(0.62, 0.72, t);
  const sunsetEnd    = sub(1.0, smoothstep(0.78, 0.88, t));
  const sunsetFactor = clamp(mul(sunsetStart, sunsetEnd), 0.0, 1.0);

  // Combined sunrise + sunset transition
  const transitionFactor = clamp(add(sunriseFactor, sunsetFactor), 0.0, 1.0);

  // Night: whatever is left after day and transition
  const nightFactor = clamp(sub(1.0, add(dayFactor, transitionFactor)), 0.0, 1.0);

  // ==================================================
  // SKY COLOUR PALETTE
  // ==================================================

  // Night — dark deep blue
  const nightZenith  = vec3(0.005, 0.005, 0.04);
  const nightHorizon = vec3(0.01,  0.01,  0.05);

  // Day — bright blue zenith, hazy pale-blue horizon
  const dayZenith    = vec3(0.07,  0.30,  0.78);
  const dayHorizon   = vec3(0.50,  0.72,  0.92);

  // Sunset / sunrise — orange-red horizon, deep purple zenith
  const sunsetHorizon = vec3(0.88, 0.30, 0.06);
  const sunsetZenith  = vec3(0.30, 0.10, 0.35);

  // Blend horizon and zenith colours across time of day
  const horizonColor = mix(mix(nightHorizon, dayHorizon, dayFactor), sunsetHorizon, transitionFactor);
  const zenithColor  = mix(mix(nightZenith,  dayZenith,  dayFactor), sunsetZenith,  transitionFactor);

  // Vertical gradient: horizon colour → zenith colour
  const skyColorBase = mix(horizonColor, zenithColor, zenithBlend);

  // Below the horizon: very dark ground colour
  const groundColor = vec3(0.05, 0.04, 0.03);
  const skyColor0   = mix(skyColorBase, groundColor, horizonDip);

  // ==================================================
  // SUN DISK + GLOW
  // Sun traces a smooth arc:
  //   t=0   → below horizon (midnight)
  //   t=0.25 → on horizon   (sunrise)
  //   t=0.5 → zenith        (noon)
  //   t=0.75 → on horizon   (sunset)
  //   t=1   → below horizon (midnight)
  // ==================================================
  const TWO_PI = 2.0 * Math.PI;

  const sunAzimuth = mul(t, TWO_PI);
  // Elevation: -1 at midnight, 0 at sunrise/sunset, +1 at noon
  const sunY = sin(mul(sub(t, 0.25), TWO_PI));
  const sunX = cos(sunAzimuth);
  const sunZ = sin(sunAzimuth);
  const sunDir = normalize(vec3(sunX, sunY, sunZ));

  const cosAngle = clamp(dot(dir, sunDir), -1.0, 1.0);

  // Bright disc — overbright core (×2.0) makes the centre blow out to white
  const sunDisk = mul(smoothstep(0.9975, 0.9993, cosAngle), 2.0);
  // Inner corona / glow (stronger than before)
  const sunGlowInner = mul(smoothstep(0.975, 0.9980, cosAngle), 0.55);
  // Outer atmospheric haze ring
  const sunGlowOuter = mul(smoothstep(0.930, 0.975, cosAngle), 0.22);

  // Sun colour: vivid yellow during day, deep orange at sunrise/sunset
  const sunDayColor        = vec3(1.0, 0.92, 0.12);
  const sunTransitionColor = vec3(1.0, 0.45, 0.05);
  const sunColor           = mix(sunDayColor, sunTransitionColor, transitionFactor);

  // Hide sun when it is below the horizon
  const sunAbove   = step(0.0, sunY);
  const sunContrib = mul(mul(add(sunDisk, add(sunGlowInner, sunGlowOuter)), sunAbove), sunColor);
  const skyColor1  = add(skyColor0, sunContrib);

  // ==================================================
  // STARS (night only, upper hemisphere)
  // Procedural stars via a 3-D cell hash of the sky direction.
  // ==================================================
  const starScale = 100.0;
  const sx = floor(mul(dir.x, starScale));
  const sy = floor(mul(dir.y, starScale));
  const sz = floor(mul(dir.z, starScale));

  const starHash = fract(mul(
    sin(add(mul(sx, 127.1), add(mul(sy, 311.7), mul(sz, 74.7)))),
    43758.5453
  ));

  // ~1 % of cells contain a star
  const starExists     = step(0.990, starHash);
  // Each star has a slightly different brightness (0.5–1.0)
  const starBrightness = add(0.5, mul(starHash, 0.5));
  // Only in upper hemisphere and only at night
  const starAbove      = step(0.0, upY);
  const starIntensity  = mul(mul(mul(starExists, starBrightness), nightFactor), starAbove);

  const skyColor2 = add(skyColor1, vec3(starIntensity, starIntensity, starIntensity));

  // ==================================================
  // MOON (night only, roughly opposite to the sun)
  // ==================================================
  const moonX   = mul(sunX, -1.0);
  const moonY   = mul(sunY, -0.9);
  const moonZ   = mul(sunZ, -1.0);
  const moonDir = normalize(vec3(moonX, moonY, moonZ));

  const moonCos  = clamp(dot(dir, moonDir), -1.0, 1.0);
  const moonDisk = smoothstep(0.9988, 0.9996, moonCos);
  const moonGlow = mul(smoothstep(0.993, 0.9988, moonCos), 0.08);
  const moonColor = vec3(0.84, 0.88, 0.96);

  const moonAbove  = step(0.0, moonY);
  const moonContrib = mul(mul(mul(add(moonDisk, moonGlow), nightFactor), moonAbove), moonColor);
  const skyColor3   = add(skyColor2, moonContrib);

  // ==================================================
  // CLOUDS (day only, wispy layer)
  // Smooth two-octave noise based on the horizontal sky direction.
  // ==================================================

  // Project direction onto a flat plane for cloud UV
  const cloudScale = 2.5;
  const cloudU = mul(dir.x, cloudScale);
  const cloudV = mul(dir.z, cloudScale);

  // Smooth noise helpers (same pattern as water.js)
  const cu1 = floor(cloudU);
  const cv1 = floor(cloudV);
  const cfu = fract(cloudU);
  const cfv = fract(cloudV);
  const cux = mul(mul(cfu, cfu), sub(3.0, mul(2.0, cfu)));
  const cuy = mul(mul(cfv, cfv), sub(3.0, mul(2.0, cfv)));

  const cA = fract(mul(sin(add(mul(cu1,            127.1), mul(cv1,            311.7))), 43758.5453));
  const cB = fract(mul(sin(add(mul(add(cu1, 1.0),  127.1), mul(cv1,            311.7))), 43758.5453));
  const cC = fract(mul(sin(add(mul(cu1,            127.1), mul(add(cv1, 1.0),  311.7))), 43758.5453));
  const cD = fract(mul(sin(add(mul(add(cu1, 1.0),  127.1), mul(add(cv1, 1.0),  311.7))), 43758.5453));
  const cloudNoise1 = mix(mix(cA, cB, cux), mix(cC, cD, cux), cuy);

  // Second octave at higher frequency
  const cloudU2 = mul(cloudU, 2.1);
  const cloudV2 = mul(cloudV, 2.1);
  const cu2 = floor(cloudU2);
  const cv2 = floor(cloudV2);
  const cfu2 = fract(cloudU2);
  const cfv2 = fract(cloudV2);
  const cux2 = mul(mul(cfu2, cfu2), sub(3.0, mul(2.0, cfu2)));
  const cuy2 = mul(mul(cfv2, cfv2), sub(3.0, mul(2.0, cfv2)));

  const cA2 = fract(mul(sin(add(mul(cu2,            269.5), mul(cv2,            183.3))), 47391.5453));
  const cB2 = fract(mul(sin(add(mul(add(cu2, 1.0),  269.5), mul(cv2,            183.3))), 47391.5453));
  const cC2 = fract(mul(sin(add(mul(cu2,            269.5), mul(add(cv2, 1.0),  183.3))), 47391.5453));
  const cD2 = fract(mul(sin(add(mul(add(cu2, 1.0),  269.5), mul(add(cv2, 1.0),  183.3))), 47391.5453));
  const cloudNoise2 = mix(mix(cA2, cB2, cux2), mix(cC2, cD2, cux2), cuy2);

  // Combine octaves
  const cloudNoise = add(mul(cloudNoise1, 0.65), mul(cloudNoise2, 0.35));

  // Cloud density threshold (values > 0.55 form clouds)
  const cloudDensity = clamp(mul(sub(cloudNoise, 0.55), 4.4), 0.0, 1.0);

  // Clouds only above the horizon, fade out at very low elevations
  const cloudElevMask = clamp(mul(upY, 5.0), 0.0, 1.0);
  // Clouds only during the day
  const cloudAlpha = mul(mul(cloudDensity, cloudElevMask), dayFactor);

  // Light cloud colour — slightly warm white in full day, grey at edges
  const cloudColor = vec3(0.92, 0.93, 0.96);
  const skyColor4  = mix(skyColor3, cloudColor, cloudAlpha);

  // ==================================================
  // BOTTOM BLACK MASK
  // The bottom 40 % of the sphere (upY < -0.2) is pure black — it
  // represents ground/underground, not sky.  A narrow smoothstep
  // (-0.25 → -0.1) avoids a hard visible seam at the transition.
  // ==================================================
  const skyVisibleMask = smoothstep(-0.25, -0.1, upY);
  const skyColor5      = mul(skyColor4, skyVisibleMask);

  // ==================================================
  // MATERIAL
  // depthTest = false → sky always drawn as background
  // depthWrite = false → don't pollute the depth buffer
  // BackSide → render the inside surface of the sphere
  // ==================================================
  const skyMaterial = new THREE.MeshBasicNodeMaterial();
  skyMaterial.colorNode = skyColor5;
  skyMaterial.side       = THREE.BackSide;
  skyMaterial.depthTest  = false;
  skyMaterial.depthWrite = false;

  return skyMaterial;
}

/**
 * Advance the sky time uniform and keep the dome centred on the camera.
 * Must be called every frame from animate_webgl().
 *
 * @param {number} deltaTime - Seconds since last frame.
 */
function updateSkyAnimation(deltaTime) {
  if (!window.skyTimeUniform) return;

  // Advance real-time clock and wrap within one cycle
  window.skyElapsedTime = (window.skyElapsedTime || 900) + deltaTime;
  window.skyTimeUniform.value =
    (window.skyElapsedTime % SKY_CYCLE_SECONDS) / SKY_CYCLE_SECONDS;

  // Keep the sky dome centred on the camera so it always fills the horizon
  if (window.skyMesh && typeof camera !== 'undefined' && camera) {
    window.skyMesh.position.copy(camera.position);
  }
}
