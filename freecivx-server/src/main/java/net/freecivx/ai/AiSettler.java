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
import net.freecivx.game.Nation;
import net.freecivx.game.Player;
import net.freecivx.game.Terrain;
import net.freecivx.game.Tile;
import net.freecivx.game.Unit;
import net.freecivx.game.UnitType;
import net.freecivx.server.CityTurn;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Settler and terrain-improvement (worker) AI.
 * Handles city-site evaluation, settler movement toward optimal founding
 * locations, and worker terrain-improvement task assignment.
 *
 * <p>Mirrors {@code ai/default/daisettler.c} in the C Freeciv server.
 */
class AiSettler {

    private final AiPlayer ai;
    private final Game game;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /** Terrain types suitable for city founding (excludes ocean and impassable). */
    static final Set<Integer> CITY_SUITABLE_TERRAINS = new HashSet<>();
    static {
        CITY_SUITABLE_TERRAINS.add(5);  // Desert
        CITY_SUITABLE_TERRAINS.add(6);  // Forest
        CITY_SUITABLE_TERRAINS.add(7);  // Grassland
        CITY_SUITABLE_TERRAINS.add(8);  // Hills
        CITY_SUITABLE_TERRAINS.add(9);  // Jungle
        CITY_SUITABLE_TERRAINS.add(11); // Plains
        CITY_SUITABLE_TERRAINS.add(13); // Tundra
    }

    /** How far (tiles) a settler searches for a good city spot. */
    private static final int SETTLER_SEARCH_RADIUS = 12;

    /** Minimum Manhattan-distance between two cities (from daisettler.c). */
    private static final int MIN_CITY_SEPARATION = 3;

    /** Minimum tile-founding score to build immediately on the current tile. */
    private static final int SETTLER_FOUND_SCORE = 2;

    /**
     * Distance within which enemy military units make a settler tile "unsafe",
     * mirroring {@code adv_settler_safe_tile()} radius in daisettler.c.
     */
    private static final int SETTLER_SAFE_DISTANCE = 2;

    private static final int TERRAIN_GRASSLAND  = 7;
    private static final int TERRAIN_PLAINS     = 11;
    private static final int TERRAIN_HILLS      = 8;
    private static final int TERRAIN_MOUNTAINS  = 10;
    private static final int TERRAIN_OCEAN      = 2;
    private static final int TERRAIN_DEEP_OCEAN = 3;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    AiSettler(AiPlayer ai) {
        this.ai = ai;
        this.game = ai.game;
    }

    // =========================================================================
    // Settler AI (mirrors daisettler.c)
    // =========================================================================

    /**
     * Settler AI: found a city on the current tile when it is fertile enough
     * (score ≥ {@link #SETTLER_FOUND_SCORE}) and not too close to an existing
     * city; otherwise move toward the best-scored candidate tile in the search
     * radius.  The chosen target is remembered across turns to avoid goal
     * jitter, mirroring the persistent unit-task system in
     * {@code ai/default/daiunit.c}.
     *
     * <p>Replaces the old random-chance founding with terrain-score-based
     * evaluation inspired by {@code settler_evaluate_city_building()} in
     * {@code ai/default/daisettler.c}.
     */
    void handleSettler(Unit unit, UnitType utype) {
        long unitId = unit.getId();

        // Evict a stale target if the tile has since been claimed, is gone, too
        // close to an existing city, or the settler has been unable to reach it
        // for SETTLER_STUCK_TURNS consecutive turns (unreachable across water, etc.).
        Long target = ai.unitTargets.get(unitId);
        if (target != null) {
            Tile t = game.tiles.get(target);
            int stuck = ai.unitStuckTurns.getOrDefault(unitId, 0);
            if (t == null || t.getWorked() >= 0
                    || !CITY_SUITABLE_TERRAINS.contains(t.getTerrain())
                    || tooCloseToExistingCity(target)
                    || stuck >= AiPlayer.SETTLER_STUCK_TURNS) {
                ai.unitTargets.remove(unitId);
                ai.unitStuckTurns.remove(unitId);
                target = null;
            }
        }

        Tile currentTile = game.tiles.get(unit.getTile());
        if (currentTile == null) return;

        // Found immediately when the current tile is fertile, unoccupied, and
        // far enough from existing cities.
        if (CITY_SUITABLE_TERRAINS.contains(currentTile.getTerrain())
                && currentTile.getWorked() < 0
                && tileSettlerScore(currentTile) >= SETTLER_FOUND_SCORE
                && !tooCloseToExistingCity(unit.getTile())
                && game.units.containsKey(unit.getId())) {
            String cityName = pickCityName(unit);
            game.buildCity(unit.getId(), cityName, unit.getTile());
            ai.unitTargets.remove(unitId);
            ai.unitStuckTurns.remove(unitId);
            return;
        }

        // Move toward the best candidate tile, caching the target across turns.
        if (target == null) {
            long found = findBestCitySpot(unit.getTile(), unit.getOwner());
            if (found >= 0) {
                ai.unitTargets.put(unitId, found);
                ai.unitStuckTurns.remove(unitId);
                target = found;
            }
        }

        // Safety check: do not move into enemy-controlled territory without a
        // military escort.  Mirrors adv_settler_safe_tile() in daisettler.c.
        if (isSettlerUnsafe(unit)) {
            return; // Wait for danger to pass
        }

        if (target != null && target >= 0) {
            boolean moved = ai.aiMilitary.moveUnitToward(unit, utype, target);
            if (moved) {
                ai.unitStuckTurns.remove(unitId);
            } else {
                ai.unitStuckTurns.merge(unitId, 1, Integer::sum);
            }
        } else {
            ai.aiMilitary.moveUnitRandomly(unit, utype);
        }
    }

