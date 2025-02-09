var globecamera;
var globescene;
var globerenderer;
var globecontrols;


function init_globe_view()
{
    var new_mapview_width = $(window).width() - width_offset;
    var new_mapview_height;
    if (!is_small_screen()) {
        new_mapview_height = $(window).height() - height_offset;
    } else {
        new_mapview_height = $(window).height() - height_offset - 40;
    }

    const container = document.getElementById('globecanvas');
    globecamera = new THREE.PerspectiveCamera( 45, new_mapview_width / new_mapview_height, 1, 12000 );
    globecamera.position.set(0, 0, 1600);
    globescene = new THREE.Scene();

    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(6);

    globerenderer = new THREE.WebGLRenderer( { antialias: true, preserveDrawingBuffer: true } );
    globerenderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    globerenderer.frustumCulled = true;
    globerenderer.setAnimationLoop(animate_globe);

    globerenderer.setPixelRatio(window.devicePixelRatio);
    globerenderer.setSize(new_mapview_width, new_mapview_height);
    container.appendChild(globerenderer.domElement);

    const sky = new THREE.WebGLCubeRenderTarget(2000);
    sky.fromEquirectangularTexture(globerenderer, create_star_sky_texture(18000, 5000, 2400, true));
    globescene.background = sky.texture;

    // Define uniforms
    let freeciv_uniforms = {
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
        borders_visible: { type: "bool", value: server_settings['borders']['is_visible'] }
    };

    // Create the sphere (globe)
    const globeGeometry = new THREE.SphereGeometry(500, 128, 128);
    const globeMaterial = new THREE.ShaderMaterial({
        uniforms: freeciv_uniforms,
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
            
            void main() {
                float adjustedUvY = (vUv.y - 0.05) / 0.9;
                vec2 adjustedUv = vec2(vUv.x, clamp(adjustedUvY, 0.0, 1.0));
                vec4 terrain_type = texture(maptiles, adjustedUv);
                vec4 border_color = borders_visible ? texture(borders, adjustedUv) : vec4(0);
                vec3 color;
                
                float terrain_here = floor(terrain_type.r * 256.0);
                if (terrain_here == 70.0) color = texture(grassland, adjustedUv).rgb;
                else if (terrain_here == 110.0) color = texture(plains, adjustedUv).rgb;
                else if (terrain_here == 20.0) color = texture(coast, adjustedUv).rgb;
                else if (terrain_here == 30.0) color = texture(ocean, adjustedUv).rgb;
                else if (terrain_here == 40.0) color = texture(arctic_farmland_irrigation_tundra, adjustedUv).rgb;
                else if (terrain_here == 50.0) color = texture(desert, adjustedUv).rgb;
                else if (terrain_here == 80.0) color = texture(hills, adjustedUv).rgb;
                else if (terrain_here == 100.0) color = texture(mountains, adjustedUv).rgb;
                else if (terrain_here == 120.0) color = texture(swamp, adjustedUv).rgb;
                else color = texture(plains, adjustedUv).rgb;
                
                float latitude = vPosition.y / 500.0;
                if (latitude > 0.95 || latitude < -0.95) color = vec3(1.0, 1.0, 1.0);
                
                gl_FragColor = vec4(color, 1.0);
            }
        `,
    });
    const globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
    globescene.add(globeMesh);

    // Add lights
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1).normalize();
    globescene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0x404040,  28 * Math.PI); // Soft white ambient light
    globescene.add(ambientLight);

    globecontrols = new OrbitControls( globecamera, globerenderer.domElement );
    globecontrols.enableDamping = true;
    globecontrols.enablePan = true;
    globecontrols.dampingFactor = 0.1;
    globecontrols.maxPolarAngle = Math.PI;
    globecontrols.minPolarAngle = 0;
    globecontrols.enableRotate = true;
    globecontrols.enableZoom = true;
}


function set_globe_view_active() {

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
