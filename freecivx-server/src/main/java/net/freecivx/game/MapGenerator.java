package net.freecivx.game;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

public class MapGenerator {
    private final int width;
    private final int height;
    private final Map<Long, Tile> tiles = new HashMap<>();
    private final Random random;
    private final double[][] heightMap;
    private final int seed;

    // **Terrain IDs**
    private static final int TERRAIN_OCEAN = 3;
    private static final int TERRAIN_COAST = 2;
    private static final int TERRAIN_LAKE = 1;
    private static final int TERRAIN_GRASSLAND = 7;
    private static final int TERRAIN_PLAINS = 11;
    private static final int TERRAIN_FOREST = 6;
    private static final int TERRAIN_HILLS = 8;
    private static final int TERRAIN_MOUNTAINS = 10;
    private static final int TERRAIN_DESERT = 5;
    private static final int TERRAIN_SWAMP = 12;
    private static final int TERRAIN_TUNDRA = 13;
    private static final int TERRAIN_JUNGLE = 9;
    private static final int TERRAIN_GLACIER = 4;

    // **Extra IDs (bit positions in the tile extras bitvector)**
    // Must match the extras order in Game.initGame()
    private static final int EXTRA_BIT_RIVER      = 0;
    private static final int EXTRA_BIT_HUT         = 8;
    // Resource extra bit positions (bits 15-31, must match Game.initGame() extras).
    private static final int EXTRA_BIT_CATTLE      = 15;
    private static final int EXTRA_BIT_GAME        = 16;
    private static final int EXTRA_BIT_WHEAT       = 17;
    private static final int EXTRA_BIT_BUFFALO     = 18;
    private static final int EXTRA_BIT_PHEASANT    = 19;
    private static final int EXTRA_BIT_COAL        = 20;
    private static final int EXTRA_BIT_IRON        = 21;
    private static final int EXTRA_BIT_GOLD        = 22;
    private static final int EXTRA_BIT_OASIS       = 23;
    private static final int EXTRA_BIT_FISH        = 24;
    private static final int EXTRA_BIT_WHALES      = 25;
    private static final int EXTRA_BIT_SILK        = 26;
    private static final int EXTRA_BIT_FRUIT       = 27;
    private static final int EXTRA_BIT_GEMS        = 28;
    private static final int EXTRA_BIT_IVORY       = 29;
    private static final int EXTRA_BIT_OIL         = 30;
    private static final int EXTRA_BIT_WINE        = 31;

    // **Resource IDs** (0 = none; must match resource ruleset order)
    private static final int RESOURCE_NONE        = 0;
    private static final int RESOURCE_CATTLE      = 1;
    private static final int RESOURCE_GAME        = 2;
    private static final int RESOURCE_WHEAT       = 3;
    private static final int RESOURCE_BUFFALO     = 4;
    private static final int RESOURCE_PHEASANT    = 5;
    private static final int RESOURCE_COAL        = 6;
    private static final int RESOURCE_IRON        = 7;
    private static final int RESOURCE_GOLD        = 8;
    private static final int RESOURCE_OASIS       = 9;
    private static final int RESOURCE_FISH        = 10;
    private static final int RESOURCE_WHALES      = 11;
    private static final int RESOURCE_SILK        = 12;
    private static final int RESOURCE_FRUIT       = 13;
    private static final int RESOURCE_GEMS        = 14;
    private static final int RESOURCE_IVORY       = 15;
    private static final int RESOURCE_OIL         = 16;
    private static final int RESOURCE_WINE        = 17;

    // Probability that a given land tile has a resource
    private static final double RESOURCE_PROBABILITY = 0.15;
    // Probability that a given land tile has a hut
    private static final double HUT_PROBABILITY = 0.03;
    // Number of river sources to generate (roughly 1 river per 200 land tiles)
    private static final int RIVER_SOURCE_COUNT = 10;
    // Maximum number of steps a river takes before stopping
    private static final int RIVER_MAX_STEPS = 20;

