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
     * Builds a {@code PACKET_TILE_INFO} JSON object for the given tile and known
     * status.  When {@code known} is {@link VisibilityHandler#TILE_UNKNOWN}, all
     * sensitive tile fields (terrain, height, extras, etc.) are masked to neutral
     * values so the client renders the tile as solid black rather than leaking
     * real terrain information.
     *
     * @param tile  the tile to serialise
     * @param known the known status ({@code TILE_UNKNOWN}, {@code TILE_KNOWN_UNSEEN},
     *              or {@code TILE_KNOWN_SEEN})
     * @return a ready-to-send JSON packet
     */
    public static JSONObject buildTileInfoPacket(Tile tile, int known) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_TILE_INFO);
        msg.put("tile", tile.getIndex());
        msg.put("known", known);

        if (known == VisibilityHandler.TILE_UNKNOWN) {
            // Mask real tile data for unknown tiles so the client renders them as
            // solid black. Sending real terrain/height data would cause the shader
            // to override visibility and show unknown tiles as fogged terrain.
            msg.put("terrain", 0);
            msg.put("resource", -1);
            msg.put("extras", extrasToByteArray(0));
            msg.put("height", 0);
            msg.put("worked", JSONObject.NULL);
            msg.put("owner", JSONObject.NULL);
        } else {
            msg.put("terrain", tile.getTerrain());
            msg.put("resource", tile.getResource());
            msg.put("extras", extrasToByteArray(tile.getExtras()));
            msg.put("height", tile.getHeight());
            msg.put("worked", tile.getWorked() >= 0 ? tile.getWorked() : JSONObject.NULL);
            msg.put("owner", tile.getOwner() >= 0 ? tile.getOwner() : JSONObject.NULL);
        }

        return msg;
    }

    /**
     * Sends a PACKET_TILE_INFO packet for a single tile to the specified client.
     * The {@code known} field is computed from the player's per-player visibility
     * sets (explored / visible) so each player receives correct fog-of-war data.
     *
     * @param game   the current game state
     * @param connId the connection ID of the recipient client
     * @param tileId the ID (index) of the tile to send
     */
    public static void sendTileInfo(Game game, long connId, long tileId) {
        Tile tile = game.tiles.get(tileId);
        if (tile == null) return;

        Player player = game.players.get(connId);
        int known = (player != null)
                ? VisibilityHandler.getKnownForPlayer(player, tileId)
                : tile.getKnown();

        game.getServer().sendPacket(connId, buildTileInfoPacket(tile, known));
    }

    /**
     * Converts an extras bitvector (int) to a 16-byte JSON array matching the
     * format expected by the client's {@code BitVector} class.
     * The C Freeciv server sends {@code BV_EXTRAS} as a 16-byte array because
     * {@code MAX_EXTRA_TYPES = 128} (128 bits = 16 bytes). The JavaScript client
     * expects {@code tile.extras.raw} to be an {@code Array(16)}, so this method
     * produces the same encoding so {@code tile.extras.isSet(bitNum)} works
     * correctly for bits 0–127.
     *
     * @param extras the extras bitvector (bits 0–31 used; bits 32–127 are zero)
     * @return a JSONArray of 16 bytes (little-endian)
     */
    public static JSONArray extrasToByteArray(int extras) {
        JSONArray arr = new JSONArray();
        arr.put(extras & 0xFF);
        arr.put((extras >> 8) & 0xFF);
        arr.put((extras >> 16) & 0xFF);
        arr.put((extras >> 24) & 0xFF);
        // Pad to 16 bytes to match C Freeciv server BV_EXTRAS (MAX_EXTRA_TYPES=128 bits)
        for (int i = 4; i < 16; i++) {
            arr.put(0);
        }
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
