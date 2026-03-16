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

    /**
     * Probability (out of 100) that the winning unit gains a veteran level after
     * combat.  Mirrors {@code maybe_make_veteran} in the C Freeciv server.
     */
    public static final int VETERAN_PROMOTION_CHANCE = 50;

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
     * Returns the effective attack strength of a unit, applying the tired-attack
     * penalty when the unit has fewer moves remaining than its full move rate.
     * Mirrors {@code base_get_attack_power} in the C Freeciv server's
     * {@code common/combat.c}: {@code power = power * moves_left / SINGLE_MOVE}
     * when {@code is_tired_attack(moves_left)} is true.
     *
     * @param unit      the attacking unit
     * @param unitType  the type definition for the unit
     * @param tile      the tile the attacker is attacking from (may affect modifiers)
     * @param movesLeft the number of move points the unit has remaining this turn
     * @return the computed attack strength value (reduced if the unit is tired)
     */
    public static int unitAttackStrength(Unit unit, UnitType unitType, Tile tile, int movesLeft) {
        if (unit == null || unitType == null) return 0;
        int base = unitType.getAttackStrength();
        int power = base + (base / 2) * unit.getVeteran();
        // Tired-attack penalty: if the unit has fewer moves left than its full move
        // rate (i.e. it has already moved this turn), reduce attack proportionally.
        // Mirrors is_tired_attack() / base_get_attack_power() in the C server.
        int moveRate = unitType.getMoveRate();
        if (moveRate > 0 && movesLeft < moveRate) {
            power = (power * Math.max(1, movesLeft)) / moveRate;
        }
        return Math.max(1, power); // ensure at least 1 so unit can always fight
    }

    /**
     * Returns the effective defence strength of a unit on the given tile.
     * Accounts for the unit type's base defence, veteran bonus, and the
     * terrain defence modifier of the tile being defended.
     * Mirrors the {@code get_defense_power} function in the C Freeciv server's
     * {@code common/combat.c}: {@code defence * (100 + terrain_defense_bonus) / 100}.
     *
     * @param unit         the defending unit
     * @param unitType     the type definition for the unit
     * @param tile         the tile the unit is defending (applies terrain bonus)
     * @param attackerType the unit type of the attacker, used to apply
     *                     anti-horse defense bonuses (may be {@code null})
     * @return the computed defence strength value
     */
    public static int unitDefenseStrength(Unit unit, UnitType unitType, Tile tile, UnitType attackerType) {
        if (unit == null || unitType == null) return 0;
        int base = unitType.getDefenseStrength();
        int veteranBonus = (base / 2) * unit.getVeteran();
        int terrainBonus = tile != null ? getTerrainDefenseBonusForTile(tile) : 0;
        // Apply terrain bonus as a percentage multiplier (matching C server formula)
        int defense = base + veteranBonus;
        defense = defense * (100 + terrainBonus) / 100;
        // Apply anti-horse defense bonus when the attacker has the "Horse" flag.
        // Mirrors the bonuses table for Pikemen in the classic Freeciv units ruleset:
        //   bonuses = { "Horse", "DefenseMultiplier", 1 } → defense × antiHorseFactor.
        if (attackerType != null && attackerType.hasHorseFlag() && unitType.getAntiHorseFactor() > 1) {
            defense = defense * unitType.getAntiHorseFactor();
        }
        return defense;
    }

    /**
     * Returns the effective defence strength of a unit on the given tile.
     * Convenience overload without attacker type (no anti-horse check).
     * Mirrors the {@code get_defense_power} function in the C Freeciv server's
     * {@code common/combat.c}: {@code defence * (100 + terrain_defense_bonus) / 100}.
     *
     * @param unit     the defending unit
     * @param unitType the type definition for the unit
     * @param tile     the tile the unit is defending (applies terrain bonus)
     * @return the computed defence strength value
     */
    public static int unitDefenseStrength(Unit unit, UnitType unitType, Tile tile) {
        return unitDefenseStrength(unit, unitType, tile, null);
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
     * model that mirrors the C Freeciv server's {@code do_unit_attack_tiles}
     * formula.  Each round the attacker wins with probability
     * {@code atkStr / (atkStr + defStr)}; the loser loses 1 HP.  Combat ends
     * when either unit reaches 0 HP.
     *
     * <p>Attack and defence strengths are derived from the units' {@link UnitType}
     * definitions (mirroring {@code base_get_attack_power} /
     * {@code get_defense_power} in {@code common/combat.c}), not from the units'
     * current HP.  Terrain and fortification bonuses are applied to defence.
     *
     * <p>Modifies the HP of both units in place.  The caller is responsible for
     * removing any unit that reaches 0 HP from the game.
     *
     * @param attacker              the attacking unit
     * @param attackerType          the unit-type definition for the attacker
     * @param defenderTile          the tile the defender is standing on (for terrain bonus)
     * @param defender              the defending unit
     * @param defenderType          the unit-type definition for the defender
     * @param defenderExtraDefBonus additional defence bonus percentage (e.g. 50 for
     *                              city walls); added on top of terrain and veteran bonuses
     * @return {@code true} if the attacker wins (defender reaches 0 HP)
     */
    public static boolean resolveCombat(Unit attacker, UnitType attackerType,
                                        Unit defender, UnitType defenderType,
                                        Tile defenderTile, int defenderExtraDefBonus) {
        if (attacker == null || defender == null) return false;

        // Effective attack strength with tired-attack penalty: when the attacker
        // has already used some move points this turn, its attack power is reduced
        // proportionally.  Mirrors base_get_attack_power() / is_tired_attack() in
        // the C Freeciv server's common/combat.c.
        int atkStr = unitAttackStrength(attacker, attackerType, null, attacker.getMovesleft());
        // A unit with zero base attack strength cannot win combat — the defender
        // always survives.  Mirrors the C server where can_unit_attack_tile()
        // returns FALSE for units with attack_strength=0 (is_military_unit()=false).
        // Game.attackUnit() already guards against this, but this check makes
        // resolveCombat() safe to call in isolation without that pre-condition.
        if (atkStr <= 0) return false;

        // Effective defence strength (base + veteran + terrain + anti-horse bonus).
        // Pass attackerType to unitDefenseStrength so that the anti-horse defense
        // bonus (Pikemen vs. Horse-flagged units) is applied when relevant.
        // Mirrors get_defense_power() with unit bonus modifiers in common/combat.c.
        int defStr = unitDefenseStrength(defender, defenderType, defenderTile, attackerType);
        // Apply fortification bonus as a percentage: e.g. +25% for fortified units.
        // unitCombatModifier() returns a percentage (25 = 25%), applied as
        // defStr * (100 + bonus) / 100 — mirrors POWER_BONUS_FACTOR in common/combat.c.
        int fortifyBonus = unitCombatModifier(defender, defenderType);
        if (fortifyBonus > 0) {
            defStr = defStr * (100 + fortifyBonus) / 100;
        }
        // Apply extra defence bonus (e.g. city walls +50%); mirrors EFT_DEFEND_BONUS in C server
        if (defenderExtraDefBonus > 0) {
            defStr = defStr * (100 + defenderExtraDefBonus) / 100;
        }
        if (defStr <= 0) defStr = 1;

        // Firepower values determine HP damage per combat round won.
        // Mirrors the firepower field in the C Freeciv units ruleset:
        // when the attacker wins a round, defender loses attacker's firepower HP;
        // when defender wins, attacker loses defender's firepower HP.
        // Most units have firepower=1; advanced units (Artillery, Fighter) have
        // firepower=2, making them more decisive in prolonged combat.
        // getFirepower() guarantees a minimum of 1, so no extra guard is needed.
        int atkFirepower = (attackerType != null) ? attackerType.getFirepower() : 1;
        int defFirepower = (defenderType != null) ? defenderType.getFirepower() : 1;

        int hpAtk = attacker.getHp();
        int hpDef = defender.getHp();

        while (hpAtk > 0 && hpDef > 0) {
            int total = atkStr + defStr;
            if (total <= 0) break;
            if (random.nextInt(total) < atkStr) {
                // Attacker wins this round: defender loses attacker's firepower HP
                hpDef = Math.max(0, hpDef - atkFirepower);
            } else {
                // Defender wins this round: attacker loses defender's firepower HP
                hpAtk = Math.max(0, hpAtk - defFirepower);
            }
        }

        attacker.setHp(hpAtk);
        defender.setHp(hpDef);
        return hpDef <= 0;
    }

    /**
     * Convenience overload with no extra defence bonus.
     * Equivalent to calling {@link #resolveCombat(Unit, UnitType, Unit, UnitType, Tile, int)}
     * with {@code defenderExtraDefBonus = 0}.
     *
     * @param attacker     the attacking unit
     * @param attackerType the unit-type definition for the attacker
     * @param defenderTile the tile the defender is standing on (for terrain bonus)
     * @param defender     the defending unit
     * @param defenderType the unit-type definition for the defender
     * @return {@code true} if the attacker wins (defender reaches 0 HP)
     */
    public static boolean resolveCombat(Unit attacker, UnitType attackerType,
                                        Unit defender, UnitType defenderType,
                                        Tile defenderTile) {
        return resolveCombat(attacker, attackerType, defender, defenderType, defenderTile, 0);
    }

    /**
     * Returns the defence bonus provided by the given terrain type, as a
     * percentage value (e.g. 50 = +50% defence).
     * Mirrors the {@code defense_bonus} field in the Freeciv terrain ruleset:
     * Forest=50, Hills=100, Jungle=50, Mountains=200, Swamp=50, others=0.
     *
     * @param terrain the terrain type (may be {@code null} for no bonus)
     * @return the defence bonus percentage
     */
    public static int getTerrainDefenseBonus(Terrain terrain) {
        if (terrain == null) return 0;
        return terrain.getDefenseBonus();
    }

    /**
     * Looks up the terrain for a tile by its terrain index and returns the
     * defence bonus percentage.  Returns 0 when the terrain cannot be resolved.
     *
     * @param tile the tile whose terrain defence bonus is needed
     * @return the defence bonus percentage
     */
    static int getTerrainDefenseBonusForTile(Tile tile) {
        if (tile == null) return 0;
        // Terrain defense bonuses indexed by terrain ID (matching Game.initGame order)
        // Forest=50, Hills=100, Jungle=50, Mountains=200, Swamp=50, others=0
        switch (tile.getTerrain()) {
            case 6:  return 50;   // Forest
            case 8:  return 100;  // Hills
            case 9:  return 50;   // Jungle
            case 10: return 200;  // Mountains
            case 12: return 50;   // Swamp
            default: return 0;
        }
    }

    /**
     * Returns a combat defence bonus percentage for a unit based on its current
     * activity state.  A fortified unit receives a +50% defence bonus, mirroring
     * the {@code Fortify_Defense_Bonus} effect (value=50) in the C Freeciv server's
     * classic {@code effects.ruleset}.
     * The returned value is applied as: {@code defStr * (100 + bonus) / 100}.
     *
     * @param unit     the unit to evaluate
     * @param unitType the type definition for the unit
     * @return the defence bonus percentage (e.g. 50 = +50%), or 0 for no bonus
     */
    public static int unitCombatModifier(Unit unit, UnitType unitType) {
        if (unit == null) return 0;
        // ACTIVITY_FORTIFIED = 4: grants +50% defence bonus.
        // Mirrors effect_fortified: Fortify_Defense_Bonus = 50 in classic effects.ruleset.
        if (unit.getActivity() == net.freecivx.server.CityTurn.ACTIVITY_FORTIFIED) return 50;
        return 0;
    }

    /**
     * Possibly promotes a unit to the next veteran level after combat.
     * Each call has a {@link #VETERAN_PROMOTION_CHANCE}% probability of
     * increasing the unit's veteran level by 1, up to the unit type's maximum
     * veteran levels.  Mirrors {@code maybe_make_veteran} in the C Freeciv
     * server's {@code server/unittools.c}.
     *
     * @param unit     the unit to potentially promote
     * @param unitType the type definition for the unit (provides max veteran levels)
     * @return {@code true} if the unit was promoted to a higher veteran level
     */
    public static boolean maybePromoteVeteran(Unit unit, UnitType unitType) {
        if (unit == null || unitType == null) return false;
        int maxVet = Math.max(1, unitType.getVeteranLevels()) - 1;
        if (unit.getVeteran() >= maxVet) return false;
        if (random.nextInt(100) < VETERAN_PROMOTION_CHANCE) {
            unit.setVeteran(unit.getVeteran() + 1);
            return true;
        }
        return false;
    }
}
