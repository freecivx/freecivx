package org.freeciv.servlet;

import jakarta.servlet.annotation.WebServlet;
import org.apache.commons.io.FileUtils;
import javax.naming.Context;
import javax.naming.InitialContext;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
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

/**
 * Submit game results to Hall of Fame.
 *
 * URL: /hall_of_fame_post
 */
@WebServlet("/hall_of_fame_post")
public class HallOfFamePost extends HttpServlet {

    private static final Logger LOGGER = Logger.getLogger(HallOfFamePost.class.getName());
    private static final Validation VALIDATION = new Validation();
    private static final Pattern ALPHA_NUMERIC_PATTERN = Pattern.compile("^[0-9a-zA-Z .]+$");
    private static final String MAP_SRC_IMG_PATH = System.getenv("MAP_SRC_IMG_PATH");
    private static final String MAP_DST_IMG_PATH = System.getenv("MAP_DST_IMG_PATH");

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws IOException, ServletException {

        String username = sanitizeInput(request.getParameter("username"));
        String nation = sanitizeInput(request.getParameter("nation"));
        String score = sanitizeInput(request.getParameter("score"));
        String turn = sanitizeInput(request.getParameter("turn"));
        String port = sanitizeInput(request.getParameter("port"));
        String ipAddress = request.getHeader("X-Real-IP");
        if (ipAddress == null) {
            ipAddress = request.getRemoteAddr();
        }

        // Input validation
        if (!VALIDATION.isValidUsername(username)) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Invalid username.");
            return;
        }

        if (!ALPHA_NUMERIC_PATTERN.matcher(score).matches() || !ALPHA_NUMERIC_PATTERN.matcher(turn).matches()) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Invalid data submitted.");
            return;
        }

        // Database and file operations
        try (Connection conn = getDatabaseConnection()) {
            int newId = getNewId(conn);

            // Handle map image securely
            handleMapImage(port, newId);

            // Insert game results
            insertGameResult(conn, username, nation, score, turn, ipAddress);

        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "Error processing Hall of Fame submission", e);
            response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "An internal error occurred.");
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
