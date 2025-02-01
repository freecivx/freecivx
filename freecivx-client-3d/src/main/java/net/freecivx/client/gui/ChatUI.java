package net.freecivx.client.gui;

import com.jme3.input.KeyInput;
import com.jme3.math.Vector3f;
import com.jme3.scene.Node;
import com.simsilica.lemur.Button;
import com.simsilica.lemur.Container;
import com.simsilica.lemur.Label;
import com.simsilica.lemur.TextField;
import com.simsilica.lemur.VAlignment;
import com.simsilica.lemur.component.BorderLayout;
import com.simsilica.lemur.component.TextEntryComponent;
import com.simsilica.lemur.event.KeyAction;
import com.simsilica.lemur.event.KeyActionListener;
import net.freecivx.client.network.FreecivxClient;

public class ChatUI {
    private final Node guiNode;
    private final Vector3f camDimensions;
    private final FreecivxClient client;
    private TextField chatInput;
    private Label chatArea;

    public ChatUI(Node guiNode, Vector3f camDimensions, FreecivxClient client) {
        this.guiNode = guiNode;
        this.camDimensions = camDimensions;
        this.client = client;
    }

    public void createUI() {
        Container mainContainer = new Container(new BorderLayout());

        Container chatPanel = new Container();
        chatArea = new Label("Connected! Chat below:");
        chatArea.setTextVAlignment(VAlignment.Top);
        chatInput = new TextField("");
        chatInput.setSingleLine(true);

        chatInput.getActionMap().put(new KeyAction(KeyInput.KEY_RETURN), this::sendChatMessage);
        chatInput.getActionMap().put(new KeyAction(KeyInput.KEY_NUMPADENTER), this::sendChatMessage);

        chatPanel.addChild(chatArea);
        chatPanel.addChild(chatInput);
        mainContainer.addChild(chatPanel, BorderLayout.Position.South);
        mainContainer.setLocalTranslation(10, camDimensions.y - 10, 0);
        mainContainer.setLocalScale(1.5f);
        guiNode.attachChild(mainContainer);
    }

    private void sendChatMessage(TextEntryComponent component, KeyAction key) {
        String userText = chatInput.getText().trim();
        if (!userText.isEmpty()) {
            showMessage(userText);
            client.sendMessage(userText);
            chatInput.setText("");
        }
    }

    public void showMessage(String message) {
        chatArea.setText(chatArea.getText() + "\n" + message);
    }
}
