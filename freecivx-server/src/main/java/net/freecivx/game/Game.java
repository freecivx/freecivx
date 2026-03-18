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


package net.freecivx.game;

import net.freecivx.server.IGameServer;
import net.freecivx.server.CityTools;
import net.freecivx.server.CityTurn;
import net.freecivx.server.Notify;
import net.freecivx.server.Packets;
import net.freecivx.server.VisibilityHandler;
import net.freecivx.ai.AiPlayer;
import net.freecivx.data.Ruleset;
import net.freecivx.data.ScenarioData;
import net.freecivx.data.ScenarioLoader;
import org.json.JSONArray;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.Random;
import java.util.Set;

/**
 * The Game class
 */
public class Game {

    private static final Logger log = LoggerFactory.getLogger(Game.class);

    IGameServer server;

    public long year = 0;
    public long turn = 0;
    public long phase = 0;
    boolean gameStarted = false;

    /**
     * When {@code true} this game runs as an MMO multiplayer session:
     * players may join at any time, and reconnecting players resume with
     * their previous nation.
     * When {@code false} (the default) this is a classic singleplayer game.
     */
    private boolean multiplayer = false;

    private static final int MAX_START_POSITION_ATTEMPTS = 200;
    /**
     * Delay in seconds before automatically restarting the game after a
     * victory condition is met.  Both singleplayer and multiplayer use this
     * value so that players have time to read the end-game summary.
     */
    static final int GAME_RESTART_DELAY_SECONDS = 60;
    /**
     * Base player-number for AI players.  All AI IDs are {@code AI_PLAYER_ID_BASE + i}
     * (e.g. 100, 101, …) which keeps them well below 255 – the upper limit checked by
     * the JavaScript border renderer in {@code borders.js}.  Human players receive
     * sequential connection IDs starting at 0 from the WebSocket server, so the range
     * 100–108 (max aifill = 9) avoids any conflict.
     */
    private static final long AI_PLAYER_ID_BASE = 100L;
    private long lastActivityTime = System.currentTimeMillis();
    private Random random = new Random();
    private AiPlayer aiPlayer;
    private Ruleset ruleset = new Ruleset();
    /** Tracks which human players have pressed end-turn this turn. */
    private final Set<Long> humanPlayersDone = new HashSet<>();

    /**
     * Tracks which username maps to which player-number (connId) within the
     * current game session.  Used in multiplayer mode so that a player who
     * disconnects and reconnects is re-attached to their existing cities/units
     * instead of starting from scratch.
     */
    private final Map<String, Long> usernameToPlayerNo = new HashMap<>();

    /**
     * Direction delta arrays used for goto path execution.
     * Indices 0-7 match the PathFinder direction encoding:
     * 0=NW(-1,-1), 1=N(0,-1), 2=NE(1,-1), 3=W(-1,0),
     * 4=E(1,0), 5=SW(-1,1), 6=S(0,1), 7=SE(1,1).
     */
    static final int[] GOTO_DIR_DX = {-1, 0, 1, -1, 1, -1, 0, 1};
    static final int[] GOTO_DIR_DY = {-1, -1, -1, 0, 0, 1, 1, 1};

    /**
     * Optional map generation seed.  When {@code >= 0} the same seed is
     * passed to {@link MapGenerator} so that the generated map is identical
     * across runs.  Mirrors the {@code mapseed} setting in the C Freeciv server.
     * Default {@code -1} produces a unique random map each game.
     */
    private int mapSeed = -1;

    /**
     * Map generator algorithm to use.
     * <ul>
     *   <li>2 – Fractal/fBM</li>
     *   <li>5 – Island/continent style with latitude-based terrain distribution,
     *           mirroring the spirit of the C Freeciv server's MAPGEN_FRACTURE (default)</li>
     * </ul>
     * Mirrors the {@code generator} setting in the C Freeciv server.
     */
    private int generator = 5;

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

    /**
     * Maximum turn number.  When {@code > 0} the game ends automatically at
     * the start of this turn (after incrementing the counter).
     * {@code 0} (default) disables the limit.
     * Mirrors the {@code endturn} setting in the C Freeciv server.
     */
    private int endTurn = 0;

    /**
     * Map topology bitmask sent to clients as {@code topology_id} in PACKET_MAP_INFO.
     * Mirrors the Freeciv topology flags:
     * <ul>
     *   <li>0 – square (default)</li>
     *   <li>2 – hex (TF_HEX; pure hexagonal, 6 neighbours)</li>
     * </ul>
     * TF_ISO = 1, TF_HEX = 2 (matches the JavaScript client constants).
     */
    private int topologyId = 0;

    /** Topology flag constant: isometric (mirrors JS {@code TF_ISO}). */
    public static final int TF_ISO = 1;
    /** Topology flag constant: hexagonal (mirrors JS {@code TF_HEX}). */
    public static final int TF_HEX = 2;

    /**
     * Turn timer used to implement the per-turn {@link #turnTimeout}.
     * Injected by the server via {@link #setTurnTimer(TurnTimer)};
     * {@code null} when turn timeouts are not needed.
     */
    private TurnTimer turnTimer = null;

