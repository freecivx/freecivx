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

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.freeciv.util.DatabaseUtil;
import org.json.JSONObject;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Displays the multiplayer games
 *
 * URL: /meta/metaserver
 */
@RestController
public class Metaserver {

	private static final Logger logger = LoggerFactory.getLogger(Metaserver.class);
	
	private static final String CONTENT_TYPE = "application/json";

	private static final String INTERNAL_SERVER_ERROR = new JSONObject() //
			.put("statusCode", HttpStatus.INTERNAL_SERVER_ERROR.value()) //
			.put("error", "Internal server error.") //
			.toString();

	private static final String FORBIDDEN = new JSONObject() //
			.put("statusCode", HttpStatus.FORBIDDEN.value()) //
			.put("error", "Forbidden.") //
			.toString();

	private static final String BAD_REQUEST = new JSONObject() //
			.put("statusCode", HttpStatus.BAD_REQUEST.value()) //
			.put("error", "Bad Request.") //
			.toString();

	private static final List<String> SERVER_COLUMNS = new ArrayList<>();

	static {
		SERVER_COLUMNS.add("version");
		SERVER_COLUMNS.add("patches");
		SERVER_COLUMNS.add("capability");
		SERVER_COLUMNS.add("state");
		SERVER_COLUMNS.add("ruleset");
		SERVER_COLUMNS.add("message");
		SERVER_COLUMNS.add("type");
		SERVER_COLUMNS.add("available");
		SERVER_COLUMNS.add("humans");
		SERVER_COLUMNS.add("serverid");
		SERVER_COLUMNS.add("host");
		SERVER_COLUMNS.add("port");
	}

