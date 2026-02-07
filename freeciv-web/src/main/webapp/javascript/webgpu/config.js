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
 * WebGPU Configuration Module
 * 
 * Centralized configuration for the Three.js WebGPU renderer.
 * This module provides constants and settings used throughout the rendering pipeline.
 * 
 * Following Three.js best practices:
 * - Centralized constant definitions
 * - Immutable configuration objects
 * - Clear separation of concerns
 */

/**
 * Quality levels for rendering
 * @readonly
 * @enum {number}
 */
const QualityLevel = Object.freeze({
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3
});

/**
 * Camera configuration defaults
 * @readonly
 * @type {Object}
 */
const CameraConfig = Object.freeze({
    /** Field of view in degrees */
    FOV: 45,
    /** Near clipping plane distance */
    NEAR: 1,
    /** Far clipping plane distance */
    FAR: 12000,
    /** Default camera X offset from target */
    DEFAULT_DX: 50,
    /** Default camera Y (height) offset from target */
    DEFAULT_DY: 450,
    /** Default camera Z offset from target */
    DEFAULT_DZ: 320,
    /** Minimum Y zoom level */
    MIN_Y_ZOOM: 250,
    /** Maximum Y zoom level */
    MAX_Y_ZOOM: 2000
});

/**
 * Lighting configuration for the scene
 * Following Three.js WebGPU lighting best practices with physically-based values
 * @readonly
 * @type {Object}
 */
const LightingConfig = Object.freeze({
    /** Ambient light color (hex) */
    AMBIENT_COLOR: 0x606060,
    /** Ambient light intensity (using PI for physically-based lighting) */
    AMBIENT_INTENSITY: 1.2 * Math.PI,
    
    /** Directional light color (hex) */
    DIRECTIONAL_COLOR: 0xffffff,
    /** Directional light intensity */
    DIRECTIONAL_INTENSITY: 2.0 * Math.PI,
    /** Directional light position */
    DIRECTIONAL_POSITION: Object.freeze({ x: 500, y: 800, z: 500 }),
    
    /** Key light color (hex) */
    KEY_LIGHT_COLOR: 0xffffff,
    /** Key light intensity */
    KEY_LIGHT_INTENSITY: 1.0 * Math.PI,
    /** Key light position */
    KEY_LIGHT_POSITION: Object.freeze({ x: 150, y: 280, z: 150 }),
    
    /** Fill light color (hex) */
    FILL_LIGHT_COLOR: 0xffffff,
    /** Fill light intensity */
    FILL_LIGHT_INTENSITY: 0.6 * Math.PI,
    /** Fill light position */
    FILL_LIGHT_POSITION: Object.freeze({ x: -200, y: 180, z: -120 }),
    
    /** Spotlight color (hex) */
    SPOTLIGHT_COLOR: 0xffffff,
    /** Spotlight intensity */
    SPOTLIGHT_INTENSITY: 3.0 * Math.PI,
    /** Spotlight angle in radians */
    SPOTLIGHT_ANGLE: Math.PI / 3,
    /** Spotlight penumbra */
    SPOTLIGHT_PENUMBRA: 0.001,
    /** Spotlight decay */
    SPOTLIGHT_DECAY: 0.5
});

/**
 * Shadow configuration for the renderer
 * @readonly
 * @type {Object}
 */
const ShadowConfig = Object.freeze({
    /** Shadow map resolution */
    MAP_SIZE: 4096,
    /** Shadow camera near plane */
    CAMERA_NEAR: 100,
    /** Shadow camera far plane */
    CAMERA_FAR: 3000,
    /** Shadow camera frustum size */
    FRUSTUM_SIZE: 1500,
    /** Shadow bias to prevent acne */
    BIAS: -0.0005,
    /** Normal bias for peter-panning prevention */
    NORMAL_BIAS: 0.02,
    /** Shadow opacity for high quality */
    OPACITY_HIGH: 0.75,
    /** Shadow opacity for medium quality */
    OPACITY_MEDIUM: 0.55
});

/**
 * Hexagonal tile configuration
 * Based on Civ 6-style pointy-top hexagons
 * Reference: https://www.redblobgames.com/grids/hexagons/
 * @readonly
 * @type {Object}
 */
const HexConfig = Object.freeze({
    /** sqrt(3)/2 - used for hex geometry calculations */
    SQRT3_OVER_2: Math.sqrt(3) / 2,
    /** Width factor for hex tiles */
    WIDTH_FACTOR: 1.0,
    /** Height factor (sqrt(3)/2) for hex row spacing */
    HEIGHT_FACTOR: Math.sqrt(3) / 2,
    /** Horizontal offset for staggered odd rows */
    STAGGER: 0.5,
    /** Edge width for hex border highlighting */
    EDGE_WIDTH: 0.045,
    /** Edge anti-aliasing softness */
    EDGE_SOFTNESS: 0.025,
    /** Edge blend strength (0-1) */
    EDGE_BLEND_STRENGTH: 0.32,
    /** Edge color RGB components */
    EDGE_COLOR: Object.freeze({ r: 0.15, g: 0.12, b: 0.08 })
});

/**
 * Water shader configuration
 * @readonly
 * @type {Object}
 */
