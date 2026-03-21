/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.freecivx.com/
 Copyright (C) 2009-2025  The Freeciv-web project, Andreas Røsdal

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

import net.freecivx.game.Improvement;
import net.freecivx.game.Player;
import net.freecivx.game.Tile;
import net.freecivx.game.Unit;
import net.freecivx.game.UnitType;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Transport-independent server interface consumed by the game logic.
 *
 * <p>{@link CivServer} provides the production implementation backed by a
 * real WebSocket server.
 *
 * <p>All methods that send data to connected clients are declared here so that
 * {@link net.freecivx.game.Game}, {@link Notify} and the various handler
 * classes are decoupled from the concrete transport layer.
 */
public interface IGameServer {

    // -------------------------------------------------------------------------
    // Low-level packet routing
    // -------------------------------------------------------------------------

    /** Sends a raw JSON packet to a single connection identified by {@code connId}. */
    void sendPacket(long connId, JSONObject packet);

    /** Broadcasts a raw JSON packet to every connected client. */
    void broadcastPacket(JSONObject packet);

    // -------------------------------------------------------------------------
    // Chat / notification
    // -------------------------------------------------------------------------

    void sendMessageAll(String message);

    void sendMessage(long connId, String message);

    void sendEventMessage(long connId, String message, int eventType);

    void sendEventMessage(long connId, String message, int eventType, int tileX, int tileY);

    // -------------------------------------------------------------------------
    // Turn lifecycle
    // -------------------------------------------------------------------------

    void sendEndTurnAll();

    void sendBeginTurnAll();

    void sendStartPhaseAll();

    void sendGameInfoAll(long year, long turn, long phase, int timeout);

    void sendCalendarInfoAll();

    // -------------------------------------------------------------------------
    // Map / ruleset initialisation
    // -------------------------------------------------------------------------

    void sendMapInfoAll(int xsize, int ysize, int topologyId);

    void sendTerrainInfoAll(long id, String name, String graphic_str);

    void sendRulesetCityInfoAll(long style_id, String name, String rule_name);

    void sendRuleseGovernmentAll(long id, String name, String rule_name, String helptext);

    void sendRulesetSpecialistAll(int id, String name, String plural_name, String rule_name);

    void sendRulesetUnitAll(long id, UnitType utype);

    void sendRulesetUnitWebAdditionAll(long id, UnitType utype);

    void sendExtrasInfoAll(long id, String extra_name, int causes, String graphicStr);

    void sendNationInfoAll(long id, String name, String adjective, String graphic_str, String legend);

    void sendTechAll(long id, int root_req, String name, JSONArray research_reqs, String graphic_str, String helptext);

    void sendBordersServerSettingsAll();

    void sendRulesetControl(int numImprovements);

    void sendRulesetBuildingAll(Improvement impr);

    void sendRulesetActionsAll();

    // -------------------------------------------------------------------------
    // Tile
    // -------------------------------------------------------------------------

    void sendTileInfoAll(Tile tile);

    // -------------------------------------------------------------------------
    // Units
    // -------------------------------------------------------------------------

    void sendUnitAll(Unit unit);

    void sendUnitRemove(long unit_id);

    // -------------------------------------------------------------------------
    // Cities
    // -------------------------------------------------------------------------

    void sendCityShortInfoAll(long id, long owner, long tile, int size, int style,
                               boolean capital, boolean occupied, int walls,
                               boolean happy, boolean unhappy,
                               String improvements, String name);

    void sendCityInfoAll(long id, long owner, long tile, int size, int style,
                          boolean capital, boolean occupied, int walls,
                          boolean happy, boolean unhappy,
                          String improvements, String name,
                          int production_kind, int production_value);

    // -------------------------------------------------------------------------
    // Players / connections
    // -------------------------------------------------------------------------

    void sendConnInfoAll(long id, String username, String address, long player_num);

    void sendPlayerInfoAdditionAll(long playerno, int expected_income);

    void sendPlayerInfoAll(Player player);

    void sendPlayerRemoveAll(long playerNo);

    /**
     * Broadcasts a {@code PACKET_SPACESHIP_INFO} (137) packet containing the
     * full spaceship state for the given player.
     * Mirrors {@code send_spaceship_info()} in the C Freeciv server's
     * {@code server/spacerace.c}.
     *
     * @param player the player whose spaceship state to broadcast
     */
    void sendSpaceshipInfo(Player player);

    /**
     * Sends a government report page to a single client as
     * {@code PACKET_PAGE_MSG} (110) + {@code PACKET_PAGE_MSG_PART} (250).
     * Mirrors {@code page_conn()} in the C Freeciv server's
     * {@code server/report.c}.
     *
     * @param connId   the connection to send the report to
     * @param headline short title shown in the report header
     * @param caption  subtitle / date line
     * @param message  full report body text (newlines are converted to &lt;br&gt; by the client)
     */
    void sendPageMsg(long connId, String headline, String caption, String message);

    // -------------------------------------------------------------------------
    // Late-join sync
    // -------------------------------------------------------------------------

    /**
     * Sends the complete current game state to the client identified by
     * {@code connId}.  Used to synchronise late-joining players.
     */
    void sendGameStateTo(long connId);

    // -------------------------------------------------------------------------
    // Game lifecycle
    // -------------------------------------------------------------------------

    /**
     * Schedules a full game reset after {@code delaySeconds} seconds.
     * All currently-connected clients are automatically re-added to the new game.
     * Used by both singleplayer and multiplayer modes to restart after victory.
     */
    void scheduleGameRestart(int delaySeconds);
}
