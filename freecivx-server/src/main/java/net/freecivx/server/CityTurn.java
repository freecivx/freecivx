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
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
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
    /** Republic government ID – lower corruption than Monarchy. */
    private static final int GOV_REPUBLIC  = 4;
    /** Democracy government ID – zero corruption, highest happiness threshold. */
    private static final int GOV_DEMOCRACY = 5;

    /**
     * Food consumed per citizen per turn.  Mirrors {@code RS_DEFAULT_FOOD_COST = 2}
     * in the C Freeciv server's {@code common/game.h}.  Each of a city's citizens
     * (equal to city size) consumes this many food units per turn; the remainder
     * is the food surplus that accumulates toward city growth.
     */
    static final int RS_DEFAULT_FOOD_COST = 2;

    /**
     * Number of military units whose gold upkeep is covered "for free" per city
     * for governments that support shield-upkeep units (Anarchy, Despotism,
     * Monarchy, Communism).  Mirrors {@code Unit_Upkeep_Free_Per_City = 3} in
     * the classic effects.ruleset ({@code effect_upkeep_free_units_*}).
     */
    private static final int FREE_UNITS_PER_CITY = 3;

    /**
     * Default improvement ID for Granary used as a fallback in
     * {@link #findImprId} when the name lookup fails.  The actual ID is
     * always resolved by name from the loaded ruleset at runtime.
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
     * Fallback improvement ID for Factory.
     * Grants EFT_OUTPUT_BONUS = 50 (shield) in the classic Freeciv
     * {@code effects.ruleset}, increasing shield production by 50%.
     * Requires Industrialization technology.
     */
    private static final int IMPR_FACTORY       = 14;

    /**
     * Fallback improvement ID for Mfg. Plant (Manufacturing Plant).
     * Grants an additional EFT_OUTPUT_BONUS = 50 (shield) when a Factory is
     * also present, for a total +100% shield bonus with both buildings.
     * Requires Plastics technology and Factory as a building prerequisite.
     */
    private static final int IMPR_MFG_PLANT     = 15;

    /**
     * Fallback improvement ID for Research Lab.
     * Grants EFT_OUTPUT_BONUS = 100 (science) when Library is present, and
     * an additional +100% when University is present (total +200% with both).
     * Requires Computers technology and University as a building prerequisite.
     */
    private static final int IMPR_RESEARCH_LAB  = 16;

    /**
     * Fallback improvement ID for Stock Exchange.
     * Grants EFT_OUTPUT_BONUS = 50 (gold) and EFT_OUTPUT_BONUS = 50 (luxury)
     * when Bank is present, for a total of ×2.5 gold/luxury with Marketplace +
     * Bank + Stock Exchange.  Requires Economics technology and Bank as
     * a building prerequisite.
     */
    private static final int IMPR_STOCK_EXCHANGE = 17;

    /**
     * Fallback improvement ID for Police Station.
     * Grants EFT_MAKE_CONTENT_MIL in the classic Freeciv {@code effects.ruleset}:
     * 1 military-caused-unhappy citizen becomes content under Republic, 2 under
     * Democracy.  Implemented here as general make_content since military
     * unhappiness is not tracked separately.
     * Requires Communism technology.
     */
    private static final int IMPR_POLICE_STATION = 18;

    /**
     * Fallback improvement ID for Harbour.
     * Grants EFT_OUTPUT_ADD_TILE = 1 (food) on all oceanic tiles worked by the
     * city in the classic Freeciv {@code effects.ruleset}.  Mirrors the
     * {@code effect_harbour} effect which adds +1 food to each oceanic tile.
     */
    private static final int IMPR_HARBOUR          = 8;

    /**
     * Fallback improvement ID for Offshore Platform.
     * Grants EFT_OUTPUT_ADD_TILE = 1 (shield) on all oceanic tiles worked by
     * the city.  Mirrors the {@code effect_offshore_platform} effect.
     * Requires Miniaturization technology.
     */
    private static final int IMPR_OFFSHORE_PLATFORM = 19;

    /**
     * Fallback improvement ID for Power Plant.
     * Grants EFT_OUTPUT_BONUS = 25 (shield) once for each of Factory and
     * Mfg. Plant present, but only when no Hoover Dam, Nuclear Plant, Hydro
     * Plant, or Solar Plant is active.  Mirrors {@code effect_power_plant} in
     * the classic Freeciv {@code effects.ruleset}.
     * Requires Refining technology.
     */
    private static final int IMPR_POWER_PLANT      = 20;

    /**
     * Fallback improvement ID for Hydro Plant.
     * Same shield bonus as Power Plant (+25% per Factory/Mfg.Plant) but
     * reduces production pollution by 25% per Factory/Mfg.Plant.  Active
     * only when no Hoover Dam, Nuclear Plant, or Solar Plant is present.
     * Requires Electronics technology.
     */
    private static final int IMPR_HYDRO_PLANT      = 9;  // positional after Harbour

    /**
     * Fallback improvement ID for Nuclear Plant.
     * Same shield bonus as Power Plant (+25% per Factory/Mfg.Plant) and
     * reduces production pollution by 25% per Factory/Mfg.Plant.  Active
     * only when no Hoover Dam or Solar Plant is present.
     * Requires Nuclear Power technology.
     */
    private static final int IMPR_NUCLEAR_PLANT    = 16;

    /**
     * Fallback improvement ID for Solar Plant.
     * Grants EFT_OUTPUT_BONUS = 25 (shield) per Factory/Mfg.Plant and reduces
     * production pollution by 50% per Factory/Mfg.Plant.  No exclusions —
     * Solar Plant always overrides lower-tier power sources.
     * Requires Environmentalism technology.
     */
    private static final int IMPR_SOLAR_PLANT      = 25;

    /**
     * Fallback improvement ID for Recycling Center.
     * Grants EFT_POLLU_PROD_PCT = -66 in the classic Freeciv
     * {@code effects.ruleset}, reducing production-based city pollution by
     * two-thirds.  Mirrors {@code effect_recycling_center}.
     * Requires Recycling technology.
     */
    private static final int IMPR_RECYCLING_CENTER = 24;

    // -------------------------------------------------------------------------
    // Improvement genus constants (match Improvement.getGenus() values).
    // Mirrors the improvement_genus_id enum in the C Freeciv server's
    // common/improvement.h.
    // -------------------------------------------------------------------------
    /** Genus value for a Great Wonder improvement (e.g. Pyramids, Great Wall). */
    private static final int GENUS_GREAT_WONDER  = 0;
    /** Genus value for a Small Wonder improvement (e.g. Palace). */
    private static final int GENUS_SMALL_WONDER  = 1;
    /**
     * Genus value for a regular city improvement (e.g. Library, Barracks, Temple).
     * These can be sold when a player cannot afford their upkeep.
     * Mirrors {@code IG_IMPROVEMENT} in the C Freeciv server's
     * {@code common/improvement.h}.
     */
    private static final int GENUS_IMPROVEMENT   = 2;
    /**
     * Genus value for a Special improvement (Space Structural, Space Component,
     * Space Module).  Special improvements are consumed into the player's
     * spaceship rather than being stored as city buildings.
     * Mirrors {@code BG_SPECIAL} in the C Freeciv server's
     * {@code common/improvement.h}.
     */
    private static final int GENUS_SPECIAL       = 3;

    /**
     * Number of consecutive disorder turns after which the city warns about
     * impending revolution.  Mirrors the {@code EFT_REVOLUTION_UNHAPPINESS}
     * default value of 5 in the classic Freeciv effects.ruleset.
     */
    private static final int REVOLUTION_TURNS = 5;

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

    /**
     * Activity code for a fortified unit.
     * A fortified unit receives a +50% defence bonus from
     * {@code Fortify_Defense_Bonus = 50} in classic {@code effects.ruleset}.
     * Mirrors {@code ACTIVITY_FORTIFIED = 4} in the C Freeciv server's
     * {@code common/fc_types.h} and the JS client's {@code fc_types.js}.
     * Value 3 is {@code ACTIVITY_IRRIGATE} in the protocol and must not be
     * used here.
     */
    public static final int ACTIVITY_FORTIFIED = 4;

    /** Number of turns a worker needs to complete a road. */
    private static final int ROAD_TURNS = 2;
    /** Number of turns a worker needs to complete an irrigation channel. */
    private static final int IRRIGATE_TURNS = 5;
    /** Number of turns a worker needs to complete a mine. */
    private static final int MINE_TURNS = 5;
    /** Number of turns a worker needs to complete a railroad. */
    private static final int RAILROAD_TURNS = 4;

    /**
     * Activity code for a sentried unit.
     * A sentried unit skips its turn and wakes up automatically when an
     * enemy unit comes into view.  Mirrors {@code ACTIVITY_SENTRY} in the
     * C Freeciv server's {@code common/fc_types.h}.
     */
    public static final int ACTIVITY_SENTRY = 6;

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
     * Minimum city size required for a city to start celebrating (rapture).
     * Mirrors {@code GAME_DEFAULT_CELEBRATESIZE = 3} in the C Freeciv server's
     * {@code common/game.h}: cities smaller than this can never be in rapture
     * regardless of how many happy citizens they have.
     */
    private static final int CELEBRATE_SIZE = 3;

    /**
     * Government IDs for which {@code EFT_RAPTURE_GROW > 0} in the classic
     * Freeciv {@code effects.ruleset}.  These governments enable rapture growth:
     * when a city with size ≥ {@value #CELEBRATE_SIZE} has been happy for at least
     * one turn, it may grow by one population each turn (regardless of the food
     * granary) as long as it has a positive food surplus.  Mirrors
     * {@code effect_rapture_grow_0} (Republic) and {@code effect_rapture_grow_1}
     * (Democracy) in {@code data/classic/effects.ruleset}.
     */
    private static final int GOV_RAPTURE_REPUBLIC   = GOV_REPUBLIC;
    private static final int GOV_RAPTURE_DEMOCRACY  = GOV_DEMOCRACY;

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
     *   granary_food_ini[0] = 20 (base amount of food for any city size)
     *   granary_food_inc    = 10 (additional food per citizen above size 0)
     *   foodbox             = 100 (no scaling modifier)
     * Formula: granary_food_ini + granary_food_inc * city_size = 20 + 10*size.
     * Mirrors {@code city_granary_size()} in the C Freeciv server's
     * {@code common/city.c}:
     * {@code food_inis + food_incs * city_size} where
     * {@code food_inis = foodbox * granary_food_ini / 100 = 100 * 20 / 100 = 20}
     * and {@code food_incs = foodbox * granary_food_inc / 100 = 100 * 10 / 100 = 10}.
     *
     * @param citySize the current population size of the city
     * @return the amount of food required to fill the granary and grow
     */
    public static int cityGranarySize(int citySize) {
        if (citySize <= 0) return 0;
        // Mirrors city_granary_size() in C Freeciv server's common/city.c.
        // RS_DEFAULT_GRANARY_FOOD_INI=20, RS_DEFAULT_GRANARY_FOOD_INC=10, foodbox=100.
        // C formula: food_inis + food_incs * city_size = 20 + 10 * city_size.
        return 20 + 10 * citySize;
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
        int xsize = game.map.getXsize();
        int cx = (int) (centerTile % xsize);
        int cy = (int) (centerTile / xsize);

        // City working radius: Euclidean squared distance ≤ CITY_RADIUS_SQ=5.
        // Mirrors the classic Freeciv RS_DEFAULT_CITY_RADIUS_SQ and the
        // JS client's build_city_tile_map(city_radius_sq).
        int r = (int) Math.floor(Math.sqrt(CityTools.CITY_RADIUS_SQ));

        int bestScore = -1;
        Tile bestTile = null;

        for (int dy = -r; dy <= r; dy++) {
            for (int dx = -r; dx <= r; dx++) {
                if (dx * dx + dy * dy > CityTools.CITY_RADIUS_SQ) continue;
                if (dx == 0 && dy == 0) continue; // center already worked
                // Cylindrical (horizontal) wrap
                int nx = ((cx + dx) % xsize + xsize) % xsize;
                int ny = cy + dy;
                if (ny < 0 || ny >= game.map.getYsize()) continue;
                long tileId = (long) ny * xsize + nx;
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
        } else {
            // No free tile available – the new citizen becomes an Entertainer specialist.
            // Mirrors the fallback in city_auto_arrange_workers() / cm.c where idle
            // citizens that cannot be placed on tiles fill specialist slots.
            city.getSpecialists()[0]++;
        }
    }

    /**
     * Computes the total food, shield, and trade output of a city by summing
     * the output of every tile currently in {@link City#getWorkedTiles()}.
     * The city-centre tile receives the +1/+1/+1 centre bonus; all other tiles
     * are evaluated without it.
     *
     * <p>Mirrors the worked-tile iteration in {@code city_tile_output()} and
     * {@code city_collect_output()} in the C Freeciv server's
     * {@code common/city.c}: the city's total raw output is the sum of each
     * worked tile's individual output.
     *
     * @param game the current game state
     * @param city the city whose worked-tile output is needed
     * @return int[3] = {totalFood, totalShields, totalTrade}; all values ≥ 0
     */
    private static int[] computeWorkedTilesOutput(Game game, City city) {
        long centerTileId = city.getTile();
        int totalFood = 0, totalShields = 0, totalTrade = 0;

        // Resolve Harbour and Offshore Platform IDs once per city computation.
        // These buildings add +1 food / +1 shield to every oceanic tile worked
        // by the city.  Mirrors effect_harbour and effect_offshore_platform in
        // the classic Freeciv effects.ruleset (Output_Add_Tile = 1).
        int harbourId        = findImprId(game, "Harbor",           IMPR_HARBOUR);
        int offPlatformId    = findImprId(game, "Offshore Platform", IMPR_OFFSHORE_PLATFORM);
        boolean hasHarbour   = city.hasImprovement(harbourId);
        boolean hasOffPlat   = city.hasImprovement(offPlatformId);

        for (long tileId : city.getWorkedTiles()) {
            Tile t = game.tiles.get(tileId);
            if (t == null) continue;
            boolean isCenter = (tileId == centerTileId);
            int[] out = getTileOutput(game, t, isCenter);
            // Apply Harbour and Offshore Platform bonuses for oceanic tiles.
            if (hasHarbour || hasOffPlat) {
                Terrain terrain = game.terrains.get((long) t.getTerrain());
                if (terrain != null && terrain.isOceanic()) {
                    if (hasHarbour)  out[0]++;  // +1 food  (effect_harbour)
                    if (hasOffPlat)  out[1]++;  // +1 shield (effect_offshore_platform)
                }
            }
            totalFood    += out[0];
            totalShields += out[1];
            totalTrade   += out[2];
        }
        return new int[]{totalFood, totalShields, totalTrade};
    }

    /**
     * Removes one specialist from the city, preferring Entertainers (index 0)
     * first, then Taxmen (1), then Scientists (2).  This matches the forward
     * iteration used in {@code city_reduce_specialists()} in the C Freeciv
     * server's {@code server/citytools.c} and is consistent with
     * {@link net.freecivx.server.CityHand#handleCityMakeWorker}.
     *
     * @param city the city from which to remove a specialist
     * @return {@code true} if a specialist was removed; {@code false} if there
     *         were no specialists to remove
     */
    private static boolean removeOneSpecialist(City city) {
        int[] specs = city.getSpecialists();
        for (int i = 0; i < specs.length; i++) {
            if (specs[i] > 0) {
                specs[i]--;
                return true;
            }
        }
        return false;
    }

    /**
     * Releases the least-productive non-centre worked tile from the city when
     * the city shrinks due to starvation.  The tile with the lowest combined
     * food+shield+trade output is unassigned so the citizen can no longer work
     * it.  The city-centre tile is never released.
     *
     * <p>Mirrors {@code city_reduce_size()} / the tile-release step in the C
     * Freeciv server's {@code server/citytools.c} where a worked tile is
     * unassigned on population loss.
     *
     * @param game the current game state
     * @param city the shrinking city
     */
    private static void releaseWorstWorkedTile(Game game, City city) {
        long centerTileId = city.getTile();
        long worstTileId = -1;
        int worstScore = Integer.MAX_VALUE;
        for (long tileId : city.getWorkedTiles()) {
            if (tileId == centerTileId) continue; // never release city centre
            Tile t = game.tiles.get(tileId);
            if (t == null) continue;
            int[] out = getTileOutput(game, t, false);
            int score = out[0] + out[1] + out[2];
            if (score < worstScore) {
                worstScore = score;
                worstTileId = tileId;
            }
        }
        if (worstTileId >= 0) {
            Tile t = game.tiles.get(worstTileId);
            if (t != null) {
                t.setWorked(-1);
                game.getServer().sendTileInfoAll(t);
            }
            city.removeWorkedTile(worstTileId);
        }
    }

    /**
     * Recalculates national borders for all cities and updates tiles whose
     * owner has changed.  Only tiles where the ownership changes are
     * re-broadcast to clients.
     *
     * <p>Mirrors {@code common/borders.c} and {@code server/maphand.c} from
     * the C Freeciv server:
     * <ul>
     *   <li>Border radius (squared): {@code border_city_radius_sq(17) +
     *       min(city_size, CITY_MAP_MAX_RADIUS_SQ(26)) * border_size_effect(1)}</li>
     *   <li>Border strength at a tile: {@code (city_size + 2)^2 / sq_dist}
     *       — the city with the highest strength claims the tile; ties go to
     *       the current claimer (older city wins).</li>
     *   <li>Squared Euclidean distance with horizontal (cylindrical) map
     *       wrapping mirrors {@code sq_map_distance()} in the C server.</li>
     * </ul>
     *
     * @param game the current game state
     */
    public static void updateBorders(Game game) {
        int mapWidth  = game.map.getXsize();

        // Default ruleset constants (common/game.h)
        // RS_DEFAULT_BORDER_RADIUS_SQ_CITY = 17 (city radius 4)
        // RS_DEFAULT_BORDER_SIZE_EFFECT    = 1
        // CITY_MAP_MAX_RADIUS_SQ           = 5*5+1 = 26
        final int BORDER_CITY_RADIUS_SQ = 17;
        final int BORDER_SIZE_EFFECT    = 1;
        final int CITY_MAP_MAX_RADIUS_SQ = 26;

        for (Tile tile : game.tiles.values()) {
            long tileId = tile.getIndex();
            int tx = (int)(tileId % mapWidth);
            int ty = (int)(tileId / mapWidth);

            int bestOwner = -1;
            long bestStrength = 0;  // 0 means unclaimed

            for (City city : game.cities.values()) {
                long cityTile = city.getTile();
                int cx = (int)(cityTile % mapWidth);
                int cy = (int)(cityTile / mapWidth);

                // Squared Euclidean distance with horizontal cylindrical wrap
                // (mirrors sq_map_distance() in the C server).
                // Cast to long before subtraction to avoid int overflow.
                long rawDx = Math.abs((long) tx - cx);
                long wrappedDx = Math.min(rawDx, mapWidth - rawDx);
                long dy = (long) ty - cy;
                long sqDist = wrappedDx * wrappedDx + dy * dy;

                // Border radius (squared) grows with city size, capped at CITY_MAP_MAX_RADIUS_SQ
                int citySize = city.getSize();
                int radiusSq = BORDER_CITY_RADIUS_SQ
                        + Math.min(citySize, CITY_MAP_MAX_RADIUS_SQ) * BORDER_SIZE_EFFECT;

                if (sqDist > radiusSq) {
                    continue;  // Tile is outside this city's border radius
                }

                // Border strength = (city_size + 2)^2 / sq_dist
                // (mirrors tile_border_strength() in common/borders.c)
                long strength;
                if (sqDist == 0) {
                    // City centre: infinite strength (always claimed by its city)
                    strength = Long.MAX_VALUE;
                } else {
                    long baseBorderStrength = citySize + 2;
                    strength = baseBorderStrength * baseBorderStrength / sqDist;
                }

                // Stronger city wins; ties keep existing claimer (bestOwner)
                if (strength > bestStrength) {
                    bestStrength = strength;
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
     * This is necessary because improvement IDs are assigned in the order
     * buildings appear in the loaded ruleset file.
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
     * Returns {@code true} if any city in the entire game already contains the
     * named improvement (typically used for Great Wonders to enforce uniqueness).
     *
     * <p>Mirrors {@code wonder_is_built()} / {@code player_has_wonder()} in the
     * C Freeciv server's {@code common/improvement.c}: a Great Wonder can exist
     * in at most one city across all civilisations simultaneously.
     *
     * @param game        the current game state
     * @param wonderName  the display name of the improvement (case-insensitive)
     * @return {@code true} when the wonder is present in any city in the world
     */
    public static boolean worldHasWonder(Game game, String wonderName) {
        int id = findImprId(game, wonderName, -1);
        if (id < 0) return false;
        for (City city : game.cities.values()) {
            if (city.hasImprovement(id)) return true;
        }
        return false;
    }

    /**
     * Returns {@code true} if any city owned by the given player contains the
     * named improvement.  Used to check player-scope wonder effects such as the
     * Lighthouse (sea unit bonus) and Great Wall (defensive bonus for all cities).
     *
     * <p>Mirrors the {@code "Player"}-scope requirement check in the C Freeciv
     * server's {@code effects.ruleset} (e.g. {@code Building: Lighthouse (Player)}).
     *
     * @param game       the current game state
     * @param playerId   the player to check
     * @param wonderName the display name of the improvement (case-insensitive)
     * @return {@code true} when any of the player's cities contains the wonder
     */
    public static boolean playerHasWonder(Game game, long playerId, String wonderName) {
        int id = findImprId(game, wonderName, -1);
        if (id < 0) return false;
        for (City city : game.cities.values()) {
            if (city.getOwner() == playerId && city.hasImprovement(id)) return true;
        }
        return false;
    }

    /**
     * Computes the total shield (production) output for a city based on its
     * centre tile output and city size.
     *
     * <p>Shield output is the sum of all tiles in {@link City#getWorkedTiles()},
     * giving each tile's terrain shield value (with city-centre +1 bonus on the
     * centre tile).  The result is always at least 1 shield per turn.
     *
     * @param game the current game state
     * @param city the city whose shield output is needed
     * @return shield output per turn (≥ 1)
     */
    private static int computeCityShieldOutput(Game game, City city) {
        int[] workedOutput = computeWorkedTilesOutput(game, city);
        return Math.max(1, workedOutput[1]);
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
     * <p>Shield output is the sum of all worked tiles (city centre + citizen tiles),
     * so productive terrain types (Forest = 3 shields/turn, Plains = 2 shields/turn)
     * build improvements faster than barren terrain.
     *
     * @param game   the current game state
     * @param cityId the ID of the city whose production is being processed
     */
    public static void cityProduction(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return;

        // Shield output: sum of all worked tiles (centre + citizens' tiles).
        // Mirrors shield output from worked tiles in the C Freeciv server.
        int shieldOutput = computeCityShieldOutput(game, city);

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

        // Apply Factory and Mfg. Plant production bonuses.
        // Mirrors effect_factory (+50% shields) and effect_mfg_plant (+50% additional
        // shields when Factory is present) in the classic Freeciv effects.ruleset.
        // Combined: Factory alone = ×1.5; Factory + Mfg. Plant = ×2.0.
        // Ceiling division preserves fractional shield output for small cities.
        int factoryId  = findImprId(game, "Factory",   IMPR_FACTORY);
        int mfgPlantId = findImprId(game, "Mfg. Plant", IMPR_MFG_PLANT);
        boolean hasFactory  = city.hasImprovement(factoryId);
        boolean hasMfgPlant = hasFactory && city.hasImprovement(mfgPlantId);
        int shieldBonus = 0;
        if (hasFactory)  shieldBonus += 50; // Factory: +50% (effect_factory)
        if (hasMfgPlant) shieldBonus += 50; // Mfg. Plant (requires Factory): +50% additional

        // Energy source: adds +25% shields per Factory and per Mfg.Plant.
        // The highest-priority power source wins; each applies its bonus once per
        // applicable prerequisite building (Factory or Mfg.Plant).
        // Priority chain (mirrors effects.ruleset exclusion logic):
        //   Solar Plant (no exclusions) > Nuclear Plant (excl. Solar) >
        //   Hydro Plant (excl. Solar/Nuclear/Hoover Dam) >
        //   Power Plant (excl. Solar/Nuclear/Hydro/Hoover Dam) >
        //   Hoover Dam wonder (player scope, excl. by local plants).
        // Mirrors effect_power_plant, effect_hydro_plant, effect_nuclear_plant,
        // effect_solar_plant, and effect_hoover_dam in effects.ruleset.
        if (hasFactory || hasMfgPlant) {
            boolean hooverDam    = playerHasWonder(game, city.getOwner(), "Hoover Dam");
            int solarPlantId   = findImprId(game, "Solar Plant",   IMPR_SOLAR_PLANT);
            int nuclearPlantId = findImprId(game, "Nuclear Plant", IMPR_NUCLEAR_PLANT);
            int hydroPlantId   = findImprId(game, "Hydro Plant",   IMPR_HYDRO_PLANT);
            int powerPlantId   = findImprId(game, "Power Plant",   IMPR_POWER_PLANT);
            boolean hasSolar   = city.hasImprovement(solarPlantId);
            boolean hasNuclear = city.hasImprovement(nuclearPlantId);
            boolean hasHydro   = city.hasImprovement(hydroPlantId);
            boolean hasPower   = city.hasImprovement(powerPlantId);

            // Determine which energy source is active (highest priority wins).
            // Each active source adds +25% once per Factory and once per Mfg.Plant.
            int energyBonus = 0;
            if (hasSolar) {
                // Solar Plant: always fires, no exclusions (effect_solar_plant/1).
                energyBonus = 25;
            } else if (hasNuclear && !hooverDam) {
                // Nuclear Plant: fires unless Hoover Dam or Solar Plant present.
                energyBonus = 25;
            } else if (hasHydro && !hooverDam && !hasNuclear) {
                // Hydro Plant: fires unless Hoover Dam, Nuclear, or Solar present.
                energyBonus = 25;
            } else if (hasPower && !hooverDam && !hasNuclear && !hasHydro) {
                // Power Plant: fires only with no Hoover Dam and no better plant.
                energyBonus = 25;
            } else if (hooverDam && !hasSolar && !hasNuclear && !hasHydro && !hasPower) {
                // Hoover Dam (player wonder): provides plant-equivalent bonus to all
                // cities when no local plant is present (effect_hoover_dam/1).
                energyBonus = 25;
            }

            if (energyBonus > 0) {
                if (hasFactory)  shieldBonus += energyBonus;
                if (hasMfgPlant) shieldBonus += energyBonus;
            }

            // Hoover Dam stacks with Solar Plant (Solar has no Hoover Dam exclusion).
            // Mirrors the additive effect model in Freeciv: each effect fires independently.
            if (hooverDam && hasSolar) {
                if (hasFactory)  shieldBonus += 25; // Hoover Dam + Factory (Solar already added)
                if (hasMfgPlant) shieldBonus += 25; // Hoover Dam + Mfg.Plant
            }
        }
        if (shieldBonus > 0) {
            shieldOutput = (shieldOutput * (100 + shieldBonus) + 99) / 100;
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
                        // Great Wonder uniqueness: only one civilisation can own each
                        // great wonder simultaneously.  Mirrors wonder_is_built() /
                        // city_build_building() checks in the C Freeciv server's
                        // server/citytools.c and server/cityhand.c.
                        if (improvement.getGenus() == GENUS_GREAT_WONDER
                                && worldHasWonder(game, improvement.getName())) {
                            // Another civilisation has already built this wonder.
                            // Discard accumulated shields and reset production.
                            // Mirrors the C server behaviour where wonder production
                            // is cancelled when another player beats the builder to it.
                            city.setShieldStock(0);
                            city.setProductionKind(0);
                            city.setProductionValue(-1);
                            Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                                    city.getName() + ": " + improvement.getName()
                                    + " has already been built by another civilization!");
                            VisibilityHandler.sendCityToVisiblePlayers(game, cityId);
                            return;
                        }

                        // Special genus = spaceship part (Space Structural, Space
                        // Component, Space Module).  These parts are consumed into the
                        // player's spaceship instead of being stored as city buildings.
                        // Apollo Program must be built somewhere in the world first.
                        // Mirrors the BG_SPECIAL handling in spacerace.c and
                        // city_build_building() in the C Freeciv server.
                        if (improvement.getGenus() == GENUS_SPECIAL) {
                            if (!worldHasWonder(game, "Apollo Program")) {
                                Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                                        city.getName() + " cannot build " + improvement.getName()
                                        + ": requires the Apollo Program wonder first.");
                                VisibilityHandler.sendCityToVisiblePlayers(game, cityId);
                                return;
                            }
                            // Add part to the player's spaceship
                            if (player != null) {
                                net.freecivx.game.Spaceship ship = player.getSpaceship();
                                String partName = improvement.getName();
                                if (partName.equalsIgnoreCase("Space Structural")) {
                                    ship.addStructural();
                                } else if (partName.equalsIgnoreCase("Space Component")) {
                                    ship.addComponent();
                                } else if (partName.equalsIgnoreCase("Space Module")) {
                                    ship.addModule();
                                }
                                Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                                        city.getName() + " has built a " + partName + ".");
                                game.getServer().sendSpaceshipInfo(player);
                            }
                            city.setShieldStock(city.getShieldStock() - cost);
                            // Space parts can be built multiple times – keep production
                            // queued so the city continues building the same part type.
                            VisibilityHandler.sendCityToVisiblePlayers(game, cityId);
                            return;
                        }

                        // Prevent re-building an improvement the city already has.
                        // Mirrors can_city_build_improvement_direct() in the C Freeciv server
                        // which returns FALSE when the city already contains the building.
                        // Great wonders are already covered by the worldHasWonder check above;
                        // this guard handles regular improvements and small wonders.
                        if (city.hasImprovement(improvId)) {
                            city.setShieldStock(0);
                            city.setProductionKind(0);
                            city.setProductionValue(-1);
                            Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                                    city.getName() + " already has " + improvement.getName() + ".");
                            VisibilityHandler.sendCityToVisiblePlayers(game, cityId);
                            return;
                        }

                        city.addImprovement(improvId);
                        city.setShieldStock(city.getShieldStock() - cost);

                        // Notify the building player
                        Notify.notifyPlayer(game, game.getServer(),
                                city.getOwner(),
                                city.getName() + " has built " + improvement.getName() + ".");

                        // Broadcast great and small wonder completion to ALL players.
                        // Mirrors notify_action_spectators() / E_WONDER_BUILD in the
                        // C Freeciv server (server/citytools.c city_build_building()).
                        if (improvement.getGenus() == GENUS_GREAT_WONDER
                                || improvement.getGenus() == GENUS_SMALL_WONDER) {
                            Player wonderBuilder = game.players.get(city.getOwner());
                            String civName = (wonderBuilder != null)
                                    ? wonderBuilder.getUsername() : "A civilization";
                            Notify.notifyAllPlayers(game, game.getServer(),
                                    civName + " has built the " + improvement.getName()
                                    + " in " + city.getName() + "!");
                        }

                        // Darwin's Voyage wonder: immediately grants 2 free technologies
                        // to the builder.  Mirrors effect_darwins_voyage (Give_Imm_Tech=2)
                        // in the classic Freeciv effects.ruleset.  The two lowest-ID
                        // technologies that the player can currently research are granted.
                        if ("Darwin's Voyage".equals(improvement.getName())) {
                            int freeTechsGranted = 0;
                            for (Map.Entry<Long, net.freecivx.game.Technology> te
                                    : game.techs.entrySet()) {
                                if (freeTechsGranted >= 2) break;
                                if (TechTools.canPlayerResearch(game, city.getOwner(),
                                        te.getKey())) {
                                    TechTools.giveTechToPlayer(game, city.getOwner(),
                                            te.getKey());
                                    freeTechsGranted++;
                                }
                            }
                        }

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

        // Auto-assign default production for human player cities with nothing queued.
        // When a human city has no production target (productionKind=0, productionValue=-1),
        // automatically queue Settlers if the city is large enough, otherwise queue a
        // basic improvement (Barracks or Granary) so shields are never wasted.
        // Mirrors the "always building something" principle from the C Freeciv server.
        if (player != null && !player.isAi()
                && city.getProductionKind() == 0 && city.getProductionValue() < 0) {
            assignDefaultProduction(game, city, player);
        }

        VisibilityHandler.sendCityToVisiblePlayers(game, cityId);
    }

    /**
     * Assigns a default production target for a human player city that has nothing queued.
     * Queues Settlers when the city is large enough (size ≥ 2), otherwise tries to build
     * a Barracks or Granary so the city is always making progress.
     * Unit/improvement names are matched by the classic ruleset convention, consistent
     * with the name-based lookups used elsewhere in this server (e.g. findImprId).
     */
    private static void assignDefaultProduction(Game game, City city, Player player) {
        // Look up the Settlers unit type by name (unit type ID 0 in the classic ruleset).
        long settlersId = -1;
        for (Map.Entry<Long, UnitType> e : game.unitTypes.entrySet()) {
            if ("Settlers".equalsIgnoreCase(e.getValue().getName())) {
                settlersId = e.getKey();
                break;
            }
        }
        if (settlersId >= 0 && city.getSize() >= 2) {
            UnitType settlersType = game.unitTypes.get(settlersId);
            long techReq = settlersType.getTechReqId();
            if (techReq < 0 || player.hasTech(techReq)) {
                city.setProductionKind(0);
                city.setProductionValue((int) settlersId);
                return;
            }
        }
        // City too small for settlers or tech not met: queue a cheap improvement.
        // Try Barracks first, then Granary (classic ruleset names).
        for (String name : new String[]{"Barracks", "Granary"}) {
            for (Map.Entry<Long, Improvement> e : game.improvements.entrySet()) {
                Improvement impr = e.getValue();
                if (name.equals(impr.getName()) && !city.hasImprovement(e.getKey().intValue())) {
                    long techReq = impr.getTechReqId();
                    if (techReq < 0 || player.hasTech(techReq)) {
                        city.setProductionKind(1);
                        city.setProductionValue(e.getKey().intValue());
                        return;
                    }
                }
            }
        }
    }

    /**
     * Handles population growth for a city at end of turn using the food-stock
     * system from the C Freeciv server ({@code city_populate} in {@code cityturn.c}).
     * Food is accumulated each turn and the city grows when the granary fills.
     * Cities above size 8 require an Aqueduct (improvement id 8) to grow further.
     * If food_stock drops below zero the city shrinks by one (starvation).
     *
     * <p>Food surplus per turn = food production (sum of all worked tiles) minus
     * food maintenance (2 food per citizen, {@code RS_DEFAULT_FOOD_COST = 2} in
     * the C server's {@code common/game.h}).  This matches the C server formula:
     * {@code surplus = food_production - city_size * game.info.food_cost}.
     * Cities on fertile terrain (Grassland = 2 food/tile, irrigated for more)
     * can grow larger; cities on barren terrain may stagnate or starve without
     * irrigation.  Mirrors the terrain-based growth rate in the C Freeciv server.
     *
     * <p>Rapture growth: cities in Republic or Democracy that are celebrating
     * (were happy last turn AND are still happy AND have size ≥ {@value #CELEBRATE_SIZE})
     * and have a positive food surplus grow by one population each turn, even if
     * the food granary is not full.  Mirrors {@code city_rapture_grow()} in the
     * C Freeciv server's {@code common/city.c} and the rapture grow logic in
     * {@code city_populate()} in {@code server/cityturn.c}.
     *
     * @param game   the current game state
     * @param cityId the ID of the city to process for growth
     */
    public static void cityGrowth(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return;

        // Food production: sum of all worked tiles' food output (centre tile + citizen tiles).
        // Mirrors food production from city_tile_output() summed over all worked tiles
        // in the C Freeciv server.  Using actual worked tiles means cities on fertile
        // land grow faster than those on barren terrain, and larger cities generate more
        // food from their additional citizen tiles.
        int[] workedOutput = computeWorkedTilesOutput(game, city);
        int foodProduction = workedOutput[0];

        // Food maintenance: RS_DEFAULT_FOOD_COST food per citizen.
        // Mirrors city_support() food upkeep in the C Freeciv server's common/city.c.
        // Each of the city's citizens (= city size) consumes RS_DEFAULT_FOOD_COST food per turn.
        int foodMaintenance = city.getSize() * RS_DEFAULT_FOOD_COST;

        // Net food surplus: production minus maintenance.
        // Positive → city accumulates food toward growth.
        // Negative → city loses food from stock; if stock < 0 the city starves (shrinks).
        // Mirrors city_surplus[O_FOOD] in the C Freeciv server.
        int foodSurplus = foodProduction - foodMaintenance;

        int granaryImprId = findImprId(game, "Granary", IMPR_GRANARY);
        if (city.hasImprovement(granaryImprId)) {
            // Granary adds 1 food surplus per turn (models the storage efficiency effect).
            foodSurplus += 1;
        }

        // Rapture (celebration) growth: if the city was happy last turn, is still
        // celebrating (happy + size >= CELEBRATE_SIZE), has a positive food surplus,
        // and the government supports rapture growth (Republic or Democracy in the
        // classic Freeciv ruleset), grow the city by one regardless of the granary.
        // Mirrors city_rapture_grow() in common/city.c and the rapture path in
        // city_populate() in server/cityturn.c.
        boolean raptureGrow = isCityRaptureGrow(game, city, foodSurplus);

        int granarySize = cityGranarySize(city.getSize());
        city.setFoodStock(city.getFoodStock() + foodSurplus);

        if (raptureGrow || city.getFoodStock() >= granarySize) {
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
                city.setFoodStock(Math.min(city.getFoodStock(), granarySize));
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
                city.setFoodStock(Math.min(city.getFoodStock(), granarySize));
                Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                        city.getName() + " needs an Aqueduct to grow beyond size "
                                + city.getSize() + ".");
            } else {
                // City grows: increase size and reset granary
                city.setSize(city.getSize() + 1);
                // Rapture growth: keep the full new granary size in the food stock
                // (the city did not "spend" its food growing; it grew by celebration).
                // Mirrors the rapture_grow path in city_increase_size() in C server:
                //   new_food = city_granary_size(new_size)  (no food consumed on rapture grow)
                // Normal growth: apply Granary / Pyramids savings percentage.
                int newGranarySize = cityGranarySize(city.getSize());
                if (raptureGrow) {
                    // Rapture growth: food stock stays full (no granary reset)
                    city.setFoodStock(Math.min(city.getFoodStock(), newGranarySize));
                } else {
                    // Normal growth: Granary retains 50%, Pyramids adds 25%.
                    // Combined: Granary alone = 50% retained; Granary + Pyramids = 75%;
                    //           Pyramids alone = 25% retained.
                    // Mirrors effect_pyramids_grow (Growth_Food=25) in classic effects.ruleset.
                    boolean hasPyramids = playerHasWonder(game, city.getOwner(), "Pyramids");
                    if (city.hasImprovement(granaryImprId)) {
                        int savedFood = newGranarySize / 2;
                        if (hasPyramids) {
                            savedFood = savedFood + newGranarySize / 4; // +25% from Pyramids
                        }
                        city.setFoodStock(Math.min(savedFood, newGranarySize));
                    } else if (hasPyramids) {
                        // Pyramids alone: retain 25% food on growth
                        city.setFoodStock(newGranarySize / 4);
                    } else {
                        city.setFoodStock(0);
                    }
                }
                // Assign a new worked tile to the additional citizen.
                // Mirrors city_choose_tile_to_work() in the C Freeciv server.
                assignNextWorkedTile(game, cityId);
                if (raptureGrow) {
                    Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                            city.getName() + " is growing by leaps and bounds! (size "
                                    + city.getSize() + ")");
                } else {
                    Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                            city.getName() + " has grown to size " + city.getSize() + ".");
                }
            }
        } else if (city.getFoodStock() < 0) {
            // Starvation: city shrinks if size > 1, mirrors city_reduce_size() in C server.
            // In the C server, city_reduce_size() removes a specialist first (if any) before
            // releasing a worked tile.  This matches city_auto_arrange_workers() behaviour:
            // workers are preferred over specialists.  Mirrors the logic in the C Freeciv
            // server's server/citytools.c: city_reduce_specialists() is tried first.
            if (city.getSize() > 1) {
                city.setSize(city.getSize() - 1);
                // Remove a specialist first; fall back to releasing a worked tile.
                if (!removeOneSpecialist(city)) {
                    releaseWorstWorkedTile(game, city);
                }
                Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                        "Famine in " + city.getName() + "! Population has decreased to "
                                + city.getSize() + ".");
            }
            // After shrinking, apply granary savings so the city retains partial food.
            // Mirrors city_shrink_granary_savings() / city_reset_foodbox() in the C server:
            //   EFT_SHRINK_FOOD: Granary = 50%, Pyramids = 25% of new granary capacity.
            // Without a Granary the food stock is reset to 0, matching the C server default.
            int newGranarySize = cityGranarySize(city.getSize());
            boolean hasPyramidsForShrink = playerHasWonder(game, city.getOwner(), "Pyramids");
            if (city.hasImprovement(granaryImprId)) {
                int savedFood = newGranarySize / 2;  // Granary: 50% retained on shrink
                if (hasPyramidsForShrink) {
                    savedFood = (newGranarySize * 3) / 4;  // Granary + Pyramids: 75% retained
                }
                city.setFoodStock(Math.min(savedFood, newGranarySize));
            } else if (hasPyramidsForShrink) {
                city.setFoodStock(newGranarySize / 4);  // Pyramids alone: 25% on shrink
            } else {
                city.setFoodStock(0);
            }
        }

        VisibilityHandler.sendCityToVisiblePlayers(game, cityId);
    }

    /**
     * Returns {@code true} if this city should grow by rapture (celebration)
     * this turn, independent of whether the food granary is full.
     *
     * <p>Rapture growth requires all of the following to be true (mirrors
     * {@code city_rapture_grow()} in the C Freeciv server's {@code common/city.c}):
     * <ol>
     *   <li>The city's {@code rapture} counter is &gt; 0 (it was celebrating last turn)</li>
     *   <li>The city has a positive food surplus this turn</li>
     *   <li>The player's government has {@code EFT_RAPTURE_GROW &gt; 0}
     *       (Republic or Democracy in the classic ruleset)</li>
     *   <li>The city size is at least {@value #CELEBRATE_SIZE}</li>
     * </ol>
     *
     * @param game        the current game state
     * @param city        the city to test
     * @param foodSurplus the city's net food surplus this turn (may be negative)
     * @return {@code true} if the city should grow by rapture
     */
    private static boolean isCityRaptureGrow(Game game, City city, int foodSurplus) {
        if (city.getSize() < CELEBRATE_SIZE) return false;
        if (foodSurplus <= 0) return false;
        if (city.getRapture() <= 0) return false;
        Player player = game.players.get(city.getOwner());
        if (player == null) return false;
        int govId = player.getGovernmentId();
        return govId == GOV_RAPTURE_REPUBLIC || govId == GOV_RAPTURE_DEMOCRACY;
    }

    /**
     * Sends a {@code PACKET_CITY_INFO} update for every city in the game to all
     * human players who can currently see that city's tile (or own it).
     * Called at the start of each new turn so that clients always receive the
     * latest city state after all end-of-turn processing (city growth, production,
     * AI city management) has completed.
     * Mirrors the full-city-broadcast step in the C Freeciv server's
     * {@code send_all_known_cities()} in {@code server/citytools.c}.
     *
     * @param game the current game state
     */
    public static void sendAllCitiesToVisiblePlayers(Game game) {
        for (long cityId : new java.util.ArrayList<>(game.cities.keySet())) {
            VisibilityHandler.sendCityToVisiblePlayers(game, cityId);
        }
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
        List<Long> cityIds = new ArrayList<>(game.cities.keySet());

        // Apply city governor (CMA) for all cities in parallel using Java 21 virtual
        // threads.  Each city is fully independent: it releases its own tiles and
        // reclaims the best ones.  Cities of the same player serialise via
        // Player.playerLock (a ReentrantLock, not synchronized, so virtual threads
        // can unmount while waiting — JEP 444) to prevent two sibling cities
        // claiming the same tile simultaneously.  Mirrors the cm_result /
        // cm_query_result() call in the C Freeciv server's cityturn.c before each
        // city's turn is processed.
        try (ExecutorService vte = Executors.newVirtualThreadPerTaskExecutor()) {
            List<Future<?>> futures = new ArrayList<>(cityIds.size());
            for (long cityId : cityIds) {
                futures.add(vte.submit(() -> {
                    net.freecivx.game.City c = game.cities.get(cityId);
                    if (c == null) return;
                    // Serialise within the owning player so sibling cities do not
                    // race to claim overlapping tiles.
                    net.freecivx.game.Player owner = game.players.get(c.getOwner());
                    if (owner != null) {
                        owner.playerLock.lock();
                        try {
                            CityGovernor.applyCityGovernor(game, cityId);
                        } finally {
                            owner.playerLock.unlock();
                        }
                    }
                }));
            }
            for (Future<?> f : futures) {
                try { f.get(); } catch (Exception ignored) {
                    // individual city governor errors should not abort the turn
                }
            }
        }

        for (long cityId : cityIds) {
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

            // Bankruptcy: if the player cannot cover upkeep costs, first sell
            // regular improvements (non-wonders, non-specials), then disband
            // military units if still insolvent.
            // Mirrors city_balance_treasury_buildings() followed by
            // city_balance_treasury_units() in the C Freeciv server's cityturn.c.
            if (newGold < 0) {
                // Phase 1: sell sellable buildings (genus == GENUS_IMPROVEMENT).
                // Collect all sellable buildings across all of this player's cities.
                // Mirrors the cityimpr_list iteration in city_balance_treasury_buildings().
                // sellableBuildingEntries: each element is [cityId, improvementId]
                List<long[]> sellableBuildingEntries = new ArrayList<>();
                for (long cityId : game.cities.keySet()) {
                    City city = game.cities.get(cityId);
                    if (city == null || city.getOwner() != pid) continue;
                    for (int improvId : new ArrayList<>(city.getImprovements())) {
                        Improvement impr = game.improvements.get((long) improvId);
                        if (impr != null && impr.getGenus() == GENUS_IMPROVEMENT) {
                            sellableBuildingEntries.add(new long[]{cityId, improvId});
                        }
                    }
                }
                // Shuffle for random sell order, mirroring sell_random_building()
                // in the C Freeciv server (which picks a random index each time).
                Collections.shuffle(sellableBuildingEntries);
                for (long[] entry : sellableBuildingEntries) {
                    if (newGold >= 0) break;
                    long sellCityId = entry[0];
                    int sellImprovId = (int) entry[1];
                    City sellCity = game.cities.get(sellCityId);
                    Improvement impr = game.improvements.get((long) sellImprovId);
                    if (sellCity == null || impr == null) continue;
                    sellCity.removeImprovement(sellImprovId);
                    // Sell price: half build cost (mirrors impr_sell_gold() in C server).
                    // Also recoup the upkeep already charged this turn for this building,
                    // mirroring the gold refund in sell_random_building() in cityturn.c.
                    int sellGold = impr.getBuildCost() / 2 + impr.getUpkeep();
                    newGold += sellGold;
                    Notify.notifyPlayer(game, game.getServer(), pid,
                            "Can't afford to maintain " + impr.getName()
                                    + " in " + sellCity.getName()
                                    + ", building sold!");
                    VisibilityHandler.sendCityToVisiblePlayers(game, sellCityId);
                }

                // Phase 2: if still insolvent, disband military units one by one.
                // Mirrors city_balance_treasury_units() in the C Freeciv server.
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
            }

            player.setGold(Math.max(0, newGold));

            // Update research progress (accumulates science bulbs, completes tech if reached).
            TechTools.playerResearchUpdate(game, pid);

            // Broadcast updated gold and research state to the player's client
            game.getServer().sendPlayerInfoAll(player);
        }

        // Check for global warming after all city updates.
        // Mirrors the update_environmental_upset() call in srv_main.c.
        checkGlobalWarming(game);
    }

    /**
     * Checks whether accumulated global pollution has triggered a global-warming
     * event and, if so, transforms a number of random terrain tiles to simulate
     * environmental degradation.
     *
     * <p>Algorithm (mirrors {@code update_environmental_upset()} in the C Freeciv
     * server's {@code srv_main.c}):
     * <ol>
     *   <li>Count all pollution tiles ({@link #EXTRA_BIT_POLLUTION}) on the map.</li>
     *   <li>Accumulate the count in {@link Game#globalWarmingAccum}.</li>
     *   <li>If the accumulator has not yet exceeded
     *       {@link Game#globalWarmingLevel}, clear the accumulator and return.</li>
     *   <li>Otherwise subtract the level from the accumulator; if a random
     *       roll succeeds (probability proportional to the remainder), trigger
     *       a warming event: transform
     *       {@code (xsize/10 + ysize/10 + accum×5)} random land tiles from
     *       wetter to drier terrain (Grassland→Plains, Plains→Desert) and
     *       broadcast a global notification.</li>
     *   <li>After triggering, reset the accumulator to 0 and raise the level
     *       by {@code (map_tiles + 999) / 1000}, making subsequent events
     *       harder to trigger.</li>
     * </ol>
     *
     * @param game the current game state
     */
    static void checkGlobalWarming(Game game) {
        // Count total pollution tiles on the map.
        int pollutionCount = 0;
        for (Tile tile : game.tiles.values()) {
            if ((tile.getExtras() & (1 << EXTRA_BIT_POLLUTION)) != 0) {
                pollutionCount++;
            }
        }

        if (pollutionCount == 0) return;

        // Accumulate pollution each turn.
        // Mirrors: *accum += count; in update_environmental_upset().
        game.globalWarmingAccum += pollutionCount;

        if (game.globalWarmingAccum < game.globalWarmingLevel) {
            // Not enough accumulated yet; keep counting.
            return;
        }

        // Level threshold crossed.
        game.globalWarmingAccum -= game.globalWarmingLevel;

        // Random chance: trigger warming with probability accum / (map_tiles/20).
        // Mirrors: if (fc_rand((map_num_tiles() + 19) / 20) < *accum) in srv_main.c.
        int mapTiles = game.map.getXsize() * game.map.getYsize();
        int threshold = Math.max(1, (mapTiles + 19) / 20);
        if (ThreadLocalRandom.current().nextInt(threshold) >= game.globalWarmingAccum) {
            return; // Chance did not trigger this turn
        }

        // Warming event fires!  Transform terrain tiles.
        // Number of tiles affected: (xsize/10 + ysize/10 + accum*5).
        // Mirrors the effect parameter in global_warming() in C server maphand.c.
        int effectStrength = (game.map.getXsize() / 10)
                + (game.map.getYsize() / 10)
                + (game.globalWarmingAccum * 5);
        effectStrength = Math.max(1, effectStrength);

        // Build lists of transformable terrain IDs.
        // Grassland (warmer_drier_result = Plains) → and Plains (→ Desert).
        long grasslandId = -1;
        long plainsId    = -1;
        long desertId    = -1;
        for (Map.Entry<Long, Terrain> e : game.terrains.entrySet()) {
            String n = e.getValue().getName();
            if ("Grassland".equalsIgnoreCase(n)) grasslandId = e.getKey();
            else if ("Plains".equalsIgnoreCase(n))    plainsId    = e.getKey();
            else if ("Desert".equalsIgnoreCase(n))    desertId    = e.getKey();
        }

        if (grasslandId < 0 || plainsId < 0 || desertId < 0) {
            // Cannot perform warming without the expected terrain types.
            return;
        }

        // Collect candidate tiles that can be transformed.
        // Only land tiles (Grassland or Plains) that are not city centres or
        // ocean tiles are eligible.  Mirrors the random tile selection in
        // climate_change() in C server maphand.c.
        List<Tile> candidates = new ArrayList<>();
        for (Tile tile : game.tiles.values()) {
            int t = tile.getTerrain();
            if (t == (int) grasslandId || t == (int) plainsId) {
                // Exclude city-centre tiles to avoid disrupting cities.
                boolean isCityTile = game.cities.values().stream()
                        .anyMatch(c -> c.getTile() == tile.getIndex());
                if (!isCityTile) {
                    candidates.add(tile);
                }
            }
        }

        if (candidates.isEmpty()) {
            // No eligible tiles; still reset accumulator and raise level.
        } else {
            // Transform up to effectStrength tiles.
            Collections.shuffle(candidates,
                    new java.util.Random(ThreadLocalRandom.current().nextLong()));
            int changed = 0;
            for (Tile tile : candidates) {
                if (changed >= effectStrength) break;
                int t = tile.getTerrain();
                int newTerrain;
                if (t == (int) grasslandId) {
                    newTerrain = (int) plainsId;  // Grassland → Plains (drier)
                } else if (t == (int) plainsId && desertId >= 0) {
                    newTerrain = (int) desertId;  // Plains → Desert (drier)
                } else {
                    continue;
                }
                tile.setTerrain(newTerrain);
                // Clear irrigation (no longer relevant after drying)
                tile.setExtras(tile.getExtras() & ~(1 << EXTRA_BIT_IRRIGATION));
                game.getServer().sendTileInfoAll(tile);
                changed++;
            }
        }

        // Reset accumulator and raise the warming level so successive events
        // require more pollution.  Mirrors the post-event reset in srv_main.c:
        //   *accum = 0; *level += (map_num_tiles() + 999) / 1000;
        game.globalWarmingAccum = 0;
        game.globalWarmingLevel += Math.max(1, (mapTiles + 999) / 1000);

        // Notify all players about the warming event.
        // Message mirrors the C Freeciv server's global_warming() in maphand.c.
        Notify.notifyAllPlayers(game, game.getServer(),
                "Global warming has occurred! Vast ranges of grassland have become deserts.");
    }

    /**
     * Computes the base trade output of a city before any economic building
     * bonuses, corruption, or rate splits.
     *
     * <p>Trade is the sum of the trade output of every tile in
     * {@link City#getWorkedTiles()}: terrain base trade + road trade bonus on
     * each tile, plus the city-centre bonus on the centre tile only.  This
     * correctly reflects the classic Freeciv ruleset where each worked tile
     * contributes its own trade independently (roads are required for most
     * terrain types to generate trade).
     *
     * @param game   the current game state
     * @param cityId the ID of the city to evaluate
     * @return raw trade output (before building bonuses and corruption)
     */
    private static int cityTradeBase(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return 1;

        int[] workedOutput = computeWorkedTilesOutput(game, city);
        int baseTrade = Math.max(CITY_CENTRE_TRADE_BONUS, workedOutput[2]);

        // Colossus wonder: +1 trade on every worked tile that already produces trade.
        // Mirrors effect_colossus (Output_Inc_Tile = 1, Trade) in the classic
        // Freeciv effects.ruleset.  Count how many worked tiles produce ≥ 1 trade.
        if (playerHasWonder(game, city.getOwner(), "Colossus")) {
            long centerTileId = city.getTile();
            for (long tileId : city.getWorkedTiles()) {
                Tile t = game.tiles.get(tileId);
                if (t == null) continue;
                boolean isCenter = (tileId == centerTileId);
                int[] out = getTileOutput(game, t, isCenter);
                if (out[2] > 0) baseTrade++; // +1 per trade-producing tile
            }
        }

        return baseTrade;
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
        // Research Lab (effect_research_lab): +100% additional when Library+ResearchLab,
        // and another +100% when University+ResearchLab are present.
        // Combined: Library = ×2; Library+University = ×3.5;
        //           Library+University+ResearchLab = ×3.5 + 200% = ×5.5.
        // Use ceiling division ((a * b + 99) / 100) to avoid small values rounding
        // to zero when multiple percentage steps are applied in sequence.
        int libraryId      = findImprId(game, "Library",      3);
        int universityId   = findImprId(game, "University",  13);
        int researchLabId  = findImprId(game, "Research Lab", IMPR_RESEARCH_LAB);
        int scienceBonus = 0;
        if (city.hasImprovement(libraryId)) {
            scienceBonus += 100; // Library: +100% (effect_library)
            if (city.hasImprovement(universityId)) {
                scienceBonus += 150; // University+Library: +150% additional (effect_university)
            }
        }
        // Research Lab: +100% per each of Library and University when Research Lab
        // and the respective building are both present.  Mirrors effect_research_lab and
        // effect_research_lab_1 in the classic Freeciv effects.ruleset.
        if (city.hasImprovement(researchLabId)) {
            if (city.hasImprovement(libraryId)) {
                scienceBonus += 100; // Research Lab + Library: +100% (effect_research_lab)
            }
            if (city.hasImprovement(universityId)) {
                scienceBonus += 100; // Research Lab + University: +100% (effect_research_lab_1)
            }
        }
        // Copernicus' Observatory wonder: +100% science in the city that contains it.
        // Mirrors effect_copernicus (Output_Bonus = 100, Science, City scope) in the
        // classic Freeciv effects.ruleset.  Applies only to the city holding the wonder,
        // not empire-wide (matches the "City" scope in effects.ruleset).
        if (city.hasImprovement(findImprId(game, "Copernicus' Observatory", -1))) {
            scienceBonus += 100; // Copernicus' Observatory: +100% science (effect_copernicus)
        }
        // Isaac Newton's College wonder: +100% science in each city that has a University.
        // Mirrors effect_isaac_newtons_college (Output_Bonus=100, Science, City scope,
        // requires Building:University) in the classic Freeciv effects.ruleset.
        if (city.hasImprovement(universityId)
                && playerHasWonder(game, city.getOwner(), "Isaac Newton's College")) {
            scienceBonus += 100; // Isaac Newton's College + University: +100% (effect_isaac_newtons_college)
        }
        // SETI Program wonder: +100% science in each city that has a Research Lab.
        // Mirrors effect_seti_program (Output_Bonus=100, Science, City scope,
        // requires Building:Research Lab) in the classic Freeciv effects.ruleset.
        if (city.hasImprovement(researchLabId)
                && playerHasWonder(game, city.getOwner(), "SETI Program")) {
            scienceBonus += 100; // SETI Program + Research Lab: +100% (effect_seti_program)
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
        // Stock Exchange (effect_stock_exchange): +50% additional gold when Bank is present.
        // Combined: Marketplace = ×1.5; Marketplace+Bank = ×2.0;
        //           Marketplace+Bank+StockExchange = ×2.5.
        // Ceiling division avoids rounding small city outputs to zero.
        int marketplaceId    = findImprId(game, "Marketplace",    4);
        int bankId           = findImprId(game, "Bank",           5);
        int stockExchangeId  = findImprId(game, "Stock Exchange", IMPR_STOCK_EXCHANGE);
        int goldBonus = 0;
        if (city.hasImprovement(marketplaceId)) {
            goldBonus += 50; // Marketplace: +50% (effect_marketplace)
            if (city.hasImprovement(bankId)) {
                goldBonus += 50; // Bank (requires Marketplace): +50% additional (effect_bank)
                if (city.hasImprovement(stockExchangeId)) {
                    goldBonus += 50; // Stock Exchange (requires Bank): +50% additional (effect_stock_exchange)
                }
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

        // Apply trade bonuses from Marketplace, Bank, and Stock Exchange.
        // Mirrors effect_marketplace_1 (+50% luxury), effect_bank_1 (+50% luxury when
        // Marketplace present), and effect_stock_exchange_1 (+50% luxury when Bank present)
        // in the classic Freeciv effects.ruleset.
        // Combined: Marketplace = ×1.5; Marketplace+Bank = ×2.0;
        //           Marketplace+Bank+StockExchange = ×2.5.
        // Ceiling division avoids rounding small city outputs to zero.
        int tradeBonus = 0;
        int marketplaceId   = findImprId(game, "Marketplace",    4);
        int bankId          = findImprId(game, "Bank",           5);
        int stockExchangeId = findImprId(game, "Stock Exchange", IMPR_STOCK_EXCHANGE);
        if (city.hasImprovement(marketplaceId)) {
            tradeBonus += 50; // Marketplace: +50% (effect_marketplace_1)
            if (city.hasImprovement(bankId)) {
                tradeBonus += 50; // Bank (requires Marketplace): +50% additional (effect_bank_1)
                if (city.hasImprovement(stockExchangeId)) {
                    tradeBonus += 50; // Stock Exchange (requires Bank): +50% additional (effect_stock_exchange_1)
                }
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

            // United Nations wonder: +2 HP recovery per turn for all units empire-wide.
            // Mirrors effect_united_nations (Unit_Recover=2, Player scope) in the classic
            // Freeciv effects.ruleset.  Applies regardless of city presence.
            if (playerHasWonder(game, unit.getOwner(), "United Nations")) {
                unit.setHp(Math.min(maxHp, unit.getHp() + 2));
                if (unit.getHp() >= maxHp) continue;
            }

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
     * Returns the minimum luxury rate (as a multiple of 10, between 0 and 100)
     * that would keep every city owned by {@code playerId} content (i.e. no net
     * unhappy citizens after government threshold and building effects).
     *
     * <p>For each city the method computes the net unhappy count ignoring luxury
     * (government threshold + building make_content), then derives the luxury
     * rate at which the city's trade output would generate enough luxury points
     * to cover all unhappy citizens.  The maximum required rate across all cities
     * is returned.
     *
     * <p>Uses {@link #cityTradeBase} as a conservative trade estimate (ignores
     * Marketplace/Bank building bonuses), so the returned rate may be slightly
     * higher than strictly necessary, erring on the side of keeping cities
     * content.  Mirrors the city-mood scan in {@code dai_manage_taxes()} in
     * {@code ai/default/aihand.c}.
     *
     * @param game     the current game state
     * @param playerId the player whose cities are evaluated
     * @return minimum luxury rate in [0, 100] rounded up to the nearest 10
     */
    public static int computeRequiredLuxuryRate(Game game, long playerId) {
        Player player = game.players.get(playerId);
        if (player == null) return 0;

        Government gov = game.governments.get((long) player.getGovernmentId());

        // Government-specific unhappy threshold (mirrors updateCityHappiness)
        int unhappyThreshold = 2;
        if (gov != null) {
            switch (gov.getRuleName()) {
                case "Monarchy":  unhappyThreshold = 3; break;
                case "Communism": unhappyThreshold = 3; break;
                case "Republic":  unhappyThreshold = 4; break;
                case "Democracy": unhappyThreshold = 5; break;
                default: break;
            }
        }

        int templeId        = findImprId(game, "Temple",         IMPR_TEMPLE);
        int colosseumId     = findImprId(game, "Colosseum",      IMPR_COLOSSEUM);
        int cathedralId     = findImprId(game, "Cathedral",      IMPR_CATHEDRAL);
        int policeStationId = findImprId(game, "Police Station", IMPR_POLICE_STATION);

        // Pre-compute player-scope wonder happiness bonuses (same as updateCityHappiness)
        boolean hasOracle         = playerHasWonder(game, playerId, "Oracle");
        boolean hasHangingGardens = playerHasWonder(game, playerId, "Hanging Gardens");
        boolean hasJSBach         = playerHasWonder(game, playerId, "J.S. Bach's Cathedral");
        boolean hasMichelangelo   = playerHasWonder(game, playerId, "Michelangelo's Chapel");
        boolean hasWomensSuffrage = playerHasWonder(game, playerId, "Women's Suffrage");

        int requiredRate = 0;

        // Government's Unhappy_Factor: mirrors EFT_UNHAPPY_FACTOR in effects.ruleset
        // Republic=1, Democracy=2 (0 for other governments).
        int unitUnhappyFactor = 0;
        if (gov != null) {
            String gn = gov.getRuleName();
            if ("Republic".equals(gn))   unitUnhappyFactor = 1;
            else if ("Democracy".equals(gn)) unitUnhappyFactor = 2;
        }

        for (Map.Entry<Long, City> entry : game.cities.entrySet()) {
            City city = entry.getValue();
            if (city.getOwner() != playerId) continue;
            long cityId = entry.getKey();

            int baseUnhappy = Math.max(0, city.getSize() - unhappyThreshold);

            // Building make_content (mirrors updateCityHappiness)
            int makeContent = 0;
            if (city.hasImprovement(templeId))    makeContent += 1;
            if (city.hasImprovement(colosseumId)) makeContent += 3;
            if (city.hasImprovement(cathedralId)) makeContent += 3;

            // Wonder make_content bonuses (mirrors updateCityHappiness wonder checks)
            if (city.hasImprovement(templeId) && hasOracle) makeContent += 2;
            if (hasHangingGardens)   makeContent += 1;
            if (hasJSBach)           makeContent += 2;
            if (hasMichelangelo)     makeContent += 3;
            // Shakespeare's Theatre: all citizens content in the city (no luxury needed)
            if (city.hasImprovement(findImprId(game, "Shakespeare's Theater", -1))) {
                makeContent += city.getSize();
            }

            // EFT_MAKE_CONTENT_MIL: free military-unhappy slots from Police Station
            // or Women's Suffrage (mirrors city_support() free_unhappy in common/city.c).
            int freeUnhappyMil = 0;
            if (gov != null && city.hasImprovement(policeStationId) && !hasWomensSuffrage) {
                String govName = gov.getRuleName();
                if ("Democracy".equals(govName))      freeUnhappyMil += 2;
                else if ("Republic".equals(govName))  freeUnhappyMil += 1;
            }
            if (hasWomensSuffrage && gov != null) {
                String govName = gov.getRuleName();
                if ("Democracy".equals(govName))      freeUnhappyMil += 2;
                else if ("Republic".equals(govName))  freeUnhappyMil += 1;
            }

            // Count unit-caused unhappiness for units homed to this city
            // (mirrors city_unit_unhappiness() in common/city.c).
            int unitCausedUnhappy = computeUnitCausedUnhappy(game, cityId,
                    unitUnhappyFactor, freeUnhappyMil);

            int netUnhappy = Math.max(0, baseUnhappy - makeContent) + unitCausedUnhappy;
            if (netUnhappy == 0) continue;

            // Luxury needed to neutralise all unhappy citizens.
            // Each HAPPY_COST luxury points covers one unhappy citizen.
            int luxuryNeeded = netUnhappy * HAPPY_COST;

            // Estimate city trade (conservative: no Marketplace/Bank bonus)
            int trade = cityTradeBase(game, entry.getKey());
            if (trade <= 0) {
                // No trade output – luxury cannot help this city regardless of
                // the rate; skip it (the AI should address revolt via buildings).
                continue;
            }

            // Minimum rate such that ceil(trade * rate / 100) >= luxuryNeeded:
            //   rate >= luxuryNeeded * 100 / trade  (ceiling division)
            int rateForCity = (luxuryNeeded * 100 + trade - 1) / trade;
            // Round up to next multiple of 10 (rates must be multiples of 10)
            rateForCity = ((rateForCity + 9) / 10) * 10;
            requiredRate = Math.max(requiredRate, rateForCity);
        }

        return Math.min(100, requiredRate);
    }

    /**
     * Computes the net unhappy citizens caused by military units homed to the
     * given city, after absorbing as many unit happy costs as possible from the
     * {@code freeUnhappyMil} budget (from Police Station / Women's Suffrage).
     *
     * <p>Each unit homed to the city with {@code happyCost > 0} costs
     * {@code happyCost × unitUnhappyFactor} unhappy citizens.  The first
     * {@code freeUnhappyMil} points of that cost are absorbed for free;
     * the remainder is added to the returned count.
     *
     * <p>Mirrors {@code city_unit_unhappiness()} and the unit loop in
     * {@code city_support()} from the C Freeciv server's {@code common/city.c}.
     *
     * @param game              the current game state
     * @param cityId            the city whose homed units to evaluate
     * @param unitUnhappyFactor government multiplier: 0 = no effect, 1 = Republic, 2 = Democracy
     * @param freeUnhappyMil    free happy slots from {@code EFT_MAKE_CONTENT_MIL}
     *                          (Police Station or Women's Suffrage)
     * @return net unhappy citizens caused by military units in this city
     */
    private static int computeUnitCausedUnhappy(Game game, long cityId,
            int unitUnhappyFactor, int freeUnhappyMil) {
        if (unitUnhappyFactor <= 0) return 0;
        int unitCausedUnhappy = 0;
        for (Unit unit : game.units.values()) {
            if (unit.getHomecity() != cityId) continue;
            UnitType utype = game.unitTypes.get((long) unit.getType());
            if (utype == null || utype.getHappyCost() <= 0) continue;
            int cost = utype.getHappyCost() * unitUnhappyFactor;
            if (freeUnhappyMil >= cost) {
                freeUnhappyMil -= cost;
            } else {
                unitCausedUnhappy += cost - freeUnhappyMil;
                freeUnhappyMil = 0;
            }
        }
        return unitCausedUnhappy;
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
     *   <li>Military units homed to the city cause additional unhappiness
     *       scaled by the government's {@code Unhappy_Factor} (Republic = 1,
     *       Democracy = 2), reduced by free slots from Police Station or
     *       Women's Suffrage ({@code EFT_MAKE_CONTENT_MIL}).  Mirrors
     *       {@code city_unit_unhappiness()} and {@code city_support()} in
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
        //   Temple         (id=6):  EFT_MAKE_CONTENT = 1
        //   Colosseum      (id=11): EFT_MAKE_CONTENT = 3
        //   Cathedral      (id=12): EFT_MAKE_CONTENT = 3
        //   Police Station (id=18): EFT_MAKE_CONTENT_MIL = 1 (Republic) / 2 (Democracy)
        // Mirrors citizen_content_buildings() in common/city.c.
        int templeId         = findImprId(game, "Temple",          IMPR_TEMPLE);
        int colosseumId      = findImprId(game, "Colosseum",       IMPR_COLOSSEUM);
        int cathedralId      = findImprId(game, "Cathedral",       IMPR_CATHEDRAL);
        int policeStationId  = findImprId(game, "Police Station",  IMPR_POLICE_STATION);
        int makeContent = 0;
        if (city.hasImprovement(templeId))    makeContent += 1;
        if (city.hasImprovement(colosseumId)) makeContent += 3;
        if (city.hasImprovement(cathedralId)) makeContent += 3;
        // Police Station: Make_Content_Mil — reduces military-caused unhappiness.
        // Republic: +1, Democracy: +2 (mirrors effect_police_station[_1] in
        // classic effects.ruleset).  Applied to military-caused unhappiness only
        // (as EFT_MAKE_CONTENT_MIL in city_support() of common/city.c).
        // NOTE: these effects require Women's Suffrage to be ABSENT (per effects.ruleset:
        // "Building", "Women's Suffrage", "Player", FALSE).  When Women's Suffrage is
        // present, its own Make_Content_Mil effects apply instead (see below).
        boolean hasWomensSuffrage = playerHasWonder(game, city.getOwner(), "Women's Suffrage");
        int freeUnhappyMil = 0; // free slots that absorb military unhappiness
        if (gov != null && city.hasImprovement(policeStationId) && !hasWomensSuffrage) {
            String govName = gov.getRuleName();
            if ("Democracy".equals(govName)) {
                freeUnhappyMil += 2;
            } else if ("Republic".equals(govName)) {
                freeUnhappyMil += 1;
            }
        }

        // Wonder effects that provide empire-wide or city-wide happiness bonuses.
        // These are checked via playerHasWonder() (player scope) so only the
        // civilisation that owns the wonder benefits.

        // Oracle wonder: +2 make_content to cities that also have a Temple.
        // Mirrors effect_oracle (Make_Content=2, requires Building:Temple in City)
        // in the classic Freeciv effects.ruleset.
        if (city.hasImprovement(templeId)
                && playerHasWonder(game, city.getOwner(), "Oracle")) {
            makeContent += 2;
        }

        // Hanging Gardens wonder: +1 make_content empire-wide (+2 in the home city,
        // but simplified here as +1 per city for all the owner's cities).
        // Mirrors effect_hanging_gardens (Make_Happy=1, Player scope) in effects.ruleset.
        if (playerHasWonder(game, city.getOwner(), "Hanging Gardens")) {
            makeContent += 1;
        }

        // J.S. Bach's Cathedral wonder: +2 make_content empire-wide.
        // Mirrors effect_js_bach (Make_Content=2, Player scope) in effects.ruleset.
        if (playerHasWonder(game, city.getOwner(), "J.S. Bach's Cathedral")) {
            makeContent += 2;
        }

        // Michelangelo's Chapel wonder: +3 make_content empire-wide.
        // Mirrors effect_michelangelos_chapel (Make_Content=3, Player scope) in
        // the classic Freeciv effects.ruleset.
        if (playerHasWonder(game, city.getOwner(), "Michelangelo's Chapel")) {
            makeContent += 3;
        }

        // Women's Suffrage wonder: Make_Content_Mil empire-wide (Republic=+1, Democracy=+2).
        // Replaces the Police Station effect (which requires Women's Suffrage to be absent).
        // Mirrors effect_womens_suffrage and effect_womens_suffrage_1 in effects.ruleset.
        if (hasWomensSuffrage && gov != null) {
            String govName = gov.getRuleName();
            if ("Democracy".equals(govName)) {
                freeUnhappyMil += 2;
            } else if ("Republic".equals(govName)) {
                freeUnhappyMil += 1;
            }
        }

        // Shakespeare's Theatre wonder: makes all citizens in the city content.
        // Mirrors effect_shakespeare (Make_Content = city_size, City scope) in effects.ruleset.
        // All remaining unhappy citizens become content.
        if (city.hasImprovement(findImprId(game, "Shakespeare's Theater", -1))) {
            makeContent += city.getSize(); // enough to satisfy everyone
        }

        // Military unit happiness cost: units homed to this city with happyCost > 0
        // cause unhappiness scaled by the government's Unhappy_Factor effect.
        //   Republic:  Unhappy_Factor = 1 → 1 unhappy citizen per unit
        //   Democracy: Unhappy_Factor = 2 → 2 unhappy citizens per unit
        // freeUnhappyMil (from Police Station or Women's Suffrage) absorbs some
        // of this military unhappiness before it is counted.
        // Mirrors city_unit_unhappiness() / city_support() in common/city.c.
        int unitUnhappyFactor = 0;
        if (gov != null) {
            String govName = gov.getRuleName();
            if ("Republic".equals(govName)) {
                unitUnhappyFactor = 1;
            } else if ("Democracy".equals(govName)) {
                unitUnhappyFactor = 2;
            }
        }
        int unitCausedUnhappy = computeUnitCausedUnhappy(game, cityId,
                unitUnhappyFactor, freeUnhappyMil);

        // Net unhappy citizens after applying building effects and unit costs
        int netUnhappy = Math.max(0, baseUnhappy - makeContent) + unitCausedUnhappy;

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
        boolean prevHappy   = city.isHappy();
        boolean prevUnhappy = city.isUnhappy();
        boolean isHappy     = (netUnhappy == 0);
        boolean isUnhappy   = (netUnhappy > 0);

        city.setHappy(isHappy);
        city.setUnhappy(isUnhappy);

        // Update the rapture (celebration) counter.
        // A city is celebrating when it was happy last turn (wasHappy) AND is
        // currently happy AND has size >= CELEBRATE_SIZE.  The counter drives
        // rapture growth in cityGrowth(): cities in Republic/Democracy with a
        // positive food surplus grow one extra population each rapture turn.
        // Mirrors the rapture counter update in update_city_activity() in the C
        // Freeciv server's cityturn.c (pcity->rapture++ / pcity->rapture=0).
        boolean isCelebrating = isHappy && city.isWasHappy()
                && city.getSize() >= CELEBRATE_SIZE;
        if (isCelebrating) {
            city.setRapture(city.getRapture() + 1);
            if (city.getRapture() == 1) {
                Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                        "Celebrations in your honor in " + city.getName() + "!");
            }
        } else {
            if (city.getRapture() > 0) {
                Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                        "Celebrations canceled in " + city.getName() + ".");
                city.setRapture(0);
            }
        }
        // Update was_happy for use by next turn's rapture check.
        // Mirrors pcity->was_happy = is_happy in update_city_activity() in C server.
        city.setWasHappy(isHappy);

        // Update the civil disorder (anarchy) counter and send player notifications.
        // Mirrors the anarchy counter logic in update_city_activity() in the C
        // Freeciv server's cityturn.c.
        if (isUnhappy) {
            city.setAnarchy(city.getAnarchy() + 1);
            if (city.getAnarchy() == 1) {
                // First turn of disorder
                Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                        "Civil disorder in " + city.getName() + ".");
            } else {
                // Continuing disorder — warn about revolution threat at the threshold
                String revolutionWarning = city.getAnarchy() >= REVOLUTION_TURNS
                        ? " Unrest threatens to spread beyond the city." : "";
                Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                        "CIVIL DISORDER CONTINUES in " + city.getName() + "." + revolutionWarning);
            }
        } else {
            if (city.getAnarchy() > 0) {
                city.setAnarchy(0);
                Notify.notifyPlayer(game, game.getServer(), city.getOwner(),
                        "Order restored in " + city.getName() + ".");
            }
        }

        // Broadcast the updated city state to all clients if anything changed
        if (prevHappy != isHappy || prevUnhappy != isUnhappy) {
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

        // Calculate pollution level using EFT_POLLU_PROD_PCT adjustments.
        // Mirrors city_pollution_types() in common/city.c:
        //   prod = shield_total * max(100 + EFT_POLLU_PROD_PCT, 0) / 100
        //   pop  = city_size (EFT_POLLU_POP_PCT = 0 by default in classic ruleset)
        //   mod  = game.info.base_pollution = -20
        //   total = max(prod + pop + mod, 0)
        int shieldOutput = computeCityShieldOutput(game, city);

        // Accumulate Pollu_Prod_Pct adjustments from buildings.
        // Mirrors the sum of EFT_POLLU_PROD_PCT effects in the classic ruleset.
        int polluProdPct = 0;

        // Recycling Center: -66% production pollution (effect_recycling_center).
        // Requires Recycling technology.
        int recyclingId = findImprId(game, "Recycling Center", IMPR_RECYCLING_CENTER);
        boolean hasRecycling = city.hasImprovement(recyclingId);

        // Power-plant pollution reductions: exclusive chain mirrors the C ruleset.
        // Solar Plant: -50% per Factory/Mfg.Plant (highest priority, no exclusions).
        // Nuclear Plant: -25% per Factory/Mfg.Plant (if no Solar Plant and no Hoover Dam).
        // Hydro Plant: -25% per Factory/Mfg.Plant (if no Solar/Nuclear/Hoover Dam).
        int factoryId2    = findImprId(game, "Factory",       IMPR_FACTORY);
        int mfgPlantId2   = findImprId(game, "Mfg. Plant",   IMPR_MFG_PLANT);
        int solarPlantId  = findImprId(game, "Solar Plant",   IMPR_SOLAR_PLANT);
        int nuclearPlantId = findImprId(game, "Nuclear Plant", IMPR_NUCLEAR_PLANT);
        int hydroPlantId  = findImprId(game, "Hydro Plant",   IMPR_HYDRO_PLANT);
        boolean hasFactory2   = city.hasImprovement(factoryId2);
        boolean hasMfgPlant2  = hasFactory2 && city.hasImprovement(mfgPlantId2);
        boolean hasSolar      = city.hasImprovement(solarPlantId);
        boolean hasNuclear    = city.hasImprovement(nuclearPlantId);
        boolean hasHydro      = city.hasImprovement(hydroPlantId);
        boolean hooverDam2    = playerHasWonder(game, city.getOwner(), "Hoover Dam");

        // Count how many plant-eligible buildings are present (Factory + Mfg.Plant).
        int plantMultiplier = (hasFactory2 ? 1 : 0) + (hasMfgPlant2 ? 1 : 0);
        if (plantMultiplier > 0) {
            int plantPollutionReductionPct = 0;
            if (hasSolar) {
                plantPollutionReductionPct = -50; // Solar Plant: -50% per Factory/Mfg.Plant
            } else if (hasNuclear && !hooverDam2) {
                plantPollutionReductionPct = -25; // Nuclear Plant: -25% (no Solar/Hoover Dam)
            } else if (hasHydro && !hooverDam2 && !hasNuclear) {
                plantPollutionReductionPct = -25; // Hydro Plant: -25% (no Solar/Nuclear/Hoover Dam)
            }
            polluProdPct += plantPollutionReductionPct * plantMultiplier;
        }

        // Recycling Center -66% (effect_recycling_center).  The interaction with
        // Solar Plant in the C ruleset is complex; for simplicity apply Recycling
        // Center when no Solar Plant is providing a stronger reduction.
        if (hasRecycling && !hasSolar) {
            polluProdPct = Math.min(polluProdPct, -66);
        } else if (hasRecycling && hasSolar) {
            // Solar Plant may give >= -66% with Mfg.Plant; otherwise top-up to -66%.
            if (polluProdPct > -66) polluProdPct = -66;
        }

        // Clamp to [-100, 0] so production pollution cannot be negative (mirrors
        // MAX(prod, 0) in city_pollution_types() in the C server).
        polluProdPct = Math.max(-100, polluProdPct);

        // Compute effective production component of pollution.
        int prodPollution = shieldOutput * Math.max(100 + polluProdPct, 0) / 100;
        int pollution = Math.max(0, prodPollution + city.getSize() - BASE_POLLUTION);
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
