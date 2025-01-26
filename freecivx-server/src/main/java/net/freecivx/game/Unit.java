/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.Freecivx.net/
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
package net.freecivx.game;

/**
 * @param id
 * @param owner      ID of the player or entity that owns the unit
 * @param tile       The tile where the unit is located
 * @param type       The type of the unit (e.g., an ID referring to UnitType)
 * @param facing     The direction the unit is facing (e.g., could represent angles or cardinal
 * @param veteran    Veteran level of the unit
 * @param hp         Current hit points of the unit
 * @param activity   The current activity or status of the unit
 */
public record Unit(long id, int owner, int tile, int type, int facing,
          int veteran, int hp, int activity) {}