/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.Freecivx.net/
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

import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import net.freecivx.server.CivServer;
import org.json.JSONArray;

/** The Game class */
public class Game {

  CivServer server;

  long year = 0;
  long turn = 0;
  long phase = 0;

  public WorldMap map;
  public Map<Long, Player> players = new HashMap<>();
  public Map<Long, Unit> units = new HashMap<>();
  public Map<Long, City> cities = new HashMap<>();
  public Map<Long, Technology> techs = new HashMap<>();
  public Map<Long, Terrain> terrains = new HashMap<>();
  public Map<Long, Tile> tiles = new HashMap<>();
  public Map<Long, Government> governments = new HashMap<>();
  public Map<Long, Nation> nations = new HashMap<>();
  public Map<Long, Extra> extras = new HashMap<>();
  public Map<Long, UnitType> unitTypes = new HashMap<>();
  public Map<Long, CityStyle> cityStyle = new HashMap<>();

  public Game(CivServer server) {
    this.server = server;
  }

  /** Initializes the game objects with default or predefined values. */
  public void initGame() {
    map = new WorldMap(40, 40);

    // Initialize Technologies
    techs.put(0L, new Technology("Alphabet", "a.alphabet", "Alphabet"));
    techs.put(1L, new Technology("Mathematics", "a.mathematics", "Mathematics"));
    techs.put(2L, new Technology("The Republic", "a.the_republic", "The Republic"));

    // Initialize Governments
    governments.put(0L, new Government("Anarchy", "Anarchy", "Anarchy"));
    governments.put(1L, new Government("Despotism", "Despotism", "Despotism"));
    governments.put(2L, new Government("Monarchy", "Monarchy", "Monarchy"));
    governments.put(3L, new Government("Communism", "Communism", "Communism"));
    governments.put(4L, new Government("Republic", "Republic", "Republic"));
    governments.put(5L, new Government("Democracy", "Democracy", "Democracy"));

    // Initialize Nations
    nations.put(1L, new Nation("Soviet Union", "Soviet", "soviet", "The Soviets!"));
    nations.put(2L, new Nation("France", "French", "french", "Vive La France!"));

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

    // Initialize UnitTypes
    unitTypes.put(0L, new UnitType("Settlers", "u.settlers", 1, 1, 1, "Settlers unit", 0, 1));
    unitTypes.put(1L, new UnitType("Workers", "u.worker", 1, 1, 1, "Workers unit", 0, 1));
    unitTypes.put(2L, new UnitType("Explorer", "u.explorer", 3, 1, 1, "Explorer unit", 0, 1));

    // Initialize Cities
    cities.put(0L, new City("Trondheim", 0, 433, 1, 1, true, false, 0, true, false, "", 6, 0));

    // Initialize Units
    units.put(0L, new Unit(0, 0, 430, 0, 0, 1, 1, 0));
    units.put(1L, new Unit(1, 0, 431, 1, 0, 1, 1, 0));
    units.put(2L, new Unit(2, 0, 432, 2, 0, 1, 1, 0));

    // Initialize City Styles
    cityStyle.put(0L, new CityStyle("European"));
    cityStyle.put(1L, new CityStyle("Classical"));
    cityStyle.put(2L, new CityStyle("Tropical"));
    cityStyle.put(3L, new CityStyle("Asian"));

    for (int x = 0; x < map.getXsize(); x++) {
      for (int y = 0; y < map.getYsize(); y++) {
        long index = y * map.getXsize() + x;
        int terrain = new Random().nextInt(12) + 1;
        int height = 100;
        if (terrain == 1 || terrain == 2 || terrain == 3) {
          height = -100;
        }
        Tile tile = new Tile(index, 2, terrain, 1, 1, height);
        tiles.put(index, tile);
      }
    }
  }

  /** Starts a new game and sends the initialized game state to all players. */
  public void startGame() {
    server.sendMessageAll("Starting new game.");

    server.sendCalendarInfoAll();
    server.sendMapInfoAll(map.getXsize(), map.getYsize());
    server.sendGameInfoAll(year, turn, phase);

    // Send technologies
    techs.forEach(
        (id, tech) ->
            server.sendTechAll(
                id,
                -1,
                tech.getName(),
                new JSONArray(),
                tech.getGraphicsStr(),
                tech.getHelptext()));

    // Send governments
    governments.forEach(
        (id, gov) ->
            server.sendRuleseGovernmentAll(
                id, gov.getName(), gov.getRuleName(), gov.getHelptext()));

    // Send nations
    nations.forEach(
        (id, nation) ->
            server.sendNationInfoAll(
                id,
                nation.getName(),
                nation.getAdjective(),
                nation.getGraphicsStr(),
                nation.getLegend()));

    // Send extras
    extras.values().forEach(extra -> server.sendExtrasInfoAll(extra.getName()));

    // Send terrains
    terrains.forEach(
        (id, terrain) ->
            server.sendTerrainInfoAll(id, terrain.getName(), terrain.getGraphicsStr()));

    // Send unit types
    unitTypes.forEach(
        (id, unitType) ->
            server.sendRulesetUnitAll(
                id,
                unitType.getName(),
                unitType.getGraphicsStr(),
                unitType.getMoveRate(),
                unitType.getHp(),
                unitType.getVeteranLevels(),
                unitType.getHelptext(),
                unitType.getAttackStrength(),
                unitType.getDefenseStrength()));

    // Send units
    units.forEach((id, unit) -> server.sendUnitAll(unit));

    // Send city styles
    cityStyle.forEach(
        (id, style) -> server.sendRulesetCityInfoAll(id, style.getName(), style.getName()));

    // Send cities
    cities.forEach(
        (id, city) -> {
          server.sendCityShortInfoAll(
              id,
              city.getOwner(),
              city.getTile(),
              city.getSize(),
              city.getStyle(),
              city.isCapital(),
              city.isOccupied(),
              city.getWalls(),
              city.isHappy(),
              city.isUnhappy(),
              "",
              city.getName());
          server.sendCityInfoAll(
              id,
              city.getOwner(),
              city.getTile(),
              city.getSize(),
              city.getStyle(),
              city.isCapital(),
              city.isOccupied(),
              city.getWalls(),
              city.isHappy(),
              city.isUnhappy(),
              "",
              city.getName(),
              6,
              0);
        });

    // Send map and game settings
    tiles.forEach((id, tile) -> server.sendTileInfoAll(tile)); // TODO: Send all tiles as one call.

    server.sendBordersServerSettingsAll();
    server.sendBeginTurnAll();
    server.sendStartPhaseAll();

    server.sendMessageAll("Welcome to the Freecivx game!");
  }

  public void turnDone() {
    year++;
    turn++;

    server.sendGameInfoAll(year, turn, phase);
    server.sendBeginTurnAll();
    server.sendStartPhaseAll();
  }

  public void moveUnit(long unit_id, int dest_tile, int dir) {
    Unit unit = units.get(unit_id);
    unit.setTile(dest_tile);
    unit.setFacing(dir);
    server.sendUnitAll(unit);
  }

  public void addPlayer(long connId, String username, String addr) {
    Player player = new Player(connId, username, addr, 0);
    players.put(connId, player);
    server.sendMessage(connId, "Welcome " + username + ". Connected to Freecivx-server-java.");
    server.sendPlayerInfoAll(connId, username, username);
    server.sendPlayerInfoAdditionAll(player.getPlayerNo(), 0);
    server.sendConnInfoAll(connId, username, addr, player.getPlayerNo());
  }
}
