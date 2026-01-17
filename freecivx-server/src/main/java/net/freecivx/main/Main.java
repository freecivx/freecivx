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

package net.freecivx.main;

import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.concurrent.Executors;

import net.freecivx.server.CivServer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;


public class Main {
    private static final Logger logger = LoggerFactory.getLogger(Main.class);

    public static void main(String[] args) {
        int port = 7800; // Default port

        if (args.length >= 1) {
            try {
                port = Integer.parseInt(args[0]);
            } catch (NumberFormatException e) {
                logger.error("Invalid port number: {}", args[0]);
                System.exit(1);
                return;
            }
        }

        logger.info("This is the server for Freecivx on port {}. You can learn a lot about Freecivx at https://www.FreecivWorld.net/", port);

        try {
            // Create HTTP server
            HttpServer httpServer = HttpServer.create(new InetSocketAddress(port + 1), 0);
            httpServer.createContext("/", new HTTPStatusWebHandler());
            httpServer.setExecutor(Executors.newCachedThreadPool());
            logger.info("HTTP server started on port: {}", (port + 1));

            // Start WebSocket server
            CivServer wsServer = new CivServer(new InetSocketAddress(port));
            wsServer.start();
            logger.info("WebSocket server started on port: {}", port);

            // Start HTTP server
            httpServer.start();

            // Publish to metaserver
            MetaserverClient.publishToMetaserver(port);

        } catch (IOException e) {
            logger.error("Failed to start the server: {}", e.getMessage(), e);
            System.exit(1);
        }
    }








}
