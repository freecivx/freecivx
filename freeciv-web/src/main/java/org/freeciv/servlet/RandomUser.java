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

import org.freeciv.util.DatabaseUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;


/**
 * Finds a random opponent username.
 *
 * URL: /random_user
 */
@RestController
public class RandomUser {
	private static final Logger logger = LoggerFactory.getLogger(RandomUser.class);

	@PostMapping("/random_user")
	public ResponseEntity<String> getRandomUser() {

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
				return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid user.");
			}
			return ResponseEntity.ok(rs.getString(1));

		} catch (SQLException e) {
			logger.error("Failed to find random user", e);
			return ResponseEntity.status(HttpStatus.BAD_REQUEST)
					.header("result", "error")
					.body("Unable to login");
		}
	}

	@GetMapping("/random_user")
	public ResponseEntity<String> getNotAllowed() {
		return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
				.body("This endpoint only supports the POST method.");
	}

}