const WaterConfig = Object.freeze({
    /** Primary wave settings (ocean swell) */
    WAVE1: Object.freeze({
        DIR: Object.freeze({ x: 1.0, y: 0.3 }),
        FREQ: 8.0,
        SPEED: 0.6,
        AMP: 0.35,
        STEEP: 0.4
    }),
    /** Secondary wave settings (wind waves) */
    WAVE2: Object.freeze({
        DIR: Object.freeze({ x: 0.4, y: 1.0 }),
        FREQ: 12.0,
        SPEED: 0.8,
        AMP: 0.25,
        STEEP: 0.35
    }),
    /** Detail wave settings (ripples) */
    WAVE3: Object.freeze({
        DIR: Object.freeze({ x: -0.6, y: 0.8 }),
        FREQ: 20.0,
        SPEED: 1.2,
        AMP: 0.12,
        STEEP: 0.25
    }),
    /** Micro detail wave settings */
    WAVE4: Object.freeze({
        DIR: Object.freeze({ x: 0.7, y: -0.7 }),
        FREQ: 35.0,
        SPEED: 1.5,
        AMP: 0.06,
        STEEP: 0.2
    }),
    /** Cross wave settings for interference */
    WAVE5: Object.freeze({
        DIR: Object.freeze({ x: -0.3, y: -0.9 }),
        FREQ: 15.0,
        SPEED: 0.9,
        AMP: 0.15,
        STEEP: 0.3
    }),
    /** Specular highlight settings */
    SPECULAR: Object.freeze({
        POWER: 64.0,
        INTENSITY: 0.6,
        TIGHTNESS: 128.0
    }),
    /** Foam settings */
    FOAM: Object.freeze({
        THRESHOLD: 0.25,
        SOFTNESS: 4.0,
        INTENSITY: 0.45,
        NOISE_SCALE: 25.0,
        MOVEMENT: 0.3
    }),
    /** Fresnel effect settings */
    FRESNEL: Object.freeze({
        POWER: 3.0,
        BIAS: 0.1,
        SCALE: 0.6
    }),
    /** Subsurface scattering settings */
    SSS: Object.freeze({
        STRENGTH: 0.35,
        POWER: 2.5
    }),
    /** Caustic pattern settings */
    CAUSTICS: Object.freeze({
        SCALE: 18.0,
        SPEED: 0.4,
        INTENSITY: 0.12
    }),
    /** Opacity settings */
    OPACITY: Object.freeze({
        BASE: 0.65,
        MIN: 0.55,
        MAX: 0.8
    }),
    /** Water color palette */
    COLORS: Object.freeze({
        DEEP_OCEAN: Object.freeze({ r: 0.02, g: 0.08, b: 0.22 }),
        MID_OCEAN: Object.freeze({ r: 0.05, g: 0.18, b: 0.38 }),
        SHALLOW: Object.freeze({ r: 0.12, g: 0.42, b: 0.58 }),
        SURFACE: Object.freeze({ r: 0.18, g: 0.52, b: 0.68 }),
        FOAM: Object.freeze({ r: 0.92, g: 0.97, b: 1.0 }),
        SSS: Object.freeze({ r: 0.15, g: 0.65, b: 0.55 }),
        SKY_REFLECT: Object.freeze({ r: 0.45, g: 0.65, b: 0.85 })
    })
});

/**
 * Terrain type identifiers
 * These values match the terrain encoding in the map tile texture
 * @readonly
 * @enum {number}
 */
const TerrainType = Object.freeze({
    INACCESSIBLE: 0,
    LAKE: 10,
    COAST: 20,
    FLOOR: 30,
    ARCTIC: 40,
    DESERT: 50,
    FOREST: 60,
    GRASSLAND: 70,
    HILLS: 80,
    JUNGLE: 90,
    MOUNTAINS: 100,
    PLAINS: 110,
    SWAMP: 120,
    TUNDRA: 130
});

/**
 * Beach/shore terrain blending configuration
 * @readonly
 * @type {Object}
 */
const BeachConfig = Object.freeze({
    /** Upper limit of beach zone (above = full land texture) */
    HIGH: 52.5,
    /** Lower limit of beach zone blend start */
    BLEND_HIGH: 50.4,
    /** Middle of beach zone (peak sand color) */
    MID: 51.5,
    /** Water surface level */
    WATER_LEVEL: 50.0,
    /** Beach sand color (warm golden sand) */
    SAND_COLOR: Object.freeze({ r: 0.92, g: 0.85, b: 0.65 })
});

/**
 * Animation timing configuration
 * @readonly
 * @type {Object}
 */
const AnimationConfig = Object.freeze({
    /** Default delta time for ~60fps */
    DEFAULT_DELTA_TIME: 0.016,
    /** Maximum delta time to prevent huge jumps */
    MAX_DELTA_TIME: 0.1,
    /** Animation steps for unit movement */
    UNIT_ANIM_STEPS: 10
});

/**
 * Mapview aspect configuration
 * @readonly
 * @type {Object}
 */
const MapviewConfig = Object.freeze({
    /** Aspect factor for mapview model dimensions */
    ASPECT_FACTOR: 35.71
});

// Export configuration objects to global scope for compatibility with existing code
// Note: This project uses script concatenation for bundling, not ES modules.
// The build system (Maven minify plugin) concatenates all JS files into webclient.min.js.
// ES modules are only used for Three.js imports via importmap.
// TODO: Consider migrating to full ES module system in future refactor.
window.QualityLevel = QualityLevel;
window.CameraConfig = CameraConfig;
window.LightingConfig = LightingConfig;
window.ShadowConfig = ShadowConfig;
window.HexConfig = HexConfig;
window.WaterConfig = WaterConfig;
window.TerrainType = TerrainType;
window.BeachConfig = BeachConfig;
window.AnimationConfig = AnimationConfig;
window.MapviewConfig = MapviewConfig;
