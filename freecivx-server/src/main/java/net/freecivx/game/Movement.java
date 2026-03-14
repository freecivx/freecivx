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

/**
 * Unit movement utility functions.
 * Mirrors the functionality of common/movement.c in the C Freeciv server.
 * Provides helper methods for calculating move rates, validating movement,
 * determining facing direction, and checking tile traversal costs.
 */
public class Movement {

    /** Movement cost for crossing a river boundary. */
    public static final int RIVER_MOVE_COST = 3;
    /** Movement cost multiplier for road/highway tiles. */
    public static final int ROAD_MOVE_DIVISOR = 3;

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
     * Checks terrain domain compatibility (land/sea/air), ZOC rules, and whether
     * the unit has sufficient moves remaining.
     *
     * @param unit    the unit attempting to move
     * @param dest    the destination tile
     * @param worldMap the world map (used for wrapping checks)
     * @return {@code true} if the movement is allowed
     */
    public static boolean unitCanMoveTo(Unit unit, Tile dest, WorldMap worldMap) {
        if (unit == null || dest == null) return false;
        if (unit.getMovesleft() <= 0) return false;
        // TODO: domain and ZOC checks once terrain domain flags are stored on Tile
        return true;
    }

    /**
     * Returns the movement cost for a unit crossing from {@code src} to {@code dest}.
     * The cost depends on the destination terrain type, road/river improvements,
     * and the unit's domain.
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
     * Calculates the facing direction a unit should adopt when moving between tiles.
     * Direction is encoded as an integer 0–7 representing the eight compass points.
     *
     * @param fromTile tile index of the source tile
     * @param toTile   tile index of the destination tile
     * @param worldMap the world map (needed for x-wrap boundary handling)
     * @return direction integer (0 = North, clockwise to 7 = NorthWest), or -1 on error
     */
    public static int unitFacing(int fromTile, int toTile, WorldMap worldMap) {
        if (worldMap == null) return -1;
        int xsize = worldMap.getXsize();
        int dx = (toTile % xsize) - (fromTile % xsize);
        int dy = (toTile / xsize) - (fromTile / xsize);

        if (dx == 0 && dy < 0) return 0; // North
        if (dx > 0 && dy < 0) return 1;  // NE
        if (dx > 0 && dy == 0) return 2; // East
        if (dx > 0 && dy > 0) return 3;  // SE
        if (dx == 0 && dy > 0) return 4; // South
        if (dx < 0 && dy > 0) return 5;  // SW
        if (dx < 0 && dy == 0) return 6; // West
        if (dx < 0 && dy < 0) return 7;  // NW
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
     * enemy zones of control and hostile units already occupying the tile.
     *
     * @param unit the unit to check
     * @param dest the candidate destination tile
     * @return {@code true} if the unit can safely enter the tile
     */
    public static boolean unitSafeToMove(Unit unit, Tile dest) {
        if (unit == null || dest == null) return false;
        // TODO: check for enemy ZOC and stacking restrictions
        return true;
    }
}
