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
import net.freecivx.game.Unit;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

/**
 * Handles per-player tile visibility and fog of war.
 *
 * <p>Each player has two tile sets:
 * <ul>
 *   <li>{@code exploredTiles} – tiles the player has ever seen; these are
 *       rendered as fogged / {@code TILE_KNOWN_UNSEEN} when not currently
 *       in the player's field of view.</li>
 *   <li>{@code visibleTiles} – tiles currently within the vision radius of
 *       one of the player's units or cities; rendered as
 *       {@code TILE_KNOWN_SEEN}.</li>
 * </ul>
 *
 * <p>Mirrors {@code maphand.c} fog-of-war logic from the C Freeciv server
 * ({@code update_player_visibility()}, {@code tile_get_known()}).
 */
public class VisibilityHandler {

    /** Tile has never been seen by the player. Mirrors {@code TILE_UNKNOWN} in tile.js. */
    public static final int TILE_UNKNOWN = 0;

    /**
     * Tile has been explored but is not currently in the player's field of
     * view (fogged).  Mirrors {@code TILE_KNOWN_UNSEEN} in tile.js.
     */
    public static final int TILE_KNOWN_UNSEEN = 1;

    /**
     * Tile is currently within the player's field of view.
     * Mirrors {@code TILE_KNOWN_SEEN} in tile.js.
     */
    public static final int TILE_KNOWN_SEEN = 2;

    /**
     * Chebyshev vision radius for a standard land unit.
     * Mirrors {@code unit_vision_range()} returning 1 for most units in the C server.
     */
    static final int DEFAULT_VISION_RADIUS = 1;

    /**
     * Chebyshev vision radius for a city.
     * Cities see the same 5×5 workable-tile area (radius 2) that their
     * citizens can work, mirroring city_map_radius_sq_get() == 5 in the C
     * Freeciv server.
     */
    static final int CITY_VISION_RADIUS = 2;

    /**
     * Returns the tile visibility status for a specific player without modifying any state.
     * <ul>
     *   <li>{@link #TILE_KNOWN_SEEN} if the tile is in the player's visible set.</li>
     *   <li>{@link #TILE_KNOWN_UNSEEN} if the tile has been explored but is fogged.</li>
     *   <li>{@link #TILE_UNKNOWN} if the player has never seen this tile.</li>
     * </ul>
     *
     * @param player the player whose visibility is queried
     * @param tileId the tile index
     * @return TILE_UNKNOWN, TILE_KNOWN_UNSEEN, or TILE_KNOWN_SEEN
     */
    public static int getKnownForPlayer(Player player, long tileId) {
        if (player.getVisibleTiles().contains(tileId)) {
            return TILE_KNOWN_SEEN;
        }
        if (player.getExploredTiles().contains(tileId)) {
            return TILE_KNOWN_UNSEEN;
        }
        return TILE_UNKNOWN;
    }

    /**
     * Computes the complete set of tiles currently visible to {@code player}
     * based on all their units (vision radius {@value #DEFAULT_VISION_RADIUS})
     * and cities (vision radius {@value #CITY_VISION_RADIUS}).
     * Map wrapping on the X axis is handled correctly.
     *
     * @param player the player whose field of view is computed
     * @param game   the current game state
     * @return a new set of tile IDs that are currently visible
     */
    public static Set<Long> computeCurrentVisibleTiles(Player player, Game game) {
        Set<Long> visible = new HashSet<>();
        if (game.map == null) return visible;

        int xsize = game.map.getXsize();
        int ysize = game.map.getYsize();
        long totalTiles = (long) xsize * ysize;
        long playerId = player.getPlayerNo();

        // Units: vision radius 1
        for (Unit unit : game.units.values()) {
            if (unit.getOwner() != playerId) continue;
            addVisibleArea(visible, unit.getTile(), DEFAULT_VISION_RADIUS,
                    xsize, ysize, totalTiles);
        }

        // Cities: vision radius 2
        for (City city : game.cities.values()) {
            if (city.getOwner() != playerId) continue;
            addVisibleArea(visible, city.getTile(), CITY_VISION_RADIUS,
                    xsize, ysize, totalTiles);
        }

        return visible;
    }

