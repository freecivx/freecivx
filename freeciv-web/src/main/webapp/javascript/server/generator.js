/**********************************************************************
    Freeciv-web - Improved Map Generator (2026 Edition)
    Copyright (C) 2009-2026 The Freeciv-web project

    Features:
    - Continental Blobbing (Seed-based)
    - Latitude-locked Climate (Arctic/Tundra poles)
    - Horizontal Map Wrapping (X-Wrap)
    - Double-pass Cellular Smoothing
***********************************************************************/

// Default map configuration
var DEFAULT_MAP_WIDTH = 80;
var DEFAULT_MAP_HEIGHT = 50;

// Terrain type constants (standard Freeciv IDs)
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

// Global data structures for Freeciv engine
var terrains = {};
var tiles = {};

/**
 * Main Map Generator Object
 */
var MapGenerator = {
    seed: 0,
    width: 0,
    height: 0,

    /**
     * Deterministic pseudo-random number generator
     */
    random: function() {
        var x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    },

    /**
     * Initialize terrain definitions for the engine
     */
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
        console.log("[Generator] Terrains initialized.");
    },

    /**
     * Create landmasses using radial "blobs" to create continents
     */
    generate_height_map: function() {
        var hMap = Array(this.height).fill().map(() => Array(this.width).fill(0));

        // Number of seeds correlates to map size
        var numSeeds = Math.floor((this.width * this.height) / 300);

        for (var i = 0; i < numSeeds; i++) {
            var sx = Math.floor(this.random() * this.width);
            // Bias seeds away from the absolute poles for better gameplay
            var sy = Math.floor(this.random() * (this.height * 0.7) + (this.height * 0.15));
            var radius = this.random() * 14 + 5; // Variation in continent size

            for (var y = 0; y < this.height; y++) {
                for (var x = 0; x < this.width; x++) {
                    // X-Wrap distance calculation
                    var dx = Math.min(Math.abs(x - sx), this.width - Math.abs(x - sx));
                    var dy = y - sy;
                    var dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < radius) {
                        // Create a gradient height
                        hMap[y][x] += (1 - (dist / radius)) * 1.2;
                    }
                }
            }
        }
        return hMap;
    },

    /**
     * Determine terrain based on height and latitudinal climate
     */
    get_terrain_type: function(h, y) {
        var latitude = Math.abs(y - this.height / 2) / (this.height / 2); // 0 at equator, 1 at poles

        // Ocean depth check
        if (h < 0.5) return TERRAIN_OCEAN;

        // Polar Zones
        if (latitude > 0.85) return TERRAIN_ARCTIC;
        if (latitude > 0.70) return (this.random() > 0.4) ? TERRAIN_TUNDRA : TERRAIN_ARCTIC;

        // Tropical Zones (Equator)
        if (latitude < 0.25) {
            if (h > 0.9) return TERRAIN_MOUNTAINS;
            if (h < 0.6) return (this.random() > 0.6) ? TERRAIN_SWAMP : TERRAIN_GRASSLAND;
            return TERRAIN_FOREST;
        }

        // Temperate and Arid Zones
        if (h > 0.92) return TERRAIN_MOUNTAINS;
        if (h > 0.82) return TERRAIN_HILLS;

        // Deserts usually appear in specific latitude belts
        if (latitude > 0.3 && latitude < 0.5 && h < 0.6) {
            return (this.random() > 0.5) ? TERRAIN_DESERT : TERRAIN_PLAINS;
        }

        if (h > 0.7) return TERRAIN_FOREST;
        return (this.random() > 0.5) ? TERRAIN_GRASSLAND : TERRAIN_PLAINS;
    },

    /**
     * Cellular Automata smoothing pass to remove "noise"
     */
    smooth: function(terrainMap) {
        var newMap = JSON.parse(JSON.stringify(terrainMap));
        for (var y = 1; y < this.height - 1; y++) {
            for (var x = 0; x < this.width; x++) {
                var counts = {};
                for (var dy = -1; dy <= 1; dy++) {
                    for (var dx = -1; dx <= 1; dx++) {
                        var nx = (x + dx + this.width) % this.width; // Handle wrapping
                        var ny = y + dy;
                        var t = terrainMap[ny][nx];
                        counts[t] = (counts[t] || 0) + 1;
                    }
                }
                // Majority rule: if 6 or more neighbors are the same, switch to that
                for (var type in counts) {
                    if (counts[type] >= 6) {
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
 * Main map generation function called by the Freeciv-web server
 */
function generator_create_map(width, height, options) {
    width = width || DEFAULT_MAP_WIDTH;
    height = height || DEFAULT_MAP_HEIGHT;
    options = options || {};

    // Setup Generator context
    MapGenerator.width = width;
    MapGenerator.height = height;
    MapGenerator.seed = options.seed || Math.floor(Math.random() * 1000000);

    console.log("[Generator] Starting Freeciv Map Generation. Seed: " + MapGenerator.seed);

    // 1. Initialize data structures
    MapGenerator.initialize_terrain();

    // 2. Inform engine of map dimensions and topology
    handle_map_info({
        xsize: width,
        ysize: height,
        topology_id: 0,
        wrap_id: 1, // X-axis wrap (standard for Freeciv)
        num_valid_dirs: 8,
        num_cardinal_dirs: 4
    });

    // 3. Generate the physical world
    var hMap = MapGenerator.generate_height_map();
    var terrainMap = Array(height).fill().map(() => Array(width).fill(0));

    // Initial terrain assignment
    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
            terrainMap[y][x] = MapGenerator.get_terrain_type(hMap[y][x], y);
        }
    }

    // Apply smoothing passes for cleaner continents
    terrainMap = MapGenerator.smooth(terrainMap);
    terrainMap = MapGenerator.smooth(terrainMap);

    // 4. Create tiles and send to handle_tile_info
    var landCount = 0;
    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
            var terrain = terrainMap[y][x];
            var index = x + (y * width);

            if (terrain !== TERRAIN_OCEAN) landCount++;

            // Optional: Randomly add "Specials" (Resources)
            var extras = [];
            if (terrain !== TERRAIN_OCEAN && MapGenerator.random() > 0.94) {
                extras.push("1");
            }

            var tileData = {
                tile: index,
                x: x,
                y: y,
                terrain: terrain,
                known: 2, // TILE_KNOWN_SEEN
                extras: extras,
                owner: null,
                worked: null,
                height: hMap[y][x],
                nuke: 0
            };

            // Register tile with the engine
            handle_tile_info(tileData);
        }
    }

    console.log("[Generator] Finished. Land Coverage: " + ((landCount / (width * height)) * 100).toFixed(1) + "%");
}