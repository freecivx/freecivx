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

package net.freecivx.server;

import net.freecivx.game.Connection;
import net.freecivx.game.Game;
import net.freecivx.game.Improvement;
import net.freecivx.game.PathFinder;
import net.freecivx.game.Player;
import net.freecivx.game.Tile;
import net.freecivx.game.Unit;
import net.freecivx.game.UnitType;
import org.json.JSONArray;
import org.json.JSONObject;
import org.teavm.jso.JSBody;
import org.teavm.jso.JSExport;

/**
 * TeaVM/browser implementation of {@link IGameServer}.
 *
 * <p>This class replaces {@link CivServer} when the freecivx-server is compiled
 * to JavaScript via the {@code teavm} Maven profile ({@code mvn package -P teavm}).
 * Instead of a real TCP WebSocket server, all packet I/O is bridged to the
 * surrounding JavaScript environment:
 *
 * <ul>
 *   <li><b>Outgoing</b> (server → client): packets are dispatched by calling the
 *       JavaScript function {@code window.freecivxOnPacket(packetObject)}.  The
 *       freeciv-web client should assign that function before the TeaVM module
 *       starts.</li>
 *   <li><b>Incoming</b> (client → server): the JavaScript side calls the exported
 *       {@link #receivePacket(String)} function with a JSON-string representation
 *       of the packet.</li>
 * </ul>
 *
 * <p>JavaScript integration example:
 * <pre>{@code
 * // Register callback before the TeaVM module is loaded:
 * window.freecivxOnPacket = function(packet) {
 *     client_handle_packet([packet]);
 * };
 *
 * // After the module has started, forward client packets to the server:
 * function send_request(json) {
 *     BrowserCivServer_receivePacket(json);
 * }
 * }</pre>
 */
public class BrowserCivServer implements IGameServer {

    private static final int SINGLE_CONN_ID = 0;
    private static final String BROWSER_IP = "browser";

    /** The game instance managed by this browser server. */
    private final Game game;

    /** Singleton instance used by the static {@link #receivePacket(String)} export. */
    private static BrowserCivServer currentInstance;

    /**
     * Constructs a new browser-mode server, initialises the game and game
     * ruleset, and registers the JavaScript API via {@link #setupBrowserApi()}.
     *
     * <p>{@link #setupBrowserApi()} is called unconditionally even if
     * {@link Game#initGame()} throws, so the client always receives the
     * {@code window.freecivxSendPacket} registration and the
     * {@code window.freecivxOnReady} callback fires regardless.
     */
    public BrowserCivServer() {
        jsLog("[BrowserCivServer] Initialising BrowserCivServer...");
        currentInstance = this;
        this.game = new Game(this);
        jsLog("[BrowserCivServer] Game object created, calling initGame()...");
        try {
            this.game.initGame();
            jsLog("[BrowserCivServer] initGame() completed successfully");
        } catch (Exception e) {
            jsError("[BrowserCivServer] initGame() threw " + e.getClass().getName() + ": " + e.getMessage());
            e.printStackTrace();
        }
        jsLog("[BrowserCivServer] Registering JS API via setupBrowserApi()...");
        setupBrowserApi();
    }

    /** Returns the {@link Game} instance managed by this server. */
    public Game getGame() {
        return game;
    }

    // =========================================================================
    // JavaScript bridge – outgoing (Java → JS)
    // =========================================================================

    /** Writes a debug message to the browser console via {@code console.debug}. */
    @JSBody(params = {"msg"}, script = "console.debug(msg);")
    private static native void jsLog(String msg);

    /** Writes an error message to the browser console via {@code console.error}. */
    @JSBody(params = {"msg"}, script = "console.error(msg);")
    private static native void jsError(String msg);

