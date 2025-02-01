package net.freecivx.client.gui;

import com.jme3.math.Vector3f;
import com.jme3.scene.Node;
import com.simsilica.lemur.Button;
import com.simsilica.lemur.Container;

public class StartGameUI {
    private final Node guiNode;
    private final float camWidth;
    private final float camHeight;
    private final GameStartListener gameStartListener;
    private Container startButtonContainer;

    // Callback interface to notify when the game starts
    public interface GameStartListener {
        void onGameStart();
    }

    public StartGameUI(Node guiNode, float camWidth, float camHeight, GameStartListener gameStartListener) {
        this.guiNode = guiNode;
        this.camWidth = camWidth;
        this.camHeight = camHeight;
        this.gameStartListener = gameStartListener;
    }

    public void show() {
        startButtonContainer = new Container();

        Button startGameButton = new Button("START GAME");
        startGameButton.setFontSize(24); // Bigger text
        startGameButton.setPreferredSize(new Vector3f(250, 80, 1)); // Larger button
        startGameButton.addClickCommands(source -> startGame());

        startButtonContainer.addChild(startGameButton);
        startButtonContainer.setLocalTranslation(camWidth / 2 - 125, camHeight / 2, 0); // Center on screen
        startButtonContainer.setLocalScale(1.5f); // Scale up the UI
        guiNode.attachChild(startButtonContainer);
    }

    private void startGame() {
        if (startButtonContainer != null) {
            startButtonContainer.removeFromParent(); // Remove the button
        }
        gameStartListener.onGameStart(); // Notify the main window
    }
}
