package net.freecivx.client.game;

import com.jme3.asset.AssetManager;
import com.jme3.material.Material;
import com.jme3.math.ColorRGBA;
import com.jme3.math.FastMath;
import com.jme3.math.Quaternion;
import com.jme3.math.Vector3f;
import com.jme3.scene.Geometry;
import com.jme3.scene.Node;
import com.jme3.scene.shape.Quad;

public class GameMapRenderer {
    private final AssetManager assetManager;
    private final Node rootNode;

    private static final int MAP_SIZE = 10; // 10x10 grid
    private static final float TILE_SIZE = 1.0f; // Size of each tile

    public GameMapRenderer(AssetManager assetManager, Node rootNode) {
        this.assetManager = assetManager;
        this.rootNode = rootNode;
    }

    public void generateMap() {
        Node mapNode = new Node("Game Map");

        for (int x = 0; x < MAP_SIZE; x++) {
            for (int y = 0; y < MAP_SIZE; y++) {
                createTile(mapNode, x, y);
            }
        }

        rootNode.attachChild(mapNode);
        adjustCamera();
    }

    private void createTile(Node mapNode, int x, int y) {
        // Create a single tile using a Quad
        Quad quad = new Quad(TILE_SIZE, TILE_SIZE);
        Geometry tileGeom = new Geometry("Tile_" + x + "_" + y, quad);

        // **Rotate the Quad so it lies flat on the X-Z plane**
        tileGeom.setLocalRotation(new Quaternion().fromAngleAxis(-FastMath.HALF_PI, Vector3f.UNIT_X));

        // Set position (adjust for centering)
        tileGeom.setLocalTranslation(x * TILE_SIZE, 0, -y * TILE_SIZE);

        // Assign material based on terrain type
        Material tileMat = new Material(assetManager, "Common/MatDefs/Misc/Unshaded.j3md");
        tileMat.setColor("Color", getTerrainColor(x, y));
        tileGeom.setMaterial(tileMat);

        mapNode.attachChild(tileGeom);
    }

    private ColorRGBA getTerrainColor(int x, int y) {
        // Basic procedural terrain generation
        int sum = (x + y) % 4;
        switch (sum) {
            case 0: return ColorRGBA.Green;  // Grass
            case 1: return ColorRGBA.Blue;   // Water
            case 2: return ColorRGBA.Brown;  // Hills
            case 3: return ColorRGBA.White;  // Mountains
            default: return ColorRGBA.Green;
        }
    }

    private void adjustCamera() {
        // Position the camera for a top-down isometric view
        rootNode.setLocalTranslation(-MAP_SIZE / 2f, -2f, -MAP_SIZE / 2f);
    }
}
