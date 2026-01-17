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
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Objects;
import javax.naming.Context;
import javax.naming.InitialContext;
import javax.sql.DataSource;

import org.apache.commons.codec.digest.DigestUtils;
import org.freeciv.services.Validation;
import org.freeciv.util.Constants;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Deletes a savegame.
 *
 * URL: /deletesavegame
 */
@RestController
public class DeleteSaveGame {

	@Autowired
	private Validation validation;
	
	@Value("${savegame.dir}")
	private String savegameDirectory;

	@PostMapping("/deletesavegame")
	public ResponseEntity<String> deleteSaveGame(
			@RequestParam("username") String username,
			@RequestParam("savegame") String savegame,
			@RequestParam("sha_password") String sha_password,
			@RequestParam("userid") String userid) {

		String secure_password = java.net.URLDecoder.decode(sha_password, StandardCharsets.UTF_8);

		if (!validation.isValidUsername(username)) {
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
					.body("Invalid username");
		}
		String usernameFromDB = getUsernameFromDB(username, userid, secure_password);

		if (savegame == null || savegame.length() > 100 || savegame.contains("/") || savegame.contains("\\") || savegame.contains(".")) {
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
					.body("Invalid savegame");
		}

		try {
			if (usernameFromDB == null ) {
				throw new Exception("Invalid");
			}

			File folder = new File(savegameDirectory + "/" + usernameFromDB.toLowerCase());

			if (!folder.exists()) {
				return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
						.body("Save folder under the given username cannot be found.");
			} 
			boolean fileFound = false;
			for (File savegameFile: Objects.requireNonNull(folder.listFiles())) {
				if (savegameFile.exists() && savegameFile.isFile()) {
					if (savegame.equals("ALL") || savegameFile.getName().startsWith(savegame)){
						// NOTE: the server does not distinguish saved games of different extensions when loading. So we can delete all of them.
						Files.delete(savegameFile.toPath());
						fileFound = true;
					}
				}
			}
			if (!fileFound) {
				return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
						.body("Saved game not found.");
            }
            return ResponseEntity.ok().build();
		} catch (Exception err) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST)
					.header("result", "error")
					.body("ERROR");
		}

	}

	@GetMapping("/deletesavegame")
	public ResponseEntity<String> getNotAllowed() {
		return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
				.body("This endpoint only supports the POST method.");
	}

	private String getUsernameFromDB(String username, String userid, String secure_password) {
		Connection conn = null;
		try {
			String usernameFromDB;
			Context env = (Context) (new InitialContext().lookup(Constants.JNDI_CONNECTION));
			DataSource ds = (DataSource) env.lookup(Constants.JNDI_DDBBCON_MYSQL);
			conn = ds.getConnection();

			String usercheck =
					"SELECT username, secure_hashed_password "
							+ "FROM auth "
							+ "WHERE LOWER(username) = LOWER(?) "
							+ "	AND id = ? LIMIT 1";
			PreparedStatement ps1 = conn.prepareStatement(usercheck);
			ps1.setString(1, username);
			ps1.setString(2, userid);
			ResultSet rs1 = ps1.executeQuery();
			if (!rs1.next()) {
				return null;
			} else {
				usernameFromDB = rs1.getString(1);
				if (!validation.isValidUsername(usernameFromDB)) {
					return null;
				}
				if (!usernameFromDB.equals(username)) {
					throw new Exception("Invalid username.");
				}
				String hashedPwd = rs1.getString(2);
                if (hashedPwd == null || !hashedPwd.equals(DigestUtils.sha256Hex(secure_password))) {
                    throw new Exception("Invalid auth.");
                }
                return usernameFromDB;
			}
		} catch (Exception err) {
			return null;
		}
	}

}