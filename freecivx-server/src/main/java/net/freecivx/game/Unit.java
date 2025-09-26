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

public class Unit {

    private long id;
    private long owner;        // ID of the player or entity that owns the unit
    private long tile;         // The tile where the unit is located
    private int type;         // The type of the unit (e.g., an ID referring to UnitType)
    private int facing;       // The direction the unit is facing (e.g., could represent angles or cardinal directions)
    private int veteran;      // Veteran level of the unit
    private int hp;           // Current hit points of the unit
    private int activity = 0;     // The current activity or status of the unit
    private int movesleft;
    private boolean done_moving = false;
    private boolean transported = false;
    private int ssa_controller = 0;

    // Constructor
    public Unit(long id, long owner, long tile, int type, int facing, int veteran, int hp, int activity, int movesleft) {
        this.id = id;
        this.owner = owner;
        this.tile = tile;
        this.type = type;
        this.facing = facing;
        this.veteran = veteran;
        this.hp = hp;
        this.activity = activity;
        this.movesleft = movesleft;
    }

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    // Getters
    public long getOwner() {
        return owner;
    }

    public long getTile() {
        return tile;
    }

    public void setTile(long tile) {
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


    public int getMovesleft() {
        return movesleft;
    }

    public void setMovesleft(int movesleft) {
        this.movesleft = movesleft;
    }

    public void setActivity(int activity) {
        this.activity = activity;
    }

    public boolean isDoneMoving() {
        return done_moving;
    }

    public void setDoneMoving(boolean done_moving) {
        this.done_moving = done_moving;
    }

    public int getSsa_controller() {
        return ssa_controller;
    }

    public void setSsa_controller(int ssa_controller) {
        this.ssa_controller = ssa_controller;
    }

    public boolean isTransported() {
        return transported;
    }

    public void setTransported(boolean transported) {
        this.transported = transported;
    }

    // Optional toString method for debugging
    @Override
    public String toString() {
        return "Unit{" +
                "owner=" + owner +
                ", tile=" + tile +
                ", type=" + type +
                ", facing=" + facing +
                ", veteran=" + veteran +
                ", hp=" + hp +
                ", activity=" + activity +
                '}';
    }
}
