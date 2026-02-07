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
 * Material Factory Module for WebGPU
 * 
 * Provides centralized material creation and conversion functions for the
 * Three.js WebGPU renderer. This module follows Three.js best practices:
 * - Factory pattern for material creation
 * - Automatic WebGL to WebGPU material conversion
 * - Consistent material property handling
 * - Memory-efficient material caching where appropriate
 */

/**
 * Checks if the current renderer is a WebGPU renderer
 * @returns {boolean} True if WebGPU renderer is active
 */
function isWebGPURenderer() {
    return typeof maprenderer !== 'undefined' && 
           maprenderer && 
           maprenderer.isWebGPURenderer;
}

/**
 * Converts a standard Three.js material to a WebGPU-compatible node material.
 * This is the central conversion function used throughout the codebase.
 * 
 * @param {THREE.Material} originalMaterial - The source material to convert
 * @param {Object} options - Optional configuration
 * @param {boolean} [options.doubleSided=true] - Whether to render both sides
 * @param {boolean} [options.flatShading=false] - Whether to use flat shading
 * @returns {THREE.MeshStandardNodeMaterial} WebGPU-compatible node material
 * 
 * @example
 * const nodeMat = convertToNodeMaterial(mesh.material);
 * mesh.material = nodeMat;
 */
function convertToNodeMaterial(originalMaterial, options = {}) {
    const {
        doubleSided = true,
        flatShading = false
    } = options;
    
    // Create a new MeshStandardNodeMaterial with lighting support
    const nodeMaterial = new THREE.MeshStandardNodeMaterial();
    
    // Copy common properties from original material
    if (originalMaterial.map) {
        nodeMaterial.map = originalMaterial.map;
    }
    
    if (originalMaterial.color) {
        nodeMaterial.color.copy(originalMaterial.color);
    }
    
    if (originalMaterial.emissive) {
        nodeMaterial.emissive.copy(originalMaterial.emissive);
    }
    
    if (originalMaterial.emissiveIntensity !== undefined) {
        nodeMaterial.emissiveIntensity = originalMaterial.emissiveIntensity;
    }
    
    if (originalMaterial.roughness !== undefined) {
        nodeMaterial.roughness = originalMaterial.roughness;
    }
    
    if (originalMaterial.metalness !== undefined) {
        nodeMaterial.metalness = originalMaterial.metalness;
    }
    
    if (originalMaterial.opacity !== undefined) {
        nodeMaterial.opacity = originalMaterial.opacity;
    }
    
    if (originalMaterial.transparent !== undefined) {
        nodeMaterial.transparent = originalMaterial.transparent;
    }
    
    // Apply configuration options
    nodeMaterial.side = doubleSided ? THREE.DoubleSide : THREE.FrontSide;
    nodeMaterial.flatShading = flatShading;
    
    // MeshStandardNodeMaterial automatically detects and uses scene lights
    // when used with WebGPU renderer - no manual lightsNode configuration needed
    
    return nodeMaterial;
}

/**
 * Converts all materials in a model's hierarchy to WebGPU-compatible node materials.
 * Traverses the entire scene graph and converts each mesh's material.
 * 
 * @param {THREE.Object3D} model - The root object to traverse
 * @param {Object} options - Optional configuration passed to convertToNodeMaterial
 * @returns {THREE.Object3D} The same model with converted materials
 * 
 * @example
 * const model = gltfLoader.parse(data);
 * if (isWebGPURenderer()) {
 *     convertModelMaterials(model);
 * }
 */
function convertModelMaterials(model, options = {}) {
    if (!isWebGPURenderer()) {
        return model;
    }
    
    model.traverse((node) => {
        if (node.isMesh && node.material) {
            node.material = convertToNodeMaterial(node.material, options);
            node.material.needsUpdate = true;
        }
    });
    
    return model;
}

