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
                // Courthouse (id=9) also halves production waste, mirroring the
                // C server's Courthouse effect on both corruption and waste.
                if (city.hasImprovement(IMPR_COURTHOUSE)) {
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
        // Restore unit HP for units in friendly cities before other processing.
        // Mirrors unit_restore_hitpoints() in the C Freeciv server's unittools.c.
        restoreUnitHitpoints(game);

        // Snapshot city IDs to avoid concurrent-modification issues
        for (long cityId : new ArrayList<>(game.cities.keySet())) {
            cityGrowth(game, cityId);
            cityProduction(game, cityId);
            updateCityHappiness(game, cityId);
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
            if (city.hasImprovement(IMPR_COURTHOUSE)) {
                corruptionPct /= 2;
            }
            trade = trade * (100 - corruptionPct) / 100;
        }

        // Tax rate = 100% - scienceRate (simplified: no luxury)
        int taxRate = 100 - player.getScienceRate();
        return trade * taxRate / 100;
    }

    /**
     * Restores HP to units that are garrisoned in a friendly city at the
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

        for (Unit unit : game.units.values()) {
            UnitType utype = game.unitTypes.get((long) unit.getType());
            if (utype == null) continue;
            int maxHp = utype.getHp();
            if (unit.getHp() >= maxHp) continue; // Already at full HP

            // Unit must be in a friendly city to receive healing
            City city = cityByTile.get(unit.getTile());
            if (city == null) continue;
            if (city.getOwner() != unit.getOwner()) continue;

            if (city.hasImprovement(IMPR_BARRACKS)) {
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
     * government type, and happiness-producing buildings.
     *
     * <p>The calculation mirrors the core of {@code citizen_base_mood()} and
     * {@code citizen_content_buildings()} in the C Freeciv server's
     * {@code common/city.c}:
     * <ol>
     *   <li>A base number of unhappy citizens is derived from the city size and
     *       the current government.  More permissive governments (Republic,
     *       Democracy) tolerate larger populations before citizens become
     *       unhappy.</li>
     *   <li>The {@code EFT_MAKE_CONTENT} effect from buildings (Temple = 1,
     *       Colosseum = 3, Cathedral = 3) converts unhappy citizens back to
     *       content, mirroring {@code citizen_content_buildings()} in
     *       {@code common/city.c}.</li>
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
        int makeContent = 0;
        if (city.hasImprovement(IMPR_TEMPLE))    makeContent += 1;
        if (city.hasImprovement(IMPR_COLOSSEUM)) makeContent += 3;
        if (city.hasImprovement(IMPR_CATHEDRAL)) makeContent += 3;

        // Net unhappy citizens after applying building effects
        int netUnhappy = Math.max(0, baseUnhappy - makeContent);

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
            CityTools.sendCityInfo(game, game.getServer(), -1L, cityId);
        }
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
        // Courthouse halves corruption
        if (city.hasImprovement(IMPR_COURTHOUSE)) {
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
