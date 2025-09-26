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

import java.sql.*;

import javax.sql.*;

import org.freeciv.util.Constants;

import javax.naming.*;


/**
 * This class is responsible for finding an available freeciv-web server for clients
 * based on information in the metaserver database.
 *
 * URL: /civclientlauncher
 */
public class CivclientLauncher extends HttpServlet {
	
	private static final long serialVersionUID = 1L;

	public void doPost(HttpServletRequest request, HttpServletResponse response)
			throws IOException, ServletException {

		// Parse input parameters ...
		String action = request.getParameter("action");
		if (action == null) {
			action = "new";
		}

		String civServerPort = request.getParameter("civserverport");

		Connection conn = null;
		try {
			Context env = (Context) (new InitialContext().lookup(Constants.JNDI_CONNECTION));
			DataSource ds = (DataSource) env.lookup(Constants.JNDI_DDBBCON_MYSQL);
			conn = ds.getConnection();
			
			String gameType;
			switch (action) {
			case "new":
			case "load":
			case "observe":
			case "multi":
			case "earthload":
				gameType = "singleplayer";
				break;
			default:
				response.setHeader("result", "invalid port validation");
				response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
						"Unable to find a valid Freeciv server to play on. Please try again later.");
				return;
			}
			

			if (civServerPort == null || civServerPort.isEmpty()) {
				// If the user requested a new game, then get host and port for an available
				// server from the metaserver DB, and use that one.
				String lookupQuery =
						"SELECT port "
								+ "FROM servers "
								+ "WHERE state = 'Pregame' "
								+ "	AND type = ? "
								+ "	AND humans = '0' "
								+ "ORDER BY RAND() "
								+ "LIMIT 1 ";

				PreparedStatement lookupStmt = conn.prepareStatement(lookupQuery);
				lookupStmt.setString(1, gameType);
				ResultSet lookupRs = lookupStmt.executeQuery();
				if (lookupRs.next()) {
					civServerPort = Integer.toString(lookupRs.getInt(1));
				} else {
					response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
							"No servers available for creating a new game on.");
					return;
				}
			}

			/* Validate port */
			String validateQuery = "SELECT COUNT(*) FROM servers WHERE port = ?";
			PreparedStatement validateStmt = conn.prepareStatement(validateQuery);
			if (civServerPort == null || civServerPort.isEmpty()) {
				response.setHeader("result", "invalid port validation");
				response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
						"Unable to find a valid Freeciv server to play on. Please try again later.");
				return;
			}

			validateStmt.setInt(1, Integer.parseInt(civServerPort));
			ResultSet validateRs = validateStmt.executeQuery();
			validateRs.next();
			if (validateRs.getInt(1) != 1) {
				response.setHeader("result", "invalid port validation");
				response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
						"Invalid input values to civclient.");
				return;
			}

		} catch (Exception err) {
			response.setHeader("result", err.getMessage());
			err.printStackTrace();
			return;
		} finally {
			if (conn != null)
				try {
					conn.close();
				} catch (SQLException e) {
					e.printStackTrace();
				}
		}

		int port = Integer.parseInt(civServerPort);
		response.setHeader("port", String.valueOf(port));
		response.setHeader("result", "success");
		response.getOutputStream().print("success");

	}

	public void doGet(HttpServletRequest request, HttpServletResponse response)
			throws IOException, ServletException {

		response.sendError(HttpServletResponse.SC_METHOD_NOT_ALLOWED, "This endpoint only supports the POST method.");

	}

}
