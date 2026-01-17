package org.freeciv.servlet;

import org.freeciv.util.DatabaseUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

@RestController
public class Verify {
    private static final Logger logger = LoggerFactory.getLogger(Verify.class);

    @GetMapping("/verify")
    public ResponseEntity<Void> verifyUser(@RequestParam("id") String id) {
        String query = "UPDATE auth SET verified = TRUE where verifykey = ?";
        try (Connection conn = DatabaseUtil.getConnection();
             PreparedStatement preparedStatement = conn.prepareStatement(query)) {
            preparedStatement.setString(1, id);
            preparedStatement.executeUpdate();

            Thread.sleep(100);
            return ResponseEntity.status(HttpStatus.FOUND)
                    .header("Location", "http://www.FreecivWorld.net?verify=ok")
                    .build();

        } catch (SQLException e) {
            logger.error("Failed to verify user", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .header("result", "error")
                    .build();
        } catch (InterruptedException e) {
            logger.error("Thread interrupted during verification", e);
            Thread.currentThread().interrupt();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .header("result", "error")
                    .build();
        }
    }
}
