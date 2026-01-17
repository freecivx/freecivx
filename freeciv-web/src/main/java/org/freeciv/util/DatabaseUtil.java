package org.freeciv.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.naming.Context;
import javax.naming.InitialContext;
import javax.naming.NamingException;
import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

@Component
public class DatabaseUtil {
    private static final Logger logger = LoggerFactory.getLogger(DatabaseUtil.class);
    
    private static DataSource springDataSource;

    @Autowired(required = false)
    public void setDataSource(DataSource dataSource) {
        DatabaseUtil.springDataSource = dataSource;
    }

    /**
     * Gets a database connection from the DataSource configured via Spring or JNDI.
     * 
     * @return a Connection to the database
     * @throws SQLException if a database access error occurs
     */
    public static Connection getConnection() throws SQLException {
        // Try Spring DataSource first
        if (springDataSource != null) {
            return springDataSource.getConnection();
        }
        
        // Fall back to JNDI for legacy deployments
        try {
            Context env = (Context) (new InitialContext().lookup(Constants.JNDI_CONNECTION));
            DataSource ds = (DataSource) env.lookup(Constants.JNDI_DDBBCON_MYSQL);
            return ds.getConnection();
        } catch (NamingException e) {
            logger.error("Failed to lookup database connection", e);
            throw new SQLException("Failed to lookup database connection", e);
        }
    }
}
