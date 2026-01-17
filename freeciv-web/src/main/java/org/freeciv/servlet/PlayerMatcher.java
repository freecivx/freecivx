package org.freeciv.servlet;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PlayerMatcher {

    // Stores invitations: key = recipient's username (lowercase), value = list of invitations
    private static final ConcurrentHashMap<String, List<Invitation>> invitationsMap = new ConcurrentHashMap<>();
    private static final long EXPIRATION_TIME_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

    @GetMapping("/PlayerMatcher")
    public ResponseEntity<String> handlePlayerMatcher(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String port,
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String all) {

        if (from != null && to != null && port != null) {
            // Handle sending an invitation
            try {
                int portNum = Integer.parseInt(port);
                addInvitation(from.toLowerCase(), to.toLowerCase(), portNum); // Store usernames in lowercase

                JSONObject successResponse = new JSONObject();
                successResponse.put("message", "Invitation sent successfully.");
                return ResponseEntity.ok()
                        .header("Content-Type", "application/json; charset=UTF-8")
                        .body(successResponse.toString());

            } catch (NumberFormatException e) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .header("Content-Type", "application/json")
                        .body("{\"error\": \"Invalid port number.\"}");
            }

        } else if (username != null) {
            // Handle retrieving invitations for a specific user
            JSONArray invitationsArray = getInvitationsForUser(username.toLowerCase());
            JSONObject jsonResponse = new JSONObject();
            jsonResponse.put("invitations", invitationsArray);
            return ResponseEntity.ok()
                    .header("Content-Type", "application/json; charset=UTF-8")
                    .body(jsonResponse.toString());

        } else if ("true".equalsIgnoreCase(all)) {
            // Handle retrieving ALL invitations
            JSONObject allInvitations = getAllInvitations();
            return ResponseEntity.ok()
                    .header("Content-Type", "application/json; charset=UTF-8")
                    .body(allInvitations.toString());

        } else {
            // Invalid request
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .header("Content-Type", "application/json")
                    .body("{\"error\": \"Invalid parameters.\"}");
        }
    }

    /**
     * Adds an invitation to the map (stored in lowercase).
     */
    private void addInvitation(String from, String to, int port) {
        long timestamp = System.currentTimeMillis(); // Current time in milliseconds
        invitationsMap.computeIfAbsent(to, k -> new ArrayList<>())
                .add(new Invitation(from, port, timestamp));
    }

    /**
     * Retrieves all non-expired invitations for a given user in JSON format.
     */
    private JSONArray getInvitationsForUser(String username) {
        long currentTime = System.currentTimeMillis();
        List<Invitation> userInvitations = invitationsMap.getOrDefault(username, new ArrayList<>());

        // Remove expired invitations
        Iterator<Invitation> iterator = userInvitations.iterator();
        while (iterator.hasNext()) {
            Invitation invite = iterator.next();
            if ((currentTime - invite.timestamp) > EXPIRATION_TIME_MS) {
                iterator.remove(); // Remove expired invitation
            }
        }

        // Update the map if all invitations expired
        if (userInvitations.isEmpty()) {
            invitationsMap.remove(username);
        }

        // Convert to JSON
        JSONArray invitationsArray = new JSONArray();
        for (Invitation invite : userInvitations) {
            JSONObject inviteObj = new JSONObject();
            inviteObj.put("from", invite.from);
            inviteObj.put("port", invite.port);
            invitationsArray.put(inviteObj);
        }
        return invitationsArray;
    }

    /**
     * Retrieves all invitations for all users in JSON format.
     */
    private JSONObject getAllInvitations() {
        long currentTime = System.currentTimeMillis();
        JSONObject allInvitations = new JSONObject();

        for (String user : invitationsMap.keySet()) {
            List<Invitation> userInvitations = invitationsMap.get(user);

            // Remove expired invitations
            Iterator<Invitation> iterator = userInvitations.iterator();
            while (iterator.hasNext()) {
                Invitation invite = iterator.next();
                if ((currentTime - invite.timestamp) > EXPIRATION_TIME_MS) {
                    iterator.remove(); // Remove expired invitation
                }
            }

            // Update the map if all invitations expired
            if (userInvitations.isEmpty()) {
                invitationsMap.remove(user);
            } else {
                // Convert to JSON
                JSONArray invitationsArray = new JSONArray();
                for (Invitation invite : userInvitations) {
                    JSONObject inviteObj = new JSONObject();
                    inviteObj.put("from", invite.from);
                    inviteObj.put("port", invite.port);
                    invitationsArray.put(inviteObj);
                }
                allInvitations.put(user, invitationsArray);
            }
        }
        return allInvitations;
    }

    /**
     * Simple class to store invitation details.
     */
    private static class Invitation {
        String from;
        int port;
        long timestamp; // Time when the invitation was created

        Invitation(String from, int port, long timestamp) {
            this.from = from;
            this.port = port;
            this.timestamp = timestamp;
        }
    }
}
