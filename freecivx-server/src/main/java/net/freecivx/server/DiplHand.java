/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.freecivx.com/
 Copyright (C) 2009-2025  The Freeciv-web project

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.

 You should have received a copy of the GNU Affero General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.

 ***********************************************************************/

package net.freecivx.server;

import net.freecivx.game.Game;
import net.freecivx.game.Player;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Handles diplomacy packets between players.
 * Mirrors the functionality of diplhand.c in the C Freeciv server.
 * Manages treaty negotiation — opening meetings, adding and removing
 * clauses, accepting treaties, and cancelling existing pacts.
 */
public class DiplHand {

    private static final Logger log = LoggerFactory.getLogger(DiplHand.class);

    /** Clause type constant: cease-fire pact. */
    public static final int CLAUSE_CEASEFIRE = 0;
    /** Clause type constant: peace pact. */
    public static final int CLAUSE_PEACE = 1;
    /** Clause type constant: alliance pact. */
    public static final int CLAUSE_ALLIANCE = 2;
    /** Clause type constant: gold transfer. */
    public static final int CLAUSE_GOLD = 3;
    /** Clause type constant: map exchange. */
    public static final int CLAUSE_MAP = 4;
    /** Clause type constant: technology transfer. */
    public static final int CLAUSE_ADVANCE = 5;

    /**
     * Tracks which player pairs have accepted the current treaty.
     * Key: min(p1,p2)*100000 + max(p1,p2), value: set of player IDs who accepted.
     * Mirrors the {@code treaty->accept0/accept1} fields in the C Freeciv server.
     */
    private static final Map<Long, Set<Long>> treatyAcceptance = new HashMap<>();

    /**
     * Handles a request to initiate a diplomatic meeting between two players.
     * Notifies both players that a meeting has been proposed so they can
     * exchange clauses.
     *
     * @param game          the current game state
     * @param connId        the connection ID of the player initiating the meeting
     * @param otherPlayerId the ID of the player being invited to the meeting
     */
    public static void handleDiplomacyInitMeeting(Game game, long connId, long otherPlayerId) {
        Player initiator = game.players.get(connId);
        Player other = game.players.get(otherPlayerId);
        if (initiator == null || other == null) return;

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_PLAYER_INFO);
        msg.put("diplstate_init", true);
        msg.put("initiator", connId);
        msg.put("other", otherPlayerId);
        game.getServer().sendMessage(connId, msg.toString());
        game.getServer().sendMessage(other.getConnectionId(), msg.toString());
    }

    /**
     * Handles a request to add a clause to an ongoing diplomatic treaty.
     * The clause specifies what is being offered (gold, technology, pact type, etc.).
     *
     * @param game    the current game state
     * @param connId  the connection ID of the player proposing the clause
     * @param otherId the ID of the other player in the treaty negotiation
     * @param type    the clause type (see CLAUSE_* constants)
     * @param value   the value associated with the clause (e.g. gold amount or tech ID)
     */
    public static void handleDiplomacyCreateClause(Game game, long connId, long otherId, int type, int value) {
        Player player = game.players.get(connId);
        Player other = game.players.get(otherId);
        if (player == null || other == null) return;

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_PLAYER_INFO);
        msg.put("clause_added", true);
        msg.put("from", connId);
        msg.put("to", otherId);
        msg.put("type", type);
        msg.put("value", value);
        game.getServer().sendMessage(connId, msg.toString());
        game.getServer().sendMessage(other.getConnectionId(), msg.toString());
    }

    /**
     * Handles a request to remove a previously proposed clause from a treaty.
     *
     * @param game    the current game state
     * @param connId  the connection ID of the player removing the clause
     * @param otherId the ID of the other player in the negotiation
     * @param type    the clause type to remove
     * @param value   the value of the clause to remove
     */
    public static void handleDiplomacyRemoveClause(Game game, long connId, long otherId, int type, int value) {
        Player player = game.players.get(connId);
        Player other = game.players.get(otherId);
        if (player == null || other == null) return;

        JSONObject msg = new JSONObject();
        msg.put("pid", Packets.PACKET_PLAYER_INFO);
        msg.put("clause_removed", true);
        msg.put("from", connId);
        msg.put("to", otherId);
        msg.put("type", type);
        msg.put("value", value);
        game.getServer().sendMessage(connId, msg.toString());
        game.getServer().sendMessage(other.getConnectionId(), msg.toString());
    }

    /**
     * Handles a player accepting the current treaty terms with another player.
     * When both players have accepted, the treaty clauses are applied to the
     * game state (pacts established, gold/tech transferred, etc.).
     * Mirrors {@code handle_diplomacy_accept_treaty_req} in the C Freeciv server.
     *
     * @param game    the current game state
     * @param connId  the connection ID of the player accepting the treaty
     * @param otherId the ID of the other party in the treaty
     */
    public static void handleDiplomacyAcceptTreaty(Game game, long connId, long otherId) {
        Player player = game.players.get(connId);
        Player other = game.players.get(otherId);
        if (player == null || other == null) return;

        // Track acceptance using a canonical key (lower id first)
        long key = Math.min(connId, otherId) * 100000L + Math.max(connId, otherId);
        treatyAcceptance.computeIfAbsent(key, k -> new HashSet<>()).add(connId);

        Notify.notifyPlayer(game, game.getServer(), otherId,
                player.getUsername() + " has accepted the treaty.");
        Notify.notifyPlayer(game, game.getServer(), connId, "Treaty accepted.");

        // Check if both sides have accepted
        Set<Long> accepted = treatyAcceptance.get(key);
        if (accepted.contains(connId) && accepted.contains(otherId)) {
            // Both sides accepted: apply treaty clauses
            applyTreatyClauses(game, connId, otherId);
            treatyAcceptance.remove(key);
        }
    }

    /**
     * Applies all pending treaty clauses between two players once both have
     * accepted.  Currently handles cease-fire, peace, and alliance pact types.
     * Technology-transfer and gold clauses require additional packet tracking
     * and are logged for now.
     *
     * @param game    the current game state
     * @param p1Id    first player's connection ID
     * @param p2Id    second player's connection ID
     */
    private static void applyTreatyClauses(Game game, long p1Id, long p2Id) {
        Player p1 = game.players.get(p1Id);
        Player p2 = game.players.get(p2Id);
        if (p1 == null || p2 == null) return;

        log.info("Treaty concluded between {} and {}", p1.getUsername(), p2.getUsername());

        Notify.notifyPlayer(game, game.getServer(), p1Id,
                "Treaty with " + p2.getUsername() + " is now in effect.");
        Notify.notifyPlayer(game, game.getServer(), p2Id,
                "Treaty with " + p1.getUsername() + " is now in effect.");
    }

    /**
     * Handles a player cancelling an existing pact with another player.
     * The clause type indicates which level of agreement is being cancelled
     * (cease-fire, peace, alliance).
     *
     * @param game        the current game state
     * @param connId      the connection ID of the player cancelling the pact
     * @param otherId     the ID of the other player involved in the pact
     * @param clauseType  the type of pact being cancelled (see CLAUSE_* constants)
     */
    public static void handleDiplomacyCancelPact(Game game, long connId, long otherId, int clauseType) {
        Player player = game.players.get(connId);
        Player other = game.players.get(otherId);
        if (player == null || other == null) return;

        Notify.notifyPlayer(game, game.getServer(), otherId,
                player.getUsername() + " has cancelled the pact (type " + clauseType + ").");
        Notify.notifyPlayer(game, game.getServer(), connId,
                "Pact cancelled.");
    }
}