/**
 * Creates a basic color material for WebGPU with optional transparency.
 * 
 * @param {number} color - Hex color value (e.g., 0xff0000)
 * @param {Object} options - Material options
 * @param {boolean} [options.transparent=false] - Enable transparency
 * @param {number} [options.opacity=1.0] - Opacity value (0-1)
 * @param {boolean} [options.depthWrite=true] - Whether to write to depth buffer
 * @returns {THREE.MeshBasicMaterial|THREE.MeshBasicNodeMaterial} The created material
 */
function createBasicMaterial(color, options = {}) {
    const {
        transparent = false,
        opacity = 1.0,
        depthWrite = true
    } = options;
    
    const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: transparent,
        opacity: opacity,
        depthWrite: depthWrite
    });
    
    return material;
}

/**
 * Creates a line material for WebGPU rendering.
 * 
 * @param {number} color - Hex color value
 * @param {Object} options - Material options
 * @param {number} [options.linewidth=1] - Line width (note: limited support in WebGL)
 * @param {boolean} [options.dashed=false] - Whether to use dashed lines
 * @returns {THREE.LineBasicMaterial|THREE.LineDashedMaterial} The created material
 */
function createLineMaterial(color, options = {}) {
    const {
        linewidth = 1,
        dashed = false
    } = options;
    
    if (dashed) {
        return new THREE.LineDashedMaterial({
            color: color,
            linewidth: linewidth
        });
    }
    
    return new THREE.LineBasicMaterial({
        color: color,
        linewidth: linewidth
    });
}

/**
 * Creates a shadow-receiving material for terrain overlays.
 * 
 * @param {Object} options - Material options
 * @param {number} [options.opacity=0.5] - Shadow opacity
 * @returns {THREE.ShadowMaterial} The shadow material
 */
function createShadowMaterial(options = {}) {
    const { opacity = 0.5 } = options;
    
    const material = new THREE.ShadowMaterial();
    material.opacity = opacity;
    
    return material;
}

/**
 * Creates a sprite material for labels and UI elements.
 * 
 * @param {THREE.Texture} texture - The sprite texture
 * @param {Object} options - Material options
 * @param {boolean} [options.transparent=true] - Enable transparency
 * @param {boolean} [options.depthTest=true] - Enable depth testing
 * @param {boolean} [options.depthWrite=false] - Write to depth buffer
 * @returns {THREE.SpriteMaterial} The created sprite material
 */
function createSpriteMaterial(texture, options = {}) {
    const {
        transparent = true,
        depthTest = true,
        depthWrite = false
    } = options;
    
    return new THREE.SpriteMaterial({
        map: texture,
        transparent: transparent,
        depthTest: depthTest,
        depthWrite: depthWrite
    });
}

/**
 * Creates a ring geometry material (used for city worked tiles, etc.)
 * 
 * @param {number} color - Hex color value
 * @param {Object} options - Material options
 * @param {boolean} [options.transparent=true] - Enable transparency
 * @param {number} [options.opacity=0.4] - Opacity value
 * @returns {THREE.MeshBasicMaterial} The created material
 */
function createRingMaterial(color, options = {}) {
    const {
        transparent = true,
        opacity = 0.4
    } = options;
    
    return new THREE.MeshBasicMaterial({
        color: color,
        transparent: transparent,
        opacity: opacity
    });
}

// Export functions to global scope for compatibility with existing code
// Note: This project uses script concatenation for bundling, not ES modules.
// The build system (Maven minify plugin) concatenates all JS files into webclient.min.js.
// ES modules are only used for Three.js imports via importmap.
// TODO: Consider migrating to full ES module system in future refactor.
window.isWebGPURenderer = isWebGPURenderer;
window.convertToNodeMaterial = convertToNodeMaterial;
window.convertModelMaterials = convertModelMaterials;
window.createBasicMaterial = createBasicMaterial;
window.createLineMaterial = createLineMaterial;
window.createShadowMaterial = createShadowMaterial;
window.createSpriteMaterial = createSpriteMaterial;
window.createRingMaterial = createRingMaterial;
