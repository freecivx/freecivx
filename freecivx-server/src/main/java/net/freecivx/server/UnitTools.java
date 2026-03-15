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
import net.freecivx.game.Tile;
import net.freecivx.game.Unit;
import net.freecivx.game.UnitType;
import org.json.JSONObject;

import java.util.concurrent.atomic.AtomicLong;

/**
 * Utility methods for unit management used across server handlers.
 * Mirrors the functionality of unittools.c in the C Freeciv server.
 * Provides functions for creating and removing units, sending unit packets
 * to clients, and triggering per-turn unit state refreshes.
 */
public class UnitTools {

    private static final AtomicLong unitIdCounter = new AtomicLong(1);

    /** Default HP for a newly created unit. */
    public static final int UNIT_INITIAL_HP = 10;
    /** Default moves left for a newly created unit. */
    public static final int UNIT_INITIAL_MOVES = 3;

    /**
     * Creates a new unit for the given player on the specified tile.
     * Assigns a unique unit ID, places it on the map, and broadcasts the
     * new unit info to all connected clients.
     *
     * @param game       the current game state
     * @param playerId   the ID of the player who will own the unit
     * @param tileId     the tile index where the unit is to be created
     * @param unitTypeId the unit type ID (index into {@code game.unitTypes})
     * @return the newly created {@link Unit}, or {@code null} if creation failed
     */
    public static Unit createUnit(Game game, long playerId, long tileId, int unitTypeId) {
        Tile tile = game.tiles.get(tileId);
        if (tile == null) return null;

        Player player = game.players.get(playerId);
        if (player == null) return null;

        UnitType unitType = game.unitTypes.get((long) unitTypeId);
        int hp = unitType != null ? unitType.getHp() : UNIT_INITIAL_HP;
        int moveRate = unitType != null ? unitType.getMoveRate() : UNIT_INITIAL_MOVES;

        long unitId = unitIdCounter.getAndIncrement();
        Unit unit = new Unit(unitId, playerId, tileId, unitTypeId, 0, 0, hp, 0, moveRate);
        game.units.put(unitId, unit);

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_UNIT_INFO);
        msg.put("id", unitId);
        msg.put("owner", playerId);
        msg.put("tile", tileId);
        msg.put("type", unitTypeId);
        msg.put("hp", hp);
        msg.put("movesleft", moveRate);
        game.getServer().broadcastPacket(msg);

        return unit;
    }

    /**
     * Removes the unit with the given ID from the game state and sends a
     * PACKET_UNIT_REMOVE to all clients so they discard their local copy.
     *
     * @param game   the current game state
     * @param unitId the ID of the unit to remove
     */
    public static void removeUnit(Game game, long unitId) {
        if (!game.units.containsKey(unitId)) return;

        game.units.remove(unitId);

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_UNIT_REMOVE);
        msg.put("unit_id", unitId);
        game.getServer().broadcastPacket(msg);
    }

    /**
     * Sends a PACKET_UNIT_INFO packet for the specified unit to a single client.
     *
     * @param game   the current game state
     * @param server the CivServer used to transmit the packet
     * @param connId the connection ID of the recipient client
     * @param unitId the ID of the unit whose info is to be sent
     */
    public static void sendUnitInfo(Game game, IGameServer server, long connId, long unitId) {
        Unit unit = game.units.get(unitId);
        if (unit == null) return;

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_UNIT_INFO);
        msg.put("id", unitId);
        msg.put("owner", unit.getOwner());
        msg.put("tile", unit.getTile());
        msg.put("type", unit.getType());
        msg.put("facing", unit.getFacing());
        msg.put("veteran", unit.getVeteran());
        msg.put("hp", unit.getHp());
        msg.put("activity", unit.getActivity());
        msg.put("movesleft", unit.getMovesleft());
        msg.put("transported", unit.isTransported());
        server.sendMessage(connId, msg.toString());
    }

    /**
     * Sends PACKET_UNIT_INFO for every unit in the game to the specified client.
     * Used during initial synchronisation after a player joins mid-game.
     *
     * @param game   the current game state
     * @param server the CivServer used to transmit packets
     * @param connId the connection ID of the recipient client
     */
    public static void sendAllUnitInfo(Game game, IGameServer server, long connId) {
        for (long unitId : game.units.keySet()) {
            sendUnitInfo(game, server, connId, unitId);
        }
    }

    /**
     * Resets the unit's move state at the start of a new turn.
     * Restores moves-left to the unit type's full move rate and clears
     * the done-moving flag.
     *
     * @param game   the current game state
     * @param unitId the ID of the unit to reset for the new turn
     */
    public static void unitStartMove(Game game, long unitId) {
        Unit unit = game.units.get(unitId);
        if (unit == null) return;

        UnitType unitType = game.unitTypes.get((long) unit.getType());
        int moveRate = unitType != null ? unitType.getMoveRate() : UNIT_INITIAL_MOVES;

        unit.setMovesleft(moveRate);
        unit.setDoneMoving(false);
    }

    /**
     * Refreshes a unit's derived state (e.g. recalculates terrain bonuses,
     * updates activity progress) and sends updated info to all clients.
     *
     * @param game   the current game state
     * @param unitId the ID of the unit to refresh
     */
    public static void refreshUnit(Game game, long unitId) {
        Unit unit = game.units.get(unitId);
        if (unit == null) return;

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_UNIT_INFO);
        msg.put("id", unitId);
        msg.put("activity", unit.getActivity());
        msg.put("movesleft", unit.getMovesleft());
        game.getServer().broadcastPacket(msg);
    }
}
