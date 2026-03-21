/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.freecivx.com/
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

package net.freecivx.ai;

import net.freecivx.game.City;
import net.freecivx.game.Game;
import net.freecivx.game.Movement;
import net.freecivx.game.Player;
import net.freecivx.game.Tile;
import net.freecivx.game.Unit;
import net.freecivx.game.UnitType;
import net.freecivx.server.CityTurn;
import net.freecivx.server.DiplHand;
import net.freecivx.server.Diplomats;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Random;

/**
 * Military unit AI, movement helpers, and unit assessment utilities.
 * Handles garrison assignment, attack target selection, movement toward
 * targets, and city-danger evaluation.
 *
 * <p>Mirrors {@code ai/default/daiunit.c} and
 * {@code ai/default/daimilitary.c} in the C Freeciv server.
 */
class AiMilitary {

    private static final Logger log = LoggerFactory.getLogger(AiMilitary.class);

    private final AiPlayer ai;
    private final Game game;
    private final Random random;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /**
     * Maximum distance (Manhattan) at which enemy units contribute to a city's
     * danger score.  Mirrors {@code ASSESS_DANGER_MAX_DISTANCE} in daimilitary.c.
     */
    static final int ASSESS_DANGER_MAX_DISTANCE = 6;

    /**
     * Danger score threshold above which a city is considered in grave danger
     * and triggers an emergency production override.
     * Mirrors {@code city_data->grave_danger} in daimilitary.c.
     */
    static final int GRAVE_DANGER_THRESHOLD = 15;

    /**
     * HP fraction below which a unit is considered critically injured and
     * should retreat to the nearest friendly city for recovery.
     * Mirrors the {@code punit->hp < punittype->hp * 0.25} check in
     * {@code dai_manage_hitpoint_recovery()} in {@code ai/default/daiunit.c}.
     */
    private static final double HP_RECOVERY_THRESHOLD = 0.25;

    private static final int TERRAIN_OCEAN      = 2;
    private static final int TERRAIN_DEEP_OCEAN = 3;

    /** Unit domain constant for land units (matches C server {@code UTYF_LAND}). */
    private static final int DOMAIN_LAND  = 0;
    /** Unit domain constant for sea units (matches C server {@code UTYF_SEA}). */
    private static final int DOMAIN_SEA   = 1;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    AiMilitary(AiPlayer ai) {
        this.ai = ai;
        this.game = ai.game;
        this.random = ai.random;
    }

    // =========================================================================
    // Military unit AI (mirrors daiunit.c / daimilitary.c)
    // =========================================================================

    /**
     * Military unit AI: assign units to defend ungarrisoned friendly cities
     * before hunting enemies.  Mirrors the city-garrison and danger-assessment
     * logic in {@code ai/default/daimilitary.c} and the persistent unit-task
     * assignment in {@code ai/default/daiunit.c}.
     *
     * <p>A unit that stays in a city to garrison it is switched to
     * {@code ACTIVITY_FORTIFIED} (activity=4) after reaching its post.
     *
     * <p>Critically injured units (HP &lt; 25% of max) are redirected to the
     * nearest friendly city for HP recovery before engaging in combat.
     * Mirrors {@code AIUNIT_RECOVER} / {@code dai_manage_hitpoint_recovery()}
     * in {@code ai/default/daiunit.c}.
     */
    void handleMilitaryUnit(Unit unit, UnitType utype, Player owner) {
        long unitId = unit.getId();
        long ownerId = owner.getPlayerNo();

        // HP recovery: badly damaged units retreat to friendly city first.
        // Mirrors the `punit->hp < punittype->hp * 0.25` check in daiunit.c.
        if (needsHpRecovery(unit, utype)) {
            manageHpRecovery(unit, utype, ownerId);
            return;
        }

        Long defenseTarget = ai.unitTargets.get(unitId);
        if (defenseTarget == null) {
            defenseTarget = findUndefendedCityTile(ownerId, unitId);
            if (defenseTarget != null) {
                ai.unitTargets.put(unitId, defenseTarget);
            }
        }

        while (unit.getMovesleft() > 0 && game.units.containsKey(unit.getId())) {
            if (attackAdjacentEnemy(unit, owner)) continue;

            if (defenseTarget != null) {
                if (unit.getTile() == defenseTarget) {
                    if (countUnitsOnTile(defenseTarget, ownerId) >= 2) {
                        ai.unitTargets.remove(unitId);
                        defenseTarget = null;
                    } else {
                        // Stay put — sole defender. Switch to FORTIFY for the +50% defence bonus.
                        // Mirrors the AIUNIT_DEFEND_HOME → ACTIVITY_FORTIFYING path in daiunit.c.
                        if (unit.getActivity() != CityTurn.ACTIVITY_FORTIFIED) {
                            game.changeUnitActivity(unitId, CityTurn.ACTIVITY_FORTIFIED);
                        }
                        break;
                    }
                } else {
                    if (!moveUnitToward(unit, utype, defenseTarget)) break;
                }
            } else {
                long offensiveTarget = findNearestOffensiveTarget(unit.getTile(), ownerId);
                if (offensiveTarget >= 0) {
                    if (!moveUnitToward(unit, utype, offensiveTarget)) break;
                } else {
                    if (!moveUnitRandomly(unit, utype)) break;
                }
            }
        }
    }

