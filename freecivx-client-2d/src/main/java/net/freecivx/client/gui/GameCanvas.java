package net.freecivx.client.gui;

import javax.swing.*;
import java.awt.*;
import java.util.Random;

/**
 * A custom canvas for rendering the game map using Swing elements.
 */
public class GameCanvas extends JPanel {

    private static final int TILE_SIZE = 20;
    private static final int MAP_WIDTH = 100;
    private static final int MAP_HEIGHT = 100;
    private final Color[][] tileColors;

    public GameCanvas() {
        setPreferredSize(new Dimension(MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE));
        setBackground(Color.BLACK); // Default background color
        tileColors = new Color[MAP_WIDTH][MAP_HEIGHT];
        generateRandomMap();
    }

    private void generateRandomMap() {
        Random random = new Random();
        Color[] colors = {Color.GREEN, Color.BLUE, Color.ORANGE};
        for (int x = 0; x < MAP_WIDTH; x++) {
            for (int y = 0; y < MAP_HEIGHT; y++) {
                tileColors[x][y] = colors[random.nextInt(colors.length)];
            }
        }
    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        Graphics2D g2d = (Graphics2D) g;

        // Draw filled squares with different colors
        for (int x = 0; x < MAP_WIDTH; x++) {
            for (int y = 0; y < MAP_HEIGHT; y++) {
                g2d.setColor(tileColors[x][y]);
                g2d.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                g2d.setColor(Color.BLACK);
                g2d.drawRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }
    }
}
