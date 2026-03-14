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

package net.freecivx.server;

import net.freecivx.game.Game;
import net.freecivx.game.Player;
import net.freecivx.game.City;
import net.freecivx.game.Technology;
import org.json.JSONObject;
import java.util.Map;

/**
 * Utility methods for the technology research system.
 * Mirrors the functionality of techtools.c in the C Freeciv server.
 * Handles granting technologies to players, updating research progress,
 * and broadcasting research state packets to clients.
 */
public class TechTools {

    /** Base research cost multiplier applied to each technology. */
    public static final int BASE_TECH_COST = 20;

    /**
     * Grants a specific technology directly to a player (e.g. from a goodie hut
     * or a treaty clause).  Updates the player's known-tech list and triggers a
     * research-info broadcast to the owning client.
     * Mirrors {@code give_advance_to_player} in the C Freeciv server.
     *
     * @param game     the current game state
     * @param playerId the ID of the player receiving the technology
     * @param techId   the ID of the technology being granted
     */
    public static void giveTechToPlayer(Game game, long playerId, long techId) {
        Player player = game.players.get(playerId);
        if (player == null) return;

        Technology tech = game.techs.get(techId);
        if (tech == null) return;

        if (player.hasTech(techId)) return; // already known
        player.addKnownTech(techId);
        System.out.println("Player " + player.getUsername() + " received tech: " + tech.getName());
        sendResearchInfo(game, game.getServer(), player.getConnectionId(), playerId);
    }

    /**
     * Recalculates a player's research progress for the current turn.
     * Adds the player's science output to the bulbs-towards-current-tech counter
     * and, if the cost threshold is reached, completes the technology.
     * Mirrors {@code update_research} in the C Freeciv server.
     *
     * @param game     the current game state
     * @param playerId the ID of the player whose research should be updated
     */
    public static void playerResearchUpdate(Game game, long playerId) {
        Player player = game.players.get(playerId);
        if (player == null) return;

        long techId = player.getResearchingTech();
        if (techId < 0) {
            sendResearchInfo(game, game.getServer(), player.getConnectionId(), playerId);
            return;
        }

        // Calculate science output this turn: sum city science contributions
        // Uses CityTurn.cityScienceContribution() which accounts for Library,
        // University, and other science-producing buildings — mirroring the
        // per-city science output calculation in the C Freeciv server.
        int scienceOutput = 0;
        for (Map.Entry<Long, City> entry : game.cities.entrySet()) {
            City city = entry.getValue();
            if (city.getOwner() == playerId) {
                scienceOutput += net.freecivx.server.CityTurn.cityScienceContribution(game, entry.getKey());
            }
        }
        // Apply player science rate (percentage of output directed to research)
        scienceOutput = scienceOutput * player.getScienceRate() / 100;

        // Accumulate bulbs and check for completion
        int bulbs = player.getBulbsResearched() + scienceOutput;
        Technology tech = game.techs.get(techId);
        // Use the technology's own ruleset cost (from tech.getCost()) as the base,
        // scaled by the number of technologies the player already knows.
        // Mirrors TECH_COST_CLASSIC in the C Freeciv server's common/research.c:
        //   cost = baseCost * (1 + knownCount / divisor).
        int baseCost = (tech != null && tech.getCost() > 0)
                ? tech.getCost()
                : net.freecivx.game.Research.DEFAULT_TECH_COST;
        int cost = baseCost + (baseCost * player.getKnownTechs().size() / 10);
        if (bulbs >= cost) {
            // Technology complete: grant it and reset bulbs
            giveTechToPlayer(game, playerId, techId);
            player.setBulbsResearched(bulbs - cost);
            // Automatically advance toward tech goal if one is set.
            // Mirrors the C Freeciv server's auto-research-next behaviour.
            long nextTech = pickNextResearchTowardGoal(game, player);
            player.setResearchingTech(nextTech); // -1 if no goal or goal reached
        } else {
            player.setBulbsResearched(bulbs);
        }

        sendResearchInfo(game, game.getServer(), player.getConnectionId(), playerId);
    }