    /**
     * Handles AI behaviour for a diplomat or spy unit.  The diplomat moves
     * toward the nearest reachable enemy city and, once adjacent, attempts to
     * establish an embassy.  Mirrors the basic diplomat-city targeting in the C
     * Freeciv server's {@code ai/default/daidiplomacy.c}.
     *
     * @param unit  the diplomat unit
     * @param utype the unit type definition
     * @param owner the owning AI player
     */
    void handleDiplomatUnit(Unit unit, UnitType utype, Player owner) {
        long ownerId = owner.getPlayerNo();

        long targetTile = -1;
        long bestDist = Long.MAX_VALUE;
        for (City city : game.cities.values()) {
            if (city.getOwner() == ownerId) continue;
            long cx = city.getTile() % game.map.getXsize();
            long cy = city.getTile() / game.map.getXsize();
            long ux = unit.getTile() % game.map.getXsize();
            long uy = unit.getTile() / game.map.getXsize();
            long dist = Math.abs(cx - ux) + Math.abs(cy - uy);
            if (dist < bestDist) {
                bestDist = dist;
                targetTile = city.getTile();
            }
        }
        if (targetTile < 0) return;

        if (Diplomats.isTileAdjacentOrEqual(game, unit.getTile(), targetTile)) {
            Tile tt = game.tiles.get(targetTile);
            if (tt != null && tt.getWorked() > 0) {
                Diplomats.establishEmbassy(game, unit.getId(), tt.getWorked());
            }
            return;
        }

        while (unit.getMovesleft() > 0 && game.units.containsKey(unit.getId())) {
            if (!moveUnitToward(unit, utype, targetTile)) break;
            if (Diplomats.isTileAdjacentOrEqual(game, unit.getTile(), targetTile)) break;
        }
    }

    // =========================================================================
    // HP recovery (mirrors AIUNIT_RECOVER / dai_manage_hitpoint_recovery() in daiunit.c)
    // =========================================================================

    /**
     * Returns {@code true} if the unit is critically injured and should
     * prioritise HP recovery over combat.
     * Mirrors the {@code punit->hp < punittype->hp * 0.25} threshold in
     * {@code dai_manage_hitpoint_recovery()} in {@code ai/default/daiunit.c}.
     *
     * @param unit  the unit to check
     * @param utype the unit's type (provides max HP)
     * @return {@code true} if the unit needs to retreat to a city for healing
     */
    boolean needsHpRecovery(Unit unit, UnitType utype) {
        int maxHp = utype.getHp();
        return maxHp > 0 && unit.getHp() < maxHp * HP_RECOVERY_THRESHOLD;
    }

    /**
     * Sends a critically injured unit to the nearest friendly city to recover
     * HP.  While in a friendly city the unit fortifies to receive any available
     * HP regeneration bonus (e.g. from Barracks).  Once HP is fully restored
     * normal combat duty resumes next turn.
     *
     * <p>Mirrors {@code dai_manage_hitpoint_recovery()} in
     * {@code ai/default/daiunit.c}: move toward the nearest safe city; if
     * already in a city, fortify and wait.
     *
     * @param unit    the injured unit
     * @param utype   the unit's type
     * @param ownerId the owning player's ID
     */
    void manageHpRecovery(Unit unit, UnitType utype, long ownerId) {
        // If already in a friendly city, fortify to heal.
        Tile currentTile = game.tiles.get(unit.getTile());
        if (currentTile != null && currentTile.getWorked() > 0) {
            City city = game.cities.get((long) currentTile.getWorked());
            if (city != null && city.getOwner() == ownerId) {
                if (unit.getActivity() != CityTurn.ACTIVITY_FORTIFIED) {
                    game.changeUnitActivity(unit.getId(), CityTurn.ACTIVITY_FORTIFIED);
                    log.debug("Unit {} (HP={}/{}) fortifying in {} to recover",
                            unit.getId(), unit.getHp(), utype.getHp(), city.getName());
                }
                return;
            }
        }

        // Not in a friendly city — move toward the nearest one.
        long safeCityTile = findNearestFriendlyCityTile(unit.getTile(), ownerId, utype);
        if (safeCityTile >= 0) {
            log.debug("Unit {} (HP={}/{}) retreating to recover HP", unit.getId(),
                    unit.getHp(), utype.getHp());
            while (unit.getMovesleft() > 0 && game.units.containsKey(unit.getId())) {
                if (!moveUnitToward(unit, utype, safeCityTile)) break;
            }
        }
    }

