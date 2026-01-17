package org.freeciv.services;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.freeciv.util.DatabaseUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class Statistics {
	private static final Logger logger = LoggerFactory.getLogger(Statistics.class);

	public List<Map<String, String>> getPlayByEmailWinners() {

		String query = "SELECT winner, r.playerOne, r.playerTwo, endDate, "
				+ "(SELECT COUNT(*) FROM game_results r2 WHERE r2.winner = r.playerOne) AS winsByPlayerOne, "
				+ "(SELECT COUNT(*) FROM game_results r3 WHERE r3.winner = r.playerTwo) AS winsByPlayerTwo " //
				+ "FROM game_results r " //
				+ "ORDER BY id DESC LIMIT 20";

		try (Connection connection = DatabaseUtil.getConnection();
		     PreparedStatement preparedStatement = connection.prepareStatement(query);
		     ResultSet rs = preparedStatement.executeQuery()) {
			List<Map<String, String>> result = new ArrayList<>();
			while (rs.next()) {
				Map<String, String> record = new HashMap<>();
				record.put("winner", rs.getString("winner"));
				record.put("playerOne", rs.getString("playerOne"));
				record.put("playerTwo", rs.getString("playerTwo"));
				record.put("endDate", rs.getDate("endDate") + "");
				record.put("winsByPlayerOne", rs.getInt("winsByPlayerOne") + "");
				record.put("winsByPlayerTwo", rs.getString("winsByPlayerTwo"));
				result.add(record);

			}
			return result;
		} catch (SQLException e) {
			logger.error("Failed to get play by email winners", e);
			throw new RuntimeException(e);
		}
	}

	public List<Map<String, Object>> getPlayedGamesByType() {

		String query = "SELECT DISTINCT statsDate AS date, "
				+ "(SELECT gameCount FROM games_played_stats WHERE statsDate = date AND gameType = '0') AS webSinglePlayer, "
				+ "(SELECT gameCount FROM games_played_stats WHERE statsDate = date AND gameType = '1') AS webMultiPlayer, "
				+ "(SELECT gameCount FROM games_played_stats WHERE statsDate = date AND gameType = '2') AS webPlayByEmail, "
				+ "(SELECT gameCount FROM games_played_stats WHERE statsDate = date AND gameType = '4') AS webHotseat, "
				+ "(SELECT gameCount FROM games_played_stats WHERE statsDate = date AND gameType = '3') AS desktopMultiplayer, "
				+ "(SELECT gameCount FROM games_played_stats WHERE statsDate = date AND gameType = '5') AS webSinglePlayer3D "
				+ "FROM games_played_stats";

		try (Connection connection = DatabaseUtil.getConnection();
		     PreparedStatement preparedStatement = connection.prepareStatement(query);
		     ResultSet rs = preparedStatement.executeQuery()) {
			List<Map<String, Object>> result = new ArrayList<>();
			while (rs.next()) {
				Map<String, Object> item = new HashMap<>();
				item.put("date", rs.getDate("date"));
				item.put("webSinglePlayer", rs.getInt("webSinglePlayer"));
				item.put("webMultiPlayer", rs.getInt("webMultiPlayer"));
				item.put("webPlayByEmail", rs.getInt("webPlayByEmail"));
				item.put("webHotseat", rs.getInt("webHotseat"));
				item.put("desktopMultiplayer", rs.getInt("desktopMultiplayer"));
				item.put("webSinglePlayer3D", rs.getInt("webSinglePlayer3D"));
				result.add(item);
			}
			return result;
		} catch (SQLException e) {
			logger.error("Failed to get played games by type", e);
			throw new RuntimeException(e);
		}
	}

	public List<Map<String, Object>> getHallOfFameList() {

		String query = "SELECT id, username, nation, score, end_turn, end_date, (select sum(s.score) from hall_of_fame s where s.username = a.username) as total_score FROM hall_of_fame a order by score DESC limit 500";

		try (Connection connection = DatabaseUtil.getConnection();
		     PreparedStatement preparedStatement = connection.prepareStatement(query);
		     ResultSet rs = preparedStatement.executeQuery()) {
			List<Map<String, Object>> result = new ArrayList<>();
			int num = 1;
			while (rs.next()) {
				Map<String, Object> item = new HashMap<>();
				item.put("position", num);
				String username = rs.getString("username");
				if (username.length() >= 20) username = username.substring(0, 19)  + "..";
				item.put("username", username);
				item.put("nation", rs.getString("nation"));
				item.put("score", rs.getString("score"));
				item.put("end_turn", rs.getString("end_turn"));
				item.put("end_date", rs.getString("end_date"));
				item.put("total_score", rs.getString("total_score"));
				item.put("id", Integer.parseInt(rs.getString("id")));
				result.add(item);
				num++;
			}
			return result;
		} catch (SQLException e) {
			logger.error("Failed to get hall of fame list", e);
			throw new RuntimeException(e);
		}
	}

}
