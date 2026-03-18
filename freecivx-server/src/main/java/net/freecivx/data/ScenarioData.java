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

package net.freecivx.data;

import java.util.Map;

/**
 * Holds the parsed data from a Freeciv scenario savegame (.sav) file.
 * Populated by {@link ScenarioLoader} and consumed by
 * {@code Game.loadScenario()}.
 */
public class ScenarioData {

    /** Map width in tiles. */
    public int xsize;

    /** Map height in tiles. */
    public int ysize;

    /**
     * Maps each single-character terrain identifier (as used in the .sav map
     * rows) to the corresponding terrain name (e.g. {@code 'g'} → {@code "Grassland"}).
     * Built from the {@code terrident} table in the {@code [savefile]} section.
     */
    public Map<Character, String> terrainIdentifiers;

    /**
     * Terrain row strings indexed by row number (0 = top row).
     * Each string has length {@link #xsize}; each character is a terrain
     * identifier key found in {@link #terrainIdentifiers}.
     */
    public String[] terrainRows;
}