    /**
     * Returns the tile ID of the nearest friendly city reachable by this unit.
     * Land units search land cities; naval units search coastal cities.
     * Mirrors the {@code find_nearest_safe_city()} helper in
     * {@code ai/default/daiunit.c}.
     *
     * @param fromTile the unit's current tile ID
     * @param ownerId  the owning player's ID
     * @param utype    the unit type (used to filter by domain)
     * @return the tile ID of the nearest friendly city, or {@code -1} if none
     */
    long findNearestFriendlyCityTile(long fromTile, long ownerId, UnitType utype) {
        long x = fromTile % game.map.getXsize();
        long y = fromTile / game.map.getXsize();
        long bestTile = -1;
        long bestDist = Long.MAX_VALUE;

        for (City city : game.cities.values()) {
            if (city.getOwner() != ownerId) continue;
            // Naval units recover in coastal cities; land units in any city.
            if (utype.getDomain() == DOMAIN_SEA && !isCityCoastal(city.getTile())) continue;
            long cx = city.getTile() % game.map.getXsize();
            long cy = city.getTile() / game.map.getXsize();
            long dist = Math.abs(cx - x) + Math.abs(cy - y);
            if (dist < bestDist) {
                bestDist = dist;
                bestTile = city.getTile();
            }
        }
        return bestTile;
    }

    // =========================================================================
    // Diplomacy helpers
    // =========================================================================

    /**
     * Returns {@code true} if {@code ownerId} is currently at war with
     * {@code otherId}.  Mirrors the {@code pplayers_at_war()} check used
     * throughout the C Freeciv AI.
     *
     * @param ownerId the AI player's ID
     * @param otherId the other player's ID
     * @return {@code true} when the two players are in a DS_WAR relationship
     */
    boolean isAtWarWith(long ownerId, long otherId) {
        Player owner = game.players.get(ownerId);
        if (owner == null) return false;
        return owner.getDiplState(otherId) == DiplHand.DS_WAR;
    }

    // =========================================================================
    // City danger assessment (mirrors daimilitary.c)
    // =========================================================================

    /**
     * Computes a numeric danger score for a city by comparing incoming enemy
     * threat against the city's current garrison defence.
     *
     * <p>The raw threat is the sum of enemy-unit attack-strength values weighted
     * by proximity (closer enemies contribute more).  Only units belonging to
     * players at war (DS_WAR) are counted, mirroring the
     * {@code pplayers_at_war()} filter in {@code assess_danger()} in
     * {@code ai/default/daimilitary.c}.
     *
     * <p>The garrison defence score is the sum of defence-strength values of
     * all friendly military units currently on the city tile.  The final danger
     * score is {@code max(0, threat - garrisonDefence)}, so a city that already
     * has a strong garrison contributes 0 (no additional units needed).
     * This mirrors the {@code defense_value} vs {@code attack_value} comparison
     * in {@code assess_danger()} in the C Freeciv server.
     *
     * @param city the city to evaluate
     * @return non-negative net danger score; 0 = no net threat
     */
    int assessCityDanger(City city) {
        long cx = city.getTile() % game.map.getXsize();
        long cy = city.getTile() / game.map.getXsize();
        long ownerId = city.getOwner();
        int threatScore = 0;
        int garrisonDefence = 0;

        for (Unit u : game.units.values()) {
            if (u.getOwner() == ownerId) {
                // Friendly unit on the city tile: contribute to garrison defence.
                if (u.getTile() == city.getTile()) {
                    UnitType utype = game.unitTypes.get((long) u.getType());
                    if (utype != null && utype.getDefenseStrength() > 0) {
                        garrisonDefence += utype.getDefenseStrength() * veteranFactor(u);
                    }
                }
                continue;
            }
            // Only count units belonging to players we are at war with.
            if (!isAtWarWith(ownerId, u.getOwner())) continue;
            UnitType utype = game.unitTypes.get((long) u.getType());
            if (utype == null || utype.getAttackStrength() == 0) continue;

            long ux = u.getTile() % game.map.getXsize();
            long uy = u.getTile() / game.map.getXsize();
            long dist = Math.abs(ux - cx) + Math.abs(uy - cy);
            if (dist > ASSESS_DANGER_MAX_DISTANCE) continue;

            // Weight threat by proximity; veteran bonus adds extra threat.
            threatScore += utype.getAttackStrength()
                    * (ASSESS_DANGER_MAX_DISTANCE + 1 - dist)
                    * veteranFactor(u);
        }

        // Net danger = how much the threat exceeds the current garrison.
        // A well-defended city returns 0 even if there are nearby enemies.
        return Math.max(0, threatScore - garrisonDefence);
    }

    /**
     * Returns a multiplier that scales a unit's combat effectiveness based on
     * its veteran level.  A veteran level of 0 returns 1; each additional level
     * adds 1 more, so a maximum-veteran unit contributes proportionally more.
     * Used consistently in both threat and garrison calculations in
     * {@link #assessCityDanger(City)} so that the formula is applied identically
     * on both sides of the danger comparison.
     *
     * @param unit the unit to evaluate
     * @return veteran factor ≥ 1
     */
    private static int veteranFactor(Unit unit) {
        return 1 + unit.getVeteran();
    }

