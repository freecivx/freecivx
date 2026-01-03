/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.FreecivWorld.net/
 Copyright (C) 2009-2025  The Freeciv-web project, Andreas Røsdal

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

package net.freecivx.game;

public class City {

    private String name;
    private long owner;
    private long tile;
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
    public City(String name, long owner, long tile, int size, int style, boolean capital, boolean occupied, int walls,
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

    public long getOwner() {
        return owner;
    }

    public void setOwner(long owner) {
        this.owner = owner;
    }

    public long getTile() {
        return tile;
    }

    public void setTile(long tile) {
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
