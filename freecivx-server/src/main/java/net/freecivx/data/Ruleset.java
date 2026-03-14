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

package net.freecivx.data;

import net.freecivx.game.Government;
import net.freecivx.game.Improvement;
import net.freecivx.game.Nation;
import net.freecivx.game.Technology;
import net.freecivx.game.Terrain;
import net.freecivx.game.UnitType;

import java.util.ArrayList;
import java.util.List;

/**
 * Loads and manages ruleset data from {@code .ruleset} configuration files.
 * Mirrors the functionality of server/ruleset.c in the C Freeciv server.
 * A ruleset defines the game rules: available units, technologies, buildings,
 * terrain types, governments, and nations.  The server must call
 * {@link #loadRuleset(String)} before starting a game.
 */
public class Ruleset {

    private String rulesetName;
    private boolean loaded = false;

    private List<UnitType> unitTypes = new ArrayList<>();
    private List<Technology> technologies = new ArrayList<>();
    private List<Improvement> improvements = new ArrayList<>();
    private List<Terrain> terrains = new ArrayList<>();
    private List<Government> governments = new ArrayList<>();
    private List<Nation> nations = new ArrayList<>();

    /**
     * Loads the complete ruleset with the given name.
     * Reads all sub-files (units, buildings, techs, terrains, governments,
     * nations) from the standard ruleset directory and populates the
     * internal data lists.
     *
     * @param rulesetName the name of the ruleset to load (e.g. "civ2civ3", "classic")
     * @return {@code true} if all sub-files were loaded successfully
     */
    public boolean loadRuleset(String rulesetName) {
        this.rulesetName = rulesetName;
        String basePath = "data/" + rulesetName + "/";

        boolean ok = true;
        ok &= loadUnits(basePath + "units.ruleset");
        ok &= loadBuildings(basePath + "buildings.ruleset");
        ok &= loadTechnologies(basePath + "techs.ruleset");
        ok &= loadTerrains(basePath + "terrain.ruleset");
        ok &= loadGovernments(basePath + "governments.ruleset");
        ok &= loadNations(basePath + "nations.ruleset");

        this.loaded = ok;
        return ok;
    }

    /**
     * Loads nation definitions from the specified ruleset file path.
     * Each nation entry provides a name, adjective, rule-name, and a list
     * of city names used for suggestions.
     *
     * @param path the file-system path to the nations ruleset file
     * @return {@code true} if the file was parsed without errors
     */
    public boolean loadNations(String path) {
        // TODO: parse SectionFile and populate nations list
        System.out.println("Loading nations from: " + path);
        return true;
    }

    /**
     * Loads unit type definitions from the specified ruleset file path.
     * Populates attack/defence strengths, move rates, HP values, and
     * allowed actions for each unit type.
     *
     * @param path the file-system path to the units ruleset file
     * @return {@code true} if the file was parsed without errors
     */
    public boolean loadUnits(String path) {
        // TODO: parse SectionFile and populate unitTypes list
        System.out.println("Loading units from: " + path);
        return true;
    }

    /**
     * Loads building (city improvement) definitions from the specified ruleset
     * file path.  Populates build costs, upkeep, effects, and prerequisites.
     *
     * @param path the file-system path to the buildings ruleset file
     * @return {@code true} if the file was parsed without errors
     */
    public boolean loadBuildings(String path) {
        // TODO: parse SectionFile and populate improvements list
        System.out.println("Loading buildings from: " + path);
        return true;
    }

    /**
     * Loads technology (advance) definitions from the specified ruleset file path.
     * Populates tech names, research costs, prerequisites, and help text.
     *
     * @param path the file-system path to the techs ruleset file
     * @return {@code true} if the file was parsed without errors
     */
    public boolean loadTechnologies(String path) {
        // TODO: parse SectionFile and populate technologies list
        System.out.println("Loading technologies from: " + path);
        return true;
    }

    /**
     * Loads terrain type definitions from the specified ruleset file path.
     * Populates movement costs, defence bonuses, food/production/trade yields,
     * and transformation targets.
     *
     * @param path the file-system path to the terrain ruleset file
     * @return {@code true} if the file was parsed without errors
     */
    public boolean loadTerrains(String path) {
        // TODO: parse SectionFile and populate terrains list
        System.out.println("Loading terrains from: " + path);
        return true;
    }

    /**
     * Loads government type definitions from the specified ruleset file path.
     * Populates government names, corruption rates, unit upkeep rules,
     * and associated effects.
     *
     * @param path the file-system path to the governments ruleset file
     * @return {@code true} if the file was parsed without errors
     */
    public boolean loadGovernments(String path) {
        // TODO: parse SectionFile and populate governments list
        System.out.println("Loading governments from: " + path);
        return true;
    }

    /**
     * Returns the name of the currently loaded ruleset.
     *
     * @return the ruleset name, or {@code null} if no ruleset has been loaded
     */
    public String getRulesetName() {
        return rulesetName;
    }

    /**
     * Returns whether a ruleset has been fully loaded and is ready for use.
     *
     * @return {@code true} if {@link #loadRuleset(String)} completed successfully
     */
    public boolean isLoaded() {
        return loaded;
    }

    /** @return the list of unit type definitions loaded from the ruleset */
    public List<UnitType> getUnitTypes() { return unitTypes; }

    /** @return the list of technology definitions loaded from the ruleset */
    public List<Technology> getTechnologies() { return technologies; }

    /** @return the list of improvement definitions loaded from the ruleset */
    public List<Improvement> getImprovements() { return improvements; }

    /** @return the list of terrain type definitions loaded from the ruleset */
    public List<Terrain> getTerrains() { return terrains; }

    /** @return the list of government type definitions loaded from the ruleset */
    public List<Government> getGovernments() { return governments; }

    /** @return the list of nation definitions loaded from the ruleset */
    public List<Nation> getNations() { return nations; }
}