    // =========================================================================
    // Unit building helpers (mirrors daibuild.c / daimilitary.c)
    // =========================================================================

    /**
     * Returns the best available military defender the player can build.
     * Covers the full classic-ruleset progression through Riflemen.
     * Mirrors {@code dai_build_adv_adjust_tech()} in {@code ai/default/daibuild.c}.
     */
    int bestAvailableDefender(Player player) {
        if (ai.techConscription >= 0 && ai.unitRiflemen   >= 0 && player.hasTech(ai.techConscription))  return ai.unitRiflemen;
        if (ai.techGunpowder    >= 0 && ai.unitMusketeers >= 0 && player.hasTech(ai.techGunpowder))      return ai.unitMusketeers;
        if (player.hasTech(ai.techIronWorking))   return ai.unitLegion;
        if (player.hasTech(ai.techWarriorCode))   return ai.unitArchers;
        if (player.hasTech(ai.techBronzeWorking)) return ai.unitPhalanx;
        return AiPlayer.UNIT_WARRIORS;
    }

    /**
     * Returns the best available offensive unit the player can build.
     * Covers the full classic-ruleset progression from Warriors through Armor.
     * Mirrors {@code dai_choose_attacker()} in {@code ai/default/daimilitary.c}.
     */
    int bestAvailableAttacker(Player player) {
        if (ai.techMobileWarfare >= 0 && ai.unitArmor    >= 0 && player.hasTech(ai.techMobileWarfare)) return ai.unitArmor;
        if (ai.techTactics       >= 0 && ai.unitCavalry  >= 0 && player.hasTech(ai.techTactics))       return ai.unitCavalry;
        if (ai.techConscription  >= 0 && ai.unitRiflemen >= 0 && player.hasTech(ai.techConscription))  return ai.unitRiflemen;
        if (ai.techChivalry      >= 0 && ai.unitKnights  >= 0 && player.hasTech(ai.techChivalry))      return ai.unitKnights;
        if (ai.techGunpowder     >= 0 && ai.unitMusketeers >= 0 && player.hasTech(ai.techGunpowder))   return ai.unitMusketeers;
        if (player.hasTech(ai.techHorsebackRiding)) return ai.unitHorsemen;
        if (player.hasTech(ai.techIronWorking))     return ai.unitLegion;
        if (player.hasTech(ai.techWarriorCode))     return ai.unitArchers;
        return AiPlayer.UNIT_WARRIORS;
    }

    /**
     * Returns the best available siege unit the AI can build.
     * Siege units (Catapult, Cannon, Artillery, Howitzer) are high-attack
     * units for city assault.  Mirrors {@code dai_choose_attacker()} in
     * {@code ai/default/daimilitary.c}.
     *
     * @param player the AI player
     * @return the best siege unit type ID, or {@code -1} if none available
     */
    int bestAvailableSiegeUnit(Player player) {
        if (ai.techRobotics     >= 0 && ai.unitHowitzer  >= 0 && player.hasTech(ai.techRobotics))     return ai.unitHowitzer;
        if (ai.techMachineTools >= 0 && ai.unitArtillery >= 0 && player.hasTech(ai.techMachineTools))  return ai.unitArtillery;
        if (ai.techMetallurgy   >= 0 && ai.unitCannon    >= 0 && player.hasTech(ai.techMetallurgy))    return ai.unitCannon;
        if (ai.techMathematics  >= 0 && ai.unitCatapult  >= 0 && player.hasTech(ai.techMathematics))   return ai.unitCatapult;
        return -1;
    }

    /**
     * Returns the best available naval unit the AI can build.
     * Covers the full classic-ruleset naval progression.
     * Mirrors {@code dai_choose_naval()} in the C Freeciv AI.
     */
    int bestAvailableNavalUnit(Player player) {
        if (ai.unitBattleship >= 0 && ai.techAutomobile >= 0 && player.hasTech(ai.techAutomobile))  return ai.unitBattleship;
        if (ai.unitCruiser    >= 0 && ai.techSteel      >= 0 && player.hasTech(ai.techSteel))        return ai.unitCruiser;
        if (ai.unitDestroyer  >= 0 && ai.techElectricity >= 0 && player.hasTech(ai.techElectricity)) return ai.unitDestroyer;
        if (ai.unitCaravel    >= 0 && ai.techNavigation >= 0 && player.hasTech(ai.techNavigation))   return ai.unitCaravel;
        if (ai.unitTrireme    >= 0 && ai.techMapMaking  >= 0 && player.hasTech(ai.techMapMaking))    return ai.unitTrireme;
        return -1;
    }

