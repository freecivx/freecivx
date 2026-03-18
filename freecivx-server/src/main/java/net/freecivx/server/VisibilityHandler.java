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
import net.freecivx.game.UnitType;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Map;
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
     * Default unit vision radius squared, used when no unit-type data is
     * available.  Matches {@code vision_radius_sq = 2} for most land units in
     * the classic Freeciv ruleset (covers a 3×3 tile area).
     */
    static final int DEFAULT_VISION_RADIUS_SQ = 2;

    /**
     * City vision radius squared.
     * Mirrors {@code City_Vision_Radius_Sq = 5} from {@code effects.ruleset},
     * which equals {@code CITY_MAP_DEFAULT_RADIUS_SQ} in the C Freeciv server.
     * A tile at (dx, dy) is within city vision if dx² + dy² ≤ 5, producing a
     * diamond-shaped area of 21 tiles.
     */
    static final int CITY_VISION_RADIUS_SQ = 5;

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
     * based on all their units (per-unit-type {@code vision_radius_sq} from the
     * ruleset) and cities (vision radius squared {@value #CITY_VISION_RADIUS_SQ}).
     * Uses Euclidean distance squared to match the C Freeciv server
     * ({@code real_map_distance_sq()} in {@code common/map.c}).
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

        // Units: use per-unit-type vision_radius_sq from the ruleset
        for (Unit unit : game.units.values()) {
            if (unit.getOwner() != playerId) continue;
            UnitType utype = game.unitTypes.get((long) unit.getType());
            int radiusSq = (utype != null) ? utype.getVisionRadiusSq() : DEFAULT_VISION_RADIUS_SQ;
            addVisibleArea(visible, unit.getTile(), radiusSq,
                    xsize, ysize, totalTiles);
        }

        // Cities: vision_radius_sq = 5 (City_Vision_Radius_Sq from effects.ruleset)
        for (City city : game.cities.values()) {
            if (city.getOwner() != playerId) continue;
            addVisibleArea(visible, city.getTile(), CITY_VISION_RADIUS_SQ,
                    xsize, ysize, totalTiles);
        }

        return visible;
    }

    /**
     * Reveals the entire map to all human players by sending every tile as
     * {@link #TILE_KNOWN_SEEN}, updating each player's explored and visible
     * tile sets accordingly.  Also sends all foreign units and cities on
     * newly revealed tiles so the client displays complete information.
     *
     * <p>Called when the game ends (e.g. turn limit reached) to show the full
     * map to everyone, mirroring the C Freeciv server's
     * {@code map_know_and_see_all()} in {@code maphand.c}.
     *
     * @param game the current game state
     */
    public static void revealMapToAll(Game game) {
        if (game.map == null) return;
        int xsize = game.map.getXsize();
        int ysize = game.map.getYsize();
        long totalTiles = (long) xsize * ysize;

        for (Player player : game.players.values()) {
            if (player.isAi()) continue;

            long connId = player.getConnectionId();
            long ownPlayerId = player.getPlayerNo();

            for (long tileId = 0; tileId < totalTiles; tileId++) {
                player.getExploredTiles().add(tileId);
                player.getVisibleTiles().add(tileId);
                sendTileToPlayer(game, connId, tileId, TILE_KNOWN_SEEN);
                sendForeignEntitiesOnTile(game, connId, ownPlayerId, tileId);
            }
        }
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
        long ownPlayerId = player.getPlayerNo();

        // Inform the client about newly revealed tiles and any foreign
        // units/cities that are now visible on those tiles.
        for (long tileId : newlySeen) {
            sendTileToPlayer(game, connId, tileId, TILE_KNOWN_SEEN);
            sendForeignEntitiesOnTile(game, connId, ownPlayerId, tileId);
        }

        // Inform the client about tiles that have become fogged and remove
        // any foreign units/cities that are no longer visible.
        for (long tileId : lostSight) {
            sendTileToPlayer(game, connId, tileId, TILE_KNOWN_UNSEEN);
            removeForeignEntitiesFromTile(game, connId, ownPlayerId, tileId);
        }
    }

    /**
     * Sends a unit to all human players who can currently see the unit's tile,
     * plus always to the unit's owner.  Replaces unconditional broadcasts so
     * that players never receive information about foreign units on tiles they
     * cannot see.
     *
     * @param game the current game state
     * @param unit the unit to distribute
     */
    public static void sendUnitToVisiblePlayers(Game game, Unit unit) {
        JSONObject msg = buildUnitShortInfoPacket(unit);
        long unitTile = unit.getTile();
        long ownerPlayerId = unit.getOwner();
        for (Player p : game.players.values()) {
            if (p.isAi()) continue;
            if (p.getPlayerNo() == ownerPlayerId
                    || p.getVisibleTiles().contains(unitTile)) {
                game.getServer().sendPacket(p.getConnectionId(), msg);
            }
        }
    }

    /**
     * Sends city information to all human players who can currently see the
     * city's tile, plus always to the city's owner.  Replaces unconditional
     * broadcasts so that players never receive information about foreign cities
     * on tiles they cannot see.
     *
     * @param game   the current game state
     * @param cityId the ID of the city to distribute
     */
    public static void sendCityToVisiblePlayers(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return;
        long cityTile = city.getTile();
        long ownerPlayerId = city.getOwner();
        for (Player p : game.players.values()) {
            if (p.isAi()) continue;
            if (p.getPlayerNo() == ownerPlayerId
                    || p.getVisibleTiles().contains(cityTile)) {
                CityTools.sendCityInfo(game, game.getServer(), p.getConnectionId(), cityId);
            }
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

        game.getServer().sendPacket(connId, MapHand.buildTileInfoPacket(tile, known));
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Sends {@code PACKET_UNIT_SHORT_INFO} and city-info packets to {@code connId}
     * for every foreign unit and city currently standing on {@code tileId}.
     * Called when a tile enters the player's field of view.
     *
     * @param game        the current game state
     * @param connId      the connection to send to
     * @param ownPlayerId the observing player's ID (used to skip own entities)
     * @param tileId      the newly visible tile
     */
    private static void sendForeignEntitiesOnTile(Game game, long connId,
                                                   long ownPlayerId, long tileId) {
        for (Unit unit : game.units.values()) {
            if (unit.getTile() == tileId && unit.getOwner() != ownPlayerId) {
                game.getServer().sendPacket(connId, buildUnitShortInfoPacket(unit));
            }
        }
        for (Map.Entry<Long, City> entry : game.cities.entrySet()) {
            City city = entry.getValue();
            if (city.getTile() == tileId && city.getOwner() != ownPlayerId) {
                CityTools.sendCityInfo(game, game.getServer(), connId, entry.getKey());
            }
        }
    }

    /**
     * Sends {@code PACKET_UNIT_REMOVE} and city-remove packets to {@code connId}
     * for every foreign unit and city currently standing on {@code tileId}.
     * Called when a tile leaves the player's field of view (becomes fogged).
     *
     * @param game        the current game state
     * @param connId      the connection to send to
     * @param ownPlayerId the observing player's ID (used to skip own entities)
     * @param tileId      the newly fogged tile
     */
    private static void removeForeignEntitiesFromTile(Game game, long connId,
                                                       long ownPlayerId, long tileId) {
        for (Unit unit : game.units.values()) {
            if (unit.getTile() == tileId && unit.getOwner() != ownPlayerId) {
                JSONObject msg = new JSONObject();
                msg.put("pid", Packets.PACKET_UNIT_REMOVE);
                msg.put("unit_id", unit.getId());
                game.getServer().sendPacket(connId, msg);
            }
        }
        for (Map.Entry<Long, City> entry : game.cities.entrySet()) {
            City city = entry.getValue();
            if (city.getTile() == tileId && city.getOwner() != ownPlayerId) {
                CityTools.removeCityFromPlayer(game, game.getServer(), connId, entry.getKey());
            }
        }
    }

    /**
     * Builds a {@code PACKET_UNIT_SHORT_INFO} JSON packet for the given unit
     * without sending it.  Used by both {@link #sendUnitToVisiblePlayers} and
     * {@link #sendForeignEntitiesOnTile}.
     *
     * @param unit the unit to serialise
     * @return the JSON packet ready to be dispatched
     */
    static JSONObject buildUnitShortInfoPacket(Unit unit) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_UNIT_SHORT_INFO);
        msg.put("id", unit.getId());
        msg.put("owner", unit.getOwner());
        msg.put("tile", unit.getTile());
        msg.put("type", unit.getType());
        msg.put("facing", unit.getFacing());
        msg.put("veteran", unit.getVeteran());
        msg.put("hp", unit.getHp());
        msg.put("activity", unit.getActivity());
        msg.put("movesleft", unit.getMovesleft());
        msg.put("done_moving", unit.isDoneMoving());
        msg.put("transported", unit.isTransported());
        msg.put("ssa_controller", unit.getSsa_controller());
        return msg;
    }

    /**
     * Adds every tile within Euclidean distance squared {@code radiusSq} of
     * {@code centerTile} to {@code visible}, handling X-axis map wrapping.
     * A tile at offset (dx, dy) is included if dx² + dy² ≤ radiusSq,
     * mirroring the {@code real_map_distance_sq()} check in the C Freeciv
     * server's {@code common/map.c}.
     */
    private static void addVisibleArea(Set<Long> visible, long centerTile,
                                        int radiusSq, int xsize, int ysize,
                                        long totalTiles) {
        int cx = (int) (centerTile % xsize);
        int cy = (int) (centerTile / xsize);
        int maxR = (int) Math.sqrt(radiusSq);
        for (int dy = -maxR; dy <= maxR; dy++) {
            int ny = cy + dy;
            if (ny < 0 || ny >= ysize) continue;
            for (int dx = -maxR; dx <= maxR; dx++) {
                if (dx * dx + dy * dy > radiusSq) continue;
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
