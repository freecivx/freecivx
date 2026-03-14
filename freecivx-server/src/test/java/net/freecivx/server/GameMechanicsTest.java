/* Copyright (C) The Authors 2025 */
package net.freecivx.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import net.freecivx.game.City;
import net.freecivx.game.Game;
import net.freecivx.game.Player;
import net.freecivx.game.Technology;
import net.freecivx.game.Terrain;
import net.freecivx.game.Tile;
import net.freecivx.game.UnitType;
import net.freecivx.game.WorldMap;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Tests for game mechanics improvements: research science output, city walls
 * combat bonus, tech goal tracking, and University science bonus.
 *
 * <p>These tests run without a real {@link CivServer} by using a stub game
 * that never calls server broadcast methods.
 */
public class GameMechanicsTest {

    private static class StubGame extends Game {
        StubGame() { super(null); }
    }

    private StubGame game;

    private static final long PLAYER_ID = 1L;
    private static final long CITY_ID   = 10L;

    @BeforeEach
    public void setUp() {
        game = new StubGame();
        game.map = new WorldMap(10, 10);
        for (int i = 0; i < 100; i++) {
            game.tiles.put((long) i, new Tile(i, 1, 7, 0, 0, 0, -1)); // grassland
        }

        // Base technologies for prerequisite tests
        game.techs.put(0L,  new Technology("Alphabet",       "a.alphabet",    "Alphabet",       "None",    "None",    20));
        game.techs.put(7L,  new Technology("Writing",        "a.writing",     "Writing",        "Alphabet","None",    40));
        game.techs.put(16L, new Technology("Philosophy",     "a.philosophy",  "Philosophy",     "Writing", "None",    40));
        game.techs.put(23L, new Technology("University",     "a.university",  "University",     "Philosophy","Mathematics", 100));
        game.techs.put(1L,  new Technology("Mathematics",    "a.mathematics", "Mathematics",    "Alphabet","None",    40));

        // Register terrain for PathFinder / movement
        game.terrains.put(7L,  new Terrain("Grassland", "", 0, 1));
    }

    // ---------------------------------------------------------------
    // cityScienceContribution — Library and University bonuses
    // ---------------------------------------------------------------

    /**
     * A city of size 4 with no buildings should produce 4 science bulbs.
     */
    @Test
    public void testScienceContribution_noBuildings() {
        City city = new City("Rome", PLAYER_ID, 0L, 4, 1, false, false, 0, true, false, "", 0, 0);
        game.cities.put(CITY_ID, city);
        assertEquals(4, CityTurn.cityScienceContribution(game, CITY_ID));
    }

    /**
     * Library (id=3) adds 50%: size 4 → 4 * 3/2 = 6 bulbs.
     */
    @Test
    public void testScienceContribution_withLibrary() {
        City city = new City("Athens", PLAYER_ID, 0L, 4, 1, false, false, 0, true, false, "", 0, 0);
        city.addImprovement(3); // Library
        game.cities.put(CITY_ID, city);
        assertEquals(6, CityTurn.cityScienceContribution(game, CITY_ID));
    }

    /**
     * University (id=13) adds another 50% on top of Library:
     * size 4 → 4 * 3/2 = 6 (Library) → 6 * 3/2 = 9 bulbs.
     */
    @Test
    public void testScienceContribution_withLibraryAndUniversity() {
        City city = new City("Alexandria", PLAYER_ID, 0L, 4, 1, false, false, 0, true, false, "", 0, 0);
        city.addImprovement(3);  // Library
        city.addImprovement(13); // University
        game.cities.put(CITY_ID, city);
        assertEquals(9, CityTurn.cityScienceContribution(game, CITY_ID));
    }

    /**
     * University without Library still gives the University bonus:
     * size 4 → 4 * 3/2 = 6 bulbs.
     */
    @Test
    public void testScienceContribution_universityAlone() {
        City city = new City("Oxford", PLAYER_ID, 0L, 4, 1, false, false, 0, true, false, "", 0, 0);
        city.addImprovement(13); // University (no Library)
        game.cities.put(CITY_ID, city);
        assertEquals(6, CityTurn.cityScienceContribution(game, CITY_ID));
    }

    /**
     * Non-existent city returns 0 science.
     */
    @Test
    public void testScienceContribution_nullCity() {
        assertEquals(0, CityTurn.cityScienceContribution(game, 999L));
    }

    // ---------------------------------------------------------------
    // Player tech goal tracking
    // ---------------------------------------------------------------

    /**
     * A freshly created player starts with no tech goal (-1).
     */
    @Test
    public void testTechGoal_defaultIsNone() {
        Player player = new Player(PLAYER_ID, "Caesar", "127.0.0.1", 0);
        assertEquals(-1L, player.getTechGoal());
    }

    /**
     * Setting and getting a tech goal round-trips correctly.
     */
    @Test
    public void testTechGoal_setAndGet() {
        Player player = new Player(PLAYER_ID, "Caesar", "127.0.0.1", 0);
        player.setTechGoal(23L); // University
        assertEquals(23L, player.getTechGoal());
    }

