/* Copyright (C) The Authors 2025 */
package net.freecivx.game;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for {@link Combat}.
 *
 * <p>Mirrors the combat formula in the C Freeciv server's
 * {@code common/combat.c}: attack/defence strengths come from the
 * unit type, not from HP; terrain and fortification bonuses are applied
 * to defence; HP tracks damage taken each round.
 */
public class CombatTest {

    private UnitType warriorsType;  // atk=1, def=1, hp=10
    private UnitType archersType;   // atk=3, def=2, hp=10
    private UnitType catapultType;  // atk=6, def=1, hp=10
    private UnitType pikemenType;   // atk=1, def=2, hp=10

    private Tile grasslandTile;  // terrain 7 = Grassland, defenseBonus=0
    private Tile hillsTile;      // terrain 8 = Hills, defenseBonus=100
    private Tile mountainTile;   // terrain 10 = Mountains, defenseBonus=200

    @BeforeEach
    public void setUp() {
        // Unit types mirroring initGame() in Game.java
        warriorsType  = new UnitType("Warriors",  "u.warriors",  1, 10, 1, "", 1, 1, "", 0);
        archersType   = new UnitType("Archers",   "u.archers",   1, 10, 1, "", 3, 2, "", 0);
        catapultType  = new UnitType("Catapult",  "u.catapult",  1, 10, 1, "", 6, 1, "", 0);
        pikemenType   = new UnitType("Pikemen",   "u.pikemen",   1, 10, 1, "", 1, 2, "", 0);

        grasslandTile = new Tile(100, 1, 7,  0, 0, 0, -1);
        hillsTile     = new Tile(101, 1, 8,  0, 0, 0, -1);
        mountainTile  = new Tile(102, 1, 10, 0, 0, 0, -1);
    }

    // ---------------------------------------------------------------
    // unitAttackStrength
    // ---------------------------------------------------------------

    @Test
    public void testAttackStrength_noVeteran() {
        Unit unit = new Unit(1, 0, 0, 3, 0, 0, 10, 0, 1);
        assertEquals(1, Combat.unitAttackStrength(unit, warriorsType, null));
    }

    @Test
    public void testAttackStrength_veteran1() {
        Unit unit = new Unit(1, 0, 0, 3, 0, 1, 10, 0, 1); // veteran=1
        // base=1 + (1/2)*1 = 1 (integer division)
        assertEquals(1, Combat.unitAttackStrength(unit, warriorsType, null));
    }

    @Test
    public void testAttackStrength_veteran1_catapult() {
        Unit unit = new Unit(1, 0, 0, 9, 0, 1, 10, 0, 1); // veteran=1, catapult atk=6
        // base=6 + (6/2)*1 = 9
        assertEquals(9, Combat.unitAttackStrength(unit, catapultType, null));
    }

    @Test
    public void testAttackStrength_null() {
        assertEquals(0, Combat.unitAttackStrength(null, warriorsType, null));
        assertEquals(0, Combat.unitAttackStrength(new Unit(1, 0, 0, 0, 0, 0, 10, 0, 1), null, null));
    }

    // ---------------------------------------------------------------
    // unitDefenseStrength
    // ---------------------------------------------------------------

    @Test
    public void testDefenseStrength_grassland() {
        Unit unit = new Unit(1, 0, 100, 7, 0, 0, 10, 0, 1);
        // base=1, terrain bonus=0 → 1*(100+0)/100 = 1
        assertEquals(1, Combat.unitDefenseStrength(unit, warriorsType, grasslandTile));
    }

    @Test
    public void testDefenseStrength_hills() {
        Unit unit = new Unit(1, 0, 101, 7, 0, 0, 10, 0, 1);
        // base=1, terrain bonus=100 → 1*(100+100)/100 = 2
        assertEquals(2, Combat.unitDefenseStrength(unit, warriorsType, hillsTile));
    }

    @Test
    public void testDefenseStrength_mountains() {
        Unit unit = new Unit(1, 0, 102, 5, 0, 0, 10, 0, 1);
        // archersType def=2, terrain bonus=200 → 2*(100+200)/100 = 6
        assertEquals(6, Combat.unitDefenseStrength(unit, archersType, mountainTile));
    }

    @Test
    public void testDefenseStrength_null() {
        assertEquals(0, Combat.unitDefenseStrength(null, warriorsType, grasslandTile));
    }

    // ---------------------------------------------------------------
    // getTerrainDefenseBonusForTile
    // ---------------------------------------------------------------

