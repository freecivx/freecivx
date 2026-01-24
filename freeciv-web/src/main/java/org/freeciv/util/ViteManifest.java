package org.freeciv.util;

import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.servlet.ServletContext;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.stream.Collectors;

/**
 * Utility class for reading Vite manifest.json file.
 * This allows JSP pages to load the correct hashed filenames from Vite builds.
 */
public class ViteManifest {
    private static final Logger logger = LoggerFactory.getLogger(ViteManifest.class);
    private static final String MANIFEST_PATH = "/WEB-INF/vite-manifest.json";
    
    /**
     * Get the bundled filename for a given source file from the Vite manifest.
     * 
     * @param servletContext the servlet context to load resources from
     * @param sourceFile the source file path (e.g., "javascript/three-modules.js")
     * @return the bundled filename with hash (e.g., "javascript/three-modules-abc123.js"), 
     *         or null if manifest not found or file not in manifest
     */
    public static String getBundledFile(ServletContext servletContext, String sourceFile) {
        try {
            InputStream is = servletContext.getResourceAsStream(MANIFEST_PATH);
            if (is == null) {
                logger.debug("Vite manifest not found at {}, using unbundled version", MANIFEST_PATH);
                return null;
            }
            
            String manifestContent = new BufferedReader(
                new InputStreamReader(is, StandardCharsets.UTF_8))
                    .lines()
                    .collect(Collectors.joining("\n"));
            
            JSONObject manifest = new JSONObject(manifestContent);
            if (manifest.has(sourceFile)) {
                JSONObject entry = manifest.getJSONObject(sourceFile);
                if (entry.has("file")) {
                    String bundledFile = entry.getString("file");
                    logger.debug("Mapped {} to {}", sourceFile, bundledFile);
                    return "/" + bundledFile;
                }
            }
            
            logger.debug("Source file {} not found in Vite manifest", sourceFile);
            return null;
            
        } catch (Exception e) {
            logger.warn("Error reading Vite manifest: {}", e.getMessage());
            return null;
        }
    }
    
    /**
     * Check if Vite manifest is available.
     * 
     * @param servletContext the servlet context to check
     * @return true if manifest exists, false otherwise
     */
    public static boolean isManifestAvailable(ServletContext servletContext) {
        InputStream is = servletContext.getResourceAsStream(MANIFEST_PATH);
        boolean available = is != null;
        if (is != null) {
            try {
                is.close();
            } catch (Exception e) {
                logger.trace("Error closing stream", e);
            }
        }
        return available;
    }
}
