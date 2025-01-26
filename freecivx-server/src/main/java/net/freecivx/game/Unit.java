/* Copyright (C) The Authors 2025 */
package net.freecivx.game;

public class Unit {

  private long id;
  private int owner; // ID of the player or entity that owns the unit
  private int tile; // The tile where the unit is located
  private int type; // The type of the unit (e.g., an ID referring to UnitType)
  private int facing; // The direction the unit is facing (e.g., could represent angles or cardinal
  // directions)
  private int veteran; // Veteran level of the unit
  private int hp; // Current hit points of the unit
  private int activity; // The current activity or status of the unit

  // Constructor
  public Unit(
      long id, int owner, int tile, int type, int facing, int veteran, int hp, int activity) {
    this.id = id;
    this.owner = owner;
    this.tile = tile;
    this.type = type;
    this.facing = facing;
    this.veteran = veteran;
    this.hp = hp;
    this.activity = activity;
  }

  public long getId() {
    return id;
  }

  public void setId(long id) {
    this.id = id;
  }

  // Getters
  public int getOwner() {
    return owner;
  }

  public int getTile() {
    return tile;
  }

  public void setTile(int tile) {
    this.tile = tile;
  }

  public int getType() {
    return type;
  }

  public int getFacing() {
    return facing;
  }

  public void setFacing(int facing) {
    this.facing = facing;
  }

  public int getVeteran() {
    return veteran;
  }

  public int getHp() {
    return hp;
  }

  public int getActivity() {
    return activity;
  }

  // Optional toString method for debugging
  @Override
  public String toString() {
    return "Unit{"
        + "owner="
        + owner
        + ", tile="
        + tile
        + ", type="
        + type
        + ", facing="
        + facing
        + ", veteran="
        + veteran
        + ", hp="
        + hp
        + ", activity="
        + activity
        + '}';
  }
}
