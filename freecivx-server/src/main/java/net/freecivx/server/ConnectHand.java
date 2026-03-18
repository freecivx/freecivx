/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.freecivx.com/
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

import net.freecivx.game.City;
import net.freecivx.game.Game;
import net.freecivx.game.Player;
import org.json.JSONObject;

/**
 * Handles connection and login packets from clients.
 * Mirrors the functionality of connecthand.c in the C Freeciv server.
 * Manages the server-join handshake, reconnection flows, and initial
 * game-list synchronisation for newly connected clients.
 */
public class ConnectHand {

    /**
     * Handles a PACKET_SERVER_JOIN_REQ from a new client.
     * Validates the username, registers the connection and player in the
     * game state, then sends a join-reply and initial game data.
     *
     * @param game     the current game state
     * @param server   the CivServer instance used to send replies
     * @param connId   the connection ID assigned to this client
     * @param username the username provided by the client (may be sanitised)
     */
    public static void handleServerJoinReq(Game game, IGameServer server, long connId, String username) {
        if (username == null || username.isBlank()) {
            sendServerJoinReply(server, connId, false);
            return;
        }

        game.addConnection(connId, username, connId, "");
        game.addPlayer(connId, username, "", null);

        sendServerJoinReply(server, connId, true);
        sendGameList(game, server, connId);
    }

    /**
     * Handles a reconnection request from a previously connected client.
     * Looks up the existing connection record and re-synchronises game state
     * to the client without creating a new player slot.
     *
     * @param game   the current game state
     * @param server the CivServer instance used to send replies
     * @param connId the connection ID of the reconnecting client
     */
    public static void handleServerReconnectReq(Game game, IGameServer server, long connId) {
        if (game.isGameStarted()) {
            game.syncNewPlayer(connId);
        } else {
            sendGameList(game, server, connId);
        }
    }

    /**
     * Sends a PACKET_SERVER_JOIN_REPLY to the client, indicating whether
     * the join request was accepted or rejected.
     *
     * @param server   the CivServer instance used to send the reply
     * @param connId   the connection ID of the client
     * @param canJoin  {@code true} if the client is allowed to join
     */
    public static void sendServerJoinReply(IGameServer server, long connId, boolean canJoin) {
        JSONObject reply = new JSONObject();
        reply.put("pid", Packets.PACKET_SERVER_JOIN_REPLY);
        reply.put("you_can_join", canJoin);
        reply.put("conn_id", connId);
        server.sendMessage(connId, reply.toString());
    }

    /**
     * Sends the current game list (lobby information) to the specified client.
     * Includes player names, nation assignments, and ready status so that
     * the client can display the pre-game lobby.
     *
     * @param game   the current game state
     * @param server the CivServer instance used to send messages
     * @param connId the connection ID of the recipient client
     */
    public static void sendGameList(Game game, IGameServer server, long connId) {
        for (Player player : game.players.values()) {
            JSONObject msg = new JSONObject();
            msg.put("pid", Packets.PACKET_PLAYER_INFO);
            msg.put("playerno", player.getPlayerNo());
            msg.put("name", player.getUsername());
            msg.put("nation", player.getNation());
            msg.put("is_alive", player.isAlive());
            server.sendMessage(connId, msg.toString());
        }
    }
}
