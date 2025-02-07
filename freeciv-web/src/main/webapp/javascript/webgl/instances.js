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
const instancedMeshType = {};


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
    const tileIndex = ptile.index;
    const isKnown  = (tile_get_known(ptile) !== TILE_UNKNOWN);

    if (instancedMeshes[tileIndex] == null && isKnown) {
        let height = 3.8 + ptile.height * 100;

        // 2) Load the GLTF scene or retrieve from your existing function
        let gltfSceneOrObj = webgl_get_model(modelname, ptile);
        if (!gltfSceneOrObj) {
            console.warn("No model returned for:", modelname);
            return;
        }
        // Extract the actual Mesh
        let gltfMesh = null;
        if (gltfSceneOrObj.isMesh) {
            gltfMesh = gltfSceneOrObj;
        } else if (gltfSceneOrObj) {
            gltfMesh = findFirstMesh(gltfSceneOrObj);
        }
        if (!gltfMesh) {
            console.warn("No mesh found in GLTF for:", modelname);
            return;
        }

        const { instancedMesh, usedSlots } = getInstancedMeshFromModel(tileIndex, gltfMesh, 30);

        const dummyMatrix = new THREE.Matrix4();
        const dummyQuat   = new THREE.Quaternion();
        const dummyScale  = new THREE.Vector3(scale, scale, scale);

        let pos = map_to_scene_coords(ptile.x, ptile.y);
        for (let i = 0; i < num_models; i++) {

            let instanceID = usedSlots.indexOf(false);
            if (instanceID < 0) {
                break;
            }
            usedSlots[instanceID] = true; // mark it used

            let offsetX = -10 + (12 - Math.floor(Math.random() * 25));
            let offsetZ = -10 + (12 - Math.floor(Math.random() * 25));

            let finalX = pos.x + offsetX;
            let finalY = height + 1.0;
            let finalZ = pos.y + offsetZ;

            // Random rotation on Y, plus a slight tilt in X and Z
            let rotY = 0.5 * Math.PI * Math.random();
            let rotX = (Math.random() - 0.5) * 1.5; // Small tilt on X-axis
            let rotZ = (Math.random() - 0.5) * 1.0; // Small tilt on Z-axis

            dummyQuat.setFromEuler(new THREE.Euler(rotX, rotY, rotZ));

            dummyMatrix.compose(
                new THREE.Vector3(finalX, finalY, finalZ),
                dummyQuat,
                dummyScale
            );

            instancedMesh.setMatrixAt(instanceID, dummyMatrix);

            instancedMeshes[tileIndex] = instancedMesh;
            instancedMeshType[tileIndex] = modelname;
        }

        // Update the InstancedMesh so changes appear
        instancedMesh.instanceMatrix.needsUpdate = true;
    } else if (scene && instancedMeshes[tileIndex] != null) {
        scene.remove(instancedMeshes[tileIndex]);
        instancedMeshes[tileIndex] = null;
        instancedMeshType[tileIndex] = null;
    }
}


/****************************************************************************
 Adds forest or jungle
****************************************************************************/
function update_tile_forest_jungle(ptile) {
    let terrain_name = tile_terrain(ptile).name;

    const tileIndex = ptile.index;

    const isForest = (terrain_name === "Forest");
    const isJungle = (terrain_name === "Jungle");
    const isKnown  = (tile_get_known(ptile) !== TILE_UNKNOWN);

    if (scene && instancedMeshes[tileIndex] == null && (isForest || isJungle) && isKnown) {
        let modelname = "";
        let height = 5.2 + ptile.height * 100 + get_forest_offset(ptile);
        let scale = 20;
        let numTrees = 13;

        if (isForest) {
            instancedMeshType[tileIndex] = "Forest";
            let rnd = Math.floor(Math.random() * 7);
            switch (rnd) {
                case 0:
                    modelname = "Tree1";
                    scale = 18;
                    break;
                case 1:
                    modelname = "Tree2";
                    scale = 18;
                    break;
                case 2:
                    modelname = "Tree3";
                    scale = 9;
                    break;
                case 3:
                    modelname = "Pine1";
                    scale = 40;
                    break;
                case 4:
                case 5:
                case 6:
                    modelname = "Pine3";
                    scale = 4;
                    numTrees = 10;
                    break;
            }
        }

        if (isJungle) {
            instancedMeshType[tileIndex] = "Jungle";
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



        let gltfSceneOrObj = webgl_get_model(modelname, ptile);
        if (!gltfSceneOrObj) {
            return;
        }
        // Extract the actual Mesh
        let gltfMesh = null;
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
        const { instancedMesh, usedSlots } = getInstancedMeshFromModel(tileIndex, gltfMesh, 15);

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
                //console.error("No free slots left in InstancedMesh for", modelname);
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


            instancedMeshes[tileIndex] = instancedMesh;
        }

        // Update the InstancedMesh so changes appear
        instancedMesh.instanceMatrix.needsUpdate = true;
    } else if (scene && instancedMeshes[tileIndex] != null && !isForest && instancedMeshType[tileIndex] == "Forest" && isKnown) {
        scene.remove(instancedMeshes[tileIndex]);
        instancedMeshes[tileIndex] = null;
        instancedMeshType[tileIndex] = null;
    } else if (scene && instancedMeshes[tileIndex] != null && !isJungle && instancedMeshType[tileIndex] == "Jungle" && isKnown) {
        scene.remove(instancedMeshes[tileIndex]);
        instancedMeshes[tileIndex] = null;
        instancedMeshType[tileIndex] = null;
    }
}