    /**
     * Returns the best available air unit the AI can build.
     * Mirrors {@code dai_choose_air()} in the C Freeciv AI.
     */
    int bestAvailableAirUnit(Player player) {
        if (ai.unitBomber  >= 0 && ai.techAdvancedFlight >= 0 && player.hasTech(ai.techAdvancedFlight)) return ai.unitBomber;
        if (ai.unitFighter >= 0 && ai.techFlight >= 0 && player.hasTech(ai.techFlight)) return ai.unitFighter;
        return -1;
    }

    // =========================================================================
    // Unit count helpers
    // =========================================================================

    /**
     * Returns the number of units belonging to {@code ownerId} on the given tile.
     * Mirrors the garrison-count logic in {@code ai/default/daimilitary.c}.
     */
    int countUnitsOnTile(long tileId, long ownerId) {
        int count = 0;
        for (Unit u : game.units.values()) {
            if (u.getTile() == tileId && u.getOwner() == ownerId) count++;
        }
        return count;
    }

    /**
     * Returns the number of units of the given type belonging to {@code ownerId}.
     */
    int countUnitsOfType(long ownerId, int unitType) {
        int count = 0;
        for (Unit u : game.units.values()) {
            if (u.getOwner() == ownerId && u.getType() == unitType) count++;
        }
        return count;
    }

    /**
     * Counts the total number of military (attack_strength &gt; 0) units owned by
     * the given player.  Used by {@link AiCity} to cap army production so that
     * the build queue does not spiral into an unlimited military build-up.
     * Mirrors the army-size check in {@code dai_city_choose_build()} in
     * {@code ai/default/daicity.c}.
     *
     * @param ownerId the player ID to count for
     * @return number of military units owned by this player
     */
    int countMilitaryUnits(long ownerId) {
        int count = 0;
        for (Unit u : game.units.values()) {
            if (u.getOwner() != ownerId) continue;
            UnitType utype = game.unitTypes.get((long) u.getType());
            if (utype != null && utype.getAttackStrength() > 0) count++;
        }
        return count;
    }

    // =========================================================================
    // Target finding helpers
    // =========================================================================

    /**
     * Finds a friendly city tile that has no defending unit other than the
     * requesting unit.  Mirrors the garrison-check logic in
     * {@code ai/default/daimilitary.c}.
     *
     * @param ownerId the AI player's ID
     * @param unitId  the requesting unit (excluded from the garrison count)
     * @return the tile ID of an undefended city, or {@code null} if all defended
     */
    Long findUndefendedCityTile(long ownerId, long unitId) {
        for (City city : game.cities.values()) {
            if (city.getOwner() != ownerId) continue;
            long cityTile = city.getTile();
            int garrisons = 0;
            for (Unit u : game.units.values()) {
                if (u.getId() == unitId) continue;
                if (u.getOwner() == ownerId && u.getTile() == cityTile) garrisons++;
            }
            if (garrisons == 0) return cityTile;
        }
        return null;
    }

    /**
     * Looks for an enemy military unit on a tile adjacent to {@code unit} and
     * attacks it if found.  Only attacks units belonging to players that the
     * AI is currently at war with (DS_WAR), mirroring the
     * {@code pplayers_at_war()} guard in {@code dai_military_rampage()} in
     * {@code ai/default/daiunit.c}.  Civilian units are always skipped.
     *
     * @return {@code true} if an attack was initiated
     */
    boolean attackAdjacentEnemy(Unit unit, Player owner) {
        long ownerId = owner.getPlayerNo();

        UnitType myType = game.unitTypes.get((long) unit.getType());
        if (myType == null || myType.getAttackStrength() == 0) return false;

        for (int dir = 0; dir < 8; dir++) {
            int neighborTileId = game.nextTileInDirection(unit.getTile(), dir);
            if (neighborTileId < 0) continue;

            for (Unit other : new ArrayList<>(game.units.values())) {
                if (other.getTile() != neighborTileId) continue;
                if (other.getOwner() == ownerId) continue;
                // Only attack players we are at war with.
                if (!isAtWarWith(ownerId, other.getOwner())) continue;
                UnitType otherType = game.unitTypes.get((long) other.getType());
                if (otherType == null || otherType.getAttackStrength() == 0) continue;

                // Do not attack if the defender is significantly stronger.
                // Compute a simple power ratio: attack (with veteran bonus) vs
                // defence (with veteran bonus).  Mirrors the dai_unit_att_rating /
                // dai_unit_def_rating comparison in daiunit.c.
                int myAttack  = myType.getAttackStrength()  * (2 + unit.getVeteran());
                int theirDef  = otherType.getDefenseStrength() * (2 + other.getVeteran());
                // Scale threshold by AI skill level:
                //   Easy   (2): only attack when myAttack >= 2 × theirDef (cautious)
                //   Normal (3): attack when myAttack >= theirDef (current default)
                //   Hard   (4): attack when 3 × myAttack >= 2 × theirDef (aggressive)
                int skillLevel = game.getAiSkillLevel();
                boolean shouldAttack;
                if (skillLevel <= Game.AI_SKILL_EASY) {
                    shouldAttack = myAttack >= theirDef * 2;
                } else if (skillLevel >= Game.AI_SKILL_HARD) {
                    shouldAttack = myAttack * 3 >= theirDef * 2;
                } else {
                    shouldAttack = myAttack >= theirDef; // normal
                }
                if (!shouldAttack) continue; // Would likely lose – skip

                game.attackUnit(unit.getId(), other.getId());
                return true;
            }
        }
        return false;
    }

