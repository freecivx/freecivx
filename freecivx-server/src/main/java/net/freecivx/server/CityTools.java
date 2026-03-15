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
import net.freecivx.game.Improvement;
import net.freecivx.game.Nation;
import net.freecivx.game.Player;
import net.freecivx.game.Tile;
import net.freecivx.game.Unit;
import net.freecivx.game.UnitType;
import org.json.JSONArray;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.atomic.AtomicLong;

/**
 * Utility methods for city management used across server handlers.
 * Mirrors the functionality of citytools.c in the C Freeciv server.
 * Provides functions for creating and removing cities, processing city
 * growth, sending city packets to clients, and supporting unit maintenance.
 */
public class CityTools {

    private static final Logger log = LoggerFactory.getLogger(CityTools.class);

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
        game.getServer().broadcastPacket(msg);

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
        game.getServer().broadcastPacket(msg);
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
     * Sends a PACKET_CITY_INFO packet for the specified city to a single client
     * or broadcasts it to all clients, followed by a PACKET_WEB_CITY_INFO_ADDITION
     * packet that includes the can_build_unit and can_build_improvement bitvectors
     * so the city dialog can show the correct production choices.
     *
     * @param game   the current game state
     * @param server the CivServer used to transmit the packet
     * @param connId the connection ID of the recipient; {@code -1} to broadcast to all
     * @param cityId the ID of the city whose info is to be sent
     */
    public static void sendCityInfo(Game game, CivServer server, long connId, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return;

        // Build improvements bitvector: bit N is set if improvement N is built.
        // The JS client decodes this as a BitVector where isSet(id) returns true
        // when the city has that improvement.  Improvements list IDs are the
        // ruleset-order IDs so each ID maps directly to a bit position.
        JSONArray improvBits = buildBitvector(city.getImprovements().stream()
                .mapToInt(Integer::intValue).toArray(), game.improvements.size());

        JSONArray ppl = new JSONArray();
        ppl.put(1); ppl.put(1); ppl.put(2); ppl.put(1); ppl.put(1);
        JSONArray prod = new JSONArray();
        prod.put(1); prod.put(1); prod.put(2); prod.put(1); prod.put(1); prod.put(1);

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_CITY_INFO);
        msg.put("id", cityId);
        msg.put("owner", city.getOwner());
        msg.put("tile", city.getTile());
        msg.put("original", city.getOwner());
        msg.put("name", city.getName());
        msg.put("size", city.getSize());
        msg.put("style", city.getStyle());
        msg.put("capital", city.isCapital());
        msg.put("occupied", city.isOccupied());
        msg.put("walls", city.getWalls());
        msg.put("happy", city.isHappy());
        msg.put("unhappy", city.isUnhappy());
        msg.put("improvements", improvBits);
        msg.put("production_kind", city.getProductionKind());
        // Translate -1 (internal "nothing queued" sentinel) to 0 for the network protocol.
        msg.put("production_value", Math.max(0, city.getProductionValue()));
        msg.put("shield_stock", city.getShieldStock());
        msg.put("food_stock", city.getFoodStock());
        msg.put("ppl_happy", ppl);
        msg.put("ppl_content", ppl);
        msg.put("ppl_unhappy", ppl);
        msg.put("ppl_angry", ppl);
        msg.put("surplus", prod);
        msg.put("prod", prod);
        msg.put("city_options", "");

        if (connId < 0) {
            server.broadcastPacket(msg);
        } else {
            server.sendPacket(connId, msg);
        }

