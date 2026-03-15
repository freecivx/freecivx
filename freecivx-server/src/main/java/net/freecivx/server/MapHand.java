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
import net.freecivx.game.Tile;
import net.freecivx.game.WorldMap;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Handles map data requests from clients and broadcasts map state.
 * Mirrors the functionality of maphand.c in the C Freeciv server.
 * Responsible for sending tile information, responding to map ping
 * requests, and synchronising the city-surrounding tile visibility.
 */
public class MapHand {

    /**
     * Sends a PACKET_TILE_INFO packet for a single tile to the specified client.
     * Includes terrain, resource, extras, height, and known/fog-of-war status.
     *
     * @param game   the current game state
     * @param connId the connection ID of the recipient client
     * @param tileId the ID (index) of the tile to send
     */
    public static void sendTileInfo(Game game, long connId, long tileId) {
        Tile tile = game.tiles.get(tileId);
        if (tile == null) return;

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_TILE_INFO);
        msg.put("tile", tile.getIndex());
        msg.put("terrain", tile.getTerrain());
        msg.put("resource", tile.getResource());
        msg.put("extras", extrasToByteArray(tile.getExtras()));
        msg.put("known", tile.getKnown());
        msg.put("height", tile.getHeight());
        msg.put("worked", tile.getWorked() >= 0 ? tile.getWorked() : JSONObject.NULL);
        msg.put("owner", tile.getOwner() >= 0 ? tile.getOwner() : JSONObject.NULL);
        game.getServer().sendMessage(connId, msg.toString());
    }

    /**
     * Converts an extras bitvector (int) to a 4-byte JSON array matching the
     * format expected by the client's {@code BitVector} class.
     * The C Freeciv server sends {@code BV_EXTRAS} as a byte array; this method
     * produces the same encoding so {@code tile.extras.isSet(bitNum)} works
     * correctly for bits 0–31.
     *
     * @param extras the extras bitvector
     * @return a JSONArray of 4 bytes (little-endian)
     */
    public static JSONArray extrasToByteArray(int extras) {
        JSONArray arr = new JSONArray();
        arr.put(extras & 0xFF);
        arr.put((extras >> 8) & 0xFF);
        arr.put((extras >> 16) & 0xFF);
        arr.put((extras >> 24) & 0xFF);
        return arr;
    }

    /**
     * Sends a PACKET_MAP_INFO packet followed by PACKET_TILE_INFO packets for
     * all tiles in the world map to the specified client.
     * Used during initial synchronisation after a player joins.
     *
     * @param game   the current game state
     * @param connId the connection ID of the recipient client
     */
    public static void sendMapInfo(Game game, long connId) {
        WorldMap map = game.map;
        if (map == null) return;

        game.getServer().sendMapInfoAll(map.getXsize(), map.getYsize());

        for (Tile tile : game.tiles.values()) {
            sendTileInfo(game, connId, tile.getIndex());
        }
    }

    /**
     * Handles a map-ping request from a client.
     * The client sends the (x, y) coordinate it wants to reveal or centre on;
     * the server responds with the tile info for that coordinate.
     *
     * @param game   the current game state
     * @param connId the connection ID of the requesting client
     * @param tileX  the x-coordinate of the requested tile
     * @param tileY  the y-coordinate of the requested tile
     */
    public static void handleMapPingReq(Game game, long connId, int tileX, int tileY) {
        WorldMap map = game.map;
        if (map == null) return;

        long tileId = (long) tileY * map.getXsize() + tileX;
        sendTileInfo(game, connId, tileId);
    }

    /**
     * Sends tile info for all tiles surrounding the given city to the client.
     * Used to update the city-radius visibility when a city is first seen or
     * when its borders change.
     *
     * @param game   the current game state
     * @param connId the connection ID of the recipient client
     * @param cityId the ID of the city whose surrounding tiles should be sent
     */
    public static void sendCityTileInfo(Game game, long connId, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null || game.map == null) return;

        long centerTile = city.getTile();
        int xsize = game.map.getXsize();

        // Send the centre tile and the first ring of adjacent tiles
        sendTileInfo(game, connId, centerTile);
        for (int dx = -2; dx <= 2; dx++) {
            for (int dy = -2; dy <= 2; dy++) {
                if (dx == 0 && dy == 0) continue;
                long adjTile = centerTile + dy * xsize + dx;
                if (adjTile >= 0 && adjTile < game.tiles.size()) {
                    sendTileInfo(game, connId, adjTile);
                }
            }
        }
    }
}
