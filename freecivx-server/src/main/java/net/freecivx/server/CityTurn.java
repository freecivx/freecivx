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
import net.freecivx.game.Government;
import net.freecivx.game.Improvement;
import net.freecivx.game.Player;
import net.freecivx.game.Technology;
import net.freecivx.game.Terrain;
import net.freecivx.game.Tile;
import net.freecivx.game.Unit;
import net.freecivx.game.UnitType;
import net.freecivx.game.Extra;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

/**
 * Turn-based city processing: production completion, population growth,
 * science and tax contributions, and corruption/waste calculations.
 * Mirrors the functionality of cityturn.c in the C Freeciv server.
 * {@link #updateAllCities(Game)} is the main entry point called once per turn.
 */
public class CityTurn {

    /** Minimum unit production cost in shields. */
    private static final int MIN_UNIT_COST = 10;

    // -------------------------------------------------------------------------
    // Government IDs (index in the governments map, matching governments.ruleset
    // load order: Anarchy=0, Despotism=1, Monarchy=2, Communism=3, Republic=4,
    // Democracy=5).  Mirrors GOV_* macros in the C Freeciv server's government.h.
    // -------------------------------------------------------------------------
    private static final int GOV_ANARCHY   = 0;
    private static final int GOV_DESPOTISM = 1;
    private static final int GOV_MONARCHY  = 2;
    private static final int GOV_COMMUNISM = 3;

    /**
     * Number of military units whose gold upkeep is covered "for free" per city
     * for governments that support shield-upkeep units (Anarchy, Despotism,
     * Monarchy, Communism).  Mirrors {@code Unit_Upkeep_Free_Per_City = 3} in
     * the classic effects.ruleset ({@code effect_upkeep_free_units_*}).
     */
    private static final int FREE_UNITS_PER_CITY = 3;

    /**
     * Fallback improvement ID for Granary.  Matches the hardcoded ID used in
     * {@link net.freecivx.game.Effects} and the classic ruleset fallback in
     * {@link net.freecivx.game.Game}.
     */
    private static final int IMPR_GRANARY = 2;

    /**
     * Improvement ID for Barracks.  Units in a city with Barracks restore to
     * full HP each turn.  Mirrors the {@code HP_Regen = 100} effect applied by
     * Barracks in the classic Freeciv {@code effects.ruleset}.
     */
    private static final int IMPR_BARRACKS = 1;

    /**
     * HP restored per turn (as a fraction of max HP) when a unit is in a
     * friendly city without Barracks.  Provides modest recovery without
     * full-heal, mirroring the baseline regen in the C Freeciv server.
     * Value 5 → restore 1/5 (20%) of max HP per turn.
     */
    private static final int HP_RESTORE_DIVISOR = 5;

    /**
     * Improvement ID for Courthouse.  Halves corruption and production waste.
     * Used in {@link #cityTaxContribution(Game, long)} and
     * {@link #cityProduction(Game, long)}.
     */
    private static final int IMPR_COURTHOUSE    = 9;

    /**
     * Improvement ID for Temple.  Grants EFT_MAKE_CONTENT = 1 in the classic
     * Freeciv {@code effects.ruleset}, making one unhappy citizen content.
     * Used in {@link #updateCityHappiness(Game, long)}.
     */
    private static final int IMPR_TEMPLE     = 6;

    /**
     * Improvement ID for Colosseum.  Grants EFT_MAKE_CONTENT = 3 in the
     * classic Freeciv {@code effects.ruleset}, making three unhappy citizens
     * content.  Used in {@link #updateCityHappiness(Game, long)}.
     */
    private static final int IMPR_COLOSSEUM  = 11;

    /**
     * Improvement ID for Cathedral.  Grants EFT_MAKE_CONTENT = 3 in the
     * classic Freeciv {@code effects.ruleset}, making three unhappy citizens
     * content.  Used in {@link #updateCityHappiness(Game, long)}.
     */
    private static final int IMPR_CATHEDRAL  = 12;

    /**
     * Luxury goods cost per citizen mood upgrade.
     * Mirrors {@code RS_DEFAULT_HAPPY_COST = 2} in the C Freeciv server's
     * {@code common/game.h} and the classic {@code game.ruleset}.
     * Each {@value #HAPPY_COST} luxury points converts one content citizen to
     * happy.  Two content→happy upgrades worth of luxury (i.e.
     * {@code 2 * HAPPY_COST}) instead converts one unhappy citizen directly
     * to happy (a two-level upgrade).  See {@code citizen_luxury_happy()} in
     * {@code common/city.c}.
     */
    private static final int HAPPY_COST = 2;

    /**
     * Activity code for a unit building a road.
     * Used by {@link #processWorkerActivities} and {@link UnitTools}.
     * Mirrors {@code ACTIVITY_ROAD} in the C Freeciv server's
     * {@code common/unit.h}.
     */
    public static final int ACTIVITY_ROAD = 4;

    /**
     * Activity code for a unit building irrigation.
     * Used by {@link #processWorkerActivities} and {@link UnitTools}.
     * Mirrors {@code ACTIVITY_IRRIGATE} in the C Freeciv server's
     * {@code common/unit.h}.
     */
    public static final int ACTIVITY_IRRIGATE = 5;

    /**
     * Activity code for a unit building a mine.
     * Used by {@link #processWorkerActivities} and {@link UnitTools}.
     * Mirrors {@code ACTIVITY_MINE} in the C Freeciv server's
     * {@code common/unit.h}.
     */
    public static final int ACTIVITY_MINE = 7;

    /**
     * Activity code for a unit building a railroad.
     * Requires an existing road on the tile (road must be built first).
     * Mirrors the old {@code ACTIVITY_OLD_RAILROAD} (8) from the C Freeciv
     * server's {@code common/unit.h}; used here as a simplified rail activity.
     */
    public static final int ACTIVITY_RAILROAD = 8;

    /** Number of turns a worker needs to complete a road. */
    private static final int ROAD_TURNS = 2;
    /** Number of turns a worker needs to complete an irrigation channel. */
    private static final int IRRIGATE_TURNS = 5;
    /** Number of turns a worker needs to complete a mine. */
    private static final int MINE_TURNS = 5;
    /** Number of turns a worker needs to complete a railroad. */
    private static final int RAILROAD_TURNS = 4;

    /**
     * Tile extras bitvector index for Road.
     * Matches extras entry 6 registered in {@code Game.initGame()}.
     */
    public static final int EXTRA_BIT_ROAD = 6;
    /**
     * Tile extras bitvector index for Railroad.
     * Matches extras entry 7 registered in {@code Game.initGame()}.
     */
    public static final int EXTRA_BIT_RAIL = 7;
    /**
     * Tile extras bitvector index for Irrigation.
     * Matches extras entry 9 registered in {@code Game.initGame()}.
     */
    public static final int EXTRA_BIT_IRRIGATION = 9;
    /**
     * Tile extras bitvector index for Mine.
     * Matches extras entry 1 registered in {@code Game.initGame()}.
     */
    public static final int EXTRA_BIT_MINE = 1;
    /**
     * Tile extras bitvector index for Pollution.
     * Matches extras entry 4 ("Pollution") registered in {@code Game.initGame()}.
     * Mirrors the {@code EC_POLLUTION} extra cause in the C Freeciv server.
     */
    public static final int EXTRA_BIT_POLLUTION = 4;

    /**
     * Base pollution modifier (negative offset) applied when computing a city's
     * pollution level.  Mirrors {@code RS_DEFAULT_BASE_POLLUTION = -20} in the
     * C Freeciv server's {@code common/game.h}.
     * A city must produce more than {@value #BASE_POLLUTION} combined shields and
     * population points before any pollution is generated.
     */
    private static final int BASE_POLLUTION = 20;

