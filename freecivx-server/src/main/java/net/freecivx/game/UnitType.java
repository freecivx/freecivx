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

public class UnitType {

    private String name;
    private String graphicsStr;
    private int moveRate;
    private int hp;
    private int veteranLevels;
    private String helptext;
    private int attackStrength;
    private int defenseStrength;
    private String utype_actions;
    private int domain; // 0=land, 1=sea, 2=air
    /**
     * Production cost in shields required to build this unit type in a city.
     * Mirrors the {@code build_cost} field in the Freeciv units ruleset.
     * A value of 0 means use the legacy formula (attack + defense) * hp / 2.
     */
    private int cost;

    // Constructor (backwards-compatible without cost)
    public UnitType(String name, String graphicsStr, int moveRate, int hp, int veteranLevels, String helptext, int attackStrength, int defenseStrength,
                    String utype_actions, int domain) {
        this(name, graphicsStr, moveRate, hp, veteranLevels, helptext, attackStrength, defenseStrength, utype_actions, domain, 0);
    }

    // Constructor with explicit production cost
    public UnitType(String name, String graphicsStr, int moveRate, int hp, int veteranLevels, String helptext, int attackStrength, int defenseStrength,
                    String utype_actions, int domain, int cost) {
        this.name = name;
        this.graphicsStr = graphicsStr;
        this.moveRate = moveRate;
        this.hp = hp;
        this.veteranLevels = veteranLevels;
        this.helptext = helptext;
        this.attackStrength = attackStrength;
        this.defenseStrength = defenseStrength;
        this.utype_actions = utype_actions;
        this.domain = domain;
        this.cost = cost;
    }

    // Getters
    public String getName() {
        return name;
    }

    public String getGraphicsStr() {
        return graphicsStr;
    }

    public int getMoveRate() {
        return moveRate;
    }

    public int getHp() {
        return hp;
    }

    public int getVeteranLevels() {
        return veteranLevels;
    }

    public String getHelptext() {
        return helptext;
    }

    public int getAttackStrength() {
        return attackStrength;
    }

    public int getDefenseStrength() {
        return defenseStrength;
    }

    public String getUtypeActions() {
        return utype_actions;
    }

    public void setUtypeActions(String utype_actions) {
        this.utype_actions = utype_actions;
    }

    public int getDomain() {
        return domain;
    }

    public void setDomain(int domain) {
        this.domain = domain;
    }

    /**
     * Returns the production cost in shields required to build this unit type.
     * A value of 0 means use the legacy formula.
     */
    public int getCost() {
        return cost;
    }

    public void setCost(int cost) {
        this.cost = cost;
    }

    // Optional toString method for debugging
    @Override
    public String toString() {
        return "UnitType{" +
                "name='" + name + '\'' +
                ", graphicsStr='" + graphicsStr + '\'' +
                ", moveRate=" + moveRate +
                ", hp=" + hp +
                ", veteranLevels=" + veteranLevels +
                ", helptext='" + helptext + '\'' +
                ", attackStrength=" + attackStrength +
                ", defenseStrength=" + defenseStrength +
                ", cost=" + cost +
                ", domain=" + domain +
                '}';
    }
}
