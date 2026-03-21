/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.freecivx.com/
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

package net.freecivx.server;

import net.freecivx.game.City;
import net.freecivx.game.Game;
import net.freecivx.game.Improvement;
import net.freecivx.game.Player;
import net.freecivx.game.Spaceship;
import net.freecivx.game.UnitType;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Handles PACKET_REPORT_REQ (111) from the client.
 *
 * <p>Generates government report text and sends it back as
 * PACKET_PAGE_MSG (110) + PACKET_PAGE_MSG_PART (250).
 * Mirrors {@code handle_report_req()} and the {@code report_*()} functions
 * in the C Freeciv server's {@code server/report.c}.
 */
public class ReportHand {

    /** Report type constants – mirrors {@code enum report_type} in common/packets.def. */
    public static final int REPORT_WONDERS_OF_THE_WORLD      = 0;
    public static final int REPORT_WONDERS_OF_THE_WORLD_LONG = 1;
    public static final int REPORT_TOP_CITIES                 = 2;
    public static final int REPORT_DEMOGRAPHIC                = 3;
    public static final int REPORT_ACHIEVEMENTS               = 4;

    /** Great-wonder genus value (mirrors {@code GENUS_GREAT_WONDER} in common/improvement.h). */
    private static final int GENUS_GREAT_WONDER = 0;

    /** Score bonus per great wonder when ranking cities (mirrors {@code WONDER_FACTOR} in report.c). */
    private static final int WONDER_FACTOR = 5;

    private ReportHand() {}

    /**
     * Dispatches an incoming report request to the appropriate report generator.
     * Mirrors {@code handle_report_req()} in the C Freeciv server.
     *
     * @param game       the current game state
     * @param server     the server interface used to send packets
     * @param connId     connection ID of the requesting client
     * @param reportType one of the {@code REPORT_*} constants above
     */
    public static void handleReportReq(Game game, IGameServer server,
                                       long connId, int reportType) {
        switch (reportType) {
            case REPORT_WONDERS_OF_THE_WORLD:
            case REPORT_WONDERS_OF_THE_WORLD_LONG:
                reportWondersOfTheWorld(game, server, connId);
                break;
            case REPORT_TOP_CITIES:
                reportTopCities(game, server, connId);
                break;
            case REPORT_DEMOGRAPHIC:
                reportDemographics(game, server, connId);
                break;
            default:
                break;
        }
    }

    // -------------------------------------------------------------------------
    // Demographics report
    // -------------------------------------------------------------------------

    /**
     * Generates and sends the Demographics report.
     * Shows key statistics for every living player, sorted by score.
     * Mirrors {@code report_demographics()} in the C Freeciv server's
     * {@code server/report.c}.
     */
    private static void reportDemographics(Game game, IGameServer server, long connId) {
        Player requester = game.players.get(connId);
        if (requester == null) return;

        int totalTechs = game.techs.size();

        // Pre-compute scores once to avoid calling Score.computeScore twice per player.
        Map<Long, Long> scores = new java.util.HashMap<>();
        for (Player p : game.players.values()) {
            if (p.isAlive()) {
                scores.put(p.getPlayerNo(), Score.computeScore(game, p));
            }
        }

        List<Player> sortedPlayers = game.players.values().stream()
                .filter(Player::isAlive)
                .sorted(Comparator.comparingLong((Player p) ->
                        scores.getOrDefault(p.getPlayerNo(), 0L)).reversed())
                .collect(Collectors.toList());

        StringBuilder sb = new StringBuilder();
        sb.append(String.format("%-22s %10s %7s %9s %9s %9s %8s %8s%n",
                "Civilization", "Population", "Cities",
                "Literacy", "Research", "Military", "Gold", "Score"));
        sb.append(String.format("%-22s %10s %7s %9s %9s %9s %8s %8s%n",
                "-".repeat(22), "-".repeat(10), "-".repeat(7),
                "-".repeat(9), "-".repeat(9), "-".repeat(9),
                "-".repeat(8), "-".repeat(8)));

        for (Player p : sortedPlayers) {
            long population = game.cities.values().stream()
                    .filter(c -> c.getOwner() == p.getPlayerNo())
                    .mapToLong(c -> (long) c.getSize() * 10_000L)
                    .sum();
            long cityCount = game.cities.values().stream()
                    .filter(c -> c.getOwner() == p.getPlayerNo())
                    .count();
            int knownTechs = p.getKnownTechs().size();
            int literacy = totalTechs > 0 ? knownTechs * 100 / totalTechs : 0;
            long militaryUnits = game.units.values().stream()
                    .filter(u -> u.getOwner() == p.getPlayerNo())
                    .filter(u -> {
                        UnitType ut = game.unitTypes.get((long) u.getType());
                        return ut != null && ut.getAttackStrength() > 0;
                    })
                    .count();
            long score = scores.getOrDefault(p.getPlayerNo(), 0L);

            String name = truncate(p.getUsername(), 22);
            sb.append(String.format("%-22s %10s %7d %8d%% %8d%% %9d %8d %8d%n",
                    name,
                    formatPopulation(population),
                    cityCount,
                    literacy,
                    p.getScienceRate(),
                    militaryUnits,
                    p.getGold(),
                    score));
        }

        server.sendPageMsg(connId,
                "Demographics Report",
                "Current Year " + formatYear(game.year),
                sb.toString());
    }

