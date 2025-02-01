package net.freecivx.client.gui;

import com.jme3.math.Vector3f;
import com.jme3.renderer.queue.RenderQueue;
import com.jme3.scene.Node;
import com.simsilica.lemur.Button;
import com.simsilica.lemur.Container;
import com.simsilica.lemur.Label;
import com.simsilica.lemur.TextField;
import com.simsilica.lemur.component.BorderLayout;
import net.freecivx.client.network.FreecivxClient;

import javax.swing.JOptionPane;
import java.net.URI;
import java.net.URISyntaxException;

/**
 * Handles the connection UI and logic for FreecivX.
 */
public class ConnectionDialog {

    private final Node guiNode;
    private final Vector3f camDimensions;
    private Container connectionDialog;
    private TextField usernameField;
    private TextField hostField;
    private TextField portField;
    private ConnectionListener connectionListener;
    private MainWindow mainWindow;

    public interface ConnectionListener {
        void onConnectionEstablished(FreecivxClient client);
    }

    public ConnectionDialog(MainWindow mainWindow, Node guiNode, Vector3f camDimensions, ConnectionListener listener) {
        this.guiNode = guiNode;
        this.camDimensions = camDimensions;
        this.connectionListener = listener;
        this.mainWindow = mainWindow;
    }

    public void show() {
        connectionDialog = new Container(new BorderLayout());
        Container inputContainer = new Container();

        inputContainer.addChild(new Label("Username:"));
        String sysUsername = System.getProperty("user.name");
        usernameField = inputContainer.addChild(new TextField(sysUsername));

        inputContainer.addChild(new Label("Host:"));
        hostField = inputContainer.addChild(new TextField("127.0.0.1"));

        inputContainer.addChild(new Label("Port:"));
        portField = inputContainer.addChild(new TextField("7800"));

        Button connectButton = inputContainer.addChild(new Button("Connect"));
        connectButton.addClickCommands(source -> connectToServer());

        connectionDialog.addChild(inputContainer, BorderLayout.Position.Center);
        connectionDialog.setLocalTranslation(camDimensions.x / 2f - 150, camDimensions.y / 2f + 100, 0);
        connectionDialog.setLocalScale(1.5f);
        guiNode.setQueueBucket(RenderQueue.Bucket.Gui);
        guiNode.attachChild(connectionDialog);
    }

    private void connectToServer() {
        String username = usernameField.getText();
        String serverAddress = hostField.getText();
        String port = portField.getText();

        if (username.isEmpty() || serverAddress.isEmpty() || port.isEmpty()) {
            JOptionPane.showMessageDialog(null, "All fields are required.", "Error", JOptionPane.ERROR_MESSAGE);
            return;
        }

        try {
            URI serverUri = new URI("ws://" + serverAddress + ":" + port);
            FreecivxClient client = new FreecivxClient(mainWindow, serverUri, username);
            client.connect();
            connectionDialog.removeFromParent();
            if (connectionListener != null) {
                connectionListener.onConnectionEstablished(client);
            }
        } catch (URISyntaxException ex) {
            JOptionPane.showMessageDialog(null, "Invalid server address or port.", "Error", JOptionPane.ERROR_MESSAGE);
        }
    }
}
