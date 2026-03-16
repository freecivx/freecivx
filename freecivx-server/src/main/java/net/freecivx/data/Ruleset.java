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

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Loads and manages ruleset data from {@code .ruleset} configuration files.
 * Mirrors the functionality of server/ruleset.c in the C Freeciv server.
 * A ruleset defines the game rules: available units, technologies, buildings,
 * terrain types, governments, and nations.  The server must call
 * {@link #loadRuleset(String)} before starting a game.
 *
 * <p>The ruleset files use an INI-style format with:
 * <ul>
 *   <li>Section headers: {@code [section_name]}</li>
 *   <li>Key-value pairs: {@code key = value}</li>
 *   <li>Translatable strings: {@code _("text")} or {@code _("?context:text")}</li>
 *   <li>Comments: lines starting with {@code ;} or {@code #}</li>
 *   <li>Multi-line table blocks: {@code { col1, col2\n val1, val2\n }}</li>
 * </ul>
 */
public class Ruleset {

    private static final Logger log = LoggerFactory.getLogger(Ruleset.class);

    private String rulesetName;
    private boolean loaded = false;

    private List<UnitType> unitTypes = new ArrayList<>();
    private List<Technology> technologies = new ArrayList<>();
    private List<Improvement> improvements = new ArrayList<>();
    private List<Terrain> terrains = new ArrayList<>();
    private List<Government> governments = new ArrayList<>();
    private List<Nation> nations = new ArrayList<>();

    /**
     * Loads the complete ruleset with the given name from classpath resources.
     * Reads all sub-files (units, buildings, techs, terrains, governments,
     * nations) from the standard ruleset directory and populates the
     * internal data lists.
     *
     * @param rulesetName the name of the ruleset to load (e.g. "civ2civ3", "classic")
     * @return {@code true} if all sub-files were loaded successfully
     */
    public boolean loadRuleset(String rulesetName) {
        this.rulesetName = rulesetName;
        String basePath = rulesetName + "/";

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
     * Loads nation definitions from the specified ruleset resource path.
     * Nations are kept as stubs since the full nation list is managed
     * separately via nation/*.ruleset files.
     *
     * @param path classpath-relative path to the nations ruleset file
     * @return {@code true} always (nations are optional)
     */
    public boolean loadNations(String path) {
        return true;
    }

    /**
     * Loads the ordered list of city names for a nation from its individual
     * ruleset file located at {@code nation/<nationKey>.ruleset} on the
     * classpath.  Terrain hints (e.g. {@code "(river)"}, {@code "(ocean)"})
     * are stripped so that only the bare city name is returned.
     *
     * <p>Mirrors the C server's {@code nation_cities()} data populated by
     * {@code load_ruleset_nations()} in {@code server/ruleset.c}.
     *
     * @param nationKey lowercase nation ruleset file base name, e.g.
     *                  {@code "french"}, {@code "soviet"}, {@code "german"}
     * @return ordered list of city names; empty if the file cannot be found
     */
    public List<String> loadNationCityNames(String nationKey) {
        String path = "nation/" + nationKey + ".ruleset";
        InputStream is = openResource(path);
        if (is == null) return new ArrayList<>();

        List<String> cityNames = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, "UTF-8"))) {
            boolean inCities = false;
            String line;
            while ((line = reader.readLine()) != null) {
                line = stripComment(line).trim();
                if (line.isEmpty()) continue;

                // A new section header always ends the cities block.
                if (line.startsWith("[") && line.endsWith("]")) {
                    if (inCities) break;
                    continue;
                }

                if (!inCities) {
                    if (line.startsWith("cities")) {
                        int eq = line.indexOf('=');
                        if (eq >= 0) {
                            inCities = true;
                            String rest = line.substring(eq + 1).trim();
                            if (!rest.isEmpty()) {
                                extractCityNamesFromLine(rest, cityNames);
                            }
                        }
                    }
                } else {
                    // End the cities block when we encounter a new key assignment.
                    // A key-value line starts with a word followed by optional spaces
                    // and then '=', before any opening quote character.
                    int eqPos    = line.indexOf('=');
                    int quotePos = line.indexOf('"');
                    if (eqPos >= 0 && (quotePos < 0 || eqPos < quotePos)) {
                        break;
                    }
                    extractCityNamesFromLine(line, cityNames);
                }
            }
        } catch (IOException e) {
            log.error("Error reading nation city names from {}: {}", path, e.getMessage());
        }
        return cityNames;
    }

    /**
     * Extracts all quoted city names from a single ruleset line, stripping
     * terrain hints enclosed in parentheses.
     * Example: {@code "Lyon (river)",} → adds {@code "Lyon"}.
     */
    private void extractCityNamesFromLine(String line, List<String> cityNames) {
        int pos = 0;
        while (pos < line.length()) {
            int start = line.indexOf('"', pos);
            if (start < 0) break;
            int end = line.indexOf('"', start + 1);
            if (end < 0) break;
            String name = line.substring(start + 1, end);
            // Strip terrain hints: "Lyon (river)" -> "Lyon"
            int parenIdx = name.indexOf('(');
            if (parenIdx >= 0) {
                name = name.substring(0, parenIdx).trim();
            }
            if (!name.isEmpty()) {
                cityNames.add(name);
            }
            pos = end + 1;
        }
    }

    /**
     * Loads unit type definitions from the specified classpath resource.
     * Parses every {@code [unit_*]} section to extract name, graphic,
     * build cost, attack/defence strengths, hit points, move rate, and
     * unit class (domain: land/sea/air).
     *
     * @param path classpath-relative path to the units ruleset file
     * @return {@code true} if the file was parsed without errors
     */
    public boolean loadUnits(String path) {
        InputStream is = openResource(path);
        if (is == null) return false;
        try {
            List<RuleSection> sections = parseSections(is);
            String defaultActions =
                    "000000000000000000000000000010000000001110001000000000000011011111111001100011000000001100110000000000000000100100000000";
            String settlerActions =
                    "000000000000000000000000000110000000001110001000000000000011011111111001100011000000001100110000000000000000100100000000";
            for (RuleSection sec : sections) {
                if (!sec.title.startsWith("unit_")) continue;
                String name = sec.get("name");
                if (name.isEmpty()) continue;
                String graphic   = sec.get("graphic");
                int    buildCost = sec.getInt("build_cost", 30);
                int    attack    = sec.getInt("attack", 0);
                int    defense   = sec.getInt("defense", 1);
                int    hp        = sec.getInt("hitpoints", 10);
                int    moveRate  = sec.getInt("move_rate", 1);
                int    firepower = sec.getInt("firepower", 1);
                int    popCost   = sec.getInt("pop_cost", 0);
                int    visionRadiusSq = sec.getInt("vision_radius_sq", 2);
                String unitClass = sec.get("class");
                int    domain    = classToDomain(unitClass);
                String flags     = sec.get("flags");
                boolean isSettler = flags.contains("Settlers") || flags.contains("Cities");
                boolean hasHorse  = flags.contains("Horse");
                boolean isNonMil  = flags.contains("NonMil");
                String actions = isSettler ? settlerActions : defaultActions;
                UnitType ut = new UnitType(name, graphic, moveRate, hp, 1, name,
                        attack, defense, actions, domain, buildCost);
                ut.setFirepower(firepower);
                ut.setPopCost(popCost);
                ut.setHasHorseFlag(hasHorse);
                ut.setNonMilitary(isNonMil);
                ut.setHasSettlersFlag(isSettler);
                ut.setVisionRadiusSq(visionRadiusSq);
                // Anti-horse defense multiplier: DefenseMultiplier=1 → factor=2 (double defense)
                if (sec.antiHorseBonus > 0) {
                    ut.setAntiHorseFactor(1 + sec.antiHorseBonus);
                }
                // Parse obsolete_by: the unit type name this unit upgrades to.
                // Resolved to an integer ID in Game.populateFromRuleset().
                // Mirrors the obsolete_by field in the C Freeciv units ruleset.
                String obsoletedBy = sec.get("obsolete_by");
                if (obsoletedBy != null && !obsoletedBy.isEmpty() && !"None".equals(obsoletedBy)) {
                    ut.setObsoletedByName(obsoletedBy);
                }
                // Parse tech requirement: the first Tech entry in the reqs table.
                // Resolved to a tech ID in Game.populateFromRuleset().
                String techReq = sec.getTechReq();
                if (techReq != null && !techReq.isEmpty()) {
                    ut.setTechReqName(techReq);
                }
                unitTypes.add(ut);
            }
            log.info("Loaded {} unit types from {}", unitTypes.size(), path);
            return true;
        } catch (IOException e) {
            log.error("Error loading units from {}: {}", path, e.getMessage());
            return false;
        }
    }

    /**
     * Loads building (city improvement) definitions from the specified
     * classpath resource.  Parses every {@code [building_*]} section to
     * extract name, genus, graphic, build cost, upkeep, sabotage chance,
     * and the first technology prerequisite listed in the {@code reqs} table.
     *
     * @param path classpath-relative path to the buildings ruleset file
     * @return {@code true} if the file was parsed without errors
     */
    public boolean loadBuildings(String path) {
        InputStream is = openResource(path);
        if (is == null) return false;
        try {
            List<RuleSection> sections = parseSections(is);
            long id = 0;
            for (RuleSection sec : sections) {
                if (!sec.title.startsWith("building_")) continue;
                String name = sec.get("name");
                if (name.isEmpty()) continue;
                String graphic   = sec.get("graphic");
                String genusStr  = sec.get("genus");
                int    genus     = genusToInt(genusStr);
                int    buildCost = sec.getInt("build_cost", 60);
                int    upkeep    = sec.getInt("upkeep", 1);
                int    sabotage  = sec.getInt("sabotage", 100);
                // techReqId is stored as -1 (no requirement) since tech IDs are
                // assigned after buildings are loaded; tech prerequisites are
                // available via RuleSection.getTechReq() for name-based checks.
                Improvement impr = new Improvement(id, name, name, graphic, graphic + "_alt",
                        genus, buildCost, upkeep, sabotage,
                        "b_" + sec.title.replace("building_", ""),
                        "b_fallback", name, -1);
                // Store the tech requirement name so Game.populateFromRuleset() can
                // resolve it to an ID after all technologies have been loaded.
                if (!sec.techReq.isEmpty()) {
                    impr.setTechReqName(sec.techReq);
                }
                // Store the obsolete-by tech name parsed from the obsolete_by table.
                // Resolved to a player-level check in CityTurn.removeObsoleteBuildingsForPlayer().
                if (!sec.obsoleteTechName.isEmpty()) {
                    impr.setObsoletedByTechName(sec.obsoleteTechName);
                }
                // Store the city-building prerequisite parsed from the reqs table.
                // Mirrors "Building"/"City" requirement rows in the C Freeciv server's
                // buildings ruleset (e.g. Cathedral requires Temple, Bank requires Marketplace).
                if (!sec.reqBuildingName.isEmpty()) {
                    impr.setRequiredBuildingName(sec.reqBuildingName);
                }
                // Store the coastal requirement parsed from the reqs table.
                // Mirrors "TerrainClass"/"Oceanic"/"Adjacent" rows (e.g. Harbor, Port Facility).
                if (sec.reqCoastal) {
                    impr.setRequiresCoastal(true);
                }
                improvements.add(impr);
                id++;
            }
            log.info("Loaded {} buildings from {}", improvements.size(), path);
            return true;
        } catch (IOException e) {
            log.error("Error loading buildings from {}: {}", path, e.getMessage());
            return false;
        }
    }

    /**
     * Loads technology (advance) definitions from the specified classpath
     * resource.  Parses every {@code [advance_*]} section to extract name,
     * graphic tag, prerequisite technologies, and optional research cost.
     *
     * @param path classpath-relative path to the techs ruleset file
     * @return {@code true} if the file was parsed without errors
     */
    public boolean loadTechnologies(String path) {
        InputStream is = openResource(path);
        if (is == null) return false;
        try {
            List<RuleSection> sections = parseSections(is);
            for (RuleSection sec : sections) {
                if (!sec.title.startsWith("advance_")) continue;
                String name = sec.get("name");
                if (name.isEmpty()) continue;
                String graphic = sec.get("graphic");
                String req1    = sec.get("req1");
                String req2    = sec.get("req2");
                int    cost    = sec.getInt("cost", 0);
                if (req1.isEmpty()) req1 = "None";
                if (req2.isEmpty()) req2 = "None";
                technologies.add(new Technology(name, graphic, name, req1, req2, cost));
            }
            log.info("Loaded {} technologies from {}", technologies.size(), path);
            return true;
        } catch (IOException e) {
            log.error("Error loading technologies from {}: {}", path, e.getMessage());
            return false;
        }
    }

    /**
     * Loads terrain type definitions from the specified classpath resource.
     * Parses every {@code [terrain_*]} section to extract name, graphic tag,
     * movement cost, defence bonus, and tile output values (food, shield, trade,
     * irrigation food bonus, mining shield bonus, road trade bonus).
     *
     * @param path classpath-relative path to the terrain ruleset file
     * @return {@code true} if the file was parsed without errors
     */
    public boolean loadTerrains(String path) {
        InputStream is = openResource(path);
        if (is == null) return false;
        try {
            List<RuleSection> sections = parseSections(is);
            for (RuleSection sec : sections) {
                if (!sec.title.startsWith("terrain_")) continue;
                String name       = sec.get("name");
                if (name.isEmpty()) continue;
                String graphic    = sec.get("graphic");
                int    moveCost   = sec.getInt("movement_cost", 1);
                int    defBonus   = sec.getInt("defense_bonus", 0);
                int    food       = sec.getInt("food", 0);
                int    shield     = sec.getInt("shield", 0);
                int    trade      = sec.getInt("trade", 0);
                int    irrigFood  = sec.getInt("irrigation_food_incr", 0);
                int    mineShield = sec.getInt("mining_shield_incr", 0);
                // road_trade_incr_pct > 0 means the road gives +1 trade on this terrain
                // (e.g. Grassland, Plains, Desert in the classic ruleset).
                int    roadTradePct = sec.getInt("road_trade_incr_pct", 0);
                int    roadTrade  = roadTradePct > 0 ? 1 : 0;
                terrains.add(new Terrain(name, graphic, defBonus, moveCost,
                        food, shield, trade, irrigFood, mineShield, roadTrade));
            }
            log.info("Loaded {} terrains from {}", terrains.size(), path);
            return true;
        } catch (IOException e) {
            log.error("Error loading terrains from {}: {}", path, e.getMessage());
            return false;
        }
    }

    /**
     * Loads government type definitions from the specified classpath resource.
     * Parses every {@code [government_*]} section to extract name, graphic tag,
     * and the first technology prerequisite from the {@code reqs} table.
     * Corruption percentages are assigned from the classic ruleset's
     * {@code effects.ruleset} {@code Output_Waste} base values:
     * Anarchy=25, Despotism=37, Monarchy=15, Communism=20, Republic=15, Democracy=0.
     *
     * @param path classpath-relative path to the governments ruleset file
     * @return {@code true} if the file was parsed without errors
     */
    public boolean loadGovernments(String path) {
        InputStream is = openResource(path);
        if (is == null) return false;
        try {
            List<RuleSection> sections = parseSections(is);
            for (RuleSection sec : sections) {
                if (!sec.title.startsWith("government_")) continue;
                String name    = sec.get("name");
                if (name.isEmpty()) continue;
                String techReq = sec.getTechReq();
                if (techReq.isEmpty()) techReq = null;
                int corruptionPct = corruptionForGov(name);
                governments.add(new Government(name, name, name, techReq, corruptionPct));
            }
            log.info("Loaded {} governments from {}", governments.size(), path);
            return true;
        } catch (IOException e) {
            log.error("Error loading governments from {}: {}", path, e.getMessage());
            return false;
        }
    }

    /**
     * Returns the base corruption percentage for a government type, derived from
     * the {@code Output_Waste} base values in the classic Freeciv
     * {@code effects.ruleset}:
     * <ul>
     *   <li>Anarchy: 25</li>
     *   <li>Despotism: 37</li>
     *   <li>Monarchy: 15</li>
     *   <li>Communism: 20</li>
     *   <li>Republic: 15</li>
     *   <li>Democracy: 0</li>
     * </ul>
     *
     * @param govName the government name as loaded from the ruleset
     * @return the base corruption percentage (0–100)
     */
    private static int corruptionForGov(String govName) {
        if (govName == null) return 0;
        return switch (govName.toLowerCase()) {
            case "anarchy"         -> 25;
            case "despotism"       -> 37;
            case "monarchy"        -> 15;
            case "communism"       -> 20;
            case "republic"        -> 15;
            case "fundamentalism"  -> 15;
            default                ->  0; // Democracy and any unknown gov = no corruption
        };
    }

    // -----------------------------------------------------------------------
    // Internal parsing helpers
    // -----------------------------------------------------------------------

    /** Opens a classpath resource; logs and returns {@code null} on failure. */
    private InputStream openResource(String path) {
        InputStream is = getClass().getClassLoader().getResourceAsStream(path);
        if (is == null) {
            log.error("Ruleset resource not found: {}", path);
        }
        return is;
    }

    /**
     * Lightweight representation of one {@code [section_name]} block from a
     * {@code .ruleset} file.  Stores plain key→value pairs extracted after
     * stripping {@code _(\"...\")} wrappers and surrounding quotes.
     * Also records the tech name from the first {@code "Tech"} row in any
     * {@code reqs} table, and the anti-horse defense multiplier from the
     * {@code bonuses} table.
     */
    static class RuleSection {
        final String title;
        final Map<String, String> entries = new LinkedHashMap<>();
        String techReq = "";
        /**
         * Technology name read from the first {@code "Tech"} / {@code "Player"} row
         * of the {@code obsolete_by} table.  Empty string means no tech obsoletes
         * this building for its owner.
         */
        String obsoleteTechName = "";
        /**
         * Name of the city improvement required before this one can be built,
         * parsed from the first {@code "Building"} / {@code "City"} row of the
         * {@code reqs} table.  Empty string means no building prerequisite.
         * Mirrors {@code can_city_build_improvement_direct()} in the C server.
         */
        String reqBuildingName = "";
        /**
         * Whether this section requires the city to be coastal
         * ({@code "TerrainClass", "Oceanic", "Adjacent"} row in the reqs table).
         * Mirrors the TerrainClass requirement in the C Freeciv server's
         * {@code can_city_build_improvement_direct()} in {@code common/city.c}.
         */
        boolean reqCoastal = false;
        /** Anti-horse defense multiplier bonus from the bonuses table (0 = none). */
        int antiHorseBonus = 0;

        RuleSection(String title) {
            this.title = title;
        }

        /** Returns the value for {@code key}, or an empty string if absent. */
        String get(String key) {
            return entries.getOrDefault(key, "");
        }

        /** Returns the integer value for {@code key}, or {@code def} if absent/unparseable. */
        int getInt(String key, int def) {
            String v = entries.get(key);
            if (v == null || v.isEmpty()) return def;
            try { return Integer.parseInt(v); } catch (NumberFormatException e) { return def; }
        }

        /**
         * Returns the technology prerequisite name extracted from this section's
         * {@code reqs} table (the {@code name} column of the first row whose
         * {@code type} column equals {@code "Tech"}).  Returns an empty string
         * when there is no tech requirement.
         */
        String getTechReq() {
            return techReq;
        }
    }

    /**
     * Parses a {@code .ruleset} file into a list of {@link RuleSection} objects.
     *
     * <p>The parser handles:
     * <ul>
     *   <li>Line comments starting with {@code ;} or {@code #}</li>
     *   <li>Translatable strings: {@code _("text")} or {@code _("?ctx:text")}</li>
     *   <li>Quoted string values: {@code "value"}</li>
     *   <li>Multi-line string continuation via trailing {@code \}</li>
     *   <li>Inline table blocks: {@code key = { col1, col2\n val1, val2\n }}</li>
     *   <li>Table blocks where {@code {} appears on its own line after {@code key =}</li>
     * </ul>
     *
     * @param is the input stream of a ruleset file (UTF-8 encoded)
     * @return ordered list of parsed sections
     * @throws IOException on read errors
     */
    static List<RuleSection> parseSections(InputStream is) throws IOException {
        List<RuleSection> sections = new ArrayList<>();
        RuleSection current = null;
        boolean inTable = false;
        boolean pendingTable = false;
        String pendingKey = null;
        List<String> tableColumns = null;

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(is, "UTF-8"))) {
            String line;
            while ((line = reader.readLine()) != null) {
                // Handle backslash line continuation (multi-line helptext etc.)
                while (line.endsWith("\\")) {
                    String next = reader.readLine();
                    if (next == null) break;
                    line = line.substring(0, line.length() - 1) + " " + next;
                }

                line = stripComment(line).trim();
                if (line.isEmpty()) continue;

                // Section header: [section_name]
                if (line.startsWith("[") && line.endsWith("]")) {
                    current = new RuleSection(line.substring(1, line.length() - 1));
                    sections.add(current);
                    inTable = false;
                    pendingTable = false;
                    pendingKey = null;
                    tableColumns = null;
                    continue;
                }

                if (current == null) continue;

                // Table end
                if (line.equals("}")) {
                    inTable = false;
                    pendingTable = false;
                    pendingKey = null;
                    continue;
                }

                // Table row
                if (inTable) {
                    // Only capture tech requirements from the "reqs" table,
                    // not from "obsolete_by" or other tables.
                    if ("reqs".equals(pendingKey) && tableColumns != null && !tableColumns.isEmpty()) {
                        String[] cells = splitCsv(line);
                        if (cells.length >= 2) {
                            String type = stripQuotes(cells[0]);
                            if ("Tech".equalsIgnoreCase(type)) {
                                if (current.techReq.isEmpty()) {
                                    current.techReq = stripQuotes(cells[1]);
                                }
                            }
                            // Also capture the first city-scoped Building requirement.
                            // Mirrors "Building"/"City" rows in the C Freeciv buildings ruleset
                            // (e.g. Cathedral requires Temple, Bank requires Marketplace).
                            if ("Building".equalsIgnoreCase(type) && cells.length >= 3) {
                                String range = stripQuotes(cells[2]);
                                if ("City".equalsIgnoreCase(range) && current.reqBuildingName.isEmpty()) {
                                    current.reqBuildingName = stripQuotes(cells[1]);
                                }
                            }
                            // Capture coastal requirement: TerrainClass=Oceanic, range=Adjacent.
                            // Mirrors the TerrainClass requirement check used by Harbor, Coastal
                            // Defense, Port Facility, Offshore Platform, etc. in the C Freeciv
                            // server's can_city_build_improvement_direct() in common/city.c.
                            if ("TerrainClass".equalsIgnoreCase(type) && cells.length >= 3) {
                                String name = stripQuotes(cells[1]);
                                String range = stripQuotes(cells[2]);
                                if ("Oceanic".equalsIgnoreCase(name) && "Adjacent".equalsIgnoreCase(range)) {
                                    current.reqCoastal = true;
                                }
                            }
                        }
                    }
                    // Capture the technology that obsoletes this building from the
                    // "obsolete_by" table, but only for "Player" range entries.
                    // Mirrors the Tech-type "Player"-range rows in the C Freeciv server's
                    // buildings ruleset (e.g. Barracks obsoleted by Gunpowder).
                    // "World"-range entries (wonder replacements) are not handled here.
                    if ("obsolete_by".equals(pendingKey) && tableColumns != null && !tableColumns.isEmpty()) {
                        String[] cells = splitCsv(line);
                        if (cells.length >= 3) {
                            String type  = stripQuotes(cells[0]);
                            String range = stripQuotes(cells[2]);
                            if ("Tech".equalsIgnoreCase(type) && "Player".equalsIgnoreCase(range)) {
                                if (current.obsoleteTechName.isEmpty()) {
                                    current.obsoleteTechName = stripQuotes(cells[1]);
                                }
                            }
                        }
                    }
                    // Capture anti-horse defense bonus from the "bonuses" table.
                    // Rows: "flag", "type", "value" — look for Horse/DefenseMultiplier entries.
                    // Mirrors the Pikemen bonuses = { "Horse", "DefenseMultiplier", 1 } in
                    // the classic Freeciv units ruleset.
                    if ("bonuses".equals(pendingKey) && tableColumns != null && !tableColumns.isEmpty()) {
                        String[] cells = splitCsv(line);
                        if (cells.length >= 3) {
                            String flag = stripQuotes(cells[0]);
                            String type = stripQuotes(cells[1]);
                            if ("Horse".equalsIgnoreCase(flag) && "DefenseMultiplier".equalsIgnoreCase(type)) {
                                try {
                                    current.antiHorseBonus += Integer.parseInt(cells[2].trim());
                                } catch (NumberFormatException ignored) {}
                            }
                        }
                    }
                    continue;
                }

                // Standalone '{' opens the table started by the previous 'key ='
                if (pendingTable && line.startsWith("{")) {
                    inTable = true;
                    pendingTable = false;
                    String colStr = line.substring(1).trim();
                    tableColumns = colStr.isEmpty() ? new ArrayList<>() : splitColumnsFromHeader(colStr);
                    continue;
                }

                // Key = value
                int eqIdx = line.indexOf('=');
                if (eqIdx < 0) continue;

                String key = line.substring(0, eqIdx).trim();
                String rawValue = line.substring(eqIdx + 1).trim();

                if (rawValue.startsWith("{")) {
                    // Inline table opening: key = { col1, col2 ...
                    inTable = true;
                    pendingTable = false;
                    pendingKey = key;
                    String colStr = rawValue.substring(1).trim();
                    tableColumns = colStr.isEmpty() ? new ArrayList<>() : splitColumnsFromHeader(colStr);
                } else if (rawValue.isEmpty()) {
                    // Table block starts on the next non-empty line
                    pendingTable = true;
                    pendingKey = key;
                } else {
                    current.entries.put(key, extractValue(rawValue));
                }
            }
        }
        return sections;
    }

    /**
     * Strips a trailing inline comment from {@code line}.
     * Semicolons inside quoted strings are not treated as comment markers.
     * Full-line comments (lines starting with {@code ;} or {@code #}) are
     * reduced to an empty string.
     */
    static String stripComment(String line) {
        boolean inQuote = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                inQuote = !inQuote;
            } else if (!inQuote && (c == ';' || c == '#')) {
                return line.substring(0, i);
            }
        }
        return line;
    }

    /**
     * Extracts a plain string from a raw ruleset value.
     * <ul>
     *   <li>{@code _("?ctx:text")} → {@code text}</li>
     *   <li>{@code _("text")} → {@code text}</li>
     *   <li>{@code "text"} → {@code text}</li>
     *   <li>Numeric or unquoted values → unchanged</li>
     * </ul>
     */
    static String extractValue(String raw) {
        if (raw == null) return "";
        raw = raw.trim();
        // _("?context:text") or _("text")
        if (raw.startsWith("_(\"")) {
            int start = 3;
            if (start < raw.length() && raw.charAt(start) == '?') {
                int colon = raw.indexOf(':', start);
                if (colon >= 0) start = colon + 1;
            }
            int end = raw.indexOf('"', start);
            return end >= start ? raw.substring(start, end) : raw;
        }
        // "text"
        if (raw.startsWith("\"") && raw.length() > 1) {
            int end = raw.indexOf('"', 1);
            return end > 0 ? raw.substring(1, end) : raw;
        }
        return raw;
    }

    /** Strips surrounding double quotes from a token, e.g. {@code "Foo"} → {@code Foo}. */
    private static String stripQuotes(String s) {
        s = s.trim();
        if (s.startsWith("\"") && s.endsWith("\"") && s.length() >= 2) {
            return s.substring(1, s.length() - 1);
        }
        return s;
    }

    /**
     * Splits a CSV line (table row in a ruleset) into individual cell tokens.
     * Handles cells wrapped in double quotes.
     */
    static String[] splitCsv(String line) {
        List<String> result = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuote = false;
        for (char c : line.toCharArray()) {
            if (c == '"') {
                inQuote = !inQuote;
                current.append(c);
            } else if (c == ',' && !inQuote) {
                result.add(current.toString().trim());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        if (!current.isEmpty()) result.add(current.toString().trim());
        return result.toArray(new String[0]);
    }

    /**
     * Parses column-header tokens from the text following the opening {@code {}
     * of a table block, stopping at the first {@code }} (if any) on the same
     * line.
     */
    private static List<String> splitColumnsFromHeader(String colStr) {
        // Strip optional closing } on the same line
        int close = colStr.indexOf('}');
        if (close >= 0) colStr = colStr.substring(0, close);
        List<String> cols = new ArrayList<>();
        for (String c : colStr.split(",")) {
            String t = stripQuotes(c.trim());
            if (!t.isEmpty()) cols.add(t);
        }
        return cols;
    }

    /**
     * Maps a Freeciv unit class name to the integer domain used by
     * {@link UnitType}: 0 = Land, 1 = Sea / Trireme, 2 = Air / Helicopter / Missile.
     */
    private static int classToDomain(String cls) {
        if (cls == null) return 0;
        return switch (cls.toLowerCase()) {
            case "sea", "trireme"                  -> 1;
            case "air", "helicopter", "missile"    -> 2;
            default                                 -> 0;
        };
    }

    /**
     * Maps the {@code genus} string from a building section to the integer
     * used by {@link Improvement}: 0 = GreatWonder, 1 = SmallWonder,
     * 2 = Improvement, 3 = Special.
     */
    private static int genusToInt(String genus) {
        if (genus == null) return 2;
        return switch (genus.toLowerCase()) {
            case "greatwonder" -> 0;
            case "smallwonder" -> 1;
            case "special"     -> 3;
            default            -> 2;
        };
    }

    // -----------------------------------------------------------------------
    // Public accessors
    // -----------------------------------------------------------------------

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
