package net.freecivx.client.gui;


import net.freecivx.client.network.FreecivxClient;

import javax.swing.*;
import java.awt.*;
import java.net.URI;
import java.net.URISyntaxException;

public class ConnectionDialog {
    public void showConnectionDialog(MainWindow mainWindow, JFrame parent) {
        JDialog connectionDialog = new JDialog(parent, "Connect to Server", true);
        connectionDialog.setSize(400, 300);
        connectionDialog.setLayout(new GridBagLayout());
        connectionDialog.setLocationRelativeTo(parent);

        JLabel usernameLabel = new JLabel("Username:");
        String user = System.getProperty("user.name");
        JTextField usernameField = new JTextField(user, 20);

        JLabel serverAddressLabel = new JLabel("Server Address:");
        JTextField serverAddressField = new JTextField("localhost", 20);

        JLabel portLabel = new JLabel("Port:");
        JTextField portField = new JTextField("7800", 20);

        JButton connectButton = new JButton("Connect");

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

        connectButton.addActionListener(e -> {
            String username = usernameField.getText();
            String serverAddress = serverAddressField.getText();
            String port = portField.getText();

            if (username.isEmpty() || serverAddress.isEmpty() || port.isEmpty()) {
                JOptionPane.showMessageDialog(connectionDialog, "All fields are required.", "Error", JOptionPane.ERROR_MESSAGE);
                return;
            }

            try {
                URI serverUri = new URI("ws://" + serverAddress + ":" + port);
                FreecivxClient client = new FreecivxClient(mainWindow, serverUri, username);
                client.connect();
                connectionDialog.dispose();
            } catch (URISyntaxException ex) {
                JOptionPane.showMessageDialog(connectionDialog, "Invalid server address or port.", "Error", JOptionPane.ERROR_MESSAGE);
            }
        });

        connectionDialog.setVisible(true);
    }
}