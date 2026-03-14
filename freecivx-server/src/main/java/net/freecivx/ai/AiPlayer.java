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

package net.freecivx.ai;

import net.freecivx.game.Game;
import net.freecivx.game.Player;
import net.freecivx.game.Tile;
import net.freecivx.game.Unit;
import net.freecivx.game.UnitType;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/**
 * AiPlayer handles all AI decision-making for computer-controlled players.
 * AI turns are executed in a dedicated background thread to keep the main
 * game loop responsive.
 */
public class AiPlayer {

    private final Game game;
    private final Random random = new Random();
    private final ExecutorService executor;

    // 1-in-N chance per turn for a settler to found a city (N=3 → ~33%)
    private static final int AI_CITY_BUILD_CHANCE = 3;

    // Terrain types suitable for city founding (excludes ocean and impassable tiles)
    private static final Set<Integer> CITY_SUITABLE_TERRAINS = new HashSet<>();
    static {
        CITY_SUITABLE_TERRAINS.add(5);  // Desert
        CITY_SUITABLE_TERRAINS.add(6);  // Forest
        CITY_SUITABLE_TERRAINS.add(7);  // Grassland
        CITY_SUITABLE_TERRAINS.add(8);  // Hills
        CITY_SUITABLE_TERRAINS.add(9);  // Jungle
        CITY_SUITABLE_TERRAINS.add(11); // Plains
        CITY_SUITABLE_TERRAINS.add(13); // Tundra
    }

    // How far (in tiles) a settler searches for a good city spot
    private static final int SETTLER_SEARCH_RADIUS = 10;

    private static final String[] AI_CITY_NAMES = {
        "Rome", "Athens", "Cairo", "Babylon", "Carthage", "Persepolis",
        "Thebes", "Memphis", "Nineveh", "Tyre", "Samarkand", "Antioch"
    };
    private int aiCityNameIndex = 0;

    private static final int[] DIR_DX = {-1, 0, 1, -1, 1, -1, 0, 1};
    private static final int[] DIR_DY = {-1, -1, -1, 0, 0, 1, 1, 1};

