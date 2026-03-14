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
import java.util.List;
import java.util.Random;
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
    private static final String[] AI_CITY_NAMES = {
        "Rome", "Athens", "Cairo", "Babylon", "Carthage", "Persepolis",
        "Thebes", "Memphis", "Nineveh", "Tyre", "Samarkand", "Antioch"
    };
    private int aiCityNameIndex = 0;

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

            UnitType utype = game.unitTypes.get((long) unit.getType());
            if (utype == null) continue;

            // Settlers: build a city if standing on a good tile with no existing city
            if (unit.getType() == 0) {
                Tile tile = game.tiles.get(unit.getTile());
                if (tile != null && tile.getTerrain() == 7 && tile.getWorked() < 0
                        && game.units.containsKey(unit.getId())) {
                    if (random.nextInt(AI_CITY_BUILD_CHANCE) == 0) {
                        String cityName = AI_CITY_NAMES[aiCityNameIndex % AI_CITY_NAMES.length];
                        aiCityNameIndex++;
                        game.buildCity(unit.getId(), cityName, unit.getTile());
                        continue;
                    }
                }
            }

            // Move unit randomly while it has remaining movement points
            int movesUsed = 0;
            while (unit.getMovesleft() > 0 && movesUsed < utype.getMoveRate()) {
                if (!moveUnitRandomly(unit, utype)) break;
                movesUsed++;
            }
        }
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
        int[] DIR_DX = {-1, 0, 1, -1, 1, -1, 0, 1};
        int[] DIR_DY = {-1, -1, -1, 0, 0, 1, 1, 1};

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
