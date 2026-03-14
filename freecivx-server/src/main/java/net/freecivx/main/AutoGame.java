/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.FreecivWorld.net/
 Copyright (C) 2009-2025  The Freeciv-web project, Andreas Røsdal

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.

 You should have received a copy of the GNU Affero General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.

 ***********************************************************************/

package net.freecivx.main;

import net.freecivx.game.Game;
import net.freecivx.game.Improvement;
import net.freecivx.game.Player;
import net.freecivx.game.Tile;
import net.freecivx.game.Unit;
import net.freecivx.game.UnitType;
import net.freecivx.server.CivServer;
import org.json.JSONArray;

import java.net.InetSocketAddress;

/**
 * AutoGame simulates a complete Freecivx game with {@value #NUM_AI_PLAYERS}
 * AI-controlled civilisations for {@value #NUM_TURNS} turns without any
 * WebSocket clients connected.  All network broadcasts are suppressed so
 * the simulation runs headlessly and can be used for automated testing or
 * game-balance analysis.
 *
 * <p>The class overrides every {@code send*()} method of {@link CivServer}
 * as a no-op inner subclass so that the {@link Game} logic can be exercised
 * in isolation from the network layer.
 *
 * <p>Run {@link #main(String[])} to execute a full auto-game and print a
 * per-turn progress summary followed by a final civilisation report.
 */
public class AutoGame {

    /** Number of AI-controlled civilisations to create. */
    public static final int NUM_AI_PLAYERS = 5;

    /** Number of turns to simulate. */
    public static final int NUM_TURNS = 100;

    private final Game game;

    /**
     * Constructs an AutoGame backed by a headless (no-op network) server.
     * {@link Game#initGame()} is called during construction via the
     * {@link CivServer} superclass constructor.
     */
    public AutoGame() {
        CivServer headlessServer = createHeadlessServer();
        this.game = headlessServer.getGame();
    }

    // -------------------------------------------------------------------------
    // Headless server factory
    // -------------------------------------------------------------------------

    /**
     * Returns a {@link CivServer} subclass whose every {@code send*()} method
     * is a no-op.  Port 0 is passed to the parent so the OS assigns an
     * ephemeral port; {@code start()} is never called, so no real socket is
     * opened.
     */
    private static CivServer createHeadlessServer() {
        return new CivServer(new InetSocketAddress("localhost", 0)) {

            @Override public void sendMessageAll(String message) {}

            @Override public void sendMessage(long connId, String message) {}

            @Override public void sendBeginTurnAll() {}

            @Override public void sendStartPhaseAll() {}

            @Override public void sendGameInfoAll(long year, long turn, long phase) {}

            @Override public void sendCalendarInfoAll() {}

            @Override public void sendMapInfoAll(int xsize, int ysize) {}

            @Override public void sendTerrainInfoAll(long id, String name, String graphicStr) {}

            @Override public void sendRulesetCityInfoAll(long styleId, String name, String ruleName) {}

            @Override public void sendRuleseGovernmentAll(long id, String name, String ruleName, String helptext) {}

            @Override public void sendRulesetUnitAll(long id, UnitType utype) {}

            @Override public void sendRulesetUnitWebAdditionAll(long id, UnitType utype) {}

            @Override public void sendUnitAll(Unit unit) {}

            @Override public void sendUnitRemove(long unitId) {}

            @Override public void sendCityShortInfoAll(long id, long owner, long tile,
                    int size, int style, boolean capital, boolean occupied,
                    int walls, boolean happy, boolean unhappy,
                    String improvements, String name) {}

            @Override public void sendCityInfoAll(long id, long owner, long tile,
                    int size, int style, boolean capital, boolean occupied,
                    int walls, boolean happy, boolean unhappy,
                    String improvements, String name,
                    int productionKind, int productionValue) {}

            @Override public void sendExtrasInfoAll(long id, String extraName) {}

            @Override public void sendTileInfoAll(Tile tile) {}

            @Override public void sendConnInfoAll(long id, String username,
                    String address, long playerNum) {}

            @Override public void sendPlayerInfoAdditionAll(long playerNo, int expectedIncome) {}

            @Override public void sendPlayerInfoAll(Player player) {}

            @Override public void sendNationInfoAll(long id, String name, String adjective,
                    String graphicStr, String legend) {}

            @Override public void sendTechAll(long id, int rootReq, String name,
                    JSONArray researchReqs, String graphicStr, String helptext) {}

            @Override public void sendBordersServerSettingsAll() {}

            @Override public void sendRulesetControl(int numImprovements) {}

            @Override public void sendRulesetBuildingAll(Improvement improvement) {}

            @Override public void sendRulesetActionsAll() {}

            @Override public void sendGameStateTo(long connId) {}
        };
    }

    // -------------------------------------------------------------------------
    // Simulation
    // -------------------------------------------------------------------------

    /**
     * Initialises {@value #NUM_AI_PLAYERS} AI players and simulates
     * {@value #NUM_TURNS} turns, printing a progress line every 10 turns and
     * a final per-civilisation summary at the end.
     */
    public void run() {
        System.out.println("=== AutoGame: " + NUM_AI_PLAYERS + " AI players, "
                + NUM_TURNS + " turns ===");

        game.startAutoGame(NUM_AI_PLAYERS);

        System.out.println("Game initialised. "
                + "Players: " + game.players.size()
                + " | Units: " + game.units.size()
                + " | Map: " + game.map.getXsize() + "x" + game.map.getYsize());
        System.out.println();

        for (int t = 1; t <= NUM_TURNS; t++) {
            game.turnDone();
            if (t == 1 || t % 10 == 0) {
                logTurnSummary(t);
            }
        }

        System.out.println();
        logFinalSummary();
    }

    /** Prints a one-line summary of the current game state. */
    private void logTurnSummary(int turn) {
        long alivePlayers = game.players.values().stream()
                .filter(Player::isAlive).count();
        System.out.printf("Turn %3d | Alive: %d/%d | Units: %3d | Cities: %3d%n",
                turn, alivePlayers, game.players.size(),
                game.units.size(), game.cities.size());
    }

    /** Prints a per-civilisation report after the last turn. */
    private void logFinalSummary() {
        System.out.println("=== Final Summary after " + NUM_TURNS + " turns ===");
        game.players.values().stream()
                .sorted((a, b) -> Long.compare(
                        countCities(b), countCities(a)))   // rank by cities descending
                .forEach(p -> {
                    long unitCount = countUnits(p);
                    long cityCount = countCities(p);
                    System.out.printf("  %-14s | Cities: %2d | Units: %2d"
                            + " | Techs: %2d | Gold: %4d%n",
                            p.getUsername(), cityCount, unitCount,
                            p.getKnownTechs().size(), p.getGold());
                });
        System.out.println("=== End of AutoGame ===");
    }

    private long countUnits(Player p) {
        return game.units.values().stream()
                .filter(u -> u.getOwner() == p.getPlayerNo()).count();
    }

    private long countCities(Player p) {
        return game.cities.values().stream()
                .filter(c -> c.getOwner() == p.getPlayerNo()).count();
    }

    // -------------------------------------------------------------------------
    // Entry point
    // -------------------------------------------------------------------------

    /**
     * Entry point for running a standalone auto-game simulation.
     *
     * @param args command-line arguments (unused)
     */
    public static void main(String[] args) {
        new AutoGame().run();
    }
}
