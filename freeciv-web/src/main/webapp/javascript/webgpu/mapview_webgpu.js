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
    var waterGeometry = new THREE.PlaneGeometry( mapview_model_width, mapview_model_height);

    scene.remove(water_lq);
    let water_material = new THREE.MeshBasicMaterial( { color: 0x4b4bd0, transparent: true, opacity: 0.4} );
    water_lq = new THREE.Mesh(waterGeometry, water_material);

    water_lq.rotation.x = - Math.PI * 0.5;
    water_lq.translateOnAxis(new THREE.Vector3(0,0,1).normalize(), 50);
    water_lq.translateOnAxis(new THREE.Vector3(1,0,0).normalize(), Math.floor(mapview_model_width / 2) - 500);
    water_lq.translateOnAxis(new THREE.Vector3(0,1,0).normalize(), -mapview_model_height / 2);
    water_lq.renderOrder = -1; // Render water first, this will sove transparency issues in city labels.
    water_lq.castShadow = false;
    scene.add( water_lq );

    maprenderer.shadowMap.enabled = false;

    scene.background = null;

}