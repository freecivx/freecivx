/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.freecivx.com/
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

import net.freecivx.game.City;
import net.freecivx.game.Game;
import net.freecivx.game.Nation;
import net.freecivx.game.Player;
import net.freecivx.game.Tile;
import net.freecivx.game.Unit;
import net.freecivx.game.UnitType;
import net.freecivx.server.DiplHand;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.Random;

/**
 * Barbarian spawning system for the FreecivX server.
 *
 * <p>Periodically spawns barbarian units near human and AI cities to create a
 * neutral threat that all civilizations must defend against.  Barbarians are
 * implemented as a single special player (player ID {@link #BARBARIAN_PLAYER_ID})
 * that is automatically placed in {@code DS_WAR} with every other player.
 *
 * <p>This class mirrors {@code barbarian.c} / {@code barbarian.h} from the
 * Freeciv C server, porting the core logic:
 * <ul>
 *   <li>{@code summon_barbarians()} → {@link #summonBarbarians(Game)}</li>
 *   <li>{@code try_summon_barbarians()} → {@link #trySummonBarbarians(Game)}</li>
 *   <li>{@code create_barbarian_player()} → {@link #createOrGetBarbarianPlayer(Game)}</li>
 *   <li>{@code barbarian_initial_wars()} → {@link #ensureBarbarianWars(Game, Player)}</li>
 * </ul>
 */
public class Barbarian {

    private static final Logger log = LoggerFactory.getLogger(Barbarian.class);

    /**
     * Player ID reserved for the land-barbarian player.
     * Placed well above {@code AI_PLAYER_ID_BASE + 9} (max aifill = 9) so
     * it never collides with regular AI players (100-108) or human players.
     * The value 200 also stays below 255, so the JavaScript border renderer
     * does not treat it as an error.
     */
    public static final long BARBARIAN_PLAYER_ID = 200L;

    /**
     * First turn on which barbarians may appear.
     * Mirrors {@code game.server.onsetbarbarian} in the C server (default 5).
     */
    static final int ONSET_BARBARIAN_TURN = 5;

    /**
     * Maximum Manhattan distance from the candidate tile to the nearest city.
     * Uprisings beyond this radius are discarded.
     * Mirrors {@code MAX_UNREST_DIST} in barbarian.c.
     */
    static final int MAX_UNREST_DIST = 10;

    /**
     * Minimum Manhattan distance from the candidate tile to the nearest city.
     * Prevents barbarians from appearing directly inside a city.
     * Mirrors {@code MIN_UNREST_DIST} in barbarian.c.
     */
    static final int MIN_UNREST_DIST = 2;

    /**
     * Minimum city count that promotes the uprising one level larger.
     * Mirrors {@code UPRISE_CIV_SIZE} in barbarian.c.
     */
    static final int UPRISE_CIV_SIZE = 2;

    /**
     * Number of random spawn attempts made per turn.
     * Analogous to the {@code barbarianrate-1} loop in {@code summon_barbarians()}.
     */
    static final int SUMMON_ATTEMPTS_PER_TURN = 3;

