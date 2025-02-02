package net.freecivx.server;

import org.apache.catalina.Context;
import org.apache.catalina.LifecycleException;
import org.apache.catalina.startup.Tomcat;
import org.apache.naming.factory.Constants;
import org.apache.naming.factory.ResourceFactory;

import javax.naming.Context;
import javax.naming.InitialContext;
import javax.naming.NamingException;
import javax.sql.DataSource;
import org.apache.tomcat.jdbc.pool.PoolProperties;
import org.apache.tomcat.jdbc.pool.DataSource;

import java.io.File;
import java.util.Properties;

public class FreecivXServer {
    public static void main(String[] args) {
        int port = 8080; // Change if needed
        String warFilePath = "freeciv-web.war"; // Path to your WAR file

        Tomcat tomcat = new Tomcat();
        tomcat.setPort(port);
        tomcat.getConnector(); // Initializes the connector

        try {
            // Create the JNDI Initial Context
            setupJNDI();

            // Deploy the WAR file
            File warFile = new File(warFilePath);
            if (!warFile.exists()) {
                System.err.println("Error: WAR file not found at " + warFilePath);
                return;
            }

            Context ctx = tomcat.addWebapp("", warFile.getAbsolutePath());

            // Add JNDI resource to the Tomcat context
            org.apache.tomcat.util.descriptor.web.ContextResource resource = new org.apache.tomcat.util.descriptor.web.ContextResource();
            resource.setName("jdbc/FreecivDB");
            resource.setType("javax.sql.DataSource");
            resource.setAuth("Container");
            resource.setProperty("factory", "org.apache.tomcat.jdbc.pool.DataSourceFactory");
            resource.setProperty("driverClassName", "com.mysql.cj.jdbc.Driver");
            resource.setProperty("url", "jdbc:mysql://localhost:3306/freeciv?useSSL=false&allowPublicKeyRetrieval=true");
            resource.setProperty("username", "root"); // Update with actual username
            resource.setProperty("password", "password"); // Update with actual password
            resource.setProperty("maxTotal", "20");
            resource.setProperty("maxIdle", "10");
            resource.setProperty("minIdle", "5");
            resource.setProperty("initialSize", "5");

            ctx.getNamingResources().addResource(resource);

            System.out.println("Starting FreecivX server on http://localhost:" + port);
            tomcat.start();
            tomcat.getServer().await();
        } catch (LifecycleException e) {
            e.printStackTrace();
        }
    }

    private static void setupJNDI() throws NamingException {
        System.out.println("Setting up JNDI...");
        System.setProperty(Context.INITIAL_CONTEXT_FACTORY, "org.apache.naming.java.javaURLContextFactory");
        System.setProperty(Context.URL_PKG_PREFIXES, "org.apache.naming");

        InitialContext ic = new InitialContext();
        ic.createSubcontext("java:");
        ic.createSubcontext("java:/comp");
        ic.createSubcontext("java:/comp/env");
        ic.createSubcontext("java:/comp/env/jdbc");

        System.out.println("JNDI setup complete!");

    }
}
