var globecamera;
var globescene;
var globerenderer;
var globecontrols;
var globeMaterial;
var globeMesh;
var globe_view_active = false;


function init_globe_view() {
    var new_mapview_width = $(window).width() - width_offset;
    var new_mapview_height;
    if (!is_small_screen()) {
        new_mapview_height = $(window).height() - height_offset;
    } else {
        new_mapview_height = $(window).height() - height_offset - 40;
    }

    const container = document.getElementById('globecanvas');
    globecamera = new THREE.PerspectiveCamera(45, new_mapview_width / new_mapview_height, 1, 12000);
    globecamera.position.set(0, 0, 1600);
    globescene = new THREE.Scene();

    globerenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    globerenderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    globerenderer.frustumCulled = true;
    globerenderer.setAnimationLoop(animate_globe);

    globerenderer.setPixelRatio(window.devicePixelRatio);
    globerenderer.setSize(new_mapview_width, new_mapview_height);
    container.appendChild(globerenderer.domElement);

    // Skybox
    const sky = new THREE.WebGLCubeRenderTarget(2000);
    sky.fromEquirectangularTexture(globerenderer, create_star_sky_texture(18000, 5000, 2400, true));
    globescene.background = sky.texture;

    // Create map sphere (excluding poles)
    const pole_cutoff = 0.05 * Math.PI; // 5% of the sphere
    const globeGeometry = new THREE.SphereGeometry(500, 128, 128, 0, Math.PI * 2, pole_cutoff, Math.PI - 2 * pole_cutoff);
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
        fragmentShader: `
            varying vec2 vUv;
            varying vec3 vPosition;
            uniform sampler2D maptiles, borders, roadsmap, roadsprites, railroadsprites;
            uniform sampler2D arctic_farmland_irrigation_tundra, grassland, coast, desert, ocean, plains, hills, mountains, swamp;
            uniform float map_x_size, map_y_size;
            uniform bool borders_visible;
            uniform int mouse_x;
            uniform int mouse_y;
            
            void main() {
                vec4 terrain_type = texture(maptiles, vUv);
                vec4 border_color = borders_visible ? texture(borders, vUv) : vec4(0);
                vec3 color;
                vec2 dxdy = vec2(mod(map_x_size * vUv.x, 1.0), mod(map_y_size * vUv.y, 1.0));
                vec2 tdxdy = vec2(
                            (map_x_size * vUv.x / 2.0) - 0.5 * floor(map_x_size * vUv.x),
                            (map_y_size * vUv.y / 2.0) - 0.5 * floor(map_y_size * vUv.y));
                        
                float terrain_here = floor(terrain_type.r * 256.0);
                if (terrain_here == 70.0) color = texture(grassland, dxdy).rgb;
                else if (terrain_here == 110.0) color = texture(plains, dxdy).rgb;
                else if (terrain_here == 20.0) color = texture(coast, dxdy).rgb;
                else if (terrain_here == 30.0) color = texture(ocean, dxdy).rgb;
                else if (terrain_here == 40.0) color = texture(arctic_farmland_irrigation_tundra, vec2(tdxdy.x, tdxdy.y + 0.5)).rgb;
                else if (terrain_here == 50.0) color = texture(desert, dxdy).rgb;
                else if (terrain_here == 80.0) color = texture(hills, dxdy).rgb;
                else if (terrain_here == 100.0) color = texture(mountains, dxdy).rgb;
                else if (terrain_here == 120.0) color = texture(swamp, dxdy).rgb;
                else color = texture(plains, dxdy).rgb;

                float shade_factor = 1.4;
                if (mouse_x >= 0 && mouse_y >= 0 && mouse_x == int(floor(map_x_size * (1.0 - vUv.x))) && mouse_y == int(floor(map_y_size * (1.05 - vUv.y)))) {
                    shade_factor += 0.7;
                }
                
                gl_FragColor = vec4(color * shade_factor, 1.0);
            }
        `,
    });
    globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
    globescene.add(globeMesh);

    // Create the inner white sphere for the poles
    const innerSphereGeometry = new THREE.SphereGeometry(499, 64, 64); // Slightly smaller to prevent overlap
    const innerSphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const innerSphereMesh = new THREE.Mesh(innerSphereGeometry, innerSphereMaterial);
    globescene.add(innerSphereMesh);

    // Add lights
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1).normalize();
    globescene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0x404040, 28 * Math.PI);
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

    if (globecontrols != null) {
        globecontrols.update();
    }

    globerenderer.render(globescene, globecamera);
}

function globe_canvas_pos_to_tile(x, y) {
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
        const latitude = Math.asin(intersectionPoint.y) * (180 / Math.PI);
        const longitude = Math.atan2(intersectionPoint.z, intersectionPoint.x) * (180 / Math.PI);

        // Convert lat/lon to map tile coordinates
        const mapX = Math.floor((longitude + 180) / 360 * map['xsize']);
        const mapY = Math.floor((90 - latitude) / 180 * map['ysize']);

        const tile = map_pos_to_tile(mapX, mapY);
        if (tile != null) return tile;
    }

    return null;
}