    public MapGenerator(int width, int height) {
        this.width = width;
        this.height = height;
        this.seed = new Random().nextInt();  // ✅ **Unique random seed**
        this.random = new Random(seed);
        this.heightMap = new double[width][height];

        generateHeightMap();
    }

    /**
     * Creates a map generator with an explicit seed for reproducible generation.
     * Mirrors the {@code mapseed} setting in the C Freeciv server's autogame
     * test script ({@code scripts/test-autogame.serv}).
     *
     * @param width  map width in tiles
     * @param height map height in tiles
     * @param seed   deterministic seed value (same seed produces identical maps)
     */
    public MapGenerator(int width, int height, int seed) {
        this.width = width;
        this.height = height;
        this.seed = seed;
        this.random = new Random(seed);
        this.heightMap = new double[width][height];

        generateHeightMap();
    }

    /**
     * **Generates a heightmap using Fractal Brownian Motion (fBM)**
     */
    private void generateHeightMap() {
        double scale = 0.02;
        int octaves = 4;
        double persistence = 0.5;
        double lacunarity = 2.0;

        for (int x = 0; x < width; x++) {
            for (int y = 0; y < height; y++) {
                double value = fractalNoise(x * scale, y * scale, octaves, persistence, lacunarity);
                heightMap[x][y] = value;
            }
        }

        normalizeHeightMap();
    }

