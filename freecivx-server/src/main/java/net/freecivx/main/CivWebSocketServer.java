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

package net.freecivx.main;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;
import org.json.JSONObject;

import java.net.InetSocketAddress;

class CivWebSocketServer extends WebSocketServer {

    public CivWebSocketServer(InetSocketAddress address) {
        super(address);
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        System.out.println("New connection: " + conn.getRemoteSocketAddress());
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        System.out.println("Connection closed: " + conn.getRemoteSocketAddress());
    }

    @Override
    public void onMessage(WebSocket conn, String packet) {
        System.out.println("Message received: " + packet);

        JSONObject json = new JSONObject(packet);
        int pid = json.optInt("pid");
        String username = json.optString("username");

        if (pid == 4) {
            JSONObject reply = new JSONObject();
            reply.put("pid", 5);
            reply.put("you_can_join", true);
            reply.put("conn_id", 1);
            conn.send(reply.toString());


            JSONObject msg = new JSONObject();
            msg.put("pid", 25);
            msg.put("message", "Connected to Freecivx-server-java.");
            msg.put("event", 95);
            conn.send(msg.toString());
        }


        if (pid == 26) {
            String message = json.optString("message");

            JSONObject msg = new JSONObject();
            msg.put("pid", 25);
            msg.put("message", message);
            msg.put("event", 95);
            conn.send(msg.toString());
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
}