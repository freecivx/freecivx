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
import org.json.JSONArray;

import java.util.HashMap;
import java.util.Map;
import java.util.Random;

/**
 * The Game class
 */
public class Game {

    CivServer server;

    long year = 0;
    long turn = 0;
    long phase = 0;
    boolean gameStarted = false;

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
    }

    /**
     * Initializes the game objects with default or predefined values.
     */
    public void initGame() {
        map = new WorldMap(45, 45);

        // Initialize Technologies (10+)
        techs.put(0L, new Technology("Alphabet", "a.alphabet", "Alphabet"));
        techs.put(1L, new Technology("Mathematics", "a.mathematics", "Mathematics"));
        techs.put(2L, new Technology("The Republic", "a.the_republic", "The Republic"));
        techs.put(3L, new Technology("Masonry", "a.masonry", "Masonry"));
        techs.put(4L, new Technology("Bronze Working", "a.bronze_working", "Bronze Working"));
        techs.put(5L, new Technology("Iron Working", "a.iron_working", "Iron Working"));
        techs.put(6L, new Technology("The Wheel", "a.the_wheel", "The Wheel"));
        techs.put(7L, new Technology("Writing", "a.writing", "Writing"));
        techs.put(8L, new Technology("Code of Laws", "a.code_of_laws", "Code of Laws"));
        techs.put(9L, new Technology("Horseback Riding", "a.horseback_riding", "Horseback Riding"));
        techs.put(10L, new Technology("Pottery", "a.pottery", "Pottery"));
        techs.put(11L, new Technology("Warrior Code", "a.warrior_code", "Warrior Code"));
        techs.put(12L, new Technology("Map Making", "a.map_making", "Map Making"));

        // Initialize Governments
        governments.put(0L, new Government("Anarchy", "Anarchy", "Anarchy"));
        governments.put(1L, new Government("Despotism", "Despotism", "Despotism"));
        governments.put(2L, new Government("Monarchy", "Monarchy", "Monarchy"));
        governments.put(3L, new Government("Communism", "Communism", "Communism"));
        governments.put(4L, new Government("Republic", "Republic", "Republic"));
        governments.put(5L, new Government("Democracy", "Democracy", "Democracy"));

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


        // Initialize Terrains
        terrains.put(0L, new Terrain("Arctic", ""));
        terrains.put(1L, new Terrain("Lake", "lake"));
        terrains.put(2L, new Terrain("Ocean", "floor"));
        terrains.put(3L, new Terrain("Deep Ocean", "coast"));
        terrains.put(4L, new Terrain("Glacier", ""));
        terrains.put(5L, new Terrain("Desert", ""));
        terrains.put(6L, new Terrain("Forest", ""));
        terrains.put(7L, new Terrain("Grassland", ""));
        terrains.put(8L, new Terrain("Hills", ""));
        terrains.put(9L, new Terrain("Jungle", ""));
        terrains.put(10L, new Terrain("Mountains", ""));
        terrains.put(11L, new Terrain("Plains", ""));
        terrains.put(12L, new Terrain("Swamp", ""));
        terrains.put(13L, new Terrain("Tundra", ""));
        terrains.put(14L, new Terrain("Inaccessible", ""));


        // Initialize UnitTypes (10+)
        // utype_actions: 120-bit binary string representing unit action availability flags.
        // Each bit enables a specific unit action (e.g. move, build city, fortify, sentry, etc.).
        // See freeciv/common/actions.h and the PACKET_WEB_RULESET_UNIT_ADDITION packet.
        String defaultActions  = "000000000000000000000000000010000000001110001000000000000011011111111001100011000000001100110000000000000000100100000000";
        String settlerActions  = "000000000000000000000000000110000000001110001000000000000011011111111001100011000000001100110000000000000000100100000000";
        unitTypes.put(0L, new UnitType("Settlers", "u.settlers", 1, 1, 1, "Settlers unit", 0, 1, settlerActions));
        unitTypes.put(1L, new UnitType("Workers", "u.worker", 1, 1, 1, "Workers unit", 0, 1, settlerActions));
        unitTypes.put(2L, new UnitType("Explorer", "u.explorer", 3, 1, 1, "Explorer unit", 0, 1, defaultActions));
        unitTypes.put(3L, new UnitType("Warriors", "u.warriors", 1, 10, 1, "Warriors", 1, 1, defaultActions));
        unitTypes.put(4L, new UnitType("Horsemen", "u.horsemen", 3, 10, 1, "Horsemen", 2, 1, defaultActions));
        unitTypes.put(5L, new UnitType("Archers", "u.archers", 1, 10, 1, "Archers", 3, 2, defaultActions));
        unitTypes.put(6L, new UnitType("Legion", "u.legion", 1, 20, 1, "Legion", 3, 3, defaultActions));
        unitTypes.put(7L, new UnitType("Pikemen", "u.pikemen", 1, 10, 1, "Pikemen", 1, 2, defaultActions));
        unitTypes.put(8L, new UnitType("Musketeers", "u.musketeers", 1, 20, 1, "Musketeers", 5, 4, defaultActions));
        unitTypes.put(9L, new UnitType("Catapult", "u.catapult", 1, 10, 1, "Catapult", 6, 1, defaultActions));
        unitTypes.put(10L, new UnitType("Chariot", "u.chariot", 3, 10, 1, "Chariot", 3, 1, defaultActions));
        unitTypes.put(11L, new UnitType("Knight", "u.knights", 3, 20, 1, "Knight", 5, 2, defaultActions));




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

        // Send improvements (buildings)
        improvements.forEach((id, impr) -> server.sendRulesetBuildingAll(impr));

        tiles.forEach((id, tile) -> server.sendTileInfoAll(tile));

        // Initialize Units
        for (Player player : players.values()) {
            long startPos = 0;
            for (var i = 0; i < 100; i++) {
                startPos = new Random().nextInt(map.getXsize() * map.getYsize());
                Tile startTile = tiles.get(startPos);
                if (startTile.getTerrain() == 7) {
                    break;
                }
            }
            units.put(Long.valueOf(units.size()), new Unit(units.size(), player.getPlayerNo(), startPos , 0, 0, 1, 1, 0, 2));
            units.put(Long.valueOf(units.size()), new Unit(units.size(),  player.getPlayerNo(), startPos, 1, 0, 1, 1, 0, 2));
            units.put(Long.valueOf(units.size()), new Unit(units.size(),  player.getPlayerNo(),  startPos, 2, 0, 1, 1, 0, 2));
            units.put(Long.valueOf(units.size()), new Unit(units.size(),  player.getPlayerNo(),  startPos, 3, 0, 1, 1, 0, 2));
            units.put(Long.valueOf(units.size()), new Unit(units.size(),  player.getPlayerNo(),  startPos, 4, 0, 1, 1, 0, 2));
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


    public void turnDone() {
        year++;
        turn++;

        server.sendGameInfoAll(year, turn, phase);
        server.sendBeginTurnAll();
        server.sendStartPhaseAll();
    }

    public void changeUnitActivity(long unit_id, int activity) {
        Unit unit = units.get(unit_id);
        if (unit == null) return;
        unit.setActivity(activity);
        server.sendUnitAll(unit);
    }

    public void moveUnit(long unit_id, int dest_tile, int dir) {
        Unit unit = units.get(unit_id);
        unit.setTile(dest_tile);
        unit.setFacing(dir);
        server.sendUnitAll(unit);
    }

    public void addPlayer(long connId, String username, String addr) {
        Player player = new Player(connId, username, addr, new Random().nextInt(3));
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
}
