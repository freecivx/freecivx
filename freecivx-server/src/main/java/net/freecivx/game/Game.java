/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.FreecivWorld.net/
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


package net.freecivx.game;

import net.freecivx.server.CivServer;
import net.freecivx.ai.AiPlayer;
import org.json.JSONArray;

import java.util.HashMap;
import java.util.Map;
import java.util.Random;

/**
 * The Game class
 */
public class Game {

    CivServer server;

    public long year = 0;
    public long turn = 0;
    public long phase = 0;
    boolean gameStarted = false;

    private static final int MAX_START_POSITION_ATTEMPTS = 200;
    private long lastActivityTime = System.currentTimeMillis();
    private Random random = new Random();
    private AiPlayer aiPlayer;

    public WorldMap map;
    public Map<Long, Player> players = new HashMap<>();
    public Map<Long, Unit> units = new HashMap<>();
    public Map<Long, City> cities = new HashMap<>();
    public Map<Long, Technology> techs = new HashMap<>();
    public Map<Long, Improvement> improvements = new HashMap<>();
    public Map<Long, Terrain> terrains = new HashMap<>();
    public Map<Long, Tile> tiles = new HashMap<>();
    public Map<Long, Government> governments = new HashMap<>();
    public Map<Long, Nation> nations = new HashMap<>();
    public Map<Long, Extra> extras = new HashMap<>();
    public Map<Long, UnitType> unitTypes = new HashMap<>();
    public Map<Long, CityStyle> cityStyle = new HashMap<>();
    public Map<Long, Connection> connections = new HashMap<>();

    public Game(CivServer server) {
        this.server = server;
        this.aiPlayer = new AiPlayer(this);
    }

    /** Returns the {@link CivServer} instance this game is running on. */
    public CivServer getServer() {
        return server;
    }

