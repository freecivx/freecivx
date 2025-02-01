package net.freecivx.client.gui;

import com.jme3.app.SimpleApplication;
import com.jme3.math.Vector3f;
import com.simsilica.lemur.GuiGlobals;
import com.simsilica.lemur.style.BaseStyles;
import net.freecivx.client.network.FreecivxClient;

public class MainWindow extends SimpleApplication {

    private FreecivxClient client;
    private ChatUI chatUI;
    private StartGameUI startGameUI;

    @Override
    public void simpleInitApp() {
        GuiGlobals.initialize(this);
        GuiGlobals.getInstance().getStyles().setDefaultStyle(BaseStyles.GLASS);

        new BackgroundManager(assetManager, guiNode, cam).addBackgroundImage();
        new LightingManager(rootNode).setupLighting();

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
        startGameUI = new StartGameUI(guiNode, cam.getWidth(), cam.getHeight(), this::startGame);
        startGameUI.show();
    }

    private void startGame() {
        client.sendPlayerReady();
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
