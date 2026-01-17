package org.freeciv.servlet;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

import org.freeciv.util.DatabaseUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;


/**
 * Logs errors of FreecivWorld.net
 *
 * URL: /errorlog
 */
@RestController
public class ErrorLog {
    private static final Logger logger = LoggerFactory.getLogger(ErrorLog.class);


    @PostMapping("/errorlog")
    public ResponseEntity<Void> logError(@RequestParam("stacktrace") String stacktrace_param) {

        String stacktrace = java.net.URLDecoder.decode(stacktrace_param, StandardCharsets.UTF_8);

        String query = "INSERT INTO errorlog (stacktrace) VALUES (?)";
        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement preparedStatement = conn.prepareStatement(query)) {
            preparedStatement.setString(1, stacktrace);
            preparedStatement.executeUpdate();
            return ResponseEntity.ok().build();
        } catch (SQLException e) {
            logger.error("Failed to log error to database", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .header("result", "error")
                    .build();
        }

    }

}