    /**
     * Scores a tile's suitability for city founding based on terrain output.
     * Mirrors the food/shield weighting in {@code city_desirability()} in
     * {@code ai/default/daisettler.c}: food is weighted 2× because a food
     * surplus is critical for growth.
     *
     * @param tile the tile to evaluate
     * @return a non-negative integer; higher is better
     */
    int tileSettlerScore(Tile tile) {
        Terrain terrain = game.terrains.get((long) tile.getTerrain());
        if (terrain == null) return 0;
        int score = terrain.getFood() * 2
                + terrain.getShield()
                + terrain.getRoadTradeBonus()
                + Math.max(terrain.getIrrigationFoodBonus(), terrain.getMiningShieldBonus());
        return Math.max(0, score);
    }

    /**
     * Scores a potential city site by summing the terrain output of all land
     * tiles within the city's working radius (2-tile Chebyshev distance).
     * Mirrors {@code city_desirability()} in {@code ai/default/daisettler.c}.
     *
     * @param tileId the candidate city center tile
     * @return sum of {@link #tileSettlerScore} across all usable tiles in the radius
     */
    private int cityRadiusScore(long tileId) {
        Tile centerTile = game.tiles.get(tileId);
        if (centerTile == null) return 0;
        int total = tileSettlerScore(centerTile);

        long cx = tileId % game.map.getXsize();
        long cy = tileId / game.map.getXsize();
        for (int dy = -2; dy <= 2; dy++) {
            for (int dx = -2; dx <= 2; dx++) {
                if (dx == 0 && dy == 0) continue;
                if (Math.max(Math.abs(dx), Math.abs(dy)) > 2) continue;
                long nx = cx + dx;
                long ny = cy + dy;
                if (nx < 0 || nx >= game.map.getXsize()
                        || ny < 0 || ny >= game.map.getYsize()) continue;
                Tile t = game.tiles.get(ny * game.map.getXsize() + nx);
                if (t == null) continue;
                int terrain = t.getTerrain();
                if (terrain == TERRAIN_OCEAN || terrain == TERRAIN_DEEP_OCEAN) continue;
                total += tileSettlerScore(t);
            }
        }
        return total;
    }

    /**
     * Returns {@code true} if {@code tileId} is within
     * {@link #MIN_CITY_SEPARATION} tiles (Manhattan distance) of any existing
     * city.  Prevents building cities too close together, mirroring the
     * minimum-city-distance check in {@code ai/default/daisettler.c}.
     */
    boolean tooCloseToExistingCity(long tileId) {
        long tx = tileId % game.map.getXsize();
        long ty = tileId / game.map.getXsize();
        for (City city : game.cities.values()) {
            long cx = city.getTile() % game.map.getXsize();
            long cy = city.getTile() / game.map.getXsize();
            if (Math.abs(cx - tx) + Math.abs(cy - ty) < MIN_CITY_SEPARATION) return true;
        }
        return false;
    }