    public AiPlayer(Game game) {
        this.game = game;
        this.executor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "freecivx-ai");
            t.setDaemon(true);
            return t;
        });
    }

    /**
     * Submits AI turn processing to the dedicated AI thread and waits for
     * completion before returning, so that game-state broadcasts happen only
     * after every AI unit has acted.
     */
    public void runAiTurns() {
        Future<?> future = executor.submit(this::executeAiTurns);
        try {
            future.get();
        } catch (Exception e) {
            System.err.println("AI turn error: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /** Performs all AI actions for the current turn (runs on the AI thread). */
    private void executeAiTurns() {
        List<Unit> unitsSnapshot = new ArrayList<>(game.units.values());
        for (Unit unit : unitsSnapshot) {
            Player owner = game.players.get(unit.getOwner());
            if (owner == null || !owner.isAi()) continue;
            if (!game.units.containsKey(unit.getId())) continue;

            UnitType utype = game.unitTypes.get((long) unit.getType());
            if (utype == null) continue;

            // Settlers (type 0): seek a good city spot and found a city
            if (unit.getType() == 0) {
                handleSettler(unit, utype);
                continue;
            }

            // Military units: attack enemies first, then advance toward them
            if (utype.getAttackStrength() > 0) {
                handleMilitaryUnit(unit, utype, owner);
                continue;
            }

            // Other units (explorers, workers): move randomly
            int movesUsed = 0;
            while (unit.getMovesleft() > 0 && movesUsed < utype.getMoveRate()) {
                if (!moveUnitRandomly(unit, utype)) break;
                movesUsed++;
            }
        }
    }

    /**
     * Settler AI: build a city on the current tile when it is suitable,
     * otherwise move toward the nearest unoccupied good city-founding spot.
     */
    private void handleSettler(Unit unit, UnitType utype) {
        Tile tile = game.tiles.get(unit.getTile());
        if (tile != null && CITY_SUITABLE_TERRAINS.contains(tile.getTerrain())
                && tile.getWorked() < 0 && game.units.containsKey(unit.getId())) {
            if (random.nextInt(AI_CITY_BUILD_CHANCE) == 0) {
                String cityName = AI_CITY_NAMES[aiCityNameIndex % AI_CITY_NAMES.length];
                aiCityNameIndex++;
                game.buildCity(unit.getId(), cityName, unit.getTile());
                return;
            }
        }

        // Move toward the nearest unoccupied good city spot
        long target = findNearestGoodCitySpot(unit.getTile());
        if (target >= 0) {
            moveUnitToward(unit, utype, target);
        } else {
            moveUnitRandomly(unit, utype);
        }
    }

    /**
     * Military unit AI: attack an adjacent enemy if possible, then move
     * toward the nearest enemy unit.
     */
    private void handleMilitaryUnit(Unit unit, UnitType utype, Player owner) {
        while (unit.getMovesleft() > 0 && game.units.containsKey(unit.getId())) {
            // Prefer attacking an adjacent enemy over advancing
            if (attackAdjacentEnemy(unit, owner)) continue;

            // No adjacent enemy: advance toward nearest enemy unit
            long target = findNearestEnemyTile(unit.getTile(), owner.getPlayerNo());
            if (target >= 0) {
                if (!moveUnitToward(unit, utype, target)) break;
            } else {
                if (!moveUnitRandomly(unit, utype)) break;
            }
        }
    }

    /**
     * Looks for an enemy unit on a tile adjacent to {@code unit} and attacks
     * it if one is found.
     *
     * @return {@code true} if an attack was initiated
     */
    private boolean attackAdjacentEnemy(Unit unit, Player owner) {
        long x = unit.getTile() % game.map.getXsize();
        long y = unit.getTile() / game.map.getXsize();

        for (int dir = 0; dir < 8; dir++) {
            long nx = x + DIR_DX[dir];
            long ny = y + DIR_DY[dir];
            if (nx < 0 || nx >= game.map.getXsize() || ny < 0 || ny >= game.map.getYsize()) continue;
            long neighborTileId = ny * game.map.getXsize() + nx;

            for (Unit other : new ArrayList<>(game.units.values())) {
                if (other.getTile() == neighborTileId && other.getOwner() != owner.getPlayerNo()) {
                    game.attackUnit(unit.getId(), other.getId());
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Returns the tile ID of the nearest enemy unit, or {@code -1} if none exist.
     */
    private long findNearestEnemyTile(long fromTile, long ownerId) {
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
     * Returns the tile ID of the nearest unoccupied land tile suitable for
     * founding a city within {@link #SETTLER_SEARCH_RADIUS} tiles, or
     * {@code -1} if none is found.
     */
    private long findNearestGoodCitySpot(long fromTile) {
        long x = fromTile % game.map.getXsize();
        long y = fromTile / game.map.getXsize();
        long bestDist = Long.MAX_VALUE;
        long bestTile = -1;

        long minY = Math.max(0, y - SETTLER_SEARCH_RADIUS);
        long maxY = Math.min(game.map.getYsize() - 1, y + SETTLER_SEARCH_RADIUS);
        long minX = Math.max(0, x - SETTLER_SEARCH_RADIUS);
        long maxX = Math.min(game.map.getXsize() - 1, x + SETTLER_SEARCH_RADIUS);

        for (long ty = minY; ty <= maxY; ty++) {
            for (long tx = minX; tx <= maxX; tx++) {
                long tileId = ty * game.map.getXsize() + tx;
                Tile tile = game.tiles.get(tileId);
                if (tile == null) continue;
                if (!CITY_SUITABLE_TERRAINS.contains(tile.getTerrain())) continue;
                if (tile.getWorked() >= 0) continue; // already a city here
                long dist = Math.abs(tx - x) + Math.abs(ty - y);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestTile = tileId;
                }
            }
        }
        return bestTile;
    }

    /**
     * Moves a unit one step in the direction that minimises Manhattan distance
     * to the target tile.  Respects terrain and map-boundary constraints.
     *
     * @return {@code true} if the unit was successfully moved
     */
    private boolean moveUnitToward(Unit unit, UnitType utype, long targetTile) {
        if (unit.getMovesleft() <= 0) return false;

        long x = unit.getTile() % game.map.getXsize();
        long y = unit.getTile() / game.map.getXsize();
        long tx = targetTile % game.map.getXsize();
        long ty = targetTile / game.map.getXsize();

        int bestDir = -1;
        long bestDist = Long.MAX_VALUE;

        for (int dir = 0; dir < 8; dir++) {
            long nx = x + DIR_DX[dir];
            long ny = y + DIR_DY[dir];
            if (nx < 0 || nx >= game.map.getXsize() || ny < 0 || ny >= game.map.getYsize()) continue;
            long newTileId = ny * game.map.getXsize() + nx;
            Tile destTile = game.tiles.get(newTileId);
            if (destTile == null) continue;
            // Land units avoid ocean tiles (terrain 2 = Ocean, 3 = Deep Ocean)
            if (utype.getDomain() == 0) {
                int terrain = destTile.getTerrain();
                if (terrain == 2 || terrain == 3) continue;
            }
            long dist = Math.abs(nx - tx) + Math.abs(ny - ty);
            if (dist < bestDist) {
                bestDist = dist;
                bestDir = dir;
            }
        }

        if (bestDir < 0) return false;
        long nx = x + DIR_DX[bestDir];
        long ny = y + DIR_DY[bestDir];
        long newTileId = ny * game.map.getXsize() + nx;
        return game.moveUnit(unit.getId(), (int) newTileId, bestDir);
    }

    /** Attempts to move a unit in a randomly chosen valid direction. */
    private boolean moveUnitRandomly(Unit unit, UnitType utype) {
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
            long nx = x + DIR_DX[dir];
            long ny = y + DIR_DY[dir];
            if (nx < 0 || nx >= game.map.getXsize() || ny < 0 || ny >= game.map.getYsize()) continue;
            long newTileId = ny * game.map.getXsize() + nx;
            Tile destTile = game.tiles.get(newTileId);
            if (destTile == null) continue;
            // Land units avoid ocean tiles (terrain 2 = Ocean, 3 = Deep Ocean)
            if (utype.getDomain() == 0) {
                int terrain = destTile.getTerrain();
                if (terrain == 2 || terrain == 3) continue;
            }
            return game.moveUnit(unit.getId(), (int) newTileId, dir);
        }
        return false;
    }

    /**
     * Shuts down the AI executor service. Should be called when the game ends
     * or the server stops.
     */
    public void shutdown() {
        executor.shutdown();
    }
}