    /**
     * Minimum trade output of a city centre tile, added to the population-based
     * trade value before corruption and rate splits are applied.
     * Represents the trade that the city centre tile itself produces regardless
     * of population size.  Without this constant, sequential integer percentage
     * multiplications (corruption %, tax rate %) truncate size-1 city output to
     * zero under high-corruption governments such as Despotism (37 %).
     * Value 1 mirrors the trade produced by a typical city centre tile in the
     * classic Freeciv ruleset (Grassland city = 1 trade from the centre tile).
     */
    private static final int CITY_CENTRE_TRADE_BONUS = 1;

    /**
     * Computes the food, shield, and trade output of a single tile.
     * Takes into account terrain base values, tile extras (road, irrigation, mine,
     * and resource extras), and the city-centre bonus when applicable.
     *
     * <p>Mirrors {@code city_tile_output()} in the C Freeciv server's
     * {@code common/city.c}:
     * <ul>
     *   <li>Base output from terrain type ({@code food}, {@code shield}, {@code trade}
     *       fields in {@code terrain.ruleset}).</li>
     *   <li>Irrigation extra adds {@code irrigation_food_incr} food bonus.</li>
     *   <li>Mine extra adds {@code mining_shield_incr} shield bonus.</li>
     *   <li>Road extra adds 1 trade when the terrain has
     *       {@code road_trade_incr_pct > 0} (Desert, Grassland, Plains in classic
     *       ruleset).</li>
     *   <li>Resource extra (EC_RESOURCE cause) adds the extra's food/shield/trade
     *       bonuses from {@code [resource_*]} in {@code terrain.ruleset}.</li>
     *   <li>City-centre tile gets +1 food, +1 shield, +1 trade bonus
     *       ({@code EFT_CITY_VISION_RADIUS_SQ} / city-centre rule in C server).</li>
     * </ul>
     *
     * @param game         the current game state
     * @param tile         the tile to evaluate; {@code null} returns {0,0,0}
     * @param isCityCenter {@code true} to apply the +1/+1/+1 city-centre bonus
     * @return int[3] = {food, shield, trade}; all values ≥ 0
     */
    public static int[] getTileOutput(Game game, Tile tile, boolean isCityCenter) {
        if (tile == null) return new int[]{0, 0, 0};

        Terrain terrain = game.terrains.get((long) tile.getTerrain());
        int food = 0, shield = 0, trade = 0;
        if (terrain != null) {
            food   = terrain.getFood();
            shield = terrain.getShield();
            trade  = terrain.getTrade();

            int extras = tile.getExtras();
            // Road trade bonus (Grassland/Plains/Desert in classic ruleset get +1 trade with road).
            if ((extras & (1 << EXTRA_BIT_ROAD)) != 0) {
                trade += terrain.getRoadTradeBonus();
            }
            // Irrigation food bonus
            if ((extras & (1 << EXTRA_BIT_IRRIGATION)) != 0) {
                food += terrain.getIrrigationFoodBonus();
            }
            // Mine shield bonus
            if ((extras & (1 << EXTRA_BIT_MINE)) != 0) {
                shield += terrain.getMiningShieldBonus();
            }
            // Resource extra bonus: resource extras occupy bits 15-31; iterate only
            // over that range to apply food/shield/trade bonuses from terrain.ruleset.
            for (int bitPos = 15; bitPos < 32; bitPos++) {
                if ((extras & (1 << bitPos)) != 0) {
                    Extra extra = game.extras.get((long) bitPos);
                    if (extra != null) {
                        food   += extra.getFoodBonus();
                        shield += extra.getShieldBonus();
                        trade  += extra.getTradeBonus();
                    }
                }
            }
        }

        // City-centre tile receives +1 food, +1 shield, +1 trade bonus.
        // Mirrors the city-centre bonus in the C Freeciv server (common/city.c).
        if (isCityCenter) {
            food   += 1;
            shield += 1;
            trade  += 1;
        }

        return new int[]{Math.max(0, food), Math.max(0, shield), Math.max(0, trade)};
    }


    /**
     * Returns the granary size (food needed to grow) for a city of the given size.
     * Mirrors {@code city_granary_size} in the C Freeciv server's {@code common/city.c}.
     * Uses the classic Freeciv ruleset defaults:
     *   granary_food_ini[0] = 20 (base for size-1 city)
     *   granary_food_inc    = 10 (additional food per extra citizen)
     *   foodbox             = 100 (no scaling modifier)
     * Formula: size=1 → 20, size>1 → 20 + 10*(size-1) = 10*size+10.
     * This matches the non-linear C server formula and provides faster early
     * city growth compared to the old linear (size*20) calculation.
     *
     * @param citySize the current population size of the city
     * @return the amount of food required to fill the granary and grow
     */
    public static int cityGranarySize(int citySize) {
        if (citySize <= 0) return 0;
        // Mirrors city_granary_size() in C Freeciv server's common/city.c.
        // RS_DEFAULT_GRANARY_FOOD_INI=20, RS_DEFAULT_GRANARY_FOOD_INC=10, foodbox=100.
        return 10 * citySize + 10;
    }

    /**
     * Assigns the best available adjacent tile to be worked by the given city,
     * called when the city gains a new citizen (growth).  The tile with the
     * highest combined food+shield+trade output within the city's working radius
     * (Chebyshev distance ≤ 2) is chosen, skipping tiles already worked by any
     * city.  Mirrors {@code city_choose_tile_to_work()} / the auto-worked-tile
     * selection in the C Freeciv server's {@code server/cityturn.c}.
     *
     * @param game   the current game state
     * @param cityId the ID of the growing city
     */
    static void assignNextWorkedTile(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return;

        long centerTile = city.getTile();
        long cx = centerTile % game.map.getXsize();
        long cy = centerTile / game.map.getXsize();

        // City radius: citizens can work tiles within Chebyshev distance 2.
        final int CITY_RADIUS = 2;

        int bestScore = -1;
        Tile bestTile = null;

        for (int dy = -CITY_RADIUS; dy <= CITY_RADIUS; dy++) {
            for (int dx = -CITY_RADIUS; dx <= CITY_RADIUS; dx++) {
                if (dx == 0 && dy == 0) continue; // center already worked
                long nx = cx + dx;
                long ny = cy + dy;
                if (nx < 0 || nx >= game.map.getXsize()
                        || ny < 0 || ny >= game.map.getYsize()) continue;
                long tileId = ny * game.map.getXsize() + nx;
                Tile t = game.tiles.get(tileId);
                if (t == null || t.getWorked() >= 0) continue; // already worked by a city

                int[] output = getTileOutput(game, t, false);
                int score = output[0] + output[1] + output[2];
                if (score > bestScore) {
                    bestScore = score;
                    bestTile = t;
                }
            }
        }

        if (bestTile != null) {
            bestTile.setWorked(cityId);
            city.addWorkedTile(bestTile.getIndex());
            game.getServer().sendTileInfoAll(bestTile);
        }
    }

    /**
     * Recalculates national borders for all cities and updates tiles whose
     * owner has changed.  Only tiles where the ownership changes are
     * re-broadcast to clients.
     *
     * <p>Each city claims tiles within a radius based on city size:
     * {@code radius = min(floor(sqrt(size)) + 1, 5)}.
     * When two cities compete for the same tile, the one whose centre is
     * closer (Chebyshev distance) wins.  Mirrors the high-level logic of
     * {@code server/borders.c} in the C Freeciv server.
     *
     * @param game the current game state
     */
    public static void updateBorders(Game game) {
        long mapWidth  = game.map.getXsize();
        long mapHeight = game.map.getYsize();

        for (Tile tile : game.tiles.values()) {
            long tileId = tile.getIndex();
            long tx = tileId % mapWidth;
            long ty = tileId / mapWidth;

            int bestOwner = -1;
            long bestDist = (long) game.map.getXsize() + game.map.getYsize();

            for (City city : game.cities.values()) {
                long cityTile = city.getTile();
                long cx = cityTile % mapWidth;
                long cy = cityTile / mapWidth;

                // Chebyshev distance between tile and city centre
                long dist = Math.max(Math.abs(tx - cx), Math.abs(ty - cy));
                // Border radius grows with city size (capped at 5)
                int radius = Math.min((int) Math.sqrt(city.getSize()) + 1, 5);

                if (dist <= radius && dist < bestDist) {
                    bestDist = dist;
                    bestOwner = (int) city.getOwner();
                }
            }

            if (tile.getOwner() != bestOwner) {
                tile.setOwner(bestOwner);
                game.getServer().sendTileInfoAll(tile);
            }
        }
    }

