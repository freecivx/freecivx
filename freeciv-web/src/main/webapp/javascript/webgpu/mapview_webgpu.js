/**********************************************************************
 FreecivX.net - the web version of Freeciv. http://www.FreecivX.net/
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


/****************************************************************************
 Start the FreecivX WebGPU renderer
 ****************************************************************************/
function webgpu_start_renderer()
{
    var new_mapview_width = $(window).width() - width_offset;
    var new_mapview_height;
    if (!is_small_screen()) {
        new_mapview_height = $(window).height() - height_offset;
    } else {
        new_mapview_height = $(window).height() - height_offset - 40;
    }
    console.log("Three.js " + THREE.REVISION);
    console.log("WebGPU experimental renderer.");
    THREE.ColorManagement.enabled = true;
    container = document.getElementById('mapcanvas');
    camera = new THREE.PerspectiveCamera( 45, new_mapview_width / new_mapview_height, 1, 12000 );
    scene = new THREE.Scene();
    raycaster = new THREE.Raycaster();
    raycaster.layers.set(6);
    mouse = new THREE.Vector2();
    clock = new THREE.Clock();
    // Lights
    var ambientLight = new THREE.AmbientLight( 0x606060, 26 * Math.PI );
    scene.add(ambientLight);
    spotlight = new THREE.SpotLight( 0xffffff, 2.9 * Math.PI, 0, Math.PI / 3, 0.001, 0.5);
    scene.add( spotlight );
    var enable_antialiasing = graphics_quality >= QUALITY_MEDIUM;
    var stored_antialiasing_setting = simpleStorage.get("antialiasing_setting", "");
    if (stored_antialiasing_setting != null && stored_antialiasing_setting == "false") {
        enable_antialiasing = false;
    }
    maprenderer = new THREE.WebGPURenderer( { antialias: enable_antialiasing, preserveDrawingBuffer: true } );
    if (maprenderer.backend.isWebGLBackend) console.log("WebGL backend");
    if (maprenderer.backend.isWebGPUBackend) console.log("WebGPU backend");
    maprenderer.setPixelRatio(window.devicePixelRatio);
    maprenderer.setSize(new_mapview_width, new_mapview_height);
    container.appendChild(maprenderer.domElement);
    if (anaglyph_3d_enabled) {
        anaglyph_effect = new AnaglyphEffect( maprenderer );
        anaglyph_effect.setSize( new_mapview_width, new_mapview_height );
    }
    animate_webgpu();
    if (is_small_screen()) {
        camera_dx = 38 * 1.35;
        camera_dy = 410 * 1.35;
        camera_dz = 242 * 1.35;
    }
    $("#pregame_page").hide();
}
/****************************************************************************
 This will render the map terrain mesh.
 ****************************************************************************/
function init_webgpu_mapview() {
    selected_unit_material = new THREE.MeshBasicMaterial( { color: 0xf6f7bf, transparent: true, opacity: 0.7} );
    init_heightmap(terrain_quality);
    update_heightmap(terrain_quality);
    // Low-resolution terrain mesh used for raycasting to find mouse postition.
    var lofiMaterial = new THREE.MeshStandardMaterial({"color" : 0x00ff00});
    lofiGeometry = new THREE.BufferGeometry();
    init_land_geometry(lofiGeometry, 2);
    update_land_geometry(lofiGeometry, 2);
    lofiMesh = new THREE.Mesh( lofiGeometry, lofiMaterial );
    lofiMesh.layers.set(6);
    scene.add(lofiMesh);
    if (map.xsize > 200 || map.ysize > 200) {
        terrain_quality = 2;
    }
    terrain_material = new THREE.MeshStandardMaterial({"color" : 0x008800});
    landGeometry = new THREE.BufferGeometry();
    init_land_geometry(landGeometry, terrain_quality);
    update_land_geometry(landGeometry, terrain_quality);
    landMesh = new THREE.Mesh( landGeometry, terrain_material );
    landMesh.receiveShadow = false;
    landMesh.castShadow = false;
    scene.add(landMesh);
    update_map_terrain_geometry();
    setInterval(update_map_terrain_geometry, 40);
    add_quality_dependent_objects_webgpu();
    add_all_objects_to_scene();
    benchmark_start = new Date().getTime();
}
/****************************************************************************
 Main animation method for WebGPU.
 ****************************************************************************/
function animate_webgpu() {
    if (scene == null) return;
    if (stats != null) stats.begin();
    if (mapview_slide['active']) update_map_slide_3d();
    update_animated_objects();
    if (selected_unit_indicator != null && selected_unit_material != null) {
        selected_unit_material.color.multiplyScalar (0.996);
        if (selected_unit_material_counter > 50) {
            selected_unit_material_counter = 0;
            selected_unit_material.color.setHex(0xffffff);
        }
        selected_unit_material_counter++;
    }
    if (controls != null) {
        controls.update();
    }
    maprenderer.renderAsync(scene, camera);
    if (goto_active) check_request_goto_path();
    if (stats != null) stats.end();
    if (initial_benchmark_enabled || benchmark_enabled) benchmark_frames_count++;
    requestAnimationFrame(animate_webgpu);
}
/****************************************************************************
 ...
 ****************************************************************************/
function add_quality_dependent_objects_webgpu()
{
    // Water with shader, high quality, near view.
    var waterGeometry = new THREE.PlaneGeometry( mapview_model_width, mapview_model_height);
    scene.remove(water_hq);
    water_hq = new THREE.Mesh(
        waterGeometry,
        new THREE.MeshPhysicalMaterial({
            transmission: 1, // Fully transparent
            roughness: 0.1, // Smoother surface for shiny appearance
            ior: 1.333, // Index of refraction for water
            color: '#c4f0e6', // Lighter blue for shallow shiny areas
            clearcoat: 1, // Adds shine to the water surface
            clearcoatRoughness: 0.015, // Even smoother clearcoat
            reflectivity: 0.97, // Maximized reflections for glossy shallow water
            thickness: 6, // Reduced thickness to emphasize shallow areas
            attenuationColor: '#b0e2d4', // Soft blue-green for shallow areas
            attenuationDistance: 12, // Shorter absorption distance for vibrant shallow areas
            envMapIntensity: 1.7, // Stronger environment reflections
            normalMap: webgl_textures["water1"], // Wave texture
            normalScale: new THREE.Vector2(0.02, 0.02), // Very subtle, short waves
        })
    );
    water_hq.rotation.x = - Math.PI * 0.5;
    water_hq.translateOnAxis(new THREE.Vector3(0,0,1).normalize(), 50);
    water_hq.translateOnAxis(new THREE.Vector3(1,0,0).normalize(), Math.floor(mapview_model_width / 2) - 500);
    water_hq.translateOnAxis(new THREE.Vector3(0,1,0).normalize(), -mapview_model_height / 2);
    water_hq.renderOrder = -1; // Render water first, this will solve transparency issues in city labels.
    water_hq.castShadow = false;
    scene.add( water_hq );
    maprenderer.shadowMap.enabled = false;
    scene.background = null;
}

/****************************************************************************
 Check if WebGPU is supported.
****************************************************************************/
function is_webgpu_supported() {
    return ('gpu' in navigator);
}