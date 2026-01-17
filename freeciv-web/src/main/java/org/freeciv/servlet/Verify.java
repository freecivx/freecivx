package org.freeciv.servlet;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.freeciv.util.DatabaseUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

@WebServlet("/verify")
public class Verify extends HttpServlet {
    private static final Logger logger = LoggerFactory.getLogger(Verify.class);

    public void doGet(HttpServletRequest request, HttpServletResponse response)
            throws IOException, ServletException {
        String id = request.getParameter("id");

        String query = "UPDATE auth SET verified = TRUE where verifykey = ?";
        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement preparedStatement = conn.prepareStatement(query)) {
            preparedStatement.setString(1, id);
            preparedStatement.executeUpdate();

            response.sendRedirect("http://www.FreecivWorld.net?verify=ok");
            Thread.sleep(100);

        } catch (SQLException e) {
            logger.error("Failed to verify user", e);
            response.setHeader("result", "error");
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Unable to create user.");
        } catch (InterruptedException e) {
            logger.error("Thread interrupted during verification", e);
            Thread.currentThread().interrupt();
            response.setHeader("result", "error");
            response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Verification interrupted.");
        }
    }
}
