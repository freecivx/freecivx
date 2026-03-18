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

import net.freecivx.game.City;
import net.freecivx.game.Game;
import net.freecivx.game.Player;

/**
 * Civilisation score computation and broadcasting.
 * Mirrors the functionality of {@code server/score.c} in the C Freeciv server.
 *
 * <p>The score formula is based on {@code get_civ_score()} in score.c:
 * population (city sizes) + city count × 5 + technologies × 2 + gold ÷ 10
 * + alive bonus 50.
 */
public class Score {

    private Score() {} // static utility class

    /**
     * Computes a civilisation score for the given player.
     * Mirrors {@code get_civ_score()} in the C Freeciv server's
     * {@code server/score.c}:
     * <ul>
     *   <li>Population: sum of city sizes (primary growth metric)</li>
     *   <li>Cities: number of cities × 5</li>
     *   <li>Techs: number of known technologies × 2</li>
     *   <li>Gold: treasury balance ÷ 10 (floored at 0)</li>
     *   <li>Alive bonus: +50 for civilisations still in the game</li>
     * </ul>
     *
     * @param game   the current game state
     * @param player the player to score
     * @return a non-negative integer score
     */
    public static long computeScore(Game game, Player player) {
        long pid = player.getPlayerNo();
        long popScore = 0;
        long cityCount = 0;
        for (City c : game.cities.values()) {
            if (c.getOwner() == pid) {
                popScore += c.getSize();
                cityCount++;
            }
        }
        long cityScore  = cityCount * 5L;
        long techScore  = player.getKnownTechs().size() * 2L;
        long goldScore  = Math.max(0, player.getGold()) / 10L;
        long aliveBonus = player.isAlive() ? 50L : 0L;
        return popScore + cityScore + techScore + goldScore + aliveBonus;
    }

    /**
     * Broadcasts the current civilisation scores for all players to all
     * connected clients using {@code PACKET_PLAYER_SCORE}.
     * Called at the end of each turn so players can track relative progress
     * on their scoreboard.
     * Mirrors {@code report_scores()} in the C Freeciv server's
     * {@code server/score.c}.
     *
     * @param game   the current game state
     * @param server the server used to broadcast the packets
     */
    public static void sendScores(Game game, IGameServer server) {
        for (Player p : game.players.values()) {
            server.sendPlayerScoreAll(p.getPlayerNo(), computeScore(game, p));
        }
    }
}
