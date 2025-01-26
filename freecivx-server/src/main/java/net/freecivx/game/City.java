package net.freecivx.game;

public class City {

    private String name;
    private int owner;
    private int tile;
    private int size;
    private int style;
    private boolean capital;
    private boolean occupied;
    private int walls;
    private boolean happy;
    private boolean unhappy;
    private String improvements; //FIXME: Should be int array or json array
    private int productionKind;
    private int productionValue;

    // Constructor
    public City(String name, int owner, int tile, int size, int style, boolean capital, boolean occupied, int walls,
                boolean happy, boolean unhappy, String improvements, int productionKind, int productionValue) {
        this.name = name;
        this.owner = owner;
        this.tile = tile;
        this.size = size;
        this.style = style;
        this.capital = capital;
        this.occupied = occupied;
        this.walls = walls;
        this.happy = happy;
        this.unhappy = unhappy;
        this.improvements = improvements;
        this.productionKind = productionKind;
        this.productionValue = productionValue;
    }

    // Getters and Setters
    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getOwner() {
        return owner;
    }

    public void setOwner(int owner) {
        this.owner = owner;
    }

    public int getTile() {
        return tile;
    }

    public void setTile(int tile) {
        this.tile = tile;
    }

    public int getSize() {
        return size;
    }

    public void setSize(int size) {
        this.size = size;
    }

    public int getStyle() {
        return style;
    }

    public void setStyle(int style) {
        this.style = style;
    }

    public boolean isCapital() {
        return capital;
    }

    public void setCapital(boolean capital) {
        this.capital = capital;
    }

    public boolean isOccupied() {
        return occupied;
    }

    public void setOccupied(boolean occupied) {
        this.occupied = occupied;
    }

    public int getWalls() {
        return walls;
    }

    public void setWalls(int walls) {
        this.walls = walls;
    }

    public boolean isHappy() {
        return happy;
    }

    public void setHappy(boolean happy) {
        this.happy = happy;
    }

    public boolean isUnhappy() {
        return unhappy;
    }

    public void setUnhappy(boolean unhappy) {
        this.unhappy = unhappy;
    }

    public String getImprovements() {
        return improvements;
    }

    public void setImprovements(String improvements) {
        this.improvements = improvements;
    }

    public int getProductionKind() {
        return productionKind;
    }

    public void setProductionKind(int productionKind) {
        this.productionKind = productionKind;
    }

    public int getProductionValue() {
        return productionValue;
    }

    public void setProductionValue(int productionValue) {
        this.productionValue = productionValue;
    }



    @Override
    public String toString() {
        return "City{" +
                "name='" + name + '\'' +
                ", owner=" + owner +
                ", tile=" + tile +
                ", size=" + size +
                ", style=" + style +
                ", capital=" + capital +
                ", occupied=" + occupied +
                ", walls=" + walls +
                ", happy=" + happy +
                ", unhappy=" + unhappy +
                ", improvements='" + improvements + '\'' +
                ", productionKind=" + productionKind +
                ", productionValue=" + productionValue +
                '}';
    }
}
