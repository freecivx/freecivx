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
import java.util.Arrays;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

public class CivServer extends org.java_websocket.server.WebSocketServer {

    private final ConcurrentHashMap<Long, WebSocket> clients = new ConcurrentHashMap<>();
    private final AtomicInteger clientIdGenerator = new AtomicInteger(1);
    Game game = null;

    public CivServer(InetSocketAddress address) {
        super(address);
        this.setReuseAddr(true);
        game = new Game(this);
        game.initGame();

    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        long clientId = (clientIdGenerator.getAndIncrement()) - 1;
        clients.put(clientId, conn);
        conn.setAttachment(clientId); // Attach the client ID to the connection
        System.out.println("New connection (ID: " + clientId + "): " + conn.getRemoteSocketAddress());

        sendMessage(clientId, "Your client ID is: " + clientId);

    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        long clientId = conn.getAttachment();
        clients.remove(clientId);
        System.out.println("Connection closed (ID: " + clientId + "): " + conn.getRemoteSocketAddress());

    }

    @Override
    public void onMessage(WebSocket conn, String packet) {
        System.out.println("Message received: " + packet);
        long connId = conn.getAttachment();
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
            game.addPlayer(connId, username, conn.getRemoteSocketAddress().toString());
        }

        if (pid == Packets.PACKET_PLAYER_READY) {
            game.startGame();
        }

        if (pid == Packets.PACKET_PLAYER_PHASE_DONE) {
            game.turnDone();
        }

        if (pid == Packets.PACKET_UNIT_ORDERS) {
            var ORDER_MOVE = 0;
            var ORDER_FULL_MP = 2;
            var ORDER_ACTION_MOVE = 3;
            int unit_id = json.optInt("unit_id");
            int dest_tile = json.optInt("dest_tile");
            JSONObject orders = json.optJSONArray("orders").getJSONObject(0);
            int order = orders.optInt("order");
            int dir = orders.optInt("dir");
            if (order == ORDER_ACTION_MOVE) {
                // One tile move.
                game.moveUnit(unit_id, dest_tile, dir);
            }
            if (order == ORDER_MOVE) {
                // GOTO.
                game.moveUnit(unit_id, dest_tile, dir);
            }
        }

        if (pid == Packets.PACKET_CITY_NAME_SUGGESTION_REQ) {
            int unit_id = json.optInt("unit_id");
            JSONObject msg = new JSONObject();
            msg.put("pid", Packets.PACKET_CITY_NAME_SUGGESTION_INFO);
            msg.put("name", "Paris"); // TODO
            msg.put("unit_id", unit_id);
            clients.get(connId).send(msg.toString());
        }

        if (pid == Packets.PACKET_WEB_GOTO_PATH_REQ) {
            PathFinder pf = new PathFinder(game);
            JSONObject gotoPacket = pf.processMove(json);
            clients.get(connId).send(gotoPacket.toString());
        }

        if (pid == Packets.PACKET_UNIT_DO_ACTION) {
            long unit_id = json.optInt("actor_id");
            String name = json.optString("name");

            long tile_id = json.optInt("target_id");
            game.buildCity(unit_id, name, tile_id);
        }