    /**
     * Returns the tile ID of the nearest enemy unit belonging to a player at
     * war with {@code ownerId}, or {@code -1} if none exist.
     * Mirrors the enemy-unit search in {@code dai_military_attack()} in
     * {@code ai/default/daimilitary.c}.
     */
    long findNearestEnemyTile(long fromTile, long ownerId) {
        long x = fromTile % game.map.getXsize();
        long y = fromTile / game.map.getXsize();
        long bestDist = Long.MAX_VALUE;
        long bestTile = -1;

        for (Unit other : game.units.values()) {
            if (other.getOwner() == ownerId) continue;
            if (!isAtWarWith(ownerId, other.getOwner())) continue;
            long ex = other.getTile() % game.map.getXsize();
            long ey = other.getTile() / game.map.getXsize();
            long dist = Math.abs(ex - x) + Math.abs(ey - y);
            if (dist < bestDist) {
                bestDist = dist;
                bestTile = other.getTile();
            }
        }
        return bestTile;
    }

    /**
     * Returns the tile ID of the best offensive target for a military unit.
     * Priority: (1) nearest undefended enemy city owned by a player at war,
     * (2) nearest defended enemy city at war, (3) nearest enemy unit at war.
     * Only targets players that are in a DS_WAR diplomatic state, mirroring the
     * {@code pplayers_at_war()} filter in {@code dai_military_attack()} in
     * {@code ai/default/daimilitary.c}.
     *
     * @param fromTile the attacker's current tile ID
     * @param ownerId  the attacker's player ID
     * @return the tile ID of the best offensive target, or {@code -1} if none
     */
    long findNearestOffensiveTarget(long fromTile, long ownerId) {
        long x = fromTile % game.map.getXsize();
        long y = fromTile / game.map.getXsize();

        long bestUndefCityTile = -1;
        long bestUndefCityDist = Long.MAX_VALUE;
        long bestDefCityTile  = -1;
        long bestDefCityDist  = Long.MAX_VALUE;

        for (City city : game.cities.values()) {
            if (city.getOwner() == ownerId) continue;
            // Only attack cities owned by players we are at war with.
            if (!isAtWarWith(ownerId, city.getOwner())) continue;
            long cx = city.getTile() % game.map.getXsize();
            long cy = city.getTile() / game.map.getXsize();
            long dist = Math.abs(cx - x) + Math.abs(cy - y);

            boolean isDefended = game.units.values().stream()
                    .anyMatch(u -> u.getTile() == city.getTile() && u.getOwner() == city.getOwner());

            if (!isDefended && dist < bestUndefCityDist) {
                bestUndefCityDist = dist;
                bestUndefCityTile = city.getTile();
            } else if (isDefended && dist < bestDefCityDist) {
                bestDefCityDist = dist;
                bestDefCityTile = city.getTile();
            }
        }

        if (bestUndefCityTile >= 0) return bestUndefCityTile;
        if (bestDefCityTile   >= 0) return bestDefCityTile;
        return findNearestEnemyTile(fromTile, ownerId);
    }

    // =========================================================================
    // Coastal check
    // =========================================================================

    /**
     * Returns {@code true} if the given city tile is coastal (at least one
     * adjacent tile is ocean).  Naval units can only be built in coastal cities.
     * Mirrors {@code is_ocean_near_tile()} in the C Freeciv server's
     * {@code common/map.c}.
     *
     * @param cityTileId the tile index of the city
     * @return {@code true} if the city is on the coast
     */
    boolean isCityCoastal(long cityTileId) {
        int xsize = game.map.getXsize();
        int ysize = game.map.getYsize();
        int cx = (int)(cityTileId % xsize);
        int cy = (int)(cityTileId / xsize);
        for (int dx = -1; dx <= 1; dx++) {
            for (int dy = -1; dy <= 1; dy++) {
                if (dx == 0 && dy == 0) continue;
                int nx = (cx + dx + xsize) % xsize;
                int ny = cy + dy;
                if (ny < 0 || ny >= ysize) continue;
                Tile t = game.tiles.get((long)(ny * xsize + nx));
                if (t != null) {
                    int terrain = t.getTerrain();
                    if (terrain == TERRAIN_OCEAN || terrain == TERRAIN_DEEP_OCEAN) return true;
                }
            }
        }
        return false;
    }

    // =========================================================================
    // Shared movement helpers (used by settler, worker, and military AI)
    // =========================================================================

