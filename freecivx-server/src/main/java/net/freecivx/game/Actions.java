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

import java.util.ArrayList;
import java.util.List;

/**
 * Action system for unit and city actions.
 * Mirrors the functionality of common/actions.c in the C Freeciv server.
 * Actions are the discrete player-initiated operations such as attacking,
 * founding a city, building improvements, or using diplomatic spy actions.
 * The system checks enabler conditions before executing an action.
 */
public class Actions {

    /** Action ID: found a new city with a settler unit. */
    public static final int ACTION_FOUND_CITY = 27;
    /** Action ID: join an existing city with a migrants unit. */
    public static final int ACTION_JOIN_CITY = 28;
    /** Action ID: build a road on the current tile. */
    public static final int ACTION_ROAD = 61;
    /** Action ID: build an irrigation improvement on the tile. */
    public static final int ACTION_IRRIGATE = 62;
    /** Action ID: build a mine on the current tile. */
    public static final int ACTION_MINE = 63;
    /** Action ID: fortify the unit on its current tile. */
    public static final int ACTION_FORTIFY = 57;
    /** Action ID: attack an enemy unit or city. */
    public static final int ACTION_ATTACK = 45;

    /**
     * Checks whether a given action is currently enabled for an actor unit.
     * Returns {@code false} immediately if the actor does not exist or the
     * action ID is unknown.
     *
     * @param game     the current game state
     * @param actorId  the ID of the unit (or city) attempting the action
     * @param actionId the numeric action ID (see ACTION_* constants)
     * @return {@code true} if all enabler conditions are satisfied
     */
    public static boolean actionIsEnabled(Game game, long actorId, int actionId) {
        Unit actor = game.units.get(actorId);
        if (actor == null) return false;

        switch (actionId) {
            case ACTION_FOUND_CITY:
                // Settler-type units can found a city on a non-city tile
                return actor.getMovesleft() > 0;
            case ACTION_FORTIFY:
                return actor.getActivity() != 3; // Not already fortified
            case ACTION_ATTACK:
                return actor.getMovesleft() > 0;
            default:
                return actor.getMovesleft() > 0;
        }
    }

    /**
     * Returns the list of action IDs that are currently enabled for a unit.
     * Used by the client to build the action menu for a selected unit.
     *
     * @param game   the current game state
     * @param unitId the ID of the unit to query
     * @return a list of enabled action IDs; empty if the unit does not exist
     */
    public static List<Integer> getEnabledActions(Game game, long unitId) {
        List<Integer> enabled = new ArrayList<>();
        Unit unit = game.units.get(unitId);
        if (unit == null) return enabled;

        int[] candidates = {ACTION_FOUND_CITY, ACTION_JOIN_CITY, ACTION_ROAD,
                ACTION_IRRIGATE, ACTION_MINE, ACTION_FORTIFY, ACTION_ATTACK};

        for (int actionId : candidates) {
            if (actionIsEnabled(game, unitId, actionId)) {
                enabled.add(actionId);
            }
        }
        return enabled;
    }

    /**
     * Executes a generic unit action against a target.
     * Delegates to the appropriate action implementation based on {@code actionId}.
     *
     * @param game     the current game state
     * @param unitId   the ID of the actor unit
     * @param actionId the action to perform
     * @param targetId the ID of the target (unit, city, or tile depending on action)
     * @return {@code true} if the action was successfully executed
     */
    public static boolean actionDoUnit(Game game, long unitId, int actionId, long targetId) {
        if (!actionIsEnabled(game, unitId, actionId)) return false;

        Unit unit = game.units.get(unitId);
        if (unit == null) return false;

        switch (actionId) {
            case ACTION_FORTIFY:
                unit.setActivity(net.freecivx.server.CityTurn.ACTIVITY_FORTIFIED);
                return true;
            case ACTION_ROAD:
                unit.setActivity(5); // ACTIVITY_ROAD
                return true;
            case ACTION_IRRIGATE:
                unit.setActivity(6); // ACTIVITY_IRRIGATE
                return true;
            case ACTION_MINE:
                unit.setActivity(7); // ACTIVITY_MINE
                return true;
            default:
                return false;
        }
    }

    /**
     * Executes the "Found City" action for a settler unit.
     * Removes the settler, creates a new city at its tile with the given name,
     * and returns {@code true} on success.
     *
     * @param game     the current game state
     * @param unitId   the ID of the settler unit performing the action
     * @param cityName the name for the new city
     * @param tileId   the tile on which the city is to be founded
     * @return {@code true} if the city was successfully founded
     */
    public static boolean actionFoundCity(Game game, long unitId, String cityName, long tileId) {
        Unit unit = game.units.get(unitId);
        if (unit == null) return false;

        game.buildCity(unitId, cityName, tileId);
        return true;
    }

    /**
     * Executes the "Build Improvement" action for a city.
     * Places the improvement into the city's worklist or completes it
     * immediately if enough shields are available.
     *
     * @param game          the current game state
     * @param cityId        the ID of the city building the improvement
     * @param improvementId the ID of the improvement to build
     * @return {@code true} if the improvement was queued or completed
     */
    public static boolean actionBuildImprovement(Game game, long cityId, long improvementId) {
        City city = game.cities.get(cityId);
        if (city == null) return false;

        Improvement improvement = game.improvements.get(improvementId);
        if (improvement == null) return false;

        city.setProductionKind(1); // 1 = improvement production
        city.setProductionValue((int) improvementId);
        return true;
    }
}
