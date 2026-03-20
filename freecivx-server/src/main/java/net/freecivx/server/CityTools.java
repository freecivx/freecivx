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
import net.freecivx.game.CmParameter;
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
     * Food consumed per citizen per turn (classic ruleset: RS_DEFAULT_FOOD_COST=2).
     * Mirrors {@code game.info.food_cost} in the C Freeciv server.
     */
    static final int FOOD_UPKEEP_PER_CITIZEN = 2;

    /**
     * Shield upkeep per improvement per turn (classic ruleset: 1 shield/turn per building).
     * Mirrors the base upkeep in the C Freeciv server's effects.ruleset.
     */
    static final int SHIELD_UPKEEP_PER_IMPROVEMENT = 1;

    /**
     * Classic Freeciv city working radius in squared Euclidean distance units.
     * Mirrors {@code RS_DEFAULT_CITY_RADIUS_SQ = 5} from the C Freeciv server's
     * {@code common/game.h}.  A radius_sq of 5 covers the 21 tiles within
     * Euclidean distance sqrt(5) of the city centre (the standard "city 2" ring).
     * This value is sent as {@code city_radius_sq} in PACKET_CITY_INFO and is
     * also used by the JS client to index the {@code output_food/shield/trade}
     * arrays from PACKET_WEB_CITY_INFO_ADDITION.
     */
    public static final int CITY_RADIUS_SQ = 5;

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

        // Mark the city-centre tile as worked and add it to the worked-tile list.
        // Mirrors city_map_update_all() / citytools.c in the C Freeciv server.
        tile.setWorked(cityId);
        city.addWorkedTile(tileId);

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
     * Sends a city-remove packet for the given city to a single client connection.
     * Used when a city's tile leaves the observing player's field of view so that
     * the client can hide the city until it becomes visible again.
     *
     * <p>This method does <em>not</em> remove the city from the server game state;
     * use {@link #removeCity} for that.
     *
     * @param game   the current game state
     * @param server the server used to transmit the packet
     * @param connId the connection ID of the recipient
     * @param cityId the ID of the city to remove from the client's view
     */
    public static void removeCityFromPlayer(Game game, IGameServer server, long connId, long cityId) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_CITY_INFO);
        msg.put("id", cityId);
        msg.put("remove", true);
        server.sendPacket(connId, msg);
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

        // Assign the best available adjacent tile to the new citizen.
        // Mirrors city_auto_arrange_workers() / assignNextWorkedTile in the C Freeciv server.
        CityTurn.assignNextWorkedTile(game, cityId);

        VisibilityHandler.sendCityToVisiblePlayers(game, cityId);
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
    public static void sendCityInfo(Game game, IGameServer server, long connId, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return;

        // Build improvements bitvector: bit N is set if improvement N is built.
        // The JS client decodes this as a BitVector where isSet(id) returns true
        // when the city has that improvement.  Improvements list IDs are the
        // ruleset-order IDs so each ID maps directly to a bit position.
        JSONArray improvBits = buildBitvector(city.getImprovements().stream()
                .mapToInt(Integer::intValue).toArray(), game.improvements.size());

        // Compute real city output values from game state.
        // prod[O_FOOD=0]    – food produced this turn by worked tiles
        // prod[O_SHIELD=1]  – shields produced this turn by worked tiles
        // prod[O_TRADE=2]   – trade arrows produced this turn by worked tiles
        // prod[O_GOLD=3]    – gold (tax) produced this turn
        // prod[O_LUXURY=4]  – luxury goods produced this turn
        // prod[O_SCIENCE=5] – science bulbs produced this turn
        int[] tileOutput = computeCityTileOutput(game, city);
        int foodProd    = tileOutput[0];
        int shieldProd  = tileOutput[1];
        int tradeProd   = tileOutput[2];
        int goldProd    = CityTurn.cityTaxContribution(game, cityId);
        int luxuryProd  = CityTurn.cityLuxuryContribution(game, cityId);
        int scienceProd = CityTurn.cityScienceContribution(game, cityId);

        // surplus[O_FOOD]   = food – (size × FOOD_UPKEEP_PER_CITIZEN)
        // surplus[O_SHIELD] = shields – (improvements × SHIELD_UPKEEP_PER_IMPROVEMENT)
        // surplus[O_TRADE … O_SCIENCE] = same as prod (no upkeep)
        int foodUpkeep   = city.getSize() * FOOD_UPKEEP_PER_CITIZEN;
        int shieldUpkeep = city.getImprovements().size() * SHIELD_UPKEEP_PER_IMPROVEMENT;
        int foodSurplus    = foodProd - foodUpkeep;
        int shieldSurplus  = shieldProd - shieldUpkeep;

        JSONArray prod = new JSONArray();
        prod.put(foodProd);
        prod.put(shieldProd);
        prod.put(tradeProd);
        prod.put(goldProd);
        prod.put(luxuryProd);
        prod.put(scienceProd);

        JSONArray surplus = new JSONArray();
        surplus.put(foodSurplus);
        surplus.put(shieldSurplus);
        surplus.put(tradeProd);
        surplus.put(goldProd);
        surplus.put(luxuryProd);
        surplus.put(scienceProd);

        // Build per-type people arrays for all 6 feeling stages (FEELING_BASE=0 …
        // FEELING_FINAL=5).  The client's city_unhappy() / city_happy() functions
        // read index 5 (FEELING_FINAL); sending only 5 elements causes a
        // "Cannot read properties of undefined (reading '5')" crash.
        // Indices 0–4 are intermediate stages; use 0 as a safe placeholder.
        // Index 5 is derived from the city's computed happy/unhappy state.
        //
        // Specialists are citizens not working any tile.  They are displayed as
        // separate specialist icons in the city dialog, so the ppl_* counts must
        // only cover tile-working citizens (numWorkers).  This mirrors the C
        // Freeciv server where ppl_* arrays count only non-specialist citizens.
        int citySize        = city.getSize();
        int numWorkers      = city.getWorkedTiles().size();
        // Clamp to valid range: workers cannot exceed city size.
        numWorkers = Math.min(numWorkers, citySize);
        boolean cityHappy   = city.isHappy();
        boolean cityUnhappy = city.isUnhappy();

        JSONArray pplHappy = new JSONArray();
        for (int i = 0; i < 5; i++) pplHappy.put(0);
        pplHappy.put(cityHappy ? numWorkers : 0);

        JSONArray pplContent = new JSONArray();
        for (int i = 0; i < 5; i++) pplContent.put(numWorkers);
        pplContent.put((!cityHappy && !cityUnhappy) ? numWorkers : 0);

        JSONArray pplUnhappy = new JSONArray();
        for (int i = 0; i < 5; i++) pplUnhappy.put(0);
        // Send 1 unhappy citizen when city is in disorder; 0 otherwise.
        // The value "1" is not a worker count – it satisfies the JS city_unhappy()
        // check (ppl_happy[5] < ppl_unhappy[5] + 2*ppl_angry[5]) when the server
        // has already determined the city is unhappy.  Specialists are displayed
        // separately and are not included in ppl_unhappy.
        pplUnhappy.put(cityUnhappy ? 1 : 0);

        JSONArray pplAngry = new JSONArray();
        for (int i = 0; i < 6; i++) pplAngry.put(0);

        // Build the specialists JSON array.
        // The client reads pcity['specialists'][u] for each of the SP_MAX=3 types:
        //   0 = Entertainer, 1 = Taxman, 2 = Scientist.
        // Mirrors the specialists[] array in PACKET_CITY_INFO from the C Freeciv server.
        // specialists_size is the number of specialist types (always 3 in classic rules).
        int[] specCounts = city.getSpecialists();
        JSONArray specialistsArr = new JSONArray();
        for (int sc : specCounts) {
            specialistsArr.put(sc);
        }

        // Translate internal production kind to Freeciv Universal Value Type constants
        // used by the network protocol.  The server stores kind as 0 (unit) or 1
        // (improvement) internally; the client expects VUT_UTYPE=6 or VUT_IMPROVEMENT=3.
        // Mirrors the universals_n enum in the C Freeciv source (fc_types.h).
        int networkProductionKind = (city.getProductionKind() == 0)
                ? Packets.VUT_UTYPE : Packets.VUT_IMPROVEMENT;

        // Compute the gold cost to rush-buy the current production item.
        // Mirrors city_buy_cost() in the C Freeciv server's common/city.c:
        // buy_cost = remaining_shields * 2 (simplified formula for classic ruleset).
        // This is displayed as "cost" in the city worklist dialog on the client.
        int buyCost = 0;
        int productionValue = city.getProductionValue();
        if (productionValue >= 0) {
            int totalCost = 0;
            if (city.getProductionKind() == 0) {
                // Unit production
                UnitType utype = game.unitTypes.get((long) productionValue);
                if (utype != null) {
                    totalCost = CivServer.computeUnitBuildCost(utype);
                }
            } else {
                // Improvement production
                Improvement impr = game.improvements.get((long) productionValue);
                if (impr != null) {
                    totalCost = impr.getBuildCost();
                }
            }
            int remaining = Math.max(0, totalCost - city.getShieldStock());
            buyCost = remaining * 2;
        }

        // Build the worklist JSON array.  Each item is translated from the internal
        // representation ({kind: 0/1, value: id}) to the VUT constants expected by
        // the client ({kind: 6 or 3, value: id}).
        JSONArray worklistArr = new JSONArray();
        for (int[] item : city.getWorklist()) {
            JSONObject wItem = new JSONObject();
            wItem.put("kind",  (item[0] == 0) ? Packets.VUT_UTYPE : Packets.VUT_IMPROVEMENT);
            wItem.put("value", item[1]);
            worklistArr.put(wItem);
        }

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
        msg.put("production_kind", networkProductionKind);
        // Translate -1 (internal "nothing queued" sentinel) to 0 for the network protocol.
        msg.put("production_value", Math.max(0, city.getProductionValue()));
        msg.put("shield_stock", city.getShieldStock());
        msg.put("food_stock", city.getFoodStock());
        msg.put("buy_cost", buyCost);
        msg.put("ppl_happy", pplHappy);
        msg.put("ppl_content", pplContent);
        msg.put("ppl_unhappy", pplUnhappy);
        msg.put("ppl_angry", pplAngry);
        msg.put("specialists", specialistsArr);
        msg.put("specialists_size", specCounts.length);
        msg.put("surplus", surplus);
        msg.put("prod", prod);
        msg.put("worklist", worklistArr);
        msg.put("city_options", "");
        // Classic Freeciv city working radius (squared Euclidean distance).
        // RS_DEFAULT_CITY_RADIUS_SQ = 5: covers all tiles within sqrt(5) of the centre,
        // matching the 21-tile working area used by assignNextWorkedTile() and the
        // output_food/shield/trade arrays sent in PACKET_WEB_CITY_INFO_ADDITION.
        msg.put("city_radius_sq", CITY_RADIUS_SQ);

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
     * Computes the total food, shield and trade output of a city by summing
     * {@link CityTurn#getTileOutput} over all worked tiles.  The city-centre tile
     * is always worked first; additional tiles are those recorded in
     * {@link City#getWorkedTiles()}.
     *
     * @param game the current game state
     * @param city the city to evaluate
     * @return {@code int[]{food, shield, trade}} produced by the city this turn
     */
    static int[] computeCityTileOutput(Game game, City city) {
        int food = 0, shield = 0, trade = 0;
        java.util.List<Long> worked = city.getWorkedTiles();
        if (worked.isEmpty()) {
            // Fallback: use centre tile only (no worked tiles assigned yet, e.g. city just founded)
            Tile centre = game.tiles.get(city.getTile());
            if (centre != null) {
                int[] out = CityTurn.getTileOutput(game, centre, true);
                return new int[]{out[0], out[1], out[2]};
            }
            // No tile data available; return the minimum viable output (1 food to prevent starvation)
            return new int[]{FOOD_UPKEEP_PER_CITIZEN, 0, 0};
        }
        for (int i = 0; i < worked.size(); i++) {
            Tile t = game.tiles.get(worked.get(i));
            if (t == null) continue;
            boolean isCentre = (i == 0);
            int[] out = CityTurn.getTileOutput(game, t, isCentre);
            food   += out[0];
            shield += out[1];
            trade  += out[2];
        }
        return new int[]{food, shield, trade};
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
    public static void sendWebCityInfoAddition(Game game, IGameServer server,
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
        // still build improvement N (tech met, not already built, building
        // prerequisite satisfied, and any terrain requirement met).
        // Mirrors can_city_build_improvement_direct() in the C Freeciv server's
        // common/city.c.
        int maxImprId = game.improvements.keySet().stream()
                .mapToInt(Long::intValue).max().orElse(0);
        int[] buildableImprovements = game.improvements.entrySet().stream()
                .filter(e -> {
                    Improvement impr = e.getValue();
                    long techReq = impr.getTechReqId();
                    boolean techMet = (player == null || techReq < 0
                            || player.hasTech(techReq));
                    boolean notBuilt = !city.hasImprovement(e.getKey().intValue());
                    // Check city-building prerequisite (e.g. Cathedral requires Temple).
                    String reqBldgName = impr.getRequiredBuildingName();
                    boolean buildingPrereqMet = (reqBldgName == null || reqBldgName.isEmpty()
                            || CityTurn.cityHasImprovementByName(game, city, reqBldgName));
                    // Check coastal requirement (e.g. Harbor requires adjacent ocean tile).
                    boolean coastalReqMet = (!impr.isRequiresCoastal()
                            || isCityCoastal(game, city));
                    return techMet && notBuilt && buildingPrereqMet && coastalReqMet;
                })
                .mapToInt(e -> e.getKey().intValue())
                .toArray();
        JSONArray canBuildImpr = buildBitvector(buildableImprovements, maxImprId + 1);

        // Granary size for city_info_addition
        int granarySize = CityTurn.cityGranarySize(city.getSize());

        // Compute per-tile output arrays for the city's working radius.
        // These are indexed in the same tile-map order as the JS client uses in
        // get_city_dxy_to_index(): tiles sorted first by Euclidean squared distance,
        // then by dx, then by dy, for all tiles where dx^2+dy^2 <= CITY_RADIUS_SQ.
        // Matches PACKET_WEB_CITY_INFO_ADDITION fields output_food/shield/trade[MAX_CITY_TILES+1].
        int[] outputFood   = buildCityTileOutputArray(game, city, 0);
        int[] outputShield = buildCityTileOutputArray(game, city, 1);
        int[] outputTrade  = buildCityTileOutputArray(game, city, 2);
        JSONArray outFoodArr   = new JSONArray();
        JSONArray outShieldArr = new JSONArray();
        JSONArray outTradeArr  = new JSONArray();
        for (int v : outputFood)   outFoodArr.put(v);
        for (int v : outputShield) outShieldArr.put(v);
        for (int v : outputTrade)  outTradeArr.put(v);

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_WEB_CITY_INFO_ADDITION);
        msg.put("id", cityId);
        msg.put("can_build_unit", canBuildUnit);
        msg.put("can_build_improvement", canBuildImpr);
        msg.put("granary_size", granarySize);
        msg.put("granary_turns", 0);

        // Send CMA state: enabled flag + parameter object so the client governor tab
        // shows the correct UI state.  Mirrors cm_parameter fields from packets.def.
        CmParameter cma = city.getCmParameter();
        boolean cmaEnabled = (cma != null);
        msg.put("cma_enabled", cmaEnabled);
        if (cmaEnabled) {
            JSONObject cmParam = new JSONObject();
            JSONArray factorArr = new JSONArray();
            JSONArray surplusArr = new JSONArray();
            for (int i = 0; i < 6; i++) {
                factorArr.put(cma.getFactor()[i]);
                surplusArr.put(cma.getMinimalSurplus()[i]);
            }
            cmParam.put("factor", factorArr);
            cmParam.put("minimal_surplus", surplusArr);
            cmParam.put("require_happy", cma.isRequireHappy());
            cmParam.put("allow_disorder", cma.isAllowDisorder());
            cmParam.put("allow_specialists", cma.isAllowSpecialists());
            cmParam.put("happy_factor", cma.getHappyFactor());
            cmParam.put("max_growth", cma.isMaxGrowth());
            msg.put("cm_parameter", cmParam);
        } else {
            // Always include a default cm_parameter so the client doesn't reject the city
            // (show_city_governor_tab() checks for existence of cm_parameter).
            JSONObject cmParam = new JSONObject();
            JSONArray factorArr = new JSONArray();
            JSONArray surplusArr = new JSONArray();
            for (int i = 0; i < 6; i++) {
                factorArr.put(0);
                surplusArr.put(0);
            }
            cmParam.put("factor", factorArr);
            cmParam.put("minimal_surplus", surplusArr);
            cmParam.put("require_happy", false);
            cmParam.put("allow_disorder", false);
            cmParam.put("allow_specialists", true);
            cmParam.put("happy_factor", 0);
            cmParam.put("max_growth", false);
            msg.put("cm_parameter", cmParam);
        }
        msg.put("output_food",   outFoodArr);
        msg.put("output_shield", outShieldArr);
        msg.put("output_trade",  outTradeArr);

        if (connId < 0) {
            server.broadcastPacket(msg);
        } else {
            server.sendPacket(connId, msg);
        }
    }

    /**
     * Builds a per-tile output array for the city's working radius, indexed in the same
     * tile-map order used by the JavaScript client's {@code get_city_dxy_to_index()}.
     * Tiles are sorted by Euclidean squared distance from the city centre, then by dx,
     * then by dy, for all (dx,dy) where dx²+dy² ≤ {@link #CITY_RADIUS_SQ}.
     * Matches the {@code output_food/shield/trade[MAX_CITY_TILES+1]} arrays in
     * {@code PACKET_WEB_CITY_INFO_ADDITION} (packets.def).
     *
     * @param game      the current game state
     * @param city      the city to evaluate
     * @param outputIdx 0=food, 1=shield, 2=trade
     * @return an int array of per-tile output values in tile-map sorted order
     */
    static int[] buildCityTileOutputArray(Game game, City city, int outputIdx) {
        if (game.map == null) return new int[0];
        int xsize = game.map.getXsize();
        int ysize = game.map.getYsize();
        long centerTile = city.getTile();
        int cx = (int) (centerTile % xsize);
        int cy = (int) (centerTile / xsize);

        // Collect all (dx, dy) pairs within CITY_RADIUS_SQ sorted by (d_sq, dx, dy).
        // Mirrors build_city_tile_map() in models/city.js.
        int r = (int) Math.floor(Math.sqrt(CITY_RADIUS_SQ));
        java.util.List<int[]> tiles = new java.util.ArrayList<>();
        for (int dx = -r; dx <= r; dx++) {
            for (int dy = -r; dy <= r; dy++) {
                int dSq = dx * dx + dy * dy;
                if (dSq <= CITY_RADIUS_SQ) {
                    tiles.add(new int[]{dx, dy, dSq});
                }
            }
        }
        tiles.sort((a, b) -> {
            int c = Integer.compare(a[2], b[2]);
            if (c != 0) return c;
            c = Integer.compare(a[0], b[0]);
            if (c != 0) return c;
            return Integer.compare(a[1], b[1]);
        });

        int[] result = new int[tiles.size()];
        for (int i = 0; i < tiles.size(); i++) {
            int dx = tiles.get(i)[0];
            int dy = tiles.get(i)[1];
            // Cylindrical (horizontal) wrap only – mirrors the JS map wrapping.
            int nx = ((cx + dx) % xsize + xsize) % xsize;
            int ny = cy + dy;
            if (ny < 0 || ny >= ysize) {
                result[i] = 0;
                continue;
            }
            long tileId = (long) ny * xsize + nx;
            Tile t = game.tiles.get(tileId);
            boolean isCentre = (dx == 0 && dy == 0);
            int[] out = CityTurn.getTileOutput(game, t, isCentre);
            result[i] = Math.min(255, out[outputIdx]); // UINT8 cap
        }
        return result;
    }

    /**
     * Returns {@code true} if the city's tile is adjacent to at least one ocean
     * tile (terrain 2=Ocean or 3=Deep Ocean in the classic ruleset).
     * Used to enforce the {@code TerrainClass=Oceanic/Adjacent} requirement
     * for buildings such as Harbor, Coastal Defense, and Port Facility.
     * Mirrors the {@code TerrainClass} check in the C Freeciv server's
     * {@code can_city_build_improvement_direct()} in {@code common/city.c}.
     *
     * @param game the current game state
     * @param city the city to test
     * @return {@code true} if any tile adjacent to the city is ocean
     */
    static boolean isCityCoastal(Game game, City city) {
        if (game.map == null) return false;
        int xsize = game.map.getXsize();
        int ysize = game.map.getYsize();
        int cx = (int) (city.getTile() % xsize);
        int cy = (int) (city.getTile() / xsize);
        for (int dx = -1; dx <= 1; dx++) {
            for (int dy = -1; dy <= 1; dy++) {
                if (dx == 0 && dy == 0) continue;
                int nx = (cx + dx + xsize) % xsize; // horizontal wrap
                int ny = cy + dy;
                if (ny < 0 || ny >= ysize) continue;
                long adjTileId = (long) (ny * xsize + nx);
                Tile adjTile = game.tiles.get(adjTileId);
                if (adjTile != null) {
                    int terrain = adjTile.getTerrain();
                    if (terrain == 2 || terrain == 3) return true; // Ocean or Deep Ocean
                }
            }
        }
        return false;
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

    /** Captures or razes a city after the last defender is defeated. Mirrors city_conquest(). */
    public static void captureOrRazeCity(Game game, Unit attacker, City city, long cityId, Tile cityTile) {
        long oldOwner = city.getOwner();
        long newOwner = attacker.getOwner();
        String cityName = city.getName();

        if (city.getSize() <= 1) {
            for (long workedTileId : city.getWorkedTiles()) {
                Tile wt = game.tiles.get(workedTileId);
                if (wt != null) {
                    wt.setWorked(-1);
                    game.getServer().sendTileInfoAll(wt);
                }
            }
            cityTile.setWorked(-1);
            game.getServer().sendTileInfoAll(cityTile);
            removeCity(game, cityId);
            CityTurn.updateBorders(game);
            game.getServer().sendMessageAll(cityName + " has been razed!");
            log.info("City razed: {} (owner: {})", cityName, getPlayerName(game, oldOwner));
            Notify.notifyPlayer(game, game.getServer(), oldOwner,
                    cityName + " has been razed by the enemy!");
        } else {
            city.setOwner(newOwner);
            city.setSize(city.getSize() - 1);
            city.setProductionKind(0);
            city.setProductionValue(-1);
            city.setShieldStock(0);
            VisibilityHandler.sendCityToVisiblePlayers(game, cityId);
            CityTurn.updateBorders(game);
            game.getServer().sendMessageAll(cityName + " has been captured!");
            log.info("City captured: {} by {} from {}", cityName,
                    getPlayerName(game, newOwner), getPlayerName(game, oldOwner));
            Notify.notifyPlayer(game, game.getServer(), newOwner,
                    "Our forces have captured " + cityName + "!");
            Notify.notifyPlayer(game, game.getServer(), oldOwner,
                    cityName + " has been captured by the enemy!");
        }

        attacker.setTile(cityTile.getIndex());
        attacker.setMovesleft(0);
    }

    private static String getPlayerName(Game game, long playerId) {
        net.freecivx.game.Player p = game.players.get(playerId);
        return p != null ? p.getUsername() : "?";
    }
}
