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
import net.freecivx.game.UnitType;
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

        // Priority 2: Barracks (I, II, III) for fast unit healing.
        // Always build the best available barracks tier; II/III upgrade once old
        // barracks obsoletes (Gunpowder / Leadership).  Mirrors daicity.c.
        if (!city.hasImprovement(ai.imprBarracks)) {
            Improvement barracks = game.improvements.get((long) ai.imprBarracks);
            if (barracks != null && canBuildImprovement(owner, city, barracks)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprBarracks);
                return;
            }
        }
        if (ai.imprBarracksII >= 0 && !city.hasImprovement(ai.imprBarracksII)) {
            Improvement barracksII = game.improvements.get((long) ai.imprBarracksII);
            if (barracksII != null && canBuildImprovement(owner, city, barracksII)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprBarracksII);
                return;
            }
        }
        if (ai.imprBarracksIII >= 0 && !city.hasImprovement(ai.imprBarracksIII)) {
            Improvement barracksIII = game.improvements.get((long) ai.imprBarracksIII);
            if (barracksIII != null && canBuildImprovement(owner, city, barracksIII)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprBarracksIII);
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

        // Priority 2.5: Great Wonders — build early when the prereq tech is available and
        // the wonder has not yet been built anywhere in the world.  Wonders give empire-wide
        // bonuses and are worth prioritising before most buildings.
        // Mirrors the wonder-want calculation in dai_city_choose_build() in daicity.c.
        //
        // Pyramids (Masonry) — reduces food lost on city growth/shrink (very early, high value).
        if (ai.imprPyramids >= 0 && !CityTurn.worldHasWonder(game, "Pyramids")) {
            Improvement pyramids = game.improvements.get((long) ai.imprPyramids);
            if (pyramids != null && canBuildImprovement(owner, pyramids)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprPyramids);
                return;
            }
        }
        // Great Wall (Masonry) — free City Walls in all cities, strong early defence.
        if (ai.imprGreatWall >= 0 && !CityTurn.worldHasWonder(game, "Great Wall")) {
            Improvement greatWall = game.improvements.get((long) ai.imprGreatWall);
            if (greatWall != null && canBuildImprovement(owner, greatWall)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprGreatWall);
                return;
            }
        }
        // Lighthouse (Map Making, coastal only) — +1 naval move; veteran new ships.
        if (ai.imprLighthouse >= 0 && ai.aiMilitary.isCityCoastal(city.getTile())
                && !CityTurn.worldHasWonder(game, "Lighthouse")) {
            Improvement lighthouse = game.improvements.get((long) ai.imprLighthouse);
            if (lighthouse != null && canBuildImprovement(owner, lighthouse)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprLighthouse);
                return;
            }
        }
        // Great Library (Literacy) — auto-learns any tech known by 2+ other civs.
        if (ai.imprGreatLibrary >= 0 && !CityTurn.worldHasWonder(game, "Great Library")) {
            Improvement greatLibrary = game.improvements.get((long) ai.imprGreatLibrary);
            if (greatLibrary != null && canBuildImprovement(owner, greatLibrary)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprGreatLibrary);
                return;
            }
        }
        // Leonardo's Workshop (Invention) — auto-upgrades one obsolete unit per turn.
        if (ai.imprLeonardosWorkshop >= 0 && !CityTurn.worldHasWonder(game, "Leonardo's Workshop")) {
            Improvement leonardos = game.improvements.get((long) ai.imprLeonardosWorkshop);
            if (leonardos != null && canBuildImprovement(owner, leonardos)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprLeonardosWorkshop);
                return;
            }
        }
        // Copernicus' Observatory (Astronomy) — +100% science in the city where built.
        if (ai.imprCopernicusObservatory >= 0 && !CityTurn.worldHasWonder(game, "Copernicus' Observatory")) {
            Improvement copernicus = game.improvements.get((long) ai.imprCopernicusObservatory);
            if (copernicus != null && canBuildImprovement(owner, copernicus)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprCopernicusObservatory);
                return;
            }
        }
        // Isaac Newton's College (Theory of Gravity) — +100% science in all University cities.
        if (ai.imprIsaacNewtonsCollege >= 0 && !CityTurn.worldHasWonder(game, "Isaac Newton's College")) {
            Improvement newtons = game.improvements.get((long) ai.imprIsaacNewtonsCollege);
            if (newtons != null && canBuildImprovement(owner, newtons)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprIsaacNewtonsCollege);
                return;
            }
        }
        // J.S. Bach's Cathedral (Theology) — 2 unhappy→content in every city.
        if (ai.imprBachsCathedral >= 0 && !CityTurn.worldHasWonder(game, "J.S. Bach's Cathedral")) {
            Improvement bachs = game.improvements.get((long) ai.imprBachsCathedral);
            if (bachs != null && canBuildImprovement(owner, bachs)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprBachsCathedral);
                return;
            }
        }

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

        // Priority 5.5: Harbour for coastal cities.
        // Adds +1 food to every oceanic tile worked by the city (effect_harbour).
        // Important for early food growth in coastal cities; build right after Granary.
        // Mirrors the coastal-city food priority in daicity.c.
        if (ai.imprHarbour >= 0 && !city.hasImprovement(ai.imprHarbour)
                && ai.aiMilitary.isCityCoastal(city.getTile())) {
            Improvement harbour = game.improvements.get((long) ai.imprHarbour);
            if (harbour != null && canBuildImprovement(owner, city, harbour)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprHarbour);
                return;
            }
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

        // Priority 7: Workers (or Engineers if available) for terrain improvements.
        // Engineers are strictly better than Workers (2× speed) and replace them
        // once Explosives tech is known.  Mirrors the daisettler.c priority.
        if (myCityCount >= 2 && city.getSize() >= 3) {
            int workerType = (ai.unitEngineers >= 0 && canBuildUnit(owner, ai.unitEngineers))
                    ? ai.unitEngineers : AiPlayer.UNIT_WORKERS;
            int myWorkers = ai.aiMilitary.countUnitsOfType(ownerId, AiPlayer.UNIT_WORKERS)
                    + (ai.unitEngineers >= 0 ? ai.aiMilitary.countUnitsOfType(ownerId, ai.unitEngineers) : 0);
            if (myWorkers < myCityCount) {
                city.setProductionKind(0);
                city.setProductionValue(workerType);
                return;
            }
        }

        // Priority 7.5: Diplomat for embassy establishment and diplomatic actions.
        // Build one Diplomat per 4 cities to enable tech sharing and espionage.
        // Mirrors the diplomat-production priority in daiunit.c.
        if (ai.unitDiplomat >= 0 && myCityCount >= 4 && canBuildUnit(owner, ai.unitDiplomat)) {
            int myDiplomats = ai.aiMilitary.countUnitsOfType(ownerId, ai.unitDiplomat);
            if (myDiplomats < (int) Math.max(1, myCityCount / 3)) {
                city.setProductionKind(0);
                city.setProductionValue(ai.unitDiplomat);
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

        // Priority 10.5: Sewer System to allow city growth beyond size 12.
        // Mirrors the Sanitation chain in daicity.c which unlocks further growth.
        if (ai.imprSewerSystem >= 0 && !city.hasImprovement(ai.imprSewerSystem)
                && city.getSize() >= 10 && city.hasImprovement(ai.imprAqueduct)) {
            Improvement sewer = game.improvements.get((long) ai.imprSewerSystem);
            if (sewer != null && canBuildImprovement(owner, city, sewer)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprSewerSystem);
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

        // Priority 11.5: Cathedral for citizen happiness in large cities (requires Monotheism
        // tech and Temple prerequisite).  Makes 3 unhappy citizens content — same effect as
        // Colosseum but requires a different tech path.  Mirrors daicity.c priority.
        if (!city.hasImprovement(ai.imprCathedral) && ai.imprCathedral >= 0 && city.getSize() >= 6) {
            Improvement cathedral = game.improvements.get((long) ai.imprCathedral);
            if (cathedral != null && canBuildImprovement(owner, city, cathedral)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprCathedral);
                return;
            }
        }

        // Priority 11.7: Police Station reduces military unhappiness in Republic/Democracy.
        // Mirrors the Communism-gated happiness improvement in daicity.c.
        if (ai.imprPoliceStation >= 0 && !city.hasImprovement(ai.imprPoliceStation)
                && city.getSize() >= 4) {
            Improvement police = game.improvements.get((long) ai.imprPoliceStation);
            if (police != null && canBuildImprovement(owner, city, police)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprPoliceStation);
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

        // Priority 12.5: Supermarket for food bonus (+50% food with Granary).
        // Very useful for growing large cities quickly.  Mirrors daicity.c.
        if (ai.imprSupermarket >= 0 && !city.hasImprovement(ai.imprSupermarket)
                && city.getSize() >= 4 && city.hasImprovement(ai.imprGranary)) {
            Improvement supermarket = game.improvements.get((long) ai.imprSupermarket);
            if (supermarket != null && canBuildImprovement(owner, city, supermarket)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprSupermarket);
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

        // Priority 15.5: Coastal Defense for coastal cities (×3 defense bonus).
        // Mirrors the coastal-defense priority in daicity.c for sea-border cities.
        if (ai.imprCoastalDefense >= 0 && !city.hasImprovement(ai.imprCoastalDefense)
                && ai.aiMilitary.isCityCoastal(city.getTile())) {
            Improvement coastal = game.improvements.get((long) ai.imprCoastalDefense);
            if (coastal != null && canBuildImprovement(owner, city, coastal)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprCoastalDefense);
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

        // Priority 16.3: Super Highways for trade bonus (+50% road trade).
        // Mirrors the Super Highways priority in daicity.c for cities with good trade.
        if (ai.imprSuperHighways >= 0 && !city.hasImprovement(ai.imprSuperHighways)
                && city.getSize() >= 5 && city.hasImprovement(ai.imprMarketplace)) {
            Improvement superHwy = game.improvements.get((long) ai.imprSuperHighways);
            if (superHwy != null && canBuildImprovement(owner, city, superHwy)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprSuperHighways);
                return;
            }
        }

        // Priority 16.5: Mfg. Plant once Factory is built (+50% additional shields).
        // Mirrors the Mfg.Plant priority after Factory in daicity.c.
        if (city.hasImprovement(ai.imprFactory) && ai.imprMfgPlant >= 0
                && !city.hasImprovement(ai.imprMfgPlant) && city.getSize() >= 6) {
            Improvement mfgPlant = game.improvements.get((long) ai.imprMfgPlant);
            if (mfgPlant != null && canBuildImprovement(owner, city, mfgPlant)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprMfgPlant);
                return;
            }
        }

        // Priority 16.7: Energy source for cities with Factory.
        // Build the best available power plant to boost production (+25% shields)
        // and reduce pollution.  Priority: Solar > Nuclear > Hydro > Power Plant.
        // Only one energy source is needed per city; skip if Hoover Dam is built.
        if (city.hasImprovement(ai.imprFactory)
                && !CityTurn.playerHasWonder(game, ownerId, "Hoover Dam")) {
            // Check whether an energy source is already present.
            boolean hasEnergy = (ai.imprSolarPlant  >= 0 && city.hasImprovement(ai.imprSolarPlant))
                    || (ai.imprNuclearPlant >= 0 && city.hasImprovement(ai.imprNuclearPlant))
                    || (ai.imprHydroPlant   >= 0 && city.hasImprovement(ai.imprHydroPlant))
                    || (ai.imprPowerPlant   >= 0 && city.hasImprovement(ai.imprPowerPlant));
            if (!hasEnergy) {
                // Try each energy source in preference order.
                int[] energyChoices = { ai.imprSolarPlant, ai.imprNuclearPlant,
                        ai.imprHydroPlant, ai.imprPowerPlant };
                for (int imprId : energyChoices) {
                    if (imprId < 0) continue;
                    Improvement plant = game.improvements.get((long) imprId);
                    if (plant != null && canBuildImprovement(owner, city, plant)) {
                        city.setProductionKind(1);
                        city.setProductionValue(imprId);
                        return;
                    }
                }
            }
        }

        // Priority 16.9: Recycling Center to reduce city pollution once production
        // buildings are present.  Mirrors the late-game pollution-reduction priority
        // in daicity.c.
        if (city.hasImprovement(ai.imprFactory) && ai.imprRecyclingCenter >= 0
                && !city.hasImprovement(ai.imprRecyclingCenter) && city.getSize() >= 5) {
            Improvement recycling = game.improvements.get((long) ai.imprRecyclingCenter);
            if (recycling != null && canBuildImprovement(owner, city, recycling)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprRecyclingCenter);
                return;
            }
        }

        // Priority 16.95: Mass Transit removes all city pollution.
        // Higher priority than Recycling Center when Factory is present.
        // Mirrors the pollution-control priority in daicity.c.
        if (ai.imprMassTransit >= 0 && city.hasImprovement(ai.imprFactory)
                && !city.hasImprovement(ai.imprMassTransit) && city.getSize() >= 6) {
            Improvement massTransit = game.improvements.get((long) ai.imprMassTransit);
            if (massTransit != null && canBuildImprovement(owner, city, massTransit)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprMassTransit);
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

        // Priority 18.3: SAM Battery for air defense.
        // Mirrors the air-defense building priority in daicity.c.
        if (ai.imprSAMBattery >= 0 && !city.hasImprovement(ai.imprSAMBattery)) {
            Improvement sam = game.improvements.get((long) ai.imprSAMBattery);
            if (sam != null && canBuildImprovement(owner, city, sam)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprSAMBattery);
                return;
            }
        }

        // Priority 18.5: Offshore Platform for coastal cities.
        // Adds +1 shield to every oceanic tile (effect_offshore_platform).
        // A mid-to-late game coastal infrastructure improvement.
        if (ai.imprOffPlatform >= 0 && !city.hasImprovement(ai.imprOffPlatform)
                && ai.aiMilitary.isCityCoastal(city.getTile()) && city.getSize() >= 4) {
            Improvement offPlat = game.improvements.get((long) ai.imprOffPlatform);
            if (offPlat != null && canBuildImprovement(owner, city, offPlat)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprOffPlatform);
                return;
            }
        }

        // Priority 18.6: Port Facility for coastal trade boost.
        // Mirrors the Port Facility priority in daicity.c for naval cities.
        if (ai.imprPortFacility >= 0 && !city.hasImprovement(ai.imprPortFacility)
                && ai.aiMilitary.isCityCoastal(city.getTile()) && city.getSize() >= 4) {
            Improvement portFac = game.improvements.get((long) ai.imprPortFacility);
            if (portFac != null && canBuildImprovement(owner, city, portFac)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprPortFacility);
                return;
            }
        }

        // Priority 18.7: Airport for airlift capability and production bonus.
        // Mirrors the Airport priority in daicity.c.
        if (ai.imprAirport >= 0 && !city.hasImprovement(ai.imprAirport) && city.getSize() >= 5) {
            Improvement airport = game.improvements.get((long) ai.imprAirport);
            if (airport != null && canBuildImprovement(owner, city, airport)) {
                city.setProductionKind(1);
                city.setProductionValue(ai.imprAirport);
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

        // Priority 19.5: Air unit (Fighter/Bomber) for cities that have an Airport.
        // Build one air unit per 3 cities with airports, mirroring the air-unit
        // production priority in dai_city_choose_build() in daicity.c.
        if (city.hasImprovement(ai.imprAirport) && ai.imprAirport >= 0) {
            int bestAir = ai.aiMilitary.bestAvailableAirUnit(owner);
            if (bestAir >= 0) {
                int airUnits = ai.aiMilitary.countUnitsOfType(ownerId, bestAir);
                long airportCities = game.cities.values().stream()
                        .filter(c -> c.getOwner() == ownerId && c.hasImprovement(ai.imprAirport))
                        .count();
                // One air unit per three airport-cities as a minimum air force.
                // Use ceiling division so that even a single airport-city builds 1 air unit
                // and production scales smoothly: 1-3 cities → 1, 4-6 → 2, etc.
                int desiredAir = (int) ((airportCities + 2) / 3);
                if (airUnits < desiredAir) {
                    city.setProductionKind(0);
                    city.setProductionValue(bestAir);
                    return;
                }
            }
        }

        // Default: produce the best available offensive unit for army expansion.
        // Mix in siege units (Catapult/Cannon/Artillery/Howitzer) at a ratio of
        // one siege unit per two cities to give the AI city-assault capability.
        // Mirrors the mixed-army approach in dai_city_choose_build() in daicity.c.
        int myAttackers = ai.aiMilitary.countMilitaryUnits(ownerId);
        if (myAttackers < myCityCount * 2 + 2) {
            int siegeUnit = ai.aiMilitary.bestAvailableSiegeUnit(owner);
            int siegeCount = siegeUnit >= 0 ? ai.aiMilitary.countUnitsOfType(ownerId, siegeUnit) : 0;
            // Build one siege unit per two cities (rounded down).
            int desiredSiege = (int) myCityCount / 2;
            if (siegeUnit >= 0 && siegeCount < desiredSiege) {
                city.setProductionKind(0);
                city.setProductionValue(siegeUnit);
            } else {
                city.setProductionKind(0);
                city.setProductionValue(ai.aiMilitary.bestAvailableAttacker(owner));
            }
        } else {
            // Army cap reached: fall back to the best available defender so the city
            // is never idle wasting shields.  Mirrors the fallback-defender path in
            // dai_city_choose_build() in the C Freeciv server's daicity.c which always
            // queues a "fallback defender" when no other priority wins.
            city.setProductionKind(0);
            city.setProductionValue(bestDefender);
        }
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
     * Returns {@code true} if the player has the prerequisite technology to
     * build the given unit type.  Mirrors {@code can_player_build_unit_direct()}
     * in the C Freeciv server's {@code common/unittype.c}.
     *
     * @param player  the player to check
     * @param unitTypeId the unit type ID to check
     * @return {@code true} if the unit can be built
     */
    boolean canBuildUnit(Player player, int unitTypeId) {
        if (unitTypeId < 0) return false;
        UnitType utype = game.unitTypes.get((long) unitTypeId);
        if (utype == null) return false;
        long techReq = utype.getTechReqId();
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
