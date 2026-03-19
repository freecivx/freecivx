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

package net.freecivx.ai;

import net.freecivx.game.City;
import net.freecivx.game.Game;
import net.freecivx.game.Government;
import net.freecivx.game.Improvement;
import net.freecivx.game.Player;
import net.freecivx.game.Tile;
import net.freecivx.server.CityTurn;

import java.util.ArrayList;
import java.util.Map;

/**
 * City production management AI.
 * Chooses what each AI-owned city should build each turn based on strategic
 * priorities: defence, infrastructure, growth, science, economy.
 *
 * <p>Mirrors {@code ai/default/daicity.c} in the C Freeciv server.
 */
class AiCity {

    private final AiPlayer ai;
    private final Game game;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    AiCity(AiPlayer ai) {
        this.ai = ai;
        this.game = ai.game;
    }

    // =========================================================================
    // City production management (mirrors daicity.c)
    // =========================================================================

    /**
     * Manages city production for all AI-owned cities that have an empty
     * production slot.  Mirrors the city-management loop in
     * {@code dai_city_choose_build()} ({@code ai/default/daicity.c}).
     */
    void manageAiCities() {
        for (Map.Entry<Long, City> entry : new ArrayList<>(game.cities.entrySet())) {
            City city = entry.getValue();
            Player owner = game.players.get(city.getOwner());
            if (owner == null || !owner.isAi()) continue;
            manageAiCity(city, entry.getKey(), owner);
        }
    }

    /**
     * Chooses what to build in a single AI city based on strategic priorities.
     * Inspired by {@code dai_city_choose_build()} in {@code ai/default/daicity.c}.
     *
     * @param city   the city to manage
     * @param cityId the city's key in {@code game.cities}
     * @param owner  the AI player who owns the city
     */
    void manageAiCity(City city, long cityId, Player owner) {
        long ownerId = city.getOwner();
        int defenders = ai.aiMilitary.countUnitsOnTile(city.getTile(), ownerId);
        int dangerScore = ai.aiMilitary.assessCityDanger(city);

        int bestDefender = ai.aiMilitary.bestAvailableDefender(owner);

        // Emergency defense: grave danger with no garrison overrides any in-progress
        // production.  Mirrors city_data->grave_danger in daimilitary.c.
        if (dangerScore >= AiPlayer.GRAVE_DANGER_THRESHOLD && defenders == 0) {
            city.setProductionKind(0);
            city.setProductionValue(bestDefender);
            return;
        }

        // For non-emergency decisions, only fill an empty production slot.
        if (city.getProductionKind() != 0 || city.getProductionValue() != -1) return;

        // Priority 1: Defend the city.
        if (defenders == 0 || (dangerScore > 0 && defenders < 2)) {
            city.setProductionKind(0);
            city.setProductionValue(bestDefender);
            return;
        }

        // Priority 1.5: Happiness emergency — build a Temple or Colosseum.
        if (city.isUnhappy()) {
            if (!city.hasImprovement(ai.imprTemple)) {
                Improvement temple = game.improvements.get((long) ai.imprTemple);
                if (temple != null && canBuildImprovement(owner, city, temple)) {
                    city.setProductionKind(1);
                    city.setProductionValue(ai.imprTemple);
                    return;
                }
            }
            if (!city.hasImprovement(ai.imprColosseum) && ai.imprColosseum >= 0) {
                Improvement colosseum = game.improvements.get((long) ai.imprColosseum);
                if (colosseum != null && canBuildImprovement(owner, city, colosseum)) {
                    city.setProductionKind(1);
                    city.setProductionValue(ai.imprColosseum);
                    return;
                }
            }
        }

        // Priority 2: Barracks for fast unit healing.
        if (!city.hasImprovement(ai.imprBarracks)) {
            Improvement barracks = game.improvements.get((long) ai.imprBarracks);
            if (barracks != null && canBuildImprovement(owner, city, barracks)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprBarracks);
                return;
            }
        }

