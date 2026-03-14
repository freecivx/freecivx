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
import net.freecivx.game.Unit;
import net.freecivx.game.UnitType;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

/**
 * Turn-based city processing: production completion, population growth,
 * science and tax contributions, and corruption/waste calculations.
 * Mirrors the functionality of cityturn.c in the C Freeciv server.
 * {@link #updateAllCities(Game)} is the main entry point called once per turn.
 */
public class CityTurn {

    /** Minimum unit production cost in shields. */
    private static final int MIN_UNIT_COST = 10;

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
     * Processes the production queue for a city.
     * Adds the city's shields output to the current production item's progress.
     * If the item is complete the product (unit or improvement) is created and
     * the production is reset.
     * Handles both unit production (productionKind 0) and improvement production
     * (productionKind 1), mirroring {@code city_distribute_surplus_shields} and
     * {@code city_build_unit} / {@code city_build_building} in the C Freeciv server.
     *
     * @param game   the current game state
     * @param cityId the ID of the city whose production is being processed
     */
    public static void cityProduction(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return;

        // Accumulate shields: 1 shield per population point per turn (simplified)
        int shieldOutput = Math.max(1, city.getSize());
        city.setShieldStock(city.getShieldStock() + shieldOutput);

        // productionKind 1 = improvement (building)
        if (city.getProductionKind() == 1) {
            int improvId = city.getProductionValue();
            Improvement improvement = game.improvements.get((long) improvId);
            if (improvement != null) {
                int cost = improvement.getBuildCost();
                if (city.getShieldStock() >= cost) {
                    city.addImprovement(improvId);
                    city.setShieldStock(city.getShieldStock() - cost);
                    Notify.notifyPlayer(game, game.getServer(),
                            city.getOwner(),
                            city.getName() + " has built " + improvement.getName() + ".");
                    // Reset production to nothing after completion
                    city.setProductionKind(0);
                    city.setProductionValue(0);
                }
            }
        }

        // productionKind 0 = unit production
        // Mirrors city_build_unit() in the C Freeciv server's citytools.c.
        if (city.getProductionKind() == 0 && city.getProductionValue() > 0) {
            int unitTypeId = city.getProductionValue();
            UnitType unitType = game.unitTypes.get((long) unitTypeId);
            if (unitType != null) {
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
                    UnitTools.createUnit(game, city.getOwner(), city.getTile(), unitTypeId);
                    city.setShieldStock(city.getShieldStock() - cost);
                    Notify.notifyPlayer(game, game.getServer(),
                            city.getOwner(),
                            city.getName() + " has built " + unitType.getName() + ".");
                    // Keep producing same unit type; player can change manually
                }
            }
        }

