/**********************************************************************
 Freecivx - the web version of Freeciv. http://www.FreecivX.net/
 Copyright (C) 2009-2025  The Freeciv-web project

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


const instancedMeshes = {};
const tile_forest_instance_indices = {};

/****************************************************************************
 Returns THREE.InstancedMesh based on provided model and mesh.
****************************************************************************/
function getInstancedMeshFromModel(modelName, gltfMesh, capacity = 30) {
    // If we already have an instanced mesh for this model, return it
    if (instancedMeshes[modelName]) {
        return instancedMeshes[modelName];
    }

    // Otherwise, create a new InstancedMesh from the geometry and material.
    const geometry = gltfMesh.geometry;
    const material = gltfMesh.material;
    const instancedMesh = new THREE.InstancedMesh(geometry, material, capacity);
    instancedMesh.castShadow = true;

    // Mark all slots as free initially
    const usedSlots = new Array(capacity).fill(false);

    // Save in our global dictionary
    instancedMeshes[modelName] = {
        instancedMesh,
        usedSlots,
        capacity
    };

    // Add to the scene once
    scene.add(instancedMesh);

    return instancedMeshes[modelName];
}

/****************************************************************************
 Returns first mesh from the object.
****************************************************************************/
function findFirstMesh(root) {
    let found = null;
    root.traverse((child) => {
        if (child.isMesh && !found) {
            found = child;
        }
    });
    return found;
}

/****************************************************************************
 Adds instanced model
****************************************************************************/
function update_tile_model_instancing(modelname, ptile, num_models, scale) {
    let terrain_name = tile_terrain(ptile).name;

    // Key for tile_forest_instance_indices
    const tileIndex = ptile.index;

    const isKnown  = (tile_get_known(ptile) !== TILE_UNKNOWN);

    if (!tile_forest_instance_indices[tileIndex]) {
        let height = 3.8 + ptile.height * 100;

        // 2) Load the GLTF scene or retrieve from your existing function
        let gltfSceneOrObj = webgl_get_model(modelname, ptile);
        if (!gltfSceneOrObj) {
            console.warn("No model returned for:", modelname);
            return;
        }
        // Extract the actual Mesh
        let gltfMesh = null;
        // If it's already a Mesh, great; else traverse
        if (gltfSceneOrObj.isMesh) {
            gltfMesh = gltfSceneOrObj;
        } else if (gltfSceneOrObj) {
            gltfMesh = findFirstMesh(gltfSceneOrObj);
        }
        if (!gltfMesh) {
            console.warn("No mesh found in GLTF for:", modelname);
            return;
        }

        // 3) Get or create the InstancedMesh for this tree model
        const { instancedMesh, usedSlots } = getInstancedMeshFromModel(modelname + tileIndex, gltfMesh, num_models);

        // We'll store the list of instance references for this tile
        tile_forest_instance_indices[tileIndex] = [];

        // We'll use dummy objects for transforms
        const dummyMatrix = new THREE.Matrix4();
        const dummyQuat   = new THREE.Quaternion();
        const dummyScale  = new THREE.Vector3(scale, scale, scale);

        // 4) Place each tree instance
        let pos = map_to_scene_coords(ptile.x, ptile.y);
        for (let i = 0; i < num_models; i++) {

            // Find a free slot
            let instanceID = usedSlots.indexOf(false);
            if (instanceID < 0) {
                console.error("No free slots left in InstancedMesh for", modelname);
                break;
            }
            usedSlots[instanceID] = true; // mark it used

            // Random offset
            let offsetX = -10 + (12 - Math.floor(Math.random() * 25));
            let offsetZ = -10 + (12 - Math.floor(Math.random() * 25));

            let finalX = pos.x + offsetX;
            let finalY = height;
            let finalZ = pos.y + offsetZ;

            // Random rotation around Y
            let rotY = 2 * Math.PI * Math.random();
            dummyQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);

            // Compose transform
            dummyMatrix.compose(
                new THREE.Vector3(finalX, finalY, finalZ),
                dummyQuat,
                dummyScale
            );

            // Set matrix for this instance
            instancedMesh.setMatrixAt(instanceID, dummyMatrix);

            // Remember which slot belongs to this tile
            tile_forest_instance_indices[tileIndex].push({ modelName: modelname, instanceID });
        }

        // Update the InstancedMesh so changes appear
        instancedMesh.instanceMatrix.needsUpdate = true;
    } else if (scene && tile_forest_instance_indices[tileIndex]) {
        // For each instance in tile_forest_instance_indices[tileIndex], free it
        const usedList = tile_forest_instance_indices[tileIndex];
        usedList.forEach(({ modelName, instanceID }) => {
            // Access that instanced mesh
            let entry = instancedMeshes[modelName];
            if (!entry) return; // should not happen unless the model was never created

            entry.usedSlots[instanceID] = false;
            // Optionally clear its matrix so it disappears
            entry.instancedMesh.setMatrixAt(instanceID, new THREE.Matrix4());
            entry.instancedMesh.instanceMatrix.needsUpdate = true;
        });

        // Clear our tile->instances mapping
        tile_forest_instance_indices[tileIndex] = null;
    }
}



