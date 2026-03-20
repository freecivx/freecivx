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

package net.freecivx.server;

import net.freecivx.game.*;
import org.apache.commons.text.StringEscapeUtils;
import org.apache.commons.lang3.StringUtils;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.json.JSONArray;
import org.json.JSONObject;

import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class CivServer extends org.java_websocket.server.WebSocketServer implements IGameServer {

    private static final Logger log = LoggerFactory.getLogger(CivServer.class);

    private static final String SERVER_VERSION = "1.0";

    private final ConcurrentHashMap<Long, WebSocket> clients = new ConcurrentHashMap<>();
    private final AtomicInteger clientIdGenerator = new AtomicInteger(1);
    private long lastActivityTime = System.currentTimeMillis();
    private final net.freecivx.game.TurnTimer turnTimer = createTurnTimer();
    private final net.freecivx.game.TurnTimer warningTimer = createTurnTimer();
    Game game = null;

    /** Game mode: "singleplayer" or "multiplayer". */
    private final String gameMode;

    /** Map topology (0 = square, {@link net.freecivx.game.Game#TF_HEX} = hex). */
    private final int topologyId;

    /**
     * Persists username → nation across game resets in multiplayer mode so
     * that returning players are given back their original nation.
     */
    private final ConcurrentHashMap<String, Integer> usernameToNation = new ConcurrentHashMap<>();

    /** Creates the server-side {@link net.freecivx.game.TurnTimer} backed by a single-threaded scheduler. */
    private static net.freecivx.game.TurnTimer createTurnTimer() {
        ScheduledExecutorService sched = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "turn-timeout");
            t.setDaemon(true);
            return t;
        });
        return new net.freecivx.game.TurnTimer() {
            private ScheduledFuture<?> pending = null;

            @Override
            public synchronized void schedule(Runnable task, int delaySeconds) {
                if (pending != null) pending.cancel(false);
                pending = sched.schedule(task, delaySeconds, TimeUnit.SECONDS);
            }

            @Override
            public synchronized void cancel() {
                if (pending != null) {
                    pending.cancel(false);
                    pending = null;
                }
            }
        };
    }

    public CivServer(InetSocketAddress address, String gameMode, int topologyId) {
        super(address);
        this.gameMode = gameMode;
        this.topologyId = topologyId;
        this.setReuseAddr(true);
        game = new Game(this);
        game.setTurnTimer(turnTimer);
        game.setWarningTimer(warningTimer);
        game.setMultiplayer("multiplayer".equals(gameMode));
        game.setTopologyId(topologyId);
        game.initGame();

    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        long clientId = (clientIdGenerator.getAndIncrement()) - 1;
        clients.put(clientId, conn);
        conn.setAttachment(clientId); // Attach the client ID to the connection
        log.info("New connection (ID: {}): {}", clientId, conn.getRemoteSocketAddress());

        long humanCount = game.players.values().stream().filter(p -> !p.isAi()).count();
        String welcomeMsg = String.format(
                "Welcome to Freecivx server! This is the new Freeciv server, running on Java. Development version.  " +
                "Version: %s | Players connected: %d | " +
                "Game started: %s | Your connection ID: %d",
                SERVER_VERSION,
                humanCount,
                game.isGameStarted() ? "yes (turn " + game.turn + ")" : "no",
                clientId);
        sendMessage(clientId, welcomeMsg);

    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        long clientId = conn.getAttachment();
        clients.remove(clientId);
        log.info("Connection closed (ID: {}): {}", clientId, conn.getRemoteSocketAddress());

        // In multiplayer, if the game is running and the disconnecting client
        // had an active player, mark them disconnected and convert to AI so the
        // game can continue.  They may reconnect later and will resume control
        // of their civilization via the reconnect logic in Game.addPlayer().
        net.freecivx.game.Player player = game.players.get(clientId);
        if (player != null && !player.isAi()) {
            if (game.isGameStarted()) {
                // Hand over to AI so the turn can advance even without this player.
                // convertPlayerToAi() also sets connected=false internally.
                game.convertPlayerToAi(clientId);
            } else {
                // Game not yet started: mark offline and notify the lobby.
                player.setConnected(false);
                sendMessageAll(player.getUsername() + " has left the lobby.");
                sendPlayerInfoAll(player);
            }
        }
    }

    @Override
    public void onMessage(WebSocket conn, String packet) {
        log.debug("Message received: {}", packet);
        long connId = conn.getAttachment();
        lastActivityTime = System.currentTimeMillis();
        Connection connection = game.connections.get(connId);

        JSONObject json = new JSONObject(packet);
        int pid = json.optInt("pid");

        if (pid == Packets.PACKET_SERVER_JOIN_REQ) {
            String username = StringUtils.capitalize(StringEscapeUtils.escapeHtml4(StringUtils.capitalize(json.optString("username"))));
            JSONObject reply = new JSONObject();
            reply.put("pid", Packets.PACKET_SERVER_JOIN_REPLY);
            reply.put("you_can_join", true);
            reply.put("conn_id", connId);
            conn.send(reply.toString());
            game.addConnection(connId, username, connId, conn.getRemoteSocketAddress().toString());
            Integer previousNation = "multiplayer".equals(gameMode) ? usernameToNation.get(username) : null;
            game.addPlayer(connId, username, conn.getRemoteSocketAddress().toString(), previousNation);
            // Mark the player as connected so the client-side player list shows the correct status.
            net.freecivx.game.Player joinedPlayer = game.players.get(connId);
            if (joinedPlayer != null) {
                joinedPlayer.setConnected(true);
                // In multiplayer, a reconnecting AI player resumes human control.
                joinedPlayer.setAi(false);
            }
            // Persist the nation chosen for this player so it survives game restarts.
            if ("multiplayer".equals(gameMode)) {
                net.freecivx.game.Player p = game.players.get(connId);
                if (p != null) {
                    usernameToNation.put(username, p.getNation());
                }
            }
        }

        if (pid == Packets.PACKET_PLAYER_READY) {
            if (game.isGameStarted()) {
                game.syncNewPlayer(connId);
            } else {
                game.startGame();
            }
        }

        if (pid == Packets.PACKET_PLAYER_PHASE_DONE) {
            game.playerEndTurn(connId);
        }

        if (pid == Packets.PACKET_UNIT_ORDERS) {
            var ORDER_MOVE = 0;
            var ORDER_FULL_MP = 2;
            var ORDER_ACTION_MOVE = 3;
            int unit_id = json.optInt("unit_id");
            int dest_tile = json.optInt("dest_tile");
            JSONArray ordersArray = json.optJSONArray("orders");
            Unit orderUnit = game.units.get((long) unit_id);
            if (orderUnit != null && ordersArray != null && ordersArray.length() > 0) {
                Player orderPlayer = game.players.get(orderUnit.getOwner());
                if (orderPlayer != null && orderPlayer.getConnectionId() == connId) {
                    JSONObject firstOrder = ordersArray.getJSONObject(0);
                    int order = firstOrder.optInt("order");
                    int dir = firstOrder.optInt("dir");

                    if (order == ORDER_ACTION_MOVE && ordersArray.length() == 1) {
                        // Simple single-tile move: clear any pending goto and move one step.
                        orderUnit.getGotoPath().clear();
                        game.moveUnit(unit_id, dest_tile, dir);
                    } else {
                        // Multi-step goto (or a single ORDER_MOVE step): collect all
                        // direction indices from the orders array and store them as the
                        // unit's goto path.  The server then executes as many steps as
                        // the unit's current movement points allow, and the remainder is
                        // stored for automatic continuation on the next turn.
                        // Mirrors the unit_orders queue handling in the C Freeciv server's
                        // unithand.c / server/unittools.c.
                        List<Integer> gotoPath = new java.util.ArrayList<>();
                        for (int i = 0; i < ordersArray.length(); i++) {
                            JSONObject o = ordersArray.getJSONObject(i);
                            int stepOrder = o.optInt("order");
                            int stepDir   = o.optInt("dir");
                            if (stepOrder == ORDER_MOVE || stepOrder == ORDER_ACTION_MOVE) {
                                gotoPath.add(stepDir);
                            }
                        }
                        orderUnit.setGotoPath(gotoPath);
                        game.executeGotoPath(orderUnit);
                    }
                }
            }
        }

        if (pid == Packets.PACKET_CITY_NAME_SUGGESTION_REQ) {
            int unit_id = json.optInt("unit_id");
            CityHand.handleCityNameSuggestionReq(game, connId, unit_id);
        }

        // Handle PACKET_CITY_CHANGE (35): client selects new production for a city.
        // The packet carries production_kind (VUT_UTYPE=6 or VUT_IMPROVEMENT=3)
        // and production_value (unit type ID or improvement ID).
        // Mirrors handle_city_change() in the C Freeciv server's cityhand.c.
        if (pid == Packets.PACKET_CITY_CHANGE) {
            int city_id = json.optInt("city_id");
            int production_kind = json.optInt("production_kind");
            int production_value = json.optInt("production_value");
            CityHand.handleCityChangeProductionRequest(game, connId, city_id,
                    production_kind, production_value);
        }

        // Handle PACKET_CITY_WORKLIST (36): client sets the production queue for a city.
        // The packet carries city_id and a worklist array of {kind, value} objects,
        // where kind uses VUT constants (VUT_UTYPE=6 or VUT_IMPROVEMENT=3).
        // Mirrors handle_city_worklist() in the C Freeciv server's cityhand.c.
        if (pid == Packets.PACKET_CITY_WORKLIST) {
            int city_id = json.optInt("city_id");
            JSONArray worklist = json.optJSONArray("worklist");
            if (worklist == null) worklist = new JSONArray();
            CityHand.handleCityWorklistRequest(game, connId, city_id, worklist);
        }

        // Handle PACKET_CITY_BUY (34): client requests instant-buy of current production.
        if (pid == Packets.PACKET_CITY_BUY) {
            int city_id = json.optInt("city_id");
            CityHand.handleCityBuyRequest(game, connId, city_id);
        }

        // Handle PACKET_CITY_MAKE_SPECIALIST (37): client moves a worker off a tile.
        // Mirrors handle_city_make_specialist() in the C Freeciv server's cityhand.c.
        if (pid == Packets.PACKET_CITY_MAKE_SPECIALIST) {
            int city_id = json.optInt("city_id");
            int tile_id = json.optInt("tile_id");
            CityHand.handleCityMakeSpecialist(game, connId, city_id, tile_id);
        }

        // Handle PACKET_CITY_MAKE_WORKER (38): client assigns a citizen to work a tile.
        // Mirrors handle_city_make_worker() in the C Freeciv server's cityhand.c.
        if (pid == Packets.PACKET_CITY_MAKE_WORKER) {
            int city_id = json.optInt("city_id");
            int tile_id = json.optInt("tile_id");
            CityHand.handleCityMakeWorker(game, connId, city_id, tile_id);
        }

        // Handle PACKET_WEB_CMA_SET (257): client enables the city governor with new parameters.
        // Parses the cm_parameter object and stores it on the city, then immediately
        // applies the governor to reassign workers.  Mirrors handle_web_cma_set() in
        // the C Freeciv web client/server.
        if (pid == Packets.PACKET_WEB_CMA_SET) {
            int city_id = json.optInt("id");
            City cmaCity = game.cities.get((long) city_id);
            if (cmaCity != null) {
                Player cmaPlayer = game.players.get(cmaCity.getOwner());
                if (cmaPlayer != null && cmaPlayer.getConnectionId() == connId) {
                    JSONObject cmJson = json.optJSONObject("cm_parameter");
                    if (cmJson != null) {
                        CmParameter params = new CmParameter();
                        JSONArray factorArr  = cmJson.optJSONArray("factor");
                        JSONArray surplusArr = cmJson.optJSONArray("minimal_surplus");
                        int[] factor  = new int[6];
                        int[] surplus = new int[6];
                        for (int i = 0; i < 6; i++) {
                            factor[i]  = (factorArr  != null) ? factorArr.optInt(i, 0)  : 0;
                            surplus[i] = (surplusArr != null) ? surplusArr.optInt(i, 0) : 0;
                        }
                        params.setFactor(factor);
                        params.setMinimalSurplus(surplus);
                        params.setRequireHappy(cmJson.optBoolean("require_happy", false));
                        params.setAllowDisorder(cmJson.optBoolean("allow_disorder", false));
                        params.setAllowSpecialists(cmJson.optBoolean("allow_specialists", true));
                        params.setHappyFactor(cmJson.optInt("happy_factor", 0));
                        params.setMaxGrowth(cmJson.optBoolean("max_growth", false));
                        cmaCity.setCmParameter(params);
                        // Apply the governor immediately so the player sees the effect.
                        CityGovernor.applyCityGovernor(game, (long) city_id);
                        CityTools.sendCityInfo(game, this, -1L, (long) city_id);
                        CityTools.sendWebCityInfoAddition(game, this, -1L, (long) city_id);
                    }
                }
            }
        }

        // Handle PACKET_WEB_CMA_CLEAR (258): client disables the city governor.
        // Clears the stored cm_parameter and broadcasts the updated city info.
        if (pid == Packets.PACKET_WEB_CMA_CLEAR) {
            int city_id = json.optInt("id");
            City cmaCity = game.cities.get((long) city_id);
            if (cmaCity != null) {
                Player cmaPlayer = game.players.get(cmaCity.getOwner());
                if (cmaPlayer != null && cmaPlayer.getConnectionId() == connId) {
                    cmaCity.setCmParameter(null);
                    CityTools.sendCityInfo(game, this, -1L, (long) city_id);
                    CityTools.sendWebCityInfoAddition(game, this, -1L, (long) city_id);
                }
            }
        }


        if (pid == Packets.PACKET_WEB_GOTO_PATH_REQ) {
            PathFinder pf = new PathFinder(game);
            JSONObject gotoPacket = pf.processMove(json);
            clients.get(connId).send(gotoPacket.toString());
        }

        if (pid == Packets.PACKET_WEB_INFO_TEXT_REQ) {
            int loc = json.optInt("loc");
            int visibleUnit = json.optInt("visible_unit");
            int focusUnit = json.optInt("focus_unit");
            InfoTextHand.handleWebInfoTextReq(game, connId, loc, visibleUnit, focusUnit);
        }

        if (pid == Packets.PACKET_UNIT_DO_ACTION) {
            long actor_id = json.optInt("actor_id");
            long target_id = json.optInt("target_id");
            int action_type = json.optInt("action_type");
            String name = json.optString("name");
            UnitHand.handleUnitDoAction(game, connId, actor_id, target_id, action_type, name);
        }

        if (pid == Packets.PACKET_UNIT_CHANGE_ACTIVITY) {
            long unit_id = json.optInt("unit_id");
            int activity = json.optInt("activity");
            // JS client sends ACTIVITY_GEN_ROAD = 13 for both road and railroad.
            // Map to internal activity codes based on the target extra ID.
            // extra ID 7 = Railroad (EXTRA_BIT_RAIL), otherwise treat as Road.
            if (activity == 13) {
                int targetExtra = json.optInt("target_extra", -1);
                activity = (targetExtra == CityTurn.EXTRA_BIT_RAIL)
                        ? CityTurn.ACTIVITY_RAILROAD
                        : CityTurn.ACTIVITY_ROAD;
            }
            Unit actUnit = game.units.get(unit_id);
            if (actUnit != null) {
                Player actPlayer = game.players.get(actUnit.getOwner());
                if (actPlayer != null && actPlayer.getConnectionId() == connId) {
                    game.changeUnitActivity(unit_id, activity);
                }
            }
        }

        // Handle PACKET_UNIT_SERVER_SIDE_AGENT_SET (74): client requests the server
        // to manage the unit automatically (e.g. SSA_AUTOEXPLORE = 2 for the 'X'
        // keyboard shortcut).  Mirrors handle_unit_server_side_agent_set() in the
        // C Freeciv server's unithand.c.
        if (pid == Packets.PACKET_UNIT_SERVER_SIDE_AGENT_SET) {
            long unit_id = json.optInt("unit_id");
            int agent = json.optInt("agent", Packets.SSA_NONE);
            Unit ssaUnit = game.units.get(unit_id);
            if (ssaUnit != null) {
                Player ssaPlayer = game.players.get(ssaUnit.getOwner());
                if (ssaPlayer != null && ssaPlayer.getConnectionId() == connId) {
                    game.setUnitSsaController(unit_id, agent);
                }
            }
        }

        // Handle PACKET_PLAYER_RATES: client sends new science/tax/luxury rates.
        // Validates that rates sum to 100 and updates the player's science rate,
        // then broadcasts updated research info.  Mirrors handle_player_rates() in
        // the C Freeciv server's plrhand.c.
        if (pid == Packets.PACKET_PLAYER_RATES) {
            PlrHand.handlePlayerRates(game, connId, json);
        }

        // Handle PACKET_PLAYER_RESEARCH (55): client selects a new technology to research.
        // Validates prerequisites before accepting.  Mirrors handle_player_research() in plrhand.c.
        if (pid == Packets.PACKET_PLAYER_RESEARCH) {
            int techId = json.optInt("tech", -1);
            if (techId >= 0) {
                PlrHand.handleResearchChange(game, connId, techId);
            }
        }

        // Handle PACKET_PLAYER_TECH_GOAL (56): client sets the long-term research goal.
        // Mirrors handle_player_tech_goal() in plrhand.c.
        if (pid == Packets.PACKET_PLAYER_TECH_GOAL) {
            int techId = json.optInt("tech", -1);
            if (techId >= 0) {
                PlrHand.handleTechGoalChange(game, connId, techId);
            }
        }

        // Handle PACKET_PLAYER_CHANGE_GOVERNMENT (54): client requests a government change.
        // Mirrors handle_player_change_government() in plrhand.c.
        if (pid == Packets.PACKET_PLAYER_CHANGE_GOVERNMENT) {
            int govId = json.optInt("government", -1);
            if (govId >= 0) {
                PlrHand.handlePlayerChangeGovernment(game, connId, govId);
            }
        }

        // Handle PACKET_SPACESHIP_LAUNCH (135): client requests launching its spaceship.
        // Validates that the spaceship is in STARTED state with success_rate > 0 and
        // that the player has a capital city.  Mirrors handle_spaceship_launch() in
        // the C Freeciv server's server/spacerace.c.
        if (pid == Packets.PACKET_SPACESHIP_LAUNCH) {
            net.freecivx.game.Player launchPlayer = game.players.get(connId);
            if (launchPlayer != null) {
                game.handleSpaceshipLaunch(connId);
            }
        }

        if (pid == Packets.PACKET_CHAT_MSG_REQ) {
            String message = URLDecoder.decode(json.optString("message"), StandardCharsets.UTF_8);
            if (message.equalsIgnoreCase("/quit")) {
              // Not allowed?
            }
            if (message.equalsIgnoreCase("/start")) {
                game.startGame();
            }
            if (message.toLowerCase().startsWith("/load ")) {
                String scenarioName = message.substring(6).trim();
                if (game.isGameStarted()) {
                    sendMessage(connId, "Cannot load scenario: game already started.");
                } else if (scenarioName.isEmpty()) {
                    sendMessage(connId, "Usage: /load <scenario.sav>");
                } else {
                    boolean loaded = game.loadScenario(scenarioName);
                    if (loaded) {
                        sendMessageAll("Scenario loaded: " + scenarioName
                                + ". Type /start to begin.");
                    } else {
                        sendMessage(connId, "Failed to load scenario: " + scenarioName
                                + ". Use /help to see available scenarios.");
                    }
                }
            }
            if (message.toLowerCase().startsWith("/set ")) {
                handleSetCommand(connId, message);
            }
            if (message.equalsIgnoreCase("/help")) {
                String helptext = """
                        Freecivx Java server commands:
                        /start          - Start the game (also starts automatically when ready)
                        /load <file>    - Load a scenario map before starting, e.g. /load earth-small.sav
                        /set timeout N  - Set turn timeout in seconds (0 = no timeout, max 500)
                        /set aifill N   - Set number of AI players (0-9, applied at game start)
                        /set gold N     - Set starting gold for all players (0-50000)
                        /set generator N - Set map generator: 2 = fractal/fBM (default), 5 = island/continent
                        /set endturn N  - Set turn at which the game ends and reveals the whole map (0 = disabled)
                        /set topology hex    - Use hexagonal map tiles (6-way movement)
                        /set topology square - Use square map tiles (8-way movement, default)
                        /help           - Show this help text
                        Available scenarios: africa-350x350-v1.0.sav, british-isles.sav, caribbean-500x250-v1.2.sav, earth-large.sav, earth-small.sav, europe.sav, france.sav, hagworld.sav, iberian-peninsula.sav, india-350x350-v1.2.sav, italy.sav, japan.sav, middleeast-350x350-v1.1.sav, north_america.sav, scandinavia-350x350-v1.0.sav, tutorial.sav
                        Game features: units move with movement limits, AI players included.
                        Join at any time - late joiners receive the current game state.
                        """;
                sendMessage(connId, helptext);
            }
            if (connection != null) {
                sendMessageAll(connection.getUsername() + ": " + message);
            }
        }
    }

    /**
     * Handles a {@code /set <setting> <value>} command from the client.
     * Mirrors handle_stdin_input() / set_command() in the C Freeciv server's
     * sernet.c / settings.c.  Supported settings:
     * <ul>
     *   <li>{@code timeout}   – turn timeout in seconds (0 = no timeout, max 500)</li>
     *   <li>{@code aifill}    – number of AI players to create at game start (0–9)</li>
     *   <li>{@code gold}      – starting gold for every player (0–50 000)</li>
     *   <li>{@code generator} – map generator: 2 = fractal/fBM (default), 5 = island/continent</li>
     *   <li>{@code endturn}   – turn at which the game ends automatically (0 = disabled, max 32767)</li>
     * </ul>
     *
     * @param connId  the connection ID of the issuing client
     * @param message the raw {@code /set …} command string
     */
    private void handleSetCommand(long connId, String message) {
        String[] parts = message.trim().split("\\s+", 3);
        if (parts.length < 3) {
            sendMessage(connId, "Usage: /set <setting> <value>");
            return;
        }
        String setting = parts[1].toLowerCase();
        String rawValue = parts[2];

        // Handle string-valued settings before attempting integer parsing.
        if (setting.equals("topology")) {
            switch (rawValue.toLowerCase()) {
                case "hex", "hexagonal" -> {
                    game.setTopologyId(Game.TF_HEX);
                    sendMessageAll("topology: set to hex (hexagonal tiles, 6-way movement).");
                }
                case "square", "normal" -> {
                    game.setTopologyId(0);
                    sendMessageAll("topology: set to square (default).");
                }
                default -> sendMessage(connId,
                        "topology must be 'hex' or 'square'.");
            }
            return;
        }

        int value;
        try {
            value = Integer.parseInt(rawValue);
        } catch (NumberFormatException e) {
            sendMessage(connId, "Setting '" + setting + "': value must be an integer.");
            return;
        }
        switch (setting) {
            case "timeout" -> {
                if (value < 0 || value > 500) {
                    sendMessage(connId, "timeout must be between 0 and 500.");
                    return;
                }
                game.setTurnTimeout(value);
                String msg = value == 0
                        ? "timeout: disabled (turns advance when all players end their turn)."
                        : "timeout: set to " + value + " seconds.";
                sendMessageAll(msg);
            }
            case "aifill" -> {
                if (value < 0 || value > 9) {
                    sendMessage(connId, "aifill must be between 0 and 9.");
                    return;
                }
                game.setAifill(value);
                sendMessageAll("aifill: set to " + value + " AI players.");
            }
            case "gold" -> {
                if (value < 0 || value > 50000) {
                    sendMessage(connId, "gold must be between 0 and 50000.");
                    return;
                }
                game.setInitialGold(value);
                sendMessageAll("gold: starting gold set to " + value + ".");
            }
            case "generator" -> {
                if (value != 2 && value != 5) {
                    sendMessage(connId, "generator must be 2 (fractal, default) or 5 (island).");
                    return;
                }
                game.setGenerator(value);
                String genName = (value == 5) ? "island" : "fractal";
                sendMessageAll("generator: set to " + value + " (" + genName + ").");
            }
            case "endturn" -> {
                if (value < 0 || value > 32767) {
                    sendMessage(connId, "endturn must be between 0 and 32767 (0 = disabled).");
                    return;
                }
                game.setEndTurn(value);
                String msg = value == 0
                        ? "endturn: disabled (game will not end automatically)."
                        : "endturn: game will end at turn " + value + ".";
                sendMessageAll(msg);
            }
            default -> sendMessage(connId, "Unknown setting '" + setting
                    + "'. Try /help for available settings.");
        }
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        log.error("WebSocket error: {}", ex.getMessage(), ex);
    }

    @Override
    public void onStart() {
        log.info("WebSocket server started successfully.");
    }

    @Override
    public void stop() throws InterruptedException {
        log.info("Stopping WebSocket server...");
        for (WebSocket conn : clients.values()) {
            conn.close(1001, "Server shutting down"); // Use close code 1001 (going away)
        }
        super.stop();
        log.info("WebSocket server stopped.");
    }

    public WebSocket getClientById(long clientId) {
        return clients.get(clientId);
    }

    public long getLastActivityTime() {
        return lastActivityTime;
    }

    public int getConnectedClientCount() {
        return clients.size();
    }

    /** Returns the {@link Game} instance managed by this server. */
    public Game getGame() {
        return game;
    }

    public void resetGame() {
        // Snapshot the active connections before wiping the game so we can
        // re-add all currently-connected players to the fresh game.
        List<net.freecivx.game.Connection> activeConnections = new ArrayList<>();
        for (Map.Entry<Long, WebSocket> entry : clients.entrySet()) {
            net.freecivx.game.Connection conn = game.connections.get(entry.getKey());
            if (conn != null) {
                activeConnections.add(conn);
            }
        }

        // Persist nations so that returning players keep the same nation
        // across restarts in multiplayer mode.
        if ("multiplayer".equals(gameMode)) {
            for (net.freecivx.game.Connection conn : activeConnections) {
                net.freecivx.game.Player p = game.players.get(conn.getId());
                if (p != null) {
                    usernameToNation.put(conn.getUsername(), p.getNation());
                }
            }
        }

        game = new Game(this);
        game.setTurnTimer(turnTimer);
        game.setWarningTimer(warningTimer);
        game.setMultiplayer("multiplayer".equals(gameMode));
        game.setTopologyId(topologyId);
        game.initGame();

        // Re-add connected players to the new game.  In multiplayer mode the
        // persistent usernameToNation map ensures returning players keep their
        // nation identity across restarts.
        for (net.freecivx.game.Connection conn : activeConnections) {
            long connId = conn.getId();
            String username = conn.getUsername();
            String ip = conn.getIp();
            Integer previousNation = "multiplayer".equals(gameMode) ? usernameToNation.get(username) : null;
            game.addConnection(connId, username, connId, ip);
            game.addPlayer(connId, username, ip, previousNation);
            // Mark the player as connected and human-controlled in the new game.
            net.freecivx.game.Player p = game.players.get(connId);
            if (p != null) {
                p.setConnected(true);
                p.setAi(false);
            }
        }

        if (!activeConnections.isEmpty()) {
            game.startGame();
        }

        sendMessageAll("A new game has started!");
    }

    @Override
    public void scheduleGameRestart(int delaySeconds) {
        sendMessageAll("Game over! The server will restart in " + delaySeconds + " seconds.");
        turnTimer.schedule(() -> {
            try {
                log.info("Game over – exiting process for publite-go restart.");
                System.exit(0);
            } catch (Exception e) {
                log.error("Error during scheduled game restart: {}", e.getMessage());
            }
        }, delaySeconds);
    }

    private void broadcast(JSONObject msg) {
        String s = msg.toString();
        for (WebSocket conn : clients.values()) conn.send(s);
    }

    private void sendTo(long connId, JSONObject msg) {
        WebSocket ws = clients.get(connId);
        if (ws != null) ws.send(msg.toString());
    }


    public void sendPacket(long connId, JSONObject packet) {

        sendTo(connId, packet);
    }

    public void broadcastPacket(JSONObject packet) {
        broadcast(packet);
    }

    public void sendMessageAll(String message) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_CHAT_MSG);
        msg.put("message", message);
        msg.put("event", 95);

        broadcast(msg);
    }

    public void sendMessage(long conn_id, String message) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_CHAT_MSG);
        msg.put("message", message);
        msg.put("event", 95);

        WebSocket ws = clients.get(conn_id);
        if (ws != null) ws.send(msg.toString());
    }

    /**
     * Sends a PACKET_CHAT_MSG with a specific event-type integer to a single
     * client.  Mirrors notify_player() / E_* event codes in the C Freeciv server.
     *
     * @param conn_id   the connection ID of the recipient
     * @param message   the notification text
     * @param eventType an integer event-type code (mirrors E_* in the C server)
     */
    public void sendEventMessage(long conn_id, String message, int eventType) {
        sendEventMessage(conn_id, message, eventType, -1, -1);
    }

    /**
     * Sends a PACKET_CHAT_MSG with an event-type integer and tile coordinates
     * to a single client.  Mirrors notify_player() in the C Freeciv server's
     * notify.c, which includes tile location for geo-located events.
     *
     * @param conn_id   the connection ID of the recipient
     * @param message   the notification text
     * @param eventType an integer event-type code (mirrors E_* in the C server)
     * @param tileX     the x map-coordinate of the event (-1 if not applicable)
     * @param tileY     the y map-coordinate of the event (-1 if not applicable)
     */
    public void sendEventMessage(long conn_id, String message, int eventType, int tileX, int tileY) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_CHAT_MSG);
        msg.put("message", message);
        msg.put("event", eventType);
        if (tileX >= 0) msg.put("tile_x", tileX);
        if (tileY >= 0) msg.put("tile_y", tileY);

        WebSocket ws = clients.get(conn_id);
        if (ws != null) ws.send(msg.toString());
    }

    public void sendEndTurnAll() {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_END_TURN);

        broadcast(msg);
    }

    public void sendBeginTurnAll() {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_BEGIN_TURN);

        broadcast(msg);
    }

    public void sendStartPhaseAll() {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_START_PHASE);

        broadcast(msg);
    }

    public void sendGameInfoAll(long year, long turn, long phase, int timeout) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_GAME_INFO);
        msg.put("year", year);
        msg.put("turn", turn);
        msg.put("phase", phase);
        msg.put("timeout", timeout);
        msg.put("first_timeout", -1);
        msg.put("granularity", 1);

        broadcast(msg);
    }

    public void sendCalendarInfoAll() {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_CALENDAR_INFO);
        msg.put("positive_year_label", "AC");
        msg.put("negative_year_label", "BC");

        broadcast(msg);
    }

    public void sendMapInfoAll(int xsize, int ysize, int topologyId) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_MAP_INFO);
        msg.put("xsize", xsize);
        msg.put("ysize", ysize);
        msg.put("topology_id", topologyId);

        broadcast(msg);
    }

    public void sendTerrainInfoAll(long id, String name, String graphic_str) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_TERRAIN);
        msg.put("id", id);
        msg.put("name", name);
        msg.put("graphic_str", graphic_str);

        broadcast(msg);
    }

    public void sendRulesetCityInfoAll(long style_id, String name, String rule_name) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_CITY);
        msg.put("style_id", style_id);
        msg.put("name", name);
        msg.put("rule_name", rule_name);

        broadcast(msg);
    }

    public void sendRuleseGovernmentAll(long id, String name, String rule_name, String helptext) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_GOVERNMENT);
        msg.put("id", id);
        msg.put("name", name);
        msg.put("rule_name", rule_name);
        msg.put("helptext", helptext);
        msg.put("reqs", new JSONArray());

        broadcast(msg);
    }

    public void sendRulesetSpecialistAll(int id, String name, String plural_name, String rule_name) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_SPECIALIST);
        msg.put("id", id);
        msg.put("name", name);
        msg.put("plural_name", plural_name);
        msg.put("rule_name", rule_name);
        msg.put("reqs", new JSONArray());
        msg.put("reqs_count", 0);

        broadcast(msg);
    }

    public void sendRulesetUnitAll(long id, UnitType utype) {
            JSONObject msg = new JSONObject();
            msg.put("pid", Packets.PACKET_RULESET_UNIT);
            msg.put("id", id);
            msg.put("name", utype.getName());
            msg.put("graphic_str", utype.getGraphicsStr());
            msg.put("move_rate", utype.getMoveRate());
            msg.put("hp", utype.getHp());
            msg.put("veteran_levels", utype.getVeteranLevels());
            msg.put("helptext", utype.getHelptext());
            msg.put("attack_strength", utype.getAttackStrength());
            msg.put("defense_strength", utype.getDefenseStrength());
            msg.put("build_cost", computeUnitBuildCost(utype));
            msg.put("build_reqs", new JSONArray());

        broadcast(msg);


    }

    public void sendRulesetUnitWebAdditionAll(long id, UnitType utype) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_WEB_RULESET_UNIT_ADDITION);
        msg.put("id", id);
        msg.put("utype_actions", binaryStringToJsonArray(utype.getUtypeActions()));
        broadcast(msg);
    }

    public void sendUnitAll(Unit unit) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_UNIT_SHORT_INFO);
        msg.put("id", unit.getId());
        msg.put("owner", unit.getOwner());
        msg.put("tile", unit.getTile());
        msg.put("type", unit.getType());
        msg.put("facing", unit.getFacing());
        msg.put("veteran", unit.getVeteran());
        msg.put("hp", unit.getHp());
        msg.put("activity", unit.getActivity());
        msg.put("movesleft", unit.getMovesleft());
        msg.put("done_moving", unit.isDoneMoving());
        msg.put("transported", unit.isTransported());
        msg.put("ssa_controller", unit.getSsa_controller());
        broadcast(msg);
    }

    public void sendUnitRemove(long unit_id) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_UNIT_REMOVE);
        msg.put("unit_id", unit_id);
        broadcast(msg);
    }

    public void sendCityShortInfoAll(long id, long owner, long tile, int size, int style, boolean capital, boolean occupied, int walls, boolean happy,
                                     boolean unhappy, String improvements, String name) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_CITY_SHORT_INFO);
        msg.put("id", id);
        msg.put("tile", tile);
        msg.put("owner", owner);
        msg.put("original", owner);
        msg.put("size", size);
        msg.put("style", style);
        msg.put("capital", capital);
        msg.put("occupied", occupied);
        msg.put("walls", walls);
        msg.put("happy", happy);
        msg.put("unhappy", unhappy);
        msg.put("improvements", improvements);
        msg.put("name", name);

        broadcast(msg);
    }

    public void sendCityInfoAll(long id, long owner, long tile, int size, int style, boolean capital, boolean occupied, int walls, boolean happy,
                                     boolean unhappy, String improvements, String name, int production_kind, int production_value) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_CITY_INFO);
        msg.put("id", id);
        msg.put("tile", tile);
        msg.put("owner", owner);
        msg.put("original", owner);
        msg.put("size", size);
        msg.put("style", style);
        msg.put("capital", capital);
        msg.put("occupied", occupied);
        msg.put("walls", walls);
        msg.put("happy", happy);
        msg.put("unhappy", unhappy);
        msg.put("improvements", improvements);
        msg.put("name", name);
        msg.put("production_kind", production_kind);
        msg.put("production_value", production_value);

        // Build per-type people arrays for all 6 feeling stages (FEELING_BASE=0 …
        // FEELING_FINAL=5).  The client's city_unhappy() reads index 5; sending
        // only 5 elements causes a crash.  Index 5 is derived from happy/unhappy.
        JSONArray pplHappyArr = new JSONArray();
        for (int i = 0; i < 5; i++) pplHappyArr.put(0);
        pplHappyArr.put(happy ? size : 0);

        JSONArray pplContentArr = new JSONArray();
        for (int i = 0; i < 5; i++) pplContentArr.put(size);
        pplContentArr.put((!happy && !unhappy) ? size : 0);

        JSONArray pplUnhappyArr = new JSONArray();
        for (int i = 0; i < 5; i++) pplUnhappyArr.put(0);
        pplUnhappyArr.put(unhappy ? 1 : 0);

        JSONArray pplAngryArr = new JSONArray();
        for (int i = 0; i < 6; i++) pplAngryArr.put(0);

        msg.put("ppl_happy", pplHappyArr);
        msg.put("ppl_content", pplContentArr);
        msg.put("ppl_unhappy", pplUnhappyArr);
        msg.put("ppl_angry", pplAngryArr);

        // prod/surplus arrays need 6 elements: O_FOOD=0, O_SHIELD=1, O_TRADE=2,
        // O_GOLD=3, O_LUXURY=4, O_SCIENCE=5.  Using the same values as ppl but
        // adding a 6th slot for science so city.prod[O_SCIENCE] is not undefined
        // in the client's get_current_bulbs_output() function.
        JSONArray prodArray = new JSONArray();
        prodArray.put(1); // O_FOOD=0
        prodArray.put(1); // O_SHIELD=1
        prodArray.put(2); // O_TRADE=2
        prodArray.put(1); // O_GOLD=3
        prodArray.put(1); // O_LUXURY=4
        prodArray.put(1); // O_SCIENCE=5

        msg.put("surplus", prodArray);
        msg.put("prod", prodArray);
        msg.put("city_options", "");
        broadcast(msg);
    }

    public void sendExtrasInfoAll(long id, String extra_name, int causes, String graphicStr) {
        JSONObject msg = buildExtraPacket(id, extra_name, causes, graphicStr);
        broadcast(msg);
    }

    /** Builds a PACKET_RULESET_EXTRA message with all required fields. */
    private JSONObject buildExtraPacket(long id, String extra_name, int causes, String graphicStr) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_EXTRA);
        msg.put("id", id);
        msg.put("name", extra_name);
        msg.put("graphic_str", graphicStr != null ? graphicStr : extra_name.toLowerCase());
        msg.put("graphic_alt", "-");
        msg.put("rule_name", extra_name);
        // Send causes and rmcauses as byte arrays to match the C Freeciv server's
        // BV_CAUSES bitvector format. The JavaScript client wraps them with
        // new BitVector(packet['causes']), which expects an array of bytes.
        // EC_RESOURCE = 8 (bit 8) requires 2 bytes (ceil(9/8) = 2).
        msg.put("causes", causesToByteArray(causes));
        msg.put("rmcauses", causesToByteArray(0));
        return msg;
    }

    /**
     * Converts a causes bitvector (int) to a 2-byte JSON array matching the
     * C Freeciv server's {@code BV_CAUSES} format.
     * The JavaScript client wraps it with {@code new BitVector(packet['causes'])},
     * which expects an array of bytes, not a raw integer.
     * EC_RESOURCE = 8 is in bit 8, which resides in byte 1 of a 2-byte array.
     *
     * @param causes the causes bitvector
     * @return a JSONArray of 2 bytes (little-endian)
     */
    private static JSONArray causesToByteArray(int causes) {
        JSONArray arr = new JSONArray();
        arr.put(causes & 0xFF);
        arr.put((causes >> 8) & 0xFF);
        return arr;
    }

    public void sendTileInfoAll(Tile tile) {
        // Send per-player tile info so each client receives the correct fog-of-war
        // known status (TILE_UNKNOWN / TILE_KNOWN_UNSEEN / TILE_KNOWN_SEEN).
        // Only human players with an active connection are targeted.
        for (net.freecivx.game.Player player : game.players.values()) {
            if (player.isAi()) continue;
            int known = VisibilityHandler.getKnownForPlayer(player, tile.getIndex());
            VisibilityHandler.sendTileToPlayer(game, player.getConnectionId(), tile.getIndex(), known);
        }
    }

    public void sendConnInfoAll(long id, String username, String address, long player_num) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_CONN_INFO);
        msg.put("id", id);
        msg.put("username", username);
        msg.put("used", true);
        msg.put("established", true);
        msg.put("player_num", player_num);
        msg.put("addr", address);
        broadcast(msg);
    }


    public void sendPlayerInfoAdditionAll(long playerno, int expected_income) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_WEB_PLAYER_INFO_ADDITION);
        msg.put("playerno", playerno);
        msg.put("expected_income", expected_income);

        broadcast(msg);
    }

    public void sendPlayerInfoAll(Player player) {
        // Public information broadcast to all connected clients
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_PLAYER_INFO);
        msg.put("playerno", player.getPlayerNo());
        msg.put("username", player.getUsername());
        msg.put("name", player.getUsername());
        msg.put("nation", player.getNation());
        msg.put("government", player.getGovernmentId());
        JSONArray inventions = new JSONArray();
        msg.put("inventions", inventions);
        // flags bitvector: bit 0 = PLRF_AI
        JSONArray flags = new JSONArray();
        flags.put(player.isAi() ? 1 : 0);
        flags.put(0);
        msg.put("flags", flags);
        JSONArray vis = new JSONArray();
        vis.put(0);
        vis.put(0);
        msg.put("gives_shared_vision", vis);

        JSONArray embassies = new JSONArray();
        embassies.put(false);
        embassies.put(false);
        msg.put("real_embassy", embassies);
        msg.put("is_alive", player.isAlive());
        msg.put("phase_done", player.isPhaseDone());
        msg.put("nturns_idle", player.getNturnsIdle());
        msg.put("connected", player.isConnected());
        msg.put("score", game != null ? Score.computeScore(game, player) : 0);

        broadcast(msg);

        // Private financial and research data sent only to the owning player.
        // Must also re-send flags and gives_shared_vision so that handle_player_info()
        // in packhand.js does not overwrite them with BitVector(undefined).
        long ownerConnId = player.getConnectionId();
        WebSocket ownerWs = clients.get(ownerConnId);
        if (ownerWs != null) {
            JSONObject privateMsg = new JSONObject();
            privateMsg.put("pid", Packets.PACKET_PLAYER_INFO);
            privateMsg.put("playerno", player.getPlayerNo());
            privateMsg.put("researching", player.getResearchingTech());
            privateMsg.put("bulbs_researched", player.getBulbsResearched());
            privateMsg.put("tax", player.getTaxRate());
            privateMsg.put("luxury", player.getLuxuryRate());
            privateMsg.put("science", player.getScienceRate());
            privateMsg.put("gold", player.getGold());
            privateMsg.put("tech_upkeep", 0);
            privateMsg.put("researching_cost",
                    player.getResearchingTech() >= 0
                    ? net.freecivx.game.Research.researchTechCost(game, player.getPlayerNo(), player.getResearchingTech())
                    : 0);
            privateMsg.put("tech_goal", player.getTechGoal());
            // Repeat flags and gives_shared_vision so packhand.js does not
            // replace the valid public BitVectors with BitVector(undefined).
            JSONArray privateFlags = new JSONArray();
            privateFlags.put(player.isAi() ? 1 : 0);
            privateFlags.put(0);
            privateMsg.put("flags", privateFlags);
            JSONArray privateVis = new JSONArray();
            privateVis.put(0);
            privateVis.put(0);
            privateMsg.put("gives_shared_vision", privateVis);
            ownerWs.send(privateMsg.toString());
        }
    }

    public void sendPlayerRemoveAll(long playerNo) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_PLAYER_REMOVE);
        msg.put("playerno", playerNo);
        broadcast(msg);
    }

    /**
     * Broadcasts a PACKET_SPACESHIP_INFO (137) packet containing the full
     * spaceship state for the given player.
     * Mirrors {@code send_spaceship_info()} in the C Freeciv server's
     * {@code server/spacerace.c}.
     *
     * @param player the player whose spaceship state to broadcast
     */
    public void sendSpaceshipInfo(net.freecivx.game.Player player) {
        broadcast(buildSpaceshipInfoPacket(player));
    }

    /** Builds a PACKET_SPACESHIP_INFO JSON object for the given player. */
    private JSONObject buildSpaceshipInfoPacket(net.freecivx.game.Player player) {
        net.freecivx.game.Spaceship ship = player.getSpaceship();
        JSONObject msg = new JSONObject();
        msg.put("pid",          Packets.PACKET_SPACESHIP_INFO);
        msg.put("player_num",   player.getPlayerNo());
        msg.put("sship_state",  ship.getState().ordinal());
        msg.put("structurals",  ship.getStructurals());
        msg.put("components",   ship.getComponents());
        msg.put("modules",      ship.getModules());
        msg.put("fuel",         ship.getFuel());
        msg.put("propulsion",   ship.getPropulsion());
        msg.put("habitation",   ship.getHabitation());
        msg.put("life_support", ship.getLifeSupport());
        msg.put("solar_panels", ship.getSolarPanels());
        msg.put("launch_year",  ship.getLaunchYear());
        msg.put("population",   ship.getPopulation());
        msg.put("mass",         ship.getMass());
        msg.put("support_rate", ship.getSupportRate());
        msg.put("energy_rate",  ship.getEnergyRate());
        msg.put("success_rate", ship.getSuccessRate());
        msg.put("travel_time",  ship.getTravelTime());
        // structure bitvector not used by freecivx-server (auto-place)
        msg.put("structure",    0);
        return msg;
    }

    public void sendNationInfoAll(long id, String name, String adjective, String graphic_str, String legend) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_NATION);
        msg.put("id", id);
        msg.put("name", name);
        msg.put("adjective", adjective);
        msg.put("graphic_str", graphic_str);
        msg.put("legend", legend);

        broadcast(msg);
    }

    public void sendTechAll(long id, int root_req, String name, JSONArray research_reqs, String graphic_str, String helptext) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_TECH);
        msg.put("id", id);
        msg.put("root_req", root_req);
        msg.put("research_reqs", research_reqs);
        msg.put("helptext", helptext);
        msg.put("name", name);
        msg.put("graphic_str", graphic_str);

        broadcast(msg);
    }

    public void sendBordersServerSettingsAll() {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_SERVER_SETTING_CONST);
        msg.put("name", "borders");
        broadcast(msg);
        JSONObject val = new JSONObject();
        val.put("pid", Packets.PACKET_SERVER_SETTING_BOOL);
        val.put("is_visible", true);
        broadcast(val);
    }

    public void sendRulesetControl(int numImprovements) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_CONTROL);
        msg.put("num_impr_types", numImprovements);

        broadcast(msg);
    }

    public void sendRulesetBuildingAll(Improvement impr) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_BUILDING);
        msg.put("id", impr.getId());
        msg.put("name", impr.getName());
        msg.put("rule_name", impr.getRuleName());
        msg.put("graphic_str", impr.getGraphicStr());
        msg.put("graphic_alt", impr.getGraphicAlt());
        msg.put("genus", impr.getGenus());
        msg.put("build_cost", impr.getBuildCost());
        msg.put("upkeep", impr.getUpkeep());
        msg.put("sabotage", impr.getSabotage());
        msg.put("soundtag", impr.getSoundtag());
        msg.put("soundtag_alt", impr.getSoundtagAlt());
        msg.put("helptext", impr.getHelptext());

        // Build tech requirements array
        JSONArray reqs = new JSONArray();
        if (impr.getTechReqId() >= 0) {
            JSONObject req = new JSONObject();
            req.put("kind", 1);           // VUT_ADVANCE (technology)
            req.put("value", impr.getTechReqId());
            req.put("range", 2);          // REQ_RANGE_PLAYER
            req.put("present", true);
            req.put("survives", false);
            reqs.put(req);
        }
        msg.put("reqs", reqs);
        msg.put("reqs_count", reqs.length());
        msg.put("obs_reqs", new JSONArray());
        msg.put("obs_count", 0);
        msg.put("flags", new JSONArray());

        broadcast(msg);
    }

    /**
     * Converts a binary string to a {@link JSONArray} of byte values.
     * Delegates to {@link PacketUtils#binaryStringToJsonArray(String)}.
     *
     * @param binaryString a string of {@code '0'} and {@code '1'} characters
     * @return a {@link JSONArray} of byte values (as integers 0–255)
     */
    public static JSONArray binaryStringToJsonArray(String binaryString) {
        return PacketUtils.binaryStringToJsonArray(binaryString);
    }

    /**
     * Computes the production cost in shields for a unit type, matching the
     * formula used in {@link CityTurn#cityProduction}.  Uses the explicit
     * ruleset {@code build_cost} when set, otherwise falls back to the legacy
     * formula {@code (attack + defense) * hp / 2} with a minimum of 10.
     */
    static int computeUnitBuildCost(UnitType utype) {
        if (utype.getCost() > 0) {
            return utype.getCost();
        }
        return Math.max(10,
                (utype.getAttackStrength() + utype.getDefenseStrength()) * utype.getHp() / 2);
    }

    /**
     * Sends PACKET_RULESET_ACTION (pid=246) for all 117 actions to populate
     * the client's actions[] map and eliminate "Asked for non existing action" errors.
     */
    public void sendRulesetActionsAll() {
        for (int i = 0; i < PacketUtils.ACTION_RESULTS.length; i++) {
            JSONObject msg = new JSONObject();
            msg.put("pid", Packets.PACKET_RULESET_ACTION);
            msg.put("id", i);
            msg.put("ui_name", i < PacketUtils.ACTION_NAMES.length ? PacketUtils.ACTION_NAMES[i] : "Action " + i);
            msg.put("result", PacketUtils.ACTION_RESULTS[i]);
            msg.put("quiet", false);
            msg.put("actor_consuming_always", false);
            msg.put("act_kind", 0);
            msg.put("tgt_kind", 3);
            msg.put("sub_tgt_kind", 0);
            msg.put("min_distance", 0);
            msg.put("max_distance", 1);
            msg.put("sub_results", new JSONArray());
            msg.put("blocked_by", new JSONArray());
            broadcast(msg);
        }
    }

    /**
     * Sends the complete current game state to a single late-joining player.
     */
    public void sendGameStateTo(long connId) {
        WebSocket ws = clients.get(connId);
        if (ws == null) return;

        // Calendar
        JSONObject cal = new JSONObject();
        cal.put("pid", Packets.PACKET_CALENDAR_INFO);
        cal.put("positive_year_label", "AC");
        cal.put("negative_year_label", "BC");
        ws.send(cal.toString());

        // Map dimensions
        JSONObject mapMsg = new JSONObject();
        mapMsg.put("pid", Packets.PACKET_MAP_INFO);
        mapMsg.put("xsize", game.map.getXsize());
        mapMsg.put("ysize", game.map.getYsize());
        mapMsg.put("topology_id", game.getTopologyId());
        ws.send(mapMsg.toString());

        // Game state
        JSONObject gameMsg = new JSONObject();
        gameMsg.put("pid", Packets.PACKET_GAME_INFO);
        gameMsg.put("year", game.getHistoricalYear());
        gameMsg.put("turn", game.turn);
        gameMsg.put("phase", game.phase);
        gameMsg.put("timeout", game.getTurnTimeout());
        gameMsg.put("first_timeout", -1);
        gameMsg.put("granularity", 1);
        ws.send(gameMsg.toString());

        // Ruleset control
        JSONObject rsc = new JSONObject();
        rsc.put("pid", Packets.PACKET_RULESET_CONTROL);
        rsc.put("num_impr_types", game.improvements.size());
        ws.send(rsc.toString());

        // Technologies
        game.techs.forEach((id, tech) -> {
            JSONObject msg = new JSONObject();
            msg.put("pid", Packets.PACKET_RULESET_TECH);
            msg.put("id", id);
            msg.put("root_req", -1);
            msg.put("research_reqs", new JSONArray());
            msg.put("helptext", tech.getHelptext());
            msg.put("name", tech.getName());
            msg.put("graphic_str", tech.getGraphicsStr());
            ws.send(msg.toString());
        });

        // Governments
        game.governments.forEach((id, gov) -> {
            JSONObject msg = new JSONObject();
            msg.put("pid", Packets.PACKET_RULESET_GOVERNMENT);
            msg.put("id", id);
            msg.put("name", gov.getName());
            msg.put("rule_name", gov.getRuleName());
            msg.put("helptext", gov.getHelptext());
            msg.put("reqs", new JSONArray());
            ws.send(msg.toString());
        });

        // Nations
        game.nations.forEach((id, nation) -> {
            JSONObject msg = new JSONObject();
            msg.put("pid", Packets.PACKET_RULESET_NATION);
            msg.put("id", id);
            msg.put("name", nation.getName());
            msg.put("adjective", nation.getAdjective());
            msg.put("graphic_str", nation.getGraphicsStr());
            msg.put("legend", nation.getLegend());
            ws.send(msg.toString());
        });

        // Extras
        game.extras.forEach((id, extra) -> {
            JSONObject msg = buildExtraPacket(id, extra.getName(), extra.getCauses(), extra.getGraphicStr());
            ws.send(msg.toString());
        });

        // Terrains
        game.terrains.forEach((id, terrain) -> {
            JSONObject msg = new JSONObject();
            msg.put("pid", Packets.PACKET_RULESET_TERRAIN);
            msg.put("id", id);
            msg.put("name", terrain.getName());
            msg.put("graphic_str", terrain.getGraphicsStr());
            ws.send(msg.toString());
        });

        // Unit types
        game.unitTypes.forEach((id, utype) -> {
            JSONObject msg = new JSONObject();
            msg.put("pid", Packets.PACKET_RULESET_UNIT);
            msg.put("id", id);
            msg.put("name", utype.getName());
            msg.put("graphic_str", utype.getGraphicsStr());
            msg.put("move_rate", utype.getMoveRate());
            msg.put("hp", utype.getHp());
            msg.put("veteran_levels", utype.getVeteranLevels());
            msg.put("helptext", utype.getHelptext());
            msg.put("attack_strength", utype.getAttackStrength());
            msg.put("defense_strength", utype.getDefenseStrength());
            msg.put("build_cost", computeUnitBuildCost(utype));
            msg.put("build_reqs", new JSONArray());
            ws.send(msg.toString());
        });
        game.unitTypes.forEach((id, utype) -> {
            JSONObject msg = new JSONObject();
            msg.put("pid", Packets.PACKET_WEB_RULESET_UNIT_ADDITION);
            msg.put("id", id);
            msg.put("utype_actions", binaryStringToJsonArray(utype.getUtypeActions()));
            ws.send(msg.toString());
        });

        // Improvements
        game.improvements.forEach((id, impr) -> {
            JSONObject msg = new JSONObject();
            msg.put("pid", Packets.PACKET_RULESET_BUILDING);
            msg.put("id", impr.getId());
            msg.put("name", impr.getName());
            msg.put("rule_name", impr.getRuleName());
            msg.put("graphic_str", impr.getGraphicStr());
            msg.put("graphic_alt", impr.getGraphicAlt());
            msg.put("genus", impr.getGenus());
            msg.put("build_cost", impr.getBuildCost());
            msg.put("upkeep", impr.getUpkeep());
            msg.put("sabotage", impr.getSabotage());
            msg.put("soundtag", impr.getSoundtag());
            msg.put("soundtag_alt", impr.getSoundtagAlt());
            msg.put("helptext", impr.getHelptext());
            JSONArray reqs = new JSONArray();
            if (impr.getTechReqId() >= 0) {
                JSONObject req = new JSONObject();
                req.put("kind", 1);
                req.put("value", impr.getTechReqId());
                req.put("range", 2);
                req.put("present", true);
                req.put("survives", false);
                reqs.put(req);
            }
            msg.put("reqs", reqs);
            msg.put("reqs_count", reqs.length());
            msg.put("obs_reqs", new JSONArray());
            msg.put("obs_count", 0);
            msg.put("flags", new JSONArray());
            ws.send(msg.toString());
        });

        // Ruleset actions
        for (int i = 0; i < PacketUtils.ACTION_RESULTS.length; i++) {
            JSONObject msg = new JSONObject();
            msg.put("pid", Packets.PACKET_RULESET_ACTION);
            msg.put("id", i);
            msg.put("ui_name", i < PacketUtils.ACTION_NAMES.length ? PacketUtils.ACTION_NAMES[i] : "Action " + i);
            msg.put("result", PacketUtils.ACTION_RESULTS[i]);
            msg.put("quiet", false);
            msg.put("actor_consuming_always", false);
            msg.put("act_kind", 0);
            msg.put("tgt_kind", 3);
            msg.put("sub_tgt_kind", 0);
            msg.put("min_distance", 0);
            msg.put("max_distance", 1);
            msg.put("sub_results", new JSONArray());
            msg.put("blocked_by", new JSONArray());
            ws.send(msg.toString());
        }

        // Tiles – send with per-player fog-of-war known status.
        // Use buildTileInfoPacket so that the owner (national border) field is
        // included for known/seen tiles and masked to null for unknown tiles.
        net.freecivx.game.Player joiningPlayer = game.players.get(connId);
        game.tiles.forEach((id, tile) -> {
            int known = (joiningPlayer != null)
                    ? VisibilityHandler.getKnownForPlayer(joiningPlayer, tile.getIndex())
                    : tile.getKnown();
            ws.send(MapHand.buildTileInfoPacket(tile, known).toString());
        });

        // Units – send only units visible to this player (own units or on a visible tile)
        game.units.forEach((id, unit) -> {
            boolean canSee = joiningPlayer != null
                    && (joiningPlayer.getPlayerNo() == unit.getOwner()
                        || joiningPlayer.getVisibleTiles().contains(unit.getTile()));
            if (!canSee) return;
            JSONObject msg = VisibilityHandler.buildUnitShortInfoPacket(unit);
            ws.send(msg.toString());
        });

        // City styles
        game.cityStyle.forEach((id, style) -> {
            JSONObject msg = new JSONObject();
            msg.put("pid", Packets.PACKET_RULESET_CITY);
            msg.put("style_id", id);
            msg.put("name", style.getName());
            msg.put("rule_name", style.getName());
            ws.send(msg.toString());
        });

        // Cities – send PACKET_CITY_INFO first so the JS client creates a proper
        // City instance (with an update() method) before PACKET_CITY_SHORT_INFO
        // arrives. If short-info arrived first the client would store a plain
        // object without update(), causing "cities[id].update is not a function".
        // Also send PACKET_WEB_CITY_INFO_ADDITION so the city dialog shows
        // the correct list of buildable units and improvements.
        // Only send cities the joining player can see (own city or visible tile).
        game.cities.forEach((id, city) -> {
            boolean canSee = joiningPlayer != null
                    && (joiningPlayer.getPlayerNo() == city.getOwner()
                        || joiningPlayer.getVisibleTiles().contains(city.getTile()));
            if (!canSee) return;

            // Send full city info + web addition via CityTools (handles bitvectors,
            // shield_stock, food_stock, can_build_unit, can_build_improvement).
            CityTools.sendCityInfo(game, this, connId, id);

            // Build improvements bitvector for the short-info packet.
            JSONArray improvBits = CityTools.buildBitvector(
                    city.getImprovements().stream().mapToInt(Integer::intValue).toArray(),
                    game.improvements.size());

            JSONObject shortMsg = new JSONObject();
            shortMsg.put("pid", Packets.PACKET_CITY_SHORT_INFO);
            shortMsg.put("id", id);
            shortMsg.put("tile", city.getTile());
            shortMsg.put("owner", city.getOwner());
            shortMsg.put("original", city.getOwner());
            shortMsg.put("size", city.getSize());
            shortMsg.put("style", city.getStyle());
            shortMsg.put("capital", city.isCapital());
            shortMsg.put("occupied", city.isOccupied());
            shortMsg.put("walls", city.getWalls());
            shortMsg.put("happy", city.isHappy());
            shortMsg.put("unhappy", city.isUnhappy());
            shortMsg.put("improvements", improvBits);
            shortMsg.put("name", city.getName());
            ws.send(shortMsg.toString());
        });

        // Players
        game.players.forEach((pid2, player) -> {
            JSONObject msg = new JSONObject();
            msg.put("pid", Packets.PACKET_PLAYER_INFO);
            msg.put("playerno", player.getPlayerNo());
            msg.put("username", player.getUsername());
            msg.put("name", player.getUsername());
            msg.put("nation", player.getNation());
            msg.put("government", player.getGovernmentId());
            msg.put("is_alive", player.isAlive());
            msg.put("nturns_idle", player.getNturnsIdle());
            msg.put("connected", player.isConnected());
            JSONArray flags = new JSONArray(); flags.put(player.isAi() ? 1 : 0); flags.put(0);
            msg.put("flags", flags);
            JSONArray vis = new JSONArray(); vis.put(0); vis.put(0);
            msg.put("gives_shared_vision", vis);
            JSONArray emb = new JSONArray(); emb.put(false); emb.put(false);
            msg.put("real_embassy", emb);
            // Private financial and research data sent only to the owning player
            if (player.getConnectionId() == connId) {
                msg.put("tax", player.getTaxRate());
                msg.put("luxury", player.getLuxuryRate());
                msg.put("science", player.getScienceRate());
                msg.put("gold", player.getGold());
                msg.put("tech_upkeep", 0);
                msg.put("researching", player.getResearchingTech());
                msg.put("bulbs_researched", player.getBulbsResearched());
                msg.put("researching_cost",
                        player.getResearchingTech() >= 0
                        ? net.freecivx.game.Research.researchTechCost(game, player.getPlayerNo(), player.getResearchingTech())
                        : 0);
                msg.put("tech_goal", player.getTechGoal());
            }
            ws.send(msg.toString());
        });

        // Send full research info for the reconnecting player
        game.players.values().stream()
                .filter(p -> p.getConnectionId() == connId)
                .findFirst()
                .ifPresent(p -> TechTools.sendResearchInfo(game, this, connId, p.getPlayerNo()));

        // Connections
        game.connections.forEach((id, conn) -> {
            JSONObject msg = new JSONObject();
            msg.put("pid", Packets.PACKET_CONN_INFO);
            msg.put("id", id);
            msg.put("username", conn.getUsername());
            msg.put("used", true);
            msg.put("established", true);
            msg.put("player_num", conn.getPlayerNo());
            msg.put("addr", conn.getIp());
            ws.send(msg.toString());
        });

        // Spaceship info – send current state for all players
        game.players.forEach((pid2, player) -> {
            net.freecivx.game.Spaceship ship = player.getSpaceship();
            if (ship.getState() != net.freecivx.game.Spaceship.State.NONE) {
                JSONObject msg = buildSpaceshipInfoPacket(player);
                ws.send(msg.toString());
            }
        });

        // Server settings
        JSONObject sc = new JSONObject();
        sc.put("pid", Packets.PACKET_SERVER_SETTING_CONST);
        sc.put("name", "borders");
        ws.send(sc.toString());
        JSONObject sb = new JSONObject();
        sb.put("pid", Packets.PACKET_SERVER_SETTING_BOOL);
        sb.put("is_visible", true);
        ws.send(sb.toString());

        // Begin turn
        JSONObject sp = new JSONObject();
        sp.put("pid", Packets.PACKET_START_PHASE);
        ws.send(sp.toString());
        JSONObject bt = new JSONObject();
        bt.put("pid", Packets.PACKET_BEGIN_TURN);
        ws.send(bt.toString());
    }
}