    /**
     * Clearing the tech goal (setting to -1) is supported.
     */
    @Test
    public void testTechGoal_clearGoal() {
        Player player = new Player(PLAYER_ID, "Caesar", "127.0.0.1", 0);
        player.setTechGoal(23L);
        player.setTechGoal(-1L);
        assertEquals(-1L, player.getTechGoal());
    }

    // ---------------------------------------------------------------
    // TechTools.canPlayerResearch — prerequisite checking
    // ---------------------------------------------------------------

    /**
     * A player can research Alphabet (no prerequisites).
     */
    @Test
    public void testCanResearch_noPrereq() {
        Player player = new Player(PLAYER_ID, "Caesar", "127.0.0.1", 0);
        game.players.put(PLAYER_ID, player);
        assertTrue(TechTools.canPlayerResearch(game, PLAYER_ID, 0L)); // Alphabet
    }

    /**
     * A player cannot research Writing before knowing Alphabet.
     */
    @Test
    public void testCanResearch_missingPrereq() {
        Player player = new Player(PLAYER_ID, "Caesar", "127.0.0.1", 0);
        game.players.put(PLAYER_ID, player);
        assertFalse(TechTools.canPlayerResearch(game, PLAYER_ID, 7L)); // Writing needs Alphabet
    }

    /**
     * A player can research Writing once they know Alphabet.
     */
    @Test
    public void testCanResearch_prereqSatisfied() {
        Player player = new Player(PLAYER_ID, "Caesar", "127.0.0.1", 0);
        player.addKnownTech(0L); // Alphabet
        game.players.put(PLAYER_ID, player);
        assertTrue(TechTools.canPlayerResearch(game, PLAYER_ID, 7L)); // Writing
    }

    /**
     * Cannot research a tech the player already knows.
     */
    @Test
    public void testCanResearch_alreadyKnown() {
        Player player = new Player(PLAYER_ID, "Caesar", "127.0.0.1", 0);
        player.addKnownTech(0L);
        game.players.put(PLAYER_ID, player);
        assertFalse(TechTools.canPlayerResearch(game, PLAYER_ID, 0L)); // Alphabet already known
    }

    // ---------------------------------------------------------------
    // TechTools.pickNextResearchTowardGoal
    // ---------------------------------------------------------------

    /**
     * When no goal is set, pickNextResearchTowardGoal returns -1.
     */
    @Test
    public void testPickNextResearch_noGoal_returnsNone() {
        Player player = new Player(PLAYER_ID, "Caesar", "127.0.0.1", 0);
        game.players.put(PLAYER_ID, player);
        assertEquals(-1L, TechTools.pickNextResearchTowardGoal(game, player));
    }

    /**
     * If the goal is already known, pickNextResearchTowardGoal returns -1.
     */
    @Test
    public void testPickNextResearch_goalAlreadyKnown_returnsNone() {
        Player player = new Player(PLAYER_ID, "Caesar", "127.0.0.1", 0);
        player.addKnownTech(0L); // Alphabet already known
        player.setTechGoal(0L);
        game.players.put(PLAYER_ID, player);
        assertEquals(-1L, TechTools.pickNextResearchTowardGoal(game, player));
    }

    /**
     * If the goal is directly researchable, return the goal itself.
     */
    @Test
    public void testPickNextResearch_goalResearchable_returnsGoal() {
        Player player = new Player(PLAYER_ID, "Caesar", "127.0.0.1", 0);
        player.setTechGoal(0L); // Alphabet (no prereqs, immediately researchable)
        game.players.put(PLAYER_ID, player);
        assertEquals(0L, TechTools.pickNextResearchTowardGoal(game, player));
    }

    // ---------------------------------------------------------------
    // CityTurn.cityGranarySize
    // ---------------------------------------------------------------

    @Test
    public void testGranarySize_size1() {
        assertEquals(20, CityTurn.cityGranarySize(1));
    }

    @Test
    public void testGranarySize_size5() {
        assertEquals(100, CityTurn.cityGranarySize(5));
    }

    // ---------------------------------------------------------------
    // UnitType production cost
    // ---------------------------------------------------------------

    /**
     * A Warriors UnitType created with explicit cost returns that cost.
     */
    @Test
    public void testUnitTypeCost_explicit() {
        UnitType warriors = new UnitType("Warriors", "u.warriors", 1, 10, 1, "Warriors", 1, 1, "", 0, 10);
        assertEquals(10, warriors.getCost());
    }

    /**
     * A UnitType created without explicit cost defaults to 0 (use legacy formula).
     */
    @Test
    public void testUnitTypeCost_defaultZero() {
        UnitType warriors = new UnitType("Warriors", "u.warriors", 1, 10, 1, "Warriors", 1, 1, "", 0);
        assertEquals(0, warriors.getCost());
    }
}
