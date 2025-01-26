/* Copyright (C) The Authors 2025 */
package net.freecivx.game;

public class Tile {

  private long index;
  private int known;
  private int terrain;
  private int resource;
  private int extras;
  private int height;

  // Constructor to initialize a Tile with random values
  public Tile(long index, int known, int terrain, int resource, int extras, int height) {
    this.index = index;
    this.known = known;
    this.terrain = terrain;
    this.resource = resource;
    this.extras = extras;
    this.height = height;
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

  @Override
  public String toString() {
    return "Tile{"
        + "index="
        + index
        + ", known="
        + known
        + ", terrain="
        + terrain
        + ", resource="
        + resource
        + ", extras="
        + extras
        + ", height="
        + height
        + '}';
  }
}
