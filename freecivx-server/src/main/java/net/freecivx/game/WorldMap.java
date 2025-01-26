package net.freecivx.game;

public class WorldMap {

    private int xsize;
    private int ysize;

    public WorldMap(int xsize, int ysize) {
        this.xsize = xsize;
        this.ysize = ysize;
    }

    public int getXsize() {
        return xsize;
    }

    public int getYsize() {
        return ysize;
    }
}
