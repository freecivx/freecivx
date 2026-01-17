package org.freeciv.servlet;

import org.freeciv.util.DatabaseUtil;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Base64;


/**
 * List errors of FreecivWorld.net
 *
 * URL: /errorlist
 */
@RestController
public class ErrorList {

    private static final Logger logger = LoggerFactory.getLogger(ErrorList.class);

    private static final String INTERNAL_SERVER_ERROR = new JSONObject() //
            .put("statusCode", HttpStatus.INTERNAL_SERVER_ERROR.value()) //
            .put("error", "Internal server error.") //
            .toString();

    @GetMapping("/errorlist")
    public ResponseEntity<String> getErrorList() {

        try {
            try (Connection conn = DatabaseUtil.getConnection()) {
                String query = "SELECT * FROM errorlog ORDER BY id DESC";

                try (PreparedStatement preparedStatement = conn.prepareStatement(query)) {
                    try (ResultSet rs = preparedStatement.executeQuery()) {
                        StringBuilder output = new StringBuilder();
                        output.append("<html><head><link href=\"/static/css/bootstrap.min.css\" rel=\"stylesheet\"></head><body>");
                        output.append("<div class='container'><h2> Error list:</h2>");
                        output.append("<table>");
                        int count = 0;
                        while (rs.next()) {
                            try {
                                output.append("<tr>");

                                int id = rs.getInt("id");
                                String stacktrace = new String(Base64.getDecoder().decode(rs.getString("stacktrace").getBytes(StandardCharsets.UTF_8)), StandardCharsets.UTF_8);
                                String timestamp = rs.getString("timestamp");

                                output.append("<td style='padding:3px;'>").append(id).append("</td><td style='padding:3px;'>").append(stacktrace).append("</td><td style='padding:3px;'>").append(timestamp).append("</td>");
                                output.append("</tr>");

                                if ((count + 1)  % 2 == 0) {
                                    output.append("<tr style=\"border-bottom:1px solid black\"> <td colspan=\"100%\"></td></tr>");
                                }
                                count++;
                            } catch (Exception err) {
                                logger.error("Error processing error log entry", err);
                            }

                        }
                        output.append("</table></div>");
                        output.append("</body></html>");
                        
                        return ResponseEntity.ok()
                                .header("Content-Type", "text/html")
                                .body(output.toString());
                    }
                }
            }

        } catch (Exception err) {
            logger.error("Error retrieving error list", err);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .header("Content-Type", "application/json")
                    .body(INTERNAL_SERVER_ERROR);
        }
    }


}
