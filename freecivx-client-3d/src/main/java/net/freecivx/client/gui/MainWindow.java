package net.freecivx.client.gui;

import com.jme3.app.SimpleApplication;
import com.jme3.input.KeyInput;
import com.jme3.material.Material;
import com.jme3.math.ColorRGBA;
import com.jme3.math.Vector3f;
import com.jme3.renderer.queue.RenderQueue;
import com.jme3.scene.Geometry;
import com.jme3.scene.Node;
import com.jme3.scene.shape.Quad;
import com.jme3.texture.Texture;
import com.jme3.light.AmbientLight;
import com.jme3.light.DirectionalLight;
import com.simsilica.lemur.Button;
import com.simsilica.lemur.Container;
import com.simsilica.lemur.Label;
import com.simsilica.lemur.TextField;
import com.simsilica.lemur.VAlignment;
import com.simsilica.lemur.component.BorderLayout;
import com.simsilica.lemur.GuiGlobals;
import com.simsilica.lemur.component.TextEntryComponent;
import com.simsilica.lemur.style.BaseStyles;
import com.simsilica.lemur.event.KeyAction;
import com.simsilica.lemur.event.KeyActionListener;
import net.freecivx.client.network.FreecivxClient;

import javax.swing.JOptionPane;
import java.net.URI;
import java.net.URISyntaxException;

public class MainWindow extends SimpleApplication {

    private TextField chatInput;
    private Label chatArea;
    private TextField usernameField;
    private TextField hostField;
    private TextField portField;
    private Container connectionDialog;
    private FreecivxClient client;

    @Override
    public void simpleInitApp() {
        GuiGlobals.initialize(this);
        GuiGlobals.getInstance().getStyles().setDefaultStyle(BaseStyles.GLASS);

        addBackgroundImage();
        createConnectionDialog();
        addLighting();
        flyCam.setEnabled(true);
    }

    private void addBackgroundImage() {
        float screenWidth = cam.getWidth();
        float screenHeight = cam.getHeight();
        Quad quad = new Quad(screenWidth, screenHeight);

        Geometry background = new Geometry("Background", quad);
        Material mat = new Material(assetManager, "Common/MatDefs/Misc/Unshaded.j3md");
        Texture texture = assetManager.loadTexture("freecivx-splash.jpg");
        mat.setTexture("ColorMap", texture);
        background.setMaterial(mat);

        background.setLocalTranslation(0, 0, -10);
        guiNode.attachChild(background);
    }

    private void createConnectionDialog() {
        Node guiNode = getGuiNode();
        connectionDialog = new Container(new BorderLayout());

        Container inputContainer = new Container();
        inputContainer.addChild(new Label("Username:"));
        String sysusername = System.getProperty("user.name");
        usernameField = inputContainer.addChild(new TextField(sysusername));

        inputContainer.addChild(new Label("Host:"));
        hostField = inputContainer.addChild(new TextField("127.0.0.1"));

        inputContainer.addChild(new Label("Port:"));
        portField = inputContainer.addChild(new TextField("7800"));

        Button connectButton = inputContainer.addChild(new Button("Connect"));
        connectButton.addClickCommands(source -> {
            String username = usernameField.getText();
            String serverAddress = hostField.getText();
            String port = portField.getText();

            if (username.isEmpty() || serverAddress.isEmpty() || port.isEmpty()) {
                JOptionPane.showMessageDialog(null, "All fields are required.", "Error", JOptionPane.ERROR_MESSAGE);
                return;
            }

            try {
                URI serverUri = new URI("ws://" + serverAddress + ":" + port);
                client = new FreecivxClient(this, serverUri, username);
                client.connect();
                connectionDialog.removeFromParent();
                createUI();
            } catch (URISyntaxException ex) {
                JOptionPane.showMessageDialog(null, "Invalid server address or port.", "Error", JOptionPane.ERROR_MESSAGE);
            }
        });

        connectionDialog.addChild(inputContainer, BorderLayout.Position.Center);
        connectionDialog.setLocalTranslation(cam.getWidth() / 2f - 150, cam.getHeight() / 2f + 100, 0);
        connectionDialog.setLocalScale(1.5f);
        guiNode.setQueueBucket(RenderQueue.Bucket.Gui);
        guiNode.attachChild(connectionDialog);
    }

    private void createUI() {
        Node guiNode = getGuiNode();
        Container mainContainer = new Container(new BorderLayout());

        Container chatPanel = new Container();
        chatArea = new Label("Connected! Chat below:");
        chatArea.setTextVAlignment(VAlignment.Top);
        chatInput = new TextField("");
        chatInput.setSingleLine(true); // Ensure single-line input

        chatInput.getActionMap().put(new KeyAction(KeyInput.KEY_RETURN), new KeyActionListener() {
            @Override
            public void keyAction(TextEntryComponent component, KeyAction key) {
                sendChatMessage();
            }
        });

        chatInput.getActionMap().put(new KeyAction(KeyInput.KEY_NUMPADENTER), new KeyActionListener() {
            @Override
            public void keyAction(TextEntryComponent component, KeyAction key) {
                sendChatMessage();
            }
        });


        chatPanel.addChild(chatArea);
        chatPanel.addChild(chatInput);
        mainContainer.addChild(chatPanel, BorderLayout.Position.South);
        mainContainer.setLocalTranslation(10, cam.getHeight() - 10, 0);
        mainContainer.setLocalScale(1.5f);
        guiNode.attachChild(mainContainer);
    }

    private void sendChatMessage() {
        String userText = chatInput.getText().trim();
        if (!userText.isEmpty()) {
            showMessage(userText);
            client.sendMessage(userText);
            chatInput.setText(""); // Clear after sending
        }
    }

    private void addLighting() {
        AmbientLight ambient = new AmbientLight();
        ambient.setColor(ColorRGBA.White.mult(1.3f));
        rootNode.addLight(ambient);

        DirectionalLight sun = new DirectionalLight();
        sun.setDirection(new Vector3f(-1.0f, -1.0f, -1.0f).normalizeLocal());
        sun.setColor(ColorRGBA.White);
        rootNode.addLight(sun);
    }

    public void showMessage(String message) {
        chatArea.setText(chatArea.getText() + "\n" + message);
    }
}
