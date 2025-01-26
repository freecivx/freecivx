package net.freecivx.game;

public class CityStyle {

    private String name;  // Name of the city style (e.g., "Ancient", "Medieval", "Modern")

    // Constructor
    public CityStyle(String name) {
        this.name = name;
    }

    // Getter
    public String getName() {
        return name;
    }

    // Optional toString method for debugging
    @Override
    public String toString() {
        return "CityStyle{" +
                "name='" + name + '\'' +
                '}';
    }
}