        long myCityCount = game.cities.values().stream()
                .filter(c -> c.getOwner() == ownerId).count();

        // Count existing settlers already in the field so we do not queue more
        // than needed.  Mirrors the daisettler.c heuristic that limits settler
        // production to one per two existing cities (rounded up).
        int mySettlers = ai.aiMilitary.countUnitsOfType(ownerId, AiPlayer.UNIT_SETTLERS);
        int settlerCap = (int) (myCityCount / 2) + 1;

        // Priority 3: Early expansion — produce Settlers when empire is very small.
        if (myCityCount < 2 && mySettlers < settlerCap && city.getSize() >= 2 && cityHasFoodSurplus(city)) {
            city.setProductionKind(0);
            city.setProductionValue(AiPlayer.UNIT_SETTLERS);
            return;
        }

        // Priority 4: Granary for sustained food growth.
        if (!city.hasImprovement(ai.imprGranary)) {
            Improvement granary = game.improvements.get((long) ai.imprGranary);
            if (granary != null && canBuildImprovement(owner, city, granary)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprGranary);
                return;
            }
        }

        // Priority 5: Continue empire expansion with Settlers.
        // Cap settler production at one per two cities to avoid flooding the map
        // with idle settlers when good founding sites are scarce.  Mirrors the
        // settler-want decay in daicity.c when settlers already cover available sites.
        if (myCityCount < 8 && mySettlers < settlerCap && city.getSize() >= 2 && cityHasFoodSurplus(city)) {
            city.setProductionKind(0);
            city.setProductionValue(AiPlayer.UNIT_SETTLERS);
            return;
        }

        // Priority 6: Temple for citizen happiness.
        if (!city.hasImprovement(ai.imprTemple)) {
            Improvement temple = game.improvements.get((long) ai.imprTemple);
            if (temple != null && canBuildImprovement(owner, city, temple)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprTemple);
                return;
            }
        }

        // Priority 7: Workers for terrain improvements.
        if (myCityCount >= 2 && city.getSize() >= 3) {
            int myWorkers = ai.aiMilitary.countUnitsOfType(ownerId, AiPlayer.UNIT_WORKERS);
            if (myWorkers < myCityCount) {
                city.setProductionKind(0);
                city.setProductionValue(AiPlayer.UNIT_WORKERS);
                return;
            }
        }

        // Priority 8: Library for science output.
        if (!city.hasImprovement(ai.imprLibrary) && city.getSize() >= 2) {
            Improvement library = game.improvements.get((long) ai.imprLibrary);
            if (library != null && canBuildImprovement(owner, city, library)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprLibrary);
                return;
            }
        }

        // Priority 9: University for science bonus.
        if (!city.hasImprovement(ai.imprUniversity) && ai.imprUniversity >= 0 && city.getSize() >= 3) {
            Improvement university = game.improvements.get((long) ai.imprUniversity);
            if (university != null && canBuildImprovement(owner, city, university)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprUniversity);
                return;
            }
        }

        // Priority 10: Aqueduct to allow city growth beyond size 8.
        if (!city.hasImprovement(ai.imprAqueduct) && city.getSize() >= 6) {
            Improvement aqueduct = game.improvements.get((long) ai.imprAqueduct);
            if (aqueduct != null && canBuildImprovement(owner, city, aqueduct)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprAqueduct);
                return;
            }
        }

        // Priority 11: Colosseum for citizen happiness in larger cities.
        if (!city.hasImprovement(ai.imprColosseum) && ai.imprColosseum >= 0 && city.getSize() >= 5) {
            Improvement colosseum = game.improvements.get((long) ai.imprColosseum);
            if (colosseum != null && canBuildImprovement(owner, city, colosseum)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprColosseum);
                return;
            }
        }

        // Priority 12: Marketplace for trade income.
        if (!city.hasImprovement(ai.imprMarketplace) && city.getSize() >= 3) {
            Improvement marketplace = game.improvements.get((long) ai.imprMarketplace);
            if (marketplace != null && canBuildImprovement(owner, city, marketplace)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprMarketplace);
                return;
            }
        }

        // Priority 13: Bank for additional gold income.
        if (!city.hasImprovement(ai.imprBank) && ai.imprBank >= 0 && city.getSize() >= 3) {
            Improvement bank = game.improvements.get((long) ai.imprBank);
            if (bank != null && canBuildImprovement(owner, city, bank)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprBank);
                return;
            }
        }

        // Priority 14: Courthouse to reduce corruption.
        if (!city.hasImprovement(ai.imprCourthouse) && ai.imprCourthouse >= 0 && myCityCount >= 3) {
            Government gov = game.governments.get((long) owner.getGovernmentId());
            if (gov != null && gov.getCorruptionPct() > 0) {
                Improvement courthouse = game.improvements.get((long) ai.imprCourthouse);
                if (courthouse != null && canBuildImprovement(owner, city, courthouse)) {
                    city.setProductionKind(1);
                    city.setProductionValue(ai.imprCourthouse);
                    return;
                }
            }
        }

        // Priority 15: City Walls for passive defence.
        if (!city.hasImprovement(ai.imprCityWalls)) {
            Improvement walls = game.improvements.get((long) ai.imprCityWalls);
            if (walls != null && canBuildImprovement(owner, city, walls)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprCityWalls);
                return;
            }
        }

        // Priority 16: Factory for shield production bonus.
        if (!city.hasImprovement(ai.imprFactory) && ai.imprFactory >= 0 && city.getSize() >= 5) {
            Improvement factory = game.improvements.get((long) ai.imprFactory);
            if (factory != null && canBuildImprovement(owner, city, factory)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprFactory);
                return;
            }
        }

        // Priority 17: Stock Exchange for gold and luxury bonus.
        if (!city.hasImprovement(ai.imprStockExchange) && ai.imprStockExchange >= 0 && city.getSize() >= 4) {
            Improvement stockExchange = game.improvements.get((long) ai.imprStockExchange);
            if (stockExchange != null && canBuildImprovement(owner, city, stockExchange)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprStockExchange);
                return;
            }
        }

        // Priority 18: Research Lab for science bonus.
        if (!city.hasImprovement(ai.imprResearchLab) && ai.imprResearchLab >= 0 && city.getSize() >= 4) {
            Improvement researchLab = game.improvements.get((long) ai.imprResearchLab);
            if (researchLab != null && canBuildImprovement(owner, city, researchLab)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprResearchLab);
                return;
            }
        }

        // Priority 19: Apollo Program great wonder (prerequisite for all spaceship parts).
        // Build it if Space Flight tech is known and it hasn't been built anywhere yet.
        if (ai.imprApolloProgram >= 0 && !CityTurn.worldHasWonder(game, "Apollo Program")) {
            Improvement apollo = game.improvements.get((long) ai.imprApolloProgram);
            if (apollo != null && canBuildImprovement(owner, city, apollo)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprApolloProgram);
                return;
            }
        }

        // Priority 20: Space parts – once Apollo Program is built, dedicate large
        // cities to building Space Structurals, Components, and Modules.
        // Mirrors the late-game spaceship build priority in dai_city_choose_build()
        // in the C Freeciv AI (ai/default/daicity.c).
        if (CityTurn.worldHasWonder(game, "Apollo Program") && city.getSize() >= 6) {
            net.freecivx.game.Spaceship ship = owner.getSpaceship();
            // Build Structurals first (need at least 8), then Components and Modules
            if (ship.getStructurals() < 12 && ai.imprSpaceStructural >= 0) {
                Improvement struct = game.improvements.get((long) ai.imprSpaceStructural);
                if (struct != null && canBuildImprovement(owner, city, struct)) {
                    city.setProductionKind(1);
                    city.setProductionValue(ai.imprSpaceStructural);
                    return;
                }
            }
            if (ship.getComponents() < 8 && ai.imprSpaceComponent >= 0) {
                Improvement comp = game.improvements.get((long) ai.imprSpaceComponent);
                if (comp != null && canBuildImprovement(owner, city, comp)) {
                    city.setProductionKind(1);
                    city.setProductionValue(ai.imprSpaceComponent);
                    return;
                }
            }
            if (ship.getModules() < 6 && ai.imprSpaceModule >= 0) {
                Improvement mod = game.improvements.get((long) ai.imprSpaceModule);
                if (mod != null && canBuildImprovement(owner, city, mod)) {
                    city.setProductionKind(1);
                    city.setProductionValue(ai.imprSpaceModule);
                    return;
                }
            }
        }

        // Priority 19: Naval unit for coastal cities once naval tech is available.
        // Mirrors the naval-unit production priority in dai_city_choose_build() in
        // ai/default/daicity.c — build one naval unit per coastal city as a patrol
        // vessel when we have Map Making or Navigation technology.
        if (ai.aiMilitary.isCityCoastal(city.getTile())) {
            int bestNaval = ai.aiMilitary.bestAvailableNavalUnit(owner);
            if (bestNaval >= 0) {
                int navalUnits = ai.aiMilitary.countUnitsOfType(ownerId, bestNaval);
                long coastalCities = game.cities.values().stream()
                        .filter(c -> c.getOwner() == ownerId
                                && ai.aiMilitary.isCityCoastal(c.getTile()))
                        .count();
                // One naval unit per coastal city is enough for patrol / deterrence.
                if (navalUnits < coastalCities) {
                    city.setProductionKind(0);
                    city.setProductionValue(bestNaval);
                    return;
                }
            }
        }

        // Default: produce the best available offensive unit for army expansion.
        // Limit total attackers to roughly two per city so that the production
        // queue does not spiral into an endless army build-up.  Mirrors the
        // military-want cap in dai_city_choose_build() in daicity.c.
        int myAttackers = ai.aiMilitary.countMilitaryUnits(ownerId);
        if (myAttackers < myCityCount * 2 + 2) {
            city.setProductionKind(0);
            city.setProductionValue(ai.aiMilitary.bestAvailableAttacker(owner));
        }
        // else: no production set – city will idle (accumulate gold or waste
        // shields) rather than over-produce an army it cannot support.
    }

    /**
     * Returns {@code true} if the player has the prerequisite technology and
     * any required city-building improvement to build the given improvement in
     * the specified city.  Mirrors {@code can_city_build_improvement_direct()}
     * in the C Freeciv server's {@code common/city.c}.
     */
    boolean canBuildImprovement(Player player, City city, Improvement impr) {
        long techReq = impr.getTechReqId();
        if (techReq >= 0 && !player.hasTech(techReq)) return false;
        String reqBldgName = impr.getRequiredBuildingName();
        if (reqBldgName != null && !reqBldgName.isEmpty()
                && !CityTurn.cityHasImprovementByName(game, city, reqBldgName)) {
            return false;
        }
        return true;
    }

    /**
     * Returns {@code true} if the player has the prerequisite technology to
     * build the given improvement (no city-context check).
     */
    boolean canBuildImprovement(Player player, Improvement impr) {
        long techReq = impr.getTechReqId();
        return techReq < 0 || player.hasTech(techReq);
    }

    /**
     * Returns {@code true} if the city produces more food than its citizens
     * consume (positive food surplus).  Used to gate Settler production so the
     * AI does not build a Settler when doing so would starve the city.
     * Mirrors the food-loss calculation in {@code daicity.c}.
     */
    boolean cityHasFoodSurplus(City city) {
        Tile centerTile = game.tiles.get(city.getTile());
        if (centerTile == null) return false;

        int totalFood = CityTurn.getTileOutput(game, centerTile, true)[0];
        for (Long workedTileId : city.getWorkedTiles()) {
            Tile t = game.tiles.get(workedTileId);
            if (t != null) {
                totalFood += CityTurn.getTileOutput(game, t, false)[0];
            }
        }

        int foodUpkeep = city.getSize() * 2;
        return totalFood > foodUpkeep;
    }
}
