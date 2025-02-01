package net.freecivx.client.gui;

import com.jme3.app.SimpleApplication;
import com.jme3.math.Vector3f;
import com.simsilica.lemur.GuiGlobals;
import com.simsilica.lemur.style.BaseStyles;
import net.freecivx.client.game.Game;
import net.freecivx.client.game.GameMapRenderer;
import net.freecivx.client.network.FreecivxClient;

public class MainWindow extends SimpleApplication {

    private FreecivxClient client;
    private ChatUI chatUI;
    private StartGameUI startGameUI;
    public Game game;
    private BackgroundManager backgroundManager;
    private GameMapRenderer gameMapRenderer;

    public MainWindow() {
        super();
        this.game = new Game(this);
    }

    @Override
    public void simpleInitApp() {
        GuiGlobals.initialize(this);
        GuiGlobals.getInstance().getStyles().setDefaultStyle(BaseStyles.GLASS);

        backgroundManager = new BackgroundManager(assetManager, guiNode, cam);
        backgroundManager.addBackgroundImage(); // Add initial background

        new LightingManager(rootNode).setupLighting();

        gameMapRenderer = new GameMapRenderer(assetManager, rootNode); // Initialize map renderer

        flyCam.setEnabled(true);

        float camWidth = cam.getWidth();
        float camHeight = cam.getHeight();

        ConnectionDialog connectionDialog = new ConnectionDialog(this, client, guiNode, new Vector3f(camWidth, camHeight, 1), this::onConnectionEstablished);
        connectionDialog.show();
    }

    private void onConnectionEstablished(FreecivxClient client) {
        this.client = client;
        chatUI = new ChatUI(guiNode, new Vector3f(cam.getWidth(), cam.getHeight(), 1), client);
        chatUI.createUI();

        // Show the Start Game button
        startGameUI = new StartGameUI(guiNode, cam.getWidth(), cam.getHeight(), this::sendStartGame);
        startGameUI.show();
    }

    public void gameStarted() {
        chatUI.hide();
        removeBackground(); // Remove the background when game starts
        gameMapRenderer.generateMap(); // Generate the new game map
    }

    private void removeBackground() {
        backgroundManager.removeBackground(); // Remove background from GUI node
    }

    private void sendStartGame() {
        client.sendPlayerReady();
        gameStarted(); // Start game and remove background
    }

    public void showMessage(String message) {
        chatUI.showMessage(message);
    }

    @Override
    public void destroy() {
        super.destroy();
        System.exit(0);
    }
}
