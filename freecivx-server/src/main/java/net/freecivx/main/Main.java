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

package net.freecivx.main;

import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import net.freecivx.server.CivServer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;


public class Main {

    private static final Logger log = LoggerFactory.getLogger(Main.class);

    public static void main(String[] args) {
        int port = 7800; // Default port
        String gameMode = "singleplayer"; // Default game mode
        String tiles = "square"; // Default tile type: "square" or "hex"
        String metaMessage = null; // Computed after parsing args if not set explicitly
        int mapSize = 0; // 0 means use default (80)

        for (int i = 0; i < args.length; i++) {
            if ("--mode".equals(args[i]) && i + 1 < args.length) {
                gameMode = args[++i].toLowerCase();
                if (!"singleplayer".equals(gameMode) && !"multiplayer".equals(gameMode)) {
                    log.error("Invalid game mode: {}. Use 'singleplayer' or 'multiplayer'.", gameMode);
                    System.exit(1);
                    return;
                }
            } else if ("--tiles".equals(args[i]) && i + 1 < args.length) {
                tiles = args[++i].toLowerCase();
                if (!"square".equals(tiles) && !"hex".equals(tiles)) {
                    log.error("Invalid tiles type: {}. Use 'square' or 'hex'.", tiles);
                    System.exit(1);
                    return;
                }
            } else if ("--metamessage".equals(args[i]) && i + 1 < args.length) {
                metaMessage = args[++i];
            } else if ("--mapsize".equals(args[i]) && i + 1 < args.length) {
                try {
                    mapSize = Integer.parseInt(args[++i]);
                    if (mapSize <= 0) {
                        log.error("Map size must be a positive integer, got: {}", mapSize);
                        System.exit(1);
                        return;
                    }
                } catch (NumberFormatException e) {
                    log.error("Invalid map size: {}", args[i]);
                    System.exit(1);
                    return;
                }
            } else if (!args[i].startsWith("--")) {
                try {
                    port = Integer.parseInt(args[i]);
                } catch (NumberFormatException e) {
                    log.error("Invalid port number: {}", args[i]);
                    System.exit(1);
                    return;
                }
            }
        }

        if (metaMessage == null) {
            String modeLabel = "multiplayer".equals(gameMode) ? "Multiplayer" : "Singleplayer";
            String tilesLabel = "hex".equals(tiles) ? "Hex" : "Square";
            metaMessage = "Freecivx " + modeLabel + " Server - " + tilesLabel + " map tiles - Java server";
        }

        int topologyId = "hex".equals(tiles) ? net.freecivx.game.Game.TF_HEX : 0;

        log.info("This is the server for Freecivx on port {} in {} mode with {} tiles. You can learn a lot about Freecivx at https://www.freecivx.com/", port, gameMode, tiles);

        try {
            // Create HTTP server
            HttpServer httpServer = HttpServer.create(new InetSocketAddress(port + 1), 0);
            httpServer.createContext("/", new HTTPStatusWebHandler());
            httpServer.setExecutor(Executors.newCachedThreadPool());
            log.info("HTTP server started on port: {}", port + 1);

            // Start WebSocket server
            CivServer wsServer = mapSize > 0
                    ? new CivServer(new InetSocketAddress(port), gameMode, topologyId, mapSize)
                    : new CivServer(new InetSocketAddress(port), gameMode, topologyId);
            wsServer.start();
            log.info("WebSocket server started on port: {}", port);

            // Idle restart: reset game if no players for 24 hours
            final long IDLE_RESET_MS = TimeUnit.HOURS.toMillis(24);
            ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
            scheduler.scheduleAtFixedRate(() -> {
                try {
                    if (wsServer.getConnectedClientCount() == 0) {
                        long idleMs = System.currentTimeMillis() - wsServer.getLastActivityTime();
                        if (idleMs > IDLE_RESET_MS) {
                            log.info("No players for 24h, resetting game...");
                            wsServer.resetGame();
                        }
                    }
                } catch (Exception e) {
                    log.error("Idle-restart check error: {}", e.getMessage());
                }
            }, 1, 1, TimeUnit.HOURS);

            // Start HTTP server
            httpServer.start();

            // Start metaserver reporting: initial publish + periodic refresh + goodbye on shutdown
            final int finalPort = port;
            final String finalMessage = metaMessage;
            MetaserverClient.start(wsServer, finalPort, finalMessage);
            Runtime.getRuntime().addShutdownHook(new Thread(MetaserverClient::publishGoodbye, "meta-goodbye"));

        } catch (IOException e) {
            log.error("Failed to start the server: {}", e.getMessage());
            System.exit(1);
        }
    }








}
