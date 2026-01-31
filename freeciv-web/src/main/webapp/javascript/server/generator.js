/**********************************************************************
    Freeciv-web - Natural Continental Generator (2026 Edition)
    Features:
    - High Land-to-Water Ratio (~70% Land)
    - Fractal Mountain Ridges (Scattered)
    - Inland Lake Carving
    - Latitudinal Climate (Tundra/Arctic Poles)
***********************************************************************/

// Default map configuration
var DEFAULT_MAP_WIDTH = 80;
var DEFAULT_MAP_HEIGHT = 50;

// Terrain type constants
var TERRAIN_GRASSLAND = 0;
var TERRAIN_OCEAN = 1;
var TERRAIN_PLAINS = 2;
var TERRAIN_FOREST = 3;
var TERRAIN_HILLS = 4;
var TERRAIN_MOUNTAINS = 5;
var TERRAIN_DESERT = 6;
var TERRAIN_TUNDRA = 7;
var TERRAIN_SWAMP = 8;
var TERRAIN_ARCTIC = 9;

var terrains = {};

var MapGenerator = {
    seed: 0,
    width: 0,
    height: 0,

    random: function() {
        var x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    },

    // Simple 2D noise for natural variation
    noise: function(x, y) {
        var n = x + y * 57 + (this.seed % 1000);
        n = (n << 13) ^ n;
        return (1.0 - ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824.0);
    },

    initialize_terrain: function() {
        terrains = {
            0: { id: 0, name: "Grassland", graphic: "grassland", graphic_str: "grassland" },
            1: { id: 1, name: "Ocean", graphic: "floor", graphic_str: "floor" },
            2: { id: 2, name: "Plains", graphic: "plains", graphic_str: "plains" },
            3: { id: 3, name: "Forest", graphic: "forest", graphic_str: "forest" },
            4: { id: 4, name: "Hills", graphic: "hills", graphic_str: "hills" },
            5: { id: 5, name: "Mountains", graphic: "mountains", graphic_str: "mountains" },
            6: { id: 6, name: "Desert", graphic: "desert", graphic_str: "desert" },
            7: { id: 7, name: "Tundra", graphic: "tundra", graphic_str: "tundra" },
            8: { id: 8, name: "Swamp", graphic: "swamp", graphic_str: "swamp" },
            9: { id: 9, name: "Arctic", graphic: "arctic", graphic_str: "arctic" }
        };
    },

    /**
     * Creates a heightmap where high values are mountains
     * and very low values are lakes/oceans.
     */
    generate_fractal_map: function() {
        var map = Array(this.height).fill().map(() => Array(this.width).fill(0.5));

        // Layer 1: Massive landmass (Low frequency)
        this.apply_noise_layer(map, 0.05, 0.4);
        // Layer 2: Medium features (Lakes/Hills)
        this.apply_noise_layer(map, 0.15, 0.2);
        // Layer 3: Sharp detail (Mountains/Small lakes)
        this.apply_noise_layer(map, 0.4, 0.1);

        // Normalize and apply edge-carving (to ensure the map isn't a perfect rectangle)
        for (var y = 0; y < this.height; y++) {
            var edgeDistY = Math.min(y, this.height - y) / (this.height * 0.2);
            var edgeFactor = Math.min(1.0, edgeDistY);

            for (var x = 0; x < this.width; x++) {
                // Slightly lower height at edges to allow for coastal waters
                map[y][x] *= (0.8 + 0.2 * edgeFactor);
            }
        }
        return map;
    },

    apply_noise_layer: function(map, freq, amp) {
        var offsetX = this.random() * 1000;
        var offsetY = this.random() * 1000;
        for (var y = 0; y < this.height; y++) {
            for (var x = 0; x < this.width; x++) {
                map[y][x] += this.noise(x * freq + offsetX, y * freq + offsetY) * amp;
            }
        }
    },

    get_terrain_type: function(h, y) {
        var latitude = Math.abs(y - this.height / 2) / (this.height / 2);

        // --- WATER LOGIC ---
        // Narrow threshold for water ensures "mostly land"
        if (h < 0.38) return TERRAIN_OCEAN;

        // --- POLAR LOGIC ---
        if (latitude > 0.88) return TERRAIN_ARCTIC;
        if (latitude > 0.75) {
            if (h > 0.8) return TERRAIN_MOUNTAINS;
            return TERRAIN_TUNDRA;
        }

        // --- MOUNTAIN/HILL LOGIC ---
        // Scattered peaks
        if (h > 0.88) return TERRAIN_MOUNTAINS;
        if (h > 0.78) return TERRAIN_HILLS;

        // --- VEGETATION/CLIMATE LOGIC ---
        if (latitude < 0.25) { // Tropical
            if (h < 0.45) return TERRAIN_SWAMP;
            if (h > 0.65) return TERRAIN_FOREST;
            return TERRAIN_GRASSLAND;
        }

        if (latitude > 0.3 && latitude < 0.5 && h < 0.52) {
            return TERRAIN_DESERT; // Arid belts
        }

        if (h > 0.6) return TERRAIN_FOREST;
        return (h > 0.5) ? TERRAIN_GRASSLAND : TERRAIN_PLAINS;
    },

    smooth: function(terrainMap) {
        var newMap = JSON.parse(JSON.stringify(terrainMap));
        for (var y = 1; y < this.height - 1; y++) {
            for (var x = 0; x < this.width; x++) {
                var counts = {};
                for (var dy = -1; dy <= 1; dy++) {
                    for (var dx = -1; dx <= 1; dx++) {
                        var nx = (x + dx + this.width) % this.width;
                        var ny = y + dy;
                        var t = terrainMap[ny][nx];
                        counts[t] = (counts[t] || 0) + 1;
                    }
                }
                // Stronger smoothing for landmass consistency
                for (var type in counts) {
                    if (counts[type] >= 7) {
                        newMap[y][x] = parseInt(type);
                        break;
                    }
                }
            }
        }
        return newMap;
    }
};

