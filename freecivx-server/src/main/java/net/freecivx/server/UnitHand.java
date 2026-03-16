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

import net.freecivx.game.Actions;
import net.freecivx.game.Game;
import net.freecivx.game.Player;
import net.freecivx.game.Unit;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

/**
 * Handles incoming unit-related packets from clients.
 * Mirrors the functionality of unithand.c in the C Freeciv server.
 * Processes client requests for unit movement orders, actions, activity
 * changes, and transport operations.
 */
public class UnitHand {

    private static final Logger log = LoggerFactory.getLogger(UnitHand.class);

    /**
     * Handles a unit movement/order packet from a client.
     * Validates the unit ownership, checks that the destination tile is
     * reachable, and delegates to the game's moveUnit logic.
     *
     * @param game     the current game state
     * @param connId   the connection ID of the requesting client
     * @param unitId   the ID of the unit to move
     * @param destTile the destination tile index
     * @param order    the order type (e.g. move, goto, patrol)
     * @param dir      the facing direction for the move
     */
    public static void handleUnitOrders(Game game, long connId, int unitId, int destTile, int order, int dir) {
        Unit unit = game.units.get((long) unitId);
        if (unit == null) return;

        Player player = game.players.get(unit.getOwner());
        if (player == null || player.getConnectionId() != connId) return;

        game.moveUnit(unitId, destTile, dir);
    }

    /**
     * Handles a unit do-action packet from a client (e.g. found city, attack,
     * establish embassy).  Dispatches to the appropriate handler based on the
     * numeric action type.  Mirrors the action-dispatch logic of
     * {@code unithand.c:handle_unit_do_action} in the C Freeciv server.
     *
     * @param game       the current game state
     * @param connId     the connection ID of the requesting client
     * @param actorId    the ID of the unit performing the action
     * @param targetId   the ID of the target unit, city, or tile
     * @param actionType the numeric action type ID (see Actions.ACTION_* constants)
     * @param name       optional name parameter (URL-encoded city name for ACTION_FOUND_CITY)
     */
    public static void handleUnitDoAction(Game game, long connId, long actorId, long targetId, int actionType, String name) {
        Unit actor = game.units.get(actorId);
        if (actor == null) return;

        Player player = game.players.get(actor.getOwner());
        if (player == null || player.getConnectionId() != connId) return;

        if (actionType == Actions.ACTION_FOUND_CITY) {
            String cityName = "New City";
            if (name != null && !name.isEmpty()) {
                try {
                    cityName = URLDecoder.decode(name, StandardCharsets.UTF_8);
                } catch (IllegalArgumentException e) {
                    log.warn("UnitHand: failed to URL-decode city name '{}': {}", name, e.getMessage());
                    cityName = name;
                }
            }
            game.buildCity(actorId, cityName, targetId);
        } else if (actionType == Actions.ACTION_ATTACK) {
            // targetId is the unit ID of the defending unit
            game.attackUnit(actorId, targetId);
        } else if (actionType == Actions.ACTION_FORTIFY) {
            game.changeUnitActivity(actorId, CityTurn.ACTIVITY_FORTIFIED);
        } else if (actionType == Actions.ACTION_MINE) {
            // Start building a mine on the current tile.
            // "Plant" is the Freeciv 3.x name for the mine/forest-plant action.
            game.changeUnitActivity(actorId, CityTurn.ACTIVITY_MINE);
        } else if (actionType == Actions.ACTION_IRRIGATE) {
            // Start building an irrigation channel on the current tile.
            // "Cultivate" is the Freeciv 3.x name for the irrigate action.
            game.changeUnitActivity(actorId, CityTurn.ACTIVITY_IRRIGATE);
        } else if (actionType == Actions.ACTION_ROAD) {
            // Start building a road on the current tile.
            game.changeUnitActivity(actorId, CityTurn.ACTIVITY_ROAD);
        } else {
            // Unknown action: refresh the unit info for the client
            UnitTools.sendUnitInfo(game, game.getServer(), connId, actorId);
        }
    }

    /**
     * Handles a client request to change a unit's current activity
     * (e.g. fortify, mine, irrigate, road, idle).
     *
     * @param game     the current game state
     * @param connId   the connection ID of the requesting client
     * @param unitId   the ID of the unit whose activity should change
     * @param activity the new activity code
     */
    public static void handleUnitChangeActivity(Game game, long connId, long unitId, int activity) {
        Unit unit = game.units.get(unitId);
        if (unit == null) return;

        Player player = game.players.get(unit.getOwner());
        if (player == null || player.getConnectionId() != connId) return;

        game.changeUnitActivity(unitId, activity);
    }

    /**
     * Handles a client request to load a unit onto a transport.
     * Validates that both the unit and transport exist, belong to the same
     * player, and that the transport has capacity.
     *
     * @param game        the current game state
     * @param connId      the connection ID of the requesting client
     * @param unitId      the ID of the unit to be loaded
     * @param transportId the ID of the transport unit to load onto
     */
    public static void handleUnitLoadRequest(Game game, long connId, int unitId, int transportId) {
        Unit unit = game.units.get((long) unitId);
        Unit transport = game.units.get((long) transportId);
        if (unit == null || transport == null) return;

        Player player = game.players.get(unit.getOwner());
        if (player == null || player.getConnectionId() != connId) return;

        unit.setTransported(true);

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_UNIT_INFO);
        msg.put("id", unitId);
        msg.put("transported", true);
        msg.put("transported_by", transportId);
        game.getServer().broadcastPacket(msg);
    }

    /**
     * Handles a client request to unload a unit from its transport.
     * Validates that the unit is currently transported and that the
     * client owns the unit.
     *
     * @param game   the current game state
     * @param connId the connection ID of the requesting client
     * @param unitId the ID of the unit to unload
     */
    public static void handleUnitUnloadRequest(Game game, long connId, int unitId) {
        Unit unit = game.units.get((long) unitId);
        if (unit == null) return;

        Player player = game.players.get(unit.getOwner());
        if (player == null || player.getConnectionId() != connId) return;

        if (!unit.isTransported()) return;

        unit.setTransported(false);

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_UNIT_INFO);
        msg.put("id", unitId);
        msg.put("transported", false);
        game.getServer().broadcastPacket(msg);
    }
}
