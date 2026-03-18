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

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Loads and parses Freeciv scenario savegame ({@code .sav}) files from
 * classpath resources and returns a {@link ScenarioData} describing the map.
 *
 * <p>Only the subset of the savegame format required to reconstruct the map
 * is parsed:
 * <ul>
 *   <li>{@code [savefile]} section – {@code terrident} table mapping single
 *       characters to terrain names.</li>
 *   <li>{@code [settings]} section – {@code xsize} and {@code ysize} values
 *       from the {@code set} table.</li>
 *   <li>{@code [map]} section – {@code t####} terrain-row strings.</li>
 * </ul>
 */
public class ScenarioLoader {

    private static final Logger log = LoggerFactory.getLogger(ScenarioLoader.class);

    private static final Pattern TERRAIN_ROW_PATTERN =
            Pattern.compile("^t(\\d{4})=\"(.*)\"$");

    /**
     * Loads and parses the scenario at the given classpath resource path.
     *
     * @param resourcePath classpath path, e.g. {@code "scenarios/earth-small.sav"}
     * @return parsed {@link ScenarioData}, or {@code null} if the resource
     *         could not be found or contained no usable map data
     */
    public ScenarioData loadScenario(String resourcePath) {
        InputStream is = getClass().getClassLoader().getResourceAsStream(resourcePath);
        if (is == null) {
            log.error("Scenario not found on classpath: {}", resourcePath);
            return null;
        }
        try (BufferedReader reader =
                     new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            return parse(resourcePath, reader);
        } catch (IOException e) {
            log.error("Error reading scenario {}: {}", resourcePath, e.getMessage());
            return null;
        }
    }

    // -----------------------------------------------------------------------
    // Internal parser
    // -----------------------------------------------------------------------

    private ScenarioData parse(String resourcePath, BufferedReader reader) throws IOException {
        ScenarioData data = new ScenarioData();
        Map<Character, String> terrainIdents = new HashMap<>();
        TreeMap<Integer, String> terrainRowMap = new TreeMap<>();

        String section = "";
        boolean inTerrident  = false;   // inside terrident={...} block
        boolean inSettingsSet = false;  // inside set={...} block in [settings]
        boolean inMap = false;          // inside [map] section

        String line;
        while ((line = reader.readLine()) != null) {

            // Section header
            if (line.startsWith("[") && line.contains("]")) {
                section = line.substring(1, line.indexOf(']')).toLowerCase();
                inTerrident   = false;
                inSettingsSet = false;
                inMap         = "map".equals(section);
                continue;
            }

            // Skip blank lines and comments
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith(";") || trimmed.startsWith("#")) {
                continue;
            }

            // ---- [savefile] – terrident table ----
            if ("savefile".equals(section)) {
                if (trimmed.startsWith("terrident=")) {
                    inTerrident = true;
                    continue;
                }
                if (inTerrident) {
                    if (trimmed.startsWith("}")) {
                        inTerrident = false;
                    } else {
                        parseTerridentRow(trimmed, terrainIdents);
                    }
                    continue;
                }
            }

            // ---- [settings] – look for xsize / ysize in set table ----
            if ("settings".equals(section)) {
                if (trimmed.startsWith("set={")) {
                    inSettingsSet = true;
                    continue;
                }
                if (inSettingsSet) {
                    if (trimmed.startsWith("}")) {
                        inSettingsSet = false;
                    } else {
                        parseSettingsRow(trimmed, data);
                    }
                    continue;
                }
            }

            // ---- [map] – terrain rows t####="..." ----
            if (inMap) {
                Matcher m = TERRAIN_ROW_PATTERN.matcher(line);
                if (m.matches()) {
                    int rowNum = Integer.parseInt(m.group(1));
                    terrainRowMap.put(rowNum, m.group(2));
                }
            }
        }

        // Validate that we got something useful
        if (terrainRowMap.isEmpty()) {
            log.error("Scenario {}: no terrain rows found.", resourcePath);
            return null;
        }
        // Infer dimensions if not explicitly found in settings
        if (data.ysize <= 0) {
            data.ysize = terrainRowMap.lastKey() + 1;
        }
        if (data.xsize <= 0 && !terrainRowMap.isEmpty()) {
            data.xsize = terrainRowMap.firstEntry().getValue().length();
        }

        // Build the ordered terrainRows array
        data.terrainRows = new String[data.ysize];
        for (Map.Entry<Integer, String> entry : terrainRowMap.entrySet()) {
            int row = entry.getKey();
            if (row < data.ysize) {
                data.terrainRows[row] = entry.getValue();
            }
        }
        data.terrainIdentifiers = terrainIdents;

        log.info("Parsed scenario: {} ({}x{})", resourcePath, data.xsize, data.ysize);
        return data;
    }

    /**
     * Parses one data row from the {@code terrident} table, e.g.:
     * <pre>"Grassland","g"</pre>
     * and adds the result to {@code out}.
     */
    private static void parseTerridentRow(String line,
                                          Map<Character, String> out) {
        // Expected format: "TerrainName","c"
        // The identifier may be a space, so we cannot simply split on ,
        // Strategy: split on the first ',' that is followed by '"' or just after
        // the closing quote of the name field.
        int nameStart = line.indexOf('"');
        if (nameStart < 0) return;
        int nameEnd = line.indexOf('"', nameStart + 1);
        if (nameEnd < 0) return;
        String name = line.substring(nameStart + 1, nameEnd);
        if (name.equals("name")) return; // header row

        // Find the identifier value: locate second pair of quotes
        int identStart = line.indexOf('"', nameEnd + 1);
        if (identStart < 0) return;
        int identEnd = line.indexOf('"', identStart + 1);
        if (identEnd < 0) return;
        String ident = line.substring(identStart + 1, identEnd);
        if (!ident.isEmpty()) {
            out.put(ident.charAt(0), name);
        }
    }

    /**
     * Parses one data row from the {@code set} table in {@code [settings]},
     * e.g.: {@code "xsize",80,80,"Changed"}, and sets {@code xsize} /
     * {@code ysize} in {@code data} when found.
     */
    private static void parseSettingsRow(String line, ScenarioData data) {
        // Format: "name",value,...
        int nameStart = line.indexOf('"');
        if (nameStart < 0) return;
        int nameEnd = line.indexOf('"', nameStart + 1);
        if (nameEnd < 0) return;
        String name = line.substring(nameStart + 1, nameEnd);

        if (!name.equals("xsize") && !name.equals("ysize")) return;

        // value is the first token after the closing quote + comma
        int valueStart = nameEnd + 2; // skip closing quote and comma
        if (valueStart >= line.length()) return;
        int valueEnd = line.indexOf(',', valueStart);
        String valueStr = valueEnd > 0
                ? line.substring(valueStart, valueEnd).trim()
                : line.substring(valueStart).trim();
        try {
            int value = Integer.parseInt(valueStr);
            if ("xsize".equals(name)) data.xsize = value;
            else                       data.ysize = value;
        } catch (NumberFormatException ignore) {
            // ignore malformed values
        }
    }
}