    /**
     * Recomputes the player's field of view, updates their explored and
     * visible tile sets, and sends {@code PACKET_TILE_INFO} packets to the
     * player's client for every tile whose known status has changed.
     *
     * <p>AI players are skipped (they have no client connection to update).
     *
     * <p>Mirrors {@code update_player_visibility()} in the C Freeciv server's
     * {@code maphand.c}.
     *
     * @param player the player whose visibility should be refreshed
     * @param game   the current game state
     */
    public static void updateAndSendVisibility(Player player, Game game) {
        if (player.isAi()) return;

        Set<Long> newVisible = computeCurrentVisibleTiles(player, game);
        Set<Long> prevVisible = player.getVisibleTiles();

        // Tiles that just entered the player's field of view
        Set<Long> newlySeen = new HashSet<>(newVisible);
        newlySeen.removeAll(prevVisible);

        // Tiles that just left the player's field of view (become fogged)
        Set<Long> lostSight = new HashSet<>(prevVisible);
        lostSight.removeAll(newVisible);

        // Update explored (ever-seen) set – explored tiles are never removed
        player.getExploredTiles().addAll(newVisible);

        // Replace the current visible set
        player.setVisibleTiles(newVisible);

        long connId = player.getConnectionId();

        // Inform the client about newly revealed tiles
        for (long tileId : newlySeen) {
            sendTileToPlayer(game, connId, tileId, TILE_KNOWN_SEEN);
        }

        // Inform the client about tiles that have become fogged
        for (long tileId : lostSight) {
            sendTileToPlayer(game, connId, tileId, TILE_KNOWN_UNSEEN);
        }
    }

    /**
     * Sends a {@code PACKET_TILE_INFO} packet for a single tile to a specific
     * client, overriding the tile's known status with the supplied value.
     * Used internally to push visibility changes to individual players.
     *
     * @param game   the current game state
     * @param connId the target connection ID
     * @param tileId the tile to send
     * @param known  the known status to encode ({@link #TILE_UNKNOWN},
     *               {@link #TILE_KNOWN_UNSEEN}, or {@link #TILE_KNOWN_SEEN})
     */
    static void sendTileToPlayer(Game game, long connId, long tileId, int known) {
        Tile tile = game.tiles.get(tileId);
        if (tile == null) return;

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_TILE_INFO);
        msg.put("tile", tile.getIndex());
        msg.put("terrain", tile.getTerrain());
        msg.put("resource", tile.getResource());
        msg.put("extras", MapHand.extrasToByteArray(tile.getExtras()));
        msg.put("known", known);
        msg.put("height", tile.getHeight());
        msg.put("worked", tile.getWorked() >= 0 ? tile.getWorked() : JSONObject.NULL);
        msg.put("owner", tile.getOwner() >= 0 ? tile.getOwner() : JSONObject.NULL);
        game.getServer().sendPacket(connId, msg);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Adds every tile within Chebyshev {@code radius} of {@code centerTile}
     * to {@code visible}, handling X-axis map wrapping.
     */
    private static void addVisibleArea(Set<Long> visible, long centerTile,
                                        int radius, int xsize, int ysize,
                                        long totalTiles) {
        int cx = (int) (centerTile % xsize);
        int cy = (int) (centerTile / xsize);
        for (int dy = -radius; dy <= radius; dy++) {
            int ny = cy + dy;
            if (ny < 0 || ny >= ysize) continue;
            for (int dx = -radius; dx <= radius; dx++) {
                // Wrap X coordinate (east-west map wrapping)
                int nx = ((cx + dx) % xsize + xsize) % xsize;
                long tileId = (long) ny * xsize + nx;
                if (tileId >= 0 && tileId < totalTiles) {
                    visible.add(tileId);
                }
            }
        }
    }
}
