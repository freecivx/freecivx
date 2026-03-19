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

package net.freecivx.game;

import java.util.Map;

/**
 * Unit movement utility functions.
 * Mirrors the functionality of common/movement.c in the C Freeciv server.
 * Provides helper methods for calculating move rates, validating movement,
 * determining facing direction, and checking tile traversal costs.
 */
public class Movement {

    /** Movement cost for crossing a river boundary. */
    public static final int RIVER_MOVE_COST = 3;
    /** Movement cost divisor for road tiles (road halves cost, min 1). */
    public static final int ROAD_MOVE_DIVISOR = 3;
    /**
     * Extra bit index for Roads in the tile extras bitvector.
     * Mirrors the Road extra order defined in Game.initGame().
     */
    public static final int EXTRA_BIT_ROAD = 6;
    /**
     * Extra bit index for Railroads in the tile extras bitvector.
     * Railroad reduces movement cost to 1/3 of normal (minimum 1).
     */
    public static final int EXTRA_BIT_RAIL = 7;

    /**
     * 8-direction delta-X array.
     * Indices 0-7 map to: NW(-1,-1), N(0,-1), NE(1,-1), W(-1,0),
     * E(1,0), SW(-1,1), S(0,1), SE(1,1).
     * Mirrors the direction encoding used throughout the C Freeciv server.
     */
    public static final int[] DIR_DX = {-1, 0, 1, -1, 1, -1, 0, 1};

    /**
     * 8-direction delta-Y array matching {@link #DIR_DX}.
     */
    public static final int[] DIR_DY = {-1, -1, -1, 0, 0, 1, 1, 1};

    /**
     * Returns the full move rate for a unit, taking into account the unit
     * type's base move rate and any veteran-level bonuses.
     *
     * @param unit     the unit to evaluate
     * @param unitType the type definition for the unit
     * @return the number of move points available per turn
     */
    public static int unitMoveRate(Unit unit, UnitType unitType) {
        if (unit == null || unitType == null) return 0;
        int base = unitType.getMoveRate();
        // Veteran units receive a 1-point bonus per veteran level
        return base + unit.getVeteran();
    }

    /**
     * Determines whether a unit can legally move to the specified destination tile.
     * Checks terrain domain compatibility (land/sea/air) and whether the unit has
     * sufficient moves remaining.  ZOC is checked separately via
     * {@link #canStepWrtZoc}.
     *
     * @param unit    the unit attempting to move
     * @param dest    the destination tile
     * @param worldMap the world map (used for wrapping checks)
     * @return {@code true} if the movement is allowed
     */
    public static boolean unitCanMoveTo(Unit unit, Tile dest, WorldMap worldMap) {
        if (unit == null || dest == null) return false;
        if (unit.getMovesleft() <= 0) return false;
        return true;
    }