        if (pid == Packets.PACKET_CHAT_MSG_REQ) {
            String message =  URLDecoder.decode(json.optString("message"), StandardCharsets.UTF_8);
            if (message.equalsIgnoreCase("/quit")) {
              // Not allowed?
            }
            if (message.equalsIgnoreCase("/start")) {
                game.startGame();
            }
            if (message.equalsIgnoreCase("/help")) {
                String helptext = """
                        This is the Freecivx Java server. It supports these commands:
                        /start
                        /quit
                        """;
                sendMessage(connId, helptext);
            }
            if (connection != null) {
                sendMessageAll(connection.getUsername() + ": " + message);
            }
        }
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        System.err.println("WebSocket error: " + ex.getMessage());
    }

    @Override
    public void onStart() {
        System.out.println("WebSocket server started successfully.");
    }

    @Override
    public void stop() throws InterruptedException {
        System.out.println("Stopping WebSocket server...");
        for (WebSocket conn : clients.values()) {
            conn.close(1001, "Server shutting down"); // Use close code 1001 (going away)
        }
        super.stop();
        System.out.println("WebSocket server stopped.");
    }

    public WebSocket getClientById(long clientId) {
        return clients.get(clientId);
    }

    public void sendMessageAll(String message) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_CHAT_MSG);
        msg.put("message", message);
        msg.put("event", 95);

        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }

    public void sendMessage(long conn_id, String message) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_CHAT_MSG);
        msg.put("message", message);
        msg.put("event", 95);

        clients.get(conn_id).send(msg.toString());
    }

    public void sendBeginTurnAll() {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_BEGIN_TURN);

        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }

    public void sendStartPhaseAll() {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_START_PHASE);

        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }

    public void sendGameInfoAll(long year, long turn, long phase) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_GAME_INFO);
        msg.put("year", year);
        msg.put("turn", turn);
        msg.put("phase", phase);

        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }

    public void sendCalendarInfoAll() {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_CALENDAR_INFO);
        msg.put("positive_year_label", "AC");
        msg.put("negative_year_label", "BC");


        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }

    public void sendMapInfoAll(int xsize, int ysize) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_MAP_INFO);
        msg.put("xsize", xsize);
        msg.put("ysize", ysize);

        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }

    public void sendTerrainInfoAll(long id, String name, String graphic_str) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_TERRAIN);
        msg.put("id", id);
        msg.put("name", name);
        msg.put("graphic_str", graphic_str);

        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }

    public void sendRulesetCityInfoAll(long style_id, String name, String rule_name) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_CITY);
        msg.put("style_id", style_id);
        msg.put("name", name);
        msg.put("rule_name", rule_name);

        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }

    public void sendRuleseGovernmentAll(long id, String name, String rule_name, String helptext) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_GOVERNMENT);
        msg.put("id", id);
        msg.put("name", name);
        msg.put("rule_name", rule_name);
        msg.put("helptext", helptext);

        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
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
            msg.put("build_reqs", new JSONArray());

        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }


    }

    public void sendRulesetUnitWebAdditionAll(long id, UnitType utype) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_WEB_RULESET_UNIT_ADDITION);
        msg.put("id", id);
        msg.put("utype_actions", binaryStringToJsonArray(utype.getUtypeActions()));
        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
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
        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }

    public void sendUnitRemove(long unit_id) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_UNIT_REMOVE);
        msg.put("unit_id", unit_id);
        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }

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

        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
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

        JSONArray pplHappyArray = new JSONArray();
        pplHappyArray.put(1);
        pplHappyArray.put(1);
        pplHappyArray.put(2);
        pplHappyArray.put(1);
        pplHappyArray.put(1);

        msg.put("ppl_happy", pplHappyArray);
        msg.put("ppl_content", pplHappyArray);
        msg.put("ppl_unhappy", pplHappyArray);
        msg.put("ppl_angry", pplHappyArray);
        msg.put("ppl_happy", pplHappyArray);



        msg.put("surplus", pplHappyArray);
        msg.put("prod", pplHappyArray);
        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }

    public void sendExtrasInfoAll(String extra_name) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_EXTRA);
        msg.put("id", 1);
        msg.put("name", extra_name);
        msg.put("graphic_str", extra_name);
        msg.put("rule_name", extra_name);

        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }

    public void sendTileInfoAll(Tile tile) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_TILE_INFO);
        msg.put("tile", tile.getIndex());
        msg.put("known", tile.getKnown());
        msg.put("terrain", tile.getTerrain());
        msg.put("resource", tile.getResource());
        msg.put("extras", tile.getExtras());
        msg.put("height", tile.getHeight());
        msg.put("worked", tile.getWorked() >= 0 ? tile.getWorked() : JSONObject.NULL);

        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
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
        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }


    public void sendPlayerInfoAdditionAll(long playerno, int expected_income) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_WEB_PLAYER_INFO_ADDITION);
        msg.put("playerno", playerno);
        msg.put("expected_income", expected_income);


        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }

    public void sendPlayerInfoAll(Player player) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_PLAYER_INFO);
        msg.put("playerno", player.getPlayerNo());
        msg.put("username", player.getUsername());
        msg.put("name", player.getUsername());
        msg.put("nation", player.getNation());
        msg.put("government", 1);
        msg.put("researching", 1);
        msg.put("bulbs_researched", 0);
        JSONArray inventions = new JSONArray();
        //inventions.put(0);
        msg.put("inventions", inventions);
        JSONArray flags = new JSONArray();
        flags.put(0);
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

        msg.put("tax", 40);
        msg.put("luxury", 0);
        msg.put("science", 60);
        msg.put("gold", 100);

        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }

    public void sendNationInfoAll(long id, String name, String adjective, String graphic_str, String legend) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_NATION);
        msg.put("id", id);
        msg.put("name", name);
        msg.put("adjective", adjective);
        msg.put("graphic_str", graphic_str);
        msg.put("legend", legend);

        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
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

        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }

    public void sendBordersServerSettingsAll() {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_SERVER_SETTING_CONST);
        msg.put("name", "borders");
        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
        JSONObject val = new JSONObject();
        val.put("pid", Packets.PACKET_SERVER_SETTING_BOOL);
        val.put("is_visible", true);
        for (WebSocket conn : clients.values()) {
            conn.send(val.toString());
        }
    }

    public void sendRulesetControl() {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_CONTROL);
        msg.put("num_impr_types", 0); // Todo

        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }

    public static JSONArray binaryStringToJsonArray(String binaryString) {
        int byteArraySize = (binaryString.length() + 7) / 8;
        int[] bitVector = new int[byteArraySize];

        for (int i = 0; i < binaryString.length(); i++) {
            if (binaryString.charAt(i) == '1') {
                bitVector[i / 8] |= (1 << (7 - (i % 8)));
            }
        }

        // Create a real JSON array
        JSONArray jsonArray = new JSONArray();
        for (int value : bitVector) {
            jsonArray.put(value);
        }

        return jsonArray;
    }
}


