package net.freecivx.game;

public class Extra {
    private String name;

    // Constructor
    public Extra(String name) {
        this.name = name;
    }

    // Getter for the name field
    public String getName() {
        return name;
    }

    // Setter for the name field
    public void setName(String name) {
        this.name = name;
    }

    // Overriding the toString method for a meaningful representation
    @Override
    public String toString() {
        return "Extra{name='" + name + "'}";
    }
}
