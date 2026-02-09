/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2017  The Freeciv-web project

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
 * Animation Module for WebGPU
 * 
 * Handles animated objects in the 3D scene including:
 * - Unit movement animations (with optional Rapier.js physics)
 * - Spaceship launch animations
 * - Explosion effects
 * - Nuclear detonation effects
 * 
 * Physics Integration:
 * When Rapier.js physics is enabled, unit movement uses kinematic physics bodies
 * for smoother, more natural motion with proper interpolation.
 */

/** @type {Object.<number, Object>} Map of unit ID to animation data */
const anim_objs = {};

/** @type {Object.<number, Object>} Map of unit ID to physics animation target data */
const physics_anim_targets = {};

/****************************************************************************
 Updates unit movement animation.
 Uses Rapier.js physics when available for smoother movement.
****************************************************************************/
function update_animated_objects()
{
  // Step physics simulation if enabled
  if (typeof stepPhysics === 'function' && typeof isPhysicsEnabled === 'function' && isPhysicsEnabled()) {
    stepPhysics();
  }
  
  for (var unit_id in anim_objs) {

    var punit = units[anim_objs[unit_id]['unit']];
    var mesh = anim_objs[unit_id]['mesh'];
    var flag = anim_objs[unit_id]['flag'];

    if (punit == null || mesh == null) {
      // Cleanup physics body when unit is removed
      if (typeof removeUnitPhysicsBody === 'function') {
        removeUnitPhysicsBody(parseInt(unit_id));
      }
      delete physics_anim_targets[unit_id];
      delete anim_objs[unit_id];
      continue;
    }
    var anim_list = punit['anim_list'];
    if (anim_list[0] == null || anim_list[1] == null) {
      delete physics_anim_targets[unit_id];
      delete anim_objs[unit_id];
      continue;
    }

    var tile_start = tiles[anim_list[0]['tile']];
    var tile_end = tiles[anim_list[1]['tile']];
    var pos_start = map_to_scene_coords(tile_start['x'], tile_start['y']);
    var pos_end = map_to_scene_coords(tile_end['x'], tile_end['y']);
    
    // Check if physics-based movement is available
    var usePhysics = typeof isPhysicsEnabled === 'function' && isPhysicsEnabled() &&
                     typeof setUnitPhysicsTarget === 'function' &&
                     typeof syncMeshWithPhysics === 'function';
    
    if (usePhysics) {
      // Physics-based movement using Rapier.js
      update_unit_with_physics(unit_id, punit, mesh, flag, tile_start, tile_end, pos_start, pos_end, anim_list);
    } else {
      // Fallback to classic frame-based movement
      update_unit_classic(unit_id, punit, mesh, flag, tile_start, tile_end, pos_start, pos_end, anim_list);
    }
  }

  if (spaceship_launched != null) {
    spaceship_launched.translateOnAxis(new THREE.Vector3(0,1,0).normalize(), spaceship_speed);
    spaceship_speed = spaceship_speed * spaceship_acc;
    if (spaceship_launched.position.y > 10000) {
      scene.remove(spaceship_launched);
      spaceship_launched = null;
      spaceship_speed = 1;
    }

  }

  if (nuke_objects.length > 0) {
    animate_nuke();
  }

}

/****************************************************************************
 Update unit position using Rapier.js physics for smooth interpolated movement.
 Kinematic bodies are controlled by setting target positions.
****************************************************************************/
function update_unit_with_physics(unit_id, punit, mesh, flag, tile_start, tile_end, pos_start, pos_end, anim_list) {
  var unitIdNum = parseInt(unit_id);
  
  // Calculate target position
  var height_start = 5 + tile_start['height'] * 100 + get_unit_height_offset(punit);
  var height_end = 5 + tile_end['height'] * 100 + get_unit_height_offset(punit);
  
  // Store or update target position for physics
  if (!physics_anim_targets[unit_id]) {
    physics_anim_targets[unit_id] = {
      targetX: pos_end['x'] + HEX_CENTER_OFFSET_X,
      targetY: height_end - 2,
      targetZ: pos_end['y'] + HEX_CENTER_OFFSET_Y,
      startX: pos_start['x'] + HEX_CENTER_OFFSET_X,
      startY: height_start - 2,
      startZ: pos_start['y'] + HEX_CENTER_OFFSET_Y,
      progress: 0
    };
    
    // Create physics body if it doesn't exist
    if (typeof createUnitPhysicsBody === 'function' && !getUnitPhysicsBody(unitIdNum)) {
      createUnitPhysicsBody(unitIdNum, {
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z
      });
    }
  }
  
  var target = physics_anim_targets[unit_id];
  
  // Calculate interpolation progress based on ANIM_STEPS
  var totalSteps = ANIM_STEPS;
  var currentStep = totalSteps - anim_list[0]['i'];
  var t = currentStep / totalSteps;
  
  // Apply easing for smoother movement (ease-out cubic)
  var easedT = 1 - Math.pow(1 - t, 3);
  
  // Interpolate position
  var interpX = target.startX + (target.targetX - target.startX) * easedT;
  var interpY = target.startY + (target.targetY - target.startY) * easedT;
  var interpZ = target.startZ + (target.targetZ - target.startZ) * easedT;
  
  // Set physics target (kinematic body will move towards this)
  if (typeof setUnitPhysicsTarget === 'function') {
    setUnitPhysicsTarget(unitIdNum, { x: interpX, y: interpY, z: interpZ });
  }
  
  // Sync mesh with physics body (with interpolation for extra smoothness)
  var lerpFactor = typeof PhysicsConfig !== 'undefined' ? PhysicsConfig.POSITION_LERP : 0.15;
  if (typeof syncMeshWithPhysics === 'function') {
    syncMeshWithPhysics(mesh, unitIdNum, lerpFactor);
  } else {
    // Fallback: directly interpolate mesh position
    mesh.position.x += (interpX - mesh.position.x) * lerpFactor;
    mesh.position.y += (interpY - mesh.position.y) * lerpFactor;
    mesh.position.z += (interpZ - mesh.position.z) * lerpFactor;
  }
  
  // Update rotation to face movement direction
  var rotation = convert_unit_rotation(punit['facing'], unit_type(punit)['name']);
  mesh.rotation.y = rotation;
  mesh.updateMatrix();
  
  // Update flag position to follow unit
  if (flag != null) {
    flag.position.x = mesh.position.x + 5;
    flag.position.y = mesh.position.y + 20;
    flag.position.z = mesh.position.z - 8;
    flag.updateMatrix();
  }
  
  // Handle animation progress
  anim_list[0]['i'] = anim_list[0]['i'] - 1;
  if (anim_list[0]['i'] == 0) {
    punit['anim_list'].splice(0, 1);
    if (punit['anim_list'].length == 1) {
      punit['anim_list'].splice(0, 1);
    }
    // Reset physics target for next segment
    delete physics_anim_targets[unit_id];
  }
  if (anim_list.length <= 1) {
    punit['anim_list'] = [];
    delete physics_anim_targets[unit_id];
    delete anim_objs[unit_id];
    update_unit_position(tile_end);
  }
}