    /**
     * **Fractal Brownian Motion (fBM) - Sum of layered Perlin-like noise.**
     */
    private double fractalNoise(double x, double y, int octaves, double persistence, double lacunarity) {
        double total = 0;
        double frequency = 1.0;
        double amplitude = 1.0;
        double maxValue = 0;

        for (int i = 0; i < octaves; i++) {
            total += simpleNoise(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        return total / maxValue;
    }

    /**
     * **Simple smooth noise function (Perlin-like)**
     */
    private double simpleNoise(double x, double y) {
        int xi = (int) x;
        int yi = (int) y;
        double xf = x - xi;
        double yf = y - yi;

        double topRight = randomValue(xi + 1, yi + 1);
        double topLeft = randomValue(xi, yi + 1);
        double bottomRight = randomValue(xi + 1, yi);
        double bottomLeft = randomValue(xi, yi);

        double u = fade(xf);
        double v = fade(yf);

        double lerpTop = lerp(topLeft, topRight, u);
        double lerpBottom = lerp(bottomLeft, bottomRight, u);
        return lerp(lerpBottom, lerpTop, v);
    }

    /**
     * **Uses the seed for deterministic random values**
     */
    private double randomValue(int x, int y) {
        int hash = (x * 49632) ^ (y * 325176) ^ seed;
        return (Math.sin(hash) + 1) * 0.5;
    }

    private double fade(double t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    private double lerp(double a, double b, double t) {
        return a + t * (b - a);
    }

    /**
     * **Normalizes the height map to range [-1, 1]**
     */
    private void normalizeHeightMap() {
        double min = Double.MAX_VALUE;
        double max = Double.MIN_VALUE;

        for (int x = 0; x < width; x++) {
            for (int y = 0; y < height; y++) {
                min = Math.min(min, heightMap[x][y]);
                max = Math.max(max, heightMap[x][y]);
            }
        }

        for (int x = 0; x < width; x++) {
            for (int y = 0; y < height; y++) {
                heightMap[x][y] = 2 * ((heightMap[x][y] - min) / (max - min)) - 1;
            }
        }
    }

    /**
     * **Generates the final terrain map**
     */
    public Map<Long, Tile> generateMap() {
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                long index = y * width + x;
                double elevation = heightMap[x][y];

                int terrain;
                int heightLevel;

                if (elevation < -0.72) {  // **Deep ocean**
                    terrain = TERRAIN_OCEAN;
                    heightLevel = -200;
                } else if (elevation < -0.56) {  // **Coastline**
                    terrain = TERRAIN_COAST;
                    heightLevel = -100;
                } else if (elevation < 0.2) {  // **Low-lying land: plains, jungle, swamp**
                    double r = random.nextDouble();
                    if (r < 0.38) {
                        terrain = TERRAIN_GRASSLAND;
                    } else if (r < 0.72) {
                        terrain = TERRAIN_PLAINS;
                    } else if (r < 0.87) {
                        terrain = TERRAIN_JUNGLE;
                    } else {
                        terrain = TERRAIN_SWAMP;
                    }
                    heightLevel = 100;
                } else if (elevation < 0.5) {  // **Mid-elevation: forests, hills, desert, tundra**
                    double r = random.nextDouble();
                    if (r < 0.28) {
                        terrain = TERRAIN_FOREST;
                    } else if (r < 0.52) {
                        terrain = TERRAIN_HILLS;
                    } else if (r < 0.72) {
                        terrain = TERRAIN_DESERT;
                    } else if (r < 0.88) {
                        terrain = TERRAIN_TUNDRA;
                    } else {
                        terrain = TERRAIN_SWAMP;
                    }
                    heightLevel = 200;
                } else {  // **High elevation: mountains and glaciers**
                    terrain = (random.nextDouble() < 0.25) ? TERRAIN_GLACIER : TERRAIN_MOUNTAINS;
                    heightLevel = 400;
                }

                // Assign a tile resource based on terrain type (0 = none, positive = resource id)
                int resource = assignResource(terrain);

                // Assign extras bitvector - bit EXTRA_BIT_HUT (8) = Hut
                int extras = 0;
                boolean isLand = terrain != TERRAIN_OCEAN && terrain != TERRAIN_COAST && terrain != TERRAIN_LAKE;
                if (isLand && random.nextDouble() < HUT_PROBABILITY) {
                    extras |= (1 << EXTRA_BIT_HUT);
                }

                // Also encode the resource as an extra bit so the client's
                // tile_resource() (which uses EC_RESOURCE extras) can find it.
                int resourceBit = resourceToExtraBit(resource);
                if (resourceBit >= 0) {
                    extras |= (1 << resourceBit);
                }

                Tile tile = new Tile(index, 2, terrain, resource, extras, heightLevel, -1);
                tiles.put(index, tile);
            }
        }

        generateRivers();

        return tiles;
    }

    /**
     * Generates rivers on the map by tracing paths from high-elevation land
     * tiles (mountains and hills) downhill toward the coast.
     *
     * <p>Each river starts at a randomly chosen mountain or hill tile and
     * follows the path of steepest descent (using the heightmap), marking
     * each visited land tile with the {@link #EXTRA_BIT_RIVER} extra bit.
     * Rivers stop when they reach ocean/coast or when the maximum step count
     * is exceeded.  Mirrors the general spirit of {@code river_generate()} in
     * the C Freeciv server's {@code server/generator/mapgen.c}.
     */
    private void generateRivers() {
        // Cardinal directions for river flow (N, S, W, E)
        final int[][] DIRS = {{0, -1}, {0, 1}, {-1, 0}, {1, 0}};

        // Collect candidate river source tiles (mountains and hills)
        List<long[]> candidates = new ArrayList<>();
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                long index = (long) y * width + x;
                Tile tile = tiles.get(index);
                if (tile == null) continue;
                int t = tile.getTerrain();
                if (t == TERRAIN_MOUNTAINS || t == TERRAIN_HILLS) {
                    candidates.add(new long[]{x, y, index});
                }
            }
        }
        if (candidates.isEmpty()) return;

