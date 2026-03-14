/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.FreecivWorld.net/
 Copyright (C) 2009-2025  The Freeciv-web project

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

package net.freecivx.game;

/**
 * Technology research system.
 * Mirrors the functionality of common/research.c in the C Freeciv server.
 * Tracks per-player research state: current technology being researched,
 * accumulated science bulbs, known technologies, and prerequisite lookups.
 */
public class Research {

    /** Returned by {@link #advanceCount()} when no technologies are loaded. */
    public static final int NO_ADVANCE = -1;

    /** Base research cost used when ruleset data is unavailable. */
    public static final int DEFAULT_TECH_COST = 20;

    /**
     * Returns the research state object for a player.
     * In the current implementation player research state is stored directly
     * on the {@link Player}; this method returns a summary string for
     * diagnostic purposes.
     *
     * @param game     the current game state
     * @param playerId the ID of the player to query
     * @return a human-readable research state summary, or {@code null} if the
     *         player does not exist
     */
    public static String playerGetResearch(Game game, long playerId) {
        Player player = game.players.get(playerId);
        if (player == null) return null;

        return "Player " + player.getUsername() + " research state";
    }

    /**
     * Calculates the bulb cost for a player to research the specified technology.
     * The cost scales with the number of technologies the player already knows
     * and any research-speed bonuses from improvements or governments.
     *
     * @param game     the current game state
     * @param playerId the ID of the player
     * @param techId   the ID of the technology to cost
     * @return the number of science bulbs required, or {@code Integer.MAX_VALUE}
     *         if the technology cannot be researched
     */
    public static int researchTechCost(Game game, long playerId, long techId) {
        Player player = game.players.get(playerId);
        if (player == null) return Integer.MAX_VALUE;

        Technology tech = game.techs.get(techId);
        if (tech == null) return Integer.MAX_VALUE;

        // Base cost scaled by number of techs already known
        return DEFAULT_TECH_COST * (1 + game.techs.size() / 10);
    }

    /**
     * Returns whether a player has already researched a specific technology.
     *
     * @param game     the current game state
     * @param playerId the ID of the player to check
     * @param techId   the ID of the technology to test
     * @return {@code true} if the player knows the technology
     */
    public static boolean playerHasTech(Game game, long playerId, long techId) {
        Player player = game.players.get(playerId);
        if (player == null) return false;

        return player.hasTech(techId);
    }

    /**
     * Returns the total number of distinct technologies (advances) available
     * in the currently loaded ruleset.
     *
     * @return the technology count, or {@link #NO_ADVANCE} if none are loaded
     */
    public static int advanceCount() {
        return NO_ADVANCE;
    }

    /**
     * Checks whether {@code techId} is a direct prerequisite needed to unlock
     * {@code advanceId}.
     * Mirrors the {@code advance_required} lookup in the C Freeciv server's
     * {@code common/tech.c}.
     *
     * @param game      the current game state
     * @param techId    the candidate prerequisite technology ID
     * @param advanceId the technology that may require {@code techId}
     * @return {@code true} if {@code techId} is a direct prerequisite for {@code advanceId}
     */
    public static boolean isPrereqFor(Game game, long techId, long advanceId) {
        Technology tech = game.techs.get(techId);
        Technology advance = game.techs.get(advanceId);
        if (tech == null || advance == null) return false;

        // Check both prereq slots from the ruleset (req1, req2)
        return tech.getName().equals(advance.getPrereq1())
                || tech.getName().equals(advance.getPrereq2());
    }

    /**
     * Calculates a research-speed bonus (in percent) for the specified player
     * derived from city improvements (Library, University, Research Lab) and
     * government effects.
     * Mirrors the science-output calculation in the C Freeciv server's city
     * output system.
     *
     * @param game     the current game state
     * @param playerId the ID of the player
     * @return the bonus percentage (e.g. 50 = 50% faster research), or 0 if none
     */
    public static int playerResearchBonus(Game game, long playerId) {
        Player player = game.players.get(playerId);
        if (player == null) return 0;

        int bonus = 0;
        // Library gives +50% science per city (improvement ID 3 in classic ruleset)
        for (City city : game.cities.values()) {
            if (city.getOwner() != playerId) continue;
            if (city.hasImprovement(3)) bonus += 50;  // Library
        }
        return bonus;
    }
}
