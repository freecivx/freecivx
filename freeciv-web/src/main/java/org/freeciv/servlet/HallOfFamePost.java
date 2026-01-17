package org.freeciv.servlet;

import org.apache.commons.io.FileUtils;
import javax.naming.Context;
import javax.naming.InitialContext;
import javax.sql.DataSource;
import java.io.File;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.regex.Pattern;
import java.util.logging.Level;
import java.util.logging.Logger;

import org.freeciv.services.Validation;
import org.freeciv.util.Constants;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Submit game results to Hall of Fame.
 *
 * URL: /hall_of_fame_post
 */
@RestController
public class HallOfFamePost {

    private static final Logger LOGGER = Logger.getLogger(HallOfFamePost.class.getName());
    private static final Pattern ALPHA_NUMERIC_PATTERN = Pattern.compile("^[0-9a-zA-Z .]+$");
    private static final String MAP_SRC_IMG_PATH = System.getenv("MAP_SRC_IMG_PATH");
    private static final String MAP_DST_IMG_PATH = System.getenv("MAP_DST_IMG_PATH");

    @Autowired
    private Validation validation;

    @PostMapping("/hall_of_fame_post")
    public ResponseEntity<Void> submitHallOfFame(
            @RequestParam("username") String username,
            @RequestParam("nation") String nation,
            @RequestParam("score") String score,
            @RequestParam("turn") String turn,
            @RequestParam("port") String port,
            jakarta.servlet.http.HttpServletRequest request) {

        username = sanitizeInput(username);
        nation = sanitizeInput(nation);
        score = sanitizeInput(score);
        turn = sanitizeInput(turn);
        port = sanitizeInput(port);

        String ipAddress = request.getHeader("X-Real-IP");
        if (ipAddress == null) {
            ipAddress = request.getRemoteAddr();
        }

        // Input validation
        if (!validation.isValidUsername(username)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }

        if (!ALPHA_NUMERIC_PATTERN.matcher(score).matches() || !ALPHA_NUMERIC_PATTERN.matcher(turn).matches()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }

        // Database and file operations
        try (Connection conn = getDatabaseConnection()) {
            int newId = getNewId(conn);

            // Handle map image securely
            handleMapImage(port, newId);

            // Insert game results
            insertGameResult(conn, username, nation, score, turn, ipAddress);

            return ResponseEntity.ok().build();

        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "Error processing Hall of Fame submission", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    private Connection getDatabaseConnection() throws Exception {
        Context env = (Context) new InitialContext().lookup(Constants.JNDI_CONNECTION);
        DataSource ds = (DataSource) env.lookup(Constants.JNDI_DDBBCON_MYSQL);
        return ds.getConnection();
    }

    private int getNewId(Connection conn) throws SQLException {
        String idQuery = "SELECT COALESCE(MAX(id), 0) + 1 FROM hall_of_fame";
        try (PreparedStatement stmt = conn.prepareStatement(idQuery);
             ResultSet rs = stmt.executeQuery()) {
            if (rs.next()) {
                return rs.getInt(1);
            }
            return 1;
        }
    }

    private void handleMapImage(String port, int newId) throws IOException {
        String sanitizedPort = sanitizeInput(port);
        File mapImg = new File(MAP_SRC_IMG_PATH, "map-" + sanitizedPort + ".map.gif");

        if (mapImg.exists()) {
            File destinationDir = new File(MAP_DST_IMG_PATH);
            FileUtils.moveFileToDirectory(mapImg, destinationDir, true);
            File resultFile = new File(destinationDir, newId + ".gif");
            if (!resultFile.exists()) {
                throw new IOException("Failed to rename map image file.");
            }
        }
    }

    private void insertGameResult(Connection conn, String username, String nation, String score, String turn, String ipAddress) throws SQLException {
        String query = "INSERT INTO hall_of_fame (username, nation, score, end_turn, end_date, ip) VALUES (?, ?, ?, ?, NOW(), ?)";
        try (PreparedStatement stmt = conn.prepareStatement(query)) {
            stmt.setString(1, username);
            stmt.setString(2, nation);
            stmt.setString(3, score);
            stmt.setString(4, turn);
            stmt.setString(5, ipAddress);
            stmt.executeUpdate();
        }
    }

    private String sanitizeInput(String input) {
        if (input == null) {
            return "";
        }
        return input.replaceAll("[^0-9a-zA-Z .]", "").trim();
    }
}
