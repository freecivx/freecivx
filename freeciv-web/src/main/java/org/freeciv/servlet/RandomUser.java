/*******************************************************************************
 * Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
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

import java.sql.*;

import org.freeciv.util.DatabaseUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;


/**
 * Finds a random opponent username.
 *
 * URL: /random_user
 */
public class RandomUser extends HttpServlet {
	private static final Logger logger = LoggerFactory.getLogger(RandomUser.class);
	private static final long serialVersionUID = 1L;

	public void doPost(HttpServletRequest request, HttpServletResponse response)
			throws IOException, ServletException {

		String query =
				  "SELECT username "
				+ "FROM `auth` "
				+ "WHERE verified='1' "
				+ "	AND id >= (SELECT FLOOR(MAX(id) * RAND()) FROM `auth`) "
				+ "ORDER BY id LIMIT 1;";
		try (Connection conn = DatabaseUtil.getConnection();
		     PreparedStatement preparedStatement = conn.prepareStatement(query);
		     ResultSet rs = preparedStatement.executeQuery()) {
			if (!rs.next()) {
				response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Invalid user.");
				return;
			}
			response.getOutputStream().print(rs.getString(1));

		} catch (SQLException e) {
			logger.error("Failed to find random user", e);
			response.setHeader("result", "error");
			response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Unable to login");
		}
	}

	public void doGet(HttpServletRequest request, HttpServletResponse response)
			throws IOException, ServletException {

		response.sendError(HttpServletResponse.SC_METHOD_NOT_ALLOWED, "This endpoint only supports the POST method.");

	}

}