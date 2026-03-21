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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
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

    // -------------------------------------------------------------------------
    // Diplomatic state constants (mirrors diplstate_type in C Freeciv player.h)
    // -------------------------------------------------------------------------

    /** Diplomatic state: at war. */
    public static final int DS_WAR        = 1;
    /** Diplomatic state: ceasefire (temporary truce with turn countdown). */
    public static final int DS_CEASEFIRE  = 2;
    /** Diplomatic state: permanent peace treaty. */
    public static final int DS_PEACE      = 3;
    /** Diplomatic state: full military alliance. */
    public static final int DS_ALLIANCE   = 4;
    /** Diplomatic state: no contact yet (never met). */
    public static final int DS_NO_CONTACT = 5;

    /** Default number of turns a ceasefire lasts. Mirrors turns_left_ceasefire in C server. */
    public static final int CEASEFIRE_TURNS = 16;

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
     * Pending treaty clauses for an ongoing negotiation.
     * Key: same canonical pair key as {@code treatyAcceptance}.
     * Value: list of {type, giverPlayerId, value} int arrays.
     * Mirrors the {@code treaty->clauses} list in the C Freeciv server.
     */
    private static final Map<Long, List<int[]>> pendingClauses = new HashMap<>();

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
     * Stores the clause in {@code pendingClauses} so it can be applied when both
     * players accept.
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

        // Record the clause so it can be applied when both sides accept
        long key = Math.min(connId, otherId) * 100000L + Math.max(connId, otherId);
        pendingClauses.computeIfAbsent(key, k -> new java.util.ArrayList<>())
                      .add(new int[]{type, (int) connId, value});

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
     * Removes the matching entry from {@code pendingClauses}.
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

        long key = Math.min(connId, otherId) * 100000L + Math.max(connId, otherId);
        List<int[]> clauses = pendingClauses.get(key);
        if (clauses != null) {
            clauses.removeIf(c -> c[0] == type && c[1] == (int) connId && c[2] == value);
        }

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
     * accepted.  Handles cease-fire, peace, alliance pact types, and transfers
     * gold and technology.  Mirrors {@code accept_treaty()} in diplhand.c.
     *
     * @param game    the current game state
     * @param p1Id    first player's connection ID
     * @param p2Id    second player's connection ID
     */
    private static void applyTreatyClauses(Game game, long p1Id, long p2Id) {
        Player p1 = game.players.get(p1Id);
        Player p2 = game.players.get(p2Id);
        if (p1 == null || p2 == null) return;

        // Retrieve and remove pending clauses for this pair
        long key = Math.min(p1Id, p2Id) * 100000L + Math.max(p1Id, p2Id);
        List<int[]> clauses = pendingClauses.remove(key);

        int newState = -1;
        if (clauses != null) {
            for (int[] clause : clauses) {
                int type = clause[0];
                long giver = clause[1];
                int value = clause[2];
                long receiver = (giver == p1Id) ? p2Id : p1Id;
                Player giverPlayer = game.players.get(giver);
                Player receiverPlayer = game.players.get(receiver);
                switch (type) {
                    case CLAUSE_CEASEFIRE:
                        newState = DS_CEASEFIRE;
                        break;
                    case CLAUSE_PEACE:
                        newState = DS_PEACE;
                        break;
                    case CLAUSE_ALLIANCE:
                        newState = DS_ALLIANCE;
                        break;
                    case CLAUSE_GOLD:
                        if (giverPlayer != null && receiverPlayer != null) {
                            int transfer = Math.min(value, giverPlayer.getGold());
                            giverPlayer.setGold(giverPlayer.getGold() - transfer);
                            receiverPlayer.setGold(receiverPlayer.getGold() + transfer);
                            log.info("Gold transfer: {} gold from {} to {}",
                                    transfer, giverPlayer.getUsername(), receiverPlayer.getUsername());
                        }
                        break;
                    case CLAUSE_ADVANCE:
                        if (giverPlayer != null && receiverPlayer != null) {
                            long techId = (long) value;
                            // Validate giver possesses the technology and receiver meets all
                            // direct prerequisites before applying the transfer.
                            // Mirrors the research_invention_gettable() check in the C Freeciv
                            // server's diplhand.c (tech_trade_allow_holes = false).
                            if (giverPlayer.hasTech(techId)
                                    && TechTools.canPlayerResearch(game, receiver, techId)) {
                                log.info("Tech transfer: tech {} from {} to {}",
                                        techId, giverPlayer.getUsername(), receiverPlayer.getUsername());
                                Notify.notifyPlayer(game, game.getServer(), receiver,
                                        "You received a technology from " + giverPlayer.getUsername() + ".");
                                // Use giveTechToPlayer to trigger all side effects: unit upgrades,
                                // obsolete building removal, and city-info broadcasts.
                                // Mirrors give_advance_to_player() in the C Freeciv server.
                                TechTools.giveTechToPlayer(game, receiver, techId);
                            }
                        }
                        break;
                    default:
                        break;
                }
            }
        }

        // Apply the most significant pact found (alliance > peace > ceasefire)
        if (newState == DS_ALLIANCE) {
            setDiplStateSymmetric(p1, p2, DS_ALLIANCE, 0);
        } else if (newState == DS_PEACE) {
            setDiplStateSymmetric(p1, p2, DS_PEACE, 0);
        } else if (newState == DS_CEASEFIRE) {
            setDiplStateSymmetric(p1, p2, DS_CEASEFIRE, CEASEFIRE_TURNS);
        }

        log.info("Treaty concluded between {} and {}", p1.getUsername(), p2.getUsername());
        Notify.notifyPlayer(game, game.getServer(), p1Id,
                "Treaty with " + p2.getUsername() + " is now in effect.");
        Notify.notifyPlayer(game, game.getServer(), p2Id,
                "Treaty with " + p1.getUsername() + " is now in effect.");

        // Broadcast notable treaty outcomes to all players so everyone can
        // follow the shifting diplomatic landscape of the game.
        if (newState == DS_ALLIANCE) {
            Notify.notifyAllPlayers(game, game.getServer(),
                    p1.getUsername() + " and " + p2.getUsername() + " have formed an Alliance!");
        } else if (newState == DS_PEACE) {
            Notify.notifyAllPlayers(game, game.getServer(),
                    p1.getUsername() + " and " + p2.getUsername() + " have agreed to Peace.");
        } else if (newState == DS_CEASEFIRE) {
            Notify.notifyAllPlayers(game, game.getServer(),
                    p1.getUsername() + " and " + p2.getUsername() + " have agreed to a Ceasefire.");
        }
    }

    /**
     * Sets the diplomatic state symmetrically on both players.
     * For a ceasefire, also sets the {@code turnsLeft} countdown.
     * Mirrors the two-way assignment in {@code accept_treaty()} in diplhand.c.
     */
    public static void setDiplStateSymmetric(Player p1, Player p2, int state, int turnsLeft) {
        p1.setDiplState(p2.getConnectionId(), state);
        p2.setDiplState(p1.getConnectionId(), state);
        if (state == DS_CEASEFIRE) {
            p1.setCeasefireTurnsLeft(p2.getConnectionId(), turnsLeft);
            p2.setCeasefireTurnsLeft(p1.getConnectionId(), turnsLeft);
        } else {
            p1.setCeasefireTurnsLeft(p2.getConnectionId(), 0);
            p2.setCeasefireTurnsLeft(p1.getConnectionId(), 0);
        }
    }

    /**
     * Handles a player cancelling an existing pact with another player.
     * The clause type indicates which level of agreement is being cancelled
     * (cease-fire, peace, alliance).  Cancelling any pact reverts to war
     * (unless the players only had DS_NO_CONTACT, which cannot be cancelled).
     * Mirrors {@code handle_diplomacy_cancel_pact} in diplhand.c.
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

        // Cancelling any active pact defaults to war state
        int currentState = player.getDiplState(otherId);
        if (currentState != DS_NO_CONTACT) {
            setDiplStateSymmetric(player, other, DS_WAR, 0);
            log.info("{} cancelled pact (type {}) with {} — now at war",
                    player.getUsername(), clauseType, other.getUsername());
        }

        Notify.notifyPlayer(game, game.getServer(), otherId,
                player.getUsername() + " has cancelled the pact — you are now at war!");
        Notify.notifyPlayer(game, game.getServer(), connId,
                "Pact cancelled — you are now at war with " + other.getUsername() + ".");
        // Broadcast war declaration to all players.
        Notify.notifyAllPlayers(game, game.getServer(),
                player.getUsername() + " has declared war on " + other.getUsername() + "!");
    }
}