    /**
     * Secondary timer used to send a turn-countdown warning message to all
     * players before the turn auto-advances.  Injected alongside
     * {@link #turnTimer}; {@code null} disables the warning.
     */
    private TurnTimer warningTimer = null;

    /**
     * Number of seconds before turn end at which a countdown warning is sent
     * to all players.  Only fires when {@link #turnTimeout} {@code > TURN_WARNING_SECONDS}.
     */
    static final int TURN_WARNING_SECONDS = 60;

    /**
     * Number of consecutive idle turns (no end-turn action) before a human
     * player's civilisation is handed over to the AI.
     * Mirrors the {@code idleturns} concept in the C Freeciv server.
     */
    static final int IDLE_TURNS_BEFORE_AI_TAKEOVER = 3;

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

    public Game(IGameServer server) {
        this.server = server;
        this.aiPlayer = new AiPlayer(this);
    }

    /** Returns the {@link IGameServer} instance this game is running on. */
    public IGameServer getServer() {
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
     * Sets the map generator algorithm.
     * <ul>
     *   <li>2 – Fractal/fBM (default)</li>
     *   <li>5 – Island/continent style with latitude-based terrain</li>
     * </ul>
     * Must be called before {@link #initGame()}.
     * Mirrors the {@code generator} setting in the C Freeciv server.
     *
     * @param generator generator type (2 or 5)
     */
    public void setGenerator(int generator) {
        this.generator = generator;
    }

    /** Returns the configured map generator type. */
    public int getGenerator() {
        return generator;
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
        MapGenerator mapGen = new MapGenerator(map.getXsize(), map.getYsize(), seed);
        tiles = (generator == 5) ? mapGen.generateIslandMap() : mapGen.generateMap();
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
     * Sets the turn at which the game automatically ends.
     * When {@code > 0} the game ends at the start of the given turn after
     * the turn counter is incremented.  Set to {@code 0} to disable.
     * Mirrors the {@code endturn} setting in the C Freeciv server.
     *
     * @param turn maximum turn number (0 = disabled, max 32767)
     */
    public void setEndTurn(int turn) {
        this.endTurn = turn;
    }

    /** Returns the configured end-turn limit (0 = disabled). */
    public int getEndTurn() {
        return endTurn;
    }

    /**
     * Sets the map topology bitmask.
     * Use {@link #TF_HEX} (2) for hexagonal topology or {@code 0} for square.
     * Must be called before the game starts (before {@link #initGame()}).
     *
     * @param topologyId topology bitmask (0 = square, 2 = hex)
     */
    public void setTopologyId(int topologyId) {
        this.topologyId = topologyId;
    }

    /** Returns the map topology bitmask (0 = square, 2 = hex). */
    public int getTopologyId() {
        return topologyId;
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

    /**
     * Injects the {@link TurnTimer} used for turn-timeout enforcement.
     * Must be called before the game starts if {@link #setTurnTimeout(int)} is
     * configured with a non-zero value.
     *
     * @param turnTimer the timer implementation to use for scheduling
     */
    public void setTurnTimer(TurnTimer turnTimer) {
        this.turnTimer = turnTimer;
    }

    /**
     * Injects the secondary {@link TurnTimer} used to send a turn-countdown
     * warning message {@link #TURN_WARNING_SECONDS} before auto-advance.
     *
     * @param warningTimer the timer implementation for the warning
     */
    public void setWarningTimer(TurnTimer warningTimer) {
        this.warningTimer = warningTimer;
    }

    /** Schedules a forced turn-end after {@link #turnTimeout} seconds, and
     *  optionally a countdown warning {@link #TURN_WARNING_SECONDS} before. */
    private synchronized void scheduleTurnTimeout() {
        if (turnTimeout <= 0 || turnTimer == null) return;
        // Schedule countdown warning if the timeout is long enough
        if (warningTimer != null && turnTimeout > TURN_WARNING_SECONDS) {
            final int warningDelay = turnTimeout - TURN_WARNING_SECONDS;
            warningTimer.schedule(() ->
                server.sendMessageAll("Turn ends in " + TURN_WARNING_SECONDS + " seconds."),
                warningDelay);
        }
        turnTimer.schedule(() -> {
            synchronized (Game.this) {
                humanPlayersDone.clear();
                turnDone();
            }
        }, turnTimeout);
    }

    /** Cancels any pending turn-timeout and warning tasks. */
    private synchronized void cancelTurnTimeout() {
        if (turnTimer != null) {
            turnTimer.cancel();
        }
        if (warningTimer != null) {
            warningTimer.cancel();
        }
    }

    /**
     * Initializes the game objects.  Game rules (unit types, technologies,
     * buildings, terrain, governments) are loaded from the classic ruleset
     * files bundled as classpath resources.  Throws {@link IllegalStateException}
     * if the ruleset cannot be loaded — the server cannot run without it.
     */
    public void initGame() {
        map = new WorldMap(65, 65);

        // --- Load ruleset from classpath resources ---
        boolean rulesetOk = ruleset.loadRuleset("classic");
        if (!rulesetOk) {
            throw new IllegalStateException(
                "Ruleset loading failed: cannot start server without valid game data.");
        }
        populateFromRuleset();

        // --- Nations: auto-discovered via *include directives in nations.ruleset ---
        List<Nation> rNations = ruleset.getNations();
        for (int i = 0; i < rNations.size(); i++) {
            nations.put((long) i, rNations.get(i));
        }

        // --- Extras: bit positions fixed by MapGenerator/client protocol; data from ruleset ---
        // Build a lookup map from the ruleset-loaded extras by their canonical name (lowercase).
        // Matches rule_name when set (e.g. "Hut", "Railroad") or display name otherwise.
        Map<String, Extra> nameToRulesetExtra = new HashMap<>();
        for (Extra re : ruleset.getExtras()) {
            nameToRulesetExtra.put(re.getName().toLowerCase(), re);
        }

        // Canonical names for each bit position 0-31.
        // These must match EXTRA_BIT_* in MapGenerator and the tile-extras protocol.
        // rule_name values ("Railroad", "Hut", "Oil Well") are used when the ruleset
        // stores them differently from what old code called ("Rail", "Hut", "Oil_well").
        // "Airport" (bit 13) is not defined in terrain.ruleset; it is kept as a
        // zero-causes placeholder for protocol completeness.
        String[] extraBitNames = {
            "River",      // bit  0
            "Mine",       // bit  1
            "Oil Well",   // bit  2  (rule_name of extra_oil_well)
            "Fallout",    // bit  3
            "Pollution",  // bit  4
            "Buoy",       // bit  5
            "Road",       // bit  6
            "Railroad",   // bit  7  (rule_name of extra_railroad)
            "Hut",        // bit  8  (rule_name of extra_hut)
            "Irrigation", // bit  9
            "Farmland",   // bit 10
            "Ruins",      // bit 11
            "Airbase",    // bit 12
            "Airport",    // bit 13  (not in terrain.ruleset; placeholder)
            "Fortress",   // bit 14
            "Cattle",     // bit 15
            "Game",       // bit 16
            "Wheat",      // bit 17
            "Buffalo",    // bit 18
            "Pheasant",   // bit 19
            "Coal",       // bit 20
            "Iron",       // bit 21
            "Gold",       // bit 22
            "Oasis",      // bit 23
            "Fish",       // bit 24
            "Whales",     // bit 25
            "Silk",       // bit 26
            "Fruit",      // bit 27
            "Gems",       // bit 28
            "Ivory",      // bit 29
            "Oil",        // bit 30  (resource, distinct from Oil Well infrastructure)
            "Wine",       // bit 31
        };
        for (int bit = 0; bit < extraBitNames.length; bit++) {
            String canonName = extraBitNames[bit];
            Extra rExtra = nameToRulesetExtra.get(canonName.toLowerCase());
            if (rExtra != null) {
                extras.put((long) bit, rExtra);
            } else {
                // The extra is not in the ruleset file (e.g. Airport at bit 13).
                // Create a minimal placeholder so the protocol slot is populated.
                extras.put((long) bit, new Extra(canonName));
            }
        }

        // --- City styles: loaded from styles.ruleset ---
        List<CityStyle> rStyles = ruleset.getCityStyles();
        if (rStyles.isEmpty()) {
            cityStyle.put(0L, new CityStyle("European"));
            cityStyle.put(1L, new CityStyle("Classical"));
            cityStyle.put(2L, new CityStyle("Tropical"));
            cityStyle.put(3L, new CityStyle("Asian"));
        } else {
            for (int i = 0; i < rStyles.size(); i++) {
                cityStyle.put((long) i, rStyles.get(i));
            }
        }

        // Use a seeded generator when mapSeed >= 0 (mirrors "mapseed" in C server).
        MapGenerator mapGen = mapSeed >= 0
                ? new MapGenerator(map.getXsize(), map.getYsize(), mapSeed)
                : new MapGenerator(map.getXsize(), map.getYsize());
        tiles = (generator == 5) ? mapGen.generateIslandMap() : mapGen.generateMap();
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
        server.sendMapInfoAll(map.getXsize(), map.getYsize(), topologyId);
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
        // AI player IDs must stay below 255 so the JavaScript border renderer
        // (which checks ptile['owner'] < 255) can display their national borders.
        // Use AI_PLAYER_ID_BASE + i to leave room for human players (connIds 0–99)
        // while still fitting within the 0–254 safe range for up to 9 AI players.
        for (int i = 0; i < aifill; i++) {
            long aiId = AI_PLAYER_ID_BASE + i;
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

        // Compute initial visibility for all human players and push TILE_KNOWN_SEEN
        // packets for their starting positions.  Done before unit/city sending so that
        // visibleTiles is populated and sendUnitToVisiblePlayers/sendCityToVisiblePlayers
        // can correctly filter which players receive each entity.
        players.values().stream()
                .filter(p -> !p.isAi())
                .forEach(p -> VisibilityHandler.updateAndSendVisibility(p, this));

        // Send city styles
        cityStyle.forEach((id, style) -> server.sendRulesetCityInfoAll(id, style.getName(), style.getName()));

        // Send units only to players who can currently see the unit's tile, plus
        // always to the unit's owner.  Replaces the unconditional broadcast so that
        // players never see foreign units on tiles they have not explored.
        units.forEach((id, unit) -> VisibilityHandler.sendUnitToVisiblePlayers(this, unit));

        // Send cities – CITY_INFO first so the client creates a proper City
        // instance before the lightweight CITY_SHORT_INFO arrives.
        // CityTools.sendCityInfo also sends PACKET_WEB_CITY_INFO_ADDITION with
        // can_build_unit / can_build_improvement bitvectors for the city dialog.
        // Only sent to the city owner and players who can see the city's tile.
        cities.forEach((id, city) -> VisibilityHandler.sendCityToVisiblePlayers(this, id));


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

    /** Returns {@code true} when this server is running in multiplayer MMO mode. */
    public boolean isMultiplayer() {
        return multiplayer;
    }

    /**
     * Sets the game mode.  Must be called before {@link #initGame()} or
     * {@link #startGame()}.
     *
     * @param multiplayer {@code true} for MMO multiplayer, {@code false} for singleplayer
     */
    public void setMultiplayer(boolean multiplayer) {
        this.multiplayer = multiplayer;
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
            long aiId = AI_PLAYER_ID_BASE + i;
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

        // Resolve improvement technology requirement names to IDs using the loaded tech map.
        // Mirrors the same req-resolution done for unit types above.
        // Buildings have techReqId=-1 from the parser since technologies are loaded
        // separately; this pass converts the stored techReqName strings to numeric IDs.
        for (Improvement impr : improvements.values()) {
            String reqName = impr.getTechReqName();
            if (reqName != null && !reqName.isEmpty()) {
                Long techId = techNameToId.get(reqName.toLowerCase());
                if (techId != null) {
                    impr.setTechReqId(techId);
                }
            }
        }
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

        // Reset the idle counter – the player is actively participating.
        player.setNturnsIdle(0);

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

        // Track idle human players: those who did NOT press end-turn this cycle.
        // Increment their idle counter; convert to AI when the threshold is reached.
        // Mirrors the C Freeciv server's idleout.c / srv_main.c idle handling.
        List<Long> idleConversions = new ArrayList<>();
        for (Player p : players.values()) {
            if (p.isAi() || !p.isAlive()) continue;
            if (!humanPlayersDone.contains(p.getPlayerNo())) {
                p.setNturnsIdle(p.getNturnsIdle() + 1);
                if (p.getNturnsIdle() >= IDLE_TURNS_BEFORE_AI_TAKEOVER) {
                    idleConversions.add(p.getPlayerNo());
                }
            }
        }
        // Perform AI conversions after iterating to avoid ConcurrentModificationException.
        for (long pid : idleConversions) {
            convertPlayerToAi(pid);
        }

        // Reset movement points for all units and send the new state only to
        // players who can see the unit's tile, so that fog-of-war is respected.
        units.forEach((id, unit) -> {
            UnitType utype = unitTypes.get((long) unit.getType());
            if (utype != null) {
                unit.setMovesleft(utype.getMoveRate());
                unit.setDoneMoving(false);
                VisibilityHandler.sendUnitToVisiblePlayers(this, unit);
            }
        });

        // Continue executing pending goto paths for human-player units now that
        // movement points have been restored.  AI units manage their own movement
        // inside runAiTurns() and do not use the gotoPath queue.
        // Mirrors the server-side order execution loop in C Freeciv's
        // server/unittools.c::execute_unit_orders().
        units.forEach((id, unit) -> {
            Player owner = players.get(unit.getOwner());
            if (owner == null || owner.isAi()) return;
            // Auto-explore: compute next step toward the nearest unexplored tile
            // before executing the path, so the goto path is always fresh.
            if (unit.getSsa_controller() == Packets.SSA_AUTOEXPLORE) {
                UnitType utype = unitTypes.get((long) unit.getType());
                autoExploreUnit(unit, utype);
            }
            if (!unit.getGotoPath().isEmpty()) {
                executeGotoPath(unit);
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

        // Broadcast current scores to all clients so the scoreboard stays up to date.
        sendScores();

        // Refresh fog of war for all human players at the start of each new turn.
        // This catches any visibility changes caused by city growth (new worked
        // tiles), border updates, or other end-of-turn effects.
        // Mirrors update_player_visibility() called at turn start in C Freeciv.
        players.values().stream()
                .filter(p -> !p.isAi() && p.isAlive())
                .forEach(p -> VisibilityHandler.updateAndSendVisibility(p, this));

        // Re-arm the turn-timeout timer for the new turn.
        if (turnTimeout > 0) {
            scheduleTurnTimeout();
        }

        // Check the end-turn limit after all other processing is complete.
        if (endTurn > 0 && turn >= endTurn) {
            endGame();
        }
    }

    /**
     * Ends the game when a victory condition is met.
     * Reveals the entire map to all human players and schedules an automatic
     * restart after {@link #GAME_RESTART_DELAY_SECONDS} seconds.  Mirrors the
     * {@code end_turn} / {@code check_for_game_over()} logic in the C Freeciv
     * server's {@code server/srv_main.c}.
     */
    public void endGame() {
        log.info("Game over at turn {}.", turn);
        net.freecivx.server.VisibilityHandler.revealMapToAll(this);
        server.scheduleGameRestart(GAME_RESTART_DELAY_SECONDS);
    }

    /**
     * Converts a human player to AI control.  Called when the player
     * disconnects or remains idle for too many consecutive turns.
     * The player's cities and units are kept intact; only the control type
     * changes.  All other clients are notified via chat and updated player
     * info so they can see the AI flag in their scoreboard.
     *
     * <p>Mirrors the AI-takeover logic in the C Freeciv server's
     * {@code srv_main.c:handle_conn_close()} and {@code idleout.c}.
     *
     * @param connId the connection ID of the player to convert
     */
    public synchronized void convertPlayerToAi(long connId) {
        Player player = players.get(connId);
        if (player == null || player.isAi() || !player.isAlive()) return;
        player.setAi(true);
        player.setNturnsIdle(0);
        player.setConnected(false);
        log.info("Player {} converted to AI control.", player.getUsername());
        server.sendMessageAll(player.getUsername() + "'s civilization is now managed by AI.");
        server.sendPlayerInfoAll(player);
    }

    /**
     * Computes a civilisation score for the given player.
     * Mirrors the formula used by the C Freeciv server's {@code score.c}
     * ({@code get_civ_score()}):
     * <ul>
     *   <li>Population: sum of city sizes (primary growth metric)</li>
     *   <li>Cities: number of cities × 5</li>
     *   <li>Techs: number of known technologies × 2</li>
     *   <li>Gold: treasury balance ÷ 10 (floored at 0)</li>
     *   <li>Alive bonus: +50 for civilisations still in the game</li>
     * </ul>
     *
     * @param player the player to score
     * @return a non-negative integer score
     */
    public long computeScore(Player player) {
        // Collect the player's cities once and derive both pop and city-count.
        long pid = player.getPlayerNo();
        long[] stats = cities.values().stream()
                .filter(c -> c.getOwner() == pid)
                .collect(java.util.stream.Collectors.teeing(
                        java.util.stream.Collectors.summingLong(City::getSize),
                        java.util.stream.Collectors.counting(),
                        (pop, cnt) -> new long[]{pop, cnt}));
        long popScore  = stats[0];
        long cityScore = stats[1] * 5L;
        long techScore = player.getKnownTechs().size() * 2L;
        long goldScore = Math.max(0, player.getGold()) / 10L;
        long aliveBonus = player.isAlive() ? 50L : 0L;
        return popScore + cityScore + techScore + goldScore + aliveBonus;
    }

    /**
     * Broadcasts current civilisation scores to all connected clients using
     * {@code PACKET_PLAYER_SCORE}.  Called at the end of each turn so that
     * players can track relative progress on their scoreboard.
     */
    public void sendScores() {
        for (Player p : players.values()) {
            server.sendPlayerScoreAll(p.getPlayerNo(), computeScore(p));
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
        // Changing the unit's activity cancels any pending goto path.
        unit.getGotoPath().clear();
        VisibilityHandler.sendUnitToVisiblePlayers(this, unit);
    }

    /**
     * Sets the server-side agent controller for a unit and notifies the
     * owning client.  When {@code agent} is {@link Packets#SSA_AUTOEXPLORE}
     * the unit will automatically explore toward unknown tiles each turn.
     * Setting {@code agent} to {@link Packets#SSA_NONE} cancels automation.
     *
     * <p>Mirrors {@code unit_server_side_agent_set()} in the C Freeciv
     * server's {@code server/unithand.c}.
     *
     * @param unit_id the ID of the unit to update
     * @param agent   the new {@code SSA_*} agent value
     */
    public void setUnitSsaController(long unit_id, int agent) {
        Unit unit = units.get(unit_id);
        if (unit == null) return;
        unit.setSsa_controller(agent);
        // Cancel any pending manual goto so the new auto-explore direction
        // takes effect from the start of the next turn.
        unit.getGotoPath().clear();
        VisibilityHandler.sendUnitToVisiblePlayers(this, unit);
    }

    /**
     * Computes and queues one turn's worth of movement for an auto-exploring
     * unit toward the nearest tile that the owning player has not yet seen.
     * Uses a breadth-first search (BFS) from the unit's current tile to find
     * the closest unexplored tile, then reconstructs the first step of that
     * path and stores it as the unit's goto path so that
     * {@link #executeGotoPath(Unit)} will carry the unit there.
     *
     * <p>If the entire map is already explored (no {@code TILE_UNKNOWN}
     * tiles remain adjacent to explored territory) the unit's
     * {@code ssa_controller} is reset to {@link Packets#SSA_NONE} and the
     * unit stops.  This mirrors the C Freeciv server behaviour where
     * {@code auto_explore_land_modifier()} stops the unit when no unexplored
     * tiles remain reachable.
     *
     * @param unit  the auto-exploring unit
     * @param utype the unit type (used for domain / terrain checks)
     */
    public void autoExploreUnit(Unit unit, UnitType utype) {
        if (map == null) return;
        Player owner = players.get(unit.getOwner());
        if (owner == null) return;

        // BFS: each entry is [tileId, firstDir] where firstDir is the
        // direction taken from the unit's starting tile to reach this tile.
        Queue<long[]> queue = new ArrayDeque<>();
        Set<Long> visited = new HashSet<>();

        long startTile = unit.getTile();
        visited.add(startTile);

        // Seed the queue with all valid first steps from the unit's tile.
        for (int dir = 0; dir < 8; dir++) {
            int neighborId = nextTileInDirection(startTile, dir);
            if (neighborId < 0) continue;
            Tile neighborTile = tiles.get((long) neighborId);
            if (neighborTile == null) continue;

            // Domain check: land units skip ocean tiles (terrain 2=Ocean, 3=Deep Ocean);
            // sea units skip land.
            int terrain = neighborTile.getTerrain();
            boolean isOcean = (terrain == 2 || terrain == 3);
            if (utype != null && utype.getDomain() == 0 && isOcean) continue;
            if (utype != null && utype.getDomain() == 1 && !isOcean) continue;

            if (!visited.contains((long) neighborId)) {
                visited.add((long) neighborId);
                queue.add(new long[]{neighborId, dir});
            }
        }

        // BFS expansion – find the nearest unexplored tile.
        while (!queue.isEmpty()) {
            long[] current = queue.poll();
            long tileId = current[0];
            int firstDir = (int) current[1];

            int known = VisibilityHandler.getKnownForPlayer(owner, tileId);
            if (known == VisibilityHandler.TILE_UNKNOWN) {
                // Found an unexplored tile – queue a one-step goto toward it.
                unit.getGotoPath().clear();
                unit.getGotoPath().add(firstDir);
                return;
            }

            // Continue BFS through known tiles to reach unexplored territory.
            for (int dir = 0; dir < 8; dir++) {
                int nextId = nextTileInDirection(tileId, dir);
                if (nextId < 0) continue;
                if (visited.contains((long) nextId)) continue;
                Tile nextTile = tiles.get((long) nextId);
                if (nextTile == null) continue;

                int terrain = nextTile.getTerrain();
                boolean isOcean = (terrain == 2 || terrain == 3);
                if (utype != null && utype.getDomain() == 0 && isOcean) continue;
                if (utype != null && utype.getDomain() == 1 && !isOcean) continue;

                visited.add((long) nextId);
                queue.add(new long[]{nextId, firstDir});
            }
        }

        // No unexplored tile found – the map is fully explored.  Stop the
        // auto-explore mode so the unit is returned to player control.
        unit.setSsa_controller(Packets.SSA_NONE);
        VisibilityHandler.sendUnitToVisiblePlayers(this, unit);
    }
    /**
     * Computes the tile ID that is one step in the given direction from
     * {@code fromTile}, wrapping horizontally on cylindrical maps.
     * Direction indices use PathFinder encoding (0=NW … 7=SE).
     *
     * @param fromTile source tile index
     * @param dir      direction index (0-7)
     * @return the neighbouring tile index, or {@code -1} if out of bounds
     */
    public int nextTileInDirection(long fromTile, int dir) {
        if (map == null || dir < 0 || dir > 7) return -1;
        // Reject directions that are invalid for the current topology.
        boolean isHex = (topologyId & TF_HEX) != 0;
        boolean isIso = (topologyId & TF_ISO) != 0;
        if (isHex) {
            if (!isIso && (dir == 0 || dir == 7)) return -1; // pure hex: NW/SE invalid
            if (isIso  && (dir == 2 || dir == 5)) return -1; // iso-hex: NE/SW invalid
        }
        int xsize = map.getXsize();
        int ysize = map.getYsize();
        int x = (int)(fromTile % xsize);
        int y = (int)(fromTile / xsize);
        int nx = ((x + GOTO_DIR_DX[dir]) % xsize + xsize) % xsize;
        int ny = y + GOTO_DIR_DY[dir];
        if (ny < 0 || ny >= ysize) return -1;
        return ny * xsize + nx;
    }

    /**
     * Executes the unit's pending goto path for the current turn, moving as
     * far as possible given the unit's remaining movement points.  Steps that
     * cannot be executed (blocked terrain, enemy unit, etc.) cause the path to
     * be cleared so the unit stops cleanly.
     *
     * <p>Mirrors the server-side order execution in {@code unithand.c /
     * server/unittools.c} in the C Freeciv server where a unit with pending
     * orders moves each turn until the orders list is exhausted or blocked.
     *
     * @param unit the unit to advance along its goto path
     */
    public void executeGotoPath(Unit unit) {
        List<Integer> path = unit.getGotoPath();
        while (!path.isEmpty() && unit.getMovesleft() > 0) {
            int dir = path.get(0);
            int nextTile = nextTileInDirection(unit.getTile(), dir);
            if (nextTile < 0) {
                // Direction leads off the map edge — cancel the goto.
                path.clear();
                return;
            }
            boolean moved = moveUnit(unit.getId(), nextTile, dir);
            if (moved) {
                path.remove(0);
            } else {
                // Movement was blocked (terrain, ZOC, enemy) — cancel the goto
                // so the unit does not endlessly retry the same blocked step.
                log.debug("Goto path cancelled for unit {} at tile {}: movement blocked",
                        unit.getId(), unit.getTile());
                path.clear();
                return;
            }
        }
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

        // Moving cancels any in-progress terrain improvement activity and any
        // fortification status.  Mirrors the C Freeciv server's behaviour where
        // a unit order (move) calls unit_activity_handling(punit, ACTIVITY_IDLE)
        // which resets both activity and activity_count regardless of the
        // current state — fortified units are un-fortified when they move.
        if (unit.getActivity() == net.freecivx.server.CityTurn.ACTIVITY_ROAD
                || unit.getActivity() == net.freecivx.server.CityTurn.ACTIVITY_IRRIGATE
                || unit.getActivity() == net.freecivx.server.CityTurn.ACTIVITY_MINE
                || unit.getActivity() == net.freecivx.server.CityTurn.ACTIVITY_FORTIFIED
                || unit.getActivity() == net.freecivx.server.CityTurn.ACTIVITY_RAILROAD) {
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

        VisibilityHandler.sendUnitToVisiblePlayers(this, unit);

        // Update the owning player's fog-of-war after the move so tiles
        // newly entered enter TILE_KNOWN_SEEN and tiles left become TILE_KNOWN_UNSEEN.
        // Mirrors update_player_visibility() called from unithand.c in C Freeciv.
        Player movingPlayer = players.get(unit.getOwner());
        if (movingPlayer != null && !movingPlayer.isAi()) {
            VisibilityHandler.updateAndSendVisibility(movingPlayer, this);
        }

        return true;
    }

    /**
     * Adds a new human player to the game.
     *
     * <p>In multiplayer mode this method also handles mid-game reconnection:
     * if a player with the same {@code username} already has an active entry
     * in {@link #usernameToPlayerNo} (i.e. they disconnected and are rejoining
     * the same running game) their existing {@link Player} object is moved to
     * the new {@code connId} and all their units/cities are re-attributed to
     * the new connection so gameplay can resume seamlessly.
     *
     * @param connId         the WebSocket connection ID for this join request
     * @param username       the player's display name
     * @param addr           the player's remote address
     * @param previousNation the nation index to reuse (for multiplayer returning
     *                       players across game restarts), or {@code null} to
     *                       assign a random nation
     */
    public void addPlayer(long connId, String username, String addr, Integer previousNation) {
        // --- Multiplayer in-session rejoin ---
        if (multiplayer && usernameToPlayerNo.containsKey(username)) {
            long oldPlayerNo = usernameToPlayerNo.get(username);
            Player oldPlayer = players.get(oldPlayerNo);
            if (oldPlayer != null && oldPlayerNo != connId) {
                // Re-attach the existing player object to the new connection.
                players.remove(oldPlayerNo);
                oldPlayer.setConnectionId(connId);
                players.put(connId, oldPlayer);

                // Reassign all units and cities from old player number to new.
                final long op = oldPlayerNo;
                units.values().stream()
                        .filter(u -> u.getOwner() == op)
                        .forEach(u -> u.setOwner(connId));
                cities.values().stream()
                        .filter(c -> c.getOwner() == op)
                        .forEach(c -> c.setOwner(connId));

                usernameToPlayerNo.put(username, connId);
                server.sendMessageAll(username + " has rejoined the game.");
                players.forEach((id, iplayer) -> server.sendPlayerInfoAll(iplayer));
                players.forEach((id, iplayer) -> server.sendPlayerInfoAdditionAll(id, 0));
                connections.forEach((id, conn) -> server.sendConnInfoAll(id, conn.getUsername(), conn.getIp(), conn.getPlayerNo()));
                return;
            }
        }

        // --- Normal first join ---
        int nation = (previousNation != null) ? previousNation : random.nextInt(3);
        Player player = new Player(connId, username, addr, nation);
        players.put(connId, player);
        usernameToPlayerNo.put(username, connId);
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

        // Report diplomatic incident before combat so AI love values are updated
        // regardless of combat outcome.  Mirrors dai_incident() in daidiplomacy.c.
        aiPlayer.reportIncident(attacker.getOwner(), defender.getOwner());

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
        // Great Wall wonder acts as City Walls for all cities of the owner:
        // mirrors effect_great_wall (Defend_Bonus=50, Building:City_Walls absent → Player scope)
        // in the classic Freeciv effects.ruleset.
        int cityWallsBonus = 0;
        if (defenderTile != null && defenderTile.getWorked() > 0) {
            City defCity = cities.get(defenderTile.getWorked());
            if (defCity != null) {
                if (defCity.getWalls() > 0) {
                    cityWallsBonus = 50;
                } else if (CityTurn.playerHasWonder(this, defCity.getOwner(), "Great Wall")) {
                    // Great Wall provides city-walls defence bonus to all cities of the owner
                    cityWallsBonus = 50;
                }
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

        // Consume one move point for the attack.
        // Attacking also breaks any fortification status, mirroring the
        // C Freeciv server's behaviour where unit_activity_handling(ACTIVITY_IDLE)
        // is called whenever a unit receives a new order (attack or move).
        attacker.setMovesleft(Math.max(0, attacker.getMovesleft() - 1));
        if (attacker.getActivity() == net.freecivx.server.CityTurn.ACTIVITY_FORTIFIED) {
            attacker.setActivity(0);
            attacker.setActivityCount(0);
        }

        if (attackerWins) {
            // Winner may gain a veteran level — mirrors maybe_make_veteran() in C server.
            boolean promoted = Combat.maybePromoteVeteran(attacker, attackerType);
            units.remove(defenderId);
            server.sendUnitRemove(defenderId);

            // Notify both players of the combat outcome.
            // Mirrors notify_player() calls in unithand.c (E_UNIT_WIN_ATT / E_UNIT_LOST_DEF).
            Notify.notifyPlayer(this, server, attacker.getOwner(),
                    "Your " + attackerName + " defeated the enemy " + defenderName + ".");
            Notify.notifyPlayer(this, server, defender.getOwner(),
                    "Your " + defenderName + " was defeated by the enemy " + attackerName + ".");

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

            VisibilityHandler.sendUnitToVisiblePlayers(this, attacker);
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
            VisibilityHandler.sendUnitToVisiblePlayers(this, defender);

            // Notify both players of the combat outcome.
            // Mirrors notify_player() calls in unithand.c (E_UNIT_LOST_ATT / E_UNIT_WIN_DEF).
            Notify.notifyPlayer(this, server, attacker.getOwner(),
                    "Your attacking " + attackerName + " was defeated by the enemy " + defenderName + ".");
            Notify.notifyPlayer(this, server, defender.getOwner(),
                    "Your " + defenderName + " successfully defended against the enemy " + attackerName + ".");
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
        // Register the city centre as the first worked tile.
        city.addWorkedTile(tile_id);

        // Classic Freeciv: city centre tiles automatically get a road
        // (extra_road flag "AutoOnCityCenter" in terrain.ruleset).
        // This gives the city its road-based trade bonus immediately on founding.
        tile.setExtras(tile.getExtras() | (1 << net.freecivx.server.CityTurn.EXTRA_BIT_ROAD));

        server.sendTileInfoAll(tile);

        // Update national borders to include this city's territory.
        net.freecivx.server.CityTurn.updateBorders(this);

        // Send the new city to all players who can currently see the tile.
        // The city owner can always see their own city; other players see it
        // only if it is within their field of view.
        VisibilityHandler.sendCityToVisiblePlayers(this, id);

        // Notify the founding player — mirrors notify_player(E_CITY_BUILD) in
        // the C Freeciv server's server/citytools.c: "You have founded %s."
        Notify.notifyPlayer(this, server, owner, "You have founded " + city_name + ".");

        server.sendUnitRemove(unit_id);
        units.remove(unit_id);

        // A newly founded city expands the player's vision radius to 2 tiles.
        // Refresh visibility so the surrounding area becomes visible immediately.
        // Mirrors the C Freeciv server calling update_player_visibility() after
        // city_build_do_it() in cityhand.c.
        Player cityOwner = players.get(owner);
        if (cityOwner != null && !cityOwner.isAi()) {
            VisibilityHandler.updateAndSendVisibility(cityOwner, this);
        }
    }

    public void syncNewPlayer(long connId) {
        Player player = players.get(connId);
        if (player == null) return;

        // Only spawn starting units if the player doesn't already have units
        // (e.g. rejoining a game they previously left).
        boolean playerHasUnits = units.values().stream()
                .anyMatch(u -> u.getOwner() == player.getPlayerNo());
        if (!playerHasUnits) {
            long startPos = findStartPosition();
            spawnStartingUnits(player, startPos);
        }

        // Compute the late-joiner's visibility BEFORE sendGameStateTo so the
        // tile packets sent there already carry correct known values.
        if (!player.isAi()) {
            VisibilityHandler.updateAndSendVisibility(player, this);
        }

        // Send full current game state to just this player
        server.sendGameStateTo(connId);

        // Send the new player's units to players who can see the tile.
        // Using sendUnitToVisiblePlayers ensures that existing players only see
        // the new player's units if the units are in their field of view.
        units.values().stream()
                .filter(u -> u.getOwner() == player.getPlayerNo())
                .forEach(u -> VisibilityHandler.sendUnitToVisiblePlayers(this, u));

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
            // Clear worked status on all tiles this city was working.
            for (long workedTileId : city.getWorkedTiles()) {
                Tile wt = tiles.get(workedTileId);
                if (wt != null) {
                    wt.setWorked(-1);
                    server.sendTileInfoAll(wt);
                }
            }
            cityTile.setWorked(-1);
            server.sendTileInfoAll(cityTile);
            // removeCity() removes from game.cities and sends remove packet to clients.
            net.freecivx.server.CityTools.removeCity(this, cityId);
            // Recalculate borders after city removal
            net.freecivx.server.CityTurn.updateBorders(this);
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
            VisibilityHandler.sendCityToVisiblePlayers(this, cityId);
            // Recalculate borders after ownership change
            net.freecivx.server.CityTurn.updateBorders(this);
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

        // Check if only one civilisation remains alive.  When that happens the
        // survivor is declared the winner and the game ends with the standard
        // 60-second restart countdown.  This mirrors check_for_game_over() in
        // the C Freeciv server's srv_main.c.
        List<Player> alive = players.values().stream()
                .filter(Player::isAlive)
                .collect(java.util.stream.Collectors.toList());
        if (alive.size() == 1 && gameStarted) {
            Player victor = alive.get(0);
            server.sendMessageAll(victor.getUsername() + " has won the game!");
            endGame();
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
