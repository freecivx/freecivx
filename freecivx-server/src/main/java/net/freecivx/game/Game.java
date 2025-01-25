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
        server.sendNationInfoAll(1, "Soviet", "Soviet");
        server.sendGameInfoAll();
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
        server.sendTileInfoAll();
        server.sendBordersServerSettingsAll();
        server.sendStartPhaseAll();
        server.sendMessageAll("Welcome to the Freecivx game!");


    }


}
