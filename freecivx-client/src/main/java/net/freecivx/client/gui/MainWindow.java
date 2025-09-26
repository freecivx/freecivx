package net.freecivx.client.gui;

import net.freecivx.client.game.Game;
import net.freecivx.client.network.FreecivxClient;

import javax.swing.*;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;

/**
 * The main window
 */
public class MainWindow {

    private JTextArea chatArea;
    public FreecivxClient client;
    public Game game;
    private JPanel mainMapPanel;
    private JButton startGameButton;
    private JPanel buttonPanel;
    private JLabel splashLabel;

    public MainWindow() {
        game = new Game(this);
    }

    public void setup() {
        SwingUtilities.invokeLater(() -> {
            JFrame mainFrame = new JFrame("FreecivX Swing Client");
            mainFrame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
            mainFrame.setExtendedState(JFrame.MAXIMIZED_BOTH); // Maximized window
            mainFrame.setLocationRelativeTo(null);

            // Create the menu bar
            JMenuBar menuBar = MenuCreator.createMenuBar();
            mainFrame.setJMenuBar(menuBar);

            // Create main container panel
            JPanel mainPanel = new JPanel(new BorderLayout());

            // Left side panel (start game button at the top, overview map, unit info below)
            JPanel leftPanel = new JPanel(new BorderLayout());

            // Start Game Button
            startGameButton = new JButton("Start Game");
            startGameButton.addActionListener(new ActionListener() {
                @Override
                public void actionPerformed(ActionEvent e) {
                    showMessage("Game is starting...");
                    client.sendPlayerReady();
                }
            });

            buttonPanel = new JPanel();
            buttonPanel.add(startGameButton);
            leftPanel.add(buttonPanel, BorderLayout.NORTH);

            JPanel overviewMapPanel = new JPanel();
            overviewMapPanel.setPreferredSize(new Dimension(250, 150));
            overviewMapPanel.setBorder(BorderFactory.createTitledBorder("Overview Map"));
            JPanel unitInfoPanel = new JPanel();
            unitInfoPanel.setPreferredSize(new Dimension(250, 400)); // Increased height
            unitInfoPanel.setBorder(BorderFactory.createTitledBorder("Unit Information"));

            leftPanel.add(overviewMapPanel, BorderLayout.CENTER);
            leftPanel.add(unitInfoPanel, BorderLayout.SOUTH);

            // Bottom panel (server messages and chat)
            JPanel bottomPanel = new JPanel(new BorderLayout());
            chatArea = new JTextArea(7, 40);
            chatArea.setEditable(false);
            chatArea.setBorder(BorderFactory.createTitledBorder("Server Messages & Chat"));
            JTextField chatInput = new JTextField();
            chatInput.setBorder(BorderFactory.createTitledBorder("Enter Message"));

            chatInput.addKeyListener(new KeyAdapter() {
                @Override
                public void keyPressed(KeyEvent e) {
                    if (e.getKeyCode() == KeyEvent.VK_ENTER) {
                        String message = chatInput.getText().trim();
                        if (!message.isEmpty()) {
                            client.sendMessage(message);
                            chatInput.setText("");
                        }
                    }
                }
            });

            bottomPanel.add(new JScrollPane(chatArea), BorderLayout.CENTER);
            bottomPanel.add(chatInput, BorderLayout.SOUTH);

            // Right side main map panel (initially showing splash screen)
            mainMapPanel = new JPanel(new BorderLayout());
            mainMapPanel.setPreferredSize(new Dimension(1024, 760));
            mainMapPanel.setBorder(BorderFactory.createTitledBorder("Main Map"));

            splashLabel = new JLabel();
            try {
                ImageIcon splashIcon = new ImageIcon(getClass().getClassLoader().getResource("freecivx-splash.jpg"));
                splashLabel.setIcon(new ImageIcon(splashIcon.getImage().getScaledInstance(1024, 760, Image.SCALE_SMOOTH)));
                splashLabel.setHorizontalAlignment(JLabel.CENTER);
                splashLabel.setVerticalAlignment(JLabel.CENTER);
                mainMapPanel.add(splashLabel, BorderLayout.CENTER);
            } catch (Exception e) {
                splashLabel.setText("Failed to load splash screen");
                splashLabel.setHorizontalAlignment(JLabel.CENTER);
                mainMapPanel.add(splashLabel, BorderLayout.CENTER);
            }

            // Adding components to the main layout
            mainPanel.add(leftPanel, BorderLayout.WEST);
            mainPanel.add(mainMapPanel, BorderLayout.CENTER);
            mainPanel.add(bottomPanel, BorderLayout.SOUTH);

            mainFrame.add(mainPanel);
            mainFrame.setVisible(true);
            ConnectionDialog connectionDialog = new ConnectionDialog();
            connectionDialog.showConnectionDialog(this, mainFrame, client);
        });
    }

    public void setClient(FreecivxClient client) {
        this.client = client;
    }

    public void gameStarted() {
        SwingUtilities.invokeLater(() -> {
            showMessage("Game Started");
            mainMapPanel.removeAll();
            JScrollPane scrollPane = new JScrollPane(new GameCanvas());
            scrollPane.setHorizontalScrollBarPolicy(JScrollPane.HORIZONTAL_SCROLLBAR_ALWAYS);
            scrollPane.setVerticalScrollBarPolicy(JScrollPane.VERTICAL_SCROLLBAR_ALWAYS);
            mainMapPanel.add(scrollPane, BorderLayout.CENTER);
            mainMapPanel.revalidate();
            mainMapPanel.repaint();

            if (buttonPanel != null) {
                buttonPanel.setVisible(false);
            }
        });
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