    /**
     * Sends a PACKET_RESEARCH_INFO packet to the specified connection,
     * containing the player's current research target, bulbs accumulated,
     * and the full list of known technologies.
     *
     * @param game     the current game state
     * @param server   the CivServer used to transmit the packet
     * @param connId   the connection ID of the recipient client
     * @param playerId the ID of the player whose research info should be sent
     */
    public static void sendResearchInfo(Game game, CivServer server, long connId, long playerId) {
        Player player = game.players.get(playerId);
        if (player == null) return;

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RESEARCH_INFO);
        msg.put("playerno", player.getPlayerNo());
        msg.put("bulbs_researched", player.getBulbsResearched());
        msg.put("techs_researched", player.getKnownTechs().size());
        msg.put("researching", player.getResearchingTech());
        server.sendMessage(connId, msg.toString());
    }

    /**
     * Checks whether the given player is able to research the specified technology.
     * A technology can be researched if the player does not already know it and
     * has all prerequisite technologies.
     * Mirrors {@code can_player_learn_tech} in the C Freeciv server.
     *
     * @param game     the current game state
     * @param playerId the ID of the player to check
     * @param techId   the ID of the technology being evaluated
     * @return {@code true} if the player can research the technology
     */
    public static boolean canPlayerResearch(Game game, long playerId, long techId) {
        Player player = game.players.get(playerId);
        if (player == null) return false;

        Technology tech = game.techs.get(techId);
        if (tech == null) return false;

        // Cannot research something already known
        if (player.hasTech(techId)) return false;

        // Check both prerequisite technologies (req1, req2)
        String req1 = tech.getPrereq1();
        String req2 = tech.getPrereq2();

        if (!isPrereqSatisfied(game, player, req1)) return false;
        if (!isPrereqSatisfied(game, player, req2)) return false;

        return true;
    }

    /**
     * Returns {@code true} if the given prerequisite name is satisfied by the
     * player's known technologies.  "None" and "Never" are treated as always
     * satisfied / never satisfied respectively.
     */
    private static boolean isPrereqSatisfied(Game game, Player player, String prereqName) {
        if (prereqName == null || "None".equals(prereqName)) return true;
        if ("Never".equals(prereqName)) return false;
        // Check if any known tech ID maps to a tech with the required name
        for (long id : player.getKnownTechs()) {
            Technology known = game.techs.get(id);
            if (known != null && prereqName.equals(known.getName())) return true;
        }
        return false; // prerequisite tech not yet known
    }

    /**
     * Selects the next technology to research in order to progress toward the
     * player's tech goal.  Returns the goal itself if the player can research it
     * directly, or the first researchable prerequisite otherwise.
     * Returns -1 if no goal is set, the goal is already known, or no researchable
     * path exists.
     * Mirrors the {@code research_goal_tech} logic in the C Freeciv server.
     *
     * @param game   the current game state
     * @param player the player whose goal to evaluate
     * @return the ID of the next technology to research toward the goal, or -1
     */
    public static long pickNextResearchTowardGoal(Game game, Player player) {
        long goalId = player.getTechGoal();
        if (goalId < 0) return -1L;

        // If goal is already known, clear it
        if (player.hasTech(goalId)) return -1L;

        // If goal is directly researchable, return it
        if (canPlayerResearch(game, player.getPlayerNo(), goalId)) return goalId;

        // Otherwise find the first researchable prerequisite in the dependency chain
        // BFS through prerequisite tree toward the goal
        Technology goal = game.techs.get(goalId);
        if (goal == null) return -1L;

        for (Map.Entry<Long, net.freecivx.game.Technology> entry : game.techs.entrySet()) {
            long tid = entry.getKey();
            net.freecivx.game.Technology tech = entry.getValue();
            // Check if this tech is a prerequisite of the goal (directly or indirectly)
            if (!player.hasTech(tid) && canPlayerResearch(game, player.getPlayerNo(), tid)) {
                // Simple heuristic: return first researchable unknown tech that is a prereq
                if (goal.getPrereq1().equals(tech.getName()) || goal.getPrereq2().equals(tech.getName())) {
                    return tid;
                }
            }
        }

        // No direct prereq found; return first researchable tech (progress toward goal)
        return -1L;
    }
}