    /**
     * Returns {@code true} if any enemy military unit is within
     * {@link #SETTLER_SAFE_DISTANCE} tiles of the settler.
     * Mirrors {@code adv_settler_safe_tile()} in {@code ai/default/daisettler.c}.
     *
     * @param settler the settler unit to check
     * @return {@code true} if the settler's current tile is unsafe
     */
    boolean isSettlerUnsafe(Unit settler) {
        long sx = settler.getTile() % game.map.getXsize();
        long sy = settler.getTile() / game.map.getXsize();
        long ownerId = settler.getOwner();
        for (Unit u : game.units.values()) {
            if (u.getOwner() == ownerId) continue;
            UnitType utype = game.unitTypes.get((long) u.getType());
            if (utype == null || utype.getAttackStrength() == 0) continue;
            long ux = u.getTile() % game.map.getXsize();
            long uy = u.getTile() / game.map.getXsize();
            if (Math.abs(ux - sx) + Math.abs(uy - sy) <= SETTLER_SAFE_DISTANCE) return true;
        }
        return false;
    }

    /**
     * Returns {@code true} if any enemy military unit is within
     * {@code radius} tiles of the given tile.  Used to filter out dangerous
     * city sites in {@link #findBestCitySpot}, mirroring the
     * {@code adv_danger_at()} check in {@code city_desirability()} in
     * {@code ai/default/daisettler.c}.
     *
     * @param tileId  the map tile to test
     * @param ownerId the player ID whose enemies to check
     * @return {@code true} if an enemy military unit is within range
     */
    private boolean isTileThreatenedByEnemy(long tileId, long ownerId) {
        long tx = tileId % game.map.getXsize();
        long ty = tileId / game.map.getXsize();
        for (Unit u : game.units.values()) {
            if (u.getOwner() == ownerId) continue;
            UnitType utype = game.unitTypes.get((long) u.getType());
            if (utype == null || utype.getAttackStrength() == 0) continue;
            long ux = u.getTile() % game.map.getXsize();
            long uy = u.getTile() / game.map.getXsize();
            if (Math.abs(ux - tx) + Math.abs(uy - ty) <= SETTLER_SAFE_DISTANCE) return true;
        }
        return false;
    }

    /**
     * Finds the best city-founding site within {@link #SETTLER_SEARCH_RADIUS}
     * tiles of the given starting position.  The score is computed by
     * {@link #cityRadiusScore} which sums terrain output across the city's
     * full working radius, mirroring {@code city_desirability()} in
     * {@code ai/default/daisettler.c}.
     *
     * <p>Tiles that are already claimed, too close to an existing city, or
     * threatened by enemies are excluded from consideration.
     *
     * @param fromTile the settler's current tile ID
     * @param ownerId  the owning player's ID
     * @return the tile ID of the best site found, or {@code -1} if none
     */
    private long findBestCitySpot(long fromTile, long ownerId) {
        long x = fromTile % game.map.getXsize();
        long y = fromTile / game.map.getXsize();
        long bestTile = -1;
        int bestScore = -1;

        long minY = Math.max(0, y - SETTLER_SEARCH_RADIUS);
        long maxY = Math.min(game.map.getYsize() - 1, y + SETTLER_SEARCH_RADIUS);

        for (long ty = minY; ty <= maxY; ty++) {
            for (long tx = Math.max(0, x - SETTLER_SEARCH_RADIUS);
                 tx <= Math.min(game.map.getXsize() - 1, x + SETTLER_SEARCH_RADIUS); tx++) {
                long tileId = ty * game.map.getXsize() + tx;
                Tile tile = game.tiles.get(tileId);
                if (tile == null) continue;
                if (!CITY_SUITABLE_TERRAINS.contains(tile.getTerrain())) continue;
                if (tile.getWorked() >= 0) continue; // Already a city here
                if (tooCloseToExistingCity(tileId)) continue;
                if (isTileThreatenedByEnemy(tileId, ownerId)) continue;

                int score = cityRadiusScore(tileId);
                if (score > bestScore) {
                    bestScore = score;
                    bestTile = tileId;
                }
            }
        }
        return bestTile;
    }

