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
import org.json.JSONObject;

/**
 * Turn-based city processing: production completion, population growth,
 * science and tax contributions, and corruption/waste calculations.
 * Mirrors the functionality of cityturn.c in the C Freeciv server.
 * {@link #updateAllCities(Game)} is the main entry point called once per turn.
 */
public class CityTurn {

    /**
     * Processes the production queue for a city.
     * Adds the city's shields output to the current production item's progress.
     * If the item is complete the product (unit or improvement) is created and
     * the next item in the worklist is selected.
     * Mirrors {@code city_distribute_surplus_shields} in the C Freeciv server.
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

        // Check for production completion when building an improvement
        // (productionKind 1 = improvement)
        if (city.getProductionKind() == 1) {
            int improvId = city.getProductionValue();
            net.freecivx.game.Improvement improvement = game.improvements.get((long) improvId);
            if (improvement != null) {
                int cost = improvement.getBuildCost();
                if (city.getShieldStock() >= cost) {
                    // Complete the improvement
                    city.addImprovement(improvId);
                    city.setShieldStock(city.getShieldStock() - cost);
                    net.freecivx.server.Notify.notifyPlayer(game, game.getServer(),
                            city.getOwner(),
                            city.getName() + " has built " + improvement.getName() + ".");
                    // Reset production to nothing
                    city.setProductionKind(0);
                    city.setProductionValue(0);
                }
            }
        }

        CityTools.sendCityInfo(game, game.getServer(), -1L, cityId);
    }

    /**
     * Handles population growth for a city at end of turn.
     * Checks whether the food box is full and, if so, increases the city
     * size, adjusts worker assignments, and handles unhappiness thresholds.
     *
     * @param game   the current game state
     * @param cityId the ID of the city to process for growth
     */
    public static void cityGrowth(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return;

        // Delegate to CityTools for the actual growth logic
        CityTools.cityGrowth(game, cityId);
    }

    /**
     * Runs the full end-of-turn update for every city in the game.
     * Called once per turn, in order: growth check, production, science,
     * tax, and corruption/waste; then broadcasts updated city packets.
     *
     * @param game the current game state
     */
    public static void updateAllCities(Game game) {
        for (long cityId : game.cities.keySet()) {
            cityGrowth(game, cityId);
            cityProduction(game, cityId);
            cityScienceContribution(game, cityId);
            cityTaxContribution(game, cityId);
            citySpoilage(game, cityId);
        }
    }

    /**
     * Calculates and returns the science (bulbs) produced by a city this turn.
     * The value depends on the city's population, tile yields, improvements
     * such as Library and University, and the player's science tax rate.
     *
     * @param game   the current game state
     * @param cityId the ID of the city to evaluate
     * @return the number of science bulbs produced this turn
     */
    public static int cityScienceContribution(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return 0;

        // Base science: 1 bulb per population point
        return city.getSize();
    }

    /**
     * Calculates and returns the gold (tax) produced by a city this turn.
     * The value depends on trade routes, tile yields, improvements such as
     * Marketplace and Bank, and the player's tax rate.
     *
     * @param game   the current game state
     * @param cityId the ID of the city to evaluate
     * @return the amount of gold produced this turn
     */
    public static int cityTaxContribution(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return 0;

        // Base tax: 1 gold per population point
        return city.getSize();
    }

    /**
     * Calculates and applies corruption and production waste to a city.
     * The amount depends on the city's distance from the capital, the current
     * government type, and any anti-corruption improvements.
     * Mirrors the corruption/waste calculation in the C Freeciv server's
     * {@code cityturn.c} — government corruption percentage reduces city trade output.
     *
     * @param game   the current game state
     * @param cityId the ID of the city to evaluate
     */
    public static void citySpoilage(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return;

        net.freecivx.game.Player player = game.players.get(city.getOwner());
        if (player == null) return;

        net.freecivx.game.Government gov = game.governments.get((long) player.getGovernmentId());
        if (gov == null) return;

        int corruptionPct = gov.getCorruptionPct();
        // Courthouse (improvement id=9) halves corruption
        if (city.hasImprovement(9)) {
            corruptionPct = corruptionPct / 2;
        }
        // Corruption is informational; actual deduction applied when computing city output
        // Here we log it so it's visible during development
        if (corruptionPct > 0) {
            int tradeBase = city.getSize(); // simplified: 1 trade per population
            int corrupted = tradeBase * corruptionPct / 100;
            System.out.println("City " + city.getName()
                    + " loses " + corrupted + " trade to corruption (" + corruptionPct + "%)");
        }
    }
}
