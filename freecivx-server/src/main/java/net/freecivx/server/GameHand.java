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

import net.freecivx.game.Connection;
import net.freecivx.game.Game;
import net.freecivx.game.Player;
import org.json.JSONObject;

/**
 * Handles game-state packets such as turn-done, player-ready, and game-info.
 * Mirrors the functionality of gamehand.c in the C Freeciv server.
 * Responsible for synchronising high-level game lifecycle events between
 * the server and all connected clients.
 */
public class GameHand {

    /**
     * Handles a PACKET_PLAYER_READY packet from a client.
     * When all players are ready the server starts the game; if the game
     * is already running the new player is synchronised to the current state.
     *
     * @param game   the current game state
     * @param connId the connection ID of the player that sent the packet
     */
    public static void handlePlayerReady(Game game, long connId) {
        if (game.isGameStarted()) {
            game.syncNewPlayer(connId);
        } else {
            game.startGame();
        }
    }

    /**
     * Handles a PACKET_PLAYER_PHASE_DONE packet, signalling that the player
     * has finished their actions for the current phase/turn.
     * Once all players have submitted their phase-done the server advances
     * the turn.
     *
     * @param game   the current game state
     * @param connId the connection ID of the player that completed their phase
     */
    public static void handlePlayerPhaseDone(Game game, long connId) {
        Player player = game.players.get(connId);
        if (player == null) return;

        game.turnDone();
    }

    /**
     * Sends a PACKET_GAME_INFO packet to a single client containing the
     * current calendar year, turn number, game phase, and turn timeout.
     *
     * @param game   the current game state
     * @param connId the connection ID of the recipient client
     */
    public static void sendGameInfo(Game game, long connId) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_GAME_INFO);
        msg.put("year", game.year);
        msg.put("turn", game.turn);
        msg.put("phase", game.phase);
        msg.put("timeout", game.getTurnTimeout());
        msg.put("first_timeout", -1);
        game.getServer().sendMessage(connId, msg.toString());
    }

    /**
     * Sends a PACKET_CALENDAR_INFO packet to a single client.
     * Calendar info includes the current year and the game's year/turn
     * labels used to format the in-game date display.
     *
     * @param game   the current game state
     * @param connId the connection ID of the recipient client
     */
    public static void sendCalendarInfo(Game game, long connId) {
        game.getServer().sendCalendarInfoAll();
    }

    /**
     * Sends a PACKET_PLAYER_INFO packet for the specified player to a client.
     * Contains nation, government, gold, research state, and other per-player
     * fields that are visible to the recipient.
     *
     * @param game     the current game state
     * @param connId   the connection ID of the recipient client
     * @param playerId the ID of the player whose info is being sent
     */
    public static void sendPlayerInfo(Game game, long connId, long playerId) {
        Player player = game.players.get(playerId);
        if (player == null) return;

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_PLAYER_INFO);
        msg.put("playerno", player.getPlayerNo());
        msg.put("name", player.getUsername());
        msg.put("nation", player.getNation());
        msg.put("is_alive", player.isAlive());
        game.getServer().sendMessage(connId, msg.toString());
    }
}
