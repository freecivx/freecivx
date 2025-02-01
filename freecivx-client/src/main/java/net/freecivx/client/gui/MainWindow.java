package net.freecivx.client.gui;

import net.freecivx.client.network.FreecivxClient;
import javax.swing.*;
import java.awt.*;
import java.net.URI;
import java.net.URISyntaxException;

/**
 * The main window
 */
public class MainWindow {

    private JTextArea chatArea;

    public void setup() {
        SwingUtilities.invokeLater(() -> {
            JFrame mainFrame = new JFrame("FreecivX Swing Client");
            mainFrame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
            mainFrame.setExtendedState(JFrame.MAXIMIZED_BOTH); // Maximized window
            mainFrame.setLocationRelativeTo(null);

            // Create the menu bar
            JMenuBar menuBar = new JMenuBar();
            menuBar.add(createMenu("Game"));
            menuBar.add(createMenu("Unit"));
            menuBar.add(createMenu("Civilization"));
            menuBar.add(createMenu("Work"));
            menuBar.add(createMenu("Combat"));
            menuBar.add(createMenu("Help"));
            mainFrame.setJMenuBar(menuBar);

            // Create main container panel
            JPanel mainPanel = new JPanel(new BorderLayout());

            // Left side panel (overview map at the top, unit info below)
            JPanel leftPanel = new JPanel(new BorderLayout());
            JPanel overviewMapPanel = new JPanel();
            overviewMapPanel.setPreferredSize(new Dimension(150, 150));
            overviewMapPanel.setBorder(BorderFactory.createTitledBorder("Overview Map"));
            JPanel unitInfoPanel = new JPanel();
            unitInfoPanel.setBorder(BorderFactory.createTitledBorder("Unit Information"));
            leftPanel.add(overviewMapPanel, BorderLayout.NORTH);
            leftPanel.add(unitInfoPanel, BorderLayout.CENTER);

            // Bottom panel (server messages and chat)
            JPanel bottomPanel = new JPanel(new BorderLayout());
            chatArea = new JTextArea(5, 40);
            chatArea.setEditable(false);
            chatArea.setBorder(BorderFactory.createTitledBorder("Server Messages & Chat"));
            JTextField chatInput = new JTextField();
            chatInput.setBorder(BorderFactory.createTitledBorder("Enter Message"));
            bottomPanel.add(new JScrollPane(chatArea), BorderLayout.CENTER);
            bottomPanel.add(chatInput, BorderLayout.SOUTH);

            // Right side main map panel (initially showing splash screen)
            JPanel mainMapPanel = new JPanel();
            mainMapPanel.setLayout(new BorderLayout());
            mainMapPanel.setPreferredSize(new Dimension(640, 480));
            mainMapPanel.setBorder(BorderFactory.createTitledBorder("Main Map"));

            try {
                ImageIcon splashIcon = new ImageIcon(getClass().getClassLoader().getResource("freecivx-splash.jpg"));
                ScaledImageLabel splashLabel = new ScaledImageLabel(splashIcon);
                mainMapPanel.add(splashLabel, BorderLayout.CENTER);
            } catch (Exception e) {
                JLabel errorLabel = new JLabel("Failed to load splash screen", SwingConstants.CENTER);
                mainMapPanel.add(errorLabel, BorderLayout.CENTER);
                e.printStackTrace();
            }

            // Adding components to the main layout
            mainPanel.add(leftPanel, BorderLayout.WEST);
            mainPanel.add(mainMapPanel, BorderLayout.CENTER);
            mainPanel.add(bottomPanel, BorderLayout.SOUTH);

            mainFrame.add(mainPanel);
            mainFrame.setVisible(true);
            ConnectionDialog connectionDialog = new ConnectionDialog();
            connectionDialog.showConnectionDialog(this, mainFrame);
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

    public void showMessage(String message) {
        SwingUtilities.invokeLater(() -> {
            if (chatArea != null) {
                chatArea.append(message + "\n");
                chatArea.setCaretPosition(chatArea.getDocument().getLength()); // Auto-scroll
            }
        });
    }
}

// Custom JLabel for displaying and scaling the splash image
class ScaledImageLabel extends JLabel {
    private Image image;

    public ScaledImageLabel(ImageIcon icon) {
        if (icon != null) {
            this.image = icon.getImage();
        }
    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        if (image != null) {
            int width = getWidth();
            int height = getHeight();

            // Scale to fit 100% width and height
            g.drawImage(image, 0, 0, width, height, this);
        }
    }
}