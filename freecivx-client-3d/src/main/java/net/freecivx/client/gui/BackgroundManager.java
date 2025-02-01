package net.freecivx.client.gui;

import com.jme3.asset.AssetManager;
import com.jme3.math.Vector3f;
import com.jme3.renderer.Camera;
import com.jme3.scene.Geometry;
import com.jme3.scene.Node;
import com.jme3.scene.shape.Quad;
import com.jme3.material.Material;
import com.jme3.texture.Texture;

public class BackgroundManager {
    private final AssetManager assetManager;
    private final Node guiNode;
    private final Camera cam;
    private Geometry background;

    public BackgroundManager(AssetManager assetManager, Node guiNode, Camera cam) {
        this.assetManager = assetManager;
        this.guiNode = guiNode;
        this.cam = cam;
    }

    public void addBackgroundImage() {
        float screenWidth = cam.getWidth();
        float screenHeight = cam.getHeight();
        Quad quad = new Quad(screenWidth, screenHeight);

        background = new Geometry("Background", quad);
        Material mat = new Material(assetManager, "Common/MatDefs/Misc/Unshaded.j3md");
        Texture texture = assetManager.loadTexture("freecivx-splash.jpg");
        mat.setTexture("ColorMap", texture);
        background.setMaterial(mat);

        background.setLocalTranslation(0, 0, -10);
        guiNode.attachChild(background);
    }

    public void removeBackground() {
        if (background != null) {
            background.removeFromParent(); // Remove background when game starts
        }
    }
}
