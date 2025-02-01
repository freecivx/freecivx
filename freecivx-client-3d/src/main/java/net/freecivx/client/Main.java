package net.freecivx.client;

import com.jme3.system.AppSettings;
import net.freecivx.client.gui.MainWindow;

/**
 * Main entry point for the FreecivX Java jMonkeyEngine Client.
 */
public class Main {

    public static void main(String[] args) {
        MainWindow app = new MainWindow();
        app.setSettings(createSettings());
        app.start();
    }

    private static AppSettings createSettings() {
        AppSettings settings = new AppSettings(true);
        settings.setTitle("FreecivX");
        settings.setSettingsDialogImage("freecivx-splash-small.jpg");
        settings.setResolution(1280, 720);
        return settings;
    }

}
