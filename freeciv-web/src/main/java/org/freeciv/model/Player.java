package org.freeciv.model;

import org.apache.commons.text.WordUtils;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class Player {

    private String name;
    private int elo_rating;
    private LocalDateTime last_login;

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
            return "Not logged in or account predates FreecivX login display.";
        }
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("EEEE, MMMM d, yyyy HH:mm");
        return getLast_login().format(formatter);
    }

    public String getOnline() {
        if (last_login == null) {
            return "Offline";
        }

        LocalDateTime now = LocalDateTime.now();
        Duration duration = Duration.between(last_login, now);

        return duration.toHours() < 2 ? "Online" : "Offline";
    }

    public String getOnlineStatusHtml() {
        String status = getOnline();
        String color = status.equals("Online") ? "green" : "grey";
        return "<span style='color: " + color + "; font-weight: bold;'>" + status + "</span>";
    }

}
