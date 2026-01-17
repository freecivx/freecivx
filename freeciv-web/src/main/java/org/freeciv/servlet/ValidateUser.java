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

import java.sql.*;

import javax.sql.*;

import org.freeciv.util.Constants;

import javax.naming.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;


/**
 * Given a username or an email address it verifies
 * if it matches a user in the database.
 *
 * URL: /validate_user
 */
@RestController
public class ValidateUser {

	@PostMapping("/validate_user")
	public ResponseEntity<String> validateUser(@RequestParam("userstring") String usernameOrEmail) {

		Connection conn = null;
		try {

			Context env = (Context) (new InitialContext().lookup(Constants.JNDI_CONNECTION));
			DataSource ds = (DataSource) env.lookup(Constants.JNDI_DDBBCON_MYSQL);
			conn = ds.getConnection();

			String query =
					  "SELECT username, verified "
					+ "FROM auth "
					+ "WHERE LOWER(username) = LOWER(?) "
					+ "	OR LOWER(email) = LOWER(?)";

			PreparedStatement preparedStatement = conn.prepareStatement(query);
			preparedStatement.setString(1, usernameOrEmail);
			preparedStatement.setString(2, usernameOrEmail);
			ResultSet rs = preparedStatement.executeQuery();

			if (rs.next()) {
				String username = rs.getString(1);
				int activated = rs.getInt(2);
				if (activated == 1) {
					return ResponseEntity.ok(username);
				} else {
					return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid user");
				}
			} else if (usernameOrEmail != null && usernameOrEmail.contains("@")) {
				return ResponseEntity.ok("invitation");
			} else {
				return ResponseEntity.ok("user_does_not_exist");
			}

		} catch (Exception err) {
			err.printStackTrace();
			return ResponseEntity.status(HttpStatus.BAD_REQUEST)
					.header("result", "error")
					.body("Unable to login");
		} finally {
			if (conn != null)
				try {
					conn.close();
				} catch (SQLException e) {
					e.printStackTrace();
				}
		}

	}

	@GetMapping("/validate_user")
	public ResponseEntity<String> getNotAllowed() {
		return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
				.body("This endpoint only supports the POST method.");
	}

}