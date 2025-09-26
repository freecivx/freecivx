package net.freecivx.client.network;

import net.freecivx.client.game.Game;
import net.freecivx.client.gui.MainWindow;
import net.freecivx.server.Packets;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;
import org.json.JSONObject;

import java.net.URI;

public class FreecivxClient extends WebSocketClient {
    private final MainWindow mainWindow;
    private final String username;
    private Game game;

    public FreecivxClient(Game game, MainWindow mainWindow, URI serverUri, String username) {
        super(serverUri);
        this.username = username;
        this.mainWindow = mainWindow;
        this.game = game;
    }

    @Override
    public void onOpen(ServerHandshake handshake) {
        System.out.println("Connected to server.");
        JSONObject loginMessage = new JSONObject()
                .put("pid", 4)
                .put("username", username)
                .put("capability", "+Freeciv.Web.Devel-3.3")
                .put("version_label", "-dev")
                .put("major_version", 3)
                .put("minor_version", 1)
                .put("patch_version", 90);

        send(loginMessage.toString());
        mainWindow.showMessage("Connected to server.");
    }

    @Override
    public void onMessage(String packet) {
        System.out.println("Received: " + packet);
        JSONObject response = new JSONObject(packet);

        int pid = response.optInt("pid", -1);
        if (pid == Packets.PACKET_CHAT_MSG ) {
            String message = response.optString("message");
            mainWindow.showMessage(message);
        }

        if (pid == Packets.PACKET_START_PHASE ) {
            game.setGameState(1);
        }
    }

    @Override
    public void onClose(int code, String reason, boolean remote) {
        mainWindow.showMessage("Connection closed: " + reason);
    }

    @Override
    public void onError(Exception ex) {
        mainWindow.showMessage("Error: " + ex.getMessage());
    }

    public void sendPlayerReady() {
        JSONObject packet = new JSONObject()
                .put("pid", Packets.PACKET_PLAYER_READY)
                .put("is_ready", true)
                .put("player_no", 0);
        if (isOpen()) {
            send(packet.toString());
        }
    }

    public void sendMessage(String message) {
        JSONObject loginMessage = new JSONObject()
                .put("pid", Packets.PACKET_CHAT_MSG_REQ)
                .put("message", message);

        send(loginMessage.toString());
    }
}
