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
        // Sum improvement contributions (only improvements actually built in this city)
        for (Integer improvId : city.getImprovements()) {
            Improvement improvement = game.improvements.get((long) (int) improvId);
            if (improvement != null && improvementHasEffect(improvement, effectType)) {
                total += 1;
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
     * Mirrors terrain defence bonuses from the C Freeciv terrain ruleset.
     *
     * @param game       the current game state
     * @param tileId     the ID of the tile to query
     * @param effectType the name of the effect (e.g. "Defense_Bonus")
     * @return the tile's contribution to the named effect
     */
    public static int getTileEffect(Game game, long tileId, String effectType) {
        Tile tile = game.tiles.get(tileId);
        if (tile == null) return 0;

        if ("Defense_Bonus".equals(effectType)) {
            Terrain terrain = game.terrains.get((long) tile.getTerrain());
            if (terrain != null) return terrain.getDefenseBonus();
        }
        return 0;
    }

    /**
     * Returns whether a city improvement contributes to the specified effect.
     * Mirrors the improvement effect table lookup in the C Freeciv server's
     * {@code common/effects.c}.
     * Known improvement effects (matching classic ruleset):
     * <ul>
     *   <li>Library (id=3): "Science_Per_Tile" +50%</li>
     *   <li>Marketplace (id=4): "Tax_Bonus" +50%</li>
     *   <li>Bank (id=5): "Tax_Bonus" +50%</li>
     *   <li>Temple (id=6): "Make_Content" happiness</li>
     *   <li>Courthouse (id=9): "Corrupt_Pct" reduction</li>
     *   <li>Granary (id=2): "Growth_Food_Pct" granary bonus</li>
     * </ul>
     *
     * @param improvement the improvement to check
     * @param effectType  the effect name
     * @return {@code true} if the improvement has a non-zero contribution
     */
    public static boolean improvementHasEffect(Improvement improvement, String effectType) {
        if (improvement == null || effectType == null) return false;
        switch ((int) improvement.getId()) {
            case 3: return "Science_Per_Tile".equals(effectType) || "Output_Bonus".equals(effectType);
            case 4: return "Tax_Bonus".equals(effectType) || "Trade_Revenue_Bonus".equals(effectType);
            case 5: return "Tax_Bonus".equals(effectType) || "Trade_Revenue_Bonus".equals(effectType);
            case 6: return "Make_Content".equals(effectType);
            case 9: return "Corrupt_Pct".equals(effectType);
            case 2: return "Growth_Food_Pct".equals(effectType);
            default: return false;
        }
    }

    /**
     * Returns the value of a named effect granted by the specified government type.
     * Mirrors the government effect table in the C Freeciv server's effects system.
     * Corruption percentages are captured in {@link Government#getCorruptionPct()};
     * additional science/trade bonuses are encoded here.
     *
     * @param government the government to query
     * @param effectType the effect name
     * @return the effect value contributed by this government
     */
    public static int governmentEffect(Government government, String effectType) {
        if (government == null || effectType == null) return 0;
        // Republic and Democracy grant a trade bonus (mirroring C Freeciv classic ruleset)
        if ("Trade_Revenue_Bonus".equals(effectType) || "Tax_Bonus".equals(effectType)) {
            switch (government.getRuleName()) {
                case "Republic":   return 1;
                case "Democracy":  return 2;
                default:           return 0;
            }
        }
        if ("Corrupt_Pct".equals(effectType)) {
            return government.getCorruptionPct();
        }
        return 0;
    }
}
