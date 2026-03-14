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

    // Method to display terrain information
    @Override
    public String toString() {
        return "Terrain{name='" + name + "', graphicsStr='" + graphicsStr
                + "', defenseBonus=" + defenseBonus + "'}";
    }
}
