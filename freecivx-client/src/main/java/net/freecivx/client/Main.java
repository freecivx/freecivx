package net.freecivx.client;

import javax.swing.*;
import java.awt.*;

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

            // Add a simple welcome label
            JLabel welcomeLabel = new JLabel("Welcome to FreecivX Swing Client", SwingConstants.CENTER);
            welcomeLabel.setFont(new Font("Arial", Font.BOLD, 20));
            mainFrame.add(welcomeLabel);

            // Make the window visible
            mainFrame.setVisible(true);
        });
    }
}