    /**
     * Initializes the game objects with default or predefined values.
     */
    public void initGame() {
        map = new WorldMap(45, 45);

        // Initialize Technologies (10+) with prerequisite chains from classic ruleset
        techs.put(0L,  new Technology("Alphabet",          "a.alphabet",          "Alphabet",          "None",         "None",           20));
        techs.put(1L,  new Technology("Mathematics",       "a.mathematics",       "Mathematics",       "Alphabet",     "None",           40));
        techs.put(2L,  new Technology("The Republic",      "a.the_republic",      "The Republic",      "Code of Laws", "None",           60));
        techs.put(3L,  new Technology("Masonry",           "a.masonry",           "Masonry",           "None",         "None",           20));
        techs.put(4L,  new Technology("Bronze Working",    "a.bronze_working",    "Bronze Working",    "None",         "None",           20));
        techs.put(5L,  new Technology("Iron Working",      "a.iron_working",      "Iron Working",      "Bronze Working","None",          40));
        techs.put(6L,  new Technology("The Wheel",         "a.the_wheel",         "The Wheel",         "None",         "None",           20));
        techs.put(7L,  new Technology("Writing",           "a.writing",           "Writing",           "Alphabet",     "None",           40));
        techs.put(8L,  new Technology("Code of Laws",      "a.code_of_laws",      "Code of Laws",      "Alphabet",     "None",           40));
        techs.put(9L,  new Technology("Horseback Riding",  "a.horseback_riding",  "Horseback Riding",  "None",         "None",           20));
        techs.put(10L, new Technology("Pottery",           "a.pottery",           "Pottery",           "None",         "None",           20));
        techs.put(11L, new Technology("Warrior Code",      "a.warrior_code",      "Warrior Code",      "None",         "None",           20));
        techs.put(12L, new Technology("Map Making",        "a.map_making",        "Map Making",        "Alphabet",     "None",           40));
        techs.put(13L, new Technology("Monarchy",          "a.monarchy",          "Monarchy",          "Code of Laws", "None",           60));
        techs.put(14L, new Technology("Democracy",         "a.democracy",         "Democracy",         "The Republic", "None",           80));
        techs.put(15L, new Technology("Communism",         "a.communism",         "Communism",         "Philosophy",   "None",           80));

        // Initialize Governments with tech prerequisites and corruption percentages
        // (mirrors classic ruleset: Anarchy/Despotism need no tech; others require specific advances)
        governments.put(0L, new Government("Anarchy",    "Anarchy",    "Anarchy",    null,         30));
        governments.put(1L, new Government("Despotism",  "Despotism",  "Despotism",  null,         20));
        governments.put(2L, new Government("Monarchy",   "Monarchy",   "Monarchy",   "Monarchy",   10));
        governments.put(3L, new Government("Communism",  "Communism",  "Communism",  "Communism",  15));
        governments.put(4L, new Government("Republic",   "Republic",   "Republic",   "The Republic", 5));
        governments.put(5L, new Government("Democracy",  "Democracy",  "Democracy",  "Democracy",   0));

        // Initialize Nations
        nations.put(0L, new Nation("Soviet Union", "Soviet", "soviet", "The Soviets!"));
        nations.put(1L, new Nation("France", "French", "france", "Vive La France!"));
        nations.put(2L, new Nation("Germany", "German", "germany", "Deutschland"));

        // Initialize Extras
        extras.put(0L, new Extra("River"));
        extras.put(1L, new Extra("Mine"));
        extras.put(2L, new Extra("Oil_well"));
        extras.put(3L, new Extra("Fallout"));
        extras.put(4L, new Extra("Pollution"));
        extras.put(5L, new Extra("Buoy"));
        extras.put(6L, new Extra("Road"));
        extras.put(7L, new Extra("Rail"));
        extras.put(8L, new Extra("Hut"));
        extras.put(9L, new Extra("Irrigation"));
        extras.put(10L, new Extra("Farmland"));
        extras.put(11L, new Extra("Ruins"));
        extras.put(12L, new Extra("Airbase"));
        extras.put(13L, new Extra("Airport"));
        extras.put(14L, new Extra("Fortress"));


        // Initialize Terrains with defence bonuses from classic terrain ruleset
        // (defense_bonus values: Forest=50, Hills=100, Jungle=50, Mountains=200, Swamp=50)
        terrains.put(0L,  new Terrain("Arctic",       "",       0,   1));
        terrains.put(1L,  new Terrain("Lake",         "lake",   0,   1));
        terrains.put(2L,  new Terrain("Ocean",        "floor",  0,   1));
        terrains.put(3L,  new Terrain("Deep Ocean",   "coast",  0,   1));
        terrains.put(4L,  new Terrain("Glacier",      "",       0,   2));
        terrains.put(5L,  new Terrain("Desert",       "",       0,   1));
        terrains.put(6L,  new Terrain("Forest",       "",      50,   2));
        terrains.put(7L,  new Terrain("Grassland",    "",       0,   1));
        terrains.put(8L,  new Terrain("Hills",        "",     100,   2));
        terrains.put(9L,  new Terrain("Jungle",       "",      50,   2));
        terrains.put(10L, new Terrain("Mountains",    "",     200,   3));
        terrains.put(11L, new Terrain("Plains",       "",       0,   1));
        terrains.put(12L, new Terrain("Swamp",        "",      50,   2));
        terrains.put(13L, new Terrain("Tundra",       "",       0,   1));
        terrains.put(14L, new Terrain("Inaccessible", "",       0,  99));


        // Initialize UnitTypes (10+)
        // utype_actions: 120-bit binary string representing unit action availability flags.
        // Each bit enables a specific unit action (e.g. move, build city, fortify, sentry, etc.).
        // See freeciv/common/actions.h and the PACKET_WEB_RULESET_UNIT_ADDITION packet.
        String defaultActions  = "000000000000000000000000000010000000001110001000000000000011011111111001100011000000001100110000000000000000100100000000";
        String settlerActions  = "000000000000000000000000000110000000001110001000000000000011011111111001100011000000001100110000000000000000100100000000";
        unitTypes.put(0L, new UnitType("Settlers", "u.settlers", 1, 1, 1, "Settlers unit", 0, 1, settlerActions, 0));
        unitTypes.put(1L, new UnitType("Workers", "u.worker", 1, 1, 1, "Workers unit", 0, 1, settlerActions, 0));
        unitTypes.put(2L, new UnitType("Explorer", "u.explorer", 3, 1, 1, "Explorer unit", 0, 1, defaultActions, 0));
        unitTypes.put(3L, new UnitType("Warriors", "u.warriors", 1, 10, 1, "Warriors", 1, 1, defaultActions, 0));
        unitTypes.put(4L, new UnitType("Horsemen", "u.horsemen", 3, 10, 1, "Horsemen", 2, 1, defaultActions, 0));
        unitTypes.put(5L, new UnitType("Archers", "u.archers", 1, 10, 1, "Archers", 3, 2, defaultActions, 0));
        unitTypes.put(6L, new UnitType("Legion", "u.legion", 1, 20, 1, "Legion", 3, 3, defaultActions, 0));
        unitTypes.put(7L, new UnitType("Pikemen", "u.pikemen", 1, 10, 1, "Pikemen", 1, 2, defaultActions, 0));
        unitTypes.put(8L, new UnitType("Musketeers", "u.musketeers", 1, 20, 1, "Musketeers", 5, 4, defaultActions, 0));
        unitTypes.put(9L, new UnitType("Catapult", "u.catapult", 1, 10, 1, "Catapult", 6, 1, defaultActions, 0));
        unitTypes.put(10L, new UnitType("Chariot", "u.chariot", 3, 10, 1, "Chariot", 3, 1, defaultActions, 0));
        unitTypes.put(11L, new UnitType("Knight", "u.knights", 3, 20, 1, "Knight", 5, 2, defaultActions, 0));




        // Initialize City Styles
        cityStyle.put(0L, new CityStyle("European"));
        cityStyle.put(1L, new CityStyle("Classical"));
        cityStyle.put(2L, new CityStyle("Tropical"));
        cityStyle.put(3L, new CityStyle("Asian"));

        // Initialize Improvements (city buildings) - 10+
        // genus: 2 = Improvement, 1 = SmallWonder, 0 = GreatWonder
        improvements.put(0L,  new Improvement(0,  "Palace",      "Palace",      "b.palace",      "b.fallback", 1, 100, 0, 0, "b_palace",      "b_fallback", "The Palace", -1));
        improvements.put(1L,  new Improvement(1,  "Barracks",    "Barracks",    "b.barracks",    "b.fallback", 2,  40, 1, 0, "b_barracks",    "b_fallback", "The Barracks", 3));
        improvements.put(2L,  new Improvement(2,  "Granary",     "Granary",     "b.granary",     "b.fallback", 2,  60, 1, 0, "b_granary",     "b_fallback", "The Granary", 10));
        improvements.put(3L,  new Improvement(3,  "Library",     "Library",     "b.library",     "b.fallback", 2,  80, 1, 0, "b_library",     "b_fallback", "The Library", 7));
        improvements.put(4L,  new Improvement(4,  "Marketplace", "Marketplace", "b.marketplace", "b.fallback", 2, 100, 1, 0, "b_marketplace", "b_fallback", "The Marketplace", 8));
        improvements.put(5L,  new Improvement(5,  "Bank",        "Bank",        "b.bank",        "b.fallback", 2, 120, 2, 0, "b_bank",        "b_fallback", "The Bank", 1));
        improvements.put(6L,  new Improvement(6,  "Temple",      "Temple",      "b.temple",      "b.fallback", 2,  30, 1, 0, "b_temple",      "b_fallback", "The Temple", 0));
        improvements.put(7L,  new Improvement(7,  "City Walls",  "City_Walls",  "b.city_walls",  "b.fallback", 2,  60, 0, 0, "b_city_walls",  "b_fallback", "City Walls", 3));
        improvements.put(8L,  new Improvement(8,  "Aqueduct",    "Aqueduct",    "b.aqueduct",    "b.fallback", 2, 120, 2, 0, "b_aqueduct",    "b_fallback", "The Aqueduct", 3));
        improvements.put(9L,  new Improvement(9,  "Courthouse",  "Courthouse",  "b.courthouse",  "b.fallback", 2,  80, 1, 0, "b_courthouse",  "b_fallback", "The Courthouse", 8));
        improvements.put(10L, new Improvement(10, "Harbor",      "Harbor",      "b.port",        "b.fallback", 2,  60, 1, 0, "b_harbor",      "b_fallback", "The Harbor", 12));
        improvements.put(11L, new Improvement(11, "Colosseum",   "Colosseum",   "b.colosseum",   "b.fallback", 2, 100, 4, 0, "b_colosseum",   "b_fallback", "The Colosseum", 4));
        improvements.put(12L, new Improvement(12, "Cathedral",   "Cathedral",   "b.cathedral",   "b.fallback", 2, 120, 3, 0, "b_cathedral",   "b_fallback", "The Cathedral", 6));


        MapGenerator generator = new MapGenerator(map.getXsize(), map.getYsize());
        tiles = generator.generateMap();
    }


