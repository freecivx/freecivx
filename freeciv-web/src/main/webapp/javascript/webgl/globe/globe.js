/**********************************************************************
 FreecivX - the web version of Freeciv. http://www.FreecivX.net/
 Copyright (C) 2009-2025  The Freecivx project

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


var globecamera;
var globescene;
var globerenderer;
var globecontrols;
var globeMaterial;
var globeMesh;
var globe_view_active = false;
var earth_radius = 800;
var globe_cities = {}
var globe_city_labels = {}

async function init_globe_view() {
    var new_mapview_width = $(window).width() - width_offset;
    var new_mapview_height;
    if (!is_small_screen()) {
        new_mapview_height = $(window).height() - height_offset;
    } else {
        new_mapview_height = $(window).height() - height_offset - 40;
    }

    const container = document.getElementById('globecanvas');
    globecamera = new THREE.PerspectiveCamera(45, new_mapview_width / new_mapview_height, 1, 100000);
    globecamera.position.set(0, 0, 2200);
    globescene = new THREE.Scene();

    globerenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    globerenderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    globerenderer.frustumCulled = true;
    globerenderer.setAnimationLoop(animate_globe);

    globerenderer.setPixelRatio(window.devicePixelRatio);
    globerenderer.setSize(new_mapview_width, new_mapview_height);
    container.appendChild(globerenderer.domElement);

    $("#globecanvas").mouseup(globeMouseUp);

    // Skybox
    const sky = new THREE.WebGLCubeRenderTarget(2000);
    sky.fromEquirectangularTexture(globerenderer, create_star_sky_texture(18000, 5000, 2400, true));
    globescene.background = sky.texture;

    const fragmentShaderResponse = await fetch('/javascript/webgl/shaders_square/globe_fragment_shader.glsl');
    var fragment_shader = await fragmentShaderResponse.text();

    // Create map sphere (excluding poles)
    const pole_cutoff = 0.05 * Math.PI; // 5% of the sphere
    const globeGeometry = new THREE.SphereGeometry(earth_radius, map.xsize * 2, map.ysize * 2, 0, Math.PI * 2, pole_cutoff, Math.PI - 2 * pole_cutoff);
    globeMaterial = new THREE.ShaderMaterial({
        uniforms: {
            maptiles: { type: "t", value: maptiletypes },
            borders: { type: "t", value: borders_texture },
            roadsmap: { type: "t", value: roads_texture },
            roadsprites: { type: "t", value: webgl_textures["roads"] },
            railroadsprites: { type: "t", value: webgl_textures["railroads"] },
            arctic_farmland_irrigation_tundra: { type: "t", value: webgl_textures["arctic_farmland_irrigation_tundra"] },
            grassland: { type: "t", value: webgl_textures["grassland"] },
            coast: { type: "t", value: webgl_textures["coast"] },
            desert: { type: "t", value: webgl_textures["desert"] },
            ocean: { type: "t", value: webgl_textures["ocean"] },
            plains: { type: "t", value: webgl_textures["plains"] },
            hills: { type: "t", value: webgl_textures["hills"] },
            mountains: { type: "t", value: webgl_textures["mountains"] },
            swamp: { type: "t", value: webgl_textures["swamp"] },
            map_x_size: { type: "f", value: map['xsize'] },
            map_y_size: { type: "f", value: map['ysize'] },
            mouse_x: { type: "i", value: -1 },
            mouse_y: { type: "i", value: -1 },
            globe_known: { type: "t", value: globe_known_texture},
            borders_visible: { type: "bool", value: server_settings['borders']['is_visible'] }
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vPosition;
            void main() {
                vUv = uv;
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: fragment_shader,
    });
    globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
    globescene.add(globeMesh);

    // Create the inner white sphere for the poles
    const innerSphereGeometry = new THREE.SphereGeometry(earth_radius - 20, 64, 64);
    const innerSphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const innerSphereMesh = new THREE.Mesh(innerSphereGeometry, innerSphereMaterial);
    globescene.add(innerSphereMesh);

    // Create atmosphere sphere
    const atmosphereGeometry = new THREE.SphereGeometry(earth_radius * 1.5, 128, 128);
    const atmosphereMaterial = new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: `
        varying vec3 vNormal;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
        fragmentShader: `
        varying vec3 vNormal;
        void main() {
            float intensity = pow(0.5 - dot(vNormal, vec3(0, 0, 1.0)), 4.0);
            gl_FragColor = vec4(0.3, 0.5, 1.0, 0.6) * intensity;
        }
    `,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    globescene.add(atmosphereMesh);


    // Add lights
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2); // Increase intensity if needed
    directionalLight.position.set(1.5 * earth_radius, earth_radius, 1.5 * earth_radius); // Position the light at an angle
    directionalLight.target.position.set(0, 0, 0); // Point towards the center of the globe
    directionalLight.castShadow = true; // Enable shadows if needed
    globescene.add(directionalLight);
    globescene.add(directionalLight.target); // Ensure the light target is added to the scene

    add_planets();

    const ambientLight = new THREE.AmbientLight(0x404040, 75 * Math.PI);
    globescene.add(ambientLight);

    globecontrols = new OrbitControls(globecamera, globerenderer.domElement);
    globecontrols.enableDamping = true;
    globecontrols.enablePan = true;
    globecontrols.dampingFactor = 0.1;
    globecontrols.maxPolarAngle = Math.PI;
    globecontrols.minPolarAngle = 0;
    globecontrols.enableRotate = true;
    globecontrols.enableZoom = true;
}


/****************************************************************************
...
****************************************************************************/
function set_globe_view_active() {
  globe_view_active = true;
}

