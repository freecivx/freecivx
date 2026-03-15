/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.FreecivWorld.net/
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

import net.freecivx.server.CivServer;
import net.freecivx.server.CityTools;
import net.freecivx.server.Notify;
import net.freecivx.ai.AiPlayer;
import net.freecivx.data.Ruleset;
import net.freecivx.data.ScenarioData;
import net.freecivx.data.ScenarioLoader;
import org.json.JSONArray;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * The Game class
 */
public class Game {

    private static final Logger log = LoggerFactory.getLogger(Game.class);

    CivServer server;

    public long year = 0;
    public long turn = 0;
    public long phase = 0;
    boolean gameStarted = false;

    private static final int MAX_START_POSITION_ATTEMPTS = 200;
    private long lastActivityTime = System.currentTimeMillis();
    private Random random = new Random();
    private AiPlayer aiPlayer;
    private Ruleset ruleset = new Ruleset();
    /** Tracks which human players have pressed end-turn this turn. */
    private final Set<Long> humanPlayersDone = new HashSet<>();

    /**
     * Optional map generation seed.  When {@code >= 0} the same seed is
     * passed to {@link MapGenerator} so that the generated map is identical
     * across runs.  Mirrors the {@code mapseed} setting in the C Freeciv server.
     * Default {@code -1} produces a unique random map each game.
     */
    private int mapSeed = -1;

    /**
     * Turn timeout in seconds.  When {@code > 0} a turn is automatically
     * advanced after this many seconds even if not all human players have
     * pressed end-turn.  {@code 0} (default) disables the timer.
     * Mirrors the {@code timeout} setting in the C Freeciv server.
     */
    private int turnTimeout = 0;

    /**
     * Number of AI players to create when the game starts.
     * Mirrors the {@code aifill} setting in the C Freeciv server.
     * Default 4.
     */
    private int aifill = 4;

    /**
     * Starting gold awarded to every player when the game begins.
     * Mirrors the {@code gold} setting in the C Freeciv server's
     * game.settings (server_setting "gold").
     * Default 50.
     */
    private int initialGold = 50;