    /**
     * Starts a new game and sends the initialized game state to all players.
     */
    public void startGame() {
        if (gameStarted) {
            server.sendMessageAll("Game already started.");
            return;
        }
        gameStarted = true;
        server.sendMessageAll("Starting new game.");

        server.sendCalendarInfoAll();
        server.sendMapInfoAll(map.getXsize(), map.getYsize());
        server.sendGameInfoAll(year, turn, phase);
        server.sendRulesetControl(improvements.size());

        // Send technologies
        techs.forEach((id, tech) -> server.sendTechAll(id, -1, tech.getName(), new JSONArray(), tech.getGraphicsStr(), tech.getHelptext()));

        // Send governments
        governments.forEach((id, gov) -> server.sendRuleseGovernmentAll(id, gov.getName(), gov.getRuleName(), gov.getHelptext()));

        // Send nations
        nations.forEach((id, nation) -> server.sendNationInfoAll(id, nation.getName(), nation.getAdjective(), nation.getGraphicsStr(), nation.getLegend()));

        // Send extras (with correct id)
        extras.forEach((id, extra) -> server.sendExtrasInfoAll(id, extra.getName()));

        // Send terrains
        terrains.forEach((id, terrain) -> server.sendTerrainInfoAll(id, terrain.getName(), terrain.getGraphicsStr()));

        // Send unit types
        unitTypes.forEach((id, unitType) -> server.sendRulesetUnitAll(id, unitType));
        unitTypes.forEach((id, unitType) -> server.sendRulesetUnitWebAdditionAll(id, unitType));

        // Send all action ruleset data to fix "Asked for non existing action" JS errors
        server.sendRulesetActionsAll();

        // Send improvements (buildings)
        improvements.forEach((id, impr) -> server.sendRulesetBuildingAll(impr));

        tiles.forEach((id, tile) -> server.sendTileInfoAll(tile));

        // Create 4 AI players (aifill 5 = up to 5 total players including humans)
        String[] aiNames = {"Caesar", "Alexander", "Napoleon", "Genghis"};
        for (int i = 0; i < 4; i++) {
            long aiId = 1000L + i;
            Player aiPlayer = new Player(aiId, aiNames[i], "ai", i % nations.size());
            aiPlayer.setAi(true);
            players.put(aiId, aiPlayer);
        }
        players.forEach((id, iplayer) -> server.sendPlayerInfoAll(iplayer));
        players.forEach((id, iplayer) -> server.sendPlayerInfoAdditionAll(id, 0));

        // Initialize Units for all players
        for (Player player : players.values()) {
            long startPos = findStartPosition();
            spawnStartingUnits(player, startPos);
        }
        // Send units
        units.forEach((id, unit) -> server.sendUnitAll(unit));

        // Send city styles
        cityStyle.forEach((id, style) -> server.sendRulesetCityInfoAll(id, style.getName(), style.getName()));

        // Send cities
        cities.forEach((id, city) -> {
            server.sendCityShortInfoAll(id, city.getOwner(), city.getTile(), city.getSize(), city.getStyle(), city.isCapital(),
                    city.isOccupied(), city.getWalls(), city.isHappy(), city.isUnhappy(), "", city.getName());
            server.sendCityInfoAll(id, city.getOwner(), city.getTile(), city.getSize(), city.getStyle(), city.isCapital(),
                    city.isOccupied(), city.getWalls(), city.isHappy(), city.isUnhappy(), "", city.getName(), 6, 0);
        });


        server.sendBordersServerSettingsAll();

        server.sendStartPhaseAll();
        server.sendBeginTurnAll();

        server.sendMessageAll("Welcome to the Freecivx game!");
    }


