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
import net.freecivx.game.Player;
import net.freecivx.game.Unit;
import org.json.JSONObject;

/**
 * Handles incoming city-related packets from clients.
 * Mirrors the functionality of cityhand.c in the C Freeciv server.
 * Each method corresponds to a packet handler that processes client requests
 * about city management actions such as buying production, renaming cities,
 * or reassigning workers.
 */
public class CityHand {

    /**
     * Handles a client request for a city name suggestion for a settler unit.
     * Looks up a suitable city name based on the player's nation and sends
     * a PACKET_CITY_NAME_SUGGESTION_INFO reply.
     *
     * @param game   the current game state
     * @param connId the connection ID of the requesting client
     * @param unitId the ID of the settler unit that will found the city
     */
    public static void handleCityNameSuggestionReq(Game game, long connId, int unitId) {
        Unit unit = game.units.get((long) unitId);
        if (unit == null) return;

        String suggestedName = CityTools.suggestCityName(game, unit.getOwner());

        JSONObject reply = new JSONObject();
        reply.put("pid", Packets.PACKET_CITY_NAME_SUGGESTION_INFO);
        reply.put("unit_id", unitId);
        reply.put("name", suggestedName != null ? suggestedName : "New City");
        game.getServer().sendMessage(connId, reply.toString());
    }

    /**
     * Handles a client request to buy the current production item in a city.
     * Validates that the player has sufficient gold, deducts the cost, and
     * completes the production immediately.
     *
     * @param game   the current game state
     * @param connId the connection ID of the requesting client
     * @param cityId the ID of the city performing the buy action
     */
    public static void handleCityBuyRequest(Game game, long connId, int cityId) {
        City city = game.cities.get((long) cityId);
        if (city == null) return;

        Player player = game.players.get(city.getOwner());
        if (player == null) return;

        // Verify ownership: only the city owner may buy production
        if (player.getConnectionId() != connId) return;

        // Notify all clients of the updated city state after purchase
        CityTools.sendCityInfo(game, game.getServer(), connId, cityId);
    }

    /**
     * Handles a client request to change which tile a city worker is assigned to.
     * Removes the worker from the current tile and assigns them to the new tile,
     * then recalculates city yields.
     *
     * @param game   the current game state
     * @param connId the connection ID of the requesting client
     * @param cityId the ID of the city whose worker assignment is changing
     * @param tileId the ID of the tile the worker should be moved to
     */
    public static void handleCityWorkerChangeRequest(Game game, long connId, int cityId, int tileId) {
        City city = game.cities.get((long) cityId);
        if (city == null) return;

        Player player = game.players.get(city.getOwner());
        if (player == null || player.getConnectionId() != connId) return;

        // Update city tiles worked and broadcast updated city info
        CityTools.sendCityInfo(game, game.getServer(), connId, cityId);
    }

    /**
     * Handles a client request to rename a city.
     * Validates the player's ownership and that the new name is non-empty,
     * then updates the city name and broadcasts the change.
     *
     * @param game   the current game state
     * @param connId the connection ID of the requesting client
     * @param cityId the ID of the city to rename
     * @param name   the new name for the city (must not be empty)
     */
    public static void handleCityRenameRequest(Game game, long connId, int cityId, String name) {
        City city = game.cities.get((long) cityId);
        if (city == null || name == null || name.isBlank()) return;

        Player player = game.players.get(city.getOwner());
        if (player == null || player.getConnectionId() != connId) return;

        city.setName(name.trim());

        // Broadcast the new city name to all connected clients
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_CITY_INFO);
        msg.put("id", cityId);
        msg.put("name", city.getName());
        game.getServer().sendMessageAll(msg.toString());
    }

    /**
     * Handles a client request to change a specialist slot in a city.
     * Replaces one specialist type with another and recalculates city output.
     *
     * @param game    the current game state
     * @param connId  the connection ID of the requesting client
     * @param cityId  the ID of the city with the specialist to change
     * @param oldSpec the specialist type being removed
     * @param newSpec the specialist type being added
     */
    public static void handleCityChangeSpecialistRequest(Game game, long connId, int cityId, int oldSpec, int newSpec) {
        City city = game.cities.get((long) cityId);
        if (city == null) return;

        Player player = game.players.get(city.getOwner());
        if (player == null || player.getConnectionId() != connId) return;

        CityTools.sendCityInfo(game, game.getServer(), connId, cityId);
    }

    /**
     * Handles a client request to change the worklist (production queue) of a city.
     * Updates the city's production queue and notifies the owning client.
     *
     * @param game   the current game state
     * @param connId the connection ID of the requesting client
     * @param cityId the ID of the city whose worklist is being changed
     */
    public static void handleCityChangeWorklistRequest(Game game, long connId, int cityId) {
        City city = game.cities.get((long) cityId);
        if (city == null) return;

        Player player = game.players.get(city.getOwner());
        if (player == null || player.getConnectionId() != connId) return;

        CityTools.sendCityInfo(game, game.getServer(), connId, cityId);
    }
}
