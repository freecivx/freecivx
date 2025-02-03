package net.freecivx.client.gui;

import javax.swing.*;
import java.awt.*;

// Custom JLabel for displaying and scaling the splash image
public class ScaledImageLabel extends JLabel {
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