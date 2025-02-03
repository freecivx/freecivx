package net.freecivx.client.game;

import net.freecivx.client.gui.MainWindow;

public class Game {
    private int gameState = 0;
    private MainWindow mainWindow;

    public Game(MainWindow mainWindow) {
        this.mainWindow = mainWindow;
    }

    public int getGameState() {
        return gameState;
    }

    public void setGameState(int gameState) {
        if (this.gameState == 0 && gameState == 1) {
            mainWindow.gameStarted();
        }
        this.gameState = gameState;
    }
}
