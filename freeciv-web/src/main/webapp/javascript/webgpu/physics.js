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
 * Physics Module for WebGPU (Rapier.js Integration)
 * 
 * Handles physics simulation for 3D objects in the scene including:
 * - Unit movement with physics-based animation
 * - Kinematic body control for game units
 * - Smooth interpolated movement between tiles
 * 
 * Uses Rapier.js WASM physics engine for efficient physics simulation.
 * 
 * @see https://rapier.rs/docs/user_guides/javascript/getting_started_js/
 */

// Physics world instance (Rapier.js)
var physicsWorld = null;

// Physics enabled flag
var physicsEnabled = false;

// Map of unit IDs to their physics rigid bodies
var unitPhysicsBodies = {};

// Map of unit IDs to their physics colliders
var unitPhysicsColliders = {};

// RAPIER module reference (set after async init)
var RAPIER = null;

/**
 * Physics configuration
 * @readonly
 * @type {Object}
 */
const PhysicsConfig = Object.freeze({
    /** Gravity vector (minimal for strategy game - units don't "fall") */
    GRAVITY: Object.freeze({ x: 0.0, y: -0.5, z: 0.0 }),
    
    /** Physics timestep (60 FPS fixed) */
    TIMESTEP: 1.0 / 60.0,
    
    /** Unit movement speed (units per second) */
    UNIT_MOVE_SPEED: 120.0,
    
    /** Unit body size for collider */
    UNIT_BODY_SIZE: Object.freeze({ x: 8.0, y: 12.0, z: 8.0 }),
    
    /** Linear damping for smooth stopping */
    LINEAR_DAMPING: 5.0,
    
    /** Angular damping to prevent spinning */
    ANGULAR_DAMPING: 10.0,
    
    /** Position interpolation factor (0-1, higher = snappier) */
    POSITION_LERP: 0.15,
    
    /** Rotation interpolation factor (0-1, higher = snappier) */
    ROTATION_LERP: 0.1,
    
    /** Maximum velocity for units */
    MAX_VELOCITY: 200.0,
    
    /** Minimum distance to consider unit "arrived" at target */
    ARRIVAL_THRESHOLD: 2.0
});

// Export physics config to global scope
window.PhysicsConfig = PhysicsConfig;

/**
 * Initialize the Rapier physics engine
 * Must be called before any physics operations
 * 
 * @returns {Promise<boolean>} True if physics initialized successfully
 */
async function initPhysics() {
    if (physicsEnabled && physicsWorld) {
        console.log("Physics already initialized");
        return true;
    }
    
    try {
        // Check if RAPIER is available globally (loaded via ES module)
        if (window.RAPIER) {
            RAPIER = window.RAPIER;
        } else {
            console.log("RAPIER not available globally, physics disabled");
            return false;
        }
        
        // Initialize the RAPIER WASM module
        await RAPIER.init();
        
        // Create physics world with gravity
        const gravity = PhysicsConfig.GRAVITY;
        physicsWorld = new RAPIER.World(gravity);
        
        physicsEnabled = true;
        console.log("Rapier.js physics engine initialized successfully");
        
        return true;
    } catch (error) {
        console.log("Failed to initialize physics engine:", error);
        physicsEnabled = false;
        return false;
    }
}

/**
 * Check if physics is enabled and ready
 * @returns {boolean} True if physics is enabled
 */
function isPhysicsEnabled() {
    return physicsEnabled && physicsWorld !== null;
}

/**
 * Create a kinematic physics body for a unit
 * Kinematic bodies are controlled by game logic but can interact with physics world
 * 
 * @param {number} unitId - The unit's unique ID
 * @param {Object} position - Initial position {x, y, z}
 * @returns {Object|null} The created rigid body or null if physics disabled
 */
