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

package net.freecivx.main;

import net.freecivx.game.Game;
import net.freecivx.game.Nation;
import net.freecivx.game.Player;
import net.freecivx.server.CivServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Publishes this server's state and player list to the freeciv-web metaserver.
 *
 * Mirrors the behaviour of meta.c in the C Freeciv server:
 *  - A periodic full refresh every {@link #REFRESH_INTERVAL_SECONDS} seconds.
 *  - Rate-limited event-driven updates (no more than one every
 *    {@link #MIN_UPDATE_INTERVAL_MS} ms) fired when players join/leave or the
 *    game state changes.
 *  - A goodbye POST when the JVM shuts down.
 */
public class MetaserverClient {

    private static final Logger log = LoggerFactory.getLogger(MetaserverClient.class);

    private static final String METASERVER_URL = "http://localhost:8080/freeciv-web/meta/metaserver";
    private static final String SERVER_HOST = "localhost";

    /** Full state refresh interval in seconds (mirrors METASERVER_REFRESH_INTERVAL). */
    private static final int REFRESH_INTERVAL_SECONDS = 60;
    /** Minimum gap between event-driven updates in ms (mirrors METASERVER_MIN_UPDATE_INTERVAL). */
    private static final long MIN_UPDATE_INTERVAL_MS = 7_000L;
    /** Maximum number of human player slots reported as available to the metaserver. */
    private static final int MAX_PLAYERS = 9;
    /** Metaserver player-type code for a human player. */
    private static final String PLAYER_TYPE_HUMAN = "H";
    /** Metaserver player-type code for an AI (disconnected/taken-over) player. */
    private static final String PLAYER_TYPE_AI = "A";

    private static final AtomicLong lastUpdateMs = new AtomicLong(0);

    private static volatile CivServer serverRef;
    private static volatile int serverPort;
    private static volatile String serverMessage;

    private static final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "meta-refresh");
                t.setDaemon(true);
                return t;
            });

    /**
     * Initialises the client, sends an immediate update, and schedules
     * periodic refreshes every {@link #REFRESH_INTERVAL_SECONDS} seconds.
     * Called once from {@code Main} after the WebSocket server has started.
     */
    public static void start(CivServer server, int port, String message) {
        serverRef = server;
        serverPort = port;
        serverMessage = message;
        scheduler.execute(() -> sendUpdate(server, port, message));
        scheduler.scheduleAtFixedRate(
                () -> sendUpdate(serverRef, serverPort, serverMessage),
                REFRESH_INTERVAL_SECONDS,
                REFRESH_INTERVAL_SECONDS,
                TimeUnit.SECONDS);
    }

    /**
     * Triggers a rate-limited event-driven metaserver update.
     * The update is skipped if one was sent within the last
     * {@link #MIN_UPDATE_INTERVAL_MS} milliseconds, so callers do not need to
     * throttle themselves.  Used for player-join, player-leave, and game-start
     * events.
     */
    public static void notifyUpdate() {
        if (serverRef == null) return;
        long last = lastUpdateMs.get();
        long now = System.currentTimeMillis();
        if (now - last >= MIN_UPDATE_INTERVAL_MS && lastUpdateMs.compareAndSet(last, now)) {
            scheduler.execute(() -> sendUpdate(serverRef, serverPort, serverMessage));
        }
    }

    /**
     * Sends a shutdown (goodbye) notification so the metaserver removes this
     * server entry immediately.  Should be called from a JVM shutdown hook.
     */
    public static void publishGoodbye() {
        if (serverPort == 0) return;
        String postData = "host=" + SERVER_HOST + "&port=" + serverPort + "&bye=1";
        doPost(postData);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /** Builds full server state and sends it to the metaserver. */
    private static void sendUpdate(CivServer server, int port, String message) {
        try {
            Game game = server.getGame();
            StringBuilder sb = new StringBuilder();

            // Required fields
            sb.append("host=").append(SERVER_HOST);
            sb.append("&port=").append(port);
            sb.append("&type=freecivx");
            sb.append("&version=1.0");
            sb.append("&message=").append(enc(message));

            // Game state
            String state = game.isGameStarted() ? "Running" : "Pregame";
            sb.append("&state=").append(state);

            // Human player counts
            List<Player> humanPlayers = game.players.values().stream()
                    .filter(p -> !p.isAi())
                    .collect(Collectors.toList());
            long connectedHumans = humanPlayers.stream().filter(Player::isConnected).count();
            int available = Math.max(0, MAX_PLAYERS - humanPlayers.size());
            sb.append("&humans=").append(connectedHumans);
            sb.append("&available=").append(available);

            // Player list (mirrors plu/pll/pln/plf/plt/plh in C server meta.c)
            for (Player p : humanPlayers) {
                sb.append("&plu[]=").append(enc(p.getUsername()));
                sb.append("&pll[]=").append(enc(p.getUsername()));
                Nation nation = game.nations.get((long) p.getNation());
                String nationName = (nation != null) ? nation.getName() : "Unknown";
                sb.append("&pln[]=").append(enc(nationName));
                sb.append("&plf[]=").append(enc(nationName.toLowerCase()));
                sb.append("&plt[]=").append(p.isConnected() ? PLAYER_TYPE_HUMAN : PLAYER_TYPE_AI);
                sb.append("&plh[]=").append(enc(p.getAddress()));
            }

            // Server variables (mirrors vn[]/vv[] pairs in C server meta.c)
            sb.append("&vn[]=turn&vv[]=").append(game.turn);
            sb.append("&vn[]=year&vv[]=").append(game.getHistoricalYear());
            sb.append("&vn[]=timeout&vv[]=").append(game.getTurnTimeout());
            sb.append("&vn[]=endturn&vv[]=").append(game.getEndTurn());
            sb.append("&vn[]=aifill&vv[]=").append(game.getAifill());
            if (game.map != null) {
                sb.append("&vn[]=xsize&vv[]=").append(game.map.getXsize());
                sb.append("&vn[]=ysize&vv[]=").append(game.map.getYsize());
            }

            doPost(sb.toString());
            lastUpdateMs.set(System.currentTimeMillis());
        } catch (Exception e) {
            log.debug("Error building metaserver update: {}", e.getMessage());
        }
    }

    private static void doPost(String postData) {
        try {
            URL url = new URL(METASERVER_URL);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setConnectTimeout(5_000);
            conn.setReadTimeout(5_000);
            byte[] data = postData.getBytes(StandardCharsets.UTF_8);
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            conn.setRequestProperty("Content-Length", String.valueOf(data.length));
            try (OutputStream os = conn.getOutputStream()) {
                os.write(data);
            }
            int code = conn.getResponseCode();
            if (code == HttpURLConnection.HTTP_OK) {
                log.debug("Metaserver updated (state={}).", code);
            } else {
                log.warn("Metaserver returned HTTP {}.", code);
            }
        } catch (IOException e) {
            log.debug("Metaserver unreachable: {}", e.getMessage());
        }
    }

    private static String enc(String value) {
        if (value == null) return "";
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
