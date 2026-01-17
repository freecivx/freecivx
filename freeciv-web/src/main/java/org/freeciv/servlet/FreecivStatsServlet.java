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
import java.sql.SQLException;
import java.util.HashMap;
import java.util.Map;

import javax.naming.Context;
import javax.naming.InitialContext;
import javax.sql.DataSource;

import org.freeciv.util.Constants;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * This servlet will collect statistics about time played, and number of games stated.
 *
 * URL: /freeciv_time_played_stats
 */
@RestController
public class FreecivStatsServlet {

	private final static Map<String, Integer> gameTypes = new HashMap<>();
	
	static {
		gameTypes.put("single2d", 0);
		gameTypes.put("single3d", 5);
		gameTypes.put("multi", 1);
	}

	@PostMapping("/freeciv_time_played_stats")
	public ResponseEntity<Void> recordGameStats(@RequestParam("type") String gameType) {

		Connection conn = null;
		try {

			if (!gameTypes.containsKey(gameType)) {
				return ResponseEntity.ok().build();
			}

			Context env = (Context) (new InitialContext().lookup(Constants.JNDI_CONNECTION));
			DataSource ds = (DataSource) env.lookup(Constants.JNDI_DDBBCON_MYSQL);
			conn = ds.getConnection();

			int gameTypeId = gameTypes.get(gameType);

			String insert =
							  "INSERT INTO games_played_stats (statsDate, gameType, gameCount) "
							+ "VALUES (CURDATE(), ?, 1) "
							+ "ON DUPLICATE KEY UPDATE gameCount = gameCount + 1";
			PreparedStatement preparedStatement = conn.prepareStatement(insert);
			preparedStatement.setInt(1, gameTypeId);
			preparedStatement.executeUpdate();

			return ResponseEntity.ok().build();

		} catch (Exception err) {
			System.err.println("Error in FreecivStatsServlet" + err.getMessage());
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
		} finally {
			if (conn != null)
				try {
					conn.close();
				} catch (SQLException e) {
					e.printStackTrace();
				}
		}

	}

	@GetMapping("/freeciv_time_played_stats")
	public ResponseEntity<String> getNotAllowed() {
		return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
				.body("This endpoint only supports the POST method.");
	}
}