    /**
     * Finds a city improvement's numeric ID by its display name.
     * This is necessary because improvement IDs differ between the loaded
     * ruleset (alphabetical order) and the hardcoded fallback dataset.
     * Mirrors the name-based building lookup in the C Freeciv server's
     * {@code server/ruleset.c}.
     *
     * @param game     the current game state
     * @param name     the improvement display name (case-insensitive)
     * @param fallback the ID to return when the name is not found
     * @return the improvement's numeric ID, or {@code fallback} if not found
     */
    static int findImprId(Game game, String name, int fallback) {
        for (Map.Entry<Long, Improvement> e : game.improvements.entrySet()) {
            if (name.equalsIgnoreCase(e.getValue().getName())) {
                return e.getKey().intValue();
            }
        }
        return fallback;
    }

    /**
     * Returns {@code true} if the given city has a built improvement whose
     * name matches {@code name} (case-insensitive).  Used to enforce city
     * building prerequisites, mirroring the {@code "Building"/"City"} requirement
     * check in {@code can_city_build_improvement_direct()} in the C Freeciv server.
     *
     * @param game   current game state
     * @param city   the city to inspect
     * @param name   the improvement name to look for (e.g. {@code "Temple"})
     * @return {@code true} when the city already contains the named improvement
     */
    public static boolean cityHasImprovementByName(Game game, City city, String name) {
        int id = findImprId(game, name, -1);
        if (id < 0) return false; // unknown building name — treat as not required
        return city.hasImprovement(id);
    }

    /**
     * Computes the total shield (production) output for a city based on its
     * centre tile output and city size.
     *
     * <p>The city centre tile contributes its terrain-based shields (including the
     * city-centre +1 bonus).  Each additional citizen beyond the founder works a
     * tile of the same terrain, contributing the terrain's base shield value.
     * The result is always at least 1 shield per turn.
     *
     * @param city         the city whose shield output is needed
     * @param centerOutput the pre-computed tile output for the city's centre tile
     *                     (as returned by {@link #getTileOutput} with
     *                     {@code isCityCenter=true})
     * @return shield output per turn (≥ 1)
     */
    private static int computeCityShieldOutput(City city, int[] centerOutput) {
        int additionalShields = (city.getSize() > 1)
                ? (city.getSize() - 1) * Math.max(0, centerOutput[1])
                : 0;
        return Math.max(1, centerOutput[1] + additionalShields);
    }


    /**
     * Processes the production queue for a city.
     * Adds the city's shields output to the current production item's progress.
     * If the item is complete the product (unit or improvement) is created and
     * the production is reset.
     * Handles both unit production (productionKind 0) and improvement production
     * (productionKind 1), mirroring {@code city_distribute_surplus_shields} and
     * {@code city_build_unit} / {@code city_build_building} in the C Freeciv server.
     *
     * <p>Shield output is computed from the city's centre tile using
     * {@link #getTileOutput}, so productive terrain types (Forest = 3 shields/turn,
     * Plains = 2 shields/turn) build improvements faster than barren terrain.
     *
     * @param game   the current game state
     * @param cityId the ID of the city whose production is being processed
     */
    public static void cityProduction(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return;

        // Shield output: base from the city's centre tile (terrain + extras + city-centre bonus),
        // plus terrain shields per additional citizen (workers beyond the founder).
        // Mirrors shield output from worked tiles in the C Freeciv server.
        Tile centerTile = game.tiles.get(city.getTile());
        int[] centerOutput = getTileOutput(game, centerTile, true /* city center */);
        int shieldOutput = computeCityShieldOutput(city, centerOutput);

        // Apply production waste (shields lost to inefficiency).
        // Mirrors the waste calculation for shields in the C Freeciv server's
        // cityturn.c.  The waste percentage mirrors corruption (same government
        // factor) but is halved — waste is typically lower than gold corruption
        // because it represents raw production loss rather than theft/bureaucracy.
        Player player = game.players.get(city.getOwner());
        if (player != null) {
            Government gov = game.governments.get((long) player.getGovernmentId());
            if (gov != null) {
                int wastePct = gov.getCorruptionPct() / 2;
                // Courthouse also halves production waste, mirroring the
                // C server's Courthouse effect on both corruption and waste.
                int courthouseId = findImprId(game, "Courthouse", IMPR_COURTHOUSE);
                if (city.hasImprovement(courthouseId)) {
                    wastePct /= 2;
                }
                if (wastePct > 0) {
                    int wasted = shieldOutput * wastePct / 100;
                    shieldOutput = Math.max(1, shieldOutput - wasted);
                }
            }
        }

        city.setShieldStock(city.getShieldStock() + shieldOutput);

        // productionKind 1 = improvement (building)
        if (city.getProductionKind() == 1) {
            int improvId = city.getProductionValue();
            Improvement improvement = game.improvements.get((long) improvId);
            if (improvement != null) {
                int cost = improvement.getBuildCost();
                if (city.getShieldStock() >= cost) {
                    // Check technology prerequisite before completing construction.
                    // Mirrors city_build_building() in the C Freeciv server's
                    // server/citytools.c: an improvement cannot be finished unless
                    // the player has the required technology.
                    long techReq = improvement.getTechReqId();
                    boolean techMet = (player == null || techReq < 0
                            || player.hasTech(techReq));
                    // Check city building prerequisite before completing construction.
                    // Mirrors the "Building"/"City" requirement check in
                    // can_city_build_improvement_direct() in the C Freeciv server.
                    // For example, Cathedral requires Temple; Bank requires Marketplace.
                    boolean buildingPrereqMet = true;
                    String reqBldgName = improvement.getRequiredBuildingName();
                    if (reqBldgName != null && !reqBldgName.isEmpty()) {
                        buildingPrereqMet = cityHasImprovementByName(game, city, reqBldgName);
                        if (!buildingPrereqMet) {
                            Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                                    city.getName() + " cannot build " + improvement.getName()
                                    + ": requires " + reqBldgName + " first.");
                        }
                    }
                    if (techMet && buildingPrereqMet) {
                        city.addImprovement(improvId);
                        city.setShieldStock(city.getShieldStock() - cost);
                        Notify.notifyPlayer(game, game.getServer(),
                                city.getOwner(),
                                city.getName() + " has built " + improvement.getName() + ".");
                        // Reset production to nothing after completion (-1 = no production)
                        city.setProductionKind(0);
                        city.setProductionValue(-1);
                    }
                    // else: shields are ready but prerequisite tech/building not yet met;
                    // keep shields and production queued — completes automatically when
                    // the prerequisite is satisfied.
                }
            }
        }

