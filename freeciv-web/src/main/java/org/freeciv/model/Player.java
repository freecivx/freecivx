package org.freeciv.model;

import org.apache.commons.text.WordUtils;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

public class Player {

    private long id;
    private String name;
    private int elo_rating;
    private LocalDateTime last_login;

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public String getName() {
        return WordUtils.capitalizeFully(name);
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getElo_rating() {
        return elo_rating;
    }

    public void setElo_rating(int elo_rating) {
        this.elo_rating = elo_rating;
    }

    public LocalDateTime getLast_login() {
        return last_login;
    }

    public void setLast_login(LocalDateTime last_login) {
        this.last_login = last_login;
    }

    public String getFormattedLastLogin() {
        if (getLast_login() == null) {
            return "Account predates FreecivX login display.";
        }
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd' 'HH:mm' UTC'").withZone(ZoneOffset.UTC);
        return getLast_login().atZone(ZoneOffset.UTC).format(formatter);
    }

    public String getOnline() {
        if (last_login == null) {
            return "Offline";
        }

        LocalDateTime now = LocalDateTime.now();
        Duration duration = Duration.between(last_login, now);

        return duration.toMinutes() < 30 ? "Online" : "Offline";
    }

    public String getOnlineStatusHtml() {
        String status = getOnline();
        String color = status.equals("Online") ? "green" : "grey";
        return "<span style='color: " + color + "; font-weight: bold;'>" + status + "</span>";
    }

}