    private final Random random = new Random();

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * Main entry point called at the end of each server turn.
     * Makes {@link #SUMMON_ATTEMPTS_PER_TURN} independent spawn attempts.
     * Returns immediately if the game has not yet reached the onset turn.
     * Mirrors {@code summon_barbarians()} in barbarian.c.
     *
     * @param game current game state
     */
    public void summonBarbarians(Game game) {
        if (game.turn < ONSET_BARBARIAN_TURN) {
            return;
        }
        // Need at least one non-barbarian city as a target.
        if (game.cities.isEmpty()) {
            return;
        }
        for (int i = 0; i < SUMMON_ATTEMPTS_PER_TURN; i++) {
            trySummonBarbarians(game);
        }
    }

    // -----------------------------------------------------------------------
    // Internal spawn logic
    // -----------------------------------------------------------------------

    /**
     * Single attempt to spawn barbarian units at a random map location.
     * Picks a random tile, validates distance to the nearest city, then
     * spawns a group of barbarian warriors nearby.
     * Mirrors {@code try_summon_barbarians()} in barbarian.c.
     *
     * @param game current game state
     */
    private void trySummonBarbarians(Game game) {
        int xsize = game.map.getXsize();
        int ysize = game.map.getYsize();
        int totalTiles = xsize * ysize;
        if (totalTiles == 0) return;

        // Pick a random land tile as the candidate uprising point.
        int candidateTileId = random.nextInt(totalTiles);
        Tile candidateTile = game.tiles.get((long) candidateTileId);
        if (candidateTile == null) return;

        // Skip ocean tiles (terrain 2 = Ocean, 3 = Deep Ocean).
        int candidateTerrain = candidateTile.getTerrain();
        if (candidateTerrain == 2 || candidateTerrain == 3) return;

        // Find the nearest city and compute the Manhattan distance to it.
        long victimId = -1L;
        int nearestDist = Integer.MAX_VALUE;
        int cx = candidateTileId % xsize;
        int cy = candidateTileId / xsize;

        for (City city : game.cities.values()) {
            long ct = city.getTile();
            int citX = (int)(ct % xsize);
            int citY = (int)(ct / xsize);
            int dist = Math.abs(cx - citX) + Math.abs(cy - citY);
            if (dist < nearestDist) {
                nearestDist = dist;
                victimId = city.getOwner();
            }
        }

        // Uprising must fall within the allowed distance band.
        if (nearestDist > MAX_UNREST_DIST || nearestDist < MIN_UNREST_DIST) return;
        if (victimId < 0) return;

        // Do not target the barbarian player itself.
        if (victimId == BARBARIAN_PLAYER_ID) return;

        // Victim must be an alive player.
        Player victim = game.players.get(victimId);
        if (victim == null || !victim.isAlive()) return;

        // Uprising probability scales with the victim's city count.
        // Mirrors: fc_rand(30)+1 > city_count*(barbarianrate-1)
        final long finalVictimId = victimId;
        long victimCityCount = game.cities.values().stream()
                .filter(c -> c.getOwner() == finalVictimId)
                .count();
        if (random.nextInt(30) + 1 > victimCityCount) return;

        // Find a suitable empty land tile near the candidate location.
        long spawnTileId = findEmptyNearbyLandTile(game, candidateTileId, xsize, ysize);
        if (spawnTileId < 0) {
            spawnTileId = candidateTileId;
        }
        Tile spawnTile = game.tiles.get(spawnTileId);
        if (spawnTile == null) return;
        // Never spawn on ocean.
        if (spawnTile.getTerrain() == 2 || spawnTile.getTerrain() == 3) return;

        // Create or retrieve the barbarian player.
        Player barbarians = createOrGetBarbarianPlayer(game);
        if (barbarians == null) return;

        // Scale the group size with the victim's empire size (mirrors uprise calc).
        int uprise = 1;
        int cityMax = UPRISE_CIV_SIZE;
        while (cityMax <= victimCityCount) {
            uprise++;
            cityMax += (int)(cityMax * 1.2) + UPRISE_CIV_SIZE;
        }
        int barbCount = random.nextInt(3) + uprise;

        // Resolve the Warrior unit type to use for barbarian units.
        int warriorTypeId = findWarriorUnitType(game);
        if (warriorTypeId < 0) return;

        UnitType wtype = game.unitTypes.get((long) warriorTypeId);
        int hp       = (wtype != null) ? wtype.getHp()       : 10;
        int moveRate = (wtype != null) ? wtype.getMoveRate() : 1;

        for (int i = 0; i < barbCount; i++) {
            long unitId = (long) game.units.size();
            // Ensure unique ID even when units have been removed.
            while (game.units.containsKey(unitId)) {
                unitId++;
            }
            game.units.put(unitId,
                    new Unit(unitId, BARBARIAN_PLAYER_ID, spawnTileId,
                             warriorTypeId, 0, 1, hp, 0, moveRate));
        }

        // Keep barbarian war state current with all players.
        ensureBarbarianWars(game, barbarians);

        // Notify the victim if they are a human player.
        if (!victim.isAi()) {
            game.getServer().sendMessage(victim.getConnectionId(),
                    "Native unrest near your lands! Barbarian warriors have appeared at ("
                    + (spawnTileId % xsize) + ", " + (spawnTileId / xsize) + ").");
        }

        log.info("Barbarian uprising: {} units at tile {} targeting player {}",
                barbCount, spawnTileId, victimId);
    }

    // -----------------------------------------------------------------------
    // Player management
    // -----------------------------------------------------------------------

    /**
     * Creates the barbarian player if one does not yet exist, or returns the
     * existing one.  The player is flagged as AI, given a nation, and
     * immediately placed in {@code DS_WAR} with all other players.
     * Mirrors {@code create_barbarian_player()} in barbarian.c.
     *
     * @param game current game state
     * @return the barbarian {@link Player}, or {@code null} on failure
     */
    private Player createOrGetBarbarianPlayer(Game game) {
        Player existing = game.players.get(BARBARIAN_PLAYER_ID);
        if (existing != null) {
            return existing;
        }

        // Choose the "Barbarian" nation if it exists in the loaded nations table.
        int nationId = 0;
        for (Map.Entry<Long, Nation> e : game.nations.entrySet()) {
            if ("barbarian".equalsIgnoreCase(e.getValue().getName())) {
                nationId = e.getKey().intValue();
                break;
            }
        }

        Player barb = new Player(BARBARIAN_PLAYER_ID, "Barbarians", "ai", nationId);
        barb.setAi(true);
        game.players.put(BARBARIAN_PLAYER_ID, barb);

        ensureBarbarianWars(game, barb);

        log.info("Created barbarian player (id={})", BARBARIAN_PLAYER_ID);
        return barb;
    }

    /**
     * Sets mutual {@code DS_WAR} diplomatic state between the barbarian player
     * and every other player in the game.  Called when a new barbarian uprising
     * occurs so that newly joined players are also covered.
     * Mirrors {@code barbarian_initial_wars()} in barbarian.c.
     *
     * @param game       current game state
     * @param barbarians the barbarian {@link Player}
     */
    private void ensureBarbarianWars(Game game, Player barbarians) {
        for (Player other : game.players.values()) {
            if (other.getPlayerNo() == BARBARIAN_PLAYER_ID) continue;
            barbarians.setDiplState(other.getPlayerNo(), DiplHand.DS_WAR);
            other.setDiplState(BARBARIAN_PLAYER_ID, DiplHand.DS_WAR);
        }
    }

    // -----------------------------------------------------------------------
    // Tile / unit-type helpers
    // -----------------------------------------------------------------------

    /**
     * Finds an empty land tile adjacent to {@code tileId}.
     * A tile is considered empty when no unit currently occupies it.
     * Mirrors {@code find_empty_tile_nearby()} in barbarian.c.
     *
     * @param game   current game state
     * @param tileId centre tile around which to search
     * @param xsize  map width
     * @param ysize  map height
     * @return tile ID of a suitable empty land tile, or {@code -1} if none found
     */
    private long findEmptyNearbyLandTile(Game game, int tileId, int xsize, int ysize) {
        int x = tileId % xsize;
        int y = tileId / xsize;

        int[] dx = { 0,  1, 0, -1, 1,  1, -1, -1 };
        int[] dy = {-1,  0, 1,  0, -1,  1,  1, -1 };

        for (int d = 0; d < 8; d++) {
            int nx = x + dx[d];
            int ny = y + dy[d];
            if (nx < 0 || nx >= xsize || ny < 0 || ny >= ysize) continue;

            long nTileId = (long)(ny * xsize + nx);
            Tile t = game.tiles.get(nTileId);
            if (t == null) continue;
            // Skip ocean.
            if (t.getTerrain() == 2 || t.getTerrain() == 3) continue;

            // Skip occupied tiles.
            boolean occupied = false;
            for (Unit u : game.units.values()) {
                if (u.getTile() == nTileId) {
                    occupied = true;
                    break;
                }
            }
            if (!occupied) return nTileId;
        }
        return -1L;
    }

    /**
     * Resolves the Warriors unit-type ID to use for barbarian spawning.
     * Falls back to the first land unit with positive attack strength when
     * "Warriors" cannot be found by name.
     *
     * @param game current game state
     * @return unit type ID, or {@code -1} if no suitable type exists
     */
    private int findWarriorUnitType(Game game) {
        // Prefer the canonical "Warriors" unit.
        for (Map.Entry<Long, UnitType> e : game.unitTypes.entrySet()) {
            if ("Warriors".equalsIgnoreCase(e.getValue().getName())) {
                return e.getKey().intValue();
            }
        }
        // Fall back to any attacking land unit.
        for (Map.Entry<Long, UnitType> e : game.unitTypes.entrySet()) {
            UnitType ut = e.getValue();
            if (ut.getAttackStrength() > 0 && ut.getDomain() == 0) {
                return e.getKey().intValue();
            }
        }
        return -1;
    }
}
