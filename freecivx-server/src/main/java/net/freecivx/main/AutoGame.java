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
 * AutoGame simulates a complete Freecivx game with AI-controlled civilisations
 * without any WebSocket clients connected.  All network broadcasts are suppressed
 * so the simulation runs headlessly and can be used for automated testing or
 * game-balance analysis.
 *
 * <p>The class overrides every {@code send*()} method of {@link CivServer}
 * as a no-op inner subclass so that the {@link Game} logic can be exercised
 * in isolation from the network layer.
 *
 * <p>Run {@link #main(String[])} to execute a full auto-game and print a
 * per-turn progress summary followed by a final civilisation report.
 *
 * <p>Command-line arguments (all optional):
 * <ul>
 *   <li>{@code -players N}  – number of AI civilisations (default: {@value #DEFAULT_AI_PLAYERS})</li>
 *   <li>{@code -turns N}    – number of turns to simulate (default: {@value #DEFAULT_TURNS})</li>
 *   <li>{@code -seed N}     – map &amp; game seed for reproducibility (default: random)
 *                             Mirrors {@code gameseed} / {@code mapseed} in the C Freeciv
 *                             server's {@code scripts/test-autogame.serv}.</li>
 * </ul>
 */
public class AutoGame {

    /** Default number of AI civilisations. */
    public static final int DEFAULT_AI_PLAYERS = 5;

    /** Default number of turns to simulate. */
    public static final int DEFAULT_TURNS = 100;

    /**
     * Number of AI-controlled civilisations to create.
     * @deprecated Use the command-line {@code -players} argument instead.
     */
    @Deprecated
    public static final int NUM_AI_PLAYERS = DEFAULT_AI_PLAYERS;

    /**
     * Number of turns to simulate.
     * @deprecated Use the command-line {@code -turns} argument instead.
     */
    @Deprecated
    public static final int NUM_TURNS = DEFAULT_TURNS;

    private final Game game;
    private final int numAiPlayers;
    private final int numTurns;

    /**
     * Constructs an AutoGame backed by a headless (no-op network) server with
     * default settings ({@value #DEFAULT_AI_PLAYERS} players,
     * {@value #DEFAULT_TURNS} turns, random seed).
     */
    public AutoGame() {
        this(DEFAULT_AI_PLAYERS, DEFAULT_TURNS, -1);
    }

    /**
     * Constructs an AutoGame backed by a headless (no-op network) server.
     *
     * @param numAiPlayers number of AI civilisations to create (≥ 1)
     * @param numTurns     number of turns to simulate (≥ 1)
     * @param seed         map/game seed; {@code -1} for a unique random game
     *                     (mirrors {@code mapseed} / {@code gameseed} in the
     *                     C Freeciv server test script)
     */
    public AutoGame(int numAiPlayers, int numTurns, int seed) {
        this.numAiPlayers = numAiPlayers;
        this.numTurns = numTurns;
        CivServer headlessServer = createHeadlessServer();
        this.game = headlessServer.getGame();
        if (seed >= 0) {
            // Regenerate the map with the specified seed for reproducibility.
            // The map is initially generated with a random seed during CivServer
            // construction; reinitializeMap() replaces it with a deterministic one.
            // Mirrors "mapseed" / "gameseed" in the C Freeciv server test script.
            this.game.reinitializeMap(seed);
        }
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
     * Initialises AI players and simulates turns, printing a progress line
     * every 10 turns and a final per-civilisation summary at the end.
     */
    public void run() {
        System.out.println("=== AutoGame: " + numAiPlayers + " AI players, "
                + numTurns + " turns ===");

        game.startAutoGame(numAiPlayers);

        System.out.println("Game initialised. "
                + "Players: " + game.players.size()
                + " | Units: " + game.units.size()
                + " | Map: " + game.map.getXsize() + "x" + game.map.getYsize());
        System.out.println();

        for (int t = 1; t <= numTurns; t++) {
            game.turnDone();
            if (t == 1 || t % 10 == 0) {
                logTurnSummary(t);
            }
            // Stop early if all players but one are eliminated
            long alivePlayers = game.players.values().stream()
                    .filter(Player::isAlive).count();
            if (alivePlayers <= 1 && t > 1) {
                System.out.printf("%nGame ended early: only %d civilisation(s) remaining after turn %d.%n",
                        alivePlayers, t);
                break;
            }
        }

        System.out.println();
        logFinalSummary();
    }

    /** Prints a one-line summary of the current game state. */
    private void logTurnSummary(int turn) {
        long alivePlayers = game.players.values().stream()
                .filter(Player::isAlive).count();
        long year = game.year;
        // Classic Freeciv: turn 1 = 4000 BCE, each turn advances 20 years.
        // historicalYear < 0 means BCE, > 0 means CE.
        long historicalYear = 4000L - (year - 1) * 20L;
        String yearStr = historicalYear > 0
                ? historicalYear + " BCE"
                : Math.abs(historicalYear) + " CE";
        // Find the leading civilisation by score for the turn summary.
        Player leader = game.players.values().stream()
                .filter(Player::isAlive)
                .max((a, b) -> Long.compare(computeScore(a), computeScore(b)))
                .orElse(null);
        String leaderInfo = leader != null
                ? " | Leader: " + leader.getUsername()
                        + " (" + countCities(leader) + " cities)"
                : "";
        System.out.printf("Turn %3d (%s) | Alive: %d/%d | Units: %3d | Cities: %3d%s%n",
                turn, yearStr, alivePlayers, game.players.size(),
                game.units.size(), game.cities.size(), leaderInfo);
    }

    /** Prints a per-civilisation report after the last turn. */
    private void logFinalSummary() {
        System.out.println("=== Final Summary after " + game.turn + " turns ===");
        game.players.values().stream()
                .sorted((a, b) -> Long.compare(computeScore(b), computeScore(a)))
                .forEach(p -> {
                    long unitCount = countUnits(p);
                    long cityCount = countCities(p);
                    long score = computeScore(p);
                    String status = p.isAlive() ? "alive" : "eliminated";
                    int govId = p.getGovernmentId();
                    String govName = game.governments.containsKey((long) govId)
                            ? game.governments.get((long) govId).getName()
                            : "Gov" + govId;
                    System.out.printf("  %-14s | Cities: %2d | Units: %2d"
                                    + " | Techs: %2d | Gold: %4d | Gov: %-12s | Score: %4d | %s%n",
                            p.getUsername(), cityCount, unitCount,
                            p.getKnownTechs().size(), p.getGold(),
                            govName, score, status);
                });
        System.out.println("=== End of AutoGame ===");
    }

    /**
     * Computes a civilisation score to rank players in the final summary.
     * Mirrors the simplified score used by the C Freeciv server's
     * {@code score.c}: cities × 5 + techs × 2 + (gold / 10).
     * A living civilisation receives an additional 50-point bonus.
     *
     * @param p the player to score
     * @return a non-negative integer score
     */
    private long computeScore(Player p) {
        long cityScore = countCities(p) * 5L;
        long techScore = p.getKnownTechs().size() * 2L;
        long goldScore = Math.max(0, p.getGold()) / 10L;
        long aliveBonus = p.isAlive() ? 50L : 0L;
        return cityScore + techScore + goldScore + aliveBonus;
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
     * <p>Accepted arguments (all optional):
     * <ul>
     *   <li>{@code -players N}  – number of AI civilisations</li>
     *   <li>{@code -turns N}    – number of turns</li>
     *   <li>{@code -seed N}     – reproducibility seed (mirrors {@code mapseed}
     *                             and {@code gameseed} in the C Freeciv server)</li>
     * </ul>
     *
     * @param args command-line arguments
     */
    public static void main(String[] args) {
        int players = DEFAULT_AI_PLAYERS;
        int turns   = DEFAULT_TURNS;
        int seed    = -1;

        for (int i = 0; i < args.length - 1; i++) {
            switch (args[i]) {
                case "-players": players = Integer.parseInt(args[i + 1]); i++; break;
                case "-turns":   turns   = Integer.parseInt(args[i + 1]); i++; break;
                case "-seed":    seed    = Integer.parseInt(args[i + 1]); i++; break;
                default: break;
            }
        }

        new AutoGame(players, turns, seed).run();
    }
}
