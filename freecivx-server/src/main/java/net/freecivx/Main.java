package net.freecivx;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import java.io.OutputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.concurrent.Executors;
import org.java_websocket.server.WebSocketServer;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class Main {

    public static void main(String[] args) {
        int port = 2000; // Default port

        if (args.length >= 1) {
            try {
                port = Integer.parseInt(args[0]);
            } catch (NumberFormatException e) {
                System.err.println("Invalid port number: " + args[0]);
                System.exit(1);
                return; // This return is just to satisfy the compiler.
            }
        }

        try {
            // Create HTTP server
            HttpServer httpServer = HttpServer.create(new InetSocketAddress(port), 0);
            httpServer.createContext("/", new RootHandler());
            httpServer.createContext("/status", new StatusHandler());
            httpServer.setExecutor(Executors.newCachedThreadPool());
            System.out.println("HTTP server started on port: " + port);

            // Start WebSocket server
            WebSocketServer wsServer = new CivWebSocketServer(new InetSocketAddress(port + 1));
            wsServer.start();
            System.out.println("WebSocket server started on port: " + (port + 1));

            // Start HTTP server
            httpServer.start();

            // Publish to metaserver
            publishToMetaserver(port);

        } catch (IOException e) {
            System.err.println("Failed to start the server: " + e.getMessage());
            System.exit(1);
        }
    }

    private static void publishToMetaserver(int port) {
        String metaserverUrl = "http://localhost:8080/freeciv-web/meta/metaserver";
        String serverHost = "localhost"; // Replace with actual host if necessary
        String postData = String.format("host=%s&port=%d&vn[]=&vv[]=&type=freecivx&message=%s", serverHost, port, "Freecivx Multiplayer Server (Java)");

        try {
            URL url = new URL(metaserverUrl);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            connection.setRequestProperty("Content-Length", String.valueOf(postData.length()));

            try (OutputStream os = connection.getOutputStream()) {
                os.write(postData.getBytes(StandardCharsets.UTF_8));
            }

            int responseCode = connection.getResponseCode();
            System.out.println("Response: " + connection.getResponseMessage());
            if (responseCode == HttpURLConnection.HTTP_OK) {
                System.out.println("Server successfully published to metaserver.");
            } else {
                System.err.println("Failed to publish to metaserver. Response code: " + responseCode);
            }
        } catch (IOException e) {
            System.err.println("Error publishing to metaserver: " + e.getMessage());
        }
    }

    static class RootHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String response = "Welcome to FreecivX Server!";
            exchange.sendResponseHeaders(200, response.getBytes().length);
            OutputStream os = exchange.getResponseBody();
            os.write(response.getBytes());
            os.close();
        }
    }

    static class StatusHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String response = "Server is running and healthy!";
            exchange.sendResponseHeaders(200, response.getBytes().length);
            OutputStream os = exchange.getResponseBody();
            os.write(response.getBytes());
            os.close();
        }
    }

    static class CivWebSocketServer extends WebSocketServer {

        public CivWebSocketServer(InetSocketAddress address) {
            super(address);
        }

        @Override
        public void onOpen(WebSocket conn, ClientHandshake handshake) {
            System.out.println("New connection: " + conn.getRemoteSocketAddress());
            conn.send("Welcome to the FreecivX WebSocket server!");
        }

        @Override
        public void onClose(WebSocket conn, int code, String reason, boolean remote) {
            System.out.println("Connection closed: " + conn.getRemoteSocketAddress());
        }

        @Override
        public void onMessage(WebSocket conn, String message) {
            System.out.println("Message received: " + message);
            conn.send("Echo: " + message);
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
}