	@PostMapping("/meta/metaserver")
	public ResponseEntity<String> updateMetaserver(
			@RequestParam(required = false) String bye,
			@RequestParam(required = false) String host,
			@RequestParam(required = false) String port,
			@RequestParam(required = false) String dropplrs,
			@RequestParam(value = "plu[]", required = false) List<String> sPlUser,
			@RequestParam(value = "pll[]", required = false) List<String> sPlName,
			@RequestParam(value = "pln[]", required = false) List<String> sPlNation,
			@RequestParam(value = "plf[]", required = false) List<String> sPlFlag,
			@RequestParam(value = "plt[]", required = false) List<String> sPlType,
			@RequestParam(value = "plh[]", required = false) List<String> sPlHost,
			@RequestParam(value = "vn[]", required = false) List<String> variableNames,
			@RequestParam(value = "vv[]", required = false) List<String> variableValues,
			@RequestParam Map<String, String> allParams,
			jakarta.servlet.http.HttpServletRequest request) {

		String localAddr = request.getLocalAddr();
		String remoteAddr = request.getRemoteAddr();

		if ((localAddr == null) || !localAddr.equals(remoteAddr)) {
			return ResponseEntity.status(HttpStatus.FORBIDDEN)
					.header("Content-Type", CONTENT_TYPE)
					.body(FORBIDDEN);
		}

		String serverIsStopping = bye;
		String sHost = host;
		String sPort = port;
		String dropPlayers = dropplrs;

		Map<String, String> serverVariables = new HashMap<>();
		for (String serverParameter : SERVER_COLUMNS) {
			String parameter = allParams.get(serverParameter);
			if (parameter != null) {
				serverVariables.put(serverParameter, parameter);
			}
		}

		// Data validation
		String query;
		int portNum;
		try {
			if (sPort == null) {
				throw new IllegalArgumentException("Port must be supplied.");
			}
			portNum = Integer.parseInt(sPort);
			if ((portNum < 1024) || (portNum > 65535)) {
				throw new IllegalArgumentException("Invalid port supplied. Expected a number between 1024 and 65535");
			}
			if (sHost == null) {
				throw new IllegalArgumentException("Host parameter is required to perform this request.");
			}
		} catch (IllegalArgumentException e) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST)
					.header("Content-Type", CONTENT_TYPE)
					.body(BAD_REQUEST);
		}

		String hostPort = sHost + ':' + sPort;
		try (Connection conn = DatabaseUtil.getConnection()) {
			PreparedStatement statement;

			if (serverIsStopping != null) {
				query = "DELETE FROM servers WHERE host = ? AND port = ?";
				try (PreparedStatement ps = conn.prepareStatement(query)) {
					ps.setString(1, sHost);
					ps.setInt(2, portNum);
					ps.executeUpdate();
				}

				query = "DELETE FROM variables WHERE hostport = ?";
				try (PreparedStatement ps = conn.prepareStatement(query)) {
					ps.setString(1, hostPort);
					ps.executeUpdate();
				}

				query = "DELETE FROM players WHERE hostport = ?";
				try (PreparedStatement ps = conn.prepareStatement(query)) {
					ps.setString(1, hostPort);
					ps.executeUpdate();
				}
				return ResponseEntity.ok().build();
			}

			boolean isSettingPlayers = (sPlUser != null) && !sPlUser.isEmpty() //
					&& (sPlName != null) && !sPlName.isEmpty() //
					&& (sPlNation != null) && !sPlNation.isEmpty() //
					&& (sPlFlag != null) && !sPlFlag.isEmpty() //
					&& (sPlType != null) && !sPlType.isEmpty() //
					&& (sPlHost != null) && !sPlHost.isEmpty();

			if (isSettingPlayers || (dropPlayers != null)) {
				query = "DELETE FROM players WHERE hostport = ?";
				try (PreparedStatement ps = conn.prepareStatement(query)) {
					ps.setString(1, hostPort);
					ps.executeUpdate();
				}

				if (dropPlayers != null) {
					query = "UPDATE servers SET available = 0, humans = -1 WHERE host = ? AND port = ?";
					try (PreparedStatement ps = conn.prepareStatement(query)) {
						ps.setString(1, sHost);
						ps.setInt(2, portNum);
						ps.executeUpdate();
					}
				}

				if (isSettingPlayers) {
					query = "INSERT INTO players (hostport, username, name, nation, flag, type, host) VALUES (?, ?, ?, ?, ?, ?, ?)";
					try (PreparedStatement ps = conn.prepareStatement(query)) {
						try {
							for (int i = 0; i < sPlUser.size(); i++) {
								ps.setString(1, hostPort);
								ps.setString(2, sPlUser.get(i));
								ps.setString(3, sPlName.get(i));
								ps.setString(4, sPlNation.get(i));
								ps.setString(5, sPlFlag.get(i));
								ps.setString(6, sPlType.get(i));
								ps.setString(7, sPlHost.get(i));
								ps.executeUpdate();
							}
						} catch (IndexOutOfBoundsException e) {
							return ResponseEntity.status(HttpStatus.BAD_REQUEST)
									.header("Content-Type", CONTENT_TYPE)
									.body(BAD_REQUEST);
						}
					}
				}
			}

			// delete this variables that this server might have already set
			try (PreparedStatement ps = conn.prepareStatement("DELETE FROM variables WHERE hostport = ?")) {
				ps.setString(1, hostPort);
				ps.executeUpdate();
			}

			if (variableNames != null && !variableNames.isEmpty() && variableValues != null && !variableValues.isEmpty()) {

				query = "INSERT INTO variables (hostport, name, setting) VALUES (?, ?, ?)";
				try (PreparedStatement ps = conn.prepareStatement(query)) {
					try {
						for (int i = 0; i < variableNames.size(); i++) {
							ps.setString(1, hostPort);
							ps.setString(2, variableNames.get(i));
							ps.setString(3, variableValues.get(i));
							ps.executeUpdate();
						}
					} catch (IndexOutOfBoundsException e) {
						return ResponseEntity.status(HttpStatus.BAD_REQUEST)
								.header("Content-Type", CONTENT_TYPE)
								.body(BAD_REQUEST);
					}
				}
			}

			query = "SELECT COUNT(*) FROM servers WHERE host = ? and port = ?";
			try (PreparedStatement ps = conn.prepareStatement(query)) {
				ps.setString(1, sHost);
				ps.setInt(2, portNum);
				try (ResultSet rs = ps.executeQuery()) {
					boolean serverExists = rs.next() && (rs.getInt(1) == 1);

					List<String> setServerVariables = new ArrayList<>(serverVariables.keySet());
					StringBuilder queryBuilder = new StringBuilder();
					if (serverExists) {
						queryBuilder.append("UPDATE servers SET ");
						for (String parameter : setServerVariables) {
							queryBuilder.append(parameter).append(" = ?, ");
						}
						queryBuilder.append(" stamp = NOW() ");
						queryBuilder.append(" WHERE host = ? AND port = ?");
					} else {
						queryBuilder = new StringBuilder("INSERT INTO servers SET ");
						for (String parameter : setServerVariables) {
							queryBuilder.append(parameter).append(" = ?, ");
						}
						queryBuilder.append(" stamp = NOW() ");
					}

					query = queryBuilder.toString();
					try (PreparedStatement ps2 = conn.prepareStatement(query)) {
						int i = 1;
						for (String parameter : setServerVariables) {
							switch (parameter) {
							case "port":
							case "available":
								ps2.setInt(i++, Integer.parseInt(serverVariables.get(parameter)));
								break;
							default:
								ps2.setString(i++, serverVariables.get(parameter));
								break;
							}
						}
						if (serverExists) {
							ps2.setString(i++, sHost);
							ps2.setInt(i++, portNum);
						}
						ps2.executeUpdate();
					}
				}
			}

			return ResponseEntity.ok().build();

		} catch (Exception err) {
			logger.error("Error updating metaserver", err);
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
					.header("Content-Type", CONTENT_TYPE)
					.body(INTERNAL_SERVER_ERROR);
		}
	}
}