function createUnitPhysicsBody(unitId, position) {
    if (!isPhysicsEnabled() || !RAPIER) {
        return null;
    }
    
    // Remove existing body if any
    removeUnitPhysicsBody(unitId);
    
    try {
        // Create kinematic body description
        // KinematicPositionBased - we control the position directly
        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(position.x, position.y, position.z)
            .setLinearDamping(PhysicsConfig.LINEAR_DAMPING)
            .setAngularDamping(PhysicsConfig.ANGULAR_DAMPING);
        
        // Create the rigid body in the physics world
        const rigidBody = physicsWorld.createRigidBody(bodyDesc);
        
        // Create a box collider for the unit
        const colliderDesc = RAPIER.ColliderDesc.cuboid(
            PhysicsConfig.UNIT_BODY_SIZE.x / 2,
            PhysicsConfig.UNIT_BODY_SIZE.y / 2,
            PhysicsConfig.UNIT_BODY_SIZE.z / 2
        );
        
        const collider = physicsWorld.createCollider(colliderDesc, rigidBody);
        
        // Store references
        unitPhysicsBodies[unitId] = rigidBody;
        unitPhysicsColliders[unitId] = collider;
        
        return rigidBody;
    } catch (error) {
        console.error("Failed to create physics body for unit " + unitId + ":", error);
        return null;
    }
}

/**
 * Remove physics body for a unit
 * 
 * @param {number} unitId - The unit's unique ID
 */
function removeUnitPhysicsBody(unitId) {
    if (!isPhysicsEnabled()) {
        return;
    }
    
    try {
        // Remove collider first
        if (unitPhysicsColliders[unitId]) {
            physicsWorld.removeCollider(unitPhysicsColliders[unitId], true);
            delete unitPhysicsColliders[unitId];
        }
        
        // Remove rigid body
        if (unitPhysicsBodies[unitId]) {
            physicsWorld.removeRigidBody(unitPhysicsBodies[unitId]);
            delete unitPhysicsBodies[unitId];
        }
    } catch (error) {
        console.error("Failed to remove physics body for unit " + unitId + ":", error);
    }
}

/**
 * Get the physics body for a unit
 * 
 * @param {number} unitId - The unit's unique ID
 * @returns {Object|null} The rigid body or null if not found
 */
function getUnitPhysicsBody(unitId) {
    return unitPhysicsBodies[unitId] || null;
}

/**
 * Set target position for a kinematic unit body
 * The body will smoothly move toward this position
 * 
 * @param {number} unitId - The unit's unique ID
 * @param {Object} targetPosition - Target position {x, y, z}
 */
function setUnitPhysicsTarget(unitId, targetPosition) {
    if (!isPhysicsEnabled()) {
        return;
    }
    
    const body = unitPhysicsBodies[unitId];
    if (body) {
        try {
            // For kinematic bodies, we set the next kinematic position directly
            body.setNextKinematicTranslation({
                x: targetPosition.x,
                y: targetPosition.y,
                z: targetPosition.z
            });
        } catch (error) {
            console.error("Failed to set physics target for unit " + unitId + ":", error);
        }
    }
}

/**
 * Get current physics position for a unit
 * 
 * @param {number} unitId - The unit's unique ID
 * @returns {Object|null} Position {x, y, z} or null if not found
 */
function getUnitPhysicsPosition(unitId) {
    if (!isPhysicsEnabled()) {
        return null;
    }
    
    const body = unitPhysicsBodies[unitId];
    if (body) {
        try {
            const translation = body.translation();
            return {
                x: translation.x,
                y: translation.y,
                z: translation.z
            };
        } catch (error) {
            return null;
        }
    }
    return null;
}

/**
 * Step the physics simulation forward
 * Should be called once per frame
 */
function stepPhysics() {
    if (!isPhysicsEnabled()) {
        return;
    }
    
    try {
        physicsWorld.step();
    } catch (error) {
        console.error("Physics step error:", error);
    }
}

