/**********************************************************************
    FreecivWorld.net - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2026  The Freeciv-web project

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
 * Raytracing Configuration Module
 * 
 * Configuration for the real-time raytracing renderer inspired by
 * THREE.js-RayTracing-Renderer (https://github.com/erichlof/THREE.js-RayTracing-Renderer)
 * 
 * This module provides settings for:
 * - Real reflections on water and metallic surfaces
 * - Ray-traced shadows with soft edges
 * - Specular highlights with physically-based rendering
 * - Depth of field effects (optional)
 * 
 * The raytracing is implemented using Three.js TSL (Three.js Shading Language)
 * for WebGPU compatibility and real-time performance.
 */

/**
 * Raytracing quality levels
 * @readonly
 * @enum {number}
 */
const RaytracingQuality = Object.freeze({
    /** Low quality - fewer ray bounces, simpler effects */
    LOW: 1,
    /** Medium quality - balanced performance and visuals */
    MEDIUM: 2,
    /** High quality - maximum ray bounces, full effects */
    HIGH: 3
});

/**
 * Material types for raytracing
 * Based on THREE.js-RayTracing-Renderer material system
 * @readonly
 * @enum {number}
 */
const RaytracingMaterialType = Object.freeze({
    /** Diffuse Phong material - standard surfaces */
    PHONG: 0,
    /** Metal material - high reflectivity */
    METAL: 1,
    /** ClearCoat material - glossy with subsurface color */
    CLEARCOAT: 2,
    /** Transparent material - glass, water with refraction */
    TRANSPARENT: 3
});

/**
 * Raytracing renderer configuration
 * @readonly
 * @type {Object}
 */
const RaytracingConfig = Object.freeze({
    /** Maximum ray bounce depth (reflections/refractions) */
    MAX_BOUNCES: Object.freeze({
        LOW: 1,
        MEDIUM: 2,
        HIGH: 4
    }),
    
    /** Shadow configuration */
    SHADOWS: Object.freeze({
        /** Enable soft shadows */
        SOFT_SHADOWS: true,
        /** Shadow softness factor (0 = hard, 1 = very soft) */
        SOFTNESS: 0.015,
        /** Shadow bias to prevent acne */
        BIAS: 0.001,
        /** Number of shadow samples for soft shadows */
        SAMPLES: Object.freeze({
            LOW: 1,
            MEDIUM: 4,
            HIGH: 8
        })
    }),
    
    /** Reflection configuration */
    REFLECTIONS: Object.freeze({
        /** Base reflectivity for water surfaces */
        WATER_REFLECTIVITY: 0.4,
        /** Base reflectivity for metallic surfaces */
        METAL_REFLECTIVITY: 0.85,
        /** Fresnel effect strength */
        FRESNEL_STRENGTH: 0.5,
        /** Reflection blur for rough surfaces */
        BLUR: Object.freeze({
            LOW: 0.1,
            MEDIUM: 0.05,
            HIGH: 0.02
        })
    }),
    
    /** Refraction configuration for transparent materials */
    REFRACTION: Object.freeze({
        /** Index of refraction for water */
        WATER_IOR: 1.33,
        /** Index of refraction for glass */
        GLASS_IOR: 1.5,
        /** Refraction color tint for water */
        WATER_TINT: Object.freeze({ r: 0.15, g: 0.45, b: 0.55 })
    }),
    
    /** Specular highlight configuration */
    SPECULAR: Object.freeze({
        /** Specular power (shininess) */
        POWER: 32.0,
        /** Specular intensity */
        INTENSITY: 0.6,
        /** Specular color */
        COLOR: Object.freeze({ r: 1.0, g: 0.98, b: 0.95 })
    }),
    
    /** Sun/directional light for raytracing */
    SUN: Object.freeze({
        /** Sun direction (normalized) */
        DIRECTION: Object.freeze({ x: 0.5, y: 0.8, z: 0.5 }),
        /** Sun color */
        COLOR: Object.freeze({ r: 1.0, g: 0.98, b: 0.9 }),
        /** Sun intensity */
        INTENSITY: 1.5
    }),
    
    /** Sky configuration for environment reflections */
    SKY: Object.freeze({
        /** Sky color at zenith */
        ZENITH_COLOR: Object.freeze({ r: 0.4, g: 0.6, b: 1.0 }),
        /** Sky color at horizon */
        HORIZON_COLOR: Object.freeze({ r: 0.7, g: 0.8, b: 0.95 }),
        /** Ground color for reflections looking down */
        GROUND_COLOR: Object.freeze({ r: 0.3, g: 0.25, b: 0.2 })
    }),
    
    /** Depth of field configuration (optional feature) */
    DEPTH_OF_FIELD: Object.freeze({
        /** Enable depth of field */
        ENABLED: false,
        /** Focal distance from camera */
        FOCAL_DISTANCE: 500,
        /** Aperture size (larger = more blur) */
        APERTURE: 0.05
    })
});

/**
 * Global raytracing state
 */
var raytracing_enabled = false;
var raytracing_quality = RaytracingQuality.MEDIUM;

/**
 * Check if raytracing is enabled
 * @returns {boolean} True if raytracing mode is active
 */
function is_raytracing_enabled() {
    return raytracing_enabled === true;
}

/**
 * Enable or disable raytracing mode
 * @param {boolean} enabled - True to enable raytracing
 */
function set_raytracing_enabled(enabled) {
    raytracing_enabled = enabled;
    simpleStorage.set("raytracing_enabled", enabled);
    console.log("Raytracing " + (enabled ? "enabled" : "disabled"));
}

/**
 * Get current raytracing quality level
 * @returns {number} Current quality level from RaytracingQuality enum
 */
function get_raytracing_quality() {
    return raytracing_quality;
}

/**
 * Set raytracing quality level
 * @param {number} quality - Quality level from RaytracingQuality enum
 */
function set_raytracing_quality(quality) {
    raytracing_quality = quality;
    simpleStorage.set("raytracing_quality", quality);
    console.log("Raytracing quality set to: " + quality);
}

/**
 * Load raytracing settings from storage
 */
function load_raytracing_settings() {
    var stored_enabled = simpleStorage.get("raytracing_enabled", "");
    if (stored_enabled !== null && stored_enabled !== "") {
        raytracing_enabled = stored_enabled === true || stored_enabled === "true";
    }
    
    // Check URL parameter override
    if (window.renderer_type_override === "raytracing") {
        raytracing_enabled = true;
    }
    
    var stored_quality = simpleStorage.get("raytracing_quality", "");
    if (stored_quality !== null && stored_quality > 0) {
        raytracing_quality = parseInt(stored_quality);
    }
}

// Export to global scope for compatibility with existing code
window.RaytracingQuality = RaytracingQuality;
window.RaytracingMaterialType = RaytracingMaterialType;
window.RaytracingConfig = RaytracingConfig;
window.raytracing_enabled = raytracing_enabled;
window.raytracing_quality = raytracing_quality;
window.is_raytracing_enabled = is_raytracing_enabled;
window.set_raytracing_enabled = set_raytracing_enabled;
window.get_raytracing_quality = get_raytracing_quality;
window.set_raytracing_quality = set_raytracing_quality;
window.load_raytracing_settings = load_raytracing_settings;
