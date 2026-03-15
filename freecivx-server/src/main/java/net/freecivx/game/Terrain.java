/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.FreecivWorld.net/
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

    // Base tile output values from the terrain ruleset.
    // Mirrors the food/shield/trade fields in terrain.ruleset.
    private int food;             // Base food production
    private int shield;           // Base shield (production) output
    private int trade;            // Base trade output

    // Terrain improvement bonuses.  Mirrors the irrigation_food_incr,
    // mining_shield_incr and road_trade_incr_pct fields in terrain.ruleset.
    private int irrigationFoodBonus;  // Food added when the tile is irrigated
    private int miningShieldBonus;    // Shields added when the tile is mined
    private boolean roadTradeBonus;   // True when a road adds 1 trade (road_trade_incr_pct=100)

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
     * Full constructor including tile output values.
     * Mirrors the complete set of fields read by the ruleset parser.
     *
     * @param name              terrain rule name
     * @param graphicsStr       tileset graphic tag
     * @param defenseBonus      combat defence bonus in percent
     * @param moveCost          movement-point cost to enter
     * @param food              base food production
     * @param shield            base shield production
     * @param trade             base trade production
     * @param irrigationFoodBonus  food increment when irrigated
     * @param miningShieldBonus    shield increment when mined
     * @param roadTradeBonus    true when a road adds 1 trade on this terrain
     */
    public Terrain(String name, String graphicsStr, int defenseBonus, int moveCost,
                   int food, int shield, int trade,
                   int irrigationFoodBonus, int miningShieldBonus, boolean roadTradeBonus) {
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

    /** Returns the base food production for this terrain type. */
    public int getFood() { return food; }
    public void setFood(int food) { this.food = food; }

    /** Returns the base shield (production) output for this terrain type. */
    public int getShield() { return shield; }
    public void setShield(int shield) { this.shield = shield; }

    /** Returns the base trade output for this terrain type. */
    public int getTrade() { return trade; }
    public void setTrade(int trade) { this.trade = trade; }

    /**
     * Returns the extra food added to a tile when it has been irrigated.
     * Mirrors the {@code irrigation_food_incr} field in terrain.ruleset.
     */
    public int getIrrigationFoodBonus() { return irrigationFoodBonus; }
    public void setIrrigationFoodBonus(int irrigationFoodBonus) {
        this.irrigationFoodBonus = irrigationFoodBonus;
    }

    /**
     * Returns the extra shields added to a tile when it has been mined.
     * Mirrors the {@code mining_shield_incr} field in terrain.ruleset.
     */
    public int getMiningShieldBonus() { return miningShieldBonus; }
    public void setMiningShieldBonus(int miningShieldBonus) {
        this.miningShieldBonus = miningShieldBonus;
    }

    /**
     * Returns whether a Road extra adds 1 trade to this terrain type.
     * True when {@code road_trade_incr_pct = 100} in terrain.ruleset.
     */
    public boolean isRoadTradeBonus() { return roadTradeBonus; }
    public void setRoadTradeBonus(boolean roadTradeBonus) {
        this.roadTradeBonus = roadTradeBonus;
    }

    // Method to display terrain information
    @Override
    public String toString() {
        return "Terrain{name='" + name + "', graphicsStr='" + graphicsStr
                + "', defenseBonus=" + defenseBonus + "'}";
    }
}
