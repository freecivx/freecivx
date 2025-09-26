package org.freeciv.servlet;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.json.JSONArray;
import org.json.JSONObject;

@WebServlet("/PlayerMatcher")
public class PlayerMatcher extends HttpServlet {

    // Stores invitations: key = recipient's username (lowercase), value = list of invitations
    private static final ConcurrentHashMap<String, List<Invitation>> invitationsMap = new ConcurrentHashMap<>();
    private static final long EXPIRATION_TIME_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        String fromUser = request.getParameter("from");
        String toUser = request.getParameter("to");
        String portStr = request.getParameter("port");
        String username = request.getParameter("username");
        String allParam = request.getParameter("all");

        if (fromUser != null && toUser != null && portStr != null) {
            // Handle sending an invitation
            try {
                int port = Integer.parseInt(portStr);
                addInvitation(fromUser.toLowerCase(), toUser.toLowerCase(), port); // Store usernames in lowercase

                JSONObject successResponse = new JSONObject();
                successResponse.put("message", "Invitation sent successfully.");
                response.getWriter().write(successResponse.toString());

            } catch (NumberFormatException e) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                response.getWriter().write("{\"error\": \"Invalid port number.\"}");
            }

        } else if (username != null) {
            // Handle retrieving invitations for a specific user
            JSONArray invitationsArray = getInvitationsForUser(username.toLowerCase());
            JSONObject jsonResponse = new JSONObject();
            jsonResponse.put("invitations", invitationsArray);
            response.getWriter().write(jsonResponse.toString());

        } else if ("true".equalsIgnoreCase(allParam)) {
            // Handle retrieving ALL invitations
            JSONObject allInvitations = getAllInvitations();
            response.getWriter().write(allInvitations.toString());

        } else {
            // Invalid request
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().write("{\"error\": \"Invalid parameters.\"}");
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
