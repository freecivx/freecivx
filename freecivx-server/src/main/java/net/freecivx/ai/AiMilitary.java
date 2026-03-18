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

    private static final int TERRAIN_OCEAN      = 2;
    private static final int TERRAIN_DEEP_OCEAN = 3;

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
     */
    void handleMilitaryUnit(Unit unit, UnitType utype, Player owner) {
        long unitId = unit.getId();
        long ownerId = owner.getPlayerNo();

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

        if (game.isTileAdjacentOrEqual(unit.getTile(), targetTile)) {
            Tile tt = game.tiles.get(targetTile);
            if (tt != null && tt.getWorked() > 0) {
                game.establishEmbassy(unit.getId(), tt.getWorked());
            }
            return;
        }

        while (unit.getMovesleft() > 0 && game.units.containsKey(unit.getId())) {
            if (!moveUnitToward(unit, utype, targetTile)) break;
            if (game.isTileAdjacentOrEqual(unit.getTile(), targetTile)) break;
        }
    }

    // =========================================================================
    // City danger assessment (mirrors daimilitary.c)
    // =========================================================================

    /**
     * Computes a numeric danger score for a city by summing enemy military unit
     * attack strength weighted by proximity.  Mirrors {@code assess_danger()} in
     * {@code ai/default/daimilitary.c}.
     *
     * @param city the city to evaluate
     * @return non-negative danger score; 0 = no threat
     */
    int assessCityDanger(City city) {
        long cx = city.getTile() % game.map.getXsize();
        long cy = city.getTile() / game.map.getXsize();
        long ownerId = city.getOwner();
        int dangerScore = 0;

        for (Unit u : game.units.values()) {
            if (u.getOwner() == ownerId) continue;
            UnitType utype = game.unitTypes.get((long) u.getType());
            if (utype == null || utype.getAttackStrength() == 0) continue;

            long ux = u.getTile() % game.map.getXsize();
            long uy = u.getTile() / game.map.getXsize();
            long dist = Math.abs(ux - cx) + Math.abs(uy - cy);
            if (dist > ASSESS_DANGER_MAX_DISTANCE) continue;

            dangerScore += utype.getAttackStrength() * (ASSESS_DANGER_MAX_DISTANCE + 1 - dist);
        }
        return dangerScore;
    }

    // =========================================================================
    // Unit building helpers (mirrors daibuild.c / daimilitary.c)
    // =========================================================================

    /**
     * Returns the best available military defender the player can build.
     * Mirrors {@code dai_build_adv_adjust_tech()} in {@code ai/default/daibuild.c}.
     */
    int bestAvailableDefender(Player player) {
        if (player.hasTech(ai.techIronWorking))   return ai.unitLegion;
        if (player.hasTech(ai.techWarriorCode))   return ai.unitArchers;
        if (player.hasTech(ai.techBronzeWorking)) return ai.unitPhalanx;
        return AiPlayer.UNIT_WARRIORS;
    }

    /**
     * Returns the best available offensive unit the player can build.
     * Mirrors {@code dai_choose_attacker()} in {@code ai/default/daimilitary.c}.
     */
    int bestAvailableAttacker(Player player) {
        if (player.hasTech(ai.techHorsebackRiding)) return ai.unitHorsemen;
        if (player.hasTech(ai.techIronWorking))     return ai.unitLegion;
        if (player.hasTech(ai.techWarriorCode))     return ai.unitArchers;
        return AiPlayer.UNIT_WARRIORS;
    }

    /**
     * Returns the best available naval unit the AI can build.
     * Mirrors {@code dai_choose_naval()} in the C Freeciv AI.
     */
    int bestAvailableNavalUnit(Player player) {
        if (ai.unitCaravel >= 0 && ai.techNavigation >= 0 && player.hasTech(ai.techNavigation)) return ai.unitCaravel;
        if (ai.unitTrireme >= 0 && ai.techMapMaking >= 0 && player.hasTech(ai.techMapMaking))   return ai.unitTrireme;
        return -1;
    }

    /**
     * Returns the best available air unit the AI can build.
     * Mirrors {@code dai_choose_air()} in the C Freeciv AI.
     */
    int bestAvailableAirUnit(Player player) {
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
     * attacks it if found.  Civilian units are skipped.
     *
     * @return {@code true} if an attack was initiated
     */
    boolean attackAdjacentEnemy(Unit unit, Player owner) {
        long x = unit.getTile() % game.map.getXsize();
        long y = unit.getTile() / game.map.getXsize();

        for (int dir = 0; dir < 8; dir++) {
            long nx = x + Movement.DIR_DX[dir];
            long ny = y + Movement.DIR_DY[dir];
            if (nx < 0 || nx >= game.map.getXsize() || ny < 0 || ny >= game.map.getYsize()) continue;
            long neighborTileId = ny * game.map.getXsize() + nx;

            for (Unit other : new ArrayList<>(game.units.values())) {
                if (other.getTile() != neighborTileId) continue;
                if (other.getOwner() == owner.getPlayerNo()) continue;
                UnitType otherType = game.unitTypes.get((long) other.getType());
                if (otherType == null || otherType.getAttackStrength() == 0) continue;
                game.attackUnit(unit.getId(), other.getId());
                return true;
            }
        }
        return false;
    }

    /**
     * Returns the tile ID of the nearest enemy unit, or {@code -1} if none exist.
     */
    long findNearestEnemyTile(long fromTile, long ownerId) {
        long x = fromTile % game.map.getXsize();
        long y = fromTile / game.map.getXsize();
        long bestDist = Long.MAX_VALUE;
        long bestTile = -1;

        for (Unit other : game.units.values()) {
            if (other.getOwner() == ownerId) continue;
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
     * Priority: (1) nearest undefended enemy city, (2) nearest defended enemy
     * city, (3) nearest enemy unit.
     * Mirrors {@code dai_military_attack()} and {@code find_city_want()} in
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

        long x = unit.getTile() % game.map.getXsize();
        long y = unit.getTile() / game.map.getXsize();
        long tx = targetTile % game.map.getXsize();
        long ty = targetTile / game.map.getXsize();

        int bestDir = -1;
        long bestDist = Long.MAX_VALUE;

        for (int dir = 0; dir < 8; dir++) {
            long nx = x + Movement.DIR_DX[dir];
            long ny = y + Movement.DIR_DY[dir];
            if (nx < 0 || nx >= game.map.getXsize() || ny < 0 || ny >= game.map.getYsize()) continue;
            long newTileId = ny * game.map.getXsize() + nx;
            Tile destTile = game.tiles.get(newTileId);
            if (destTile == null) continue;
            int terrain = destTile.getTerrain();
            boolean isOcean = (terrain == TERRAIN_OCEAN || terrain == TERRAIN_DEEP_OCEAN);
            if (utype.getDomain() == 0 && isOcean) continue;
            if (utype.getDomain() == 1 && !isOcean) continue;
            long dist = Math.abs(nx - tx) + Math.abs(ny - ty);
            if (dist < bestDist) {
                bestDist = dist;
                bestDir = dir;
            }
        }

        if (bestDir < 0) return false;
        long nx = x + Movement.DIR_DX[bestDir];
        long ny = y + Movement.DIR_DY[bestDir];
        long newTileId = ny * game.map.getXsize() + nx;
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
        long x = currentTile % game.map.getXsize();
        long y = currentTile / game.map.getXsize();

        for (int dir : shuffledDirs) {
            long nx = x + Movement.DIR_DX[dir];
            long ny = y + Movement.DIR_DY[dir];
            if (nx < 0 || nx >= game.map.getXsize() || ny < 0 || ny >= game.map.getYsize()) continue;
            long newTileId = ny * game.map.getXsize() + nx;
            Tile destTile = game.tiles.get(newTileId);
            if (destTile == null) continue;
            int terrain = destTile.getTerrain();
            boolean isOcean = (terrain == TERRAIN_OCEAN || terrain == TERRAIN_DEEP_OCEAN);
            if (utype.getDomain() == 0 && isOcean) continue;
            if (utype.getDomain() == 1 && !isOcean) continue;
            return game.moveUnit(unit.getId(), (int) newTileId, dir);
        }
        return false;
    }
}
