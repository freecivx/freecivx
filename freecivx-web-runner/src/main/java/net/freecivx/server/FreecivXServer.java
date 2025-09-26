package net.freecivx.server;

import org.apache.catalina.Context;
import org.apache.catalina.LifecycleException;
import org.apache.catalina.startup.Tomcat;

import java.io.File;


public class FreecivXServer {
    public static void main(String[] args) {
        int port = 8080; // Change if needed
        String warFilePath = "freeciv-web.war"; // Path to your WAR file

        Tomcat tomcat = new Tomcat();
        tomcat.setPort(port);
        tomcat.getConnector(); // Initializes the connector

        try {

            // Deploy the WAR file
            File warFile = new File(warFilePath);
            if (!warFile.exists()) {
                System.err.println("Error: WAR file not found at " + warFilePath);
                return;
            }

            Context ctx = tomcat.addWebapp("", warFile.getAbsolutePath());



            System.out.println("Starting FreecivX server on http://localhost:" + port + "/?action=local");
            tomcat.start();
            tomcat.getServer().await();
        } catch (LifecycleException e) {
            e.printStackTrace();
        }
    }


}