    // -------------------------------------------------------------------------
    // Top Cities report
    // -------------------------------------------------------------------------

    /**
     * Generates and sends the Top Cities report.
     * Lists the 5 highest-scoring cities: score = size + wonders × WONDER_FACTOR.
     * Mirrors {@code report_top_cities()} in the C Freeciv server's
     * {@code server/report.c}.
     */
    private static void reportTopCities(Game game, IGameServer server, long connId) {
        Player requester = game.players.get(connId);
        if (requester == null) return;

        List<CityEntry> scored = new ArrayList<>();
        for (City city : game.cities.values()) {
            int wonderCount = countGreatWondersInCity(game, city);
            int cityScore   = city.getSize() + wonderCount * WONDER_FACTOR;
            Player owner    = game.players.get(city.getOwner());
            String ownerName = owner != null ? owner.getUsername() : "Unknown";
            scored.add(new CityEntry(city.getName(), ownerName,
                    city.getSize(), wonderCount, cityScore));
        }

        scored.sort(Comparator.comparingInt(CityEntry::score).reversed());
        int limit = Math.min(5, scored.size());

        StringBuilder sb = new StringBuilder();
        if (scored.isEmpty()) {
            sb.append("No cities exist yet.\n");
        } else {
            sb.append(String.format("%-4s %-24s %-22s %6s %8s%n",
                    "Rank", "City", "Civilization", "Size", "Wonders"));
            sb.append(String.format("%-4s %-24s %-22s %6s %8s%n",
                    "-".repeat(4), "-".repeat(24), "-".repeat(22),
                    "-".repeat(6), "-".repeat(8)));
            for (int i = 0; i < limit; i++) {
                CityEntry ce = scored.get(i);
                sb.append(String.format("%-4d %-24s %-22s %6d %8d%n",
                        i + 1,
                        truncate(ce.cityName(), 24),
                        truncate(ce.civName(), 22),
                        ce.size(),
                        ce.wonderCount()));
            }
        }

        server.sendPageMsg(connId,
                "Top 5 Cities",
                "The Five Greatest Cities in the World",
                sb.toString());
    }

    // -------------------------------------------------------------------------
    // Wonders of the World report
    // -------------------------------------------------------------------------

    /**
     * Generates and sends the Wonders of the World report.
     * For every great wonder, shows whether it has been built and by whom.
     * Mirrors {@code report_wonders_of_the_world_long()} in the C Freeciv
     * server's {@code server/report.c}.
     */
    private static void reportWondersOfTheWorld(Game game, IGameServer server, long connId) {
        Player requester = game.players.get(connId);
        if (requester == null) return;

        List<Improvement> greatWonders = game.improvements.values().stream()
                .filter(impr -> impr.getGenus() == GENUS_GREAT_WONDER)
                .sorted(Comparator.comparing(Improvement::getName))
                .collect(Collectors.toList());

        StringBuilder sb = new StringBuilder();
        if (greatWonders.isEmpty()) {
            sb.append("No wonders are defined in the current ruleset.\n");
        } else {
            // Build a reverse index: wonder improvement ID → city that has it.
            // This avoids an O(wonders × cities) nested loop.
            Map<Integer, City> wonderToCity = new java.util.HashMap<>();
            for (City city : game.cities.values()) {
                for (int imprId : city.getImprovements()) {
                    Improvement impr = game.improvements.get((long) imprId);
                    if (impr != null && impr.getGenus() == GENUS_GREAT_WONDER) {
                        wonderToCity.put(imprId, city);
                    }
                }
            }

            for (Improvement wonder : greatWonders) {
                City city = wonderToCity.get((int) wonder.getId());
                if (city != null) {
                    Player owner = game.players.get(city.getOwner());
                    String civName = owner != null ? owner.getUsername() : "Unknown";
                    sb.append(wonder.getName())
                      .append(": ").append(city.getName())
                      .append(" (").append(civName).append(")\n");
                } else {
                    sb.append(wonder.getName()).append(": Not built yet\n");
                }
            }
        }

        server.sendPageMsg(connId,
                "Wonders of the World",
                "Great Wonders of the World",
                sb.toString());
    }

