/* Copyright (C) The Authors 2025 */
package net.freecivx.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import net.freecivx.game.City;
import net.freecivx.game.Game;
import net.freecivx.game.Improvement;
import net.freecivx.game.Player;
import net.freecivx.game.Technology;
import net.freecivx.game.Tile;
import net.freecivx.game.UnitType;
import net.freecivx.game.WorldMap;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for {@link AiPlayer} AI decision logic.
 *
 * <p>Verifies that the AI:
 * <ul>
 *   <li>picks a technology research goal when none is set,</li>
 *   <li>does not override an already-active research target,</li>
 *   <li>assigns Warriors production to an undefended city,</li>
 *   <li>does not change a city's production once it is already set,</li>
 *   <li>prefers Pottery (Granary) over other techs when researching.</li>
 * </ul>
 *
 * <p>Tests run without a real {@link net.freecivx.server.CivServer} because
 * the AI's research- and production-management phases only mutate in-memory
 * state and never invoke server broadcast methods.  Unit movement is not
 * exercised here because it requires an active server connection.
 */
public class AiPlayerTest {

    /**
     * Minimal stub that skips all server-level initialisation so the test can
     * construct a lightweight {@link Game} with just the data it needs.
     */
    private static class StubGame extends Game {
        StubGame() {
            super(null); // server = null; AI phases do not call server methods
        }
    }

    private StubGame game;
    private AiPlayer ai;

    private static final int XSIZE = 10;
    private static final int YSIZE = 10;

    // IDs used in tests – must match AiPlayer's private constants and
    // the game-state set up in setUp(). These values reflect the hardcoded
    // ruleset initialisation in Game.initGame() and are replicated here so
    // that the tests remain self-contained and easy to read.
    private static final long TECH_POTTERY        = 10L;
    private static final long TECH_BRONZE_WORKING = 4L;
    private static final int  UNIT_WARRIORS       = 3;
    private static final int  IMPR_GRANARY        = 2;
    private static final int  TERRAIN_GRASSLAND   = 7; // terrain ID for Grassland

    @BeforeEach
    void setUp() {
        game = new StubGame();
        game.map = new WorldMap(XSIZE, YSIZE);

        // Fill map with grassland (terrain ID = TERRAIN_GRASSLAND)
        for (int i = 0; i < XSIZE * YSIZE; i++) {
            game.tiles.put((long) i, new Tile(i, 1, TERRAIN_GRASSLAND, 0, 0, 0, -1));
        }

        // Technologies that the AI can research
        game.techs.put(TECH_POTTERY,
                new Technology("Pottery", "a.pottery", "Pottery", "None", "None", 20));
        game.techs.put(TECH_BRONZE_WORKING,
                new Technology("Bronze Working", "a.bronze_working", "Bronze Working", "None", "None", 20));
        game.techs.put(7L,
                new Technology("Writing", "a.writing", "Writing", "Alphabet", "None", 40));

        // City improvements the AI may choose to build
        // Granary (id=2) requires Pottery (tech 10)
        game.improvements.put((long) IMPR_GRANARY,
                new Improvement(IMPR_GRANARY, "Granary", "Granary", "b.granary", "b.fallback",
                        2, 60, 1, 0, "b_granary", "b_fallback", "The Granary", TECH_POTTERY));
        // Library (id=3) requires Writing (tech 7)
        game.improvements.put(3L,
                new Improvement(3, "Library", "Library", "b.library", "b.fallback",
                        2, 80, 1, 0, "b_library", "b_fallback", "The Library", 7L));

        // Unit types needed by the production AI
        game.unitTypes.put((long) UNIT_WARRIORS,
                new UnitType("Warriors", "u.warriors", 1, 10, 1, "Warriors", 1, 1, "", 0));
        game.unitTypes.put(0L,
                new UnitType("Settlers", "u.settlers", 1, 1, 1, "Settlers", 0, 1, "", 0));

        ai = new AiPlayer(game);
    }

    // ---------------------------------------------------------------
    // Technology research goal selection
    // ---------------------------------------------------------------

