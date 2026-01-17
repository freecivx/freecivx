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
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.freeciv.util.DatabaseUtil;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * Displays detailed information about a specific game
 *
 * URL: /meta/game-details
 */
@Controller
public class GameDetails {

	private static final Logger logger = LoggerFactory.getLogger(GameDetails.class);

	public class PlayerSummary {
		private String flag;
		private String name;
		private String nation;
		private String user;
		private String type;

		public String getFlag() {
			return flag;
		}

		public String getName() {
			return name;
		}

		public String getNation() {
			return nation;
		}

		public String getType() {
			return type;
		}

		public String getUser() {
			return user;
		}
	}

	public class VariableSummary {
		private String name;
		private String value;

		public String getName() {
			return name;
		}

		public String getValue() {
			return value;
		}

	}

	@GetMapping("/meta/game-details")
	public String getGameDetails(
			@RequestParam(required = false) String host,
			@RequestParam(required = false) String port,
			Model model) {

		String sHost = host;
		String sPort = port;

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
			return "game-details";
		}

		String hostPort = sHost + ':' + sPort;
		String query;
		try (Connection conn = DatabaseUtil.getConnection()) {
			query = "SELECT * FROM servers WHERE host = ? AND port = ?";

			try (PreparedStatement statement = conn.prepareStatement(query)) {
				statement.setString(1, sHost);
				statement.setInt(2, portNum);
				try (ResultSet rs = statement.executeQuery()) {
					if (rs.next()) {
						model.addAttribute("version", rs.getString("version"));
						model.addAttribute("patches", rs.getString("patches"));
						model.addAttribute("capability", rs.getString("capability"));
						model.addAttribute("state", rs.getString("state"));
						model.addAttribute("ruleset", rs.getString("ruleset"));
						model.addAttribute("serverid", rs.getString("serverid"));
						model.addAttribute("port", portNum);
						model.addAttribute("host", sHost);
						model.addAttribute("type", rs.getString("type"));
					} else {
						return "game-information";
					}
				}
			}

			query = "SELECT * FROM players WHERE hostport = ? ORDER BY name";
			try (PreparedStatement statement = conn.prepareStatement(query)) {
				statement.setString(1, hostPort);
				try (ResultSet rs = statement.executeQuery()) {
					List<PlayerSummary> players = new ArrayList<>();
					while (rs.next()) {
						PlayerSummary player = new PlayerSummary();
						player.flag = rs.getString("flag");
						player.name = rs.getString("name");
						player.nation = rs.getString("nation");
						player.user = rs.getString("username");
						player.type = rs.getString("type");
						players.add(player);
					}
					model.addAttribute("players", players);
				}
			}

			query = "SELECT * FROM variables WHERE hostport = ? ORDER BY name";
			try (PreparedStatement statement = conn.prepareStatement(query)) {
				statement.setString(1, hostPort);
				try (ResultSet rs = statement.executeQuery()) {
					List<VariableSummary> variables = new ArrayList<>();
					while (rs.next()) {
						VariableSummary variable = new VariableSummary();
						variable.name = rs.getString("name");
						variable.value = rs.getString("setting");
						variables.add(variable);
					}
					model.addAttribute("variables", variables);
				}
			}

		} catch (Exception err) {
			logger.error("Error fetching game details", err);
			return "game/details";
		}

		return "game/details";
	}
}
