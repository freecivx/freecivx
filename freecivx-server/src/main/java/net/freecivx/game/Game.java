package net.freecivx.game;

import net.freecivx.server.CivServer;

/**
 * The Game class
 */
public class Game {

    CivServer server;

    public Game (CivServer server) {
        this.server = server;
    }

    /**
     * Starts a new game
     */
    public void startGame()
    {
        server.sendMessageAll("Starting new game.");
        server.sendNationInfoAll(1, "Soviet", "Soviet", "soviet");
        server.sendNationInfoAll(2, "French", "French", "french");
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
        server.sendTerrainInfoAll(0, "Inaccessible");
        server.sendTerrainInfoAll(1, "Lake");
        server.sendTerrainInfoAll(2, "Coast");
        server.sendTerrainInfoAll(3, "Floor");
        server.sendTerrainInfoAll(4, "Arctic");
        server.sendTerrainInfoAll(5, "Desert");
        server.sendTerrainInfoAll(6, "Forest");
        server.sendTerrainInfoAll(7, "Grassland");
        server.sendTerrainInfoAll(8, "Hills");
        server.sendTerrainInfoAll(9, "Jungle");
        server.sendTerrainInfoAll(10, "Mountains");
        server.sendTerrainInfoAll(11, "Plains");
        server.sendTerrainInfoAll(12, "Swamp");
        server.sendTerrainInfoAll(13, "Tundra");
        server.sendRulesetUnitAll(0, "Settlers", "u.settlers", 1, 1, 1, "Settlers unit", 0, 1 );
        server.sendRulesetUnitAll(1, "Workers", "u.worker", 1, 1, 1, "Workers unit", 0, 1 );
        server.sendRulesetUnitAll(2, "Explorer", "u.explorer", 3, 1, 1, "Explorer unit", 0, 1 );
        server.sendUnitAll(0, 0, 100, 0, 0, 1, 1, 0);
        server.sendUnitAll(1, 0, 100, 1, 0, 1, 1, 0);
        server.sendUnitAll(2, 0, 100, 2, 0, 1, 1, 0);
        server.sendRulesetCityInfoAll(0, "European", "European");
        server.sendRulesetCityInfoAll(1, "Classical", "Classical");
        server.sendRulesetCityInfoAll(2, "Tropical", "Tropical");
        server.sendRulesetCityInfoAll(3, "Asian", "Asian");
        server.sendCityShortInfoAll(0, 0, 102, 1, 1, true, false, 0, true, false, "", "Trondheim");
        server.sendCityInfoAll(0, 0, 102, 1, 1, true, false, 0, true, false, "", "Trondheim", 6, 0);
        server.sendTileInfoAll();
        server.sendBordersServerSettingsAll();
        server.sendStartPhaseAll();
        server.sendMessageAll("Welcome to the Freecivx game!");


    }


}