    public boolean isGameStarted() {
        return gameStarted;
    }

    public void updateLastActivity() {
        lastActivityTime = System.currentTimeMillis();
    }

    public long getLastActivityTime() {
        return lastActivityTime;
    }

    public int getConnectedPlayerCount() {
        return connections.size();
    }

    public void turnDone() {
        year++;
        turn++;

        // Reset movement points for all units
        units.forEach((id, unit) -> {
            UnitType utype = unitTypes.get((long) unit.getType());
            if (utype != null) {
                unit.setMovesleft(utype.getMoveRate());
                unit.setDoneMoving(false);
            }
        });

        // Process end-of-turn city updates: growth, production, economy, research.
        // Mirrors update_city_activities() in the C Freeciv server's cityturn.c.
        net.freecivx.server.CityTurn.updateAllCities(this);

        // Run AI turns (executed in the dedicated AI thread)
        aiPlayer.runAiTurns();

        server.sendGameInfoAll(year, turn, phase);
        server.sendMessageAll("Turn " + turn + " has started (Year " + (4000 + year * 20) + " BC).");
        server.sendBeginTurnAll();
        server.sendStartPhaseAll();
    }

    public void changeUnitActivity(long unit_id, int activity) {
        Unit unit = units.get(unit_id);
        if (unit == null) return;
        unit.setActivity(activity);
        server.sendUnitAll(unit);
    }