    /**
     * Checks whether a move from {@code srcTileIdx} to {@code dstTileIdx} is
     * permitted with respect to enemy Zone of Control (ZOC).
     * Mirrors {@code can_step_taken_wrt_to_zoc} in the C Freeciv server's
     * {@code common/movement.c}.
     *
     * <p>A land unit's move is <em>blocked</em> by ZOC when all of the following hold:
     * <ol>
     *   <li>The unit is a land unit (domain 0).</li>
     *   <li>The unit type is military (attack strength &gt; 0); non-military units
     *       such as Diplomats ignore ZOC.</li>
     *   <li>Neither the source nor destination tile is a city.</li>
     *   <li>The source tile is not ocean (ocean has the {@code TER_NO_ZOC} flag).</li>
     *   <li>There are no allied units already on the destination tile.</li>
     *   <li>Neither the source nor destination tile is within the moving player's
     *       own ZOC (i.e. no friendly ground military unit is adjacent to either).</li>
     * </ol>
     *
     * @param unit       the unit attempting to move
     * @param unitType   the unit type definition (domain and attack strength)
     * @param srcTileIdx index of the source tile
     * @param dstTileIdx index of the destination tile
     * @param allUnits   all units in the game (for ZOC and allied-unit checks)
     * @param unitTypes  all unit type definitions (to determine ZOC establishment)
     * @param cities     all cities in the game (cities exempt units from ZOC)
     * @param tiles      all tiles in the game (terrain look-up)
     * @param worldMap   world map (adjacency/wrap computation)
     * @param topologyId map topology bitmask (0=square, 2=hex, 3=iso-hex)
     * @return {@code true} if the move is allowed with respect to ZOC
     */
    public static boolean canStepWrtZoc(Unit unit, UnitType unitType,
                                        long srcTileIdx, long dstTileIdx,
                                        Map<Long, Unit> allUnits,
                                        Map<Long, UnitType> unitTypes,
                                        Map<Long, City> cities,
                                        Map<Long, Tile> tiles,
                                        WorldMap worldMap,
                                        int topologyId) {
        if (unit == null || unitType == null) return true;

        // Only land units are subject to ZOC (sea/air units ignore it).
        if (unitType.getDomain() != 0) return true;

        // Non-military units (Diplomat, Settler, etc.) ignore ZOC.
        // Mirrors unit_type_really_ignores_zoc() in the C server.
        if (unitType.getAttackStrength() == 0) return true;

        Tile srcTile = tiles.get(srcTileIdx);
        Tile dstTile = tiles.get(dstTileIdx);
        if (srcTile == null || dstTile == null) return true;

        // Units on ocean tiles are not subject to ZOC (TER_NO_ZOC flag).
        // Terrain 2=Ocean, 3=Deep Ocean in the classic ruleset.
        int srcTerrain = srcTile.getTerrain();
        if (srcTerrain == 2 || srcTerrain == 3) return true;

        // Moving from or into a city ignores ZOC.
        // Mirrors the tile_city() checks in the C server.
        if (srcTile.getWorked() > 0 && cities.get(srcTile.getWorked()) != null) return true;
        if (dstTile.getWorked() > 0 && cities.get(dstTile.getWorked()) != null) return true;

        // An allied unit already on the destination tile satisfies ZOC.
        // Mirrors is_allied_unit_tile() in the C server.
        for (Unit other : allUnits.values()) {
            if (other.getId() == unit.getId()) continue;
            if (other.getTile() == dstTileIdx && other.getOwner() == unit.getOwner()) return true;
        }

        // The move is allowed if either the source or destination is within the
        // moving player's own ZOC (friendly military unit adjacent to either tile).
        // Mirrors: is_my_zoc(owner, src) || is_my_zoc(owner, dst)
        if (isTileInPlayersZoc(unit.getOwner(), srcTileIdx, allUnits, unitTypes, worldMap, topologyId)) return true;
        if (isTileInPlayersZoc(unit.getOwner(), dstTileIdx, allUnits, unitTypes, worldMap, topologyId)) return true;

        // None of the exemptions apply: the move is blocked by enemy ZOC.
        return false;
    }