        // Send the web city info addition packet so the city dialog shows
        // the correct list of available production choices.
        sendWebCityInfoAddition(game, server, connId, cityId);
    }

    /**
     * Sends a PACKET_WEB_CITY_INFO_ADDITION packet for the given city.
     * This follow-up packet provides the {@code can_build_unit} and
     * {@code can_build_improvement} bitvectors that the city dialog uses to
     * populate the production choice list.  Only units/improvements whose
     * tech prerequisites are met by the city owner are marked as buildable.
     *
     * @param game   the current game state
     * @param server the CivServer used to transmit the packet
     * @param connId the connection ID of the recipient; {@code -1} to broadcast to all
     * @param cityId the ID of the city
     */
    public static void sendWebCityInfoAddition(Game game, CivServer server,
                                               long connId, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return;

        Player player = game.players.get(city.getOwner());

        // Build can_build_unit bitvector: bit N is set when unit type N is
        // buildable by the city owner (tech prerequisite met).
        // Obsolete units (those that have been upgraded away) are excluded if
        // the player already has the technology for the upgraded replacement.
        int maxUnitId = game.unitTypes.keySet().stream()
                .mapToInt(Long::intValue).max().orElse(0);
        int[] buildableUnits = game.unitTypes.entrySet().stream()
                .filter(e -> {
                    UnitType ut = e.getValue();
                    long techReq = ut.getTechReqId();
                    boolean techMet = (player == null || techReq < 0
                            || player.hasTech(techReq));
                    // Exclude units that are obsoleted by an upgrade the player has.
                    boolean notObsolete = true;
                    int upgradesTo = ut.getUpgradesTo();
                    if (upgradesTo >= 0) {
                        UnitType upgrade = game.unitTypes.get((long) upgradesTo);
                        if (upgrade != null) {
                            long upgTech = upgrade.getTechReqId();
                            if (player != null && upgTech >= 0
                                    && player.hasTech(upgTech)) {
                                notObsolete = false;
                            }
                        }
                    }
                    return techMet && notObsolete;
                })
                .mapToInt(e -> e.getKey().intValue())
                .toArray();
        JSONArray canBuildUnit = buildBitvector(buildableUnits, maxUnitId + 1);

        // Build can_build_improvement bitvector: bit N is set when the city can
        // still build improvement N (tech met and not already built).
        int maxImprId = game.improvements.keySet().stream()
                .mapToInt(Long::intValue).max().orElse(0);
        int[] buildableImprovements = game.improvements.entrySet().stream()
                .filter(e -> {
                    Improvement impr = e.getValue();
                    long techReq = impr.getTechReqId();
                    boolean techMet = (player == null || techReq < 0
                            || player.hasTech(techReq));
                    boolean notBuilt = !city.hasImprovement(e.getKey().intValue());
                    return techMet && notBuilt;
                })
                .mapToInt(e -> e.getKey().intValue())
                .toArray();
        JSONArray canBuildImpr = buildBitvector(buildableImprovements, maxImprId + 1);

        // Granary size for city_info_addition
        int granarySize = CityTurn.cityGranarySize(city.getSize());

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_WEB_CITY_INFO_ADDITION);
        msg.put("id", cityId);
        msg.put("can_build_unit", canBuildUnit);
        msg.put("can_build_improvement", canBuildImpr);
        msg.put("granary_size", granarySize);
        msg.put("granary_turns", 0);
        msg.put("cma_enabled", false);

        if (connId < 0) {
            server.broadcastPacket(msg);
        } else {
            server.sendPacket(connId, msg);
        }
    }

    /**
     * Builds a bit-vector byte array from a list of set bit positions.
     * The returned JSONArray encodes each byte of the bitvector as an integer
     * (0–255).  The array is sized to hold at least {@code numBits} bits.
     * This matches the format expected by the client-side {@code BitVector}
     * class in {@code bitvector.js}.
     *
     * @param setBits array of bit positions that should be set to 1
     * @param numBits minimum number of bits the bitvector must cover
     * @return a JSONArray of bytes representing the bitvector
     */
    static JSONArray buildBitvector(int[] setBits, int numBits) {
        int numBytes = Math.max(1, (numBits + 7) / 8);
        byte[] bytes = new byte[numBytes];
        for (int bit : setBits) {
            if (bit >= 0 && bit < numBits) {
                bytes[bit / 8] |= (byte) (1 << (bit % 8));
            }
        }
        JSONArray arr = new JSONArray();
        for (byte b : bytes) {
            arr.put(b & 0xFF); // unsigned byte
        }
        return arr;
    }

    /**
     * Suggests a city name appropriate for the given player's nation.
     * Iterates through the nation's ordered city-name list (loaded from the
     * nation ruleset file) and returns the first name that has not yet been
     * used by any city in the game.  Falls back to a generic "City no. N"
     * pattern (matching the C server's fallback) if all nation names are taken.
     *
     * @param game     the current game state
     * @param playerId the ID of the player for whom to suggest a name
     * @return a suggested city name string
     */
    public static String suggestCityName(Game game, long playerId) {
        Player player = game.players.get(playerId);
        if (player == null) return "New City";

        // Build set of already-used city names for fast lookup.
        java.util.Set<String> usedNames = new java.util.HashSet<>();
        for (City c : game.cities.values()) {
            usedNames.add(c.getName());
        }

        Nation nation = game.nations.get((long) player.getNation());
        if (nation != null) {
            for (String candidate : nation.getCityNames()) {
                if (!usedNames.contains(candidate)) {
                    return candidate;
                }
            }
        }

        // Fallback: "City no. N" (mirrors the C server fallback).
        // Iterate until we find an unused name; the map can never have more
        // cities than tiles, so this will always terminate.
        for (int i = 1; i > 0; i++) {
            String fallback = "City no. " + i;
            if (!usedNames.contains(fallback)) {
                return fallback;
            }
        }
        return "New City";
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
        log.debug("City {} supports unit {}", cityId, unitId);
    }
}
