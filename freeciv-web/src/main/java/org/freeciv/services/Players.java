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

        String query = "SELECT id, username, last_login, elo_rating from auth  "
                + "WHERE verified = '1' "
                + "ORDER BY elo_rating DESC, last_login DESC";

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