    /**
     * Dispatches a JSON-string packet to the JavaScript client by calling
     * {@code window.freecivxOnPacket(JSON.parse(json))}.
     * The surrounding JavaScript page must assign that function before the
     * TeaVM module is started.
     */
    @JSBody(params = {"json"}, script =
        "if (typeof window !== 'undefined'" +
        "    && typeof window.freecivxOnPacket === 'function') {" +
        "  try {" +
        "    window.freecivxOnPacket(JSON.parse(json));" +
        "  } catch(e) {" +
        "    console.error('[BrowserCivServer] freecivxOnPacket error', e);" +
        "  }" +
        "}")
    private static native void dispatchToClient(String json);

    /**
     * Registers {@code window.freecivxSendPacket(json)} so that the
     * JavaScript client can forward outgoing packets to this server instance.
     * Also invokes {@code window.freecivxOnReady()} (if defined) to signal
     * that the server is ready to receive packets.
     * Called once from the constructor after the game is initialised.
     */
    @JSBody(script =
        "console.info('[BrowserCivServer] setupBrowserApi() called — registering window.freecivxSendPacket');" +
        "window.freecivxSendPacket = function(json) {" +
        "  console.debug('[BrowserCivServer] freecivxSendPacket called, routing to receivePacket');" +
        "  net_freecivx_server_BrowserCivServer.$receivePacket(json);" +
        "};" +
        "console.info('[BrowserCivServer] window.freecivxSendPacket registered — server ready');" +
        "if (typeof window.freecivxOnReady === 'function') {" +
        "  console.info('[BrowserCivServer] Calling window.freecivxOnReady() callback');" +
        "  var cb = window.freecivxOnReady;" +
        "  window.freecivxOnReady = null;" +
        "  cb();" +
        "} else {" +
        "  console.warn('[BrowserCivServer] window.freecivxOnReady is not defined — client fallback will handle startup');" +
        "}")
    private static native void setupBrowserApi();

    // =========================================================================
    // JavaScript bridge – incoming (JS → Java)
    // =========================================================================

    /**
     * Receives a JSON packet from the JavaScript client and routes it through
     * the game logic.  Mirrors {@code CivServer.onMessage()} but operates
     * in a single-connection in-process context.
     *
     * <p>This method is exported to JavaScript as
     * {@code net_freecivx_server_BrowserCivServer.$receivePacket(json)}.
     *
     * @param packet JSON-serialised packet string sent by the client
     */
    @JSExport
    public static void receivePacket(String packet) {
        if (currentInstance == null) {
            jsLog("[BrowserCivServer] receivePacket called but server not initialised");
            return;
        }
        currentInstance.handlePacket(SINGLE_CONN_ID, packet);
    }

    // =========================================================================
    // Packet handler (mirrors CivServer.onMessage)
    // =========================================================================

