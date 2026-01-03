package org.freeciv.servlet;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.freeciv.util.Constants;

import javax.naming.Context;
import javax.naming.InitialContext;
import javax.sql.DataSource;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

@WebServlet("/verify")
public class Verify extends HttpServlet {

    public void doGet(HttpServletRequest request, HttpServletResponse response)
            throws IOException, ServletException {
        String id = request.getParameter("id");

        Connection conn = null;
        try {
            Context env = (Context) (new InitialContext().lookup(Constants.JNDI_CONNECTION));
            DataSource ds = (DataSource) env.lookup(Constants.JNDI_DDBBCON_MYSQL);
            conn = ds.getConnection();

            String query = "UPDATE auth SET verified = TRUE where verifykey = ?";
            PreparedStatement preparedStatement = conn.prepareStatement(query);
            preparedStatement.setString(1,id);
            preparedStatement.executeUpdate();

            response.sendRedirect("http://www.FreecivWorld.net?verify=ok");
            Thread.sleep(100);

    } catch (Exception err) {
        System.err.println(err);
        response.setHeader("result", "error");
        response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Unable to create user.");
    } finally {
        if (conn != null)
            try {
                conn.close();
            } catch (SQLException e) {
                e.printStackTrace();
            }
    }



    }
}
