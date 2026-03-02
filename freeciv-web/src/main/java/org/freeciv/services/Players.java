package org.freeciv.services;

import org.freeciv.model.Player;
import org.freeciv.util.DatabaseUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class Players {
    private static final Logger logger = LoggerFactory.getLogger(Players.class);

    public int getPlayersCount() {

        String query = "SELECT COUNT(*) AS count " //
                + "FROM auth  " //
                + "WHERE verified = '1'";

        try (Connection connection = DatabaseUtil.getConnection();
             PreparedStatement statement = connection.prepareStatement(query);
             ResultSet rs = statement.executeQuery()) {
            rs.next();
            return rs.getInt("count");
        } catch (SQLException e) {
            logger.error("Failed to get players count", e);
            throw new RuntimeException(e);
        }
    }

    public List<Player> getPlayers() {

        String query = "SELECT a.id, a.username, a.last_login, a.elo_rating, "
                + "COALESCE(SUM(CASE WHEN gr.win = 1 THEN 1 ELSE 0 END), 0) AS wins, "
                + "COALESCE(SUM(CASE WHEN gr.loss = 1 THEN 1 ELSE 0 END), 0) AS losses "
                + "FROM auth a "
                + "LEFT JOIN game_results gr ON gr.player = a.username "
                + "WHERE a.verified = '1' "
                + "GROUP BY a.id, a.username, a.last_login, a.elo_rating "
                + "ORDER BY a.elo_rating DESC, a.last_login DESC";

        try (Connection connection = DatabaseUtil.getConnection();
             PreparedStatement statement = connection.prepareStatement(query);
             ResultSet rs = statement.executeQuery()) {
            List<Player> players = new ArrayList<>();
            while (rs.next()) {
                Player player = new Player();
                player.setId(rs.getInt("id"));
                player.setName(rs.getString("username"));
                Timestamp lastLogin = rs.getTimestamp("last_login");
                if (lastLogin != null) {
                    LocalDateTime login = lastLogin.toLocalDateTime();
                    player.setLast_login(login);
                }

                player.setElo_rating(rs.getInt("elo_rating"));
                player.setWins(rs.getInt("wins"));
                player.setLosses(rs.getInt("losses"));
                players.add(player);
            }
            return players;
        } catch (SQLException e) {
            logger.error("Failed to get players", e);
            throw new RuntimeException(e);
        }
    }

    public List<Player> getOnlinePlayers() {

        String query = "SELECT username, last_login, elo_rating from auth  "
                + "WHERE verified = '1' and last_login > NOW() - INTERVAL 12 HOUR  "
                + "ORDER BY username DESC";

        try (Connection connection = DatabaseUtil.getConnection();
             PreparedStatement statement = connection.prepareStatement(query);
             ResultSet rs = statement.executeQuery()) {
            List<Player> players = new ArrayList<>();
            while (rs.next()) {
                Player player = new Player();
                player.setName(rs.getString("username"));
                players.add(player);
            }
            return players;
        } catch (SQLException e) {
            logger.error("Failed to get online players", e);
            throw new RuntimeException(e);
        }
    }
}
