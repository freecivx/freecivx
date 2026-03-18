/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.freecivx.com/
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
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
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
    /**
     * Percentage of trade output directed to luxury goods (0-100).
     * Luxury goods make unhappy citizens content and content citizens happy.
     * Mirrors {@code economic.luxury} in the C Freeciv player struct.
     * Default 0: no luxury spending.
     */
    private int luxuryRate = 0;
    /**
     * Percentage of trade output directed to tax (gold) (0-100).
     * Must equal {@code 100 - scienceRate - luxuryRate}.
     * Mirrors {@code economic.tax} in the C Freeciv player struct.
     * Default 50: matching the default scienceRate of 50 with no luxury.
     */
    private int taxRate = 50;
    /** ID of the player's current government form. */
    private int governmentId = 1; // 1 = Despotism by default

    /**
     * Set of tile IDs that this player has ever seen.
     * A tile stays in this set even after it leaves the player's current field of
     * view (it is then rendered as TILE_KNOWN_UNSEEN / fogged).
     * Mirrors the per-player explored-tiles tracking in the C Freeciv server's
     * {@code maphand.c}.
     */
    private Set<Long> exploredTiles = new HashSet<>();

    /**
     * Set of tile IDs that this player can currently see (within the vision
     * radius of one of their units or cities).
     * Mirrors TILE_KNOWN_SEEN in the C Freeciv server.
     */
    private Set<Long> visibleTiles = new HashSet<>();

    /** True when the player has ended their phase (turn) for the current game turn. */
    private boolean phaseDone = false;
    /** Number of consecutive turns the player has been idle (no actions taken). */
    private int nturnsIdle = 0;
    /**
     * True when the player's WebSocket connection is currently open.
     * Set to false when the player disconnects.  Used to indicate
     * online/offline status to other players.
     */
    private boolean connected = true;

    // -------------------------------------------------------------------------
    // Diplomacy state (mirrors player_diplstate / player_ai in C Freeciv server)
    // -------------------------------------------------------------------------

    /**
     * Diplomatic relationship state with each other player, keyed by player ID.
     * Values mirror the {@code diplstate_type} enum in the C Freeciv server's
     * {@code common/player.h}: DS_WAR=1, DS_CEASEFIRE=2, DS_PEACE=3,
     * DS_ALLIANCE=4, DS_NO_CONTACT=5.
     * Absent entries are treated as DS_NO_CONTACT (5).
     */
    private final Map<Long, Integer> diplState = new HashMap<>();

    /**
     * Number of turns remaining on a ceasefire with each player.
     * Only meaningful when {@link #getDiplState(long)} returns {@code DS_CEASEFIRE}.
     * Mirrors {@code player_diplstate.turns_left} in the C Freeciv server.
     */
    private final Map<Long, Integer> ceasefireTurnsLeft = new HashMap<>();

    /**
     * AI "love" value toward each other player in the range [-1000, +1000].
     * High values drive peace/alliance offers; low values drive war declarations.
     * Mirrors {@code player_ai.love[]} in the C Freeciv server's
     * {@code common/player.h}.  Only meaningful for AI-controlled players.
     */
    private final Map<Long, Integer> aiLove = new HashMap<>();

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

    /**
     * Returns the percentage of trade directed to luxury goods (0-100).
     * Luxury goods make unhappy citizens content and content citizens happy,
     * mirroring the luxury output mechanics in the C Freeciv server.
     */
    public int getLuxuryRate() {
        return luxuryRate;
    }

    public void setLuxuryRate(int luxuryRate) {
        this.luxuryRate = luxuryRate;
    }

    /**
     * Returns the percentage of trade directed to tax/gold (0-100).
     * Equal to {@code 100 - scienceRate - luxuryRate}.
     */
    public int getTaxRate() {
        return taxRate;
    }

    public void setTaxRate(int taxRate) {
        this.taxRate = taxRate;
    }

    /** Returns the ID of this player's current government type. */
    public int getGovernmentId() {
        return governmentId;
    }

    public void setGovernmentId(int governmentId) {
        this.governmentId = governmentId;
    }

    /**
     * Returns the set of tile IDs this player has ever explored.
     * Tiles in this set but not in {@link #getVisibleTiles()} are shown as
     * fogged (TILE_KNOWN_UNSEEN).
     */
    public Set<Long> getExploredTiles() {
        return exploredTiles;
    }

    /**
     * Returns the set of tile IDs currently visible to this player
     * (TILE_KNOWN_SEEN).  Updated whenever a unit or city changes position.
     */
    public Set<Long> getVisibleTiles() {
        return visibleTiles;
    }

    /** Replaces the currently-visible tile set with a new computed set. */
    public void setVisibleTiles(Set<Long> visibleTiles) {
        this.visibleTiles = visibleTiles;
    }

    /**
     * Returns {@code true} if the player has completed their phase (turn) this game turn.
     * Mirrors {@code phase_done} in the C Freeciv player struct.
     */
    public boolean isPhaseDone() {
        return phaseDone;
    }

    public void setPhaseDone(boolean phaseDone) {
        this.phaseDone = phaseDone;
    }

    /**
     * Returns the number of consecutive turns the player has been idle.
     * Mirrors {@code nturns_idle} in the C Freeciv player struct.
     */
    public int getNturnsIdle() {
        return nturnsIdle;
    }

    public void setNturnsIdle(int nturnsIdle) {
        this.nturnsIdle = nturnsIdle;
    }

    /** Returns {@code true} when the player's WebSocket connection is currently open. */
    public boolean isConnected() {
        return connected;
    }

    /** Sets the connection status of this player. */
    public void setConnected(boolean connected) {
        this.connected = connected;
    }


    @Override
    public String toString() {
        return "Player{" +
                "connectionId=" + connectionId +
                ", username='" + username + '\'' +
                ", address='" + address + '\'' +
                ", nation=" + nation +
                '}';
    }

    // -------------------------------------------------------------------------
    // Diplomacy accessors
    // -------------------------------------------------------------------------

    /**
     * Returns the diplomatic state toward another player.
     * Mirrors {@code player_diplstate.type} in the C Freeciv server.
     *
     * @param otherId the other player's connection ID
     * @return the diplomatic state (DS_WAR=1, DS_CEASEFIRE=2, DS_PEACE=3,
     *         DS_ALLIANCE=4, DS_NO_CONTACT=5)
     */
    public int getDiplState(long otherId) {
        return diplState.getOrDefault(otherId, 5); // 5 = DS_NO_CONTACT
    }

    /**
     * Sets the diplomatic state toward another player.
     *
     * @param otherId the other player's connection ID
     * @param state   the diplomatic state to set
     */
    public void setDiplState(long otherId, int state) {
        diplState.put(otherId, state);
    }

    /**
     * Returns the full diplomacy state map (player ID → state).
     * Modifications to the returned map are reflected in this player's state.
     */
    public Map<Long, Integer> getDiplStateMap() {
        return diplState;
    }

    /**
     * Returns turns left on the ceasefire with the given player (0 if none).
     * Mirrors {@code player_diplstate.turns_left} in the C Freeciv server.
     */
    public int getCeasefireTurnsLeft(long otherId) {
        return ceasefireTurnsLeft.getOrDefault(otherId, 0);
    }

    /**
     * Sets the ceasefire countdown with the given player.
     *
     * @param otherId    the other player's connection ID
     * @param turnsLeft  number of turns remaining
     */
    public void setCeasefireTurnsLeft(long otherId, int turnsLeft) {
        if (turnsLeft <= 0) {
            ceasefireTurnsLeft.remove(otherId);
        } else {
            ceasefireTurnsLeft.put(otherId, turnsLeft);
        }
    }

    /**
     * Returns the full ceasefire-turns-left map (player ID → turns).
     */
    public Map<Long, Integer> getCeasefireTurnsLeftMap() {
        return ceasefireTurnsLeft;
    }

    /**
     * Returns this player's AI love value toward the given player.
     * Range: {@code [-1000, +1000]}.  Defaults to 0 (neutral) for unknown players.
     * Mirrors {@code player_ai.love[]} in the C Freeciv server.
     *
     * @param otherId the other player's connection ID
     * @return the love value
     */
    public int getAiLove(long otherId) {
        return aiLove.getOrDefault(otherId, 0);
    }

    /**
     * Sets this player's AI love value toward the given player.
     * Values are clamped to {@code [-1000, +1000]}.
     *
     * @param otherId the other player's connection ID
     * @param love    the love value (clamped to [-1000, +1000])
     */
    public void setAiLove(long otherId, int love) {
        aiLove.put(otherId, Math.max(-1000, Math.min(1000, love)));
    }

    /**
     * Adjusts this player's AI love value toward another player by {@code delta}.
     * Result is clamped to {@code [-1000, +1000]}.
     *
     * @param otherId the other player's connection ID
     * @param delta   signed adjustment to apply
     */
    public void adjustAiLove(long otherId, int delta) {
        setAiLove(otherId, getAiLove(otherId) + delta);
    }

    /**
     * Returns the full AI-love map (player ID → love value).
     */
    public Map<Long, Integer> getAiLoveMap() {
        return aiLove;
    }

}
