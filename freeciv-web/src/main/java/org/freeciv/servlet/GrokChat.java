package org.freeciv.servlet;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Properties;
import java.util.stream.Collectors;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.text.StringEscapeUtils;

@WebServlet("/grok_chat")
public class GrokChat extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("text/html; charset=UTF-8");
        resp.setCharacterEncoding("UTF-8");

        // Read and decode the message
        String message = req.getReader().lines().collect(Collectors.joining(System.lineSeparator()));
        message = new String(Base64.getDecoder().decode(message), StandardCharsets.UTF_8);
        message = StringEscapeUtils.escapeJson(message);

        // Load API key from properties
        Properties prop = new Properties();
        prop.load(getServletContext().getResourceAsStream("/WEB-INF/config.properties"));
        String apiKey = prop.getProperty("grok_key");
        if (apiKey == null || apiKey.isEmpty()) {
            System.err.println("Grok key missing.");
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\": \"API key missing\"}");
            return;
        }

        // Define the API endpoint
        String endpoint = "https://api.x.ai/v1/chat/completions";

        // Player and game information to enhance the LLM response
        String fcivInfo = """
            You are an assistant in the game FREECIVX.NET, a 3D browser-based fork of Freeciv. Answer questions concisely and provide helpful tips. Max 100 words. 
            New cities are built using the shortcut 'B' or by right-clicking on a Settler unit and selecting 'Build city.' Units move with the 'G' (Goto) command or arrow keys. 
            
            Common Keyboard Shortcuts:
              - a: Auto-settler (settler/worker units).
              - b: Build city (settler units).
              - f: Fortify unit (military units) / Build fortress (settler/worker units).
              - g: Go to tile (left-click to select target).
              - h: Set unit's home city (to current tile's city).
              - i: Build irrigation or convert terrain (settler/worker units).
              - m: Build mine or convert terrain (settler/worker units).
              - N: Explode nuclear weapon.
              - p: Clean pollution (settler/worker units).
              - P: Pillage terrain.
              - r: Build road/railroad (settler/worker units).
              - s: Sentry unit.
              - S: Unsentry all units on tile.
              - L: Airlift unit to a city.
              - u: Unload unit from transporter.
              - x: Auto-explore.
            
            Mouse Controls:
              - Middle-click: Get map tile information.
              - Left-click: Select units or cities.
              - Right-click: Move the map.
              - Left-click and drag: Change view angle.
        """;
        fcivInfo = StringEscapeUtils.escapeJson(fcivInfo);

        // JSON payload for the API
        String jsonPayload = String.format("""
            {
                "messages": [
                    {"role": "system", "content": "%s"},
                    {"role": "user", "content": "%s"}
                ],
                "model": "grok-beta",
                "stream": false,
                "temperature": 0
            }
            """, fcivInfo, message);

        System.out.println("Generated JSON payload: " + jsonPayload);

        // Create the HTTP client
        HttpClient client = HttpClient.newHttpClient();

        // Create the HTTP request
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload, StandardCharsets.UTF_8))
                .build();

        try {
            // Send the HTTP request and get the response
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            // Parse the response
            ObjectMapper objectMapper = new ObjectMapper();
            JsonNode jsonResponse = objectMapper.readTree(response.body());
            String messageContent = jsonResponse.path("choices").path(0).path("message").path("content").asText();

            // Escape newlines for JSON validity
            messageContent = messageContent.replace("\n\n", "\n").replace("\n", "<br>\\n").replace("*", "");

            // Write the response back to the client
            resp.setContentType("application/json");
            resp.setStatus(response.statusCode());
            resp.getWriter().write(String.format("{\"message\": \"%s\"}", messageContent));
        } catch (Exception e) {
            e.printStackTrace();
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            resp.getWriter().write("{\"error\": \"Internal server error\"}");
        }
    }
}
