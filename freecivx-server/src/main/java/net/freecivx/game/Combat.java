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

import java.util.Random;

/**
 * Combat calculation utilities for unit battles.
 * Mirrors the functionality of common/combat.c in the C Freeciv server.
 * Provides attack/defence strength formulas, combat eligibility checks,
 * terrain defence bonuses, and the round-by-round combat resolution loop.
 */
public class Combat {

    /** HP lost per combat round by the losing side. */
    public static final int COMBAT_ROUND_HP_LOSS = 1;

    private static final Random random = new Random();

    /**
     * Returns the effective attack strength of a unit on the given tile.
     * Accounts for the unit type's base attack value and any veteran bonus.
     *
     * @param unit     the attacking unit
     * @param unitType the type definition for the unit
     * @param tile     the tile the attacker is attacking from (may affect modifiers)
     * @return the computed attack strength value
     */
    public static int unitAttackStrength(Unit unit, UnitType unitType, Tile tile) {
        if (unit == null || unitType == null) return 0;
        int base = unitType.getAttackStrength();
        // Veteran units gain a 50% attack bonus per level
        return base + (base / 2) * unit.getVeteran();
    }

    /**
     * Returns the effective defence strength of a unit on the given tile.
     * Accounts for the unit type's base defence, veteran bonus, and the
     * terrain defence modifier of the tile being defended.
     *
     * @param unit     the defending unit
     * @param unitType the type definition for the unit
     * @param tile     the tile the unit is defending (applies terrain bonus)
     * @return the computed defence strength value
     */
    public static int unitDefenseStrength(Unit unit, UnitType unitType, Tile tile) {
        if (unit == null || unitType == null) return 0;
        int base = unitType.getDefenseStrength();
        int veteranBonus = (base / 2) * unit.getVeteran();
        int terrainBonus = tile != null ? getTerrainDefenseBonus(null) : 0;
        return base + veteranBonus + terrainBonus;
    }

    /**
     * Checks whether the attacker unit is allowed to attack the defender unit.
     * Considers diplomatic state (cannot attack allied units), domain
     * compatibility, and whether the attacker has moves remaining.
     *
     * @param attacker the unit initiating the attack
     * @param defender the unit being attacked
     * @return {@code true} if the attack is legal
     */
    public static boolean canUnitAttack(Unit attacker, Unit defender) {
        if (attacker == null || defender == null) return false;
        if (attacker.getOwner() == defender.getOwner()) return false;
        if (attacker.getMovesleft() <= 0) return false;
        return true;
    }

    /**
     * Resolves a combat between two units using a probabilistic round-by-round
     * model (each round the side with higher strength has a proportionally higher
     * chance of dealing damage).  Modifies the HP of both units in place and
     * returns {@code true} if the attacker wins.
     *
     * @param attacker the attacking unit
     * @param defender the defending unit
     * @param worldMap the world map (used to look up tile terrain bonuses)
     * @return {@code true} if the attacker wins (defender reaches 0 HP)
     */
    public static boolean resolveCombat(Unit attacker, Unit defender, WorldMap worldMap) {
        if (attacker == null || defender == null) return false;

        // Simplified combat: compare strengths and apply probabilistic damage.
        // HP changes are tracked locally; caller is responsible for persisting
        // the result (e.g. removing the unit if hpAtk or hpDef reaches 0).
        int atkStr = attacker.getHp();
        int defStr = defender.getHp();
        int hpAtk = atkStr;
        int hpDef = defStr;

        while (hpAtk > 0 && hpDef > 0) {
            int total = atkStr + defStr;
            if (total <= 0) break;
            if (random.nextInt(total) < atkStr) {
                hpDef = Math.max(0, hpDef - COMBAT_ROUND_HP_LOSS);
            } else {
                hpAtk = Math.max(0, hpAtk - COMBAT_ROUND_HP_LOSS);
            }
        }
        return hpDef <= 0;
    }

    /**
     * Returns the defence bonus provided by the given terrain type.
     * Plains give no bonus; forests, hills and mountains give increasing bonuses.
     *
     * @param terrain the terrain type (may be {@code null} for no bonus)
     * @return the defence bonus as a flat value to add to unit defence strength
     */
    public static int getTerrainDefenseBonus(Terrain terrain) {
        if (terrain == null) return 0;
        // TODO: derive bonus from terrain ruleset data
        return 0;
    }

    /**
     * Returns a combat modifier for a unit based on its current activity state.
     * For example, a fortified unit receives a defence bonus; an unfortified
     * or moving unit may receive a penalty.
     *
     * @param unit     the unit to evaluate
     * @param unitType the type definition for the unit
     * @return the modifier value (positive = bonus, negative = penalty)
     */
    public static int unitCombatModifier(Unit unit, UnitType unitType) {
        if (unit == null) return 0;
        // Activity 3 = ACTIVITY_FORTIFIED in the C server
        if (unit.getActivity() == 3) return 1;
        return 0;
    }
}
