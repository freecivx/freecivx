package org.freeciv.servlet;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

import org.freeciv.util.DatabaseUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;


/**
 * Logs errors of Freecivx.com
 *
 * URL: /errorlog
 */
public class ErrorLog extends HttpServlet {
    private static final Logger logger = LoggerFactory.getLogger(ErrorLog.class);


    public void doPost(HttpServletRequest request, HttpServletResponse response)
            throws IOException, ServletException {

        String stacktrace = java.net.URLDecoder.decode(request.getParameter("stacktrace"), StandardCharsets.UTF_8);

        String query = "INSERT INTO errorlog (stacktrace) VALUES (?)";
        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement preparedStatement = conn.prepareStatement(query)) {
            preparedStatement.setString(1, stacktrace);
            preparedStatement.executeUpdate();
        } catch (SQLException e) {
            logger.error("Failed to log error to database", e);
            response.setHeader("result", "error");
        }

    }

}