    /**
     * Processes a single incoming JSON packet from the browser client.
     *
     * @param connId the connection ID (always {@value #SINGLE_CONN_ID} in
     *               browser mode since there is exactly one client)
     * @param rawPacket the JSON-string representation of the packet
     */
    public void handlePacket(long connId, String rawPacket) {
        JSONObject json = new JSONObject(rawPacket);
        int pid = json.optInt("pid");

        jsLog("[BrowserCivServer] handlePacket pid=" + pid);

        if (pid == Packets.PACKET_SERVER_JOIN_REQ) {
            String username = json.optString("username", "Player");
            jsLog("[BrowserCivServer] JOIN_REQ user=" + username);
            JSONObject reply = new JSONObject();
            reply.put("pid", Packets.PACKET_SERVER_JOIN_REPLY);
            reply.put("you_can_join", true);
            reply.put("conn_id", connId);
            dispatchToClient(reply.toString());
            game.addConnection(connId, username, connId, BROWSER_IP);
            game.addPlayer(connId, username, BROWSER_IP);
        }

        if (pid == Packets.PACKET_PLAYER_READY) {
            jsLog("[BrowserCivServer] PLAYER_READY gameStarted=" + game.isGameStarted());
            if (game.isGameStarted()) {
                game.syncNewPlayer(connId);
            } else {
                game.startGame();
            }
        }

        if (pid == Packets.PACKET_PLAYER_PHASE_DONE) {
            jsLog("[BrowserCivServer] PLAYER_PHASE_DONE");
            game.playerEndTurn(connId);
        }

        if (pid == Packets.PACKET_UNIT_ORDERS) {
            var ORDER_MOVE = 0;
            var ORDER_ACTION_MOVE = 3;
            int unit_id = json.optInt("unit_id");
            int dest_tile = json.optInt("dest_tile");
            JSONObject orders = json.optJSONArray("orders").getJSONObject(0);
            int order = orders.optInt("order");
            int dir = orders.optInt("dir");
            Unit orderUnit = game.units.get((long) unit_id);
            if (orderUnit != null) {
                Player orderPlayer = game.players.get(orderUnit.getOwner());
                if (orderPlayer != null && orderPlayer.getConnectionId() == connId) {
                    if (order == ORDER_ACTION_MOVE || order == ORDER_MOVE) {
                        game.moveUnit(unit_id, dest_tile, dir);
                    }
                }
            }
        }

        if (pid == Packets.PACKET_CITY_NAME_SUGGESTION_REQ) {
            int unit_id = json.optInt("unit_id");
            CityHand.handleCityNameSuggestionReq(game, connId, unit_id);
        }

        if (pid == Packets.PACKET_CITY_CHANGE) {
            int city_id = json.optInt("city_id");
            int production_kind = json.optInt("production_kind");
            int production_value = json.optInt("production_value");
            CityHand.handleCityChangeProductionRequest(game, connId, city_id,
                    production_kind, production_value);
        }

        if (pid == Packets.PACKET_CITY_BUY) {
            int city_id = json.optInt("city_id");
            CityHand.handleCityBuyRequest(game, connId, city_id);
        }

        if (pid == Packets.PACKET_WEB_GOTO_PATH_REQ) {
            PathFinder pf = new PathFinder(game);
            JSONObject gotoPacket = pf.processMove(json);
            dispatchToClient(gotoPacket.toString());
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

        if (pid == Packets.PACKET_PLAYER_RATES) {
            PlrHand.handlePlayerRates(game, connId, json);
        }

        if (pid == Packets.PACKET_PLAYER_RESEARCH) {
            int techId = json.optInt("tech", -1);
            if (techId >= 0) {
                PlrHand.handleResearchChange(game, connId, techId);
            }
        }

        if (pid == Packets.PACKET_PLAYER_TECH_GOAL) {
            int techId = json.optInt("tech", -1);
            if (techId >= 0) {
                PlrHand.handleTechGoalChange(game, connId, techId);
            }
        }

        if (pid == Packets.PACKET_CHAT_MSG_REQ) {
            String message = json.optString("message");
            if (message.equalsIgnoreCase("/start")) {
                game.startGame();
            }
            Connection conn = game.connections.get(connId);
            if (conn != null) {
                sendMessageAll(conn.getUsername() + ": " + message);
            }
        }
    }

    // =========================================================================
    // IGameServer implementation
    // =========================================================================

    @Override
    public void sendPacket(long connId, JSONObject packet) {
        dispatchToClient(packet.toString());
    }

    @Override
    public void broadcastPacket(JSONObject packet) {
        dispatchToClient(packet.toString());
    }

    @Override
    public void sendMessageAll(String message) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_CHAT_MSG);
        msg.put("message", message);
        msg.put("event", 95);
        dispatchToClient(msg.toString());
    }

    @Override
    public void sendMessage(long connId, String message) {
        sendMessageAll(message);
    }

    @Override
    public void sendEventMessage(long connId, String message, int eventType) {
        sendEventMessage(connId, message, eventType, -1, -1);
    }

    @Override
    public void sendEventMessage(long connId, String message, int eventType, int tileX, int tileY) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_CHAT_MSG);
        msg.put("message", message);
        msg.put("event", eventType);
        if (tileX >= 0) msg.put("tile_x", tileX);
        if (tileY >= 0) msg.put("tile_y", tileY);
        dispatchToClient(msg.toString());
    }

    @Override
    public void sendEndTurnAll() {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_END_TURN);
        dispatchToClient(msg.toString());
    }

    @Override
    public void sendBeginTurnAll() {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_BEGIN_TURN);
        dispatchToClient(msg.toString());
    }

    @Override
    public void sendStartPhaseAll() {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_START_PHASE);
        dispatchToClient(msg.toString());
    }

    @Override
    public void sendGameInfoAll(long year, long turn, long phase, int timeout) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_GAME_INFO);
        msg.put("year", year);
        msg.put("turn", turn);
        msg.put("phase", phase);
        msg.put("timeout", timeout);
        msg.put("first_timeout", -1);
        dispatchToClient(msg.toString());
    }

    @Override
    public void sendCalendarInfoAll() {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_CALENDAR_INFO);
        msg.put("positive_year_label", "AC");
        msg.put("negative_year_label", "BC");
        dispatchToClient(msg.toString());
    }

    @Override
    public void sendMapInfoAll(int xsize, int ysize) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_MAP_INFO);
        msg.put("xsize", xsize);
        msg.put("ysize", ysize);
        dispatchToClient(msg.toString());
    }

    @Override
    public void sendTerrainInfoAll(long id, String name, String graphic_str) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_TERRAIN);
        msg.put("id", id);
        msg.put("name", name);
        msg.put("graphic_str", graphic_str);
        dispatchToClient(msg.toString());
    }

    @Override
    public void sendRulesetCityInfoAll(long style_id, String name, String rule_name) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_CITY);
        msg.put("style_id", style_id);
        msg.put("name", name);
        msg.put("rule_name", rule_name);
        dispatchToClient(msg.toString());
    }

    @Override
    public void sendRuleseGovernmentAll(long id, String name, String rule_name, String helptext) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_GOVERNMENT);
        msg.put("id", id);
        msg.put("name", name);
        msg.put("rule_name", rule_name);
        msg.put("helptext", helptext);
        msg.put("reqs", new JSONArray());
        dispatchToClient(msg.toString());
    }

    @Override
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
        msg.put("build_reqs", new JSONArray());
        dispatchToClient(msg.toString());
    }

    @Override
    public void sendRulesetUnitWebAdditionAll(long id, UnitType utype) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_WEB_RULESET_UNIT_ADDITION);
        msg.put("id", id);
        msg.put("utype_actions", PacketUtils.binaryStringToJsonArray(utype.getUtypeActions()));
        dispatchToClient(msg.toString());
    }

    @Override
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
        dispatchToClient(msg.toString());
    }

    @Override
    public void sendUnitRemove(long unit_id) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_UNIT_REMOVE);
        msg.put("unit_id", unit_id);
        dispatchToClient(msg.toString());
    }

    @Override
    public void sendCityShortInfoAll(long id, long owner, long tile, int size, int style,
                                     boolean capital, boolean occupied, int walls,
                                     boolean happy, boolean unhappy,
                                     String improvements, String name) {
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
        dispatchToClient(msg.toString());
    }

    @Override
    public void sendCityInfoAll(long id, long owner, long tile, int size, int style,
                                 boolean capital, boolean occupied, int walls,
                                 boolean happy, boolean unhappy,
                                 String improvements, String name,
                                 int production_kind, int production_value) {
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

        JSONArray ppl = new JSONArray();
        ppl.put(1); ppl.put(1); ppl.put(2); ppl.put(1); ppl.put(1);
        msg.put("ppl_happy", ppl);
        msg.put("ppl_content", ppl);
        msg.put("ppl_unhappy", ppl);
        msg.put("ppl_angry", ppl);

        JSONArray prod = new JSONArray();
        prod.put(1); prod.put(1); prod.put(2); prod.put(1); prod.put(1); prod.put(1);
        msg.put("surplus", prod);
        msg.put("prod", prod);
        msg.put("city_options", "");
        dispatchToClient(msg.toString());
    }

    @Override
    public void sendExtrasInfoAll(long id, String extra_name, int causes, String graphicStr) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_EXTRA);
        msg.put("id", id);
        msg.put("name", extra_name);
        msg.put("graphic_str", graphicStr != null ? graphicStr : extra_name.toLowerCase());
        msg.put("graphic_alt", "-");
        msg.put("rule_name", extra_name);
        msg.put("causes", causes);
        msg.put("rmcauses", 0);
        dispatchToClient(msg.toString());
    }

    @Override
    public void sendTileInfoAll(Tile tile) {
        // Determine known status for the single human player in browser mode.
        int known = tile.getKnown();
        for (net.freecivx.game.Player player : game.players.values()) {
            if (!player.isAi()) {
                known = VisibilityHandler.getKnownForPlayer(player, tile.getIndex());
                break;
            }
        }
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_TILE_INFO);
        msg.put("tile", tile.getIndex());
        msg.put("known", known);
        msg.put("terrain", tile.getTerrain());
        msg.put("resource", tile.getResource());
        msg.put("extras", MapHand.extrasToByteArray(tile.getExtras()));
        msg.put("height", tile.getHeight());
        msg.put("worked", tile.getWorked() >= 0 ? tile.getWorked() : JSONObject.NULL);
        msg.put("owner", tile.getOwner() >= 0 ? tile.getOwner() : JSONObject.NULL);
        dispatchToClient(msg.toString());
    }

    @Override
    public void sendConnInfoAll(long id, String username, String address, long player_num) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_CONN_INFO);
        msg.put("id", id);
        msg.put("username", username);
        msg.put("used", true);
        msg.put("established", true);
        msg.put("player_num", player_num);
        msg.put("addr", address);
        dispatchToClient(msg.toString());
    }

    @Override
    public void sendPlayerInfoAdditionAll(long playerno, int expected_income) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_WEB_PLAYER_INFO_ADDITION);
        msg.put("playerno", playerno);
        msg.put("expected_income", expected_income);
        dispatchToClient(msg.toString());
    }

    @Override
    public void sendPlayerInfoAll(Player player) {
        // Public info broadcast to all clients (mirrors CivServer).
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_PLAYER_INFO);
        msg.put("playerno", player.getPlayerNo());
        msg.put("username", player.getUsername());
        msg.put("name", player.getUsername());
        msg.put("nation", player.getNation());
        msg.put("government", player.getGovernmentId());
        msg.put("inventions", new JSONArray());
        JSONArray flags = new JSONArray();
        flags.put(player.isAi() ? 1 : 0);
        flags.put(0);
        msg.put("flags", flags);
        JSONArray vis = new JSONArray();
        vis.put(0); vis.put(0);
        msg.put("gives_shared_vision", vis);
        JSONArray emb = new JSONArray();
        emb.put(false); emb.put(false);
        msg.put("real_embassy", emb);
        msg.put("is_alive", player.isAlive());
        msg.put("phase_done", player.isPhaseDone());
        msg.put("nturns_idle", player.getNturnsIdle());
        dispatchToClient(msg.toString());

        // In browser mode the browser IS the only (human) player, so also
        // send private financial data and the full research state.
        // AI players have no connection, so skip them.
        if (!player.isAi()) {
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
            privateMsg.put("researching_cost", 0);
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
            dispatchToClient(privateMsg.toString());

            // Send the full research state (inventions bitvector, researching
            // cost, total bulb production) as a separate PACKET_RESEARCH_INFO.
            // This ensures the client's science advisor and tech tree reflect
            // the player's actual known technologies rather than an empty list.
            TechTools.sendResearchInfo(game, this, player.getConnectionId(),
                    player.getPlayerNo());
        }
    }

    @Override
    public void sendNationInfoAll(long id, String name, String adjective,
                                   String graphic_str, String legend) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_NATION);
        msg.put("id", id);
        msg.put("name", name);
        msg.put("adjective", adjective);
        msg.put("graphic_str", graphic_str);
        msg.put("legend", legend);
        dispatchToClient(msg.toString());
    }

    @Override
    public void sendTechAll(long id, int root_req, String name,
                             JSONArray research_reqs, String graphic_str, String helptext) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_TECH);
        msg.put("id", id);
        msg.put("root_req", root_req);
        msg.put("research_reqs", research_reqs);
        msg.put("helptext", helptext);
        msg.put("name", name);
        msg.put("graphic_str", graphic_str);
        dispatchToClient(msg.toString());
    }

    @Override
    public void sendBordersServerSettingsAll() {
        JSONObject constMsg = new JSONObject();
        constMsg.put("pid", Packets.PACKET_SERVER_SETTING_CONST);
        constMsg.put("name", "borders");
        dispatchToClient(constMsg.toString());
        JSONObject boolMsg = new JSONObject();
        boolMsg.put("pid", Packets.PACKET_SERVER_SETTING_BOOL);
        boolMsg.put("is_visible", true);
        dispatchToClient(boolMsg.toString());
    }

    @Override
    public void sendRulesetControl(int numImprovements) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_CONTROL);
        msg.put("num_impr_types", numImprovements);
        dispatchToClient(msg.toString());
    }

    @Override
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
        dispatchToClient(msg.toString());
    }

    @Override
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
            dispatchToClient(msg.toString());
        }
    }

    @Override
    public void sendGameStateTo(long connId) {
        // In browser mode all clients ARE the same client, so re-use the
        // existing broadcast send* helpers to replay the full game state.
        sendCalendarInfoAll();
        sendMapInfoAll(game.map.getXsize(), game.map.getYsize());
        sendGameInfoAll(game.getHistoricalYear(), game.turn, game.phase,
                game.getTurnTimeout());
        sendRulesetControl(game.improvements.size());

        game.techs.forEach((id, tech) -> sendTechAll(id, -1, tech.getName(),
                new JSONArray(), tech.getGraphicsStr(), tech.getHelptext()));

        game.governments.forEach((id, gov) ->
                sendRuleseGovernmentAll(id, gov.getName(), gov.getRuleName(), gov.getHelptext()));

        game.nations.forEach((id, nation) ->
                sendNationInfoAll(id, nation.getName(), nation.getAdjective(),
                        nation.getGraphicsStr(), nation.getLegend()));

        game.extras.forEach((id, extra) ->
                sendExtrasInfoAll(id, extra.getName(), extra.getCauses(), extra.getGraphicStr()));

        game.terrains.forEach((id, terrain) ->
                sendTerrainInfoAll(id, terrain.getName(), terrain.getGraphicsStr()));

        game.unitTypes.forEach((id, utype) -> sendRulesetUnitAll(id, utype));
        game.unitTypes.forEach((id, utype) -> sendRulesetUnitWebAdditionAll(id, utype));

        game.improvements.forEach((id, impr) -> sendRulesetBuildingAll(impr));

        sendRulesetActionsAll();

        game.tiles.forEach((id, tile) -> sendTileInfoAll(tile));

        game.units.forEach((id, unit) -> sendUnitAll(unit));

        game.cityStyle.forEach((id, style) ->
                sendRulesetCityInfoAll(id, style.getName(), style.getName()));

        game.cities.forEach((id, city) -> {
            CityTools.sendCityInfo(game, this, connId, id);

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
            dispatchToClient(shortMsg.toString());
        });

        game.players.forEach((pid, player) -> sendPlayerInfoAll(player));

        game.connections.forEach((id, conn) ->
                sendConnInfoAll(id, conn.getUsername(), conn.getIp(), conn.getPlayerNo()));

        sendBordersServerSettingsAll();
        sendStartPhaseAll();
        sendBeginTurnAll();
    }
}
