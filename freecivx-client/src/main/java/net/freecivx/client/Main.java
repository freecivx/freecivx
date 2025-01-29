package net.freecivx.client;

import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;
import javax.swing.*;
import java.awt.*;
import java.net.URI;
import java.net.URISyntaxException;
import com.google.gson.Gson;
import com.google.gson.JsonObject;

/**
 * Main entry point for the FreecivX Java Swing Client.
 */
public class Main {

    public static void main(String[] args) {
        // Set up the Swing UI on the Event Dispatch Thread
        SwingUtilities.invokeLater(() -> {
            // Create the main application window
            JFrame mainFrame = new JFrame("FreecivX Swing Client");

            // Set up the window's basic properties
            mainFrame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
            mainFrame.setSize(800, 600); // Set initial size
            mainFrame.setLocationRelativeTo(null); // Center the window

            // Create the menu bar
            JMenuBar menuBar = new JMenuBar();

            // Add menus to the menu bar
            menuBar.add(createMenu("Game"));
            menuBar.add(createMenu("Unit"));
            menuBar.add(createMenu("Civilization"));
            menuBar.add(createMenu("Work"));
            menuBar.add(createMenu("Combat"));
            menuBar.add(createMenu("Help"));

            // Set the menu bar to the frame
            mainFrame.setJMenuBar(menuBar);

            // Add a simple welcome label
            JLabel welcomeLabel = new JLabel("Welcome to FreecivX Swing Client", SwingConstants.CENTER);
            welcomeLabel.setFont(new Font("Arial", Font.BOLD, 20));
            mainFrame.add(welcomeLabel);

            // Show the main frame
            mainFrame.setVisible(true);

            // Show the connection dialog
            showConnectionDialog(mainFrame);
        });
    }

    private static JMenu createMenu(String menuName) {
        JMenu menu = new JMenu(menuName);

        // Example menu items
        JMenuItem menuItem1 = new JMenuItem(menuName + " Option 1");
        JMenuItem menuItem2 = new JMenuItem(menuName + " Option 2");
        JMenuItem menuItem3 = new JMenuItem(menuName + " Option 3");

        // Add menu items to the menu
        menu.add(menuItem1);
        menu.add(menuItem2);
        menu.add(menuItem3);

        return menu;
    }

    private static void showConnectionDialog(JFrame parent) {
        // Create a modal dialog
        JDialog connectionDialog = new JDialog(parent, "Connect to Server", true);
        connectionDialog.setSize(400, 300);
        connectionDialog.setLayout(new GridBagLayout());
        connectionDialog.setLocationRelativeTo(parent);

        // Create input fields and labels
        JLabel usernameLabel = new JLabel("Username:");
        String user = System.getProperty("user.name");
        JTextField usernameField = new JTextField(user, 20);

        JLabel serverAddressLabel = new JLabel("Server Address:");
        JTextField serverAddressField = new JTextField("freecivx.net", 20);

        JLabel portLabel = new JLabel("Port:");
        JTextField portField = new JTextField("7800", 20);

        JButton connectButton = new JButton("Connect");

        // Add components to the dialog
        GridBagConstraints gbc = new GridBagConstraints();
        gbc.insets = new Insets(5, 5, 5, 5);
        gbc.fill = GridBagConstraints.HORIZONTAL;

        gbc.gridx = 0;
        gbc.gridy = 0;
        connectionDialog.add(usernameLabel, gbc);
        gbc.gridx = 1;
        connectionDialog.add(usernameField, gbc);

        gbc.gridx = 0;
        gbc.gridy = 1;
        connectionDialog.add(serverAddressLabel, gbc);
        gbc.gridx = 1;
        connectionDialog.add(serverAddressField, gbc);

        gbc.gridx = 0;
        gbc.gridy = 2;
        connectionDialog.add(portLabel, gbc);
        gbc.gridx = 1;
        connectionDialog.add(portField, gbc);

        gbc.gridx = 0;
        gbc.gridy = 3;
        gbc.gridwidth = 2;
        connectionDialog.add(connectButton, gbc);

        // Action listener for the connect button
        connectButton.addActionListener(e -> {
            String username = usernameField.getText();
            String serverAddress = serverAddressField.getText();
            String port = portField.getText();

            if (username.isEmpty() || serverAddress.isEmpty() || port.isEmpty()) {
                JOptionPane.showMessageDialog(connectionDialog, "All fields are required.", "Error", JOptionPane.ERROR_MESSAGE);
                return;
            }

            try {
                // Establish WebSocket connection
                URI serverUri = new URI("ws://" + serverAddress + ":" + port);
                WebSocketClient client = new WebSocketClient(serverUri) {
                    @Override
                    public void onOpen(ServerHandshake handshake) {
                        System.out.println("Connected to server.");

                        // Create and send login message
                        Gson gson = new Gson();
                        JsonObject loginMessage = new JsonObject();
                        loginMessage.addProperty("pid", 4);
                        loginMessage.addProperty("username", username);
                        loginMessage.addProperty("capability", "+Freeciv.Web.Devel-3.3");
                        loginMessage.addProperty("version_label", "-dev");
                        loginMessage.addProperty("major_version", 3);
                        loginMessage.addProperty("minor_version", 1);
                        loginMessage.addProperty("patch_version", 90);
                        String loginPacket = gson.toJson(loginMessage);
                        send(loginPacket);
                        System.out.println("Sent: " + loginPacket);
                    }

                    @Override
                    public void onMessage(String message) {
                        System.out.println("Received: " + message);

                        // Parse and log the JSON response
                        Gson gson = new Gson();
                        JsonObject response = gson.fromJson(message, JsonObject.class);
                        System.out.println("Parsed Response: " + response);
                    }

                    @Override
                    public void onClose(int code, String reason, boolean remote) {
                        System.out.println("Connection closed: " + reason);
                    }

                    @Override
                    public void onError(Exception ex) {
                        ex.printStackTrace();
                    }
                };

                client.connect();

                // Close the dialog
                connectionDialog.dispose();

            } catch (URISyntaxException ex) {
                JOptionPane.showMessageDialog(connectionDialog, "Invalid server address or port.", "Error", JOptionPane.ERROR_MESSAGE);
            }
        });

        // Show the dialog
        connectionDialog.setVisible(true);
    }
}