/**
 * Update physics for animated units
 * Calculates interpolated positions for smooth movement
 * 
 * @param {Object} animData - Animation data containing unit, mesh, target positions
 * @param {number} deltaTime - Time since last update in seconds
 * @returns {Object|null} Updated position {x, y, z} or null if physics disabled
 */
function updateUnitPhysicsAnimation(animData, deltaTime) {
    if (!isPhysicsEnabled() || !animData || !animData.unit) {
        return null;
    }
    
    const unitId = animData.unit;
    const targetPos = animData.targetPosition;
    
    if (!targetPos) {
        return null;
    }
    
    // Set the target position for the kinematic body
    setUnitPhysicsTarget(unitId, targetPos);
    
    // Step physics to update positions
    stepPhysics();
    
    // Return the interpolated position from physics
    return getUnitPhysicsPosition(unitId);
}

/**
 * Cleanup all physics bodies and world
 * Should be called when leaving the game
 */
function cleanupPhysics() {
    if (!physicsWorld) {
        return;
    }
    
    try {
        // Remove all unit bodies
        for (const unitId in unitPhysicsBodies) {
            removeUnitPhysicsBody(parseInt(unitId));
        }
        
        // Clear the physics world
        physicsWorld.free();
        physicsWorld = null;
        physicsEnabled = false;
        
        console.log("Physics engine cleaned up");
    } catch (error) {
        console.error("Error during physics cleanup:", error);
    }
}

/**
 * Sync a Three.js mesh position with its physics body
 * 
 * @param {Object} mesh - Three.js mesh to sync
 * @param {number} unitId - Unit ID for physics body lookup
 * @param {number} lerpFactor - Interpolation factor (0-1)
 */
function syncMeshWithPhysics(mesh, unitId, lerpFactor) {
    if (!isPhysicsEnabled() || !mesh) {
        return;
    }
    
    const physicsPos = getUnitPhysicsPosition(unitId);
    if (physicsPos) {
        // Interpolate mesh position toward physics position
        mesh.position.x += (physicsPos.x - mesh.position.x) * lerpFactor;
        mesh.position.y += (physicsPos.y - mesh.position.y) * lerpFactor;
        mesh.position.z += (physicsPos.z - mesh.position.z) * lerpFactor;
        mesh.updateMatrix();
    }
}

/**
 * Calculate distance between two 3D points
 * 
 * @param {Object} pos1 - First position {x, y, z}
 * @param {Object} pos2 - Second position {x, y, z}
 * @returns {number} Distance between points
 */
function calculateDistance3D(pos1, pos2) {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Check if unit has arrived at target position
 * 
 * @param {number} unitId - Unit ID
 * @param {Object} targetPos - Target position {x, y, z}
 * @returns {boolean} True if unit is close enough to target
 */
function hasUnitArrivedAtTarget(unitId, targetPos) {
    const currentPos = getUnitPhysicsPosition(unitId);
    if (!currentPos || !targetPos) {
        return true; // Assume arrived if no data
    }
    
    const distance = calculateDistance3D(currentPos, targetPos);
    return distance < PhysicsConfig.ARRIVAL_THRESHOLD;
}

// Export functions to global scope for use by other modules
window.initPhysics = initPhysics;
window.isPhysicsEnabled = isPhysicsEnabled;
window.createUnitPhysicsBody = createUnitPhysicsBody;
window.removeUnitPhysicsBody = removeUnitPhysicsBody;
window.getUnitPhysicsBody = getUnitPhysicsBody;
window.setUnitPhysicsTarget = setUnitPhysicsTarget;
window.getUnitPhysicsPosition = getUnitPhysicsPosition;
window.stepPhysics = stepPhysics;
window.updateUnitPhysicsAnimation = updateUnitPhysicsAnimation;
window.cleanupPhysics = cleanupPhysics;
window.syncMeshWithPhysics = syncMeshWithPhysics;
window.hasUnitArrivedAtTarget = hasUnitArrivedAtTarget;
