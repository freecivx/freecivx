package net.freecivx.client.gui;

import javax.swing.*;

public class MenuCreator {

    public static JMenuBar createMenuBar() {
        JMenuBar menuBar = new JMenuBar();
        menuBar.add(createMenu("Game"));
        menuBar.add(createMenu("Unit"));
        menuBar.add(createMenu("Civilization"));
        menuBar.add(createMenu("Work"));
        menuBar.add(createMenu("Combat"));
        menuBar.add(createMenu("Help"));
        return menuBar;
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
}
