package net.freecivx.game;

public class Technology {

    private String name; // Name of the technology
    private String graphicsStr; // Graphics identifier for the technology
    private String helptext; // Description or legend of the technology

    // Constructor
    public Technology(String name, String graphicsStr, String legend) {
        this.name = name;
        this.graphicsStr = graphicsStr;
        this.helptext = legend;
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

    // Getter for legend
    public String getHelptext() {
        return helptext;
    }

    // Setter for legend
    public void setHelptext(String helptext) {
        this.helptext = helptext;
    }

    // Method to display information about the technology
    @Override
    public String toString() {
        return "Technology{" +
                "name='" + name + '\'' +
                ", graphicsStr='" + graphicsStr + '\'' +
                ", legend='" + helptext + '\'' +
                '}';
    }
}