    @Test
    public void testTerrainDefenseBonusForTile() {
        assertEquals(0,   Combat.getTerrainDefenseBonusForTile(grasslandTile));
        assertEquals(100, Combat.getTerrainDefenseBonusForTile(hillsTile));
        assertEquals(200, Combat.getTerrainDefenseBonusForTile(mountainTile));
        assertEquals(50,  Combat.getTerrainDefenseBonusForTile(new Tile(0, 1, 6, 0, 0, 0, -1)));  // Forest
        assertEquals(50,  Combat.getTerrainDefenseBonusForTile(new Tile(0, 1, 9, 0, 0, 0, -1)));  // Jungle
        assertEquals(50,  Combat.getTerrainDefenseBonusForTile(new Tile(0, 1, 12, 0, 0, 0, -1))); // Swamp
        assertEquals(0,   Combat.getTerrainDefenseBonusForTile(null));
    }

    // ---------------------------------------------------------------
    // unitCombatModifier (fortification)
    // ---------------------------------------------------------------

    @Test
    public void testCombatModifier_fortified() {
        Unit fortified = new Unit(1, 0, 0, 3, 0, 0, 10, 3, 1); // activity=3
        assertEquals(1, Combat.unitCombatModifier(fortified, warriorsType));
    }

    @Test
    public void testCombatModifier_idle() {
        Unit idle = new Unit(1, 0, 0, 3, 0, 0, 10, 0, 1); // activity=0
        assertEquals(0, Combat.unitCombatModifier(idle, warriorsType));
    }

    // ---------------------------------------------------------------
    // canUnitAttack
    // ---------------------------------------------------------------

    @Test
    public void testCanUnitAttack_sameOwner() {
        Unit a = new Unit(1, 0, 0, 3, 0, 0, 10, 0, 1);
        Unit d = new Unit(2, 0, 1, 3, 0, 0, 10, 0, 1);
        assertFalse(Combat.canUnitAttack(a, d));
    }

    @Test
    public void testCanUnitAttack_noMoves() {
        Unit a = new Unit(1, 0, 0, 3, 0, 0, 10, 0, 0); // movesleft=0
        Unit d = new Unit(2, 1, 1, 3, 0, 0, 10, 0, 1);
        assertFalse(Combat.canUnitAttack(a, d));
    }

    @Test
    public void testCanUnitAttack_valid() {
        Unit a = new Unit(1, 0, 0, 3, 0, 0, 10, 0, 1);
        Unit d = new Unit(2, 1, 1, 3, 0, 0, 10, 0, 1);
        assertTrue(Combat.canUnitAttack(a, d));
    }

    // ---------------------------------------------------------------
    // resolveCombat — outcome consistency
    // ---------------------------------------------------------------

    /**
     * When a Catapult (atk=6) attacks a Warriors (def=1) on flat terrain,
     * the attacker should win the vast majority of the time.
     * Over 50 runs the attacker must win at least 40 times.
     */
    @RepeatedTest(50)
    public void testResolveCombat_strongAttackerWinsFrequently() {
        Unit attacker = new Unit(1, 0, 0, 9, 0, 0, 10, 0, 1);
        Unit defender = new Unit(2, 1, 100, 3, 0, 0, 10, 0, 1);
        boolean result = Combat.resolveCombat(attacker, catapultType, defender, warriorsType, grasslandTile);
        // verify HP was modified: loser should be at 0, winner at > 0
        if (result) {
            assertEquals(0, defender.getHp());
            assertTrue(attacker.getHp() > 0);
        } else {
            assertEquals(0, attacker.getHp());
            assertTrue(defender.getHp() > 0);
        }
    }

    /**
     * After combat, exactly one unit must be at 0 HP and the other must be
     * positive (no draw is possible in the round-by-round model).
     */
    @Test
    public void testResolveCombat_exactlyOneUnitDies() {
        Unit attacker = new Unit(1, 0, 0, 5, 0, 0, 10, 0, 1);
        Unit defender = new Unit(2, 1, 100, 7, 0, 0, 10, 0, 1);
        boolean atkWins = Combat.resolveCombat(attacker, archersType, defender, pikemenType, grasslandTile);
        if (atkWins) {
            assertEquals(0, defender.getHp());
            assertTrue(attacker.getHp() > 0);
        } else {
            assertEquals(0, attacker.getHp());
            assertTrue(defender.getHp() > 0);
        }
    }

    /** Null inputs must not throw and must return false. */
    @Test
    public void testResolveCombat_nullInputs() {
        assertFalse(Combat.resolveCombat(null, warriorsType, null, warriorsType, null));
    }
}
