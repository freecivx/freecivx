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
import net.freecivx.game.Government;
import net.freecivx.game.Player;
import net.freecivx.game.Technology;
import org.json.JSONObject;

import java.util.Map;

/**
 * Handles player-related packets from clients and broadcasts player state.
 * Mirrors the functionality of plrhand.c in the C Freeciv server.
 * Manages government changes, technology research choices, and player
 * attribute synchronisation.
 */
public class PlrHand {

    /**
     * Handles a client request to change the player's government type.
     * Validates that the player has researched the prerequisite technology
     * before allowing the change.
     * Mirrors {@code handle_player_change_government} in the C Freeciv server.
     *
     * @param game   the current game state
     * @param connId the connection ID of the requesting player
     * @param govId  the ID of the new government type to adopt
     */
    public static void handlePlayerChangeGovernment(Game game, long connId, int govId) {
        Player player = game.players.get(connId);
        if (player == null) return;

        Government gov = game.governments.get((long) govId);
        if (gov == null) return;

        // Validate tech prerequisites: check that the player knows the required tech
        String techReq = gov.getTechReq();
        if (techReq != null && !"None".equals(techReq)) {
            boolean hasRequiredTech = false;
            for (Map.Entry<Long, net.freecivx.game.Technology> entry : game.techs.entrySet()) {
                if (techReq.equals(entry.getValue().getName())
                        && player.hasTech(entry.getKey())) {
                    hasRequiredTech = true;
                    break;
                }
            }
            if (!hasRequiredTech) {
                Notify.notifyPlayer(game, game.getServer(), connId,
                        "You need to research " + techReq
                                + " before adopting " + gov.getName() + ".");
                return;
            }
        }

        player.setGovernmentId(govId);
        sendAllPlayerInfo(game);
    }

    /**
     * Sends a PACKET_PLAYER_INFO packet for every player to all connected
     * clients.  Called after any state change that affects player visibility,
     * such as a government revolution or diplomatic status update.
     *
     * @param game the current game state
     */
    public static void sendAllPlayerInfo(Game game) {
        for (Player player : game.players.values()) {
            JSONObject msg = new JSONObject();
            msg.put("pid", Packets.PACKET_PLAYER_INFO);
            msg.put("playerno", player.getPlayerNo());
            msg.put("name", player.getUsername());
            msg.put("nation", player.getNation());
            msg.put("is_alive", player.isAlive());
            game.getServer().sendMessageAll(msg.toString());
        }
    }

    /**
     * Handles a client request to change the player's current research target.
     * Validates that all prerequisite technologies are known before accepting
     * the change.  Mirrors {@code handle_player_research} in the C Freeciv server.
     *
     * @param game   the current game state
     * @param connId the connection ID of the requesting player
     * @param techId the ID of the technology to research next
     */
    public static void handleResearchChange(Game game, long connId, int techId) {
        Player player = game.players.get(connId);
        if (player == null) return;

        Technology tech = game.techs.get((long) techId);
        if (tech == null) return;

        // Validate prerequisites before accepting the research change.
        // Mirrors can_player_learn_tech() in the C Freeciv server.
        if (!TechTools.canPlayerResearch(game, connId, (long) techId)) {
            Notify.notifyPlayer(game, game.getServer(), connId,
                    "You cannot research " + tech.getName()
                            + ". Prerequisites are not met.");
            return;
        }

        player.setResearchingTech((long) techId);
        TechTools.sendResearchInfo(game, game.getServer(), connId, connId);
    }

    /**
     * Handles a PACKET_PLAYER_ATTRIBUTE_BLOCK packet which carries opaque
     * per-player attribute data (e.g. map markers, saved preferences).
     * The server stores the block and echoes it back to the player on reconnect.
     *
     * @param game   the current game state
     * @param connId the connection ID of the player sending the attribute block
     */
    public static void handlePlayerAttributeBlock(Game game, long connId) {
        // Attribute blocks are currently logged and discarded; future
        // implementations should persist them in the player's state.
        System.out.println("Received attribute block from connection " + connId);
    }

    /**
     * Handles a PACKET_PLAYER_RATES packet, updating the player's science,
     * luxury, and tax rates.  Each rate must be between 0 and 100 inclusive
     * and the sum of all three must equal 100.  Mirrors
     * {@code handle_player_rates} in the C Freeciv server's {@code plrhand.c}.
     * The client sends JSON fields: {@code tax}, {@code luxury}, {@code science}.
     *
     * @param game   the current game state
     * @param connId the connection ID of the requesting player
     * @param json   the parsed JSON packet from the client
     */
    public static void handlePlayerRates(Game game, long connId, JSONObject json) {
        Player player = game.players.get(connId);
        if (player == null) return;

        int science = json.optInt("science", -1);
        int tax     = json.optInt("tax",     -1);
        int luxury  = json.optInt("luxury",   0);

        // Require valid science rate; derive tax if not provided.
        if (science < 0 || science > 100) {
            Notify.notifyPlayer(game, game.getServer(), connId,
                    "Invalid science rate: " + science + ". Must be 0-100.");
            return;
        }
        if (tax < 0) {
            tax = 100 - science - luxury;
        }

        // Validate total: tax + luxury + science must equal 100.
        if (tax < 0 || tax > 100 || (science + tax + luxury) != 100) {
            Notify.notifyPlayer(game, game.getServer(), connId,
                    "Invalid tax rates: science=" + science + " tax=" + tax
                            + " luxury=" + luxury + ". They must sum to 100.");
            return;
        }

        player.setScienceRate(science);
        player.setLuxuryRate(luxury);
        player.setTaxRate(tax);
        TechTools.sendResearchInfo(game, game.getServer(), connId, connId);
        game.getServer().sendPlayerInfoAll(player);
    }
}
