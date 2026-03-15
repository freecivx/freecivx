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

import java.util.ArrayList;
import java.util.List;

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
    /** IDs of improvements (buildings) present in this city. */
    private List<Integer> improvements = new ArrayList<>();
    private int productionKind;
    private int productionValue;
    /**
     * List of tile indices currently being worked by this city's citizens.
     * The first entry is always the city centre tile; additional entries are
     * assigned as the city grows.  Mirrors the worked-tile list maintained by
     * the C Freeciv server's city struct.
     */
    private List<Long> workedTiles = new ArrayList<>();
    /**
     * Production worklist: a queue of future production targets for this city.
     * Each element is a two-element {@code int[]} where {@code [0]} is the
     * internal production kind (0=unit, 1=improvement) and {@code [1]} is the
     * production target ID.  When the current production is completed the first
     * item in this list is promoted to become the active production target.
     * Mirrors the {@code worklist} field in the C Freeciv city struct.
     */
    private List<int[]> worklist = new ArrayList<>();

    /**
     * Accumulated production shields towards current build target.
     * Mirrors {@code shield_stock} in the C Freeciv city struct.
     */
    private int shieldStock = 0;
    /**
     * Accumulated food in the granary.
     * Mirrors {@code food_stock} in the C Freeciv city struct.
     */
    private int foodStock = 0;

    // Constructor (backwards-compatible: accepts the old String improvements arg and ignores it)
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
        // Old callers passed an empty String; migrate to list representation
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

    /** Returns the list of improvement IDs built in this city. */
    public List<Integer> getImprovements() {
        return improvements;
    }

    public void setImprovements(List<Integer> improvements) {
        this.improvements = improvements;
    }

    /** Returns {@code true} if the improvement with the given ID is built here. */
    public boolean hasImprovement(int improvementId) {
        return improvements.contains(improvementId);
    }

    /** Adds an improvement to the city if not already present. */
    public void addImprovement(int improvementId) {
        if (!improvements.contains(improvementId)) {
            improvements.add(improvementId);
        }
    }

    /** Returns the list of tile indices currently worked by this city. */
    public List<Long> getWorkedTiles() {
        return workedTiles;
    }

    /**
     * Registers a tile as being worked by this city.
     * Does nothing if the tile is already in the list.
     *
     * @param tileId the index of the tile to mark as worked
     */
    public void addWorkedTile(long tileId) {
        if (!workedTiles.contains(tileId)) {
            workedTiles.add(tileId);
        }
    }

    /**
     * Removes a tile from this city's worked list.
     *
     * @param tileId the index of the tile to unmark
     */
    public void removeWorkedTile(long tileId) {
        workedTiles.remove(Long.valueOf(tileId));
    }

    /**
     * Returns the production worklist for this city.
     * Each element is {@code int[]{internalKind, productionValue}} where
     * {@code internalKind} is 0 for a unit type and 1 for an improvement.
     *
     * @return the mutable worklist; never {@code null}
     */
    public List<int[]> getWorklist() {
        return worklist;
    }

    /**
     * Replaces the production worklist with the given list.
     *
     * @param worklist the new worklist; must not be {@code null}
     * @throws NullPointerException if {@code worklist} is {@code null}
     */
    public void setWorklist(List<int[]> worklist) {
        this.worklist = java.util.Objects.requireNonNull(worklist, "worklist");
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

    /** Returns the accumulated shields in the production queue. */
    public int getShieldStock() {
        return shieldStock;
    }

    public void setShieldStock(int shieldStock) {
        this.shieldStock = shieldStock;
    }

    /** Returns the food stored in the city granary. */
    public int getFoodStock() {
        return foodStock;
    }

    public void setFoodStock(int foodStock) {
        this.foodStock = foodStock;
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
                ", improvements=" + improvements +
                ", productionKind=" + productionKind +
                ", productionValue=" + productionValue +
                ", shieldStock=" + shieldStock +
                '}';
    }
}

