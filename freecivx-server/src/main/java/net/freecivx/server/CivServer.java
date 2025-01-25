/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.Freecivx.net/
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

import net.freecivx.game.Game;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.json.JSONObject;

import java.net.InetSocketAddress;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

public class CivServer extends org.java_websocket.server.WebSocketServer {

    private final ConcurrentHashMap<Integer, WebSocket> clients = new ConcurrentHashMap<>();
    private final AtomicInteger clientIdGenerator = new AtomicInteger(1);
    Game game = null;

    public CivServer(InetSocketAddress address) {
        super(address);


    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        int clientId = (clientIdGenerator.getAndIncrement()) - 1;
        clients.put(clientId, conn);
        conn.setAttachment(clientId); // Attach the client ID to the connection
        System.out.println("New connection (ID: " + clientId + "): " + conn.getRemoteSocketAddress());

        sendMessage(clientId, "Your client ID is: " + clientId);

    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        Integer clientId = conn.getAttachment();
        if (clientId != null) {
            clients.remove(clientId);
            System.out.println("Connection closed (ID: " + clientId + "): " + conn.getRemoteSocketAddress());
        }
    }

    @Override
    public void onMessage(WebSocket conn, String packet) {
        System.out.println("Message received: " + packet);
        int connId = conn.getAttachment();

        JSONObject json = new JSONObject(packet);
        int pid = json.optInt("pid");

        if (pid == Packets.PACKET_SERVER_JOIN_REQ) {
            String username = json.optString("username");
            JSONObject reply = new JSONObject();
            reply.put("pid", Packets.PACKET_SERVER_JOIN_REPLY);
            reply.put("you_can_join", true);
            reply.put("conn_id", connId);
            conn.send(reply.toString());

            JSONObject msg = new JSONObject();
            msg.put("pid", Packets.PACKET_CHAT_MSG);
            msg.put("message", "Welcome " + username + ". Connected to Freecivx-server-java.");
            msg.put("event", 95);
            conn.send(msg.toString());

            sendPlayerInfoAll(connId, username, username );
            sendPlayerInfoAdditionAll(connId, 0);
            sendConnInfoAll(connId, username, conn.getRemoteSocketAddress().toString(), connId );
        }

        if (pid == Packets.PACKET_PLAYER_READY) {
            game = new Game(this);
            game.startGame();
        }

        if (pid == Packets.PACKET_CHAT_MSG_REQ) {
            String message = json.optString("message");

            sendMessageAll(message);
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

    public WebSocket getClientById(int clientId) {
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

    public void sendMessage(int conn_id, String message) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_CHAT_MSG);
        msg.put("message", message);
        msg.put("event", 95);

        clients.get(conn_id).send(msg.toString());
    }

    public void sendStartPhaseAll() {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_START_PHASE);

        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }

    public void sendGameInfoAll() {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_GAME_INFO);
        msg.put("year", 1);
        msg.put("turn", 0);
        msg.put("phase", 0);

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

    public void sendMapInfoAll() {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_MAP_INFO);
        msg.put("xsize", 100);
        msg.put("ysize", 100);

        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }

    public void sendTerrainInfoAll(int id, String name) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_TERRAIN);
        msg.put("id", id);
        msg.put("name", name);
        msg.put("graphic_str", name);

        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }

    public void sendRulesetUnitAll(int id, String name, String graphic_str, int move_rate, int hp,
        int veteran_levels, String helptext, int attack_strength, int defense_strength) {
            JSONObject msg = new JSONObject();
            msg.put("pid", Packets.PACKET_RULESET_UNIT);
            msg.put("id", id);
            msg.put("name", name);
            msg.put("graphic_str", graphic_str);
            msg.put("move_rate", move_rate);
            msg.put("hp", hp);
            msg.put("veteran_levels", veteran_levels);
            msg.put("helptext", helptext);
            msg.put("attack_strength", attack_strength);
            msg.put("defense_strength", defense_strength);
        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }

    public void sendUnitAll(int id, int owner, int tile, int type, int facing, int veteran, int hp, int activity) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_UNIT_SHORT_INFO);
        msg.put("id", id);
        msg.put("owner", owner);
        msg.put("tile", tile);
        msg.put("type", type);
        msg.put("facing", facing);
        msg.put("veteran", veteran);
        msg.put("hp", hp);
        msg.put("activity", activity);
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

    public void sendTileInfoAll() {
        int width = 100;
        for (int x = 0; x < 100; x++) {
            for (int y = 0; y < 100; y++) {
                int index = y * width + x;
                JSONObject msg = new JSONObject();
                msg.put("pid", Packets.PACKET_TILE_INFO);
                msg.put("tile", index);
                msg.put("known", 1);
                msg.put("terrain", new Random().nextInt(12) + 1);
                msg.put("resource", 1);
                msg.put("extras", 1);
                msg.put("height", 100);

                for (WebSocket conn : clients.values()) {
                    conn.send(msg.toString());
                }
            }
        }

    }

    public void sendConnInfoAll(int id, String username, String address, int player_num) {
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


    public void sendPlayerInfoAdditionAll(int playerno, int expected_income) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_WEB_PLAYER_INFO_ADDITION);
        msg.put("playerno", playerno);
        msg.put("expected_income", expected_income);


        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }

    public void sendPlayerInfoAll(int playerno, String username, String name) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_PLAYER_INFO);
        msg.put("playerno", playerno);
        msg.put("username", username);
        msg.put("name", name);
        msg.put("nation", 1);

        for (WebSocket conn : clients.values()) {
            conn.send(msg.toString());
        }
    }

    public void sendNationInfoAll(int id, String name, String adjective, String graphic_str) {
        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_RULESET_NATION);
        msg.put("id", id);
        msg.put("name", name);
        msg.put("adjective", adjective);
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


}