/**
 * ENTRY POINT
 */
function generator_create_map(width, height, options) {
    width = width || DEFAULT_MAP_WIDTH;
    height = height || DEFAULT_MAP_HEIGHT;
    options = options || {};

    MapGenerator.width = width;
    MapGenerator.height = height;
    MapGenerator.seed = options.seed || Math.floor(Math.random() * 1000000);

    console.log("[Generator] Generating Mostly-Land World. Seed: " + MapGenerator.seed);

    MapGenerator.initialize_terrain();

    handle_map_info({
        xsize: width,
        ysize: height,
        topology_id: 0,
        wrap_id: 1, // X-Wrap
        num_valid_dirs: 8,
        num_cardinal_dirs: 4
    });

    var hMap = MapGenerator.generate_fractal_map();
    var terrainMap = Array(height).fill().map(() => Array(width).fill(0));

    // Assign terrain
    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
            terrainMap[y][x] = MapGenerator.get_terrain_type(hMap[y][x], y);
        }
    }

    // Two smoothing passes to ensure natural clumps
    terrainMap = MapGenerator.smooth(terrainMap);
    terrainMap = MapGenerator.smooth(terrainMap);

    // Emission
    var landCount = 0;
    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
            var terrain = terrainMap[y][x];
            var index = x + (y * width);

            if (terrain !== TERRAIN_OCEAN) landCount++;

            // Resources placement
            var extras = [];
            if (terrain !== TERRAIN_OCEAN && MapGenerator.random() > 0.95) {
                extras.push("1");
            }

            handle_tile_info({
                tile: index,
                x: x,
                y: y,
                terrain: terrain,
                known: 2,
                extras: extras,
                owner: null,
                worked: null,
                height: hMap[y][x],
                nuke: 0
            });
        }
    }

    console.log("[Generator] Finished. Land: " + ((landCount / (width * height)) * 100).toFixed(1) + "%");
}