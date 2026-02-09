/**********************************************************************
    Freeciv-web - Fracture Map Generator (Diamond-Square Implementation)
    Based on Freeciv's server/generator/fracture_map.c

    Features:
    - Recursive fractal subdivision for "fractured" coastlines
    - High land-to-water ratio (Mostly Land)
    - Scattered mountain peaks and deep lakes
    - Latitudinal temperature (Arctic/Tundra poles)
***********************************************************************/

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

var FractureGenerator = {
    seed: 0,
    width: 0,
    height: 0,
    heightMap: [],

    // Deterministic random
    random: function() {
        var x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    },

    initialize: function(w, h, s) {
        this.width = w;
        this.height = h;
        this.seed = s;
        // Initialize 2D heightmap with zeros
        this.heightMap = Array(h).fill().map(() => Array(w).fill(0));
    },

    /**
     * Recursive Diamond-Square subdivision
     * This creates the "Fractured" look of the original C code.
     */
    generateFracture: function() {
        var size = Math.max(this.width, this.height);
        // Find the smallest power of 2 >= size
        var n = Math.ceil(Math.log2(size - 1));
        var pow2 = Math.pow(2, n);

        // Temporary larger map to handle power-of-2 logic
        var tempMap = Array(pow2 + 1).fill().map(() => Array(pow2 + 1).fill(0));

        // Initial seeds in corners
        tempMap[0][0] = this.random();
        tempMap[0][pow2] = this.random();
        tempMap[pow2][0] = this.random();
        tempMap[pow2][pow2] = this.random();

        var roughness = 0.55; // Lower = smoother, Higher = more fractured

        for (var side = pow2; side >= 2; side /= 2) {
            var half = side / 2;
            var scale = roughness * (side / pow2);

            // Diamond step
            for (var y = half; y < pow2; y += side) {
                for (var x = half; x < pow2; x += side) {
                    var avg = (tempMap[y - half][x - half] +
                               tempMap[y - half][x + half] +
                               tempMap[y + half][x - half] +
                               tempMap[y + half][x + half]) / 4;
                    tempMap[y][x] = avg + (this.random() * 2 - 1) * scale;
                }
            }

            // Square step
            for (var y = 0; y <= pow2; y += half) {
                for (var x = (y + half) % side; x <= pow2; x += side) {
                    var sum = 0, count = 0;
                    if (y >= half) { sum += tempMap[y - half][x]; count++; }
                    if (y + half <= pow2) { sum += tempMap[y + half][x]; count++; }
                    if (x >= half) { sum += tempMap[y][x - half]; count++; }
                    if (x + half <= pow2) { sum += tempMap[y][x + half]; count++; }
                    tempMap[y][x] = (sum / count) + (this.random() * 2 - 1) * scale;
                }
            }
        }

        // Copy and normalize into the final heightMap
        for (var y = 0; y < this.height; y++) {
            for (var x = 0; x < this.width; x++) {
                this.heightMap[y][x] = Math.max(0, Math.min(1, tempMap[y][x]));
            }
        }
    },

    /**
     * Determines terrain based on height and latitude
     */
    getTerrain: function(h, y) {
        var latitude = Math.abs(y - this.height / 2) / (this.height / 2);

        // --- WATER (Mostly Land Setting) ---
        // Threshold 0.3 means only 30% water (Oceans and Lakes)
        if (h < 0.3) return TERRAIN_OCEAN;

        // --- POLES ---
        if (latitude > 0.88) return TERRAIN_ARCTIC;
        if (latitude > 0.75) return (h > 0.8) ? TERRAIN_MOUNTAINS : TERRAIN_TUNDRA;

        // --- ELEVATION ---
        if (h > 0.85) return TERRAIN_MOUNTAINS; // Scattered peaks
        if (h > 0.72) return TERRAIN_HILLS;

        // --- CLIMATE ---
        if (latitude < 0.2) { // Equator
            if (h < 0.4) return TERRAIN_SWAMP;
            if (h > 0.6) return TERRAIN_FOREST;
            return TERRAIN_GRASSLAND;
        }

        if (latitude > 0.3 && latitude < 0.5 && h < 0.45) return TERRAIN_DESERT;

        if (h > 0.55) return TERRAIN_FOREST;
        return (h > 0.45) ? TERRAIN_GRASSLAND : TERRAIN_PLAINS;
    }
};

/**
 * Entry point for Freeciv-web
 */
function generator_create_map(width, height, options) {
    width = width || 80;
    height = height || 50;
    var seed = (options && options.seed) ? options.seed : Math.floor(Math.random() * 1000000);

    console.log("[Fracture] Generating " + width + "x" + height + " (Seed: " + seed + ")");

    FractureGenerator.initialize(width, height, seed);
    FractureGenerator.generateFracture();

    // Map info setup - use hexagonal topology (TF_HEX = 2, TF_ISO = 1, combined = 3)
    // TF_HEX | TF_ISO = 3 for isometric hex grid
    handle_map_info({
        xsize: width,
        ysize: height,
        topology_id: 3,  // TF_HEX | TF_ISO = hexagonal isometric topology
        wrap_id: 1, // X-Wrap
        num_valid_dirs: 6  // Hex has 6 valid directions
    });

    // Register terrain types
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

    // Emit tiles
    var land = 0;
    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
            var h = FractureGenerator.heightMap[y][x];
            var terrain = FractureGenerator.getTerrain(h, y);
            var index = x + y * width;

            if (terrain !== TERRAIN_OCEAN) land++;

            handle_tile_info({
                tile: index,
                x: x,
                y: y,
                terrain: terrain,
                known: TILE_UNKNOWN,  // Start with fog of war - tiles unknown
                extras: (terrain !== TERRAIN_OCEAN && FractureGenerator.random() > 0.96) ? ["1"] : [],
                height: h
            });
        }
    }

    console.log("[Fracture] Generation complete. Land: " + ((land / (width * height)) * 100).toFixed(1) + "%");
}