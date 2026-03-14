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
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class Player {

    private long connectionId;
    private String username;
    private String address;
    private int nation;
    private boolean is_alive = true;
    private boolean isAi = false;
    private List<Boolean> real_embassy = new ArrayList<Boolean>();

    // Research state (mirrors player_research in C Freeciv server)
    /** Set of technology IDs this player has already researched. */
    private Set<Long> knownTechs = new HashSet<>();
    /** Accumulated science bulbs towards the current research target. */
    private int bulbsResearched = 0;
    /** ID of the technology currently being researched; -1 = none chosen. */
    private long researchingTech = -1L;
    /**
     * ID of the long-term technology the player is aiming to eventually reach.
     * Mirrors {@code tech_goal} in the C Freeciv player_research struct.
     * The AI and notifications use this to plan prerequisite research paths.
     * -1 means no goal is set.
     */
    private long techGoal = -1L;

    // Economic state
    /** Player's current gold treasury. */
    private int gold = 0;
    /** Percentage of trade output directed to science (0-100). */
    private int scienceRate = 50;
    /** ID of the player's current government form. */
    private int governmentId = 1; // 1 = Despotism by default

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

    public boolean isAi() {
        return isAi;
    }

    public void setAi(boolean isAi) {
        this.isAi = isAi;
    }

    public List<Boolean> getReal_embassy() {
        return real_embassy;
    }

    public void setReal_embassy(List<Boolean> real_embassy) {
        this.real_embassy = real_embassy;
    }

    // Research state accessors

    /**
     * Returns the set of technology IDs this player has researched.
     * Mirrors the {@code inventions} array in the C Freeciv player_research struct.
     */
    public Set<Long> getKnownTechs() {
        return knownTechs;
    }

    /** Returns {@code true} if this player knows the technology with the given ID. */
    public boolean hasTech(long techId) {
        return knownTechs.contains(techId);
    }

    /** Adds a technology to this player's known-technology set. */
    public void addKnownTech(long techId) {
        knownTechs.add(techId);
    }

    public int getBulbsResearched() {
        return bulbsResearched;
    }

    public void setBulbsResearched(int bulbsResearched) {
        this.bulbsResearched = bulbsResearched;
    }

    public long getResearchingTech() {
        return researchingTech;
    }

    public void setResearchingTech(long researchingTech) {
        this.researchingTech = researchingTech;
    }

    /**
     * Returns the ID of the technology goal (the tech the player ultimately wants).
     * Mirrors {@code tech_goal} in the C Freeciv player_research struct.
     * Returns -1 if no goal has been set.
     */
    public long getTechGoal() {
        return techGoal;
    }

    /**
     * Sets the player's long-term technology goal.
     * When the current research completes without a new target, the system
     * can automatically select the next prerequisite towards this goal.
     *
     * @param techGoal ID of the desired technology, or -1 to clear
     */
    public void setTechGoal(long techGoal) {
        this.techGoal = techGoal;
    }

    // Economic state accessors

    public int getGold() {
        return gold;
    }

    public void setGold(int gold) {
        this.gold = gold;
    }

    /** Returns the percentage of trade directed to science (0-100). */
    public int getScienceRate() {
        return scienceRate;
    }

    public void setScienceRate(int scienceRate) {
        this.scienceRate = scienceRate;
    }

    /** Returns the ID of this player's current government type. */
    public int getGovernmentId() {
        return governmentId;
    }

    public void setGovernmentId(int governmentId) {
        this.governmentId = governmentId;
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
