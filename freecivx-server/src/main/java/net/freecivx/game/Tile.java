/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.Freecivx.net/
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

public class Tile {

    private long index;
    private int known;
    private int terrain;
    private int resource;
    private int extras;
    private int height;
    private long worked = -1;

    // Constructor to initialize a Tile with random values
    public Tile(long index, int known, int terrain, int resource, int extras, int height, long worked) {
        this.index = index;
        this.known = known;
        this.terrain = terrain;
        this.resource = resource;
        this.extras = extras;
        this.height = height;
        this.worked = worked;

    }

    // Getters
    public long getIndex() {
        return index;
    }

    public int getKnown() {
        return known;
    }

    public int getTerrain() {
        return terrain;
    }

    public int getResource() {
        return resource;
    }

    public int getExtras() {
        return extras;
    }

    public int getHeight() {
        return height;
    }

    public void setIndex(long index) {
        this.index = index;
    }

    public void setKnown(int known) {
        this.known = known;
    }

    public void setTerrain(int terrain) {
        this.terrain = terrain;
    }

    public void setResource(int resource) {
        this.resource = resource;
    }

    public void setExtras(int extras) {
        this.extras = extras;
    }

    public void setHeight(int height) {
        this.height = height;
    }

    public long getWorked() {
        return worked;
    }

    public void setWorked(long worked) {
        this.worked = worked;
    }

    public long getX(long mapWidth) {
        return index % mapWidth;
    }

    public long getY(long mapWidth) {
        return index / mapWidth;
    }

    @Override
    public String toString() {
        return "Tile{" +
                "index=" + index +
                ", known=" + known +
                ", terrain=" + terrain +
                ", resource=" + resource +
                ", extras=" + extras +
                ", height=" + height +
                '}';
    }
}