        CityTools.sendCityInfo(game, game.getServer(), -1L, cityId);
    }

    /**
     * Handles population growth for a city at end of turn using the food-stock
     * system from the C Freeciv server ({@code city_populate} in {@code cityturn.c}).
     * Food is accumulated each turn and the city grows when the granary fills.
     * Cities above size 8 require an Aqueduct (improvement id 8) to grow further.
     * If food_stock drops below zero the city shrinks by one (starvation).
     *
     * @param game   the current game state
     * @param cityId the ID of the city to process for growth
     */
    public static void cityGrowth(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return;

        // Food surplus per turn: base 2 (grassland city center) + 1 per Granary (id=2)
        // Mirrors food surplus[O_FOOD] calculation in C server (simplified).
        int foodSurplus = 2;
        if (city.hasImprovement(2)) { // Granary doubles food retention and adds output
            foodSurplus += 1;
        }

        int granarySize = cityGranarySize(city.getSize());
        city.setFoodStock(city.getFoodStock() + foodSurplus);

        if (city.getFoodStock() >= granarySize) {
            // Cities above size 8 require an Aqueduct to grow further.
            // Mirrors city_can_grow_to() check in C Freeciv server.
            if (city.getSize() >= 8 && !city.hasImprovement(8)) { // 8 = Aqueduct
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
                if (city.hasImprovement(2)) {
                    city.setFoodStock(cityGranarySize(city.getSize()) / 2);
                } else {
                    city.setFoodStock(0);
                }
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

        CityTools.sendCityInfo(game, game.getServer(), -1L, cityId);
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
        // Snapshot city IDs to avoid concurrent-modification issues
        for (long cityId : new ArrayList<>(game.cities.keySet())) {
            cityGrowth(game, cityId);
            cityProduction(game, cityId);
        }

        // Aggregate per-player gold income from all their cities
        Map<Long, Integer> playerGoldIncome = new HashMap<>();
        for (long cityId : new ArrayList<>(game.cities.keySet())) {
            City city = game.cities.get(cityId);
            if (city == null) continue;
            long ownerId = city.getOwner();
            int gold = cityTaxContribution(game, cityId);
            playerGoldIncome.merge(ownerId, gold, Integer::sum);
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

            // Deduct unit upkeep: 1 gold per military unit per turn (simplified).
            // Mirrors gold upkeep handling in the C Freeciv server's cityturn.c.
            int unitUpkeep = 0;
            for (Unit unit : new ArrayList<>(game.units.values())) {
                if (unit.getOwner() != pid) continue;
                UnitType utype = game.unitTypes.get((long) unit.getType());
                if (utype != null && utype.getAttackStrength() > 0) {
                    unitUpkeep++;
                }
            }

            int newGold = player.getGold() + income - buildingUpkeep - unitUpkeep;
            player.setGold(Math.max(0, newGold));

            // Update research progress (accumulates science bulbs, completes tech if reached).
            TechTools.playerResearchUpdate(game, pid);

            // Broadcast updated gold and research state to the player's client
            game.getServer().sendPlayerInfoAll(player);
        }
    }

    /**
     * Calculates and returns the science (bulbs) produced by a city this turn.
     * The value depends on the city's population and improvements.
     * Bonuses are applied additively (all percentage bonuses summed, then applied
     * once), matching the Freeciv {@code Output_Bonus} stacking rule in
     * {@code effects.ruleset}:
     * <ul>
     *   <li>Library (id 3): +100% science ({@code effect_library}, value=100)</li>
     *   <li>Library + University (id 13): additional +150% science
     *       ({@code effect_university}, value=150, requires both buildings)</li>
     * </ul>
     * Combined effect: Library alone = ×2; Library + University = ×3.5.
     *
     * @param game   the current game state
     * @param cityId the ID of the city to evaluate
     * @return the number of science bulbs produced this turn
     */
    public static int cityScienceContribution(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return 0;

        // Base science: 1 bulb per population point
        int science = city.getSize();

        // Apply Output_Bonus effects additively, matching the C Freeciv server.
        // Library (effect_library): +100% science when Library is present.
        // University (effect_university): +150% additional when BOTH Library and
        // University are present. (Requires Library as a prerequisite.)
        // Combined: Library alone = ×2; Library+University = ×(100+100+150)/100 = ×3.5.
        int scienceBonus = 0;
        if (city.hasImprovement(3)) {
            scienceBonus += 100; // Library: +100% (effect_library)
            if (city.hasImprovement(13)) {
                scienceBonus += 150; // University+Library: +150% additional (effect_university)
            }
        }
        science = science * (100 + scienceBonus) / 100;

        return science;
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

        // Base trade: 1 trade per population (simplified)
        int trade = city.getSize();

        // Apply Output_Bonus effects additively, matching the C Freeciv server.
        // Marketplace (effect_marketplace): +50% gold.
        // Bank (effect_bank): +50% additional gold when Marketplace is also present.
        // Combined: Marketplace alone = ×1.5; Marketplace+Bank = ×(100+50+50)/100 = ×2.0.
        int goldBonus = 0;
        if (city.hasImprovement(4)) {
            goldBonus += 50; // Marketplace: +50% (effect_marketplace)
            if (city.hasImprovement(5)) {
                goldBonus += 50; // Bank (requires Marketplace): +50% additional (effect_bank)
            }
        }
        trade = trade * (100 + goldBonus) / 100;

        // Apply corruption reduction (Courthouse halves corruption, mirrors C server)
        Government gov = game.governments.get((long) player.getGovernmentId());
        if (gov != null) {
            int corruptionPct = gov.getCorruptionPct();
            if (city.hasImprovement(9)) { // Courthouse
                corruptionPct /= 2;
            }
            trade = trade * (100 - corruptionPct) / 100;
        }

        // Tax rate = 100% - scienceRate (simplified: no luxury)
        int taxRate = 100 - player.getScienceRate();
        return trade * taxRate / 100;
    }

    /**
     * Calculates and applies corruption and production waste to a city.
     * The amount depends on the current government type and any anti-corruption
     * improvements.  Mirrors the corruption/waste calculation in the C Freeciv
     * server's {@code cityturn.c}.
     *
     * @param game   the current game state
     * @param cityId the ID of the city to evaluate
     */
    public static void citySpoilage(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return;

        Player player = game.players.get(city.getOwner());
        if (player == null) return;

        Government gov = game.governments.get((long) player.getGovernmentId());
        if (gov == null) return;

        int corruptionPct = gov.getCorruptionPct();
        // Courthouse (improvement id=9) halves corruption
        if (city.hasImprovement(9)) {
            corruptionPct = corruptionPct / 2;
        }
        if (corruptionPct > 0) {
            int tradeBase = city.getSize();
            int corrupted = tradeBase * corruptionPct / 100;
            System.out.println("City " + city.getName()
                    + " loses " + corrupted + " trade to corruption (" + corruptionPct + "%)");
        }
    }
}
