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

public class Player {

    private long connectionId;
    private String username;
    private String address;
    private int nation;
    private boolean is_alive = true;
    private List<Boolean> real_embassy = new ArrayList<Boolean>();

    // Constructor
    public Player(long connId, String username, String addr, int nation) {
        this.connectionId = connId;
        this.username = username;
        this.address = addr;
        this.nation = nation;
    }

    // Getters and Setters
    public long getConnectionId() {
        return connectionId;
    }

    public void setConnectionId(long connectionId) {
        this.connectionId = connectionId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public int getNation() {
        return nation;
    }

    public void setNation(int nation) {
        this.nation = nation;
    }

    public long getPlayerNo() {
        return this.connectionId;
    }

    public boolean isAlive() {
        return is_alive;
    }

    public void setAlive(boolean is_alive) {
        this.is_alive = is_alive;
    }

    public List<Boolean> getReal_embassy() {
        return real_embassy;
    }

    public void setReal_embassy(List<Boolean> real_embassy) {
        this.real_embassy = real_embassy;
    }

    // Utility methods
    @Override
    public String toString() {
        return "Player{" +
                "connectionId=" + connectionId +
                ", username='" + username + '\'' +
                ", address='" + address + '\'' +
                ", nation=" + nation +
                '}';
    }

}
