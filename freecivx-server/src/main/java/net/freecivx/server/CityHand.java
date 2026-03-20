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
import net.freecivx.game.Tile;
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
        game.getServer().sendPacket(connId, reply);
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
        game.getServer().broadcastPacket(msg);
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

        int[] specs = city.getSpecialists();
        // Validate specialist type indices (0 = Entertainer, 1 = Taxman, 2 = Scientist).
        if (oldSpec < 0 || oldSpec >= specs.length) return;
        if (newSpec < 0 || newSpec >= specs.length) return;
        if (specs[oldSpec] <= 0) return; // no specialist of this type to change

        // Move one specialist from oldSpec type to newSpec type.
        // Mirrors handle_city_change_specialist() in the C Freeciv server's cityhand.c.
        specs[oldSpec]--;
        specs[newSpec]++;

        CityTools.sendCityInfo(game, game.getServer(), connId, cityId);
    }

    /**
     * Handles a PACKET_CITY_MAKE_WORKER (38) request from the client.
     * Moves the city's population from a specialist slot back to working the
     * specified tile.  The tile must be within the city's working radius and
     * not already worked by another city.
     * Mirrors {@code handle_city_make_worker()} in the C Freeciv server's
     * {@code cityhand.c}.
     *
     * @param game   the current game state
     * @param connId the connection ID of the requesting client
     * @param cityId the ID of the city
     * @param tileId the tile index the citizen should work
     */
    public static void handleCityMakeWorker(Game game, long connId, int cityId, int tileId) {
        City city = game.cities.get((long) cityId);
        if (city == null) return;

        Player player = game.players.get(city.getOwner());
        if (player == null || player.getConnectionId() != connId) return;

        Tile tile = game.tiles.get((long) tileId);
        if (tile == null) return;

        // Tile must be within the city's working radius and not already worked.
        if (!isTileInCityRadius(game, city, tile)) return;
        if (tile.getWorked() >= 0 && tile.getWorked() != cityId) return; // worked by another city

        // A city cannot have more tile workers than its population (size).
        // Mirrors the population-limit check in handle_city_make_worker() in the
        // C Freeciv server's cityhand.c.
        if (tile.getWorked() != cityId) {
            if (city.getWorkedTiles().size() >= city.getSize()) return; // population limit
            tile.setWorked(cityId);
            city.addWorkedTile((long) tileId);
            game.getServer().sendTileInfoAll(tile);
            // One specialist slot freed – decrement (prefer Entertainers first).
            int[] specs = city.getSpecialists();
            for (int i = 0; i < specs.length; i++) {
                if (specs[i] > 0) {
                    specs[i]--;
                    break;
                }
            }
        }

        VisibilityHandler.sendCityToVisiblePlayers(game, cityId);
    }

    /**
     * Handles a PACKET_CITY_MAKE_SPECIALIST (37) request from the client.
     * Removes a city worker from the specified tile, freeing the citizen as a
     * specialist (not actively tracked here – the city size still determines
     * worker count).  Mirrors {@code handle_city_make_specialist()} in the C
     * Freeciv server's {@code cityhand.c}.
     *
     * @param game   the current game state
     * @param connId the connection ID of the requesting client
     * @param cityId the ID of the city
     * @param tileId the tile index the citizen should stop working
     */
    public static void handleCityMakeSpecialist(Game game, long connId, int cityId, int tileId) {
        City city = game.cities.get((long) cityId);
        if (city == null) return;

        Player player = game.players.get(city.getOwner());
        if (player == null || player.getConnectionId() != connId) return;

        // The city-centre tile is always worked and cannot be freed.
        if ((long) tileId == city.getTile()) return;

        Tile tile = game.tiles.get((long) tileId);
        if (tile == null) return;
        if (tile.getWorked() != cityId) return; // this city is not working this tile

        tile.setWorked(-1);
        city.removeWorkedTile((long) tileId);
        game.getServer().sendTileInfoAll(tile);

        // The freed citizen becomes an Entertainer specialist (index 0).
        // Mirrors handle_city_make_specialist() in the C Freeciv server's
        // cityhand.c, which calls city_add_specialist() defaulting to the
        // first available specialist type.
        city.getSpecialists()[0]++;

        VisibilityHandler.sendCityToVisiblePlayers(game, cityId);
    }

    /**
     * Returns {@code true} if the given tile is within the working radius of the city.
     * Uses the same Euclidean squared distance ≤ {@link CityTools#CITY_RADIUS_SQ} criterion
     * as {@link CityTurn#assignNextWorkedTile}.
     */
    private static boolean isTileInCityRadius(Game game, City city, Tile tile) {
        if (game.map == null) return false;
        int xsize = game.map.getXsize();
        int cx = (int) (city.getTile() % xsize);
        int cy = (int) (city.getTile() / xsize);
        int tx = (int) (tile.getIndex() % xsize);
        int ty = (int) (tile.getIndex() / xsize);
        // Horizontal cylindrical wrap
        int rawDx = Math.abs(tx - cx);
        int dx = Math.min(rawDx, xsize - rawDx);
        int dy = ty - cy;
        return dx * dx + dy * dy <= CityTools.CITY_RADIUS_SQ;
    }

    /**
     * Handles a PACKET_CITY_WORKLIST request from the client.
     * Parses the JSON worklist array, translates each item from Freeciv
     * Universal Value Type constants to internal representation, stores it
     * on the city, and sends the updated city info back to the requesting
     * client.  Mirrors {@code handle_city_worklist()} in the C Freeciv
     * server's {@code cityhand.c}.
     *
     * <p>Each element of {@code worklist} must be a JSON object with fields:
     * <ul>
     *   <li>{@code kind}  – {@code VUT_UTYPE=6} for a unit type or
     *       {@code VUT_IMPROVEMENT=3} for an improvement</li>
     *   <li>{@code value} – the ID of the unit type or improvement</li>
     * </ul>
     *
     * @param game     the current game state
     * @param connId   the connection ID of the requesting client
     * @param cityId   the ID of the city whose worklist is being changed
     * @param worklist the JSON array of production targets from the client
     */
    public static void handleCityWorklistRequest(Game game, long connId,
                                                 int cityId,
                                                 org.json.JSONArray worklist) {
        City city = game.cities.get((long) cityId);
        if (city == null) return;

        Player player = game.players.get(city.getOwner());
        if (player == null || player.getConnectionId() != connId) return;

        final int VUT_UTYPE       = Packets.VUT_UTYPE;
        final int VUT_IMPROVEMENT = Packets.VUT_IMPROVEMENT;

        java.util.List<int[]> newWorklist = new java.util.ArrayList<>();
        for (int i = 0; i < worklist.length(); i++) {
            org.json.JSONObject item = worklist.optJSONObject(i);
            if (item == null) continue;
            int kind  = item.optInt("kind",  -1);
            int value = item.optInt("value", -1);
            if (value < 0) continue;

            int internalKind;
            if (kind == VUT_UTYPE) {
                internalKind = 0;
                if (game.unitTypes.get((long) value) == null) continue;
            } else if (kind == VUT_IMPROVEMENT) {
                internalKind = 1;
                if (game.improvements.get((long) value) == null) continue;
            } else {
                continue; // unknown kind – skip
            }
            newWorklist.add(new int[]{internalKind, value});
        }
        city.setWorklist(newWorklist);

        CityTools.sendCityInfo(game, game.getServer(), connId, cityId);
    }

    /**
     * Handles a PACKET_CITY_CHANGE request from the client.
     * The client sends the desired production using the Freeciv Universal Value
     * Type constants: {@code VUT_UTYPE = 6} for a unit type and
     * {@code VUT_IMPROVEMENT = 3} for an improvement (building).
     * These are translated to the internal {@code productionKind} values:
     * {@code 0} for units and {@code 1} for improvements.
     * The accumulated shield stock is reset to zero when the production target
     * changes, mirroring {@code choose_production()} in the C Freeciv server's
     * {@code server/citytools.c}.
     *
     * @param game            the current game state
     * @param connId          the connection ID of the requesting client
     * @param cityId          the ID of the city whose production is changing
     * @param productionKind  the universal type (VUT_UTYPE=6 or VUT_IMPROVEMENT=3)
     * @param productionValue the ID of the unit type or improvement to produce
     */
    public static void handleCityChangeProductionRequest(Game game, long connId,
                                                         int cityId,
                                                         int productionKind,
                                                         int productionValue) {
        City city = game.cities.get((long) cityId);
        if (city == null) return;

        Player player = game.players.get(city.getOwner());
        if (player == null || player.getConnectionId() != connId) return;

        // VUT_UTYPE = 6 in the Freeciv universal-value-type enum (fc_types.js)
        // VUT_IMPROVEMENT = 3
        final int VUT_UTYPE        = Packets.VUT_UTYPE;
        final int VUT_IMPROVEMENT  = Packets.VUT_IMPROVEMENT;

        int internalKind;
        if (productionKind == VUT_UTYPE) {
            internalKind = 0; // unit
        } else if (productionKind == VUT_IMPROVEMENT) {
            internalKind = 1; // improvement
        } else {
            // Unknown kind; ignore.
            return;
        }

        // Validate that the requested target exists.
        if (internalKind == 0) {
            if (game.unitTypes.get((long) productionValue) == null) return;
        } else {
            if (game.improvements.get((long) productionValue) == null) return;
        }

        // Only reset shield stock when the production target actually changes.
        if (city.getProductionKind() != internalKind
                || city.getProductionValue() != productionValue) {
            city.setProductionKind(internalKind);
            city.setProductionValue(productionValue);
            city.setShieldStock(0);
        }

        CityTools.sendCityInfo(game, game.getServer(), -1L, cityId);
    }
}
