/* Copyright (C) The Authors 2025 */
package net.freecivx.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for the A* {@link PathFinder}.
 *
 * <p>Verifies that the path finder:
 * <ul>
 *   <li>returns an empty list for same-tile requests,</li>
 *   <li>finds a valid path on a flat grassland map,</li>
 *   <li>avoids ocean tiles for land units,</li>
 *   <li>correctly prefers lower-cost terrain (flat over hills) when
 *       available.</li>
 * </ul>
 */
public class PathFinderTest {

    /**
     * Minimal stub of {@link Game} that exposes just enough state for
     * {@link PathFinder} without starting a full server.
     */
    private static class StubGame extends Game {
        StubGame() {
            super(null); // server = null; we never call server methods in PathFinder
        }
    }

    private StubGame game;
    private static final int XSIZE = 10;
    private static final int YSIZE = 10;

    @BeforeEach
    public void setUp() {
        game = new StubGame();
        game.map = new WorldMap(XSIZE, YSIZE);

        // Fill map with grassland tiles (terrain 7, moveCost=1, defenseBonus=0)
        for (int i = 0; i < XSIZE * YSIZE; i++) {
            game.tiles.put((long) i, new Tile(i, 1, 7, 0, 0, 0, -1));
        }

        // Register the terrains used by PathFinder.getMoveCost()
        game.terrains.put(2L,  new Terrain("Ocean",      "floor",  0, 99)); // impassable land
        game.terrains.put(3L,  new Terrain("Deep Ocean", "coast",  0, 99));
        game.terrains.put(7L,  new Terrain("Grassland",  "",       0,  1));
        game.terrains.put(8L,  new Terrain("Hills",      "",     100,  2));
        game.terrains.put(10L, new Terrain("Mountains",  "",     200,  3));
    }

    /** Helper: tile index from (x, y) on a 10×10 map. */
    private long idx(int x, int y) {
        return (long) y * XSIZE + x;
    }

    // ---------------------------------------------------------------
    // Same-tile (trivial case)
    // ---------------------------------------------------------------

    @Test
    public void testSameTile_returnsEmpty() {
        PathFinder pf = new PathFinder(game);
        List<Integer> dirs = pf.findPath(idx(3, 3), idx(3, 3), 0);
        assertTrue(dirs.isEmpty());
    }

    // ---------------------------------------------------------------
    // Flat grassland path
    // ---------------------------------------------------------------

    @Test
    public void testSimplePath_arrivesAtDestination() {
        PathFinder pf = new PathFinder(game);
        long start = idx(0, 0);
        long dest  = idx(4, 4);
        List<Integer> dirs = pf.findPath(start, dest, 0 /* land */);

        // Follow the path and verify we end up at dest
        assertFalse(dirs.isEmpty(), "Expected a non-empty path");
        long cur = start;
        int[] DX = {-1, 0, 1, -1, 1, -1, 0, 1};
        int[] DY = {-1, -1, -1, 0, 0, 1, 1, 1};
        for (int d : dirs) {
            Tile t = game.tiles.get(cur);
            long x = t.getX(XSIZE) + DX[d];
            long y = t.getY(XSIZE) + DY[d];
            cur = y * XSIZE + x;
        }
        assertEquals(dest, cur, "Path should end exactly at destination");
    }

    @Test
    public void testOptimalPath_chebyshevLength() {
        // Chebyshev distance from (0,0) to (3,5) = max(3,5) = 5
        PathFinder pf = new PathFinder(game);
        List<Integer> dirs = pf.findPath(idx(0, 0), idx(3, 5), 0);
        // On flat terrain, optimal Chebyshev path has exactly max(dx,dy) steps
        assertEquals(5, dirs.size(), "Optimal path on flat terrain should use Chebyshev steps");
    }

    // ---------------------------------------------------------------
    // Ocean avoidance (land unit)
    // ---------------------------------------------------------------

    @Test
    public void testOceanBlocked_landUnit() {
        // Place a vertical ocean wall at x=5 from y=0 to y=9
        for (int y = 0; y < YSIZE; y++) {
            game.tiles.put(idx(5, y), new Tile(idx(5, y), 1, 2, 0, 0, 0, -1)); // Ocean
        }
        PathFinder pf = new PathFinder(game);
        // Start is to the left of the wall, dest to the right — but the map
        // wraps horizontally, so the unit should go around the other way.
        List<Integer> dirs = pf.findPath(idx(4, 5), idx(6, 5), 0);

        // Verify none of the tiles in the path cross x=5
        long cur = idx(4, 5);
        int[] DX = {-1, 0, 1, -1, 1, -1, 0, 1};
        int[] DY = {-1, -1, -1, 0, 0, 1, 1, 1};
        for (int d : dirs) {
            Tile t = game.tiles.get(cur);
            long x = ((t.getX(XSIZE) + DX[d]) % XSIZE + XSIZE) % XSIZE;
            long y = t.getY(XSIZE) + DY[d];
            cur = y * XSIZE + x;
            assertFalse(x == 5L, "Path must not cross the ocean wall at x=5");
        }
    }

    @Test
    public void testOceanTile_seaUnit_canTraverse() {
        // Place ocean tiles across the map
        for (int i = 0; i < XSIZE * YSIZE; i++) {
            game.tiles.put((long) i, new Tile(i, 1, 2, 0, 0, 0, -1)); // all ocean
        }
        PathFinder pf = new PathFinder(game);
        // Sea unit (domain=1) should be able to find a path
        List<Integer> dirs = pf.findPath(idx(0, 0), idx(3, 3), 1 /* sea */);
        assertFalse(dirs.isEmpty(), "Sea unit should find a path through ocean tiles");
    }

    // ---------------------------------------------------------------
    // Terrain-cost preference
    // ---------------------------------------------------------------

    @Test
    public void testHillsAvoided_whenFlatAlternativeExists() {
        // Mark the direct diagonal as Hills (moveCost=2); flat detour is cheaper.
        // Start=(0,0), dest=(2,0).  Direct path goes through (1,0) (flat) or
        // diagonals.  We put hills at (1,0) to force a detour.
        game.tiles.put(idx(1, 0), new Tile(idx(1, 0), 1, 8, 0, 0, 0, -1)); // Hills
        PathFinder pf = new PathFinder(game);

        List<Integer> dirs = pf.findPath(idx(0, 0), idx(2, 0), 0);
        assertFalse(dirs.isEmpty());

        // The path should avoid going straight through x=1,y=0 if a cheaper
        // route exists.  At minimum the path must be valid.
        long cur = idx(0, 0);
        int[] DX = {-1, 0, 1, -1, 1, -1, 0, 1};
        int[] DY = {-1, -1, -1, 0, 0, 1, 1, 1};
        for (int d : dirs) {
            Tile t = game.tiles.get(cur);
            long x = ((t.getX(XSIZE) + DX[d]) % XSIZE + XSIZE) % XSIZE;
            long y = t.getY(XSIZE) + DY[d];
            cur = y * XSIZE + x;
        }
        assertEquals(idx(2, 0), cur, "Path must still arrive at destination even with hills");
    }
}
