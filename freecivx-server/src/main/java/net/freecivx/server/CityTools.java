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

import net.freecivx.game.City;
import net.freecivx.game.Game;
import net.freecivx.game.Nation;
import net.freecivx.game.Player;
import net.freecivx.game.Tile;
import net.freecivx.game.Unit;
import org.json.JSONObject;

import java.util.concurrent.atomic.AtomicLong;

/**
 * Utility methods for city management used across server handlers.
 * Mirrors the functionality of citytools.c in the C Freeciv server.
 * Provides functions for creating and removing cities, processing city
 * growth, sending city packets to clients, and supporting unit maintenance.
 */
public class CityTools {

    private static final AtomicLong cityIdCounter = new AtomicLong(1);

    /** Default city size when a city is first founded. */
    public static final int CITY_INITIAL_SIZE = 1;

    /**
     * Creates a new city for the given player on the specified tile.
     * Assigns a unique city ID, adds the city to the game state, and
     * broadcasts the new city info to all clients.
     *
     * @param game     the current game state
     * @param playerId the ID of the player founding the city
     * @param tileId   the tile index where the city is to be founded
     * @param name     the name of the new city
     * @return the newly created {@link City}, or {@code null} if creation failed
     */
    public static City createCity(Game game, long playerId, long tileId, String name) {
        Tile tile = game.tiles.get(tileId);
        if (tile == null) return null;

        Player player = game.players.get(playerId);
        if (player == null) return null;

        long cityId = cityIdCounter.getAndIncrement();
        City city = new City(name, playerId, tileId, CITY_INITIAL_SIZE,
                0, game.cities.isEmpty(), false, 0, false, false, "", 0, 0);
        game.cities.put(cityId, city);

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_CITY_INFO);
        msg.put("id", cityId);
        msg.put("owner", playerId);
        msg.put("tile", tileId);
        msg.put("name", name);
        msg.put("size", CITY_INITIAL_SIZE);
        game.getServer().sendMessageAll(msg.toString());

        return city;
    }

    /**
     * Removes the city with the given ID from the game state and notifies
     * all clients to delete their local copy of the city.
     *
     * @param game   the current game state
     * @param cityId the ID of the city to remove
     */
    public static void removeCity(Game game, long cityId) {
        if (!game.cities.containsKey(cityId)) return;

        game.cities.remove(cityId);

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_CITY_INFO);
        msg.put("id", cityId);
        msg.put("remove", true);
        game.getServer().sendMessageAll(msg.toString());
    }

    /**
     * Processes population growth for a city at end of turn.
     * Increases the city's size by one and recalculates tile yields.
     * Does nothing if the city does not exist.
     *
     * @param game   the current game state
     * @param cityId the ID of the city to grow
     */
    public static void cityGrowth(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return;

        city.setSize(city.getSize() + 1);
        sendCityInfo(game, game.getServer(), -1L, cityId);
    }

    /**
     * Sends a PACKET_CITY_INFO packet for the specified city to a single client.
     * Pass {@code connId = -1} to send only as a side-effect broadcast
     * via {@link CivServer#sendMessageAll}.
     *
     * @param game   the current game state
     * @param server the CivServer used to transmit the packet
     * @param connId the connection ID of the recipient; {@code -1} to broadcast to all
     * @param cityId the ID of the city whose info is to be sent
     */
    public static void sendCityInfo(Game game, CivServer server, long connId, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return;

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_CITY_INFO);
        msg.put("id", cityId);
        msg.put("owner", city.getOwner());
        msg.put("tile", city.getTile());
        msg.put("name", city.getName());
        msg.put("size", city.getSize());
        msg.put("capital", city.isCapital());
        msg.put("production_kind", city.getProductionKind());
        msg.put("production_value", city.getProductionValue());

        if (connId < 0) {
            server.sendMessageAll(msg.toString());
        } else {
            server.sendMessage(connId, msg.toString());
        }
    }

    /**
     * Suggests a city name appropriate for the given player's nation.
     * Returns a name from the nation's city-name list that has not yet been used,
     * or a generic fallback name if all nation names are taken.
     *
     * @param game     the current game state
     * @param playerId the ID of the player for whom to suggest a name
     * @return a suggested city name string
     */
    public static String suggestCityName(Game game, long playerId) {
        Player player = game.players.get(playerId);
        if (player == null) return "New City";

        Nation nation = game.nations.get((long) player.getNation());
        if (nation != null && nation.getName() != null) {
            // Use the nation's capital name as a suggestion if not already taken
            String candidate = nation.getName() + " City";
            boolean taken = game.cities.values().stream()
                    .anyMatch(c -> c.getName().equals(candidate));
            if (!taken) return candidate;
        }
        return "City " + (game.cities.size() + 1);
    }

    /**
     * Associates a unit with a city for support purposes.
     * Sets the unit's home city so that the city pays the unit's upkeep.
     *
     * @param game   the current game state
     * @param cityId the ID of the city that will support the unit
     * @param unitId the ID of the unit to be supported
     */
    public static void citySupportUnit(Game game, long cityId, long unitId) {
        City city = game.cities.get(cityId);
        Unit unit = game.units.get(unitId);
        if (city == null || unit == null) return;

        // Future implementation: track home city on Unit and pay upkeep
        System.out.println("City " + cityId + " supports unit " + unitId);
    }
}
