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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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

    private static final Logger log = LoggerFactory.getLogger(AutoGame.class);

    /** Default number of AI civilisations. */
    public static final int DEFAULT_AI_PLAYERS = 5;

    /** Default number of turns to simulate. */
    public static final int DEFAULT_TURNS = 200;

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

            @Override public void sendGameInfoAll(long year, long turn, long phase, int timeout) {}

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

            @Override public void sendExtrasInfoAll(long id, String extraName, int causes, String graphicStr) {}

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
        log.info("=== AutoGame: {} AI players, {} turns ===", numAiPlayers, numTurns);

        game.startAutoGame(numAiPlayers);

        log.info("Game initialised. Players: {} | Units: {} | Map: {}x{}",
                game.players.size(), game.units.size(),
                game.map.getXsize(), game.map.getYsize());

        for (int t = 1; t <= numTurns; t++) {
            game.turnDone();
            if (t == 1 || t % 10 == 0) {
                logTurnSummary(t);
                logPerPlayerResearch(t);
            }
            // Stop early if all players but one are eliminated
            long alivePlayers = game.players.values().stream()
                    .filter(Player::isAlive).count();
            if (alivePlayers <= 1 && t > 1) {
                log.info("Game ended early: only {} civilisation(s) remaining after turn {}.",
                        alivePlayers, t);
                break;
            }
        }

        logFinalSummary();
    }

    /** Prints a one-line summary of the current game state. */
    private void logTurnSummary(int turn) {
        long alivePlayers = game.players.values().stream()
                .filter(Player::isAlive).count();
        long year = game.year;
        // Classic Freeciv: turn 1 = 4000 BCE, each turn advances 20 years.
        // historicalYear > 0 means BCE, < 0 means CE; 0 is treated as 1 CE
        // because the historical calendar has no year 0.
        long historicalYear = 4000L - (year - 1) * 20L;
        String yearStr = historicalYear > 0
                ? historicalYear + " BCE"
                : (1 - historicalYear) + " CE";
        // Count active settlers so expansion bottlenecks are visible in the log.
        long settlerCount = game.units.values().stream()
                .filter(u -> {
                    net.freecivx.game.UnitType ut = game.unitTypes.get((long) u.getType());
                    return ut != null && "Settlers".equalsIgnoreCase(ut.getName());
                }).count();
        // Total population across all cities (global metric, mirroring the
        // world-population display in the C server's score.c).
        long totalPop = game.cities.values().stream()
                .mapToLong(net.freecivx.game.City::getSize).sum();
        // Find the leading civilisation by score for the turn summary.
        Player leader = game.players.values().stream()
                .filter(Player::isAlive)
                .max((a, b) -> Long.compare(computeScore(a), computeScore(b)))
                .orElse(null);
        String leaderInfo = leader != null
                ? " | Leader: " + leader.getUsername()
                        + " (" + countCities(leader) + " cities, "
                        + leader.getKnownTechs().size() + " techs, "
                        + leader.getGold() + " gold)"
                : "";
        log.info("Turn {} ({}) | Alive: {}/{} | Pop: {} | Units: {} (settlers: {}) | Cities: {}{}",
                turn, yearStr, alivePlayers, game.players.size(),
                totalPop, game.units.size(), settlerCount, game.cities.size(), leaderInfo);
    }

    /**
     * Prints a one-line research-progress summary for every living player.
     * Shown every 10 turns so research bottlenecks are easy to spot.
     */
    private void logPerPlayerResearch(int turn) {
        for (Player p : game.players.values().stream()
                .filter(Player::isAlive)
                .sorted((a, b) -> a.getUsername().compareTo(b.getUsername()))
                .collect(java.util.stream.Collectors.toList())) {
            long techId = p.getResearchingTech();
            String researchStr;
            if (techId < 0) {
                researchStr = "(idle)";
            } else {
                net.freecivx.game.Technology tech = game.techs.get(techId);
                researchStr = (tech != null ? tech.getName() : "Tech#" + techId)
                        + " " + p.getBulbsResearched() + " bulbs";
            }
            int govId = p.getGovernmentId();
            String govName = game.governments.containsKey((long) govId)
                    ? game.governments.get((long) govId).getName()
                    : "Gov" + govId;
            // Log tile output for the player's first city to show terrain-aware production.
            String tileOutputStr = game.cities.entrySet().stream()
                    .filter(e -> e.getValue().getOwner() == p.getPlayerNo())
                    .findFirst()
                    .map(e -> {
                        net.freecivx.game.Tile t = game.tiles.get(e.getValue().getTile());
                        int[] out = net.freecivx.server.CityTurn.getTileOutput(game, t, true);
                        net.freecivx.game.Terrain terrain = t != null
                                ? game.terrains.get((long) t.getTerrain()) : null;
                        String terrainName = terrain != null ? terrain.getName() : "?";
                        return e.getValue().getName() + " [" + terrainName
                                + "] food=" + out[0] + " shields=" + out[1] + " trade=" + out[2];
                    })
                    .orElse("(no cities)");
            log.info("  {}: Cities: {} | Gold: {} | Gov: {} | Techs: {} | Research: {} | Capital: {}",
                    p.getUsername(), countCities(p), p.getGold(), govName,
                    p.getKnownTechs().size(), researchStr, tileOutputStr);
        }
    }

    /** Prints a per-civilisation report after the last turn. */
    private void logFinalSummary() {
        log.info("=== Final Summary after {} turns ===", game.turn);
        game.players.values().stream()
                .sorted((a, b) -> Long.compare(computeScore(b), computeScore(a)))
                .forEach(p -> {
                    long unitCount = countUnits(p);
                    long cityCount = countCities(p);
                    long totalPop = game.cities.values().stream()
                            .filter(c -> c.getOwner() == p.getPlayerNo())
                            .mapToLong(net.freecivx.game.City::getSize).sum();
                    long score = computeScore(p);
                    String status = p.isAlive() ? "alive" : "eliminated";
                    int govId = p.getGovernmentId();
                    String govName = game.governments.containsKey((long) govId)
                            ? game.governments.get((long) govId).getName()
                            : "Gov" + govId;
                    // City sizes for a compact overview
                    String citySizes = game.cities.values().stream()
                            .filter(c -> c.getOwner() == p.getPlayerNo())
                            .map(c -> String.valueOf(c.getSize()))
                            .collect(java.util.stream.Collectors.joining(","));
                    String cityDisplay = citySizes.isEmpty() ? "-" : citySizes;
                    log.info("  {} | Cities: {} [{}] | Pop: {} | Units: {} | Techs: {} | Gold: {} | Gov: {} | Score: {} | {}",
                            p.getUsername(), cityCount, cityDisplay, totalPop,
                            unitCount, p.getKnownTechs().size(), p.getGold(),
                            govName, score, status);
                });
        log.info("=== End of AutoGame ===");
    }

    /**
     * Computes a civilisation score to rank players in the final summary.
     * Mirrors the formula used by the C Freeciv server's {@code score.c}
     * ({@code get_civ_score()}):
     * <ul>
     *   <li>Population: sum of city sizes × 1 (the primary growth metric)</li>
     *   <li>Cities: number of cities × 5</li>
     *   <li>Techs: number of known technologies × 2</li>
     *   <li>Gold: treasury balance ÷ 10 (capped at 0 from below)</li>
     *   <li>Alive bonus: +50 for civilisations still in the game</li>
     * </ul>
     * Population is now the largest contributor once cities grow past size 5,
     * matching the C server where {@code city_population()} (exponential)
     * dominates the score in the mid-game.
     *
     * @param p the player to score
     * @return a non-negative integer score
     */
    private long computeScore(Player p) {
        long popScore  = game.cities.values().stream()
                .filter(c -> c.getOwner() == p.getPlayerNo())
                .mapToLong(net.freecivx.game.City::getSize).sum();
        long cityScore = countCities(p) * 5L;
        long techScore = p.getKnownTechs().size() * 2L;
        long goldScore = Math.max(0, p.getGold()) / 10L;
        long aliveBonus = p.isAlive() ? 50L : 0L;
        return popScore + cityScore + techScore + goldScore + aliveBonus;
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