/****************************************************************************
 Main animation method for WebGL.
 ****************************************************************************/
function animate_globe() {
    if (globescene == null) return;
    if (!globe_view_active) return;

    if (globecontrols != null) {
        globecontrols.update();
    }

    globerenderer.render(globescene, globecamera);
}

/****************************************************************************
 ...
****************************************************************************/
function globe_add_city(ptile, pcity, model_name) {
    let new_city = webgl_get_model(model_name, ptile);
    let globe_coords = map_to_globe_coords(ptile['x'], ptile['y']);

    // Normalize the globe position to get the surface normal
    let normal = globe_coords.clone().normalize();

    // Create a quaternion to align the city model with the normal
    let up = new THREE.Vector3(0, 1, 0); // Default "up" direction
    let quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(up, normal);

    // Apply the rotation to the city
    new_city.position.set(globe_coords.x, globe_coords.y, globe_coords.z);
    new_city.quaternion.copy(quaternion);

    globescene.add(new_city);

    // Create and position the city label slightly above the globe surface
    let city_label = create_city_label_sprite(pcity, 1);
    let label_offset = normal.clone().multiplyScalar(25); // Move the label outward by 25 units
    let label_position = globe_coords.clone().add(label_offset);

    city_label.position.set(label_position.x, label_position.y, label_position.z);
    city_label.quaternion.copy(quaternion);

    globescene.add(city_label);

    globe_cities[pcity.id] = new_city;
    globe_city_labels[pcity.id] = city_label;
}

/****************************************************************************
 ...
****************************************************************************/
function globe_update_city(ptile, pcity, model_name) {
    scene.remove(globe_cities[pcity.id]);
    scene.remove(globe_city_labels[pcity.id]);

    let new_city = webgl_get_model(model_name, ptile);
    let globe_coords = map_to_globe_coords(ptile['x'], ptile['y']);

    // Normalize the globe position to get the surface normal
    let normal = globe_coords.clone().normalize();

    // Create a quaternion to align the city model with the normal
    let up = new THREE.Vector3(0, 1, 0); // Default "up" direction
    let quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(up, normal);

    // Apply the rotation to the city
    new_city.position.set(globe_coords.x, globe_coords.y, globe_coords.z);
    new_city.quaternion.copy(quaternion);

    globescene.add(new_city);
    console.log("updated city " + ptile.x + " " + ptile.y);

    update_city_label(pcity, 1);

    globe_cities[pcity.id] = new_city;
}


