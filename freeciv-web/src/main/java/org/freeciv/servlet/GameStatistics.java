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
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.freeciv.util.DatabaseUtil;
import org.json.JSONObject;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lists: the number of running games, the number of single player games played,
 * and the number of multi player games played.
 *
 * URL: /game/statistics
 */
@RestController
public class GameStatistics {
	
	private static final Logger logger = LoggerFactory.getLogger(GameStatistics.class);

	private static final String HEADER_EXPIRES = "Expires";
	
	private static final String CONTENT_TYPE = "application/json";
	
	private static final String INTERNAL_SERVER_ERROR = new JSONObject() //
			.put("statusCode", HttpStatus.INTERNAL_SERVER_ERROR.value()) //
			.put("error", "Internal server error.") //
			.toString();

	@GetMapping("/game/statistics")
	public ResponseEntity<String> getGameStatistics() {

		try {

			try (Connection conn = DatabaseUtil.getConnection()) {
				String query = "SELECT " //
						+ "	(SELECT COUNT(*) FROM servers WHERE state = 'Running') AS ongoingGames, " //
						+ "	(SELECT SUM(gameCount) FROM games_played_stats WHERE gametype IN (0, 5)) AS totalSinglePlayerGames, " //
						+ "	(SELECT SUM(gameCount) FROM games_played_stats WHERE gametype IN (1, 2)) AS totalMultiPlayerGames," //
						+ " (SELECT COUNT(*) FROM auth where verified=TRUE) AS players";

				try (PreparedStatement preparedStatement = conn.prepareStatement(query)) {
					try (ResultSet rs = preparedStatement.executeQuery()) {
						if (!rs.next()) {
							throw new Exception("Expected at least one row.");
						}

						JSONObject result = new JSONObject();
						result.put("ongoing", rs.getInt("ongoingGames"));
						JSONObject finishedGames = new JSONObject();
						finishedGames.put("singlePlayer", rs.getInt("totalSinglePlayerGames"));
						finishedGames.put("multiPlayer", rs.getInt("totalMultiPlayerGames"));
						finishedGames.put("players", rs.getInt("players"));
						result.put("finished", finishedGames);

						ZonedDateTime expires = ZonedDateTime.now(ZoneId.of("UTC")).plusHours(1);
						String rfc1123Expires = expires.format(DateTimeFormatter.RFC_1123_DATE_TIME);

						return ResponseEntity.ok()
								.header("Content-Type", CONTENT_TYPE)
								.header(HEADER_EXPIRES, rfc1123Expires)
								.body(result.toString());
					}
				}
			}

		} catch (Exception err) {
			logger.error("Error retrieving game statistics", err);
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
					.header("Content-Type", CONTENT_TYPE)
					.body(INTERNAL_SERVER_ERROR);
		}
	}

}