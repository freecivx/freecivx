package org.freeciv.servlet;

import org.apache.commons.io.FileUtils;

import javax.imageio.ImageIO;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Saves a game of the day image.
 *
 * URL: /save_game_of_the_day
 */
@RestController
public class SaveGameOfTheDay {

    private static final String mapDstImgPaths = "/var/lib/tomcat11/webapps/data/";

    @PostMapping("/save_game_of_the_day")
    public ResponseEntity<String> saveGameOfTheDay(@RequestBody String imageData) {

        try {
            String image = imageData.replace("data:image/png;base64,", "");
            byte[] image_of_the_day = Base64.getDecoder().decode(image.getBytes(StandardCharsets.UTF_8));
            if (image_of_the_day.length > 15000000) {
                System.out.println("Image too big.");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Image too big.");
            }
            ByteArrayInputStream bais = new ByteArrayInputStream(image_of_the_day);
            BufferedImage bufferedImage = ImageIO.read(bais);
            if (bufferedImage.getWidth() > 100 && bufferedImage.getWidth() < 10000) {
                File mapimg = new File(mapDstImgPaths + "game_of_the_day.png");
                FileUtils.writeByteArrayToFile(mapimg, image_of_the_day);
            }
            bais.close();

            return ResponseEntity.ok().build();

        } catch (Exception ex) {
            System.err.println(ex.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