/****************************************************************************
 ...
 ****************************************************************************/
function globe_canvas_pos_to_tile(x, y, invert_x) {
    if (globescene == null || globecamera == null) return null;

    // Convert screen coordinates to normalized device coordinates (NDC)
    const mouse = new THREE.Vector2();
    mouse.set((x / $('#globecanvas').width()) * 2 - 1, - (y / $('#globecanvas').height()) * 2 + 1);

    // Set up the raycaster
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, globecamera);

    // Intersect with the globe mesh
    const intersects = raycaster.intersectObject(globeMesh, false);

    for (let i = 0; i < intersects.length; i++) {
        const intersect = intersects[i];

        // Convert intersection point from 3D sphere to latitude/longitude
        const intersectionPoint = intersect.point.clone().normalize();
        const latitude = Math.asin(intersectionPoint.y) * (1.1 * 180 / Math.PI);
        const longitude = Math.atan2(intersectionPoint.z, intersectionPoint.x) * (180 / Math.PI);

        // Convert lat/lon to map tile coordinates
        var mapX = Math.floor((longitude + 180) / 360 * map['xsize']);
        var mapY = Math.floor((invert_x ? -1 : 2) + (90 - latitude) / 180 * map['ysize']);

        const tile = map_pos_to_tile(invert_x ? (map.xsize - mapX - 1) : mapX, mapY);
        if (tile != null) return tile;
    }

    return null;
}

/****************************************************************************
...
****************************************************************************/
function map_to_globe_coords(map_x, map_y) {
    // Normalize map_x to [0, 1] and ensure correct wrapping
    const u = (map_x + 0.5) / map.xsize; // Shift 0.5 tiles east
    let adjusted_u = (1.0 - u) % 1.0; // Flip x-axis to match shader logic
    if (adjusted_u < 0) adjusted_u += 1.0; // Ensure positive wrapping

    // Adjust map_y normalization to account for pole cutoffs (5% padding on each side)
    const minV = 0.05; // 5% from the bottom
    const maxV = 0.95; // 5% before the top
    const v = minV + ((map_y + 0.5) / map.ysize) * (maxV - minV); // Shift 0.5 tiles south

    // Convert normalized coordinates to latitude and longitude
    const longitude = adjusted_u * 360 - 180; // -180 to 180
    const latitude = 90 - v * 180;   // 90 to -90

    // Convert degrees to radians
    const latRad = THREE.MathUtils.degToRad(latitude);
    const lonRad = THREE.MathUtils.degToRad(longitude);

    // Convert to Cartesian coordinates
    const x = earth_radius * Math.cos(latRad) * Math.cos(lonRad);
    const y = earth_radius * Math.sin(latRad);
    const z = earth_radius * Math.cos(latRad) * Math.sin(lonRad);

    return new THREE.Vector3(x, y, z);
}


/****************************************************************************
...
****************************************************************************/
function globeMouseUp( e ) {

    var rightclick = false;
    var middleclick = false;

    if (!e) var e = window.event;
    if (e.which) {
        rightclick = (e.which == 3);
        middleclick = (e.which == 2);
    } else if (e.button) {
        rightclick = (e.button == 2);
        middleclick = (e.button == 1 || e.button == 4);
    }

    var ptile = globe_canvas_pos_to_tile(mouse_x, mouse_y, true);
    if (ptile == null) return;

    if (rightclick) {
        /* right click to recenter. */


    } else if (!middleclick) {
        /* Left mouse button*/
        console.log("clicked on tile " + ptile.x + " " + ptile.y);
        pcity = tile_city(ptile);
        if (pcity != null) {
            show_city_dialog(pcity);
        }
    }
    e.preventDefault();
    keyboard_input = true;
    update_mouse_cursor();
}