    public boolean moveUnit(long unit_id, int dest_tile, int dir) {
        Unit unit = units.get(unit_id);
        if (unit == null) return false;

        // Enforce movement limits
        if (unit.getMovesleft() <= 0) return false;

        // Terrain check: land units cannot enter ocean tiles (terrain 2=Ocean, 3=Deep Ocean)
        UnitType utype = unitTypes.get((long) unit.getType());
        if (utype != null && utype.getDomain() == 0) {
            Tile destTile = tiles.get((long) dest_tile);
            if (destTile != null) {
                int terrain = destTile.getTerrain();
                if (terrain == 2 || terrain == 3) return false;
            }
        }

        // Check for enemy units on the destination tile — trigger combat instead
        // of moving (mirrors unithand.c: moving onto an enemy initiates an attack).
        for (Unit other : units.values()) {
            if (other.getTile() == dest_tile && other.getOwner() != unit.getOwner()) {
                unit.setFacing(dir);
                return attackUnit(unit_id, other.getId());
            }
        }

        unit.setTile(dest_tile);
        unit.setFacing(dir);
        unit.setMovesleft(Math.max(0, unit.getMovesleft() - 1));
        server.sendUnitAll(unit);
        return true;
    }

    public void addPlayer(long connId, String username, String addr) {
        Player player = new Player(connId, username, addr, random.nextInt(3));
        players.put(connId, player);
        server.sendMessageAll(username + " has joined the game.");

        players.forEach((id, iplayer) -> server.sendPlayerInfoAll(iplayer));
        players.forEach((id, iplayer) -> server.sendPlayerInfoAdditionAll(id, 0));

        connections.forEach((id, conn) -> server.sendConnInfoAll(id, conn.getUsername(), conn.getIp(), conn.getPlayerNo()));
    }

    public void addConnection(long connId, String username, long player_no, String address) {
        Connection connection = new Connection(connId, username, player_no, address);
        connections.put(connId, connection);
    }

    private long findStartPosition() {
        long startPos = 0;
        for (int i = 0; i < MAX_START_POSITION_ATTEMPTS; i++) {
            startPos = random.nextInt(map.getXsize() * map.getYsize());
            Tile startTile = tiles.get(startPos);
            if (startTile != null && startTile.getTerrain() == 7 && startTile.getWorked() < 0) {
                break;
            }
        }
        return startPos;
    }

