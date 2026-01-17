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

import org.apache.commons.codec.digest.Crypt;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.sql.*;

import org.freeciv.services.Validation;
import org.freeciv.util.DatabaseUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;


/**
 * Deactivate a user account.
 *
 * URL: /deactivate_user
 */
@RestController
public class DeactivateUser {
	
	private static final Logger logger = LoggerFactory.getLogger(DeactivateUser.class);

	@Autowired
	private Validation validation;

	@PostMapping("/deactivate_user")
	public ResponseEntity<String> deactivateUser(
			@RequestParam("username") String username,
			@RequestParam("sha_password") String sha_password) {

		String secure_password = java.net.URLDecoder.decode(sha_password, StandardCharsets.UTF_8);

		if (!validation.isValidUsername(username)) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST)
					.body("Invalid username. Please try again with another username.");
		}

		try (Connection conn = DatabaseUtil.getConnection()) {
			// Salted, hashed password.
			String saltHashQuery =
					"SELECT secure_hashed_password "
							+ "FROM auth "
							+ "WHERE LOWER(username) = LOWER(?) "
							+ "	LIMIT 1";
			try (PreparedStatement ps1 = conn.prepareStatement(saltHashQuery)) {
				ps1.setString(1, username);
				try (ResultSet rs1 = ps1.executeQuery()) {
					if (!rs1.next()) {
						return ResponseEntity.ok("Failed");
					} else {
						String hashedPasswordFromDB = rs1.getString(1);
						if (hashedPasswordFromDB.equals(Crypt.crypt(secure_password, hashedPasswordFromDB))) {

							String query = "UPDATE auth SET verified = FALSE WHERE username = ? ";
							try (PreparedStatement preparedStatement = conn.prepareStatement(query)) {
								preparedStatement.setString(1, username);
								int no_updated = preparedStatement.executeUpdate();
								if (no_updated == 1) {
									return ResponseEntity.ok("OK!");
								} else {
									return ResponseEntity.status(HttpStatus.BAD_REQUEST)
											.body("Invalid username or password.");
								}
							}

						} else {
							return ResponseEntity.status(HttpStatus.BAD_REQUEST)
									.body("Invalid username or password.");
						}
					}
				}
			}

		} catch (Exception err) {
			logger.error("Error deactivating user", err);
			return ResponseEntity.status(HttpStatus.BAD_REQUEST)
					.header("result", "error")
					.body("Unable to login");
		}
	}

	@GetMapping("/deactivate_user")
	public ResponseEntity<String> getNotAllowed() {
		return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
				.body("This endpoint only supports the POST method.");
	}

}
