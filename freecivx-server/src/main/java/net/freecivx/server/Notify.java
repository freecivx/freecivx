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

/**
 * Notification system for sending event messages to players and connections.
 * Mirrors the functionality of notify.c in the C Freeciv server.
 * Provides a centralised API for delivering chat-style notifications triggered
 * by game events (battles, city growth, diplomatic messages, etc.).
 */
public class Notify {

    /**
     * Sends a text notification message to a single player.
     * The message is delivered as a PACKET_CHAT_MSG to the player's connection.
     *
     * @param game     the current game state
     * @param server   the CivServer used to transmit the message
     * @param playerId the ID of the player to notify
     * @param message  the notification text to display
     */
    public static void notifyPlayer(Game game, CivServer server, long playerId, String message) {
        Player player = game.players.get(playerId);
        if (player == null) return;
        server.sendMessage(player.getConnectionId(), message);
    }

    /**
     * Broadcasts a text notification to all connected players.
     *
     * @param game    the current game state
     * @param server  the CivServer used to transmit the message
     * @param message the notification text to broadcast
     */
    public static void notifyAllPlayers(Game game, CivServer server, String message) {
        server.sendMessageAll(message);
    }

    /**
     * Sends a geo-located event notification to a single player.
     * In addition to the message text, the packet carries map coordinates and
     * an event type identifier so the client can display an appropriate icon
     * or animation at the specified location.
     *
     * @param game      the current game state
     * @param server    the CivServer used to transmit the message
     * @param playerId  the ID of the player to notify
     * @param x         the x map-coordinate of the event
     * @param y         the y map-coordinate of the event
     * @param eventType an integer identifying the event type (mirrors E_* constants
     *                  in the C Freeciv server's events.h)
     * @param message   the notification text to display
     */
    public static void notifyEvent(Game game, CivServer server, long playerId,
                                   int x, int y, int eventType, String message) {
        Player player = game.players.get(playerId);
        if (player == null) return;
        server.sendEventMessage(player.getConnectionId(), message, eventType, x, y);
    }

    /**
     * Sends a notification to all currently connected clients (not just players).
     * Used for server-wide announcements such as game start, turn change,
     * or server maintenance messages.
     *
     * @param game    the current game state
     * @param server  the CivServer used to transmit the message
     * @param message the notification text to broadcast
     */
    public static void notifyConnections(Game game, CivServer server, String message) {
        server.sendMessageAll(message);
    }
}
