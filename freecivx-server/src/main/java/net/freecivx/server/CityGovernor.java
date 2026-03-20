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

package net.freecivx.server;

import net.freecivx.game.City;
import net.freecivx.game.CmParameter;
import net.freecivx.game.Game;
import net.freecivx.game.Player;
import net.freecivx.game.Tile;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * City governor (CMA – City Management Algorithm) for the Java Freeciv server.
 *
 * <p>Implements a greedy worker-tile assignment that mirrors the spirit of the C
 * Freeciv server's branch-and-bound CMA in {@code common/aicore/cm.c}.  For each
 * city that has an active {@link CmParameter} the governor:
 * <ol>
 *   <li>Releases every non-centre worked tile.</li>
 *   <li>Collects all tiles within the city's working radius that are not already
 *       worked by another city.</li>
 *   <li>Scores each tile using the player-supplied factor weights, taking the
 *       current tax/luxury/science rates into account for trade-derived outputs.</li>
 *   <li>Assigns the highest-scoring tiles to the city's citizens.</li>
 * </ol>
 *
 * <p>The six factor/surplus indices are:
 * <ol start="0">
 *   <li>food</li>
 *   <li>shields</li>
 *   <li>trade</li>
 *   <li>gold  (trade × tax rate)</li>
 *   <li>luxury (trade × luxury rate)</li>
 *   <li>science (trade × science rate)</li>
 * </ol>
 */
public class CityGovernor {

    /** Euclidean-squared city working radius (matches RS_DEFAULT_CITY_RADIUS_SQ = 5). */
    private static final int CITY_RADIUS_SQ = CityTools.CITY_RADIUS_SQ;

    /**
     * Applies the city governor for a single city.
     *
     * <p>If the city has no active {@link CmParameter} this method is a no-op.
     * Tile {@code worked} flags on {@link Tile} objects are updated in-place;
     * callers are responsible for broadcasting tile-info changes to clients
     * after calling this method.
     *
     * @param game   the current game state
     * @param cityId the ID of the city to manage
     */
    public static void applyCityGovernor(Game game, long cityId) {
        City city = game.cities.get(cityId);
        if (city == null) return;

        CmParameter params = city.getCmParameter();
        if (params == null) return;

        Player player = game.players.get(city.getOwner());
        if (player == null) return;

        int taxRate = player.getTaxRate();
        int luxRate = player.getLuxuryRate();
        int sciRate = player.getScienceRate();
        int[] factor = params.getFactor();

        // Effective trade weight combines raw trade factor with tax/lux/sci shares.
        double tradeWeight = factor[2]
                + factor[3] * taxRate  / 100.0
                + factor[4] * luxRate  / 100.0
                + factor[5] * sciRate  / 100.0;

        long centerTileId = city.getTile();

        // --- Step 1: release all non-centre tiles currently worked by this city ---
        for (long tileId : new ArrayList<>(city.getWorkedTiles())) {
            if (tileId == centerTileId) continue;
            Tile t = game.tiles.get(tileId);
            if (t != null && t.getWorked() == cityId) {
                t.setWorked(-1L);
            }
        }
        city.getWorkedTiles().clear();
        city.addWorkedTile(centerTileId);

        // --- Step 2: collect candidate tiles within city radius ---
        int xsize = game.map.getXsize();
        int ysize = game.map.getYsize();
        int cx = (int) (centerTileId % xsize);
        int cy = (int) (centerTileId / xsize);
        int r = (int) Math.floor(Math.sqrt(CITY_RADIUS_SQ));

        List<Tile> candidates = new ArrayList<>();
        for (int dy = -r; dy <= r; dy++) {
            for (int dx = -r; dx <= r; dx++) {
                if (dx == 0 && dy == 0) continue; // centre is always worked
                if (dx * dx + dy * dy > CITY_RADIUS_SQ) continue;
                int nx = ((cx + dx) % xsize + xsize) % xsize;
                int ny = cy + dy;
                if (ny < 0 || ny >= ysize) continue;
                long tileId = (long) ny * xsize + nx;
                Tile t = game.tiles.get(tileId);
                if (t != null && (t.getWorked() < 0 || t.getWorked() == cityId)) {
                    candidates.add(t);
                }
            }
        }

        // --- Step 3: score and sort tiles ---
        final double tw = tradeWeight;
        candidates.sort(Comparator.comparingDouble((Tile t) ->
                scoreTile(game, t, factor, tw)).reversed());

        // --- Step 4: assign top (size - 1) tiles ---
        int citizensToAssign = city.getSize() - 1; // one citizen already on centre
        for (Tile t : candidates) {
            if (citizensToAssign <= 0) break;
            t.setWorked(cityId);
            city.addWorkedTile(t.getIndex());
            citizensToAssign--;
        }
    }

    /**
     * Computes the weighted score for a single non-centre tile.
     *
     * @param game         game state (used for tile output)
     * @param tile         the tile to evaluate
     * @param factor       6-element factor array from {@link CmParameter#getFactor()}
     * @param tradeWeight  combined trade weight (factor[2] + tax/lux/sci contributions)
     * @return weighted score; higher is better
     */
    private static double scoreTile(Game game, Tile tile, int[] factor, double tradeWeight) {
        int[] output = CityTurn.getTileOutput(game, tile, false);
        int food    = output[0];
        int shields = output[1];
        int trade   = output[2];
        return factor[0] * food + factor[1] * shields + tradeWeight * trade;
    }
}
