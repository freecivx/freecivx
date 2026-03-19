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

package net.freecivx.main;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import net.freecivx.game.*;
import net.freecivx.server.CivServer;
import org.json.JSONArray;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * HTTP handler that implements a minimal MCP (Model Context Protocol) server
 * so that AI coding assistants (e.g. GitHub Copilot) can inspect the live
 * freecivx game state and ruleset data.
 *
 * <p>The endpoint listens on {@code POST /mcp} and speaks JSON-RPC 2.0.
 * Supported MCP methods:
 * <ul>
 *   <li>{@code initialize} – capability handshake</li>
 *   <li>{@code tools/list} – enumerate available tools</li>
 *   <li>{@code tools/call} – invoke a tool by name</li>
 * </ul>
 *
 * <p>Available tools:
 * <ul>
 *   <li>{@code get_game_state}   – turn, year, player counts, game mode</li>
 *   <li>{@code get_players}      – all players with key stats</li>
 *   <li>{@code get_cities}       – all cities with owner, size, tile</li>
 *   <li>{@code get_units}        – all units with owner, type, tile</li>
 *   <li>{@code get_ruleset_info} – unit types, improvements, technologies</li>
 *   <li>{@code get_source_files} – list of Java source files in the server</li>
 * </ul>
 */
class McpHandler implements HttpHandler {

    private static final Logger log = LoggerFactory.getLogger(McpHandler.class);

    private static final String MCP_PROTOCOL_VERSION = "2024-11-05";
    private static final String SERVER_NAME = "freecivx-server";
    private static final String SERVER_VERSION = "1.0";

    private final CivServer civServer;

    McpHandler(CivServer civServer) {
        this.civServer = civServer;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        // Only handle POST
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendResponse(exchange, 405, buildError(null, -32600, "Method Not Allowed – use POST"));
            return;
        }

        // Read body
        String body;
        try (InputStream is = exchange.getRequestBody()) {
            body = new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }

        JSONObject response;
        try {
            JSONObject request = new JSONObject(body);
            response = dispatch(request);
        } catch (Exception e) {
            log.warn("MCP parse error: {}", e.getMessage());
            response = buildError(null, -32700, "Parse error: " + e.getMessage());
        }