/****************************************************************************
 Classic frame-based unit movement (fallback when physics is disabled).
****************************************************************************/
function update_unit_classic(unit_id, punit, mesh, flag, tile_start, tile_end, pos_start, pos_end, anim_list) {
    var delta_x = (pos_end['x'] - pos_start['x'])  / ANIM_STEPS;
    var delta_y = (pos_end['y'] - pos_start['y'])  / ANIM_STEPS;
    var delta_z = ((tile_end['height'] - tile_start['height']) * 100) / ANIM_STEPS;

    mesh.rotateOnAxis(new THREE.Vector3(0,1,0).normalize(), -1 * (convert_unit_rotation(punit['facing'], unit_type(punit)['name'])));
    mesh.translateOnAxis(new THREE.Vector3(1,0,0).normalize(), delta_x);
    mesh.translateOnAxis(new THREE.Vector3(0,1,0).normalize(), delta_z);
    mesh.translateOnAxis(new THREE.Vector3(0,0,1).normalize(), delta_y);
    mesh.rotateOnAxis(new THREE.Vector3(0,1,0).normalize(), (convert_unit_rotation(punit['facing'], unit_type(punit)['name'])));
    mesh.updateMatrix();

    if (flag != null) {
      flag.translateOnAxis(new THREE.Vector3(1,0,0).normalize(), delta_x);
      flag.translateOnAxis(new THREE.Vector3(0,1,0).normalize(), delta_z);
      flag.translateOnAxis(new THREE.Vector3(0,0,1).normalize(), delta_y);
      flag.updateMatrix();
    }

    anim_list[0]['i'] = anim_list[0]['i'] - 1;
    if (anim_list[0]['i'] == 0) {
      punit['anim_list'].splice(0, 1);
      if (punit['anim_list'].length == 1) {
        punit['anim_list'].splice(0, 1);
      }
    }
    if (anim_list.length <= 1) {
      punit['anim_list'] = [];
      delete anim_objs[unit_id];
      update_unit_position(tile_end);
    }
}


/****************************************************************************
 Renders an explosion animation on the given tile.
****************************************************************************/
function animate_explosion_on_tile(tile_id, animation_frame)
{
  if (scene == null) return;
  
  var ptile = tiles[tile_id];
  if (ptile == null) return;

  var height = 5 + ptile['height'] * 100;

  if (ptile['explosion_mesh'] != null) {
    scene.remove(ptile['explosion_mesh']);
    ptile['explosion_mesh'] = null;
  }
  if (animation_frame == 5) {
    scene.remove(ptile['explosion_mesh']);
    ptile['explosion_mesh'] = null;
    return;
  }

  var explosion_mesh = create_unit_explosion_sprite(animation_frame);
  var pos = map_to_scene_coords(ptile['x'], ptile['y']);
  explosion_mesh.position.set(pos['x'] + HEX_CENTER_OFFSET_X - 6, height + 8, pos['y'] + HEX_CENTER_OFFSET_Y - 6);
  ptile['explosion_mesh'] = explosion_mesh;
  explosion_mesh.name = "Explosion";
  scene.add(explosion_mesh);

  if (animation_frame <= 4) setTimeout("animate_explosion_on_tile(" + tile_id + "," + (animation_frame + 1) + ")", 350);

}