    /**
     * Attempts to move a unit one step toward {@code targetTile} using
     * greedy best-first (Manhattan distance) selection.
     * Mirrors the movement logic used by multiple AI subsystems in the C server.
     *
     * @return {@code true} if the unit successfully moved one step
     */
    boolean moveUnitToward(Unit unit, UnitType utype, long targetTile) {
        if (unit.getMovesleft() <= 0) return false;

        long tx = targetTile % game.map.getXsize();
        long ty = targetTile / game.map.getXsize();

        int bestDir = -1;
        long bestDist = Long.MAX_VALUE;

        for (int dir = 0; dir < 8; dir++) {
            int newTileId = game.nextTileInDirection(unit.getTile(), dir);
            if (newTileId < 0) continue;
            Tile destTile = game.tiles.get((long) newTileId);
            if (destTile == null) continue;
            int terrain = destTile.getTerrain();
            boolean isOcean = (terrain == TERRAIN_OCEAN || terrain == TERRAIN_DEEP_OCEAN);
            if (utype.getDomain() == 0 && isOcean) continue;
            if (utype.getDomain() == 1 && !isOcean) continue;
            long nx = newTileId % game.map.getXsize();
            long ny = newTileId / game.map.getXsize();
            long dist = Math.abs(nx - tx) + Math.abs(ny - ty);
            if (dist < bestDist) {
                bestDist = dist;
                bestDir = dir;
            }
        }

        if (bestDir < 0) return false;
        long newTileId = game.nextTileInDirection(unit.getTile(), bestDir);
        if (newTileId < 0) return false;
        return game.moveUnit(unit.getId(), (int) newTileId, bestDir);
    }

    /**
     * Attempts to move a unit in a randomly chosen valid direction.
     *
     * @return {@code true} if the unit successfully moved
     */
    boolean moveUnitRandomly(Unit unit, UnitType utype) {
        int[] shuffledDirs = {0, 1, 2, 3, 4, 5, 6, 7};
        for (int i = shuffledDirs.length - 1; i > 0; i--) {
            int j = random.nextInt(i + 1);
            int tmp = shuffledDirs[i];
            shuffledDirs[i] = shuffledDirs[j];
            shuffledDirs[j] = tmp;
        }

        long currentTile = unit.getTile();

        for (int dir : shuffledDirs) {
            int newTileId = game.nextTileInDirection(unit.getTile(), dir);
            if (newTileId < 0) continue;
            Tile destTile = game.tiles.get((long) newTileId);
            if (destTile == null) continue;
            int terrain = destTile.getTerrain();
            boolean isOcean = (terrain == TERRAIN_OCEAN || terrain == TERRAIN_DEEP_OCEAN);
            if (utype.getDomain() == 0 && isOcean) continue;
            if (utype.getDomain() == 1 && !isOcean) continue;
            return game.moveUnit(unit.getId(), newTileId, dir);
        }
        return false;
    }

    // =========================================================================
    // Naval unit AI (mirrors dai_choose_naval() / dai_manage_unit() in daiunit.c)
    // =========================================================================

    /**
     * Naval unit AI: attack adjacent enemy naval units; if none, patrol the
     * coast near the nearest friendly coastal city; otherwise explore randomly.
     *
     * <p>Mirrors the naval-unit management in {@code dai_manage_unit()} and
     * {@code dai_choose_naval()} in the C Freeciv server's
     * {@code ai/default/daiunit.c}.
     *
     * @param unit  the naval unit
     * @param utype the unit type
     * @param owner the owning AI player
     */
    void handleNavalUnit(Unit unit, UnitType utype, Player owner) {
        long ownerId = owner.getPlayerNo();

        while (unit.getMovesleft() > 0 && game.units.containsKey(unit.getId())) {
            // Attack adjacent enemy naval units first (opportunistic attack).
            if (attackAdjacentEnemy(unit, owner)) continue;

            // Move toward the nearest enemy naval unit or enemy coastal city.
            long offensiveTarget = findNearestNavalTarget(unit.getTile(), ownerId);
            if (offensiveTarget >= 0) {
                if (!moveUnitToward(unit, utype, offensiveTarget)) break;
            } else {
                // No war target — patrol near the nearest friendly coastal city.
                long patrolTarget = findNearestCoastalCityTile(unit.getTile(), ownerId);
                if (patrolTarget >= 0 && patrolTarget != unit.getTile()) {
                    if (!moveUnitToward(unit, utype, patrolTarget)) break;
                } else {
                    if (!moveUnitRandomly(unit, utype)) break;
                }
            }
        }
    }

