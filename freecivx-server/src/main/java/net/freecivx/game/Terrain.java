package net.freecivx.game;

public class Terrain {
    private String name;          // Name of the terrain
    private String graphicsStr;   // String for terrain graphics or texture

    // Constructor
    public Terrain(String name, String graphicsStr) {
        this.name = name;
        this.graphicsStr = graphicsStr;
    }

    // Getter for name
    public String getName() {
        return name;
    }

    // Setter for name
    public void setName(String name) {
        this.name = name;
    }

    // Getter for graphicsStr
    public String getGraphicsStr() {
        return graphicsStr;
    }

    // Setter for graphicsStr
    public void setGraphicsStr(String graphicsStr) {
        this.graphicsStr = graphicsStr;
    }

    // Method to display terrain information
    @Override
    public String toString() {
        return "Terrain{name='" + name + "', graphicsStr='" + graphicsStr + "'}";
    }
}
