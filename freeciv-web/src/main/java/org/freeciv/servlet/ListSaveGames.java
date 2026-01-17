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
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Arrays;
import java.util.Comparator;
import javax.naming.Context;
import javax.naming.InitialContext;
import javax.sql.DataSource;

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
 * Returns a list of savegames for the given user
 *
 * URL: /listsavegames
 */
@RestController
public class ListSaveGames {

	@Autowired
	private Validation validation;
	
	@Value("${savegame.dir}")
	private String savegameDirectory;

	@PostMapping("/listsavegames")
	public ResponseEntity<String> listSaveGames(
			@RequestParam("username") String username,
			@RequestParam("userid") String userid) {

		if (!validation.isValidUsername(username)) {
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
					.body("Invalid username");
		}

        try {
			String usernameFromDB = getUsernameFromDB(username, userid);
			if (usernameFromDB == null ) {
				throw new Exception("Invalid");
			}
			File folder = new File(savegameDirectory + "/" + usernameFromDB.toLowerCase());

			if (!folder.exists()) {
				return ResponseEntity.ok(";");
			} else {
				File[] files = folder.listFiles();
				StringBuilder buffer = new StringBuilder();
				if (files != null) {
					Arrays.sort(files, new Comparator<File>() {
						public int compare(File f1, File f2) {
							return Long.compare(f2.lastModified(), f1.lastModified());
						}
					});

					for (File file : files) {
						if (file.isFile()) {
							String name = file.getName();
							if (name.endsWith(".sav.xz")) {
								name = name.replaceAll(".sav.xz", "");
							} else if (name.endsWith(".sav.zst")) {
								name = name.replaceAll(".sav.zst", "");
							}
							buffer.append(name);
							buffer.append(';');
						}
					}
				}
				return ResponseEntity.ok(buffer.toString());
			}

		} catch (Exception err) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST)
					.header("result", "error")
					.body("ERROR");
		}

	}

	@GetMapping("/listsavegames")
	public ResponseEntity<String> getNotAllowed() {
		return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
				.body("This endpoint only supports the POST method.");
	}


	private String getUsernameFromDB(String username, String userid) {
		Connection conn = null;
		try {
			String usernameFromDB;
			Context env = (Context) (new InitialContext().lookup(Constants.JNDI_CONNECTION));
			DataSource ds = (DataSource) env.lookup(Constants.JNDI_DDBBCON_MYSQL);
			conn = ds.getConnection();

			String usercheck =
					"SELECT username "
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
				if (!usernameFromDB.equalsIgnoreCase(username)) {
					throw new Exception("Invalid username.");
				}
				return usernameFromDB;
			}
		} catch (Exception err) {
			return null;
		}
	}

}