    /** Scheduler used to implement the per-turn {@link #turnTimeout}. */
    private final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "turn-timeout");
                t.setDaemon(true);
                return t;
            });

    /** Currently pending timeout task; {@code null} when no timeout is active. */
    private ScheduledFuture<?> turnTimeoutTask = null;

    public WorldMap map;
    public Map<Long, Player> players = new HashMap<>();
    public Map<Long, Unit> units = new HashMap<>();
    public Map<Long, City> cities = new HashMap<>();
    public Map<Long, Technology> techs = new HashMap<>();
    public Map<Long, Improvement> improvements = new HashMap<>();
    public Map<Long, Terrain> terrains = new HashMap<>();
    public Map<Long, Tile> tiles = new HashMap<>();
    public Map<Long, Government> governments = new HashMap<>();
    public Map<Long, Nation> nations = new HashMap<>();
    public Map<Long, Extra> extras = new HashMap<>();
    public Map<Long, UnitType> unitTypes = new HashMap<>();
    public Map<Long, CityStyle> cityStyle = new HashMap<>();
    public Map<Long, Connection> connections = new HashMap<>();

    public Game(CivServer server) {
        this.server = server;
        this.aiPlayer = new AiPlayer(this);
    }

    /** Returns the {@link CivServer} instance this game is running on. */
    public CivServer getServer() {
        return server;
    }

    /**
     * Sets the map generation seed for reproducible map generation.
     * Must be called before {@link #initGame()}.
     * Mirrors the {@code mapseed} setting in the C Freeciv server test script.
     *
     * @param seed the seed value; use {@code -1} for a unique random map
     */
    public void setMapSeed(int seed) {
        this.mapSeed = seed;
    }

    /**
     * Regenerates the map tiles using the given seed.  Unlike
     * {@link #setMapSeed(int)}, this method can be called <em>after</em>
     * {@link #initGame()} to replace the map that was generated during init.
     * Used by {@link net.freecivx.main.AutoGame} to apply a deterministic seed
     * when the game server has already initialised.
     *
     * @param seed the deterministic seed value
     */
    public void reinitializeMap(int seed) {
        this.mapSeed = seed;
        MapGenerator generator = new MapGenerator(map.getXsize(), map.getYsize(), seed);
        tiles = generator.generateMap();
    }

    /**
     * Sets the per-turn timeout.  When {@code > 0} the turn is automatically
     * advanced after this many seconds.  Set to {@code 0} to disable.
     * Mirrors the {@code timeout} setting in the C Freeciv server.
     *
     * @param seconds timeout value in seconds (0 = disabled, max 500)
     */
    public void setTurnTimeout(int seconds) {
        this.turnTimeout = seconds;
        // Re-arm the timer for the current turn if the game is already running.
        if (gameStarted) {
            cancelTurnTimeout();
            if (turnTimeout > 0) {
                scheduleTurnTimeout();
            }
        }
    }

    /** Returns the current turn timeout in seconds (0 = disabled). */
    public int getTurnTimeout() {
        return turnTimeout;
    }

    /**
     * Sets the number of AI players that will be created when the game starts.
     * Has no effect once the game has started.
     * Mirrors the {@code aifill} setting in the C Freeciv server.
     *
     * @param count number of AI players (0–9)
     */
    public void setAifill(int count) {
        this.aifill = count;
    }

    /** Returns the configured aifill value. */
    public int getAifill() {
        return aifill;
    }

    /**
     * Sets the starting gold that will be awarded to every player when the
     * game begins.  Also immediately updates the gold of all existing players
     * so the setting takes effect even if the game has already started.
     * Mirrors the {@code gold} setting in the C Freeciv server.
     *
     * @param gold starting gold amount (0–50 000)
     */
    public void setInitialGold(int gold) {
        this.initialGold = gold;
        // Apply immediately to all existing players.
        players.values().forEach(p -> p.setGold(gold));
    }

    /** Returns the configured initial gold value. */
    public int getInitialGold() {
        return initialGold;
    }

    /**
     * Converts the internal turn counter to the historical calendar year used
     * by the Freeciv protocol and the JavaScript client.
     * <p>
     * Classic Freeciv starts at 4000 BC (year = -4000) and advances 20 years
     * per turn.  The client's {@code handle_game_info()} / {@code get_year_string()}
     * expects a <em>negative</em> value for BC years and a <em>non-negative</em>
     * value for AD years, formatted together with the {@code calendar_info} labels.
     * Year 0 is treated as 0 AD (matching the JS client's {@code >= 0} branch).
     * <p>
     * Formula: {@code historicalYear = year * 20 - 4000}
     * <ul>
     *   <li>turn 0 (game start)  → -4000 (4000 BC)</li>
     *   <li>turn 1              → -3980 (3980 BC)</li>
     *   <li>turn 200            →     0 (0 AD, calendar boundary)</li>
     *   <li>turn 201            →    20 (20 AD)</li>
     * </ul>
     *
     * @return the historical calendar year matching the current internal {@link #year}
     */
    public long getHistoricalYear() {
        return year * 20L - 4000L;
    }

    /** Schedules a forced turn-end after {@link #turnTimeout} seconds. */
    private synchronized void scheduleTurnTimeout() {
        if (turnTimeout <= 0) return;
        turnTimeoutTask = scheduler.schedule(() -> {
            synchronized (Game.this) {
                humanPlayersDone.clear();
                turnDone();
            }
        }, turnTimeout, TimeUnit.SECONDS);
    }

    /** Cancels any pending turn-timeout task. */
    private synchronized void cancelTurnTimeout() {
        if (turnTimeoutTask != null) {
            turnTimeoutTask.cancel(false);
            turnTimeoutTask = null;
        }
    }

    /**
     * Initializes the game objects.  Game rules (unit types, technologies,
     * buildings, terrain, governments) are loaded from the classic ruleset
     * files bundled as classpath resources.  If ruleset loading fails the
     * game falls back to a minimal hardcoded dataset so the server remains
     * playable.
     */
    public void initGame() {
        map = new WorldMap(45, 45);

        // --- Load ruleset from classpath resources ---
        boolean rulesetOk = ruleset.loadRuleset("classic");
        if (rulesetOk) {
            populateFromRuleset();
        } else {
            log.error("Ruleset loading failed – falling back to hardcoded data.");
            populateFallback();
        }

        // Nations and extras are always hardcoded (not loaded from ruleset files).
        // City names are loaded from the matching nation/*.ruleset resource file.
        Nation nationSoviet  = new Nation("Soviet Union", "Soviet", "soviet",  "The Soviets!");
        Nation nationFrance  = new Nation("France",       "French", "france",  "Vive La France!");
        Nation nationGermany = new Nation("Germany",      "German", "germany", "Deutschland");
        nationSoviet .setCityNames(ruleset.loadNationCityNames("soviet"));
        nationFrance .setCityNames(ruleset.loadNationCityNames("french"));
        nationGermany.setCityNames(ruleset.loadNationCityNames("german"));
        nations.put(0L, nationSoviet);
        nations.put(1L, nationFrance);
        nations.put(2L, nationGermany);

        // EC_* cause bit values (matching fc_types.js / common/fc_types.h):
        //   EC_IRRIGATION=0 → 1, EC_MINE=1 → 2, EC_ROAD=2 → 4, EC_BASE=3 → 8,
        //   EC_POLLUTION=4 → 16, EC_FALLOUT=5 → 32, EC_HUT=6 → 64,
        //   EC_APPEARANCE=7 → 128, EC_RESOURCE=8 → 256
        final int EC_IRRIGATION  = 1;
        final int EC_MINE        = 2;
        final int EC_ROAD        = 4;
        final int EC_BASE        = 8;
        final int EC_POLLUTION   = 16;
        final int EC_FALLOUT     = 32;
        final int EC_HUT         = 64;
        final int EC_APPEARANCE  = 128;
        final int EC_RESOURCE    = 256;

        // Infrastructure / base extras (bits 0-14)
        extras.put(0L,  new Extra("River",      0,            null));
        extras.put(1L,  new Extra("Mine",        EC_MINE,      null));
        extras.put(2L,  new Extra("Oil_well",    EC_MINE,      null));
        extras.put(3L,  new Extra("Fallout",     EC_FALLOUT,   null));
        extras.put(4L,  new Extra("Pollution",   EC_POLLUTION, null));
        extras.put(5L,  new Extra("Buoy",        EC_BASE,      null));
        extras.put(6L,  new Extra("Road",        EC_ROAD,      null));
        extras.put(7L,  new Extra("Rail",        EC_ROAD,      null));
        extras.put(8L,  new Extra("Hut",         EC_HUT,       null));
        extras.put(9L,  new Extra("Irrigation",  EC_IRRIGATION, null));
        extras.put(10L, new Extra("Farmland",    EC_IRRIGATION, null));
        extras.put(11L, new Extra("Ruins",       EC_APPEARANCE, null));
        extras.put(12L, new Extra("Airbase",     EC_BASE,      null));
        extras.put(13L, new Extra("Airport",     0,            null));
        extras.put(14L, new Extra("Fortress",    EC_BASE,      null));

        // Resource extras (bits 15-25): EC_RESOURCE cause; graphic tags match the
        // classic Freeciv tileset (amplio2) so the 2D/3D map can draw them.
        // Bit positions must match MapGenerator.EXTRA_BIT_* constants.
        extras.put(15L, new Extra("Cattle",      EC_RESOURCE, "ts.cattle"));
        extras.put(16L, new Extra("Game",        EC_RESOURCE, "ts.game"));
        extras.put(17L, new Extra("Wheat",       EC_RESOURCE, "ts.wheat"));
        extras.put(18L, new Extra("Horses",      EC_RESOURCE, "ts.horses"));
        extras.put(19L, new Extra("Forest_Game", EC_RESOURCE, "ts.forest_game"));
        extras.put(20L, new Extra("Coal",        EC_RESOURCE, "ts.coal"));
        extras.put(21L, new Extra("Iron",        EC_RESOURCE, "ts.iron"));
        extras.put(22L, new Extra("Gold",        EC_RESOURCE, "ts.gold"));
        extras.put(23L, new Extra("Oasis",       EC_RESOURCE, "ts.oasis"));
        extras.put(24L, new Extra("Fish",        EC_RESOURCE, "ts.fish"));
        extras.put(25L, new Extra("Whales",      EC_RESOURCE, "ts.whales"));

        // City styles are always hardcoded
        cityStyle.put(0L, new CityStyle("European"));
        cityStyle.put(1L, new CityStyle("Classical"));
        cityStyle.put(2L, new CityStyle("Tropical"));
        cityStyle.put(3L, new CityStyle("Asian"));

        // Use a seeded generator when mapSeed >= 0 (mirrors "mapseed" in C server).
        MapGenerator generator = mapSeed >= 0
                ? new MapGenerator(map.getXsize(), map.getYsize(), mapSeed)
                : new MapGenerator(map.getXsize(), map.getYsize());
        tiles = generator.generateMap();
    }

    /**
     * Replaces the current map with the terrain data from a Freeciv scenario
     * savegame file.  Must be called after {@link #initGame()} (so that the
     * terrain type table is already populated) and before {@link #startGame()}.
     *
     * <p>The scenario file is read from the classpath resource path
     * {@code scenarios/<scenarioName>}, e.g. {@code scenarios/earth-small.sav}.
     *
     * @param scenarioName  filename of the scenario, e.g. {@code "earth-small.sav"}
     * @return {@code true} if the scenario was loaded and the map updated;
     *         {@code false} on any error (file not found, parse failure, etc.)
     */
    public boolean loadScenario(String scenarioName) {
        ScenarioLoader loader = new ScenarioLoader();
        ScenarioData scenarioData = loader.loadScenario("scenarios/" + scenarioName);
        if (scenarioData == null) {
            return false;
        }
        if (scenarioData.xsize <= 0 || scenarioData.ysize <= 0
                || scenarioData.terrainRows == null) {
            log.error("Invalid scenario data for: {}", scenarioName);
            return false;
        }

        // Build char → terrainId lookup using the game's already-loaded terrain map
        Map<Character, Integer> charToTerrainId = new HashMap<>();
        if (scenarioData.terrainIdentifiers != null) {
            for (Map.Entry<Character, String> entry : scenarioData.terrainIdentifiers.entrySet()) {
                String terrainName = entry.getValue();
                for (Map.Entry<Long, Terrain> terrainEntry : terrains.entrySet()) {
                    if (terrainEntry.getValue().getName().equalsIgnoreCase(terrainName)) {
                        charToTerrainId.put(entry.getKey(), terrainEntry.getKey().intValue());
                        break;
                    }
                }
            }
        }

        // Determine the default terrain ID (Ocean) for unmapped characters
        int defaultTerrainId = 2;
        for (Map.Entry<Long, Terrain> e : terrains.entrySet()) {
            if ("Ocean".equalsIgnoreCase(e.getValue().getName())) {
                defaultTerrainId = e.getKey().intValue();
                break;
            }
        }

        // Update the map object with the scenario dimensions
        map = new WorldMap(scenarioData.xsize, scenarioData.ysize);

        // Build tile objects from the terrain rows
        Map<Long, Tile> newTiles = new HashMap<>();
        for (int y = 0; y < scenarioData.ysize; y++) {
            String row = (y < scenarioData.terrainRows.length
                    && scenarioData.terrainRows[y] != null)
                    ? scenarioData.terrainRows[y] : "";
            for (int x = 0; x < scenarioData.xsize; x++) {
                char c = (x < row.length()) ? row.charAt(x) : ' ';
                int terrainId = charToTerrainId.getOrDefault(c, defaultTerrainId);
                long index = (long) y * scenarioData.xsize + x;
                newTiles.put(index, new Tile(index, 0, terrainId, 0, 0, 0, -1));
            }
        }
        tiles = newTiles;
        log.info("Loaded scenario: {} ({}x{})", scenarioName,
                scenarioData.xsize, scenarioData.ysize);
        return true;
    }

    /**
     * Starts a new game and sends the initialized game state to all players.
     */
    public void startGame() {
        if (gameStarted) {
            server.sendMessageAll("Game already started.");
            return;
        }
        gameStarted = true;
        server.sendMessageAll("Starting new game.");

        server.sendCalendarInfoAll();
        server.sendMapInfoAll(map.getXsize(), map.getYsize());
        server.sendGameInfoAll(getHistoricalYear(), turn, phase, turnTimeout);
        server.sendRulesetControl(improvements.size());

        // Send technologies with proper prerequisite data (research_reqs).
        // VUT_ADVANCE=1 and REQ_RANGE_PLAYER=7 mirror the constants used in
        // the JavaScript client (fc_types.js / requirements.js).
        final int VUT_ADVANCE = 1;
        final int REQ_RANGE_PLAYER = 7;
        Map<String, Long> techNameToId = new HashMap<>();
        techs.forEach((id, tech) -> techNameToId.put(tech.getName(), id));
        techs.forEach((id, tech) -> {
            JSONArray researchReqs = new JSONArray();
            List<String> prereqNames = List.of(tech.getPrereq1(), tech.getPrereq2());
            for (String prereqName : prereqNames) {
                if (prereqName != null && !prereqName.equals("None")) {
                    Long prereqId = techNameToId.get(prereqName);
                    if (prereqId != null) {
                        JSONObject req = new JSONObject();
                        req.put("kind", VUT_ADVANCE);
                        req.put("range", REQ_RANGE_PLAYER);
                        req.put("present", true);
                        req.put("value", prereqId);
                        researchReqs.put(req);
                    }
                }
            }
            server.sendTechAll(id, -1, tech.getName(), researchReqs, tech.getGraphicsStr(), tech.getHelptext());
        });

        // Send governments
        governments.forEach((id, gov) -> server.sendRuleseGovernmentAll(id, gov.getName(), gov.getRuleName(), gov.getHelptext()));

        // Send nations
        nations.forEach((id, nation) -> server.sendNationInfoAll(id, nation.getName(), nation.getAdjective(), nation.getGraphicsStr(), nation.getLegend()));

        // Send extras (with correct id, causes and graphic_str)
        extras.forEach((id, extra) -> server.sendExtrasInfoAll(id, extra.getName(), extra.getCauses(), extra.getGraphicStr()));

        // Send terrains
        terrains.forEach((id, terrain) -> server.sendTerrainInfoAll(id, terrain.getName(), terrain.getGraphicsStr()));

        // Send unit types
        unitTypes.forEach((id, unitType) -> server.sendRulesetUnitAll(id, unitType));
        unitTypes.forEach((id, unitType) -> server.sendRulesetUnitWebAdditionAll(id, unitType));

        // Send all action ruleset data to fix "Asked for non existing action" JS errors
        server.sendRulesetActionsAll();

        // Send improvements (buildings)
        improvements.forEach((id, impr) -> server.sendRulesetBuildingAll(impr));

        tiles.forEach((id, tile) -> server.sendTileInfoAll(tile));

        // Create AI players up to the configured aifill count.
        // Mirrors the aifill setting in the C Freeciv server.
        String[] aiNames = {"Caesar", "Alexander", "Napoleon", "Genghis",
                             "Cleopatra", "Augustus", "Cyrus", "Ramesses", "Pericles"};
        for (int i = 0; i < aifill; i++) {
            long aiId = 1000L + i;
            Player aiPlayer = new Player(aiId, aiNames[i % aiNames.length], "ai", i % nations.size());
            aiPlayer.setAi(true);
            players.put(aiId, aiPlayer);
        }
        // Apply starting gold to all players (mirrors the gold server setting).
        players.values().forEach(p -> p.setGold(initialGold));
        players.forEach((id, iplayer) -> server.sendPlayerInfoAll(iplayer));
        players.forEach((id, iplayer) -> server.sendPlayerInfoAdditionAll(id, 0));

        // Initialize Units for all players
        for (Player player : players.values()) {
            long startPos = findStartPosition();
            spawnStartingUnits(player, startPos);
        }
        // Send units
        units.forEach((id, unit) -> server.sendUnitAll(unit));

        // Send city styles
        cityStyle.forEach((id, style) -> server.sendRulesetCityInfoAll(id, style.getName(), style.getName()));

        // Send cities – CITY_INFO first so the client creates a proper City
        // instance before the lightweight CITY_SHORT_INFO arrives.
        // CityTools.sendCityInfo also sends PACKET_WEB_CITY_INFO_ADDITION with
        // can_build_unit / can_build_improvement bitvectors for the city dialog.
        cities.forEach((id, city) -> {
            CityTools.sendCityInfo(this, server, -1L, id);
        });


        server.sendBordersServerSettingsAll();

        server.sendStartPhaseAll();
        server.sendBeginTurnAll();

        server.sendMessageAll("Welcome to the Freecivx game!");

        // Start the per-turn timeout timer if configured.
        if (turnTimeout > 0) {
            scheduleTurnTimeout();
        }
    }


    public boolean isGameStarted() {
        return gameStarted;
    }

    /**
     * Initialises a headless auto-game with the specified number of AI players.
     * Unlike {@link #startGame()}, this method does NOT broadcast any network
     * packets, making it suitable for offline simulation via {@code AutoGame}.
     *
     * @param numAiPlayers number of AI-controlled civilisations to create (≥ 1)
     */
    public void startAutoGame(int numAiPlayers) {
        if (gameStarted) return;
        gameStarted = true;

        String[] aiNames = {
            "Caesar", "Alexander", "Napoleon", "Genghis", "Cleopatra",
            "Augustus", "Cyrus", "Ramesses", "Pericles", "Montezuma"
        };
        for (int i = 0; i < numAiPlayers; i++) {
            long aiId = 1000L + i;
            Player aiPlayer = new Player(aiId, aiNames[i % aiNames.length], "ai", i % nations.size());
            aiPlayer.setAi(true);
            players.put(aiId, aiPlayer);
        }

        for (Player player : players.values()) {
            long startPos = findStartPosition();
            spawnStartingUnits(player, startPos);
        }
    }

    /**
     * Converts the lists loaded by {@link Ruleset} into the game's ID-keyed
     * maps.  IDs are assigned sequentially in the order the entries appear in
     * the ruleset files.
     */
    private void populateFromRuleset() {
        List<Technology> rTechs = ruleset.getTechnologies();
        for (int i = 0; i < rTechs.size(); i++) {
            techs.put((long) i, rTechs.get(i));
        }

        List<Government> rGovs = ruleset.getGovernments();
        for (int i = 0; i < rGovs.size(); i++) {
            governments.put((long) i, rGovs.get(i));
        }

        List<Terrain> rTerrains = ruleset.getTerrains();
        for (int i = 0; i < rTerrains.size(); i++) {
            terrains.put((long) i, rTerrains.get(i));
        }

        List<UnitType> rUnits = ruleset.getUnitTypes();
        for (int i = 0; i < rUnits.size(); i++) {
            unitTypes.put((long) i, rUnits.get(i));
        }

        // Resolve obsolete_by names to integer IDs now that all unit types are loaded.
        // Mirrors the unit-upgrade chain setup in the C Freeciv server's rules loading.
        // Build a name→ID map first (one O(n) pass) then resolve in a second O(n) pass.
        Map<String, Long> unitNameToId = new HashMap<>();
        for (Map.Entry<Long, UnitType> entry : unitTypes.entrySet()) {
            unitNameToId.put(entry.getValue().getName().toLowerCase(), entry.getKey());
        }
        for (UnitType ut : unitTypes.values()) {
            String obs = ut.getObsoletedByName();
            if (obs != null && !obs.isEmpty()) {
                Long targetId = unitNameToId.get(obs.toLowerCase());
                if (targetId != null) {
                    ut.setUpgradesTo(targetId.intValue());
                }
            }
        }

        // Resolve unit technology requirement names to IDs using the loaded tech map.
        // Mirrors the req-resolution pass for unit types in the C Freeciv server's
        // ruleset loading (server/ruleset.c: lookup_unit_type_ref).
        Map<String, Long> techNameToId = new HashMap<>();
        for (Map.Entry<Long, Technology> entry : techs.entrySet()) {
            techNameToId.put(entry.getValue().getName().toLowerCase(), entry.getKey());
        }
        for (UnitType ut : unitTypes.values()) {
            String reqName = ut.getTechReqName();
            if (reqName != null && !reqName.isEmpty()) {
                Long techId = techNameToId.get(reqName.toLowerCase());
                if (techId != null) {
                    ut.setTechReqId(techId);
                }
            }
        }

        List<Improvement> rImprov = ruleset.getImprovements();
        for (int i = 0; i < rImprov.size(); i++) {
            improvements.put((long) i, rImprov.get(i));
        }
    }

    /**
     * Populates game data from hardcoded defaults when ruleset loading fails.
     * Mirrors the classic Freeciv ruleset values.
     */
    private void populateFallback() {
        techs.put(0L,  new Technology("Alphabet",          "a.alphabet",          "Alphabet",          "None",         "None",           20));
        techs.put(1L,  new Technology("Mathematics",       "a.mathematics",       "Mathematics",       "Alphabet",     "None",           40));
        techs.put(2L,  new Technology("The Republic",      "a.the_republic",      "The Republic",      "Code of Laws", "None",           60));
        techs.put(3L,  new Technology("Masonry",           "a.masonry",           "Masonry",           "None",         "None",           20));
        techs.put(4L,  new Technology("Bronze Working",    "a.bronze_working",    "Bronze Working",    "None",         "None",           20));
        techs.put(5L,  new Technology("Iron Working",      "a.iron_working",      "Iron Working",      "Bronze Working","None",          40));
        techs.put(6L,  new Technology("The Wheel",         "a.the_wheel",         "The Wheel",         "None",         "None",           20));
        techs.put(7L,  new Technology("Writing",           "a.writing",           "Writing",           "Alphabet",     "None",           40));
        techs.put(8L,  new Technology("Code of Laws",      "a.code_of_laws",      "Code of Laws",      "Alphabet",     "None",           40));
        techs.put(9L,  new Technology("Horseback Riding",  "a.horseback_riding",  "Horseback Riding",  "None",         "None",           20));
        techs.put(10L, new Technology("Pottery",           "a.pottery",           "Pottery",           "None",         "None",           20));
        techs.put(11L, new Technology("Warrior Code",      "a.warrior_code",      "Warrior Code",      "None",         "None",           20));
        techs.put(12L, new Technology("Map Making",        "a.map_making",        "Map Making",        "Alphabet",     "None",           40));
        techs.put(13L, new Technology("Monarchy",          "a.monarchy",          "Monarchy",          "Code of Laws", "None",           60));
        techs.put(14L, new Technology("Democracy",         "a.democracy",         "Democracy",         "The Republic", "None",           80));
        techs.put(15L, new Technology("Communism",         "a.communism",         "Communism",         "Philosophy",   "None",           80));
        techs.put(16L, new Technology("Philosophy",        "a.philosophy",        "Philosophy",        "Writing",      "None",           40));
        techs.put(17L, new Technology("Mysticism",         "a.mysticism",         "Mysticism",         "None",         "None",           20));
        techs.put(18L, new Technology("Ceremonial Burial", "a.ceremonial_burial", "Ceremonial Burial", "None",         "None",           20));
        techs.put(19L, new Technology("Currency",          "a.currency",          "Currency",          "Bronze Working","None",          40));
        techs.put(20L, new Technology("Trade",             "a.trade",             "Trade",             "Currency",     "Code of Laws",   60));
        techs.put(21L, new Technology("Astronomy",         "a.astronomy",         "Astronomy",         "Mysticism",    "Mathematics",    60));
        techs.put(22L, new Technology("Navigation",        "a.navigation",        "Navigation",        "Map Making",   "Astronomy",      80));
        techs.put(23L, new Technology("University",        "a.university",        "University",        "Philosophy",   "Mathematics",   100));
        techs.put(24L, new Technology("Gunpowder",         "a.gunpowder",         "Gunpowder",         "Iron Working", "None",           80));
        techs.put(25L, new Technology("Feudalism",         "a.feudalism",         "Feudalism",         "Warrior Code", "Monarchy",       60));

        governments.put(0L, new Government("Anarchy",   "Anarchy",   "Anarchy",   null,            25));
        governments.put(1L, new Government("Despotism", "Despotism", "Despotism", null,            37));
        governments.put(2L, new Government("Monarchy",  "Monarchy",  "Monarchy",  "Monarchy",      15));
        governments.put(3L, new Government("Communism", "Communism", "Communism", "Communism",     20));
        governments.put(4L, new Government("Republic",  "Republic",  "Republic",  "The Republic",  15));
        governments.put(5L, new Government("Democracy", "Democracy", "Democracy", "Democracy",      0));

        // Terrain types with food/shield/trade output values from the classic Freeciv ruleset.
        // Format: new Terrain(name, graphic, defenseBonus, moveCost, food, shield, trade,
        //                     irrigationFoodBonus, miningShieldBonus, roadTradeBonus)
        // roadTradeBonus=1 for terrains with road_trade_incr_pct=100 (Desert, Grassland, Plains).
        terrains.put(0L,  new Terrain("Arctic",       "",       0,   1, 0, 0, 0, 0, 0, 0));
        terrains.put(1L,  new Terrain("Lake",         "lake",   0,   1, 1, 0, 2, 0, 0, 0));
        terrains.put(2L,  new Terrain("Ocean",        "floor",  0,   1, 1, 0, 2, 0, 0, 0));
        terrains.put(3L,  new Terrain("Deep Ocean",   "coast",  0,   1, 1, 0, 2, 0, 0, 0));
        terrains.put(4L,  new Terrain("Glacier",      "",       0,   2, 0, 0, 0, 0, 1, 0));
        terrains.put(5L,  new Terrain("Desert",       "",       0,   1, 0, 1, 0, 1, 1, 1));
        terrains.put(6L,  new Terrain("Forest",       "",      50,   2, 1, 2, 0, 0, 0, 0));
        terrains.put(7L,  new Terrain("Grassland",    "",       0,   1, 2, 0, 0, 1, 0, 1));
        terrains.put(8L,  new Terrain("Hills",        "",     100,   2, 1, 0, 0, 1, 3, 0));
        terrains.put(9L,  new Terrain("Jungle",       "",      50,   2, 1, 0, 0, 0, 0, 0));
        terrains.put(10L, new Terrain("Mountains",    "",     200,   3, 0, 1, 0, 0, 1, 0));
        terrains.put(11L, new Terrain("Plains",       "",       0,   1, 1, 1, 0, 1, 0, 1));
        terrains.put(12L, new Terrain("Swamp",        "",      50,   2, 1, 0, 0, 0, 0, 0));
        terrains.put(13L, new Terrain("Tundra",       "",       0,   1, 1, 0, 0, 1, 0, 0));
        terrains.put(14L, new Terrain("Inaccessible", "",       0,  99, 0, 0, 0, 0, 0, 0));

        String defaultActions = "000000000000000000000000000010000000001110001000000000000011011111111001100011000000001100110000000000000000100100000000";
        String settlerActions = "000000000000000000000000000110000000001110001000000000000011011111111001100011000000001100110000000000000000100100000000";
        // Unit definitions mirroring the classic Freeciv units ruleset:
        // firepower=1 for all fallback units (most classic units); Settlers have pop_cost=1.
        // Horse-flagged units: Horsemen, Chariot, Knight, Cavalry (they suffer 2× defense from Pikemen).
        // Pikemen have antiHorseFactor=2 (double defense vs. Horse-flagged units).
        unitTypes.put(0L,  new UnitType("Settlers",   "u.settlers",  1, 20, 1, "Settlers unit", 0, 1, settlerActions, 0, 40));
        unitTypes.put(1L,  new UnitType("Workers",    "u.worker",    1, 20, 1, "Workers unit",  0, 1, settlerActions, 0, 30));
        unitTypes.put(2L,  new UnitType("Explorer",   "u.explorer",  1, 1,  1, "Explorer unit", 0, 1, defaultActions, 0, 30));
        unitTypes.put(3L,  new UnitType("Warriors",   "u.warriors",  1, 10, 1, "Warriors",      1, 1, defaultActions, 0, 10));
        unitTypes.put(4L,  new UnitType("Horsemen",   "u.horsemen",  2, 10, 1, "Horsemen",      2, 1, defaultActions, 0, 50));
        unitTypes.put(5L,  new UnitType("Archers",    "u.archers",   1, 10, 1, "Archers",       3, 2, defaultActions, 0, 30));
        unitTypes.put(6L,  new UnitType("Legion",     "u.legion",    1, 20, 1, "Legion",        3, 3, defaultActions, 0, 60));
        unitTypes.put(7L,  new UnitType("Pikemen",    "u.pikemen",   1, 10, 1, "Pikemen",       1, 2, defaultActions, 0, 30));
        unitTypes.put(8L,  new UnitType("Musketeers", "u.musketeers",1, 20, 1, "Musketeers",    5, 4, defaultActions, 0, 60));
        unitTypes.put(9L,  new UnitType("Catapult",   "u.catapult",  1, 10, 1, "Catapult",      6, 1, defaultActions, 0, 70));
        unitTypes.put(10L, new UnitType("Chariot",    "u.chariot",   2, 10, 1, "Chariot",       3, 1, defaultActions, 0, 40));
        unitTypes.put(11L, new UnitType("Knight",     "u.knights",   2, 10, 1, "Knight",        4, 2, defaultActions, 0, 40));
        unitTypes.put(12L, new UnitType("Phalanx",    "u.phalanx",   1, 10, 1, "Phalanx",       2, 2, defaultActions, 0, 25));
        unitTypes.put(13L, new UnitType("Diplomat",   "u.diplomat",  2, 10, 1, "Diplomat",      0, 0, defaultActions, 0, 30));
        unitTypes.put(14L, new UnitType("Cavalry",    "u.cavalry",   2, 20, 1, "Cavalry",       8, 3, defaultActions, 0, 60));
        unitTypes.put(15L, new UnitType("Cannon",     "u.cannon",    1, 20, 1, "Cannon",        8, 1, defaultActions, 0, 80));
        unitTypes.put(16L, new UnitType("Riflemen",   "u.riflemen",  1, 20, 1, "Riflemen",      5, 4, defaultActions, 0, 60));
        unitTypes.put(17L, new UnitType("Trireme",    "u.trireme",   3, 10, 1, "Trireme",       1, 1, defaultActions, 1, 40));
        unitTypes.put(18L, new UnitType("Frigate",    "u.frigate",   4, 20, 1, "Frigate",       4, 2, defaultActions, 1, 50));

        // Settlers cost 1 population from the city when built (mirrors pop_cost=1 in ruleset).
        unitTypes.get(0L).setPopCost(1);

        // Horse-flagged units: suffer 2× defense from Pikemen in combat.
        // Mirrors the "Horse" flag in the classic Freeciv units ruleset.
        unitTypes.get(4L).setHasHorseFlag(true);   // Horsemen
        unitTypes.get(10L).setHasHorseFlag(true);  // Chariot
        unitTypes.get(11L).setHasHorseFlag(true);  // Knight
        unitTypes.get(14L).setHasHorseFlag(true);  // Cavalry

        // Pikemen have double defense against Horse-flagged units.
        // Mirrors bonuses = { "Horse", "DefenseMultiplier", 1 } in classic ruleset.
        unitTypes.get(7L).setAntiHorseFactor(2);   // Pikemen

        // Unit upgrade chains for the fallback dataset.
        // Mirrors the obsolete_by field in the classic Freeciv units ruleset and
        // the do_upgrade_effects() upgrade chain in the C Freeciv server.
        // Format: source unit ID → target unit ID.
        unitTypes.get(3L).setUpgradesTo(8);   // Warriors   → Musketeers
        unitTypes.get(4L).setUpgradesTo(11);  // Horsemen   → Knight
        unitTypes.get(5L).setUpgradesTo(8);   // Archers    → Musketeers
        unitTypes.get(7L).setUpgradesTo(16);  // Pikemen    → Riflemen
        unitTypes.get(9L).setUpgradesTo(15);  // Catapult   → Cannon
        unitTypes.get(10L).setUpgradesTo(14); // Chariot    → Cavalry
        unitTypes.get(12L).setUpgradesTo(8);  // Phalanx    → Musketeers
        unitTypes.get(17L).setUpgradesTo(18); // Trireme    → Frigate

        improvements.put(0L,  new Improvement(0,  "Palace",      "Palace",      "b.palace",      "b.fallback", 1, 100, 0, 0, "b_palace",      "b_fallback", "The Palace",      -1));
        improvements.put(1L,  new Improvement(1,  "Barracks",    "Barracks",    "b.barracks",    "b.fallback", 2,  40, 1, 0, "b_barracks",    "b_fallback", "The Barracks",    -1));
        improvements.put(2L,  new Improvement(2,  "Granary",     "Granary",     "b.granary",     "b.fallback", 2,  60, 1, 0, "b_granary",     "b_fallback", "The Granary",     10));
        improvements.put(3L,  new Improvement(3,  "Library",     "Library",     "b.library",     "b.fallback", 2,  80, 1, 0, "b_library",     "b_fallback", "The Library",      7));
        improvements.put(4L,  new Improvement(4,  "Marketplace", "Marketplace", "b.marketplace", "b.fallback", 2, 100, 1, 0, "b_marketplace", "b_fallback", "The Marketplace",  8));
        improvements.put(5L,  new Improvement(5,  "Bank",        "Bank",        "b.bank",        "b.fallback", 2, 120, 2, 0, "b_bank",        "b_fallback", "The Bank",         1));
        improvements.put(6L,  new Improvement(6,  "Temple",      "Temple",      "b.temple",      "b.fallback", 2,  30, 1, 0, "b_temple",      "b_fallback", "The Temple",       0));
        improvements.put(7L,  new Improvement(7,  "City Walls",  "City_Walls",  "b.city_walls",  "b.fallback", 2,  60, 0, 0, "b_city_walls",  "b_fallback", "City Walls",       3));
        improvements.put(8L,  new Improvement(8,  "Aqueduct",    "Aqueduct",    "b.aqueduct",    "b.fallback", 2, 120, 2, 0, "b_aqueduct",    "b_fallback", "The Aqueduct",     3));
        improvements.put(9L,  new Improvement(9,  "Courthouse",  "Courthouse",  "b.courthouse",  "b.fallback", 2,  80, 1, 0, "b_courthouse",  "b_fallback", "The Courthouse",   8));
        improvements.put(10L, new Improvement(10, "Harbor",      "Harbor",      "b.port",        "b.fallback", 2,  60, 1, 0, "b_harbor",      "b_fallback", "The Harbor",      12));
        improvements.put(11L, new Improvement(11, "Colosseum",   "Colosseum",   "b.colosseum",   "b.fallback", 2, 100, 4, 0, "b_colosseum",   "b_fallback", "The Colosseum",    4));
        improvements.put(12L, new Improvement(12, "Cathedral",   "Cathedral",   "b.cathedral",   "b.fallback", 2, 120, 3, 0, "b_cathedral",   "b_fallback", "The Cathedral",    6));
        improvements.put(13L, new Improvement(13, "University",  "University",  "b.university",  "b.fallback", 2, 160, 3, 0, "b_university",  "b_fallback", "The University",  23));
    }

    /**
     * Returns the numeric ID of the first unit type whose name matches
     * {@code name} (case-insensitive), or {@code fallback} if not found.
     * Used by {@link #spawnStartingUnits} to locate units by name after
     * the ruleset has been loaded.
     */
    private int findUnitTypeId(String name, int fallback) {
        for (Map.Entry<Long, UnitType> e : unitTypes.entrySet()) {
            if (name.equalsIgnoreCase(e.getValue().getName())) {
                return e.getKey().intValue();
            }
        }
        return fallback;
    }

    /**
     * Returns the max HP for a unit type, or a default value when the type is
     * not found.  Used by {@link #spawnStartingUnits} to initialise units with
     * the correct HP from the loaded ruleset.
     *
     * @param typeId     the unit type ID to look up
     * @param defaultHp  the fallback HP value when the type is absent
     * @return the unit type's max HP, or {@code defaultHp} if not found
     */
    private int unitTypeHp(int typeId, int defaultHp) {
        UnitType ut = unitTypes.get((long) typeId);
        return ut != null ? ut.getHp() : defaultHp;
    }

    /**
     * Returns the move rate for a unit type, or a default value when the type is
     * not found.  Used by {@link #spawnStartingUnits}.
     *
     * @param typeId       the unit type ID to look up
     * @param defaultMove  the fallback move rate when the type is absent
     * @return the unit type's move rate, or {@code defaultMove} if not found
     */
    private int unitTypeMoveRate(int typeId, int defaultMove) {
        UnitType ut = unitTypes.get((long) typeId);
        return ut != null ? ut.getMoveRate() : defaultMove;
    }

    public void updateLastActivity() {
        lastActivityTime = System.currentTimeMillis();
    }

    public long getLastActivityTime() {
        return lastActivityTime;
    }

    public int getConnectedPlayerCount() {
        return connections.size();
    }

    /**
     * Called when a human player presses the end-turn button.
     * Advances the turn only when every living human player has ended their turn.
     * AI players are excluded from this check because they run automatically
     * inside {@link #turnDone()}.
     *
     * @param connId the connection ID of the player who pressed end-turn
     */
    public synchronized void playerEndTurn(long connId) {
        Player player = players.get(connId);
        if (player == null || player.isAi()) return;

        humanPlayersDone.add(connId);

        long humanAliveCount = players.values().stream()
                .filter(p -> !p.isAi() && p.isAlive())
                .count();

        if (humanPlayersDone.size() >= humanAliveCount) {
            humanPlayersDone.clear();
            cancelTurnTimeout();
            turnDone();
        }
    }

    public void turnDone() {
        year++;
        turn++;

        // Reset movement points for all units and broadcast the new state to clients
        // so that the client UI immediately reflects the refreshed moves_left / done_moving
        // values.  Without this broadcast the client would continue to display stale
        // movement data until each unit was individually updated by another action.
        units.forEach((id, unit) -> {
            UnitType utype = unitTypes.get((long) unit.getType());
            if (utype != null) {
                unit.setMovesleft(utype.getMoveRate());
                unit.setDoneMoving(false);
                server.sendUnitAll(unit);
            }
        });

        // Process end-of-turn city updates: growth, production, economy, research.
        // Mirrors update_city_activities() in the C Freeciv server's cityturn.c.
        net.freecivx.server.CityTurn.updateAllCities(this);

        // Run AI turns (executed in the dedicated AI thread)
        aiPlayer.runAiTurns();

        // Check for and eliminate players who have no cities and no settlers.
        // Mirrors check_for_city_destruction() / kill_player() in C Freeciv server.
        checkPlayerElimination();

        server.sendGameInfoAll(getHistoricalYear(), turn, phase, turnTimeout);
        // Classic Freeciv: year 4000 BCE at turn 1, each turn advances 20 years.
        // getHistoricalYear() returns negative values for BC years and non-negative for AD.
        long histYear = getHistoricalYear();
        String yearStr = histYear < 0
                ? Math.abs(histYear) + " BC"
                : histYear + " AD";
        server.sendEndTurnAll();
        server.sendBeginTurnAll();
        server.sendStartPhaseAll();
        server.sendMessageAll("Turn " + turn + " has started (Year " + yearStr + ").");

        // Re-arm the turn-timeout timer for the new turn.
        if (turnTimeout > 0) {
            scheduleTurnTimeout();
        }
    }

    public void changeUnitActivity(long unit_id, int activity) {
        Unit unit = units.get(unit_id);
        if (unit == null) return;
        unit.setActivity(activity);
        // Reset the terrain-improvement progress counter whenever the
        // activity changes.  Mirrors unit_activity_handling() in the C server
        // where any new order resets the activity work done so far.
        unit.setActivityCount(0);
        server.sendUnitAll(unit);
    }

    public boolean moveUnit(long unit_id, int dest_tile, int dir) {
        Unit unit = units.get(unit_id);
        if (unit == null) return false;

        // Enforce movement limits
        if (unit.getMovesleft() <= 0) return false;

        // Validate that the destination is exactly one tile (adjacent) from the unit's
        // current position.  This prevents GOTO or client exploits from teleporting a
        // unit many tiles in a single order — each call to moveUnit() covers one step.
        // Mirrors the adjacency requirement in the C Freeciv server's unithand.c.
        if (map != null) {
            int xsize = map.getXsize();
            int sx = (int) (unit.getTile() % xsize);
            int sy = (int) (unit.getTile() / xsize);
            int dx = dest_tile % xsize;
            int dy = dest_tile / xsize;
            // Reject same-tile moves before checking adjacency distance.
            if (dx == sx && dy == sy) return false;
            int rawDx = Math.abs(dx - sx);
            int wrappedDx = Math.min(rawDx, xsize - rawDx); // handle east-west map wrap
            int rawDy = Math.abs(dy - sy);
            if (wrappedDx > 1 || rawDy > 1) {
                return false; // destination is more than one tile away
            }
        }

        // Always compute the facing direction server-side from the actual tile delta,
        // overriding whatever direction the client provided.  This fixes cases where
        // GOTO orders carry a stale or incorrect dir value.
        // Mirrors the direction calculation in the C Freeciv server's unithand.c.
        int calculatedDir = Movement.unitFacing((int) unit.getTile(), dest_tile, map);
        if (calculatedDir >= 0) {
            dir = calculatedDir;
        }

        // Terrain check: land units cannot enter ocean tiles (terrain 2=Ocean, 3=Deep Ocean);
        // sea units (domain=1) can only enter ocean tiles and cannot move onto land.
        // Mirrors domain-based native-tile checks in the C Freeciv server's movement.c.
        UnitType utype = unitTypes.get((long) unit.getType());
        if (utype != null) {
            Tile destTile = tiles.get((long) dest_tile);
            if (destTile != null) {
                int terrain = destTile.getTerrain();
                boolean isOcean = (terrain == 2 || terrain == 3);
                if (utype.getDomain() == 0 && isOcean) return false; // land unit cannot enter ocean
                if (utype.getDomain() == 1 && !isOcean) return false; // sea unit cannot enter land
            }
        }

        // Zone of Control (ZOC) check: land military units cannot pass through enemy
        // territory unless they are moving from or to a city, are non-military, or
        // have a friendly unit adjacent to either the source or destination tile.
        // Mirrors can_step_taken_wrt_to_zoc() in the C Freeciv server's movement.c.
        if (utype != null && !Movement.canStepWrtZoc(unit, utype, unit.getTile(), (long) dest_tile,
                units, unitTypes, cities, tiles, map)) {
            return false;
        }
        // Check for enemy units on the destination tile — trigger combat instead
        // of moving (mirrors unithand.c: moving onto an enemy initiates an attack).
        for (Unit other : units.values()) {
            if (other.getTile() == dest_tile && other.getOwner() != unit.getOwner()) {
                unit.setFacing(dir);
                return attackUnit(unit_id, other.getId());
            }
        }

        // Calculate terrain-based movement cost.
        // Mirrors tile_move_cost() in the C Freeciv server's common/movement.c:
        // Mountains=3, Hills/Forest/Jungle/Swamp=2, others=1; roads reduce cost.
        Tile srcTile = tiles.get(unit.getTile());
        Tile destTileObj = tiles.get((long) dest_tile);
        int moveCost = Movement.tileMoveCost(srcTile, destTileObj, unit, terrains);

        unit.setTile(dest_tile);
        unit.setFacing(dir);
        // Deduct terrain cost; allow the move even if cost exceeds remaining moves
        // (C server rule: a unit can always spend its last move to enter difficult terrain).
        unit.setMovesleft(Math.max(0, unit.getMovesleft() - moveCost));

        // Moving cancels any in-progress terrain improvement activity.
        // Mirrors the C Freeciv server's behaviour where a unit order (move)
        // interrupts any ongoing unit_activity (road, mine, irrigate).
        if (unit.getActivity() == net.freecivx.server.CityTurn.ACTIVITY_ROAD
                || unit.getActivity() == net.freecivx.server.CityTurn.ACTIVITY_IRRIGATE
                || unit.getActivity() == net.freecivx.server.CityTurn.ACTIVITY_MINE) {
            unit.setActivity(0);
            unit.setActivityCount(0);
        }

        // Check for a goodie hut (village) on the destination tile.
        // Mirrors unit_enter_hut() in the C Freeciv server's server/unittools.c:
        // entering a tile with the Hut extra (bit 8) removes the hut and awards
        // a random reward (gold or a technology).
        if (destTileObj != null && (destTileObj.getExtras() & (1 << 8)) != 0) {
            enterHut(unit, destTileObj);
        }

        server.sendUnitAll(unit);
        return true;
    }

    public void addPlayer(long connId, String username, String addr) {
        Player player = new Player(connId, username, addr, random.nextInt(3));
        players.put(connId, player);
        server.sendMessageAll(username + " has joined the game.");

        players.forEach((id, iplayer) -> server.sendPlayerInfoAll(iplayer));
        players.forEach((id, iplayer) -> server.sendPlayerInfoAdditionAll(id, 0));

        connections.forEach((id, conn) -> server.sendConnInfoAll(id, conn.getUsername(), conn.getIp(), conn.getPlayerNo()));
    }

    public void addConnection(long connId, String username, long player_no, String address) {
        Connection connection = new Connection(connId, username, player_no, address);
        connections.put(connId, connection);
    }

    private long findStartPosition() {
        long startPos = 0;
        for (int i = 0; i < MAX_START_POSITION_ATTEMPTS; i++) {
            startPos = random.nextInt(map.getXsize() * map.getYsize());
            Tile startTile = tiles.get(startPos);
            if (startTile != null && startTile.getTerrain() == 7 && startTile.getWorked() < 0) {
                break;
            }
        }
        return startPos;
    }

    private void spawnStartingUnits(Player player, long startPos) {
        // Look up unit type IDs by name so this method works correctly whether
        // data came from the ruleset or the hardcoded fallback.
        int settlersId  = findUnitTypeId("Settlers",  0);
        int workersId   = findUnitTypeId("Workers",   1);
        int warriorsId  = findUnitTypeId("Warriors",  3);
        int horsemenId  = findUnitTypeId("Horsemen",  4);
        int engineersId = findUnitTypeId("Engineers", 2);

        // Spawn starting units with HP and move rate read from the unit type
        // definition.  Mirrors create_unit_full() in the C Freeciv server's
        // server/unittools.c where punit->hp = utype->hp and punit->moves_left =
        // utype->move_rate.
        units.put((long) units.size(), new Unit(units.size(), player.getPlayerNo(), startPos,
                settlersId,  0, 1, unitTypeHp(settlersId, 20),  0, unitTypeMoveRate(settlersId, 1)));
        units.put((long) units.size(), new Unit(units.size(), player.getPlayerNo(), startPos,
                workersId,   0, 1, unitTypeHp(workersId, 20),   0, unitTypeMoveRate(workersId, 1)));
        units.put((long) units.size(), new Unit(units.size(), player.getPlayerNo(), startPos,
                warriorsId,  0, 1, unitTypeHp(warriorsId, 10),  0, unitTypeMoveRate(warriorsId, 1)));
        units.put((long) units.size(), new Unit(units.size(), player.getPlayerNo(), startPos,
                horsemenId,  0, 1, unitTypeHp(horsemenId, 10),  0, unitTypeMoveRate(horsemenId, 2)));
        units.put((long) units.size(), new Unit(units.size(), player.getPlayerNo(), startPos,
                engineersId, 0, 1, unitTypeHp(engineersId, 20), 0, unitTypeMoveRate(engineersId, 1)));
    }

    /**
     * Resolves an attack from one unit against another.
     * Uses {@link Combat#resolveCombat} to determine the outcome, applying
     * unit-type attack/defence strengths and terrain bonuses (mirrors
     * {@code do_unit_attack_tiles} in the C server's {@code server/unittools.c}).
     * The loser is removed from the game and a {@code PACKET_UNIT_REMOVE}
     * broadcast is sent; the winner's updated HP is broadcast to all clients.
     *
     * @param attackerId ID of the attacking unit
     * @param defenderId ID of the defending unit
     * @return {@code true} if the attacker wins (defender is destroyed)
     */
    public boolean attackUnit(long attackerId, long defenderId) {
        Unit attacker = units.get(attackerId);
        Unit defender = units.get(defenderId);
        if (attacker == null || defender == null) return false;
        if (!Combat.canUnitAttack(attacker, defender)) return false;

        UnitType attackerType = unitTypes.get((long) attacker.getType());
        UnitType defenderType = unitTypes.get((long) defender.getType());

        // Non-military units (Workers, Engineers, Diplomats, etc.) cannot initiate
        // combat.  Mirrors is_military_unit() in the C Freeciv server's common/unit.c:
        // a unit with attack_strength=0 or the NonMil flag is never a military unit.
        if (attackerType != null
                && (attackerType.getAttackStrength() == 0 || attackerType.isNonMilitary())) {
            return false;
        }

        Tile defenderTile = tiles.get(defender.getTile());

        // Apply city walls defence bonus when the defender is garrisoned in a walled city.
        // City walls give +50% defence bonus, mirroring EFT_DEFEND_BONUS in the C server.
        int cityWallsBonus = 0;
        if (defenderTile != null && defenderTile.getWorked() > 0) {
            City defCity = cities.get(defenderTile.getWorked());
            if (defCity != null && defCity.getWalls() > 0) {
                cityWallsBonus = 50;
            }
        }

        boolean attackerWins = Combat.resolveCombat(attacker, attackerType,
                                                    defender, defenderType,
                                                    defenderTile, cityWallsBonus);

        // Log combat outcome
        String attackerName = attackerType != null ? attackerType.getName() : "Unit";
        String defenderName = defenderType != null ? defenderType.getName() : "Unit";
        Player attackerOwner = players.get(attacker.getOwner());
        Player defenderOwner = players.get(defender.getOwner());
        String atkOwnerName = attackerOwner != null ? attackerOwner.getUsername() : "?";
        String defOwnerName = defenderOwner != null ? defenderOwner.getUsername() : "?";
        log.info("Combat: {}'s {} attacks {}'s {} → {}",
                atkOwnerName, attackerName, defOwnerName, defenderName,
                attackerWins ? atkOwnerName + " wins" : defOwnerName + " wins");

        // Consume one move point for the attack
        attacker.setMovesleft(Math.max(0, attacker.getMovesleft() - 1));

        if (attackerWins) {
            // Winner may gain a veteran level — mirrors maybe_make_veteran() in C server.
            boolean promoted = Combat.maybePromoteVeteran(attacker, attackerType);
            units.remove(defenderId);
            server.sendUnitRemove(defenderId);

            // City capture: if the defender was in an enemy city and no enemy units
            // remain on that tile, the city is either captured or razed.
            // Mirrors city_conquest() in the C Freeciv server's server/citytools.c.
            if (defenderTile != null) {
                long cityId = defenderTile.getWorked();
                if (cityId > 0) {
                    City defCity = cities.get(cityId);
                    if (defCity != null && defCity.getOwner() != attacker.getOwner()) {
                        // Check if any other enemy units remain on this tile
                        final long defenderTileId = defender.getTile();
                        final long cityOwner = defCity.getOwner();
                        boolean noEnemyLeft = units.values().stream()
                                .noneMatch(u -> u.getTile() == defenderTileId
                                        && u.getOwner() == cityOwner);
                        if (noEnemyLeft) {
                            captureOrRazeCity(attacker, defCity, cityId, defenderTile);
                        }
                    }
                }
            }

            server.sendUnitAll(attacker);
            if (promoted) {
                server.sendMessage(attacker.getOwner(),
                        unitTypes.get((long) attacker.getType()) != null
                                ? unitTypes.get((long) attacker.getType()).getName() + " was promoted to veteran level "
                                + attacker.getVeteran() + "."
                                : "Unit was promoted.");
            }
        } else {
            // Defender survived; it may also gain a veteran level.
            Combat.maybePromoteVeteran(defender, defenderType);
            units.remove(attackerId);
            server.sendUnitRemove(attackerId);
            server.sendUnitAll(defender);
        }
        return attackerWins;
    }

    public void buildCity(long unit_id, String city_name, long tile_id) {
        Unit unit = units.get(unit_id);
        if (unit == null) return;

        long id = cities.size() + 1;
        long owner = unit.getOwner();
        // productionKind=0 (unit), productionValue=-1 (no production yet)
        City city = new City(city_name, owner, tile_id, 1, 1, false, false,
                0, true, false, "", 0, -1);
        cities.put(id, city);

        Tile tile = tiles.get(tile_id);
        tile.setWorked(id);

        // Classic Freeciv: city centre tiles automatically get a road
        // (extra_road flag "AutoOnCityCenter" in terrain.ruleset).
        // This gives the city its road-based trade bonus immediately on founding.
        tile.setExtras(tile.getExtras() | (1 << net.freecivx.server.CityTurn.EXTRA_BIT_ROAD));

        server.sendTileInfoAll(tile);

        CityTools.sendCityInfo(this, server, -1L, id);
        server.sendUnitRemove(unit_id);
        units.remove(unit_id);
    }

    public void syncNewPlayer(long connId) {
        Player player = players.get(connId);
        if (player == null) return;

        // Spawn starting units for the late joiner
        long startPos = findStartPosition();
        spawnStartingUnits(player, startPos);

        // Send full current game state to just this player
        server.sendGameStateTo(connId);

        // Broadcast the new player's units to all existing players
        units.values().stream()
                .filter(u -> u.getOwner() == player.getPlayerNo())
                .forEach(u -> server.sendUnitAll(u));

        server.sendMessage(connId, "Welcome! The game is in progress (turn " + turn + ").");
        server.sendMessageAll(player.getUsername() + " has joined the game in progress.");
    }

    /**
     * Handles city capture or razing after the last enemy defender is defeated.
     * Mirrors {@code city_conquest()} / {@code city_transfer()} in the C Freeciv
     * server's {@code server/citytools.c}.
     * <ul>
     *   <li>A city of size 1 is <b>razed</b> (removed from the game).</li>
     *   <li>A larger city is <b>captured</b>: ownership is transferred to the
     *       attacker's civilization and city size is reduced by 1.</li>
     * </ul>
     * The winning unit is moved onto the captured/razed tile after the event.
     *
     * @param attacker    the unit that won the decisive battle
     * @param city        the enemy city on the defender's tile
     * @param cityId      the city's key in {@code game.cities}
     * @param cityTile    the tile the city occupies
     */
    private void captureOrRazeCity(Unit attacker, City city, long cityId, Tile cityTile) {
        long oldOwner = city.getOwner();
        long newOwner = attacker.getOwner();
        String cityName = city.getName();

        if (city.getSize() <= 1) {
            // Raze: a 1-population city is destroyed upon capture.
            // Mirrors city_reduce_size(pcity, 1, winner, "razed") in the C server.
            cityTile.setWorked(-1);
            server.sendTileInfoAll(cityTile);
            // removeCity() removes from game.cities and sends remove packet to clients.
            net.freecivx.server.CityTools.removeCity(this, cityId);
            server.sendMessageAll(cityName + " has been razed!");
            log.info("City razed: {} (owner: {})", cityName, getPlayerName(oldOwner));
            Notify.notifyPlayer(this, server, oldOwner,
                    cityName + " has been razed by the enemy!");
        } else {
            // Capture: transfer ownership and reduce size by 1.
            // Mirrors city_transfer() in server/citytools.c.
            city.setOwner(newOwner);
            city.setSize(city.getSize() - 1);
            // Reset production queue (captured city has disrupted production)
            city.setProductionKind(0);
            city.setProductionValue(-1);
            city.setShieldStock(0);
            CityTools.sendCityInfo(this, server, -1L, cityId);
            server.sendMessageAll(cityName + " has been captured!");
            log.info("City captured: {} by {} from {}", cityName,
                    getPlayerName(newOwner), getPlayerName(oldOwner));
            Notify.notifyPlayer(this, server, newOwner,
                    "Our forces have captured " + cityName + "!");
            Notify.notifyPlayer(this, server, oldOwner,
                    cityName + " has been captured by the enemy!");
        }

        // Move the victorious attacker onto the conquered tile.
        // Mirrors unit_move() after city_conquest() in the C Freeciv server.
        attacker.setTile(cityTile.getIndex());
        attacker.setMovesleft(0);
    }

    /** Returns the username of the player with the given ID, or "?" if not found. */
    private String getPlayerName(long playerId) {
        Player p = players.get(playerId);
        return p != null ? p.getUsername() : "?";
    }

    /**
     * Checks all living players for elimination conditions and marks them dead
     * when they have no cities and no units that can build a city (Settlers).
     * Mirrors the {@code kill_player()} logic triggered from
     * {@code check_for_city_destruction()} in the C Freeciv server.
     *
     * <p>Eliminated players have all their remaining units removed from the
     * game and a broadcast is sent to all clients.
     */
    void checkPlayerElimination() {
        List<Player> snapshot = new ArrayList<>(players.values());
        for (Player player : snapshot) {
            if (!player.isAlive()) continue;

            long pid = player.getPlayerNo();

            // Count cities owned by this player
            long cityCount = cities.values().stream()
                    .filter(c -> c.getOwner() == pid).count();
            if (cityCount > 0) continue; // Still has cities – alive

            // Check if player has any Settlers that could re-found a city.
            // Mirrors the C server check for units with CAN_FOUND_CITY flag.
            boolean hasSettlers = units.values().stream()
                    .filter(u -> u.getOwner() == pid)
                    .anyMatch(u -> {
                        UnitType utype = unitTypes.get((long) u.getType());
                        return utype != null
                                && "Settlers".equalsIgnoreCase(utype.getName());
                    });
            if (hasSettlers) continue; // Can still refound – alive

            // Player is eliminated
            player.setAlive(false);
            log.info("Player eliminated: {}", player.getUsername());
            server.sendMessageAll(player.getUsername() + " has been eliminated!");

            // Remove all of this player's remaining units
            List<Long> idsToRemove = new ArrayList<>();
            for (Map.Entry<Long, Unit> entry : units.entrySet()) {
                if (entry.getValue().getOwner() == pid) {
                    idsToRemove.add(entry.getKey());
                }
            }
            for (long uid : idsToRemove) {
                units.remove(uid);
                server.sendUnitRemove(uid);
            }
        }
    }

    /**
     * Minimum gold reward from entering a goodie hut.
     * Mirrors the minimum hut gold in the C Freeciv server's
     * {@code server/unittools.c}.
     */
    private static final int MIN_HUT_GOLD = 25;
    /**
     * Maximum gold reward from entering a goodie hut.
     * Mirrors the maximum hut gold in the C Freeciv server's
     * {@code server/unittools.c}.
     */
    private static final int MAX_HUT_GOLD = 100;

    /**
     * Awards a random reward to the unit's owner when a unit enters a goodie hut.
     * Removes the Hut extra from the tile and broadcasts the tile update, then
     * gives either a random amount of gold (25–100) or a random researchable
     * technology to the owning player.
     * Mirrors {@code unit_enter_hut()} in the C Freeciv server's
     * {@code server/unittools.c}.
     *
     * @param unit the unit entering the hut
     * @param tile the tile containing the hut (extra bit 8 will be cleared)
     */
    private void enterHut(Unit unit, Tile tile) {
        // Remove the hut from the tile so it cannot be entered again
        tile.setExtras(tile.getExtras() & ~(1 << 8));
        server.sendTileInfoAll(tile);

        long ownerId = unit.getOwner();
        Player player = players.get(ownerId);
        if (player == null) return;

        // 50 % chance of gold, 50 % chance of a free technology.
        // Mirrors the hut outcome distribution in the C Freeciv server where
        // gold, technology, or a unit can be awarded.
        if (random.nextBoolean()) {
            // Gold reward: MIN_HUT_GOLD–MAX_HUT_GOLD coins
            int gold = MIN_HUT_GOLD + random.nextInt(MAX_HUT_GOLD - MIN_HUT_GOLD + 1);
            player.setGold(player.getGold() + gold);
            server.sendPlayerInfoAll(player);
            Notify.notifyPlayer(this, server, ownerId,
                    "Your explorers found " + gold + " gold in a goodie hut!");
        } else {
            // Tech reward: pick a random technology the player can research now.
            // Mirrors the "tech" branch in hut_enter_worker() / do_hut_effects().
            List<Long> researchable = new ArrayList<>();
            for (Map.Entry<Long, Technology> entry : techs.entrySet()) {
                long tid = entry.getKey();
                if (!player.hasTech(tid)
                        && net.freecivx.server.TechTools.canPlayerResearch(this, ownerId, tid)) {
                    researchable.add(tid);
                }
            }
            if (!researchable.isEmpty()) {
                long techId = researchable.get(random.nextInt(researchable.size()));
                Technology tech = techs.get(techId);
                net.freecivx.server.TechTools.giveTechToPlayer(this, ownerId, techId);
                server.sendPlayerInfoAll(player);
                Notify.notifyPlayer(this, server, ownerId,
                        "Your explorers discovered "
                                + (tech != null ? tech.getName() : "a new technology")
                                + " in a goodie hut!");
            } else {
                // No researchable technology available – fall back to gold
                int gold = MIN_HUT_GOLD;
                player.setGold(player.getGold() + gold);
                server.sendPlayerInfoAll(player);
                Notify.notifyPlayer(this, server, ownerId,
                        "Your explorers found " + gold + " gold in a goodie hut!");
            }
        }
    }
}
