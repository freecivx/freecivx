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

package net.freecivx.ai;

import net.freecivx.game.City;
import net.freecivx.game.Game;
import net.freecivx.game.Player;
import net.freecivx.server.DiplHand;
import net.freecivx.server.Notify;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * AI diplomacy logic for freecivx-server.
 *
 * <p>Mirrors the key behaviour of {@code ai/default/daidiplomacy.c} in the
 * C Freeciv server:
 * <ul>
 *   <li>{@link #beginNewPhase(Game)} – called at the start of every turn to
 *       decay love values and tick down ceasefire countdowns.</li>
 *   <li>{@link #performDiplomaticActions(Game)} – makes war declarations and
 *       peace/ceasefire/alliance offers based on the current love values.</li>
 * </ul>
 *
 * <p>The "love" system (range −1000 … +1000) is the core mechanism of the
 * C server AI:
 * <ul>
 *   <li>Love starts near 0 when two players first meet (DS_NO_CONTACT → DS_WAR).</li>
 *   <li>Each turn a small percentage decays toward 0 (love_coeff).</li>
 *   <li>Military conflicts reduce love; holding a pact raises it slightly.</li>
 *   <li>When love drops below {@link #LOVE_THRESHOLD_WAR} the AI will declare
 *       war on the other player.</li>
 *   <li>When love rises above {@link #LOVE_THRESHOLD_CEASEFIRE} /
 *       {@link #LOVE_THRESHOLD_PEACE} / {@link #LOVE_THRESHOLD_ALLIANCE} the
 *       AI will propose the appropriate pact.</li>
 * </ul>
 */
public class AiDiplomacy {

    private static final Logger log = LoggerFactory.getLogger(AiDiplomacy.class);

    private final Random random = new Random();

    // -------------------------------------------------------------------------
    // Love thresholds (mirrors req_love_for_peace / req_love_for_alliance in
    // daidiplomacy.c and the war-desire threshold in dai_diplomacy_actions()).
    // -------------------------------------------------------------------------

    /** Love below this value → AI will consider declaring war. */
    private static final int LOVE_THRESHOLD_WAR       = -200;
    /** Love above this value → AI may propose a ceasefire. */
    private static final int LOVE_THRESHOLD_CEASEFIRE =   50;
    /** Love above this value → AI may propose a peace treaty. */
    private static final int LOVE_THRESHOLD_PEACE     =  200;
    /** Love above this value → AI may propose an alliance. */
    private static final int LOVE_THRESHOLD_ALLIANCE  =  600;

    /**
     * Per-turn percentage by which love decays toward 0.
     * Mirrors {@code love_coeff} in the C Freeciv server's dai_plr diplomacy
     * structure (default value 15 = 15% per turn towards neutrality).
     */
    private static final int LOVE_DECAY_PERCENT = 15;

    /**
     * Base love bonus granted each turn while a peace or ceasefire pact is in
     * force.  Mirrors the positive love adjustment for "non-attack" pacts in
     * {@code dai_diplomacy_begin_new_phase()}.
     */
    private static final int LOVE_BONUS_PACT_PER_TURN = 5;

    /**
     * Base love bonus granted each turn while an alliance is in force.
     * Mirrors the positive adjustment for allied status in
     * {@code dai_diplomacy_begin_new_phase()}.
     */
    private static final int LOVE_BONUS_ALLIANCE_PER_TURN = 10;

    /**
     * Love penalty applied when the AI attacks or conquers a city belonging
     * to another player.  Mirrors the incident-based love reduction in
     * {@code dai_incident()} in daidiplomacy.c.
     */
    public static final int LOVE_PENALTY_ATTACK = 50;

    /**
     * Initial love between two AI players upon first contact.
     * The C server randomises a small adjustment; we use a fixed starting
     * value of 0 (neutral) and add ±LOVE_INITIAL_VARIANCE.
     */
    private static final int LOVE_INITIAL_VARIANCE = 50;

    /**
     * Minimum number of turns an AI will wait between diplomatic actions
     * toward the same player.  Prevents the AI from spamming proposals every
     * turn.  Mirrors the {@code countdown} / spam timer in ai_dip_intel.
     */
    private static final int DIPLOMACY_COOLDOWN_TURNS = 10;

    /**
     * Per-pair cooldown tracker: maps a canonical pair key
     * (min(p1,p2)*100000 + max(p1,p2)) to the number of turns remaining
     * before the AI may act toward that player again.
     */
    private final java.util.Map<Long, Integer> diplomacyCooldown = new java.util.HashMap<>();

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * Must be called at the very start of each new turn, before any unit or
     * city processing.  Updates all AI players' love values and ticks down
     * ceasefire countdowns.
     *
     * <p>Mirrors {@code dai_diplomacy_begin_new_phase()} in daidiplomacy.c.
     *
     * @param game the current game state
     */
    public void beginNewPhase(Game game) {
        List<Player> allPlayers = new ArrayList<>(game.players.values());

        // Tick down cooldowns
        for (long key : new ArrayList<>(diplomacyCooldown.keySet())) {
            int remaining = diplomacyCooldown.get(key) - 1;
            if (remaining <= 0) {
                diplomacyCooldown.remove(key);
            } else {
                diplomacyCooldown.put(key, remaining);
            }
        }

        for (Player ai : allPlayers) {
            if (!ai.isAi() || !ai.isAlive()) continue;

            for (Player other : allPlayers) {
                if (other.getConnectionId() == ai.getConnectionId()) continue;
                if (!other.isAlive()) continue;

                int state = ai.getDiplState(other.getConnectionId());

                // On first contact initialise love with a small random value
                if (state == DiplHand.DS_NO_CONTACT) {
                    int initialLove = (random.nextInt(2 * LOVE_INITIAL_VARIANCE + 1))
                            - LOVE_INITIAL_VARIANCE;
                    ai.setAiLove(other.getConnectionId(), initialLove);
                    ai.setDiplState(other.getConnectionId(), DiplHand.DS_WAR);
                    other.setDiplState(ai.getConnectionId(), DiplHand.DS_WAR);
                    log.debug("First contact: {} meets {} (initial love={})",
                            ai.getUsername(), other.getUsername(), initialLove);
                    continue;
                }

                // Decay love toward 0 by LOVE_DECAY_PERCENT % each turn.
                // Mirrors the per-turn love_coeff reduction in C daidiplomacy.c.
                int love = ai.getAiLove(other.getConnectionId());
                love = love - (love * LOVE_DECAY_PERCENT / 100);

                // Bonus for active pact (keeps love from drifting to war when at peace)
                if (state == DiplHand.DS_ALLIANCE) {
                    love += LOVE_BONUS_ALLIANCE_PER_TURN;
                } else if (state == DiplHand.DS_PEACE || state == DiplHand.DS_CEASEFIRE) {
                    love += LOVE_BONUS_PACT_PER_TURN;
                }

                ai.setAiLove(other.getConnectionId(), love);

                // Tick down ceasefire if applicable
                if (state == DiplHand.DS_CEASEFIRE) {
                    int turnsLeft = ai.getCeasefireTurnsLeft(other.getConnectionId());
                    if (turnsLeft > 0) {
                        turnsLeft--;
                        ai.setCeasefireTurnsLeft(other.getConnectionId(), turnsLeft);
                        if (turnsLeft == 0) {
                            // Ceasefire has expired – revert to war
                            ai.setDiplState(other.getConnectionId(), DiplHand.DS_WAR);
                            other.setDiplState(ai.getConnectionId(), DiplHand.DS_WAR);
                            log.info("Ceasefire expired between {} and {}",
                                    ai.getUsername(), other.getUsername());
                            Notify.notifyPlayer(game, game.getServer(), other.getConnectionId(),
                                    "The ceasefire with " + ai.getUsername() + " has expired.");
                        }
                    }
                }
            }
        }
    }

    /**
     * Executes AI diplomatic decisions for the current turn.  Called after
     * {@link #beginNewPhase(Game)}.
     *
     * <p>For each AI player, iterates over all known opponents and:
     * <ol>
     *   <li>Declares war if love is below {@link #LOVE_THRESHOLD_WAR}.</li>
     *   <li>Proposes a ceasefire, peace, or alliance if love crosses the
     *       respective threshold and the relationship can be improved.</li>
     * </ol>
     *
     * <p>Mirrors the high-level structure of {@code dai_diplomacy_actions()}
     * in daidiplomacy.c.
     *
     * @param game the current game state
     */
    public void performDiplomaticActions(Game game) {
        List<Player> allPlayers = new ArrayList<>(game.players.values());

        for (Player ai : allPlayers) {
            if (!ai.isAi() || !ai.isAlive()) continue;

            for (Player other : allPlayers) {
                if (other.getConnectionId() == ai.getConnectionId()) continue;
                if (!other.isAlive()) continue;

                long pairKey = pairKey(ai.getConnectionId(), other.getConnectionId());
                if (diplomacyCooldown.containsKey(pairKey)) continue;

                int state = ai.getDiplState(other.getConnectionId());
                int love  = ai.getAiLove(other.getConnectionId());

                // -----------------------------------------------------------------
                // War declaration
                // Mirrors the war-declaration branch in dai_diplomacy_actions().
                // Only consider attacking if we are currently at peace (not already
                // at war) and love has dropped below the war threshold.
                // -----------------------------------------------------------------
                if (love < LOVE_THRESHOLD_WAR && state != DiplHand.DS_WAR) {
                    declareWar(game, ai, other);
                    setCooldown(pairKey);
                    continue;
                }

                // -----------------------------------------------------------------
                // Alliance proposal
                // Mirrors the alliance-offer branch: love is very high and we are
                // at peace or ceasefire.
                // -----------------------------------------------------------------
                if (love >= LOVE_THRESHOLD_ALLIANCE
                        && (state == DiplHand.DS_PEACE || state == DiplHand.DS_CEASEFIRE)) {
                    if (!other.isAi()) {
                        // Only propose to human players; AI–AI handled symmetrically
                        proposeAlliance(game, ai, other);
                        setCooldown(pairKey);
                    } else if (ai.getConnectionId() < other.getConnectionId()) {
                        // AI–AI: lower ID proposes to avoid duplicate offers
                        acceptAllianceSymmetric(game, ai, other);
                        setCooldown(pairKey);
                        setCooldown(pairKey(other.getConnectionId(), ai.getConnectionId()));
                    }
                    continue;
                }

                // -----------------------------------------------------------------
                // Peace proposal
                // -----------------------------------------------------------------
                if (love >= LOVE_THRESHOLD_PEACE && state == DiplHand.DS_CEASEFIRE) {
                    if (!other.isAi()) {
                        proposePeace(game, ai, other);
                        setCooldown(pairKey);
                    } else if (ai.getConnectionId() < other.getConnectionId()) {
                        acceptPeaceSymmetric(game, ai, other);
                        setCooldown(pairKey);
                        setCooldown(pairKey(other.getConnectionId(), ai.getConnectionId()));
                    }
                    continue;
                }

                // -----------------------------------------------------------------
                // Ceasefire proposal (from a state of war)
                // -----------------------------------------------------------------
                if (love >= LOVE_THRESHOLD_CEASEFIRE && state == DiplHand.DS_WAR) {
                    if (!other.isAi()) {
                        proposeCeasefire(game, ai, other);
                        setCooldown(pairKey);
                    } else if (ai.getConnectionId() < other.getConnectionId()) {
                        acceptCeasefireSymmetric(game, ai, other);
                        setCooldown(pairKey);
                        setCooldown(pairKey(other.getConnectionId(), ai.getConnectionId()));
                    }
                }
            }
        }
    }

    // =========================================================================
    // Incident handler
    // =========================================================================

    /**
     * Adjusts AI love values after a military incident (attack, city conquest,
     * etc.).  Called whenever an AI or human player performs a hostile action
     * against another player.
     *
     * <p>Mirrors {@code dai_incident()} in daidiplomacy.c.
     *
     * @param game       the current game state
     * @param attackerId connection ID of the aggressor
     * @param defenderId connection ID of the victim
     * @param lovePenalty magnitude of the love reduction applied to both the
     *                    attacker (toward the defender) and all players that
     *                    observe the incident
     */
    public void handleIncident(Game game, long attackerId, long defenderId, int lovePenalty) {
        Player defender = game.players.get(defenderId);
        if (defender == null || !defender.isAlive()) return;

        // AI observers allied with the victim reduce their love for the attacker.
        // Observers allied with the attacker are not penalised — they expect their
        // ally to be aggressive.  Mirrors dai_incident() in daidiplomacy.c where
        // only friendly-to-victim observers have their opinion of the attacker lowered.
        for (Player observer : game.players.values()) {
            if (!observer.isAi() || !observer.isAlive()) continue;
            if (observer.getConnectionId() == attackerId) continue;

            // Only penalise if the observer is allied with the defender
            if (observer.getDiplState(defenderId) == DiplHand.DS_ALLIANCE) {
                observer.adjustAiLove(attackerId, -lovePenalty);
            }
        }

        // The defender (if AI) loses love for the attacker
        if (defender.isAi()) {
            defender.adjustAiLove(attackerId, -lovePenalty);
        }
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    /**
     * Declares war from {@code aggressor} on {@code target}.
     * Sets the diplomatic state to DS_WAR on both sides and notifies the target.
     */
    private void declareWar(Game game, Player aggressor, Player target) {
        DiplHand.setDiplStateSymmetric(aggressor, target, DiplHand.DS_WAR, 0);
        log.info("AI {} declares war on {}", aggressor.getUsername(), target.getUsername());
        Notify.notifyPlayer(game, game.getServer(), target.getConnectionId(),
                aggressor.getUsername() + " has declared war on you!");
    }

    /**
     * Proposes a ceasefire from an AI to a human player.
     * The human sees a chat notification; the state is not changed until the
     * human accepts.  For AI–AI pairs, use {@link #acceptCeasefireSymmetric}.
     */
    private void proposeCeasefire(Game game, Player ai, Player human) {
        log.info("AI {} proposes ceasefire to {}", ai.getUsername(), human.getUsername());
        Notify.notifyPlayer(game, game.getServer(), human.getConnectionId(),
                ai.getUsername() + " proposes a ceasefire.");
    }

    /**
     * Immediately applies a ceasefire between two AI players (no negotiation
     * step needed since both sides are AI-controlled).
     */
    private void acceptCeasefireSymmetric(Game game, Player ai1, Player ai2) {
        DiplHand.setDiplStateSymmetric(ai1, ai2, DiplHand.DS_CEASEFIRE,
                DiplHand.CEASEFIRE_TURNS);
        log.info("AI {} and AI {} agree on ceasefire", ai1.getUsername(), ai2.getUsername());
    }

    /**
     * Proposes a peace treaty from an AI to a human player.
     */
    private void proposePeace(Game game, Player ai, Player human) {
        log.info("AI {} proposes peace to {}", ai.getUsername(), human.getUsername());
        Notify.notifyPlayer(game, game.getServer(), human.getConnectionId(),
                ai.getUsername() + " proposes a peace treaty.");
    }

    /**
     * Immediately applies a peace treaty between two AI players.
     */
    private void acceptPeaceSymmetric(Game game, Player ai1, Player ai2) {
        DiplHand.setDiplStateSymmetric(ai1, ai2, DiplHand.DS_PEACE, 0);
        log.info("AI {} and AI {} agree on peace", ai1.getUsername(), ai2.getUsername());
    }

    /**
     * Proposes an alliance from an AI to a human player.
     */
    private void proposeAlliance(Game game, Player ai, Player human) {
        log.info("AI {} proposes alliance to {}", ai.getUsername(), human.getUsername());
        Notify.notifyPlayer(game, game.getServer(), human.getConnectionId(),
                ai.getUsername() + " proposes an alliance.");
    }

    /**
     * Immediately applies an alliance between two AI players.
     */
    private void acceptAllianceSymmetric(Game game, Player ai1, Player ai2) {
        DiplHand.setDiplStateSymmetric(ai1, ai2, DiplHand.DS_ALLIANCE, 0);
        log.info("AI {} and AI {} form an alliance", ai1.getUsername(), ai2.getUsername());
    }

    /**
     * Sets a cooldown so the AI waits {@link #DIPLOMACY_COOLDOWN_TURNS} before
     * acting toward the same player pair again.
     */
    private void setCooldown(long pairKey) {
        diplomacyCooldown.put(pairKey, DIPLOMACY_COOLDOWN_TURNS);
    }

    /** Returns the canonical pair key for two player IDs. */
    private static long pairKey(long a, long b) {
        return Math.min(a, b) * 100000L + Math.max(a, b);
    }
}
