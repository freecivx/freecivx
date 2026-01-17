package org.freeciv.servlet;

/*******************************************************************************
 * Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
 * Copyright (C) 2009-2025 The Freeciv-web project
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


import java.util.List;

import org.freeciv.model.Player;
import org.freeciv.services.Players;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Displays list of players
 *
 */
@RestController
public class OnlinePlayerList {

    @Autowired
    private Players players;

    @GetMapping("/player/onlinelist")
    public ResponseEntity<String> getOnlinePlayers() {
        try {
            List<Player> playersList = players.getOnlinePlayers();

            // Extract player names into a JSONArray
            JSONArray playerArray = new JSONArray();
            for (Player player : playersList) {
                playerArray.put(player.getName());
            }

            // Create JSON response object
            JSONObject jsonResponse = new JSONObject();
            jsonResponse.put("players", playerArray);

            return ResponseEntity.ok()
                    .header("Content-Type", "application/json; charset=UTF-8")
                    .body(jsonResponse.toString());

        } catch (RuntimeException err) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .header("Content-Type", "application/json")
                    .body("{\"error\": \"An error occurred.\" " + err.getMessage() + " }");
        }
    }

}