    /**
     * Returns the tile ID of the nearest enemy naval unit or enemy coastal city
     * belonging to a player at war with {@code ownerId}, or {@code -1} if none.
     * Mirrors the naval-target selection in {@code dai_manage_unit()} in
     * {@code ai/default/daiunit.c}.
     *
     * @param fromTile the naval unit's current tile ID
     * @param ownerId  the AI player's ID
     * @return the tile ID of the best naval target, or {@code -1} if none
     */
    private long findNearestNavalTarget(long fromTile, long ownerId) {
        long x = fromTile % game.map.getXsize();
        long y = fromTile / game.map.getXsize();
        long bestDist = Long.MAX_VALUE;
        long bestTile = -1;

        // Search for enemy naval units.
        for (Unit other : game.units.values()) {
            if (other.getOwner() == ownerId) continue;
            if (!isAtWarWith(ownerId, other.getOwner())) continue;
            UnitType otherType = game.unitTypes.get((long) other.getType());
            if (otherType == null || otherType.getDomain() != DOMAIN_SEA) continue;
            long ex = other.getTile() % game.map.getXsize();
            long ey = other.getTile() / game.map.getXsize();
            long dist = Math.abs(ex - x) + Math.abs(ey - y);
            if (dist < bestDist) {
                bestDist = dist;
                bestTile = other.getTile();
            }
        }

        // Also consider enemy coastal cities (can be attacked from sea).
        for (City city : game.cities.values()) {
            if (city.getOwner() == ownerId) continue;
            if (!isAtWarWith(ownerId, city.getOwner())) continue;
            if (!isCityCoastal(city.getTile())) continue;
            long cx = city.getTile() % game.map.getXsize();
            long cy = city.getTile() / game.map.getXsize();
            long dist = Math.abs(cx - x) + Math.abs(cy - y);
            if (dist < bestDist) {
                bestDist = dist;
                bestTile = city.getTile();
            }
        }

        return bestTile;
    }

    /**
     * Returns the tile of the nearest friendly coastal city to {@code fromTile},
     * used as a naval patrol waypoint when there is no combat target.
     * Mirrors the city-proximity search in {@code dai_manage_unit()} in
     * {@code ai/default/daiunit.c}.
     *
     * @param fromTile the naval unit's current tile ID
     * @param ownerId  the AI player's ID
     * @return the tile ID of the nearest coastal city, or {@code -1} if none
     */
    private long findNearestCoastalCityTile(long fromTile, long ownerId) {
        long x = fromTile % game.map.getXsize();
        long y = fromTile / game.map.getXsize();
        long bestTile = -1;
        long bestDist = Long.MAX_VALUE;
        for (City city : game.cities.values()) {
            if (city.getOwner() != ownerId) continue;
            if (!isCityCoastal(city.getTile())) continue;
            long cx = city.getTile() % game.map.getXsize();
            long cy = city.getTile() / game.map.getXsize();
            long dist = Math.abs(cx - x) + Math.abs(cy - y);
            if (dist < bestDist) {
                bestDist = dist;
                bestTile = city.getTile();
            }
        }
        return bestTile;
    }

    // =========================================================================
    // Air unit AI (mirrors aiair.c)
    // =========================================================================

    /** Unit domain constant for air units (matches C server {@code UTYF_AIR}). */
    private static final int DOMAIN_AIR = 2;

    /**
     * Air unit AI: attacks the nearest enemy unit or city, then returns to a
     * friendly city to refuel / rearm.  If the unit is already in a friendly
     * city with no moves left it fortifies (rearms).
     *
     * <p>Mirrors the air-unit management in {@code dai_manage_unit()} in
     * {@code ai/default/daiunit.c} and {@code dai_manage_airunit()} in
     * {@code ai/default/aiair.c}: the fighter patrols between a friendly base
     * city and the nearest enemy target.
     *
     * @param unit  the air unit
     * @param utype the unit type definition
     * @param owner the owning AI player
     */
    void handleAirUnit(Unit unit, UnitType utype, Player owner) {
        long ownerId = owner.getPlayerNo();

        // HP recovery: critically damaged air units stay in a friendly city to heal.
        if (needsHpRecovery(unit, utype)) {
            manageHpRecovery(unit, utype, ownerId);
            return;
        }

        // Find the nearest offensive target (enemy unit or city).
        long offensiveTarget = findNearestOffensiveTarget(unit.getTile(), ownerId);

        while (unit.getMovesleft() > 0 && game.units.containsKey(unit.getId())) {
            // Try an opportunistic attack on an adjacent enemy first.
            if (attackAdjacentEnemy(unit, owner)) continue;

            if (offensiveTarget >= 0) {
                // Move toward the offensive target.
                if (!moveUnitToward(unit, utype, offensiveTarget)) break;
            } else {
                // No war target — return to the nearest friendly city to rearm/patrol.
                long baseTile = findNearestFriendlyCityTile(unit.getTile(), ownerId, utype);
                if (baseTile >= 0 && baseTile != unit.getTile()) {
                    if (!moveUnitToward(unit, utype, baseTile)) break;
                } else {
                    // Already at base or nowhere to go — fortify.
                    if (unit.getActivity() != CityTurn.ACTIVITY_FORTIFIED) {
                        game.changeUnitActivity(unit.getId(), CityTurn.ACTIVITY_FORTIFIED);
                    }
                    break;
                }
            }
        }
    }
}
