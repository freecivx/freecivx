/* Copyright (C) The Authors 2025 */
package net.freecivx.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for {@link Movement} terrain-based movement costs.
 *
 * <p>Verifies the terrain-aware {@code tileMoveCost} overload:
 * <ul>
 *   <li>flat terrain (grassland, plains) costs 1 move point,</li>
 *   <li>rough terrain (hills, forest, jungle, swamp) costs 2,</li>
 *   <li>mountains cost 3,</li>
 *   <li>a road halves the cost (minimum 1),</li>
 *   <li>a railroad always costs 1 regardless of terrain,</li>
 *   <li>null arguments return {@link Integer#MAX_VALUE}.</li>
 * </ul>
 *
 * <p>The tests mirror the terrain {@code movement_cost} values from the
 * classic Freeciv ruleset and the road/rail movement bonuses described in
 * the C Freeciv server's {@code common/movement.c}.
 */
public class MovementTest {

    private static final int TERRAIN_GRASSLAND = 7;
    private static final int TERRAIN_HILLS     = 8;
    private static final int TERRAIN_FOREST    = 6;
    private static final int TERRAIN_MOUNTAINS = 10;
    private static final int TERRAIN_PLAINS    = 11;
    private static final int TERRAIN_JUNGLE    = 9;
    private static final int TERRAIN_SWAMP     = 12;

    private Map<Long, Terrain> terrains;
    private Unit dummyUnit; // unit for move-cost calls; only type/domain matters here

    @BeforeEach
    public void setUp() {
        terrains = new HashMap<>();
        // Defence bonus, move cost — mirrors Game.initGame() terrain table
        terrains.put((long) TERRAIN_GRASSLAND, new Terrain("Grassland", "",   0, 1));
        terrains.put((long) TERRAIN_PLAINS,    new Terrain("Plains",    "",   0, 1));
        terrains.put((long) TERRAIN_FOREST,    new Terrain("Forest",    "",  50, 2));
        terrains.put((long) TERRAIN_HILLS,     new Terrain("Hills",     "", 100, 2));
        terrains.put((long) TERRAIN_JUNGLE,    new Terrain("Jungle",    "",  50, 2));
        terrains.put((long) TERRAIN_SWAMP,     new Terrain("Swamp",     "",  50, 2));
        terrains.put((long) TERRAIN_MOUNTAINS, new Terrain("Mountains", "", 200, 3));

        dummyUnit = new Unit(1, 0, 0, 3 /* Warriors */, 0, 0, 10, 0, 3);
    }

    /** Helper: build a tile with no extras (extras bitvector = 0). */
    private Tile flat(int terrainId) {
        return new Tile(0, 1, terrainId, 0, 0 /* no extras */, 0, -1);
    }

    /** Helper: build a tile with a road (bit 6 set in extras bitvector). */
    private Tile withRoad(int terrainId) {
        return new Tile(0, 1, terrainId, 0, 1 << Movement.EXTRA_BIT_ROAD, 0, -1);
    }

    /** Helper: build a tile with a railroad (bit 7 set in extras bitvector). */
    private Tile withRailroad(int terrainId) {
        return new Tile(0, 1, terrainId, 0, 1 << Movement.EXTRA_BIT_RAIL, 0, -1);
    }

    // ---------------------------------------------------------------
    // Flat terrain (no roads)
    // ---------------------------------------------------------------

    @Test
    public void testGrassland_costsOneMovePoint() {
        Tile src  = flat(TERRAIN_GRASSLAND);
        Tile dest = flat(TERRAIN_GRASSLAND);
        assertEquals(1, Movement.tileMoveCost(src, dest, dummyUnit, terrains));
    }

    @Test
    public void testPlains_costsOneMovePoint() {
        Tile src  = flat(TERRAIN_GRASSLAND);
        Tile dest = flat(TERRAIN_PLAINS);
        assertEquals(1, Movement.tileMoveCost(src, dest, dummyUnit, terrains));
    }

    @Test
    public void testHills_costsTwoMovePoints() {
        Tile src  = flat(TERRAIN_GRASSLAND);
        Tile dest = flat(TERRAIN_HILLS);
        assertEquals(2, Movement.tileMoveCost(src, dest, dummyUnit, terrains));
    }

    @Test
    public void testForest_costsTwoMovePoints() {
        Tile src  = flat(TERRAIN_GRASSLAND);
        Tile dest = flat(TERRAIN_FOREST);
        assertEquals(2, Movement.tileMoveCost(src, dest, dummyUnit, terrains));
    }

    @Test
    public void testJungle_costsTwoMovePoints() {
        Tile src  = flat(TERRAIN_GRASSLAND);
        Tile dest = flat(TERRAIN_JUNGLE);
        assertEquals(2, Movement.tileMoveCost(src, dest, dummyUnit, terrains));
    }

    @Test
    public void testSwamp_costsTwoMovePoints() {
        Tile src  = flat(TERRAIN_GRASSLAND);
        Tile dest = flat(TERRAIN_SWAMP);
        assertEquals(2, Movement.tileMoveCost(src, dest, dummyUnit, terrains));
    }

    @Test
    public void testMountains_costsThreeMovePoints() {
        Tile src  = flat(TERRAIN_GRASSLAND);
        Tile dest = flat(TERRAIN_MOUNTAINS);
        assertEquals(3, Movement.tileMoveCost(src, dest, dummyUnit, terrains));
    }

    // ---------------------------------------------------------------
    // Road bonus: cost / ROAD_MOVE_DIVISOR (min 1)
    // ---------------------------------------------------------------

    @Test
    public void testRoadOnGrassland_costsOneMovePoint() {
        // Grassland base cost = 1; 1 / 3 = 0 → clamped to 1
        Tile src  = flat(TERRAIN_GRASSLAND);
        Tile dest = withRoad(TERRAIN_GRASSLAND);
        assertEquals(1, Movement.tileMoveCost(src, dest, dummyUnit, terrains));
    }

    @Test
    public void testRoadOnHills_costsOneMovePoint() {
        // Hills base cost = 2; 2 / 3 = 0 → clamped to 1
        Tile src  = flat(TERRAIN_GRASSLAND);
        Tile dest = withRoad(TERRAIN_HILLS);
        assertEquals(1, Movement.tileMoveCost(src, dest, dummyUnit, terrains));
    }

    @Test
    public void testRoadOnMountains_costsOneMovePoint() {
        // Mountains base cost = 3; 3 / 3 = 1
        Tile src  = flat(TERRAIN_GRASSLAND);
        Tile dest = withRoad(TERRAIN_MOUNTAINS);
        assertEquals(1, Movement.tileMoveCost(src, dest, dummyUnit, terrains));
    }

    // ---------------------------------------------------------------
    // Railroad bonus: always costs 1
    // ---------------------------------------------------------------

    @Test
    public void testRailroadOnGrassland_costsOne() {
        Tile src  = flat(TERRAIN_GRASSLAND);
        Tile dest = withRailroad(TERRAIN_GRASSLAND);
        assertEquals(1, Movement.tileMoveCost(src, dest, dummyUnit, terrains));
    }

    @Test
    public void testRailroadOnMountains_costsOne() {
        Tile src  = flat(TERRAIN_GRASSLAND);
        Tile dest = withRailroad(TERRAIN_MOUNTAINS);
        assertEquals(1, Movement.tileMoveCost(src, dest, dummyUnit, terrains));
    }

    // ---------------------------------------------------------------
    // Null safety
    // ---------------------------------------------------------------

    @Test
    public void testNullSrc_returnsMaxValue() {
        Tile dest = flat(TERRAIN_GRASSLAND);
        assertEquals(Integer.MAX_VALUE, Movement.tileMoveCost(null, dest, dummyUnit, terrains));
    }

    @Test
    public void testNullDest_returnsMaxValue() {
        Tile src = flat(TERRAIN_GRASSLAND);
        assertEquals(Integer.MAX_VALUE, Movement.tileMoveCost(src, null, dummyUnit, terrains));
    }

    @Test
    public void testNullUnit_returnsMaxValue() {
        Tile src  = flat(TERRAIN_GRASSLAND);
        Tile dest = flat(TERRAIN_GRASSLAND);
        assertEquals(Integer.MAX_VALUE, Movement.tileMoveCost(src, dest, null, terrains));
    }

    // ---------------------------------------------------------------
    // Unit move rate
    // ---------------------------------------------------------------

    @Test
    public void testUnitMoveRate_baseRate() {
        UnitType warriors = new UnitType("Warriors", "u.warriors", 1, 10, 1, "", 1, 1, "", 0);
        Unit unit = new Unit(1, 0, 0, 3, 0, 0, 10, 0, 1);
        assertEquals(1, Movement.unitMoveRate(unit, warriors));
    }

    @Test
    public void testUnitMoveRate_veteranBonus() {
        UnitType cavalry = new UnitType("Cavalry", "u.cavalry", 3, 20, 1, "", 8, 3, "", 0);
        Unit unit = new Unit(1, 0, 0, 14, 0, 2, 20, 0, 3); // veteran=2
        // base=3 + veteran_bonus=2 = 5
        assertEquals(5, Movement.unitMoveRate(unit, cavalry));
    }

    @Test
    public void testUnitMoveRate_nullUnit() {
        UnitType warriors = new UnitType("Warriors", "u.warriors", 1, 10, 1, "", 1, 1, "", 0);
        assertEquals(0, Movement.unitMoveRate(null, warriors));
    }
}
