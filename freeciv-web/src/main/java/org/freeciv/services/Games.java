package org.freeciv.services;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

import javax.naming.Context;
import javax.naming.InitialContext;
import javax.naming.NamingException;
import javax.sql.DataSource;

import org.freeciv.model.Game;
import org.freeciv.util.Constants;

public class Games {

	public int getMultiPlayerCount() {

		String query;
		Connection connection = null;
		PreparedStatement statement = null;
		ResultSet rs = null;
		try {
			Context env = (Context) (new InitialContext().lookup(Constants.JNDI_CONNECTION));
			DataSource ds = (DataSource) env.lookup(Constants.JNDI_DDBBCON_MYSQL);
			connection = ds.getConnection();

			query = "SELECT COUNT(*) AS count " //
					+ "FROM servers s " //
					+ "WHERE type IN ('multiplayer') " //
					+ "	AND ( " //
					+ "		state = 'Running' OR " //
					+ "		(state = 'Pregame' " //
					+ "			AND CONCAT(s.host ,':',s.port) IN (SELECT hostport FROM players WHERE type <> 'A.I.')"
					+ "		)" //
					+ "	)";

			statement = connection.prepareStatement(query);
			rs = statement.executeQuery();
			rs.next();
			return rs.getInt("count");
		} catch (SQLException e) {
			throw new RuntimeException(e);
		} catch (NamingException e) {
			throw new RuntimeException(e);
		} finally {
			if (connection != null) {
				try {
					connection.close();
				} catch (SQLException e) {
					e.printStackTrace();
				}
			}
		}
	}

	public List<Game> getMultiPlayerGames() {

		String query;
		Connection connection = null;
		PreparedStatement statement = null;
		ResultSet rs = null;
		try {
			Context env = (Context) (new InitialContext().lookup(Constants.JNDI_CONNECTION));
			DataSource ds = (DataSource) env.lookup(Constants.JNDI_DDBBCON_MYSQL);
			connection = ds.getConnection();

			query = "SELECT host, port, type, version, patches, state, message, " //
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

			statement = connection.prepareStatement(query);
			rs = statement.executeQuery();
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
			throw new RuntimeException(e);
		} catch (NamingException e) {
			throw new RuntimeException(e);
		} finally {
			if (connection != null) {
				try {
					connection.close();
				} catch (SQLException e) {
					e.printStackTrace();
				}
			}
		}
	}



}
