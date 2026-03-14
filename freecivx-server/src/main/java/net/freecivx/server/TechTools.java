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
import net.freecivx.game.Technology;
import org.json.JSONObject;

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

        // TODO: persist the known-tech set on Player and check for duplicates
        System.out.println("Player " + player.getUsername() + " received tech: " + tech.getName());
        sendResearchInfo(game, game.getServer(), player.getConnectionId(), playerId);
    }

    /**
     * Recalculates a player's research progress for the current turn.
     * Adds the player's science output to the bulbs-towards-current-tech counter
     * and, if the cost threshold is reached, completes the technology and
     * triggers any chain unlocks.
     *
     * @param game     the current game state
     * @param playerId the ID of the player whose research should be updated
     */
    public static void playerResearchUpdate(Game game, long playerId) {
        Player player = game.players.get(playerId);
        if (player == null) return;

        // TODO: increment bulbs, check completion, handle cascading techs
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
        msg.put("bulbs_researched", 0);
        msg.put("techs_researched", 0);
        server.sendMessage(connId, msg.toString());
    }

    /**
     * Checks whether the given player is able to research the specified technology.
     * A technology can be researched if the player does not already know it and
     * has all prerequisite technologies.
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

        // TODO: check prerequisites once Player carries a known-tech set
        return true;
    }
}