        sendResponse(exchange, 200, response);
    }

    // -----------------------------------------------------------------------
    // Dispatcher
    // -----------------------------------------------------------------------

    private JSONObject dispatch(JSONObject req) {
        Object id = req.opt("id");
        String method = req.optString("method", "");
        JSONObject params = req.optJSONObject("params");
        if (params == null) params = new JSONObject();

        return switch (method) {
            case "initialize" -> handleInitialize(id, params);
            case "tools/list" -> handleToolsList(id);
            case "tools/call" -> handleToolsCall(id, params);
            default -> buildError(id, -32601, "Method not found: " + method);
        };
    }

    // -----------------------------------------------------------------------
    // MCP method handlers
    // -----------------------------------------------------------------------

    private JSONObject handleInitialize(Object id, JSONObject params) {
        JSONObject serverInfo = new JSONObject()
                .put("name", SERVER_NAME)
                .put("version", SERVER_VERSION);

        JSONObject capabilities = new JSONObject()
                .put("tools", new JSONObject());

        JSONObject result = new JSONObject()
                .put("protocolVersion", MCP_PROTOCOL_VERSION)
                .put("capabilities", capabilities)
                .put("serverInfo", serverInfo);

        return buildSuccess(id, result);
    }

    private JSONObject handleToolsList(Object id) {
        JSONArray tools = new JSONArray();
        tools.put(toolDef("get_game_state",
                "Returns the current game status: turn, historical year, player counts, game mode, and map size.",
                new JSONObject().put("type", "object").put("properties", new JSONObject()).put("required", new JSONArray())));

        tools.put(toolDef("get_players",
                "Returns a list of all players (human and AI) with their key statistics: nation, gold, tax/science/luxury rates, current research, government, and alive status.",
                new JSONObject().put("type", "object").put("properties", new JSONObject()).put("required", new JSONArray())));

        tools.put(toolDef("get_cities",
                "Returns a list of all cities in the game with their owner, size, tile position, improvements built, and production.",
                new JSONObject().put("type", "object").put("properties", new JSONObject()).put("required", new JSONArray())));

        tools.put(toolDef("get_units",
                "Returns a list of all units in the game with their owner, unit type name, tile, HP, and activity.",
                new JSONObject().put("type", "object").put("properties", new JSONObject()).put("required", new JSONArray())));

        tools.put(toolDef("get_ruleset_info",
                "Returns ruleset data: unit types (name, attack, defense, moves, domain, cost), city improvements (name, cost, upkeep, tech requirement), and technologies (name, cost, prerequisites).",
                new JSONObject().put("type", "object").put("properties", new JSONObject()).put("required", new JSONArray())));

        tools.put(toolDef("get_source_files",
                "Returns the list of Java source files in the freecivx-server grouped by package (main, server, game, data, ai, log).",
                new JSONObject().put("type", "object").put("properties", new JSONObject()).put("required", new JSONArray())));

        JSONObject result = new JSONObject().put("tools", tools);
        return buildSuccess(id, result);
    }

    private JSONObject handleToolsCall(Object id, JSONObject params) {
        String toolName = params.optString("name", "");
        JSONObject args = params.optJSONObject("arguments");
        if (args == null) args = new JSONObject();

        try {
            JSONObject toolResult = switch (toolName) {
                case "get_game_state" -> toolGetGameState();
                case "get_players" -> toolGetPlayers();
                case "get_cities" -> toolGetCities();
                case "get_units" -> toolGetUnits();
                case "get_ruleset_info" -> toolGetRulesetInfo();
                case "get_source_files" -> toolGetSourceFiles();
                default -> throw new IllegalArgumentException("Unknown tool: " + toolName);
            };

            JSONArray content = new JSONArray();
            content.put(new JSONObject().put("type", "text").put("text", toolResult.toString(2)));
            JSONObject result = new JSONObject().put("content", content);
            return buildSuccess(id, result);

        } catch (Exception e) {
            log.warn("MCP tool error [{}]: {}", toolName, e.getMessage());
            return buildError(id, -32603, "Tool error: " + e.getMessage());
        }
    }

    // -----------------------------------------------------------------------
    // Tool implementations
    // -----------------------------------------------------------------------

    private JSONObject toolGetGameState() {
        Game game = civServer.getGame();
        JSONObject result = new JSONObject();
        if (game == null) {
            result.put("status", "not_initialized");
            return result;
        }

        long humanCount = game.players.values().stream().filter(p -> !p.isAi()).count();
        long aiCount = game.players.values().stream().filter(Player::isAi).count();

        result.put("status", game.isGameStarted() ? "running" : "lobby");
        result.put("turn", game.turn);
        result.put("year", game.getHistoricalYear());
        result.put("phase", game.phase);
        result.put("multiplayer", game.isMultiplayer());
        result.put("human_players", humanCount);
        result.put("ai_players", aiCount);
        result.put("total_cities", game.cities.size());
        result.put("total_units", game.units.size());

        if (game.map != null) {
            result.put("map_xsize", game.map.getXsize());
            result.put("map_ysize", game.map.getYsize());
            result.put("topology_id", game.getTopologyId());
        }

        return result;
    }

    private JSONObject toolGetPlayers() {
        Game game = civServer.getGame();
        JSONArray players = new JSONArray();
        if (game != null) {
            for (Player p : game.players.values()) {
                JSONObject pj = new JSONObject();
                pj.put("id", p.getPlayerNo());
                pj.put("username", p.getUsername());
                pj.put("is_ai", p.isAi());
                pj.put("alive", p.isAlive());
                pj.put("nation_id", p.getNation());
                pj.put("gold", p.getGold());
                pj.put("science_rate", p.getScienceRate());
                pj.put("tax_rate", p.getTaxRate());
                pj.put("luxury_rate", p.getLuxuryRate());
                pj.put("government_id", p.getGovernmentId());
                pj.put("researching_tech_id", p.getResearchingTech());
                pj.put("known_techs_count", p.getKnownTechs().size());

                // Add nation name if available
                Nation nation = game.nations.get((long) p.getNation());
                if (nation != null) {
                    pj.put("nation_name", nation.getName());
                }

                // Add government name if available
                Government gov = game.governments.get((long) p.getGovernmentId());
                if (gov != null) {
                    pj.put("government_name", gov.getName());
                }

                players.put(pj);
            }
        }
        return new JSONObject().put("players", players);
    }

    private JSONObject toolGetCities() {
        Game game = civServer.getGame();
        JSONArray cities = new JSONArray();
        if (game != null) {
            for (Map.Entry<Long, City> entry : game.cities.entrySet()) {
                City c = entry.getValue();
                JSONObject cj = new JSONObject();
                cj.put("id", entry.getKey());
                cj.put("name", c.getName());
                cj.put("owner_id", c.getOwner());
                cj.put("tile_id", c.getTile());
                cj.put("size", c.getSize());
                cj.put("capital", c.isCapital());
                cj.put("happy", c.isHappy());
                cj.put("unhappy", c.isUnhappy());
                cj.put("production_kind", c.getProductionKind());
                cj.put("production_value", c.getProductionValue());
                cj.put("shield_stock", c.getShieldStock());
                cj.put("food_stock", c.getFoodStock());
                cj.put("improvements_count", c.getImprovements().size());

                // Add tile coordinates if available
                Tile tile = game.tiles.get(c.getTile());
                if (tile != null && game.map != null) {
                    cj.put("x", tile.getX(game.map.getXsize()));
                    cj.put("y", tile.getY(game.map.getXsize()));
                }

                cities.put(cj);
            }
        }
        return new JSONObject().put("cities", cities);
    }

    private JSONObject toolGetUnits() {
        Game game = civServer.getGame();
        JSONArray units = new JSONArray();
        if (game != null) {
            for (Map.Entry<Long, Unit> entry : game.units.entrySet()) {
                Unit u = entry.getValue();
                JSONObject uj = new JSONObject();
                uj.put("id", entry.getKey());
                uj.put("owner_id", u.getOwner());
                uj.put("type_id", u.getType());
                uj.put("tile_id", u.getTile());
                uj.put("hp", u.getHp());
                uj.put("veteran", u.getVeteran());
                uj.put("activity", u.getActivity());
                uj.put("moves_left", u.getMovesleft());
                uj.put("transported", u.isTransported());

                // Add unit type name if available
                UnitType utype = game.unitTypes.get((long) u.getType());
                if (utype != null) {
                    uj.put("type_name", utype.getName());
                    uj.put("domain", utype.getDomain());
                }

                // Add tile coordinates if available
                Tile tile = game.tiles.get(u.getTile());
                if (tile != null && game.map != null) {
                    uj.put("x", tile.getX(game.map.getXsize()));
                    uj.put("y", tile.getY(game.map.getXsize()));
                }

                units.put(uj);
            }
        }
        return new JSONObject().put("units", units);
    }

    private JSONObject toolGetRulesetInfo() {
        Game game = civServer.getGame();
        JSONObject result = new JSONObject();
        if (game == null) {
            return result.put("status", "not_initialized");
        }

        // Unit types
        JSONArray unitTypes = new JSONArray();
        for (Map.Entry<Long, UnitType> entry : game.unitTypes.entrySet()) {
            UnitType ut = entry.getValue();
            JSONObject utj = new JSONObject();
            utj.put("id", entry.getKey());
            utj.put("name", ut.getName());
            utj.put("attack", ut.getAttackStrength());
            utj.put("defense", ut.getDefenseStrength());
            utj.put("moves", ut.getMoveRate());
            utj.put("hp", ut.getHp());
            utj.put("domain", ut.getDomain());
            utj.put("cost", ut.getCost());
            utj.put("tech_req", ut.getTechReqName());
            unitTypes.put(utj);
        }
        result.put("unit_types", unitTypes);

        // Improvements (buildings)
        JSONArray improvements = new JSONArray();
        for (Map.Entry<Long, Improvement> entry : game.improvements.entrySet()) {
            Improvement imp = entry.getValue();
            JSONObject ij = new JSONObject();
            ij.put("id", entry.getKey());
            ij.put("name", imp.getName());
            ij.put("build_cost", imp.getBuildCost());
            ij.put("upkeep", imp.getUpkeep());
            ij.put("tech_req", imp.getTechReqName());
            improvements.put(ij);
        }
        result.put("improvements", improvements);

        // Technologies
        JSONArray techs = new JSONArray();
        for (Map.Entry<Long, Technology> entry : game.techs.entrySet()) {
            Technology t = entry.getValue();
            JSONObject tj = new JSONObject();
            tj.put("id", entry.getKey());
            tj.put("name", t.getName());
            tj.put("cost", t.getCost());
            tj.put("prereq1", t.getPrereq1());
            tj.put("prereq2", t.getPrereq2());
            techs.put(tj);
        }
        result.put("technologies", techs);

        // Governments
        JSONArray govs = new JSONArray();
        for (Map.Entry<Long, Government> entry : game.governments.entrySet()) {
            Government g = entry.getValue();
            JSONObject gj = new JSONObject();
            gj.put("id", entry.getKey());
            gj.put("name", g.getName());
            govs.put(gj);
        }
        result.put("governments", govs);

        return result;
    }

    private JSONObject toolGetSourceFiles() {
        JSONObject result = new JSONObject();

        result.put("main", new JSONArray()
                .put("Main.java")
                .put("HTTPStatusWebHandler.java")
                .put("McpHandler.java")
                .put("MetaserverClient.java")
                .put("AutoGame.java"));

        result.put("server", new JSONArray()
                .put("CivServer.java")
                .put("Packets.java")
                .put("CityHand.java")
                .put("UnitHand.java")
                .put("GameHand.java")
                .put("PlrHand.java")
                .put("MapHand.java")
                .put("ConnectHand.java")
                .put("DiplHand.java")
                .put("InfoTextHand.java")
                .put("CityTools.java")
                .put("UnitTools.java")
                .put("TechTools.java")
                .put("CityTurn.java")
                .put("Notify.java")
                .put("Score.java")
                .put("PacketUtils.java")
                .put("VisibilityHandler.java")
                .put("IGameServer.java"));

        result.put("game", new JSONArray()
                .put("Game.java")
                .put("Player.java")
                .put("Unit.java")
                .put("UnitType.java")
                .put("City.java")
                .put("CityStyle.java")
                .put("Tile.java")
                .put("WorldMap.java")
                .put("MapGenerator.java")
                .put("PathFinder.java")
                .put("Terrain.java")
                .put("Extra.java")
                .put("Government.java")
                .put("Nation.java")
                .put("Technology.java")
                .put("Improvement.java")
                .put("Connection.java")
                .put("Movement.java")
                .put("Combat.java")
                .put("Effects.java")
                .put("Actions.java")
                .put("Research.java")
                .put("Spaceship.java")
                .put("TurnTimer.java"));

        result.put("data", new JSONArray()
                .put("Ruleset.java")
                .put("SectionFile.java")
                .put("Section.java")
                .put("ScenarioLoader.java")
                .put("ScenarioData.java"));

        result.put("ai", new JSONArray()
                .put("AiPlayer.java")
                .put("AiCity.java")
                .put("AiMilitary.java")
                .put("AiSettler.java")
                .put("AiDiplomacy.java")
                .put("Barbarian.java"));

        result.put("log", new JSONArray()
                .put("GameLogger.java")
                .put("StdoutLogger.java"));

        result.put("description", "freecivx-server Java source files. "
                + "Use these file names to navigate the codebase. "
                + "All files are under src/main/java/net/freecivx/<package>/");

        return result;
    }

    // -----------------------------------------------------------------------
    // JSON-RPC helpers
    // -----------------------------------------------------------------------

    private static JSONObject buildSuccess(Object id, JSONObject result) {
        JSONObject resp = new JSONObject();
        resp.put("jsonrpc", "2.0");
        if (id != null) resp.put("id", id);
        resp.put("result", result);
        return resp;
    }

    private static JSONObject buildError(Object id, int code, String message) {
        JSONObject error = new JSONObject().put("code", code).put("message", message);
        JSONObject resp = new JSONObject();
        resp.put("jsonrpc", "2.0");
        if (id != null) resp.put("id", id);
        resp.put("error", error);
        return resp;
    }

    private static JSONObject toolDef(String name, String description, JSONObject inputSchema) {
        return new JSONObject()
                .put("name", name)
                .put("description", description)
                .put("inputSchema", inputSchema);
    }

    private void sendResponse(HttpExchange exchange, int statusCode, JSONObject body) throws IOException {
        byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
        exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }
}
