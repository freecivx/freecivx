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

    /**
     * ID of the unit type that this unit upgrades to when the player researches
     * the appropriate technology.  {@code -1} means no upgrade is available.
     * Mirrors the {@code obsolete_by} field in the Freeciv units ruleset and the
     * {@code do_upgrade_effects()} upgrade chain in the C Freeciv server.
     */
    private int upgradesTo = -1;

    /**
     * Temporary storage for the {@code obsolete_by} unit type name read from the
     * ruleset file.  Resolved to an integer ID in
     * {@code Game.populateFromRuleset()} after all unit types are loaded.
     */
    private String obsoletedByName = null;

    /**
     * Number of hitpoints removed from the loser per combat round won.
     * Mirrors the {@code firepower} field in the Freeciv units ruleset.
     * Most units have firepower=1; advanced units like Artillery/Fighter have
     * firepower=2, meaning they inflict 2 HP damage per combat round they win.
     */
    private int firepower = 1;

    /**
     * Population cost: number of citizens removed from the building city when
     * this unit type is produced.  Mirrors the {@code pop_cost} field in the
     * Freeciv units ruleset.  Most units have pop_cost=0; Settlers have
     * pop_cost=1 (they cost 1 citizen from the founding city).
     */
    private int popCost = 0;

    /**
     * Technology name required before this unit can be built.
     * Mirrors the first {@code "Tech"} entry in the {@code reqs} table of the
     * Freeciv units ruleset.  Resolved to {@link #techReqId} during game init
     * by {@code Game.populateFromRuleset()}.  {@code null} means no prerequisite.
     */
    private String techReqName = null;

    /**
     * Resolved technology ID required to build this unit (-1 means none).
     * Set from {@link #techReqName} by {@code Game.populateFromRuleset()} after
     * all technologies are loaded.  Checked in {@code CityTurn.cityProduction()}
     * to prevent early production of advanced units.
     */
    private long techReqId = -1L;

    /**
     * Whether this unit type has the {@code "Horse"} flag.
     * Horse-flagged units (Horsemen, Chariot, Knights, Dragoons, Cavalry) suffer
     * a halved attack value when attacking Pikemen (units with an anti-horse
     * defense bonus).  Mirrors the {@code "Horse"} custom unit flag defined in
     * the classic Freeciv units ruleset.
     */
    private boolean hasHorseFlag = false;

    /**
     * Anti-horse defense multiplier applied when this unit defends against a
     * unit with the {@link #hasHorseFlag} flag.  A value of 1 means no bonus
     * (default); a value of 2 means double defense (Pikemen bonus).
     * Mirrors the {@code bonuses = { "Horse", "DefenseMultiplier", 1 }} entry in
     * the classic Freeciv units ruleset for Pikemen.
     * Formula: effectiveDefense = defenseStrength × antiHorseFactor.
     */
    private int antiHorseFactor = 1;

    /**
     * Whether this unit type is a non-military (civilian) unit.
     * Set when the ruleset {@code flags} field contains {@code "NonMil"}.
     * Non-military units (Workers, Engineers, Diplomats, etc.) cannot
     * initiate combat — mirroring {@code is_military_unit()} in the C
     * Freeciv server's {@code common/unit.c}.
     */
    private boolean nonMilitary = false;

    /**
     * Whether this unit type can build terrain improvements (roads, irrigation,
     * mines) and found cities.  Set when the ruleset {@code flags} field
     * contains {@code "Settlers"} or {@code "Cities"}.  True for Workers and
     * Engineers (but NOT for Diplomats/Spies, which also have {@code NonMil}
     * but neither the {@code "Settlers"} nor the {@code "Cities"} flag).
     * Mirrors the {@code UnitClass} "TerrainChangeSpeed" / "Settlers" flag in
     * the C Freeciv server's {@code units.ruleset}.
     */
    private boolean hasSettlersFlag = false;

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

    /**
     * Returns the ID of the unit type this unit upgrades to upon tech research,
     * or {@code -1} if no upgrade is available.
     * Mirrors the {@code obsolete_by} field in the Freeciv units ruleset.
     */
    public int getUpgradesTo() {
        return upgradesTo;
    }

    /**
     * Sets the ID of the unit type this unit upgrades to.
     *
     * @param upgradesTo the target unit type ID, or {@code -1} for no upgrade
     */
    public void setUpgradesTo(int upgradesTo) {
        this.upgradesTo = upgradesTo;
    }

    /**
     * Returns the unresolved {@code obsolete_by} name read from the ruleset file,
     * or {@code null} if not set.  Resolved to an integer ID during game
     * initialisation.
     */
    public String getObsoletedByName() {
        return obsoletedByName;
    }

    /**
     * Sets the unresolved {@code obsolete_by} name from the ruleset file.
     *
     * @param obsoletedByName the unit type name string, or {@code null}
     */
    public void setObsoletedByName(String obsoletedByName) {
        this.obsoletedByName = obsoletedByName;
    }

    /**
     * Returns the number of hitpoints removed per combat round won by this unit.
     * Mirrors the {@code firepower} field in the Freeciv units ruleset.
     */
    public int getFirepower() {
        return firepower;
    }

    /**
     * Sets the firepower value (HP lost per combat round won).
     *
     * @param firepower at least 1
     */
    public void setFirepower(int firepower) {
        this.firepower = Math.max(1, firepower);
    }

    /**
     * Returns the population cost when building this unit type (mirrors
     * {@code pop_cost} in the Freeciv units ruleset).
     */
    public int getPopCost() {
        return popCost;
    }

    /**
     * Sets the population cost for building this unit.
     *
     * @param popCost citizens removed from the city when the unit is built (≥ 0)
     */
    public void setPopCost(int popCost) {
        this.popCost = Math.max(0, popCost);
    }

    /**
     * Returns the unresolved technology name required to build this unit, or
     * {@code null} if no tech is required.
     */
    public String getTechReqName() {
        return techReqName;
    }

    /**
     * Sets the unresolved technology prerequisite name from the ruleset file.
     *
     * @param techReqName the technology name, or {@code null} for no requirement
     */
    public void setTechReqName(String techReqName) {
        this.techReqName = techReqName;
    }

    /**
     * Returns the resolved technology ID required to build this unit, or
     * {@code -1} if there is no prerequisite.
     */
    public long getTechReqId() {
        return techReqId;
    }

    /**
     * Sets the resolved technology ID required to build this unit.
     *
     * @param techReqId the technology ID, or {@code -1} for no requirement
     */
    public void setTechReqId(long techReqId) {
        this.techReqId = techReqId;
    }

    /**
     * Returns {@code true} if this unit type has the {@code "Horse"} flag,
     * meaning it suffers a defense penalty when attacking Pikemen or other
     * units with an anti-horse defense bonus.
     */
    public boolean hasHorseFlag() {
        return hasHorseFlag;
    }

    /**
     * Sets whether this unit type has the {@code "Horse"} flag.
     *
     * @param hasHorseFlag {@code true} if this is a horse-type unit
     */
    public void setHasHorseFlag(boolean hasHorseFlag) {
        this.hasHorseFlag = hasHorseFlag;
    }

    /**
     * Returns the anti-horse defense multiplier.  A value of 1 means no bonus;
     * a value of 2 means double defense against horse-flagged attackers.
     * Mirrors the {@code bonuses = { "Horse", "DefenseMultiplier", 1 }} entry
     * in the Pikemen definition in the classic Freeciv units ruleset.
     */
    public int getAntiHorseFactor() {
        return antiHorseFactor;
    }

    /**
     * Sets the anti-horse defense multiplier.
     *
     * @param antiHorseFactor 1 for no bonus, 2 for double defense, etc.
     */
    public void setAntiHorseFactor(int antiHorseFactor) {
        this.antiHorseFactor = Math.max(1, antiHorseFactor);
    }

    /**
     * Returns {@code true} if this is a non-military (civilian) unit.
     * Non-military units cannot initiate combat.  Mirrors
     * {@code is_military_unit()} returning {@code false} in the C Freeciv
     * server's {@code common/unit.c} for units with the {@code "NonMil"} flag.
     */
    public boolean isNonMilitary() {
        return nonMilitary;
    }

    /**
     * Sets whether this unit type is non-military (civilian).
     * Should be {@code true} when the ruleset {@code flags} field contains
     * {@code "NonMil"} (Workers, Engineers, Diplomats, etc.).
     *
     * @param nonMilitary {@code true} for civilian units that cannot attack
     */
    public void setNonMilitary(boolean nonMilitary) {
        this.nonMilitary = nonMilitary;
    }

    /**
     * Returns {@code true} if this unit type has the {@code "Settlers"} or
     * {@code "Cities"} flag, meaning it can build terrain improvements and
     * found cities.  True for Workers and Engineers; false for Diplomats and
     * Spies even though those are also non-military.  Mirrors the
     * {@code "Settlers"} / {@code "Cities"} flags in the classic Freeciv
     * units ruleset.
     */
    public boolean hasSettlersFlag() {
        return hasSettlersFlag;
    }

    /**
     * Sets whether this unit type has the {@code "Settlers"} or
     * {@code "Cities"} flag (parsed from the ruleset).
     * Should be {@code true} for Workers, Engineers, and Settlers.
     *
     * @param hasSettlersFlag {@code true} if this unit can build terrain improvements
     */
    public void setHasSettlersFlag(boolean hasSettlersFlag) {
        this.hasSettlersFlag = hasSettlersFlag;
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
                ", firepower=" + firepower +
                ", cost=" + cost +
                ", popCost=" + popCost +
                ", domain=" + domain +
                '}';
    }
}
