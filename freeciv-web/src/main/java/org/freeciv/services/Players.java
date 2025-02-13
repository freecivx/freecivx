package org.freeciv.services;

import org.freeciv.model.Player;
import org.freeciv.util.Constants;

import javax.naming.Context;
import javax.naming.InitialContext;
import javax.naming.NamingException;
import javax.sql.DataSource;
import java.sql.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class Players {

    public int getPlayersCount() {

        String query;
        Connection connection = null;
        PreparedStatement statement = null;
        ResultSet rs = null;
        try {
            Context env = (Context) (new InitialContext().lookup(Constants.JNDI_CONNECTION));
            DataSource ds = (DataSource) env.lookup(Constants.JNDI_DDBBCON_MYSQL);
            connection = ds.getConnection();

            query = "SELECT COUNT(*) AS count " //
                    + "FROM auth  " //
                    + "WHERE verified = '1'";

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

    public List<Player> getPlayers() {

        String query;
        Connection connection = null;
        PreparedStatement statement = null;
        ResultSet rs = null;
        try {
            Context env = (Context) (new InitialContext().lookup(Constants.JNDI_CONNECTION));
            DataSource ds = (DataSource) env.lookup(Constants.JNDI_DDBBCON_MYSQL);
            connection = ds.getConnection();

            query = "SELECT id, username, last_login, elo_rating from auth  "
                    + "WHERE verified = '1' "
                    + "ORDER BY elo_rating DESC, last_login DESC";

            statement = connection.prepareStatement(query);
            rs = statement.executeQuery();
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

    public List<Player> getOnlinePlayers() {

        String query;
        Connection connection = null;
        PreparedStatement statement = null;
        ResultSet rs = null;
        try {
            Context env = (Context) (new InitialContext().lookup(Constants.JNDI_CONNECTION));
            DataSource ds = (DataSource) env.lookup(Constants.JNDI_DDBBCON_MYSQL);
            connection = ds.getConnection();

            query = "SELECT username, last_login, elo_rating from auth  "
                    + "WHERE verified = '1' and last_login > NOW() - INTERVAL 12 HOUR  "
                    + "ORDER BY username DESC";

            statement = connection.prepareStatement(query);
            rs = statement.executeQuery();
            List<Player> players = new ArrayList<>();
            while (rs.next()) {
                Player player = new Player();
                player.setName(rs.getString("username"));
                players.add(player);
            }
            return players;
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