        for (int r = 0; r < RIVER_SOURCE_COUNT; r++) {
            long[] src = candidates.get(random.nextInt(candidates.size()));
            int cx = (int) src[0];
            int cy = (int) src[1];

            for (int step = 0; step < RIVER_MAX_STEPS; step++) {
                long idx = (long) cy * width + cx;
                Tile cur = tiles.get(idx);
                if (cur == null) break;

                int terrain = cur.getTerrain();
                // Rivers flow on land only; stop at ocean or coast
                if (terrain == TERRAIN_OCEAN || terrain == TERRAIN_COAST
                        || terrain == TERRAIN_LAKE) break;

                // Mark this tile as having a river
                cur.setExtras(cur.getExtras() | (1 << EXTRA_BIT_RIVER));

                // Find the lowest adjacent tile (steepest descent)
                double minHeight = heightMap[cx][cy];
                int bestDx = 0;
                int bestDy = 0;
                boolean foundLower = false;

                for (int[] d : DIRS) {
                    int nx = cx + d[0];
                    int ny = cy + d[1];
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                    double nh = heightMap[nx][ny];
                    if (nh < minHeight) {
                        minHeight = nh;
                        bestDx = d[0];
                        bestDy = d[1];
                        foundLower = true;
                    }
                }

                if (!foundLower) break; // at a local minimum — stop the river
                cx += bestDx;
                cy += bestDy;
            }
        }
    }

    /**
     * Assigns a resource id to a tile based on its terrain type.
     * Returns RESOURCE_NONE (0) if no resource is assigned.
     * Resource assignments match the classic Freeciv terrain.ruleset.
     */
    private int assignResource(int terrain) {
        if (random.nextDouble() > RESOURCE_PROBABILITY) return RESOURCE_NONE;
        return switch (terrain) {
            case TERRAIN_PLAINS    -> {
                double r = random.nextDouble();
                yield r < 0.33 ? RESOURCE_BUFFALO : r < 0.66 ? RESOURCE_CATTLE : RESOURCE_WHEAT;
            }
            case TERRAIN_FOREST    -> random.nextBoolean() ? RESOURCE_PHEASANT : RESOURCE_SILK;
            case TERRAIN_HILLS     -> random.nextBoolean() ? RESOURCE_COAL : RESOURCE_WINE;
            case TERRAIN_MOUNTAINS -> random.nextBoolean() ? RESOURCE_GOLD : RESOURCE_IRON;
            case TERRAIN_DESERT    -> random.nextBoolean() ? RESOURCE_OASIS : RESOURCE_OIL;
            case TERRAIN_GLACIER   -> random.nextBoolean() ? RESOURCE_IVORY : RESOURCE_OIL;
            case TERRAIN_TUNDRA    -> RESOURCE_GAME;
            case TERRAIN_JUNGLE    -> random.nextBoolean() ? RESOURCE_FRUIT : RESOURCE_GEMS;
            // Fish and whales only appear in ocean waters close to land (coast tiles).
            // Deep ocean tiles remain barren.
            case TERRAIN_COAST -> random.nextBoolean() ? RESOURCE_FISH : RESOURCE_WHALES;
            default -> RESOURCE_NONE;
        };
    }

    /**
     * Maps a resource ID to its corresponding extra bit position so the client
     * can discover it via tile_resource() / EC_RESOURCE extras.
     * Returns -1 for RESOURCE_NONE.
     */
    private int resourceToExtraBit(int resource) {
        return switch (resource) {
            case RESOURCE_CATTLE   -> EXTRA_BIT_CATTLE;
            case RESOURCE_GAME     -> EXTRA_BIT_GAME;
            case RESOURCE_WHEAT    -> EXTRA_BIT_WHEAT;
            case RESOURCE_BUFFALO  -> EXTRA_BIT_BUFFALO;
            case RESOURCE_PHEASANT -> EXTRA_BIT_PHEASANT;
            case RESOURCE_COAL     -> EXTRA_BIT_COAL;
            case RESOURCE_IRON     -> EXTRA_BIT_IRON;
            case RESOURCE_GOLD     -> EXTRA_BIT_GOLD;
            case RESOURCE_OASIS    -> EXTRA_BIT_OASIS;
            case RESOURCE_FISH     -> EXTRA_BIT_FISH;
            case RESOURCE_WHALES   -> EXTRA_BIT_WHALES;
            case RESOURCE_SILK     -> EXTRA_BIT_SILK;
            case RESOURCE_FRUIT    -> EXTRA_BIT_FRUIT;
            case RESOURCE_GEMS     -> EXTRA_BIT_GEMS;
            case RESOURCE_IVORY    -> EXTRA_BIT_IVORY;
            case RESOURCE_OIL      -> EXTRA_BIT_OIL;
            case RESOURCE_WINE     -> EXTRA_BIT_WINE;
            default -> -1;
        };
    }

    /**
     * Alternative map generator that places distinct island/continent land masses
     * separated by ocean, then assigns terrain based on latitude.
     *
     * <p>This mirrors the spirit of the C Freeciv server's {@code MAPGEN_FRACTURE}
     * (generator 5): large land masses with clear ocean gaps, latitude-driven
     * climate zones (glaciers at poles, jungle near the equator).
     *
     * <p>The algorithm:
     * <ol>
     *   <li>Fill the map with ocean.</li>
     *   <li>Place {@code NUM_BLOBS} seed points and grow each into a blob of land
     *       using a probability that decreases with distance from the seed.
     *       Each island grows to a target tile count so islands are fairly sized.</li>
     *   <li>Convert ocean tiles adjacent to land into coast.</li>
     *   <li>Assign latitude-appropriate terrain to every land tile.</li>
     *   <li>Place resources, huts, and rivers as normal.</li>
     * </ol>
     *
     * @return the generated tile map
     */
    public Map<Long, Tile> generateIslandMap() {
        // Number of island blobs and their approximate compactness radius
        final int NUM_BLOBS = 25;
        final int BLOB_RADIUS = 5;
        // Each island grows to a target tile count within this range, ensuring
        // islands are fairly sized relative to each other.
        final int MIN_ISLAND_TILES = 15;
        final int MAX_ISLAND_TILES = 40;

        // Phase 1: initialise everything as deep ocean
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                long index = (long) y * width + x;
                tiles.put(index, new Tile(index, 2, TERRAIN_OCEAN, 0, 0, -200, -1));
            }
        }

        // Phase 2: grow land blobs
        boolean[][] isLand = new boolean[width][height];
        int seedRangeX = Math.max(1, width - 6);
        int seedRangeY = Math.max(1, height - 6);
        final int[][] DIRS4 = {{0, 1}, {0, -1}, {1, 0}, {-1, 0}};
        for (int b = 0; b < NUM_BLOBS; b++) {
            // Seed away from the map edges
            int cx = 3 + random.nextInt(seedRangeX);
            int cy = 3 + random.nextInt(seedRangeY);

            // Each island grows to a random target size within the fair-size range.
            int targetTileCount = MIN_ISLAND_TILES
                    + random.nextInt(MAX_ISLAND_TILES - MIN_ISLAND_TILES + 1);
            int maxAttempts = targetTileCount * 20; // Safety cap on iterations

            // Expand outward; probability of adding a neighbour decreases with
            // distance from the blob centre, producing natural coastlines.
            List<int[]> blob = new ArrayList<>();
            blob.add(new int[]{cx, cy});
            isLand[cx][cy] = true;
            int tilesAdded = 1;
            int attempts = 0;

            while (tilesAdded < targetTileCount && attempts < maxAttempts && !blob.isEmpty()) {
                attempts++;
                int[] cell = blob.get(random.nextInt(blob.size()));
                int[] dir = DIRS4[random.nextInt(4)];
                int nx = cell[0] + dir[0];
                int ny = cell[1] + dir[1];
                if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                if (isLand[nx][ny]) continue;
                double dist = Math.sqrt((double)(nx - cx) * (nx - cx)
                        + (double)(ny - cy) * (ny - cy));
                if (random.nextDouble() < Math.exp(-dist / BLOB_RADIUS)) {
                    isLand[nx][ny] = true;
                    blob.add(new int[]{nx, ny});
                    tilesAdded++;
                }
            }
        }

        // Phase 3: assign terrain to each tile
        final int[][] ALL_DIRS = {{0,1},{0,-1},{1,0},{-1,0},{1,1},{1,-1},{-1,1},{-1,-1}};
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                long index = (long) y * width + x;

                if (!isLand[x][y]) {
                    // Coast if any of the 8 neighbours is land, otherwise ocean
                    boolean adjLand = false;
                    for (int[] d : ALL_DIRS) {
                        int nx = x + d[0], ny = y + d[1];
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height && isLand[nx][ny]) {
                            adjLand = true;
                            break;
                        }
                    }
                    int seaTerrain = adjLand ? TERRAIN_COAST : TERRAIN_OCEAN;
                    int seaResource = assignResource(seaTerrain);
                    int seaExtras = 0;
                    int seaResBit = resourceToExtraBit(seaResource);
                    if (seaResBit >= 0) seaExtras |= (1 << seaResBit);
                    int seaHeight = adjLand ? -100 : -200;
                    tiles.put(index, new Tile(index, 2, seaTerrain, seaResource, seaExtras, seaHeight, -1));
                    continue;
                }

                // Latitude: 0.0 = equator, 1.0 = pole
                double halfH = (height > 1) ? (height - 1) * 0.5 : 1.0;
                double latitude = Math.abs(y - halfH) / halfH;
                int terrain = assignLatitudeTerrain(latitude);

                int resource = assignResource(terrain);
                int extras = 0;
                if (random.nextDouble() < HUT_PROBABILITY) {
                    extras |= (1 << EXTRA_BIT_HUT);
                }
                int resourceBit = resourceToExtraBit(resource);
                if (resourceBit >= 0) {
                    extras |= (1 << resourceBit);
                }

                int heightLevel = switch (terrain) {
                    case TERRAIN_MOUNTAINS -> 400;
                    case TERRAIN_HILLS     -> 200;
                    default                -> 100;
                };
                tiles.put(index, new Tile(index, 2, terrain, resource, extras, heightLevel, -1));
            }
        }

        generateRivers();
        return tiles;
    }

    /**
     * Chooses a land terrain type based on latitude, mirroring the climate
     * zones used by the C Freeciv server's temperature/humidity model.
     *
     * @param latitude 0.0 = equator, 1.0 = pole
     * @return terrain type constant
     */
    private int assignLatitudeTerrain(double latitude) {
        if (latitude > 0.80) {
            // Polar: mostly glacier, some tundra
            return random.nextDouble() < 0.65 ? TERRAIN_GLACIER : TERRAIN_TUNDRA;
        } else if (latitude > 0.60) {
            // Sub-polar: tundra, forest, mountains
            double r = random.nextDouble();
            if (r < 0.40) return TERRAIN_TUNDRA;
            if (r < 0.65) return TERRAIN_FOREST;
            if (r < 0.82) return TERRAIN_MOUNTAINS;
            return TERRAIN_HILLS;
        } else if (latitude > 0.35) {
            // Temperate: mixed
            double r = random.nextDouble();
            if (r < 0.25) return TERRAIN_GRASSLAND;
            if (r < 0.45) return TERRAIN_PLAINS;
            if (r < 0.60) return TERRAIN_FOREST;
            if (r < 0.73) return TERRAIN_HILLS;
            if (r < 0.84) return TERRAIN_DESERT;
            return TERRAIN_MOUNTAINS;
        } else {
            // Tropical / equatorial: jungle, grassland, swamp, desert
            double r = random.nextDouble();
            if (r < 0.35) return TERRAIN_JUNGLE;
            if (r < 0.60) return TERRAIN_GRASSLAND;
            if (r < 0.75) return TERRAIN_PLAINS;
            if (r < 0.88) return TERRAIN_SWAMP;
            return TERRAIN_DESERT;
        }
    }
}
