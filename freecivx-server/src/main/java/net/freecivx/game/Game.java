package net.freecivx.game;

import net.freecivx.server.CivServer;
import org.json.JSONArray;

import java.util.HashMap;
import java.util.Map;

/**
 * The Game class
 */
public class Game {

    CivServer server;

    public WorldMap map = new WorldMap();
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


    public Game (CivServer server) {
        this.server = server;
    }

    public void initGame() {

    }

    /**
     * Starts a new game
     */
    public void startGame()
    {
        server.sendMessageAll("Starting new game.");
        server.sendTechAll(0, -1, "Alphabet", new JSONArray(), "a.alphabet", "Alphabet");
        server.sendTechAll(1, -1, "Mathematics", new JSONArray(), "a.mathematics", "Mathematics");
        server.sendTechAll(2, -1, "The Republic", new JSONArray(), "a.the_republic", "The Republic");
        server.sendRuleseGovernmentAll(0, "Anarchy", "Anarchy", "Anarchy");
        server.sendRuleseGovernmentAll(1, "Despotism", "Despotism", "Despotism");
        server.sendRuleseGovernmentAll(2, "Monarchy", "Monarchy", "Monarchy");
        server.sendRuleseGovernmentAll(3, "Communism", "Communism", "Communism");
        server.sendRuleseGovernmentAll(4, "Republic", "Republic", "Republic");
        server.sendRuleseGovernmentAll(5, "Democracy", "Democracy", "Democracy");
        server.sendNationInfoAll(1, "Soviet", "Soviet", "soviet", "The Soviets!");
        server.sendNationInfoAll(2, "French", "French", "french", "Vive La France!");
        server.sendGameInfoAll();
        server.sendCalendarInfoAll();
        server.sendMapInfoAll();
        server.sendExtrasInfoAll("River");
        server.sendExtrasInfoAll("Mine");
        server.sendExtrasInfoAll("Oil_well");
        server.sendExtrasInfoAll("Fallout");
        server.sendExtrasInfoAll("Pollution");
        server.sendExtrasInfoAll("Buoy");
        server.sendExtrasInfoAll("Road");
        server.sendExtrasInfoAll("Rail");
        server.sendExtrasInfoAll("Hut");
        server.sendExtrasInfoAll("Irrigation");
        server.sendExtrasInfoAll("Farmland");
        server.sendExtrasInfoAll("Ruins");
        server.sendExtrasInfoAll("Airbase");
        server.sendExtrasInfoAll("Airport");
        server.sendExtrasInfoAll("Fortress");
        server.sendTerrainInfoAll(0, "Arctic", "");
        server.sendTerrainInfoAll(1, "Lake", "lake");
        server.sendTerrainInfoAll(2, "Ocean", "floor");
        server.sendTerrainInfoAll(3, "Deep Ocean", "coast");
        server.sendTerrainInfoAll(4, "Glacier", "");
        server.sendTerrainInfoAll(5, "Desert", "");
        server.sendTerrainInfoAll(6, "Forest", "");
        server.sendTerrainInfoAll(7, "Grassland", "");
        server.sendTerrainInfoAll(8, "Hills", "");
        server.sendTerrainInfoAll(9, "Jungle", "");
        server.sendTerrainInfoAll(10, "Mountains", "");
        server.sendTerrainInfoAll(11, "Plains", "");
        server.sendTerrainInfoAll(12, "Swamp", "");
        server.sendTerrainInfoAll(13, "Tundra", "");
        server.sendTerrainInfoAll(14, "Inaccessible", "");

        server.sendRulesetUnitAll(0, "Settlers", "u.settlers", 1, 1, 1, "Settlers unit", 0, 1 );
        server.sendRulesetUnitAll(1, "Workers", "u.worker", 1, 1, 1, "Workers unit", 0, 1 );
        server.sendRulesetUnitAll(2, "Explorer", "u.explorer", 3, 1, 1, "Explorer unit", 0, 1 );
        server.sendUnitAll(0, 0, 430, 0, 0, 1, 1, 0);
        server.sendUnitAll(1, 0, 431, 1, 0, 1, 1, 0);
        server.sendUnitAll(2, 0, 432, 2, 0, 1, 1, 0);
        server.sendRulesetCityInfoAll(0, "European", "European");
        server.sendRulesetCityInfoAll(1, "Classical", "Classical");
        server.sendRulesetCityInfoAll(2, "Tropical", "Tropical");
        server.sendRulesetCityInfoAll(3, "Asian", "Asian");
        server.sendCityShortInfoAll(0, 0, 433, 1, 1, true, false, 0, true, false, "", "Trondheim");
        server.sendCityInfoAll(0, 0, 433, 1, 1, true, false, 0, true, false, "", "Trondheim", 6, 0);
        server.sendTileInfoAll();
        server.sendBordersServerSettingsAll();
        server.sendStartPhaseAll();
        server.sendMessageAll("Welcome to the Freecivx game!");


    }


}
