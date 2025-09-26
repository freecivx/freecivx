/*******************************************************************************
 * Freeciv-web - the web version of Freeciv. http://www.FreecivX.net/
 * Copyright (C) 2009-2017 The Freeciv-web project
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *******************************************************************************/
package org.freeciv.servlet;

import java.io.*;
import jakarta.servlet.*;
import jakarta.servlet.http.*;

import java.nio.charset.StandardCharsets;
import java.sql.*;
import javax.sql.*;
import javax.naming.*;

import org.apache.commons.codec.digest.DigestUtils;
import org.freeciv.services.Validation;
import org.freeciv.util.Constants;


/**
 * Validates that the given username and password match a user in the database.
 * Such user must be verified.
 *
 * URL: /login_user
 */
public class LoginUser extends HttpServlet {
	
	private static final long serialVersionUID = 1L;

	private final Validation validation = new Validation();

	public void doPost(HttpServletRequest request, HttpServletResponse response)
			throws IOException, ServletException {

		String username = java.net.URLDecoder.decode(request.getParameter("username"), StandardCharsets.UTF_8);
		String secure_password = java.net.URLDecoder.decode(request.getParameter("sha_password"), StandardCharsets.UTF_8);


		if (secure_password == null || secure_password.length() <= 2) {
			response.sendError(HttpServletResponse.SC_BAD_REQUEST,
					"Invalid password. Please try again with another password.");
			return;
		}
		if (!validation.isValidUsername(username)) {
			response.sendError(HttpServletResponse.SC_BAD_REQUEST,
					"Invalid username. Please try again with another username.");
			return;
		}

		Connection conn = null;
		try {
			Context env = (Context) (new InitialContext().lookup(Constants.JNDI_CONNECTION));
			DataSource ds = (DataSource) env.lookup(Constants.JNDI_DDBBCON_MYSQL);
			conn = ds.getConnection();

			// Salted, hashed password.
			String saltHashQuery =
					"SELECT id, secure_hashed_password "
							+ "FROM auth "
							+ "WHERE LOWER(username) = LOWER(?) "
							+ "	AND verified = TRUE LIMIT 1";
			PreparedStatement ps1 = conn.prepareStatement(saltHashQuery);
			ps1.setString(1, username);
			ResultSet rs1 = ps1.executeQuery();
			if (!rs1.next()) {
				response.getOutputStream().print("Failed");
			} else {
				String hashedPasswordFromDB = rs1.getString(2);
				if (hashedPasswordFromDB != null &&
						hashedPasswordFromDB.equals(DigestUtils.sha256Hex(secure_password))) {

					String query = "UPDATE auth SET last_login = NOW() where username = ?";
					PreparedStatement preparedStatement = conn.prepareStatement(query);
					preparedStatement.setString(1, username);
					preparedStatement.executeUpdate();


					response.getOutputStream().print("OK," + rs1.getString(1));
				} else {
					response.getOutputStream().print("Failed");
				}
			}


		} catch (Exception err) {
			response.setHeader("result", "error");
			response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Unable to login");
		} finally {
			if (conn != null)
				try {
					conn.close();
				} catch (SQLException e) {
					e.printStackTrace();
				}
		}
	}

	public void doGet(HttpServletRequest request, HttpServletResponse response)
			throws IOException, ServletException {

		response.sendError(HttpServletResponse.SC_METHOD_NOT_ALLOWED, "This endpoint only supports the POST method.");

	}

}
