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

package net.freecivx.game;

/**
 * Game effects system — bonuses and penalties derived from city improvements,
 * governments, and tile features.
 * Mirrors the functionality of common/effects.c in the C Freeciv server.
 * Effect values are used by city output calculations, combat modifiers,
 * and unit-action enabler checks throughout the server.
 */
public class Effects {

    /**
     * Returns the cumulative value of a named effect for a specific city.
     * Sums contributions from all improvements built in the city, the player's
     * current government, and any wonders that have a global effect.
     *
     * @param game      the current game state
     * @param cityId    the ID of the city to query
     * @param effectType the name of the effect (e.g. "Science_Per_Tile",
     *                   "Tax_Bonus", "Unit_Upkeep_Free_Per_City")
     * @return the total effect value, or {@code 0} if the city does not exist
     */
    public static int getCityEffect(Game game, long cityId, String effectType) {
        City city = game.cities.get(cityId);
        if (city == null) return 0;

        int total = 0;
        // Sum improvement contributions
        for (Improvement improvement : game.improvements.values()) {
            if (improvementHasEffect(improvement, effectType)) {
                total += 1; // TODO: read actual effect magnitude from ruleset
            }
        }
        // Add government contribution
        Player player = game.players.get(city.getOwner());
        if (player != null) {
            Government gov = game.governments.get((long) player.getNation());
            if (gov != null) {
                total += governmentEffect(gov, effectType);
            }
        }
        return total;
    }

    /**
     * Returns the cumulative value of a named effect for a specific player.
     * Takes into account the player's government, wonders, and any global
     * improvement effects active for that player.
     *
     * @param game       the current game state
     * @param playerId   the ID of the player to query
     * @param effectType the name of the effect
     * @return the total effect value, or {@code 0} if the player does not exist
     */
    public static int getPlayerEffect(Game game, long playerId, String effectType) {
        Player player = game.players.get(playerId);
        if (player == null) return 0;

        Government gov = game.governments.get((long) player.getNation());
        if (gov == null) return 0;

        return governmentEffect(gov, effectType);
    }

    /**
     * Returns the value of a named effect for a specific map tile.
     * Tile effects are derived from terrain type and any extras (roads, rivers,
     * resources) present on the tile.
     *
     * @param game       the current game state
     * @param tileId     the ID of the tile to query
     * @param effectType the name of the effect (e.g. "Defense_Bonus")
     * @return the tile's contribution to the named effect
     */
    public static int getTileEffect(Game game, long tileId, String effectType) {
        Tile tile = game.tiles.get(tileId);
        if (tile == null) return 0;

        // TODO: derive from terrain and extras ruleset data
        return 0;
    }

    /**
     * Returns whether a city improvement contributes to the specified effect.
     *
     * @param improvement the improvement to check
     * @param effectType  the effect name
     * @return {@code true} if the improvement has a non-zero contribution
     */
    public static boolean improvementHasEffect(Improvement improvement, String effectType) {
        if (improvement == null || effectType == null) return false;
        // TODO: lookup effect table from loaded ruleset data
        return false;
    }

    /**
     * Returns the value of a named effect granted by the specified government type.
     *
     * @param government the government to query
     * @param effectType the effect name
     * @return the effect value contributed by this government
     */
    public static int governmentEffect(Government government, String effectType) {
        if (government == null || effectType == null) return 0;
        // TODO: lookup government effect table from ruleset
        return 0;
    }
}
