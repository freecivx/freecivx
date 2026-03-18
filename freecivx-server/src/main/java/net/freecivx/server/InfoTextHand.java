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
import net.freecivx.game.Improvement;
import net.freecivx.game.Nation;
import net.freecivx.game.Player;
import net.freecivx.game.Terrain;
import net.freecivx.game.Tile;
import net.freecivx.game.Unit;
import net.freecivx.game.UnitType;
import org.json.JSONObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Handles PACKET_WEB_INFO_TEXT_REQ (289) from the client.
 * Generates a formatted info text describing the clicked tile (terrain,
 * territory, city, unit) and sends back PACKET_WEB_INFO_TEXT_MESSAGE (290).
 * Mirrors handle_web_info_text_req() / web_popup_info_text() in the C
 * Freeciv server's maphand.c.
 */
public class InfoTextHand {

    private static final String[] DIPLO_NATION_ADJECTIVES = {
        "Neutral", "Hostile", "Neutral", "Peaceful", "Friendly", "Mysterious", "Friendly(team)"
    };
    private static final String[] DIPLO_CITY_ADJECTIVES = {
        "Neutral", "Hostile", "Neutral", "Peaceful", "Friendly", "Mysterious", "Friendly(team)"
    };

    /**
     * Handles a PACKET_WEB_INFO_TEXT_REQ from the client.
     * Builds a tile-info text and sends a PACKET_WEB_INFO_TEXT_MESSAGE reply.
     *
     * @param game          the current game state
     * @param connId        the connection ID of the requesting client
     * @param loc           the tile index of the clicked tile
     * @param visibleUnitId the ID of the unit visible on the tile (0 if none)
     * @param focusUnitId   the ID of the client's currently focused unit (0 if none)
     */
    public static void handleWebInfoTextReq(Game game, long connId,
                                            int loc, int visibleUnitId, int focusUnitId) {
        Player player = game.players.get(connId);
        if (player == null) return;

        Tile tile = game.tiles.get((long) loc);
        if (tile == null) return;

        // Only respond if the player has explored the tile (map_is_known).
        if (!player.getExploredTiles().contains((long) loc)
                && !player.getVisibleTiles().contains((long) loc)) {
            return;
        }

        boolean visible = player.getVisibleTiles().contains((long) loc);

        int xsize = game.map.getXsize();
        int natX = loc % xsize;
        int natY = loc / xsize;

        StringBuilder sb = new StringBuilder();

        // Map coordinates
        sb.append("Map coordinates: (").append(natX).append(", ").append(natY).append(")");

        // Terrain
        Terrain terrain = game.terrains.get((long) tile.getTerrain());
        if (terrain != null) {
            sb.append("\nTerrain: ").append(terrain.getName());
        }

        // Find city on this tile (if any)
        City cityOnTile = null;
        for (City c : game.cities.values()) {
            if (c.getTile() == loc) {
                cityOnTile = c;
                break;
            }
        }

        // Territory / city ownership
        if (cityOnTile == null) {
            // Show territory ownership
            int tileOwner = tile.getOwner();
            if (tileOwner >= 0) {
                Player ownerPlayer = game.players.get((long) tileOwner);
                if (ownerPlayer != null) {
                    if (ownerPlayer.getConnectionId() == connId) {
                        sb.append("\nOur territory");
                    } else {
                        String username = ownerPlayer.getUsername();
                        String nation = getNationAdjective(game, ownerPlayer);
                        int dsType = player.getDiplState(ownerPlayer.getConnectionId());
                        if (dsType == DiplHand.DS_CEASEFIRE) {
                            int turnsLeft = player.getCeasefireTurnsLeft(ownerPlayer.getConnectionId());
                            sb.append("\nTerritory of ").append(username)
                              .append(" (").append(nation).append(") (")
                              .append(turnsLeft).append(turnsLeft == 1 ? " turn cease-fire)" : " turns cease-fire)");
                        } else {
                            sb.append("\nTerritory of ").append(username)
                              .append(" (").append(nation).append(" | ")
                              .append(DIPLO_NATION_ADJECTIVES[Math.min(dsType, DIPLO_NATION_ADJECTIVES.length - 1)])
                              .append(")");
                        }
                    }
                } else {
                    sb.append("\nUnclaimed territory");
                }
            } else {
                sb.append("\nUnclaimed territory");
            }
        } else {
            // City on this tile
            Player cityOwner = game.players.get(cityOnTile.getOwner());
            if (cityOwner != null) {
                String username = cityOwner.getUsername();
                String nation = getNationAdjective(game, cityOwner);
                if (cityOwner.getConnectionId() == connId) {
                    sb.append("\nCity: ").append(cityOnTile.getName())
                      .append(" | ").append(username)
                      .append(" (").append(nation).append(")");
                } else {
                    int dsType = player.getDiplState(cityOwner.getConnectionId());
                    if (dsType == DiplHand.DS_CEASEFIRE) {
                        int turnsLeft = player.getCeasefireTurnsLeft(cityOwner.getConnectionId());
                        sb.append("\nCity: ").append(cityOnTile.getName())
                          .append(" | ").append(username)
                          .append(" (").append(nation).append(", ")
                          .append(turnsLeft).append(turnsLeft == 1 ? " turn cease-fire)" : " turns cease-fire)");
                    } else {
                        sb.append("\nCity: ").append(cityOnTile.getName())
                          .append(" | ").append(username)
                          .append(" (").append(nation).append(", ")
                          .append(DIPLO_CITY_ADJECTIVES[Math.min(dsType, DIPLO_CITY_ADJECTIVES.length - 1)])
                          .append(")");
                    }
                }

                if (visible) {
                    // Count units in city
                    long unitCount = game.units.values().stream()
                            .filter(u -> u.getTile() == loc)
                            .count();
                    if (unitCount > 0) {
                        sb.append(unitCount == 1 ? " | Occupied with 1 unit." : " | Occupied with " + unitCount + " units.");
                    } else {
                        sb.append(" | Not occupied.");
                    }

                    // List visible improvements
                    List<String> imprNames = new ArrayList<>();
                    for (int imprId : cityOnTile.getImprovements()) {
                        Improvement impr = game.improvements.get((long) imprId);
                        if (impr != null) {
                            imprNames.add(impr.getName());
                        }
                    }
                    if (!imprNames.isEmpty()) {
                        sb.append("\n   with ").append(String.join(", ", imprNames)).append(".");
                    }
                }
            } else {
                sb.append("\nCity: ").append(cityOnTile.getName());
            }
        }

        // Unit info (only if a visible unit is specified and no city on tile)
        if (visible && visibleUnitId != 0 && cityOnTile == null) {
            Unit visUnit = game.units.get((long) visibleUnitId);
            if (visUnit != null) {
                Player unitOwner = game.players.get(visUnit.getOwner());
                UnitType utype = game.unitTypes.get((long) visUnit.getType());
                String typeName = utype != null ? utype.getName() : "Unit";
                if (unitOwner != null) {
                    String username = unitOwner.getUsername();
                    String nation = getNationAdjective(game, unitOwner);
                    if (unitOwner.getConnectionId() == connId) {
                        sb.append("\nUnit: ").append(typeName)
                          .append(" | ").append(username)
                          .append(" (").append(nation).append(")");
                    } else {
                        int dsType = player.getDiplState(unitOwner.getConnectionId());
                        if (dsType == DiplHand.DS_CEASEFIRE) {
                            int turnsLeft = player.getCeasefireTurnsLeft(unitOwner.getConnectionId());
                            sb.append("\nUnit: ").append(typeName)
                              .append(" | ").append(username)
                              .append(" (").append(nation).append(", ")
                              .append(turnsLeft).append(turnsLeft == 1 ? " turn cease-fire)" : " turns cease-fire)");
                        } else {
                            sb.append("\nUnit: ").append(typeName)
                              .append(" | ").append(username)
                              .append(" (").append(nation).append(", ")
                              .append(DIPLO_CITY_ADJECTIVES[Math.min(dsType, DIPLO_CITY_ADJECTIVES.length - 1)])
                              .append(")");
                        }
                    }
                }
            }
        }

        String message;
        try {
            message = URLEncoder.encode(sb.toString(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            message = sb.toString();
        }

        JSONObject reply = new JSONObject();
        reply.put("pid", Packets.PACKET_WEB_INFO_TEXT_MESSAGE);
        reply.put("message", message);
        game.getServer().sendPacket(connId, reply);
    }

    /** Returns the nation adjective string for the given player, or "Unknown" if unavailable. */
    private static String getNationAdjective(Game game, Player player) {
        Nation nation = game.nations.get((long) player.getNation());
        return nation != null ? nation.getAdjective() : "Unknown";
    }
}