/****************************************************************************
 Adds forest or jungle
****************************************************************************/
function update_tile_forest_jungle(ptile) {
    let terrain_name = tile_terrain(ptile).name;

    // Key for tile_forest_instance_indices
    const tileIndex = ptile.index;

    const isForest = (terrain_name === "Forest");
    const isJungle = (terrain_name === "Jungle");
    const isKnown  = (tile_get_known(ptile) !== TILE_UNKNOWN);

    // If tile is forest AND no instances yet, place them
    if (scene && !tile_forest_instance_indices[tileIndex] && (isForest || isJungle) && isKnown) {
        let modelname = "";
        let height = 5.2 + ptile.height * 100 + get_forest_offset(ptile);
        let scale = 20;
        if (isForest) {
            let rnd = Math.floor(Math.random() * 5);
            switch (rnd) {
                case 0:
                    modelname = "Tree1";
                    scale = 20;
                    break;
                case 1:
                    modelname = "Tree2";
                    scale = 20;
                    break;
                case 2:
                    modelname = "Tree3";
                    scale = 10;
                    break;
                case 3:
                    modelname = "Pine1";
                    scale = 40;
                    break;
                case 4:
                    modelname = "Pine1";
                    scale = 40;
                    break;
            }
        }

        if (isJungle) {
                let rnd = Math.floor(Math.random() * 2);
                switch (rnd) {
                    case 0:
                        modelname = "Palm1";
                        scale = 20;
                        break;
                    case 1:
                        modelname = "Palm2";
                        scale = 20;
                        break;
                }
        }

        let numTrees = 20;

        // 2) Load the GLTF scene or retrieve from your existing function
        let gltfSceneOrObj = webgl_get_model(modelname, ptile);
        if (!gltfSceneOrObj) {
            return;
        }
        // Extract the actual Mesh
        let gltfMesh = null;
        // If it's already a Mesh, great; else traverse
        if (gltfSceneOrObj.isMesh) {
            gltfMesh = gltfSceneOrObj;
        } else if (gltfSceneOrObj) {
            gltfMesh = findFirstMesh(gltfSceneOrObj);
        }
        if (!gltfMesh) {
            console.warn("No mesh found in GLTF for:", modelname);
            return;
        }

        // 3) Get or create the InstancedMesh for this tree model
        const { instancedMesh, usedSlots } = getInstancedMeshFromModel(modelname + tileIndex, gltfMesh, 20);

        // We'll store the list of instance references for this tile
        tile_forest_instance_indices[tileIndex] = [];

        // We'll use dummy objects for transforms
        const dummyMatrix = new THREE.Matrix4();
        const dummyQuat   = new THREE.Quaternion();
        const dummyScale  = new THREE.Vector3(scale, scale, scale);

        // 4) Place each tree instance
        let pos = map_to_scene_coords(ptile.x, ptile.y);
        for (let i = 0; i < numTrees; i++) {

            // Find a free slot
            let instanceID = usedSlots.indexOf(false);
            if (instanceID < 0) {
                console.error("No free slots left in InstancedMesh for", modelname);
                break;
            }
            usedSlots[instanceID] = true; // mark it used

            // Random offset
            let offsetX = -10 + (12 - Math.floor(Math.random() * 25));
            let offsetZ = -10 + (12 - Math.floor(Math.random() * 25));

            let finalX = pos.x + offsetX;
            let finalY = height;
            let finalZ = pos.y + offsetZ;

            // Random rotation around Y
            let rotY = 2 * Math.PI * Math.random();
            dummyQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);

            // Compose transform
            dummyMatrix.compose(
                new THREE.Vector3(finalX, finalY, finalZ),
                dummyQuat,
                dummyScale
            );

            // Set matrix for this instance
            instancedMesh.setMatrixAt(instanceID, dummyMatrix);

            // Remember which slot belongs to this tile
            tile_forest_instance_indices[tileIndex].push({ modelName: modelname, instanceID });
        }

        // Update the InstancedMesh so changes appear
        instancedMesh.instanceMatrix.needsUpdate = true;
    }
    // 5) Otherwise if tile is NOT forest, but we have instance references, free them
    else if (scene && tile_forest_instance_indices[tileIndex] && !isForest && isKnown) {
        // For each instance in tile_forest_instance_indices[tileIndex], free it
        const usedList = tile_forest_instance_indices[tileIndex];
        usedList.forEach(({ modelName, instanceID }) => {
            // Access that instanced mesh
            let entry = instancedMeshes[modelName];
            if (!entry) return; // should not happen unless the model was never created

            entry.usedSlots[instanceID] = false;
            // Optionally clear its matrix so it disappears
            entry.instancedMesh.setMatrixAt(instanceID, new THREE.Matrix4());
            entry.instancedMesh.instanceMatrix.needsUpdate = true;
        });

        // Clear our tile->instances mapping
        tile_forest_instance_indices[tileIndex] = null;
    }
}