    // =========================================================================
    // Worker AI (mirrors autosettlers.c / settlers.c)
    // =========================================================================

    /**
     * Worker AI: assigns terrain-improvement activities (road, railroad,
     * irrigation, mine) to a worker unit.  If the current tile is fully
     * improved, the worker moves toward the nearest unimproved tile.
     *
     * <p>Mirrors the auto-settler logic in {@code server/settlers.c} and
     * {@code autosettlers.c} in the C Freeciv server.
     */
    void handleWorker(Unit unit, UnitType utype) {
        // If the worker is already engaged in terrain improvement, let it finish.
        int activity = unit.getActivity();
        if (activity == CityTurn.ACTIVITY_ROAD
                || activity == CityTurn.ACTIVITY_IRRIGATE
                || activity == CityTurn.ACTIVITY_MINE
                || activity == CityTurn.ACTIVITY_RAILROAD) {
            return;
        }

        Tile currentTile = game.tiles.get(unit.getTile());
        if (currentTile == null) return;

        int terrain = currentTile.getTerrain();
        if (terrain == TERRAIN_OCEAN || terrain == TERRAIN_DEEP_OCEAN
                || terrain == 0 /* Arctic */ || terrain == 4 /* Glacier */
                || terrain == 14 /* Inaccessible */) {
            ai.aiMilitary.moveUnitRandomly(unit, utype);
            return;
        }

        // Priority 1: Build a road if the tile has none.
        boolean hasRoad = (currentTile.getExtras() & (1 << CityTurn.EXTRA_BIT_ROAD)) != 0;
        if (!hasRoad) {
            game.changeUnitActivity(unit.getId(), CityTurn.ACTIVITY_ROAD);
            return;
        }

        // Priority 2: Upgrade road to railroad if none exists.
        boolean hasRail = (currentTile.getExtras() & (1 << CityTurn.EXTRA_BIT_RAIL)) != 0;
        if (!hasRail) {
            game.changeUnitActivity(unit.getId(), CityTurn.ACTIVITY_RAILROAD);
            return;
        }

        // Priority 3: Irrigate Grassland or Plains to boost food output.
        boolean hasIrrigation = (currentTile.getExtras() & (1 << CityTurn.EXTRA_BIT_IRRIGATION)) != 0;
        if (!hasIrrigation && (terrain == TERRAIN_GRASSLAND || terrain == TERRAIN_PLAINS)) {
            game.changeUnitActivity(unit.getId(), CityTurn.ACTIVITY_IRRIGATE);
            return;
        }

        // Priority 4: Mine Hills or Mountains to boost production output.
        boolean hasMine = (currentTile.getExtras() & (1 << CityTurn.EXTRA_BIT_MINE)) != 0;
        if (!hasMine && (terrain == TERRAIN_HILLS || terrain == TERRAIN_MOUNTAINS)) {
            game.changeUnitActivity(unit.getId(), CityTurn.ACTIVITY_MINE);
            return;
        }

        // Current tile is fully improved – move toward the nearest unimproved tile.
        long bestTarget = findBestWorkerTarget(unit.getTile());
        if (bestTarget >= 0) {
            ai.aiMilitary.moveUnitToward(unit, utype, bestTarget);
        } else {
            ai.aiMilitary.moveUnitRandomly(unit, utype);
        }
    }