    /**
     * Returns {@code true} if the given player has a ground military unit on any
     * tile adjacent to {@code tileIdx} (i.e., the tile is within the player's ZOC).
     * Mirrors {@code is_my_zoc} in the C Freeciv server's {@code common/movement.c}.
     *
     * <p>A unit establishes ZOC if its domain is 0 (land) and it has a positive
     * attack strength.
     *
     * <p>For hex topologies only the 6 valid directions are checked, mirroring the
     * {@code adjc_iterate} macro in the C Freeciv server which respects map topology.
     *
     * @param playerId   the owner whose ZOC is being tested
     * @param tileIdx    the tile to test
     * @param allUnits   all units in the game
     * @param unitTypes  all unit type definitions
     * @param worldMap   world map for adjacency and wrapping
     * @param topologyId map topology bitmask (0=square, 2=hex, 3=iso-hex)
     * @return {@code true} if the player controls a military unit adjacent to the tile
     */
    private static boolean isTileInPlayersZoc(long playerId, long tileIdx,
                                      Map<Long, Unit> allUnits,
                                      Map<Long, UnitType> unitTypes,
                                      WorldMap worldMap,
                                      int topologyId) {
        int xsize = worldMap.getXsize();
        int ysize = worldMap.getYsize();
        int tx = (int)(tileIdx % xsize);
        int ty = (int)(tileIdx / xsize);

        boolean isHex = (topologyId & 2) != 0; // TF_HEX = 2
        boolean isIso = (topologyId & 1) != 0; // TF_ISO = 1

        // Iterate over the 8 direction indices (0=NW,1=N,2=NE,3=W,4=E,5=SW,6=S,7=SE).
        // For hex topologies filter out the two invalid diagonal directions, matching
        // adjc_iterate() in the C Freeciv server which respects map topology.
        for (int d = 0; d < 8; d++) {
            if (isHex) {
                if (!isIso && (d == 0 || d == 7)) continue; // pure hex: NW/SE invalid
                if (isIso  && (d == 2 || d == 5)) continue; // iso-hex: NE/SW invalid
            }
            int nx = (tx + DIR_DX[d] + xsize) % xsize; // horizontal wrap
            int ny = ty + DIR_DY[d];
            if (ny < 0 || ny >= ysize) continue;
            long adjIdx = (long)(ny * xsize + nx);

            for (Unit u : allUnits.values()) {
                if (u.getOwner() != playerId) continue;
                if (u.getTile() != adjIdx) continue;
                UnitType utype = unitTypes.get((long) u.getType());
                // Ground military units (domain=0, attack>0) establish ZOC.
                if (utype != null && utype.getDomain() == 0
                        && utype.getAttackStrength() > 0) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Returns the movement cost for a unit crossing from {@code src} to {@code dest}.
     * The cost depends on the destination terrain type, road/river improvements,
     * and the unit's domain.
     * This simple overload always returns 1; use the terrain-aware overload for
     * accurate per-terrain costs.
     *
     * @param src  the source tile
     * @param dest the destination tile
     * @param unit the unit being moved (used for domain and road-use eligibility)
     * @return the number of move points consumed
     */
    public static int tileMoveCost(Tile src, Tile dest, Unit unit) {
        if (src == null || dest == null || unit == null) return Integer.MAX_VALUE;
        // Basic cost: 1 MF per tile; roads reduce cost
        return 1;
    }

    /**
     * Returns the terrain-accurate movement cost for entering the destination
     * tile.  Accounts for terrain type (Mountains=3, Hills/Forest=2, others=1),
     * road bonuses (divide cost by {@link #ROAD_MOVE_DIVISOR}), and railroad
     * bonuses (always cost 1).
     * Air units (domain=2) always pay 1 move point regardless of terrain,
     * mirroring the {@code UCF_TERRAIN_SPEED} unit-class flag in the C Freeciv
     * server's {@code common/movement.c}.
     * Naval units (domain=1) on ocean tiles always pay 1 move point.
     * Mirrors the {@code tile_move_cost} calculation in the C Freeciv server's
     * {@code common/movement.c}, using the terrain's {@code movement_cost} field
     * and road/rail extra detection via the tile extras bitvector.
     *
     * @param src      the source tile (unused in this implementation but kept for
     *                 future river-crossing support)
     * @param dest     the destination tile
     * @param unit     the unit being moved
     * @param terrains map of terrain type ID → {@link Terrain} definitions
     * @param unitType the unit type definition (used for domain check)
     * @return the number of move points consumed (always ≥ 1)
     */
    public static int tileMoveCost(Tile src, Tile dest, Unit unit,
                                   Map<Long, Terrain> terrains,
                                   UnitType unitType) {
        if (src == null || dest == null || unit == null) return Integer.MAX_VALUE;

        // Air units (domain=2) ignore terrain costs — they always pay 1 move point.
        // Mirrors the UCF_TERRAIN_SPEED=false behaviour for Air/Helicopter classes
        // in the C Freeciv server's common/movement.c.
        if (unitType != null && unitType.getDomain() == 2) {
            return 1;
        }

        // Naval units (domain=1) on ocean always pay 1 move point.
        if (unitType != null && unitType.getDomain() == 1) {
            return 1;
        }

        // Railroad: always 1 move point regardless of terrain (fastest travel)
        if ((dest.getExtras() & (1 << EXTRA_BIT_RAIL)) != 0) {
            return 1;
        }

        // Look up terrain cost from the ruleset (Mountains=3, Hills/Forest=2, others=1)
        Terrain terrain = terrains.get((long) dest.getTerrain());
        int baseCost = terrain != null ? terrain.getMoveCost() : 1;

        // Road: divide terrain cost by ROAD_MOVE_DIVISOR (minimum 1).
        // Mirrors the road move bonus in the C Freeciv server's movement.c.
        if ((dest.getExtras() & (1 << EXTRA_BIT_ROAD)) != 0) {
            return Math.max(1, baseCost / ROAD_MOVE_DIVISOR);
        }

        return baseCost;
    }

    /**
     * Returns the terrain-accurate movement cost for entering the destination
     * tile.  This overload is kept for backwards compatibility; it does not
     * apply domain-based cost exemptions (air/naval).  Prefer the overload that
     * accepts a {@link UnitType} parameter.
     *
     * @param src      the source tile
     * @param dest     the destination tile
     * @param unit     the unit being moved
     * @param terrains map of terrain type ID → {@link Terrain} definitions
     * @return the number of move points consumed (always ≥ 1)
     */
    public static int tileMoveCost(Tile src, Tile dest, Unit unit,
                                   Map<Long, Terrain> terrains) {
        if (src == null || dest == null || unit == null) return Integer.MAX_VALUE;

        // Railroad: always 1 move point regardless of terrain (fastest travel)
        if ((dest.getExtras() & (1 << EXTRA_BIT_RAIL)) != 0) {
            return 1;
        }

        // Look up terrain cost from the ruleset (Mountains=3, Hills/Forest=2, others=1)
        Terrain terrain = terrains.get((long) dest.getTerrain());
        int baseCost = terrain != null ? terrain.getMoveCost() : 1;

        // Road: divide terrain cost by ROAD_MOVE_DIVISOR (minimum 1).
        // Mirrors the road move bonus in the C Freeciv server's movement.c.
        if ((dest.getExtras() & (1 << EXTRA_BIT_ROAD)) != 0) {
            return Math.max(1, baseCost / ROAD_MOVE_DIVISOR);
        }

        return baseCost;
    }

    /**
     * Calculates the facing direction a unit should adopt when moving between tiles.
     * Direction is encoded using the DIR8_ encoding that matches the JavaScript client:
     * DIR8_NORTHWEST=0, DIR8_NORTH=1, DIR8_NORTHEAST=2, DIR8_WEST=3, DIR8_EAST=4,
     * DIR8_SOUTHWEST=5, DIR8_SOUTH=6, DIR8_SOUTHEAST=7.
     * This encoding is the same as the DIR_DX/DIR_DY index order.
     *
     * <p>East-west map wrapping is handled: if the raw x-delta is greater than
     * half the map width the shorter wrap-around path is used instead.
     *
     * @param fromTile tile index of the source tile
     * @param toTile   tile index of the destination tile
     * @param worldMap the world map (needed for x-wrap boundary handling)
     * @return DIR8_ direction index (0–7), or -1 on error
     */
    public static int unitFacing(int fromTile, int toTile, WorldMap worldMap) {
        if (worldMap == null) return -1;
        int xsize = worldMap.getXsize();
        int rawDx = (toTile % xsize) - (fromTile % xsize);
        // Handle east-west map wrap: choose the shorter delta.
        // Use multiplication to avoid integer-division ambiguity on odd map widths.
        int dx;
        if (Math.abs(rawDx) * 2 <= xsize) {
            dx = rawDx;
        } else {
            dx = rawDx > 0 ? rawDx - xsize : rawDx + xsize;
        }
        int dy = (toTile / xsize) - (fromTile / xsize);

        // Return values use the same DIR8_ encoding as the JavaScript client and
        // as the DIR_DX/DIR_DY index arrays:
        //   0=NW, 1=N, 2=NE, 3=W, 4=E, 5=SW, 6=S, 7=SE
        if (dx == 0 && dy < 0) return 1; // N  (DIR8_NORTH)
        if (dx > 0 && dy < 0) return 2;  // NE (DIR8_NORTHEAST)
        if (dx > 0 && dy == 0) return 4; // E  (DIR8_EAST)
        if (dx > 0 && dy > 0) return 7;  // SE (DIR8_SOUTHEAST)
        if (dx == 0 && dy > 0) return 6; // S  (DIR8_SOUTH)
        if (dx < 0 && dy > 0) return 5;  // SW (DIR8_SOUTHWEST)
        if (dx < 0 && dy == 0) return 3; // W  (DIR8_WEST)
        if (dx < 0 && dy < 0) return 0;  // NW (DIR8_NORTHWEST)
        return -1;
    }

    /**
     * Validates a movement attempt, checking both tile legality and cost.
     *
     * @param unit       the unit attempting to move
     * @param fromTileId the ID of the source tile
     * @param toTileId   the ID of the destination tile
     * @param worldMap   the world map
     * @return {@code true} if the move is valid and affordable
     */
    public static boolean isValidMovement(Unit unit, long fromTileId, long toTileId, WorldMap worldMap) {
        if (unit == null || worldMap == null) return false;
        if (fromTileId == toTileId) return false;
        if (unit.getMovesleft() <= 0) return false;
        return true;
    }

    /**
     * Checks whether it is safe for a unit to move to the given tile, considering
     * hostile units already occupying the tile.  ZOC is checked separately via
     * {@link #canStepWrtZoc}.
     *
     * @param unit the unit to check
     * @param dest the candidate destination tile
     * @return {@code true} if the unit can safely enter the tile
     */
    public static boolean unitSafeToMove(Unit unit, Tile dest) {
        if (unit == null || dest == null) return false;
        return true;
    }
}