        // productionKind 0 = unit production; productionValue -1 means nothing queued.
        // Mirrors city_build_unit() in the C Freeciv server's citytools.c.
        if (city.getProductionKind() == 0 && city.getProductionValue() >= 0) {
            int unitTypeId = city.getProductionValue();
            UnitType unitType = game.unitTypes.get((long) unitTypeId);
            if (unitType != null) {
                // Check technology prerequisite before completing unit construction.
                // Mirrors the req-check in city_build_unit() in server/citytools.c:
                // a unit cannot be finished unless the player has the required technology.
                // If the tech is not yet known, shields are kept and production waits.
                long unitTechReq = unitType.getTechReqId();
                if (player != null && unitTechReq >= 0 && !player.hasTech(unitTechReq)) {
                    // Tech prerequisite not yet met; keep shields and wait for the tech.
                    VisibilityHandler.sendCityToVisiblePlayers(game, cityId);
                    return;
                }

                // Unit cost: use explicit ruleset cost if set, else legacy formula.
                // Mirrors the build_cost field in the Freeciv units ruleset.
                int cost;
                if (unitType.getCost() > 0) {
                    cost = unitType.getCost();
                } else {
                    cost = Math.max(MIN_UNIT_COST, (unitType.getAttackStrength() + unitType.getDefenseStrength())
                            * unitType.getHp() / 2);
                }
                if (city.getShieldStock() >= cost) {
                    // Apply population cost: remove citizens from the city when the unit is built.
                    // Mirrors the pop_cost field in the Freeciv units ruleset and
                    // city_build_unit() pop_cost handling in server/citytools.c.
                    // Settlers have pop_cost=1; the city must have at least size 2 to
                    // prevent the unit from destroying the last citizen (mirrors
                    // city_size_add() / city_reduce_size() constraints in C server).
                    int popCost = unitType.getPopCost();
                    if (popCost > 0 && city.getSize() <= popCost) {
                        // Cannot build: city too small to afford the population cost.
                        // Keep shields; player must grow the city first.
                        VisibilityHandler.sendCityToVisiblePlayers(game, cityId);
                        return;
                    }

                    UnitTools.createUnit(game, city.getOwner(), city.getTile(), unitTypeId);
                    city.setShieldStock(city.getShieldStock() - cost);

                    // Deduct population cost after the unit is created.
                    // Mirrors pop_cost handling in server/citytools.c city_build_unit().
                    if (popCost > 0) {
                        city.setSize(city.getSize() - popCost);
                        Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                                city.getName() + " has shrunk to size " + city.getSize()
                                        + " after building " + unitType.getName() + ".");
                    }

                    Notify.notifyPlayer(game, game.getServer(),
                            city.getOwner(),
                            city.getName() + " has built " + unitType.getName() + ".");
                    // Reset production so AI/player can choose what to build next.
                    // Mirrors the C server behaviour where the production queue is
                    // cleared after a unit is completed unless the player repeats it.
                    city.setProductionValue(-1);
                }
            }
        }

        VisibilityHandler.sendCityToVisiblePlayers(game, cityId);
    }

    /**
     * Handles population growth for a city at end of turn using the food-stock
     * system from the C Freeciv server ({@code city_populate} in {@code cityturn.c}).
     * Food is accumulated each turn and the city grows when the granary fills.
     * Cities above size 8 require an Aqueduct (improvement id 8) to grow further.
     * If food_stock drops below zero the city shrinks by one (starvation).
     *
     * <p>Food surplus per turn is computed from the city's centre tile using
     * {@link #getTileOutput}, so cities on fertile terrain (Grassland = 3 food/turn)
     * grow faster than those on poor terrain (Desert = 1 food/turn).  This mirrors
     * the terrain-based food output in the C Freeciv server.
     *
     * @param game   the current game state
     * @param cityId the ID of the city to process for growth
     */
    public static void cityGrowth(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return;

        // Food surplus per turn: from the city's centre tile (terrain + extras + city-centre bonus).
        // Mirrors food surplus[O_FOOD] from city_tile_output() in the C Freeciv server.
        // Using the centre tile as a proxy for all worked tiles keeps the calculation
        // simple while correctly reflecting terrain type (Grassland > Plains > Desert).
        Tile centerTile = game.tiles.get(city.getTile());
        int[] centerOutput = getTileOutput(game, centerTile, true /* city center */);
        int foodSurplus = Math.max(1, centerOutput[0]);

        int granaryImprId = findImprId(game, "Granary", IMPR_GRANARY);
        if (city.hasImprovement(granaryImprId)) {
            // Granary adds 1 food surplus per turn (models the storage efficiency effect).
            foodSurplus += 1;
        }

        int granarySize = cityGranarySize(city.getSize());
        city.setFoodStock(city.getFoodStock() + foodSurplus);

        if (city.getFoodStock() >= granarySize) {
            // Cities above size 8 require an Aqueduct to grow further.
            // Cities above size 12 require both an Aqueduct and a Sewer System.
            // Mirrors city_can_grow_to() / effect_aqueduct and effect_sewer_system
            // in the C Freeciv server's common/city.c and effects.ruleset.
            int aqueductId  = findImprId(game, "Aqueduct",     8);
            int sewerSysId  = findImprId(game, "Sewer System", -1);
            boolean hasAqueduct  = city.hasImprovement(aqueductId);
            boolean hasSewerSys  = sewerSysId >= 0 && city.hasImprovement(sewerSysId);

            if (city.getSize() >= 12 && !(hasAqueduct && hasSewerSys)) {
                // Cannot grow beyond size 12 without both Aqueduct and Sewer System.
                city.setFoodStock(granarySize);
                if (!hasAqueduct) {
                    Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                            city.getName() + " needs an Aqueduct to grow beyond size "
                                    + city.getSize() + ".");
                } else {
                    Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                            city.getName() + " needs a Sewer System to grow beyond size "
                                    + city.getSize() + ".");
                }
            } else if (city.getSize() >= 8 && !hasAqueduct) {
                // Cap food stock at granary size; cannot grow without Aqueduct
                city.setFoodStock(granarySize);
                Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                        city.getName() + " needs an Aqueduct to grow beyond size "
                                + city.getSize() + ".");
            } else {
                // City grows: increase size and reset granary
                city.setSize(city.getSize() + 1);
                // Granary improvement retains 50% of the new granary capacity after growth.
                // The C server also computes savings based on the new (larger) size:
                //   city_size_add(pcity, 1); ... new_food = city_granary_size(new_size) * savings_pct / 100
                if (city.hasImprovement(granaryImprId)) {
                    city.setFoodStock(cityGranarySize(city.getSize()) / 2);
                } else {
                    city.setFoodStock(0);
                }
                // Assign a new worked tile to the additional citizen.
                // Mirrors city_choose_tile_to_work() in the C Freeciv server.
                assignNextWorkedTile(game, cityId);
                Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                        city.getName() + " has grown to size " + city.getSize() + ".");
            }
        } else if (city.getFoodStock() < 0) {
            // Starvation: city shrinks if size > 1, mirrors city_reduce_size() in C server
            if (city.getSize() > 1) {
                city.setSize(city.getSize() - 1);
                Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                        "Famine in " + city.getName() + "! Population has decreased to "
                                + city.getSize() + ".");
            }
            city.setFoodStock(0);
        }

        VisibilityHandler.sendCityToVisiblePlayers(game, cityId);
    }

    /**
     * Runs the full end-of-turn update for every city and every player.
     * Per city: food growth, production, shield accumulation.
     * Per player: gold income from trade (after corruption and building upkeep),
     * unit gold upkeep, and science bulb accumulation leading to tech completion.
     * Mirrors the outer loop in {@code update_city_activities} in the C Freeciv server.
     *
     * @param game the current game state
     */
    public static void updateAllCities(Game game) {
        // Restore unit HP for units in friendly cities before other processing.
        // Mirrors unit_restore_hitpoints() in the C Freeciv server's unittools.c.
        restoreUnitHitpoints(game);

        // Advance terrain improvement activities (road, mine, irrigation, railroad).
        // Mirrors unit_activity_handling() in the C Freeciv server's unittools.c.
        processWorkerActivities(game);

        // Snapshot city IDs to avoid concurrent-modification issues
        for (long cityId : new ArrayList<>(game.cities.keySet())) {
            cityGrowth(game, cityId);
            cityProduction(game, cityId);
            updateCityHappiness(game, cityId);
            // Check for pollution from production and population waste.
            // Mirrors check_pollution() in the C Freeciv server's cityturn.c.
            checkPollution(game, cityId);
        }

        // Recalculate national borders after city growth/changes.
        // Sends PACKET_TILE_INFO only for tiles whose owner changed.
        // Mirrors server/borders.c in the C Freeciv server.
        updateBorders(game);

        // Aggregate per-player gold income from all their cities
        Map<Long, Integer> playerGoldIncome = new HashMap<>();
        for (long cityId : new ArrayList<>(game.cities.keySet())) {
            City city = game.cities.get(cityId);
            if (city == null) continue;
            long ownerId = city.getOwner();
            int gold = cityTaxContribution(game, cityId);
            playerGoldIncome.merge(ownerId, gold, (a, b) -> a + b);
        }

        // Update each player's gold, deducting building and unit upkeep,
        // then trigger research progress.
        for (Player player : game.players.values()) {
            long pid = player.getPlayerNo();

            int income = playerGoldIncome.getOrDefault(pid, 0);

            // Deduct building upkeep: each improvement costs its upkeep value in gold per turn.
            // Mirrors city_improvement_upkeep() calls in the C Freeciv server.
            int buildingUpkeep = 0;
            for (long cityId : new ArrayList<>(game.cities.keySet())) {
                City city = game.cities.get(cityId);
                if (city == null || city.getOwner() != pid) continue;
                for (int improvId : city.getImprovements()) {
                    Improvement impr = game.improvements.get((long) improvId);
                    if (impr != null) {
                        buildingUpkeep += impr.getUpkeep();
                    }
                }
            }

            // Deduct unit upkeep: military units cost 1 gold per turn.
            // Governments with Unit_Upkeep_Free_Per_City=3 (Anarchy, Despotism,
            // Monarchy, Communism) exempt the first (FREE_UNITS_PER_CITY × numCities)
            // military units from gold upkeep — they are supported by city shields instead.
            // Mirrors the unit_gold_upkeep() / Unit_Upkeep_Free_Per_City effect
            // in the C Freeciv server's cityturn.c and classic effects.ruleset.
            int govId = player.getGovernmentId();
            boolean hasFreeUnits = (govId == GOV_ANARCHY || govId == GOV_DESPOTISM
                    || govId == GOV_MONARCHY || govId == GOV_COMMUNISM);
            long numCities = game.cities.values().stream()
                    .filter(c -> c.getOwner() == pid).count();
            int freeUnitAllowance = hasFreeUnits ? (int) (FREE_UNITS_PER_CITY * numCities) : 0;

            int unitUpkeep = 0;
            for (Unit unit : new ArrayList<>(game.units.values())) {
                if (unit.getOwner() != pid) continue;
                UnitType utype = game.unitTypes.get((long) unit.getType());
                if (utype != null && utype.getAttackStrength() > 0) {
                    if (freeUnitAllowance > 0) {
                        freeUnitAllowance--; // this unit is covered by city shields
                    } else {
                        unitUpkeep++;        // excess units cost 1 gold each
                    }
                }
            }

            int newGold = player.getGold() + income - buildingUpkeep - unitUpkeep;

            // Bankruptcy: if the player cannot cover upkeep costs, disband military
            // units one by one until solvent (or none remain).  Mirrors the gold
            // upkeep auto-disband logic in the C Freeciv server's cityturn.c
            // (city_support → unit_gold_upkeep → auto_settler_do_goto_action).
            if (newGold < 0) {
                List<Unit> militaryUnits = new ArrayList<>();
                for (Unit unit : game.units.values()) {
                    if (unit.getOwner() != pid) continue;
                    UnitType utype = game.unitTypes.get((long) unit.getType());
                    if (utype != null && utype.getAttackStrength() > 0) {
                        militaryUnits.add(unit);
                    }
                }
                for (Unit toDisband : militaryUnits) {
                    if (newGold >= 0) break;
                    newGold += 1; // Each disbanded unit saves 1 gold of upkeep
                    UnitTools.removeUnit(game, toDisband.getId());
                    Notify.notifyPlayer(game, game.getServer(), pid,
                            "Lack of funds! A military unit has been disbanded.");
                }
            }

            player.setGold(Math.max(0, newGold));

            // Update research progress (accumulates science bulbs, completes tech if reached).
            TechTools.playerResearchUpdate(game, pid);

            // Broadcast updated gold and research state to the player's client
            game.getServer().sendPlayerInfoAll(player);
        }
    }

    /**
     * Computes the base trade output of a city before any economic building
     * bonuses, corruption, or rate splits.
     *
     * <p>Trade is derived from the city's centre tile using
     * {@link #getTileOutput}: terrain base trade + road trade bonus when the
     * tile has a road extra.  All citizens (size workers) contribute the same
     * per-tile trade value, plus the fixed city-centre bonus
     * ({@link #CITY_CENTRE_TRADE_BONUS}).  This ensures that:
     * <ul>
     *   <li>Grassland/Plains/Desert cities with roads produce the same trade
     *       as the old {@code city.getSize() + 1} formula, keeping balance.</li>
     *   <li>Cities on terrain without a road trade bonus (Forest, Hills, …)
     *       produce less trade, accurately reflecting the classic Freeciv
     *       ruleset where roads are required for most trade income.</li>
     * </ul>
     *
     * @param game   the current game state
     * @param cityId the ID of the city to evaluate
     * @return raw trade output (before building bonuses and corruption)
     */
    private static int cityTradeBase(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return 1;

        Tile centerTile = game.tiles.get(city.getTile());
        int[] centerOutput = getTileOutput(game, centerTile, true /* city center */);
        int tradePerTile = centerOutput[2]; // includes city-centre bonus (+1)

        // The city-centre tile contributes tradePerTile; each additional worker
        // (size-1 of them) contributes one tile's trade without the centre bonus.
        // workerTrade = max(0, tradePerTile - 1) removes the city-centre +1
        // that was already counted for the centre tile only.
        int workerTrade = Math.max(0, tradePerTile - 1);
        int additionalWorkerTrade = (city.getSize() - 1) * workerTrade;
        return Math.max(CITY_CENTRE_TRADE_BONUS, tradePerTile + additionalWorkerTrade);
    }


    /**
     * Calculates and returns the science (bulbs) produced by a city this turn.
     * The value depends on the city's trade output, population and improvements.
     * Bonuses are applied additively (all percentage bonuses summed, then applied
     * once), matching the Freeciv {@code Output_Bonus} stacking rule in
     * {@code effects.ruleset}:
     * <ul>
     *   <li>Library (id 3): +100% science ({@code effect_library}, value=100)</li>
     *   <li>Library + University (id 13): additional +150% science
     *       ({@code effect_university}, value=150, requires both buildings)</li>
     * </ul>
     * Combined effect: Library alone = ×2; Library + University = ×3.5.
     * Government corruption is also applied (same as for gold output), mirroring
     * the C Freeciv server where all trade-derived output types are reduced by
     * the government's corruption factor.  Courthouse (id 9) halves the penalty.
     *
     * @param game   the current game state
     * @param cityId the ID of the city to evaluate
     * @return the number of science bulbs produced this turn
     */
    public static int cityScienceContribution(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return 0;

        // Base science = city trade output × player science rate.
        // Uses terrain-based trade (road bonus on Grassland/Plains/Desert) so that
        // cities on fertile land with roads produce more science than cities on
        // unimproved terrain.  Mirrors the C server where science is a fraction of
        // the city's net trade output.
        int science = cityTradeBase(game, cityId);

        // Apply Output_Bonus effects additively, matching the C Freeciv server.
        // Library (effect_library): +100% science when Library is present.
        // University (effect_university): +150% additional when BOTH Library and
        // University are present. (Requires Library as a prerequisite.)
        // Combined: Library alone = ×2; Library+University = ×(100+100+150)/100 = ×3.5.
        // Use ceiling division ((a * b + 99) / 100) to avoid small values rounding
        // to zero when multiple percentage steps are applied in sequence.
        int libraryId    = findImprId(game, "Library",    3);
        int universityId = findImprId(game, "University", 13);
        int scienceBonus = 0;
        if (city.hasImprovement(libraryId)) {
            scienceBonus += 100; // Library: +100% (effect_library)
            if (city.hasImprovement(universityId)) {
                scienceBonus += 150; // University+Library: +150% additional (effect_university)
            }
        }
        science = (science * (100 + scienceBonus) + 99) / 100;

        // Apply government corruption to science output.
        // Mirrors the C Freeciv server where all trade output (gold, science,
        // luxury) is reduced by the government's corruption factor before being
        // split among the three output channels.  Courthouse halves it.
        // Use ceiling division so that even the first bulb is not rounded away.
        Player player = game.players.get(city.getOwner());
        if (player != null) {
            Government gov = game.governments.get((long) player.getGovernmentId());
            if (gov != null) {
                int corruptionPct = gov.getCorruptionPct();
                int courthouseId = findImprId(game, "Courthouse", IMPR_COURTHOUSE);
                if (city.hasImprovement(courthouseId)) {
                    corruptionPct /= 2;
                }
                science = (science * (100 - corruptionPct) + 99) / 100;
            }
        }

        return Math.max(0, science);
    }

    /**
     * Calculates and returns the gold (tax) produced by a city this turn.
     * The value depends on trade yields, improvements, and the player's tax rate.
     * Gold bonuses from Marketplace (id 4) and Bank (id 5) are applied
     * <em>additively</em>, matching the {@code Output_Bonus} stacking rule in
     * the C Freeciv server's {@code effects.ruleset}:
     * <ul>
     *   <li>Marketplace (effect_marketplace): +50% gold</li>
     *   <li>Bank (effect_bank): +50% additional when Marketplace is also present</li>
     * </ul>
     * Combined: Marketplace alone = ×1.5; Marketplace + Bank = ×2.0.
     * Corruption (reduced by Courthouse, id 9) is also applied.
     *
     * @param game   the current game state
     * @param cityId the ID of the city to evaluate
     * @return the amount of gold produced this turn
     */
    public static int cityTaxContribution(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return 0;

        Player player = game.players.get(city.getOwner());
        if (player == null) return 0;

        // Base trade: terrain-aware trade from the city's worked tiles.
        // Mirrors city trade output from city_tile_output() in the C server.
        int trade = cityTradeBase(game, cityId);

        // Apply Output_Bonus effects additively, matching the C Freeciv server.
        // Marketplace (effect_marketplace): +50% gold.
        // Bank (effect_bank): +50% additional gold when Marketplace is also present.
        // Combined: Marketplace alone = ×1.5; Marketplace+Bank = ×(100+50+50)/100 = ×2.0.
        // Ceiling division avoids rounding small city outputs to zero.
        int marketplaceId = findImprId(game, "Marketplace", 4);
        int bankId        = findImprId(game, "Bank",        5);
        int goldBonus = 0;
        if (city.hasImprovement(marketplaceId)) {
            goldBonus += 50; // Marketplace: +50% (effect_marketplace)
            if (city.hasImprovement(bankId)) {
                goldBonus += 50; // Bank (requires Marketplace): +50% additional (effect_bank)
            }
        }
        trade = (trade * (100 + goldBonus) + 99) / 100;

        // Apply corruption reduction (Courthouse halves corruption, mirrors C server)
        Government gov = game.governments.get((long) player.getGovernmentId());
        if (gov != null) {
            int corruptionPct = gov.getCorruptionPct();
            int courthouseId = findImprId(game, "Courthouse", IMPR_COURTHOUSE);
            if (city.hasImprovement(courthouseId)) {
                corruptionPct /= 2;
            }
            trade = (trade * (100 - corruptionPct) + 99) / 100;
        }

        // Tax rate: use the stored tax rate (= 100 - scienceRate - luxuryRate).
        // This ensures that luxury spending reduces gold income correctly.
        // Mirrors the economic split in the C Freeciv server (economic.tax).
        // Ceiling division preserves at least 1 gold when the taxRate is > 0.
        return (trade * player.getTaxRate() + 99) / 100;
    }

    /**
     * Calculates and returns the luxury goods produced by a city this turn.
     * Luxury goods make citizens happy: each {@value #HAPPY_COST} luxury points
     * converts one content citizen to happy, or one unhappy citizen to content.
     * This mirrors {@code citizen_happy_luxury()} in the C Freeciv server's
     * {@code common/city.c}, where {@code game.info.happy_cost = 2} in the
     * classic ruleset.
     *
     * <p>The luxury output comes from the city's trade pool (same base as gold
     * output) multiplied by the player's luxury rate.  Building bonuses from
     * Marketplace and Bank also apply, since they boost the trade output that
     * feeds into the luxury split.
     *
     * @param game   the current game state
     * @param cityId the ID of the city to evaluate
     * @return the amount of luxury goods produced this turn
     */
    public static int cityLuxuryContribution(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return 0;

        Player player = game.players.get(city.getOwner());
        if (player == null) return 0;

        if (player.getLuxuryRate() == 0) return 0;

        // Base trade: terrain-aware (same source as cityTaxContribution).
        int trade = cityTradeBase(game, cityId);

        // Apply trade bonuses from Marketplace and Bank (same as tax).
        // Ceiling division avoids rounding small city outputs to zero.
        int tradeBonus = 0;
        int marketplaceId = findImprId(game, "Marketplace", 4);
        int bankId        = findImprId(game, "Bank",        5);
        if (city.hasImprovement(marketplaceId)) {
            tradeBonus += 50; // Marketplace: +50%
            if (city.hasImprovement(bankId)) {
                tradeBonus += 50; // Bank (requires Marketplace): +50% additional
            }
        }
        trade = (trade * (100 + tradeBonus) + 99) / 100;

        // Apply corruption (reduces effective trade before the rate split).
        Government gov = game.governments.get((long) player.getGovernmentId());
        if (gov != null) {
            int corruptionPct = gov.getCorruptionPct();
            int courthouseId = findImprId(game, "Courthouse", IMPR_COURTHOUSE);
            if (city.hasImprovement(courthouseId)) {
                corruptionPct /= 2;
            }
            trade = (trade * (100 - corruptionPct) + 99) / 100;
        }

        return (trade * player.getLuxuryRate() + 99) / 100;
    }

    /**
     * start of the turn.  Mirrors {@code unit_restore_hitpoints()} in the C
     * Freeciv server's {@code server/unittools.c}:
     * <ul>
     *   <li>A city with <b>Barracks</b> (improvement id {@value #IMPR_BARRACKS})
     *       provides full HP restoration in one turn
     *       ({@code EFT_HP_REGEN = 100} in {@code effects.ruleset}).</li>
     *   <li>A city without Barracks restores 1/{@value #HP_RESTORE_DIVISOR} of
     *       max HP per turn (modest baseline recovery).</li>
     * </ul>
     * Only units belonging to the city owner benefit; enemy units occupying a
     * tile with a friendly city are not healed.
     *
     * @param game the current game state
     */
    public static void restoreUnitHitpoints(Game game) {
        // Build a fast tileId → City lookup restricted to owned cities.
        Map<Long, City> cityByTile = game.cities.values().stream()
                .collect(Collectors.toMap(City::getTile, c -> c, (a, b) -> a));

        int barracksId = findImprId(game, "Barracks", IMPR_BARRACKS);

        for (Unit unit : game.units.values()) {
            UnitType utype = game.unitTypes.get((long) unit.getType());
            if (utype == null) continue;
            int maxHp = utype.getHp();
            if (unit.getHp() >= maxHp) continue; // Already at full HP

            // Unit must be in a friendly city to receive healing
            City city = cityByTile.get(unit.getTile());
            if (city == null) continue;
            if (city.getOwner() != unit.getOwner()) continue;

            if (city.hasImprovement(barracksId)) {
                // Barracks: full heal in one turn (EFT_HP_REGEN = 100%)
                unit.setHp(maxHp);
            } else {
                // No Barracks: restore 20% of max HP (baseline regen)
                int restore = Math.max(1, maxHp / HP_RESTORE_DIVISOR);
                unit.setHp(Math.min(maxHp, unit.getHp() + restore));
            }
        }
    }

    /**
     * Calculates and updates the happiness state of a city based on its size,
     * government type, happiness-producing buildings, and luxury goods output.
     *
     * <p>The calculation mirrors the core of {@code citizen_base_mood()},
     * {@code citizen_content_buildings()}, and {@code citizen_happy_luxury()} in
     * the C Freeciv server's {@code common/city.c}:
     * <ol>
     *   <li>A base number of unhappy citizens is derived from the city size and
     *       the current government.  More permissive governments (Republic,
     *       Democracy) tolerate larger populations before citizens become
     *       unhappy.</li>
     *   <li>The {@code EFT_MAKE_CONTENT} effect from buildings (Temple = 1,
     *       Colosseum = 3, Cathedral = 3) converts unhappy citizens back to
     *       content, mirroring {@code citizen_content_buildings()} in
     *       {@code common/city.c}.</li>
     *   <li>Luxury goods output (trade × player's luxury rate) further reduces
     *       unhappiness: each {@value #HAPPY_COST} luxury points converts one
     *       unhappy citizen to content, mirroring {@code citizen_happy_luxury()}
     *       with {@code happy_cost = 2} from the classic Freeciv ruleset.
     *       Note: the C server also upgrades content→happy via luxury, but since
     *       this implementation tracks only a boolean happy/unhappy flag that
     *       upgrade has no additional visible effect.</li>
     *   <li>The city's {@code happy}/{@code unhappy} flags are updated to
     *       reflect the final citizen counts, mirroring {@code city_happy()} and
     *       {@code city_unhappy()} in the C server.</li>
     * </ol>
     *
     * <p>If the happiness state changes the updated city info is broadcast to
     * all clients and the owning player is notified.
     *
     * @param game   the current game state
     * @param cityId the ID of the city to evaluate
     */
    public static void updateCityHappiness(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return;

        Player player = game.players.get(city.getOwner());
        if (player == null) return;

        // Determine the city-size threshold beyond which citizens become unhappy.
        // Mirrors the government-specific base mood in citizen_base_mood() from
        // common/city.c: more stable governments allow larger content populations.
        //   Anarchy / Despotism : threshold 2  (cities with size > 2 get unhappy)
        //   Monarchy / Communism: threshold 3
        //   Republic            : threshold 4
        //   Democracy           : threshold 5
        int unhappyThreshold = 2; // default for Anarchy / Despotism
        Government gov = game.governments.get((long) player.getGovernmentId());
        if (gov != null) {
            switch (gov.getRuleName()) {
                case "Monarchy":  unhappyThreshold = 3; break;
                case "Communism": unhappyThreshold = 3; break;
                case "Republic":  unhappyThreshold = 4; break;
                case "Democracy": unhappyThreshold = 5; break;
                default: break; // Anarchy / Despotism: threshold = 2
            }
        }

        // Base unhappy count: citizens above the threshold start dissatisfied.
        // Mirrors the city-size-dependent unhappiness initialisation in
        // citizen_base_mood() of the C Freeciv server.
        int baseUnhappy = Math.max(0, city.getSize() - unhappyThreshold);

        // Apply the EFT_MAKE_CONTENT effect from city improvements.
        // Each point of make_content converts one unhappy citizen to content.
        // Classic ruleset values (mirroring effects.ruleset):
        //   Temple    (id=6):  EFT_MAKE_CONTENT = 1
        //   Colosseum (id=11): EFT_MAKE_CONTENT = 3
        //   Cathedral (id=12): EFT_MAKE_CONTENT = 3
        // Mirrors citizen_content_buildings() in common/city.c.
        int templeId    = findImprId(game, "Temple",    IMPR_TEMPLE);
        int colosseumId = findImprId(game, "Colosseum", IMPR_COLOSSEUM);
        int cathedralId = findImprId(game, "Cathedral", IMPR_CATHEDRAL);
        int makeContent = 0;
        if (city.hasImprovement(templeId))    makeContent += 1;
        if (city.hasImprovement(colosseumId)) makeContent += 3;
        if (city.hasImprovement(cathedralId)) makeContent += 3;

        // Net unhappy citizens after applying building effects
        int netUnhappy = Math.max(0, baseUnhappy - makeContent);

        // Apply luxury-goods happiness effect.
        // Mirrors citizen_happy_luxury() / citizen_luxury_happy() in common/city.c.
        // Each HAPPY_COST (= 2) luxury points reduces netUnhappy by 1.
        // In the C server luxury can also convert content citizens to happy, but
        // since this implementation only tracks a boolean happy/unhappy flag (not
        // per-citizen counts), that content→happy upgrade has no additional effect
        // here and is intentionally omitted as a known simplification.
        int luxury = cityLuxuryContribution(game, cityId);
        if (luxury > 0 && netUnhappy > 0) {
            int happyFromLuxury = luxury / HAPPY_COST;
            netUnhappy = Math.max(0, netUnhappy - happyFromLuxury);
        }

        // Determine happiness flags.
        // city_happy()  (C server): no angry, no unhappy, happy >= (size+1)/2
        // city_unhappy()(C server): happy < unhappy + 2*angry
        // Simplified: city is happy when no net unhappy citizens remain.
        boolean wasHappy   = city.isHappy();
        boolean wasUnhappy = city.isUnhappy();
        boolean isHappy    = (netUnhappy == 0);
        boolean isUnhappy  = (netUnhappy > 0);

        city.setHappy(isHappy);
        city.setUnhappy(isUnhappy);

        // Notify the player when the happiness state changes
        if (!wasUnhappy && isUnhappy) {
            Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                    city.getName() + " is in disorder!");
        } else if (wasUnhappy && !isUnhappy) {
            Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                    "Order has been restored in " + city.getName() + ".");
        }

        // Broadcast the updated city state to all clients if anything changed
        if (wasHappy != isHappy || wasUnhappy != isUnhappy) {
            VisibilityHandler.sendCityToVisiblePlayers(game, cityId);
        }
    }

    /**
     * Processes one turn of terrain improvement activity for all units currently
     * engaged in building roads, irrigation channels, or mines.
     * Each turn the unit's activity counter increments; when it reaches the
     * required threshold the corresponding tile extra is applied and the unit
     * returns to idle.  Mirrors {@code unit_activity_handling()} in the C Freeciv
     * server's {@code server/unittools.c}.
     *
     * <p>Improvement turn costs:
     * <ul>
     *   <li>Road ({@link #ACTIVITY_ROAD}): {@value #ROAD_TURNS} turns</li>
     *   <li>Irrigation ({@link #ACTIVITY_IRRIGATE}): {@value #IRRIGATE_TURNS} turns</li>
     *   <li>Mine ({@link #ACTIVITY_MINE}): {@value #MINE_TURNS} turns</li>
     * </ul>
     *
     * @param game the current game state
     */
    public static void processWorkerActivities(Game game) {
        for (Unit unit : new ArrayList<>(game.units.values())) {
            int activity = unit.getActivity();
            int requiredTurns = workerActivityTurns(activity);
            if (requiredTurns <= 0) continue; // not a terrain improvement activity

            Tile tile = game.tiles.get(unit.getTile());
            if (tile == null) continue;

            unit.setActivityCount(unit.getActivityCount() + 1);

            if (unit.getActivityCount() >= requiredTurns) {
                int extraBit = workerActivityExtraBit(activity);
                String extraName = workerActivityName(activity);

                // Apply the tile improvement only if not already present
                if (extraBit >= 0 && (tile.getExtras() & (1 << extraBit)) == 0) {
                    tile.setExtras(tile.getExtras() | (1 << extraBit));
                    game.getServer().sendTileInfoAll(tile);
                    Notify.notifyPlayer(game, game.getServer(), unit.getOwner(),
                            extraName + " has been completed.");
                }
                // Return the worker to idle and reset activity counter
                unit.setActivity(0);
                unit.setActivityCount(0);
                VisibilityHandler.sendUnitToVisiblePlayers(game, unit);
            }
        }
    }

    /**
     * Returns the number of turns required to complete the given terrain
     * improvement activity, or {@code 0} if the activity is not a worker
     * terrain improvement.
     *
     * @param activity the unit activity code
     * @return turns required, or 0 for non-worker activities
     */
    private static int workerActivityTurns(int activity) {
        if (activity == ACTIVITY_ROAD)     return ROAD_TURNS;
        if (activity == ACTIVITY_IRRIGATE) return IRRIGATE_TURNS;
        if (activity == ACTIVITY_MINE)     return MINE_TURNS;
        if (activity == ACTIVITY_RAILROAD) return RAILROAD_TURNS;
        return 0;
    }

    /**
     * Returns the tile extras bitvector index for the improvement produced by
     * the given worker activity, or {@code -1} if not applicable.
     *
     * @param activity the unit activity code
     * @return the extras bit index, or -1
     */
    private static int workerActivityExtraBit(int activity) {
        if (activity == ACTIVITY_ROAD)     return EXTRA_BIT_ROAD;
        if (activity == ACTIVITY_IRRIGATE) return EXTRA_BIT_IRRIGATION;
        if (activity == ACTIVITY_MINE)     return EXTRA_BIT_MINE;
        if (activity == ACTIVITY_RAILROAD) return EXTRA_BIT_RAIL;
        return -1;
    }

    /**
     * Returns a human-readable name for the tile improvement produced by the
     * given worker activity (used in player notifications).
     *
     * @param activity the unit activity code
     * @return display name, or an empty string if not applicable
     */
    private static String workerActivityName(int activity) {
        if (activity == ACTIVITY_ROAD)     return "Road";
        if (activity == ACTIVITY_IRRIGATE) return "Irrigation";
        if (activity == ACTIVITY_MINE)     return "Mine";
        if (activity == ACTIVITY_RAILROAD) return "Railroad";
        return "";
    }

    /**
     * Checks whether a city generates pollution this turn and, if so, places it
     * on a random tile within the city radius.
     *
     * <p>The pollution level is calculated as:
     * <pre>
     *   pollution = max(0, shieldOutput + citySize - BASE_POLLUTION)
     * </pre>
     * This mirrors {@code city_pollution_types()} in {@code common/city.c}:
     * one pollution per shield, one per citizen, minus the base offset of
     * {@value #BASE_POLLUTION} ({@code RS_DEFAULT_BASE_POLLUTION = -20}).
     *
     * <p>If {@code random(100) < pollution}, the Pollution extra bit is set on a
     * randomly chosen tile within the city's 3×3 neighbourhood (the city centre
     * plus up to 8 adjacent tiles).  Tiles that already have pollution are
     * skipped.  Mirrors {@code check_pollution()} and {@code place_pollution()}
     * in the C Freeciv server's {@code server/cityturn.c}.
     *
     * @param game   the current game state
     * @param cityId the ID of the city to check
     */
    public static void checkPollution(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return;

        // Calculate pollution level: shields + population - base offset.
        // Mirrors city_pollution_types() in common/city.c:
        //   prod = shield_total * (100 + EFT_POLLU_PROD_PCT) / 100   (one per shield)
        //   pop  = city_size * (100 + EFT_POLLU_POP_PCT) / 100       (one per citizen)
        //   mod  = game.info.base_pollution                           (-20 by default)
        //   total = max(0, prod + pop + mod)
        // Use terrain-based shield output from the city centre tile for the shield estimate.
        Tile centerTile = game.tiles.get(city.getTile());
        int[] centerOutput = getTileOutput(game, centerTile, true /* city center */);
        int shieldOutput = computeCityShieldOutput(city, centerOutput);
        int pollution = Math.max(0, shieldOutput + city.getSize() - BASE_POLLUTION);
        if (pollution == 0) return;

        // Probabilistic: only place pollution if random roll is below pollution level.
        // Mirrors: if (fc_rand(100) < pcity->pollution) { place_pollution(...) }
        if (ThreadLocalRandom.current().nextInt(100) >= pollution) return;

        // Collect candidate tiles: city centre + 8 adjacent tiles.
        // Mirrors place_pollution() picking from city_map_tiles(city_radius_sq).
        int xsize = game.map.getXsize();
        int ysize = game.map.getYsize();
        Tile cityTile = game.tiles.get(city.getTile());
        if (cityTile == null) return;

        long cx = cityTile.getX(xsize);
        long cy = cityTile.getY(xsize);

        // Collect tiles within radius 1 (3×3 neighbourhood) that do not already
        // have pollution; the city centre is included as a valid target.
        List<Tile> candidates = new ArrayList<>();
        for (int dy = -1; dy <= 1; dy++) {
            long ny = cy + dy;
            if (ny < 0 || ny >= ysize) continue; // off the top/bottom edge
            for (int dx = -1; dx <= 1; dx++) {
                long nx = ((cx + dx) % xsize + xsize) % xsize; // wrap horizontally
                long tileIdx = ny * xsize + nx;
                Tile t = game.tiles.get(tileIdx);
                if (t == null) continue;
                // Skip tiles that already have pollution
                if ((t.getExtras() & (1 << EXTRA_BIT_POLLUTION)) != 0) continue;
                candidates.add(t);
            }
        }

        if (candidates.isEmpty()) return; // nowhere to place pollution

        // Pick a random tile from the candidates and add the Pollution extra.
        Tile target = candidates.get(ThreadLocalRandom.current().nextInt(candidates.size()));
        target.setExtras(target.getExtras() | (1 << EXTRA_BIT_POLLUTION));
        game.getServer().sendTileInfoAll(target);
        Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                "Pollution has appeared near " + city.getName() + ".");
    }

    /**
     * Removes buildings from all of a player's cities that have become obsolete
     * because the player has acquired the required technology.  The player receives
     * a partial gold refund equal to half the building's build cost, mirroring
     * {@code do_sell_building()} in the C Freeciv server's {@code cityturn.c}.
     *
     * <p>Only buildings whose {@code obsoletedByTechName} matches a technology the
     * player currently knows are affected; "World"-range obsolescence (triggered by
     * any player discovering a tech) is not handled here.
     *
     * <p>Mirrors {@code remove_obsolete_buildings_city()} in the C Freeciv server's
     * {@code server/cityturn.c}.
     *
     * @param game     the current game state
     * @param playerId the ID of the player whose cities should be checked
     */
    public static void removeObsoleteBuildingsForPlayer(Game game, long playerId) {
        Player player = game.players.get(playerId);
        if (player == null) return;

        for (Map.Entry<Long, City> entry : game.cities.entrySet()) {
            City city = entry.getValue();
            if (city == null || city.getOwner() != playerId) continue;
            long cityId = entry.getKey();

            List<Integer> toRemove = new ArrayList<>();
            for (int improvId : new ArrayList<>(city.getImprovements())) {
                Improvement impr = game.improvements.get((long) improvId);
                if (impr == null) continue;

                String obsoletedBy = impr.getObsoletedByTechName();
                if (obsoletedBy == null || obsoletedBy.isEmpty()) continue;

                // Check whether the player knows the tech that obsoletes this building.
                boolean playerHasObsoletingTech = false;
                for (long techId : player.getKnownTechs()) {
                    Technology tech = game.techs.get(techId);
                    if (tech != null && obsoletedBy.equalsIgnoreCase(tech.getName())) {
                        playerHasObsoletingTech = true;
                        break;
                    }
                }

                if (playerHasObsoletingTech) {
                    toRemove.add(improvId);
                }
            }

            for (int improvId : toRemove) {
                city.getImprovements().remove(Integer.valueOf(improvId));
                Improvement impr = game.improvements.get((long) improvId);
                if (impr != null) {
                    // Partial gold refund: half the build cost, mirroring
                    // impr_sell_gold() in the C Freeciv server.
                    int sellGold = impr.getBuildCost() / 2;
                    player.setGold(player.getGold() + sellGold);
                    Notify.notifyPlayer(game, game.getServer(), playerId,
                            city.getName() + " is selling " + impr.getName()
                                    + " (obsolete) for " + sellGold + " gold.");
                }
            }

            if (!toRemove.isEmpty()) {
                VisibilityHandler.sendCityToVisiblePlayers(game, cityId);
            }
        }

        // Broadcast updated player gold to all clients after all sales.
        game.getServer().sendPlayerInfoAll(player);
    }
}