    /**
     * Finds the best land tile within a search radius that would benefit from
     * a terrain improvement.  Tiles within a city's working radius are preferred
     * because improvements there directly boost city output.  Mirrors the
     * {@code auto_settler_findwork} heuristic in {@code server/settlers.c}.
     *
     * @param fromTile the worker's current tile ID
     * @return the tile ID of the best improvement target, or {@code -1}
     */
    private long findBestWorkerTarget(long fromTile) {
        final int WORKER_SEARCH_RADIUS = 8;
        final int CITY_WORK_RADIUS = 3;
        long x = fromTile % game.map.getXsize();
        long y = fromTile / game.map.getXsize();
        long bestTile = -1;
        int bestScore = Integer.MIN_VALUE;
        long bestDist = Long.MAX_VALUE;

        long minY = Math.max(0, y - WORKER_SEARCH_RADIUS);
        long maxY = Math.min(game.map.getYsize() - 1, y + WORKER_SEARCH_RADIUS);
        long minX = Math.max(0, x - WORKER_SEARCH_RADIUS);
        long maxX = Math.min(game.map.getXsize() - 1, x + WORKER_SEARCH_RADIUS);

        for (long ty = minY; ty <= maxY; ty++) {
            for (long tx = minX; tx <= maxX; tx++) {
                long tileId = ty * game.map.getXsize() + tx;
                Tile tile = game.tiles.get(tileId);
                if (tile == null) continue;
                int t = tile.getTerrain();
                if (t == TERRAIN_OCEAN || t == TERRAIN_DEEP_OCEAN
                        || t == 0 || t == 4 || t == 14) continue;

                int extras = tile.getExtras();
                boolean roadMissing = (extras & (1 << CityTurn.EXTRA_BIT_ROAD)) == 0;
                boolean railMissing = !roadMissing
                        && (extras & (1 << CityTurn.EXTRA_BIT_RAIL)) == 0;
                boolean irrigationUseful = (t == TERRAIN_GRASSLAND || t == TERRAIN_PLAINS)
                        && (extras & (1 << CityTurn.EXTRA_BIT_IRRIGATION)) == 0;
                boolean mineUseful = (t == TERRAIN_HILLS || t == TERRAIN_MOUNTAINS)
                        && (extras & (1 << CityTurn.EXTRA_BIT_MINE)) == 0;

                if (!roadMissing && !railMissing && !irrigationUseful && !mineUseful) continue;

                int cityProximityBonus = 0;
                for (City city : game.cities.values()) {
                    long cx = city.getTile() % game.map.getXsize();
                    long cy = city.getTile() / game.map.getXsize();
                    long chebyshev = Math.max(Math.abs(tx - cx), Math.abs(ty - cy));
                    if (chebyshev <= CITY_WORK_RADIUS) {
                        cityProximityBonus = 100;
                        break;
                    }
                }

                Terrain terrainObj = game.terrains.get((long) t);
                int irrigBonus = (terrainObj != null) ? terrainObj.getIrrigationFoodBonus() : 1;
                int mineBonus  = (terrainObj != null) ? terrainObj.getMiningShieldBonus()   : 1;
                int roadBonus  = (terrainObj != null) ? terrainObj.getRoadTradeBonus()       : 1;
                int improvementValue = 0;
                if (irrigationUseful) {
                    improvementValue = irrigBonus * 2;
                } else if (mineUseful) {
                    improvementValue = mineBonus;
                } else if (roadMissing) {
                    improvementValue = Math.max(1, roadBonus);
                } else if (railMissing) {
                    improvementValue = 1;
                }

                long dist = Math.abs(tx - x) + Math.abs(ty - y);
                int score = cityProximityBonus + improvementValue * 5 - (int) dist;
                if (score > bestScore || (score == bestScore && dist < bestDist)) {
                    bestScore = score;
                    bestDist = dist;
                    bestTile = tileId;
                }
            }
        }
        return bestTile;
    }

    /**
     * Picks a city name for the given settler's owner from the player's nation
     * ruleset city-name list.  Names already in use by existing cities are
     * skipped.  Falls back to "City &lt;N&gt;" when the list is exhausted.
     *
     * <p>Mirrors {@code city_name_suggestion()} in the C Freeciv server.
     */
    private String pickCityName(Unit unit) {
        Player player = game.players.get(unit.getOwner());
        if (player != null) {
            Nation nation = game.nations.get((long) player.getNation());
            if (nation != null) {
                List<String> names = nation.getCityNames();
                Set<String> usedNames = new HashSet<>();
                for (City city : game.cities.values()) {
                    usedNames.add(city.getName());
                }
                for (String name : names) {
                    if (!usedNames.contains(name)) {
                        return name;
                    }
                }
            }
        }
        return "City " + (game.cities.size() + 1);
    }
}
