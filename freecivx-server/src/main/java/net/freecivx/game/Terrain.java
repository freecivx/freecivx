/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.freecivx.com/
 Copyright (C) 2009-2025  The Freeciv-web project, Andreas Røsdal

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

public class Terrain {
    private String name;          // Name of the terrain
    private String graphicsStr;   // String for terrain graphics or texture
    private int defenseBonus;     // Percent added to unit defence on this terrain (e.g. 50 = +50%)
    private int moveCost;         // Movement points required to enter (1 = standard)

    /**
     * Base food output for one worker working this terrain tile.
     * Mirrors the {@code food} field in the Freeciv terrain ruleset.
     * Classic Freeciv values: Grassland=2, Plains/Hills/Forest/Jungle/Tundra=1, Desert/Ocean-class=0.
     */
    private int food;

    /**
     * Base shield (production) output for one worker working this terrain tile.
     * Mirrors the {@code shield} field in the Freeciv terrain ruleset.
     * Classic Freeciv values: Forest=2, Plains/Desert/Mountains=1, Grassland/Hills/Swamp/Tundra=0.
     */
    private int shield;

    /**
     * Base trade output for one worker working this terrain tile.
     * Mirrors the {@code trade} field in the Freeciv terrain ruleset.
     * Classic Freeciv values: Ocean/Lake=2, most land=0.
     */
    private int trade;

    /**
     * Bonus food added when this terrain tile has an Irrigation extra.
     * Mirrors {@code irrigation_food_incr} in the Freeciv terrain ruleset.
     */
    private int irrigationFoodBonus;

    /**
     * Bonus shields added when this terrain tile has a Mine extra.
     * Mirrors {@code mining_shield_incr} in the Freeciv terrain ruleset.
     */
    private int miningShieldBonus;

    /**
     * Bonus trade added when this terrain tile has a Road extra.
     * {@code 1} when {@code road_trade_incr_pct > 0} in the ruleset (Desert, Grassland, Plains);
     * {@code 0} for all other terrain types.
     * Mirrors the road trade bonus mechanic in the C Freeciv server.
     */
    private int roadTradeBonus;

    // Constructor (backwards-compatible: no defence/move args defaults to 0/1)
    public Terrain(String name, String graphicsStr) {
        this(name, graphicsStr, 0, 1);
    }

    public Terrain(String name, String graphicsStr, int defenseBonus, int moveCost) {
        this.name = name;
        this.graphicsStr = graphicsStr;
        this.defenseBonus = defenseBonus;
        this.moveCost = moveCost;
    }

    /**
     * Full constructor including tile output fields.
     *
     * @param name               terrain display name
     * @param graphicsStr        tileset graphic tag
     * @param defenseBonus       unit defence bonus (%)
     * @param moveCost           movement cost to enter
     * @param food               base food per working citizen
     * @param shield             base shield per working citizen
     * @param trade              base trade per working citizen
     * @param irrigationFoodBonus extra food added by Irrigation extra
     * @param miningShieldBonus  extra shields added by Mine extra
     * @param roadTradeBonus     extra trade added by Road extra (1 for terrains
     *                           with {@code road_trade_incr_pct > 0})
     */
    public Terrain(String name, String graphicsStr, int defenseBonus, int moveCost,
                   int food, int shield, int trade,
                   int irrigationFoodBonus, int miningShieldBonus, int roadTradeBonus) {
        this.name = name;
        this.graphicsStr = graphicsStr;
        this.defenseBonus = defenseBonus;
        this.moveCost = moveCost;
        this.food = food;
        this.shield = shield;
        this.trade = trade;
        this.irrigationFoodBonus = irrigationFoodBonus;
        this.miningShieldBonus = miningShieldBonus;
        this.roadTradeBonus = roadTradeBonus;
    }

    // Getter for name
    public String getName() {
        return name;
    }

    // Setter for name
    public void setName(String name) {
        this.name = name;
    }

    // Getter for graphicsStr
    public String getGraphicsStr() {
        return graphicsStr;
    }

    // Setter for graphicsStr
    public void setGraphicsStr(String graphicsStr) {
        this.graphicsStr = graphicsStr;
    }

    /**
     * Returns the defence bonus provided by this terrain type, as a percentage
     * (e.g. 50 means +50% defence).  Mirrors the {@code defense_bonus} field
     * in the Freeciv terrain ruleset.
     */
    public int getDefenseBonus() {
        return defenseBonus;
    }

    public void setDefenseBonus(int defenseBonus) {
        this.defenseBonus = defenseBonus;
    }

    /** Returns the movement cost to enter this terrain in move fragments. */
    public int getMoveCost() {
        return moveCost;
    }

    public void setMoveCost(int moveCost) {
        this.moveCost = moveCost;
    }

    /**
     * Returns the base food output produced by one citizen working this terrain tile.
     * Classic values: Grassland=2, Plains/Hills/Forest/Jungle/Tundra/Swamp=1,
     * Desert/Mountains/Ocean-class/Glacier/Arctic=0.
     */
    public int getFood() {
        return food;
    }

    public void setFood(int food) {
        this.food = food;
    }

    /**
     * Returns the base shield (production) output produced by one citizen working
     * this terrain tile.
     * Classic values: Forest=2, Plains/Desert/Mountains/Glacier=1, others=0.
     */
    public int getShield() {
        return shield;
    }

    public void setShield(int shield) {
        this.shield = shield;
    }

    /**
     * Returns the base trade output produced by one citizen working this terrain tile.
     * Classic values: Ocean/Lake=2, all land terrains=0 (road gives +1 for some).
     */
    public int getTrade() {
        return trade;
    }

    public void setTrade(int trade) {
        this.trade = trade;
    }

    /**
     * Returns the bonus food added when this terrain tile has an Irrigation extra.
     * Mirrors {@code irrigation_food_incr} in the Freeciv terrain ruleset.
     */
    public int getIrrigationFoodBonus() {
        return irrigationFoodBonus;
    }

    public void setIrrigationFoodBonus(int irrigationFoodBonus) {
        this.irrigationFoodBonus = irrigationFoodBonus;
    }

    /**
     * Returns the bonus shields added when this terrain tile has a Mine extra.
     * Mirrors {@code mining_shield_incr} in the Freeciv terrain ruleset.
     */
    public int getMiningShieldBonus() {
        return miningShieldBonus;
    }

    public void setMiningShieldBonus(int miningShieldBonus) {
        this.miningShieldBonus = miningShieldBonus;
    }

    /**
     * Returns the bonus trade added when this terrain tile has a Road extra.
     * {@code 1} for terrain types with {@code road_trade_incr_pct > 0}
     * (Desert, Grassland, Plains in the classic ruleset); {@code 0} otherwise.
     */
    public int getRoadTradeBonus() {
        return roadTradeBonus;
    }

    public void setRoadTradeBonus(int roadTradeBonus) {
        this.roadTradeBonus = roadTradeBonus;
    }

    // Method to display terrain information
    @Override
    public String toString() {
        return "Terrain{name='" + name + "', graphicsStr='" + graphicsStr
                + "', defenseBonus=" + defenseBonus
                + "', food=" + food + ", shield=" + shield + ", trade=" + trade + "'}";
    }
}