    /**
     * When an AI player has no research target the AI should pick one after
     * the first turn.  Mirrors the dai_select_tech() behaviour in aitech.c.
     */
    @Test
    void testPickResearchGoal_setsResearchTarget() {
        Player aiPlayer = new Player(100L, "Caesar", "ai", 0);
        aiPlayer.setAi(true);
        game.players.put(100L, aiPlayer);

        assertEquals(-1L, aiPlayer.getResearchingTech(), "Should start with no research target");
        ai.runAiTurns();
        assertNotEquals(-1L, aiPlayer.getResearchingTech(), "AI should choose a research goal");
    }

    /**
     * An AI player that is already researching a technology must not have its
     * research target overridden.
     */
    @Test
    void testPickResearchGoal_respectsExistingResearch() {
        Player aiPlayer = new Player(100L, "Caesar", "ai", 0);
        aiPlayer.setAi(true);
        aiPlayer.setResearchingTech(TECH_BRONZE_WORKING);
        game.players.put(100L, aiPlayer);

        ai.runAiTurns();
        assertEquals(TECH_BRONZE_WORKING, aiPlayer.getResearchingTech(),
                "Existing research target must not be changed");
    }

    /**
     * Pottery (Granary) is the top-priority research in the AI's priority
     * list.  When both Pottery and Bronze Working are available, Pottery must
     * be chosen.  Mirrors the dai_select_tech() priority list in aitech.c.
     */
    @Test
    void testPickResearchGoal_prefersPotteryFirst() {
        Player aiPlayer = new Player(100L, "Caesar", "ai", 0);
        aiPlayer.setAi(true);
        game.players.put(100L, aiPlayer);

        ai.runAiTurns();
        assertEquals(TECH_POTTERY, aiPlayer.getResearchingTech(),
                "AI should prioritise Pottery for the Granary");
    }

    /**
     * Non-AI (human) players must not have a research goal assigned by the AI.
     */
    @Test
    void testPickResearchGoal_skipsHumanPlayers() {
        Player human = new Player(200L, "HumanPlayer", "127.0.0.1", 0);
        human.setAi(false);
        game.players.put(200L, human);

        ai.runAiTurns();
        assertEquals(-1L, human.getResearchingTech(),
                "AI must not modify a human player's research target");
    }

    // ---------------------------------------------------------------
    // City production management
    // ---------------------------------------------------------------

    /**
     * A city whose production slot is empty and has no defending unit should
     * be assigned Warriors production.  Mirrors the priority-1 branch
     * (undefended city) in daicity.c.
     */
    @Test
    void testManageCity_undefendedCityGetsWarriors() {
        Player aiPlayer = new Player(100L, "Caesar", "ai", 0);
        aiPlayer.setAi(true);
        game.players.put(100L, aiPlayer);

        // Empty production slot (kind=0, value=0), no units defending
        City city = new City("Rome", 100L, 0L, 2, 1, false, false, 0,
                true, false, "", 0, 0);
        game.cities.put(1L, city);

        ai.runAiTurns();
        assertEquals(0, city.getProductionKind(), "Should produce a unit (kind=0)");
        assertEquals(UNIT_WARRIORS, city.getProductionValue(),
                "Should produce Warriors when undefended");
    }

    /**
     * A city that is already producing something must not have its production
     * overwritten.
     */
    @Test
    void testManageCity_doesNotChangeActiveProduction() {
        Player aiPlayer = new Player(100L, "Caesar", "ai", 0);
        aiPlayer.setAi(true);
        game.players.put(100L, aiPlayer);

        // Already producing Granary (kind=1, value=2)
        City city = new City("Athens", 100L, 1L, 3, 1, false, false, 0,
                true, false, "", 1, IMPR_GRANARY);
        game.cities.put(1L, city);

        ai.runAiTurns();
        assertEquals(1, city.getProductionKind(),
                "Should not change improvement production in progress");
        assertEquals(IMPR_GRANARY, city.getProductionValue(),
                "Production value must remain Granary");
    }

    /**
     * Human-owned cities must never have their production changed by the AI.
     */
    @Test
    void testManageCity_skipsHumanCities() {
        Player human = new Player(200L, "HumanPlayer", "127.0.0.1", 0);
        human.setAi(false);
        game.players.put(200L, human);

        City city = new City("London", 200L, 2L, 2, 1, false, false, 0,
                true, false, "", 0, 0);
        game.cities.put(1L, city);

        ai.runAiTurns();
        assertEquals(0, city.getProductionKind(),
                "AI must not change human city production kind");
        assertEquals(0, city.getProductionValue(),
                "AI must not change human city production value");
    }
}
