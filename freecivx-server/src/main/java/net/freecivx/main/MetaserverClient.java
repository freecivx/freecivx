/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.Freecivx.net/
 Copyright (C) 2009-2025  The Freeciv-web project

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.

 You should have received a copy of the GNU Affero General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.

 ***********************************************************************/

package net.freecivx.main;

import java.io.IOException;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class MetaserverClient {

    public static void publishToMetaserver(int port) {
        String metaserverUrl = "http://localhost:8080/freeciv-web/meta/metaserver";
        String serverHost = "localhost"; // Replace with actual host if necessary
        String postData = String.format("host=%s&port=%d&vn[]=&vv[]=&type=freecivx&message=%s", serverHost, port, "Freecivx Multiplayer Server (Java)");

        try {
            URL url = new URL(metaserverUrl);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            connection.setRequestProperty("Content-Length", String.valueOf(postData.length()));

            try (OutputStream os = connection.getOutputStream()) {
                os.write(postData.getBytes(StandardCharsets.UTF_8));
            }

            int responseCode = connection.getResponseCode();
            System.out.println("Response: " + connection.getResponseMessage());
            if (responseCode == HttpURLConnection.HTTP_OK) {
                System.out.println("Server successfully published to metaserver.");
            } else {
                System.err.println("Failed to publish to metaserver. Response code: " + responseCode);
            }
        } catch (IOException e) {
            System.err.println("Error publishing to metaserver: " + e.getMessage());
        }
    }
}