    // -------------------------------------------------------------------------
    // Space Race report
    // -------------------------------------------------------------------------

    /**
     * Generates and sends the Space Race report.
     * Shows the spaceship construction and launch status of every living player.
     * Called from the spaceship tab in the government dialog when the player
     * opens it (in addition to the live spaceship-info packets).
     */
    public static void reportSpaceRace(Game game, IGameServer server, long connId) {
        Player requester = game.players.get(connId);
        if (requester == null) return;

        List<Player> players = game.players.values().stream()
                .filter(Player::isAlive)
                .collect(Collectors.toList());

        StringBuilder sb = new StringBuilder();

        boolean anyStarted = players.stream()
                .anyMatch(p -> p.getSpaceship().getState() != Spaceship.State.NONE);

        if (!anyStarted) {
            sb.append("No civilization has begun building a spaceship yet.\n\n");
            sb.append("Build the Apollo Program wonder first, then construct\n");
            sb.append("Space Structurals, Components, and Modules in your cities.");
        } else {
            sb.append(String.format("%-22s %-12s %8s %9s %9s%n",
                    "Civilization", "Status", "Parts", "Success%", "ETA"));
            sb.append(String.format("%-22s %-12s %8s %9s %9s%n",
                    "-".repeat(22), "-".repeat(12), "-".repeat(8),
                    "-".repeat(9), "-".repeat(9)));
            for (Player p : players) {
                Spaceship ship = p.getSpaceship();
                int parts = ship.getStructurals() + ship.getComponents() + ship.getModules();
                String successPct = (ship.getState() == Spaceship.State.NONE)
                        ? "-"
                        : Math.round(ship.getSuccessRate() * 100) + "%";
                String eta;
                if (ship.getState() == Spaceship.State.ARRIVED) {
                    eta = "Arrived!";
                } else if (ship.getState() == Spaceship.State.LAUNCHED) {
                    eta = String.format("%.0f yrs", ship.getTravelTime());
                } else {
                    eta = "-";
                }
                sb.append(String.format("%-22s %-12s %8d %9s %9s%n",
                        truncate(p.getUsername(), 22),
                        spaceshipStateText(ship.getState()),
                        parts,
                        successPct,
                        eta));
            }
        }

        server.sendPageMsg(connId,
                "Space Race",
                "The Space Race to Alpha Centauri",
                sb.toString());
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /** Counts the number of great wonders built in the given city. */
    private static int countGreatWondersInCity(Game game, City city) {
        int count = 0;
        for (int imprId : city.getImprovements()) {
            Improvement impr = game.improvements.get((long) imprId);
            if (impr != null && impr.getGenus() == GENUS_GREAT_WONDER) {
                count++;
            }
        }
        return count;
    }

    /** Formats a population number as e.g. "1.2M" or "500K". */
    private static String formatPopulation(long pop) {
        if (pop >= 1_000_000L) {
            return String.format("%.1fM", pop / 1_000_000.0);
        } else if (pop >= 1_000L) {
            return String.format("%.0fK", pop / 1_000.0);
        }
        return String.valueOf(pop);
    }

    /** Formats a game-year value as "1066 AD" or "4000 BC". */
    private static String formatYear(long year) {
        if (year < 0) return Math.abs(year) + " BC";
        return year + " AD";
    }

    /** Returns a human-readable spaceship state label. */
    private static String spaceshipStateText(Spaceship.State state) {
        return switch (state) {
            case NONE     -> "Not started";
            case STARTED  -> "Building";
            case LAUNCHED -> "Launched";
            case ARRIVED  -> "Arrived";
        };
    }

    /** Truncates a string to {@code max} characters. */
    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }

    // -------------------------------------------------------------------------
    // Internal data holder
    // -------------------------------------------------------------------------

    /** Holds pre-computed scoring data for a single city. */
    private record CityEntry(String cityName, String civName,
                              int size, int wonderCount, int score) {}
}
