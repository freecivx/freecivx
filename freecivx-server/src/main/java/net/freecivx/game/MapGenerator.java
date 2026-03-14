package net.freecivx.game;

import java.util.HashMap;
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

    public MapGenerator(int width, int height) {
        this.width = width;
        this.height = height;
        this.seed = new Random().nextInt();  // ✅ **Unique random seed**
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

                if (elevation < -0.5) {  // **Deep ocean**
                    terrain = TERRAIN_OCEAN;
                    heightLevel = -200;
                } else if (elevation < -0.2) {  // **Coastline**
                    terrain = TERRAIN_COAST;
                    heightLevel = -100;
                } else if (elevation < 0.2) {  // **Plains and grasslands**
                    terrain = (random.nextDouble() < 0.5) ? TERRAIN_GRASSLAND : TERRAIN_PLAINS;
                    heightLevel = 100;
                } else if (elevation < 0.5) {  // **Forests, hills, deserts**
                    if (random.nextDouble() < 0.3) {
                        terrain = TERRAIN_FOREST;
                    } else if (random.nextDouble() < 0.6) {
                        terrain = TERRAIN_HILLS;
                    } else {
                        terrain = TERRAIN_DESERT;
                    }
                    heightLevel = 200;
                } else {  // **Mountains**
                    terrain = TERRAIN_MOUNTAINS;
                    heightLevel = 400;
                }

                Tile tile = new Tile(index, 2, terrain, 1, 1, heightLevel, -1);
                tiles.put(index, tile);
            }
        }
        return tiles;
    }
}
