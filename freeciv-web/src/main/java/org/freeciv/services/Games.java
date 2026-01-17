package org.freeciv.services;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

import org.freeciv.model.Game;
import org.freeciv.util.DatabaseUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class Games {
	private static final Logger logger = LoggerFactory.getLogger(Games.class);

	public int getMultiPlayerCount() {

		String query = "SELECT COUNT(*) AS count " //
				+ "FROM servers s " //
				+ "WHERE type IN ('multiplayer') " //
				+ "	AND ( " //
				+ "		state = 'Running' OR " //
				+ "		(state = 'Pregame' " //
				+ "			AND CONCAT(s.host ,':',s.port) IN (SELECT hostport FROM players WHERE type <> 'A.I.')"
				+ "		)" //
				+ "	)";

		try (Connection connection = DatabaseUtil.getConnection();
		     PreparedStatement statement = connection.prepareStatement(query);
		     ResultSet rs = statement.executeQuery()) {
			rs.next();
			return rs.getInt("count");
		} catch (SQLException e) {
			logger.error("Failed to get multiplayer count", e);
			throw new RuntimeException(e);
		}
	}

	public List<Game> getMultiPlayerGames() {

		String query = "SELECT host, port, type, version, patches, state, message, " //
				+ "TIMESTAMPDIFF(SECOND, stamp, CURRENT_TIMESTAMP) AS duration, " //
				+ "	(SELECT COUNT(*) " //
				+ "	  FROM players " //
				+ "	 WHERE type = 'Human' " //
				+ "	   AND hostport LIKE  CONCAT(s.host, ':', s.port) " //
				+ "	) AS players," //
				+ "	(SELECT setting " //
				+ "	  FROM variables " //
				+ "	  WHERE name = 'turn' " //
				+ "	    AND hostport = CONCAT(s.host, ':', s.port) LIMIT 1" //
				+ "	) AS turn " //
				+ "FROM servers s " //
				+ "WHERE type IN ('multiplayer', 'freecivx') OR message LIKE '%Multiplayer%' " //
				+ "ORDER BY humans DESC, state DESC";

		try (Connection connection = DatabaseUtil.getConnection();
		     PreparedStatement statement = connection.prepareStatement(query);
		     ResultSet rs = statement.executeQuery()) {
			List<Game> multiPlayerGames = new ArrayList<>();
			while (rs.next()) {
				Game game = new Game() //
						.setHost(rs.getString("host")) //
						.setPort(rs.getInt("port")) //
						.setType(rs.getString("type")) //
						.setVersion(rs.getString("version")) //
						.setPatches(rs.getString("patches")) //
						.setState(rs.getString("state")) //
						.setMessage(rs.getString("message")) //
						.setDuration(rs.getLong("duration")) //
						.setTurn(rs.getInt("turn")) //
						.setPlayers(rs.getInt("players"));
				multiPlayerGames.add(game);
			}
			return multiPlayerGames;
		} catch (SQLException e) {
			logger.error("Failed to get multiplayer games", e);
			throw new RuntimeException(e);
		}
	}



}