    private void spawnStartingUnits(Player player, long startPos) {
        UnitType settlerType = unitTypes.get(0L);
        int moveRate = settlerType != null ? settlerType.getMoveRate() : 1;
        units.put((long) units.size(), new Unit(units.size(), player.getPlayerNo(), startPos, 0, 0, 1, 1, 0, moveRate));
        units.put((long) units.size(), new Unit(units.size(), player.getPlayerNo(), startPos, 1, 0, 1, 1, 0, 1));
        units.put((long) units.size(), new Unit(units.size(), player.getPlayerNo(), startPos, 3, 0, 1, 10, 0, 1));
        units.put((long) units.size(), new Unit(units.size(), player.getPlayerNo(), startPos, 4, 0, 1, 10, 0, 3));
        units.put((long) units.size(), new Unit(units.size(), player.getPlayerNo(), startPos, 2, 0, 1, 1, 0, 3));
    }

    /**
     * Resolves an attack from one unit against another.
     * Uses {@link Combat#resolveCombat} to determine the outcome, applying
     * unit-type attack/defence strengths and terrain bonuses (mirrors
     * {@code do_unit_attack_tiles} in the C server's {@code server/unittools.c}).
     * The loser is removed from the game and a {@code PACKET_UNIT_REMOVE}
     * broadcast is sent; the winner's updated HP is broadcast to all clients.
     *
     * @param attackerId ID of the attacking unit
     * @param defenderId ID of the defending unit
     * @return {@code true} if the attacker wins (defender is destroyed)
     */
    public boolean attackUnit(long attackerId, long defenderId) {
        Unit attacker = units.get(attackerId);
        Unit defender = units.get(defenderId);
        if (attacker == null || defender == null) return false;
        if (!Combat.canUnitAttack(attacker, defender)) return false;

        UnitType attackerType = unitTypes.get((long) attacker.getType());
        UnitType defenderType = unitTypes.get((long) defender.getType());
        Tile defenderTile = tiles.get(defender.getTile());

        boolean attackerWins = Combat.resolveCombat(attacker, attackerType,
                                                    defender, defenderType,
                                                    defenderTile);

        // Consume one move point for the attack
        attacker.setMovesleft(Math.max(0, attacker.getMovesleft() - 1));

        if (attackerWins) {
            units.remove(defenderId);
            server.sendUnitRemove(defenderId);
            server.sendUnitAll(attacker);
        } else {
            units.remove(attackerId);
            server.sendUnitRemove(attackerId);
            server.sendUnitAll(defender);
        }
        return attackerWins;
    }

    public void buildCity(long unit_id, String city_name, long tile_id) {
        Unit unit = units.get(unit_id);
        if (unit == null) return;

        long id = cities.size() + 1;
        long owner = unit.getOwner();
        City city = new City(city_name, owner, tile_id, 1, 1, false, false,
                0, true, false, "", 6, 0);
        cities.put(id, city);

        Tile tile = tiles.get(tile_id);
        tile.setWorked(id);
        server.sendTileInfoAll(tile);

        server.sendCityShortInfoAll(id, city.getOwner(), city.getTile(), city.getSize(), city.getStyle(), city.isCapital(),
                city.isOccupied(), city.getWalls(), city.isHappy(), city.isUnhappy(), "", city.getName());

        server.sendCityInfoAll(id, city.getOwner(), city.getTile(), city.getSize(), city.getStyle(), city.isCapital(),
                city.isOccupied(), city.getWalls(), city.isHappy(), city.isUnhappy(), "", city.getName(), 6, 0);
        server.sendUnitRemove(unit_id);
        units.remove(unit_id);
    }

    public void syncNewPlayer(long connId) {
        Player player = players.get(connId);
        if (player == null) return;

        // Spawn starting units for the late joiner
        long startPos = findStartPosition();
        spawnStartingUnits(player, startPos);

        // Send full current game state to just this player
        server.sendGameStateTo(connId);

        // Broadcast the new player's units to all existing players
        units.values().stream()
                .filter(u -> u.getOwner() == player.getPlayerNo())
                .forEach(u -> server.sendUnitAll(u));

        server.sendMessage(connId, "Welcome! The game is in progress (turn " + turn + ").");
        server.sendMessageAll(player.getUsername() + " has joined the game in progress.");
    }
}
