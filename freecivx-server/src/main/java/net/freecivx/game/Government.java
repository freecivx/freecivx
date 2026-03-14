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

public class Government {

    private String name;
    private String ruleName;
    private String helptext;
    /**
     * Name of the technology required before a player can adopt this government.
     * Mirrors the {@code reqs} tech entry in the Freeciv governments ruleset.
     * {@code null} or "None" means no prerequisite (e.g. Anarchy, Despotism).
     */
    private String techReq;
    /**
     * Corruption percentage applied to city trade output under this government.
     * Mirrors the corruption/waste effects in the C Freeciv effects system.
     * Value is a percentage (e.g. 20 means 20% of trade is lost to corruption).
     */
    private int corruptionPct;

    // Constructor (backwards-compatible)
    public Government(String name, String ruleName, String helptext) {
        this(name, ruleName, helptext, null, 0);
    }

    public Government(String name, String ruleName, String helptext,
                      String techReq, int corruptionPct) {
        this.name = name;
        this.ruleName = ruleName;
        this.helptext = helptext;
        this.techReq = techReq;
        this.corruptionPct = corruptionPct;
    }

    // Getters
    public String getName() {
        return name;
    }

    public String getRuleName() {
        return ruleName;
    }

    public String getHelptext() {
        return helptext;
    }

    /**
     * Returns the name of the technology required to adopt this government, or
     * {@code null} if no prerequisite exists.
     */
    public String getTechReq() {
        return techReq;
    }

    /**
     * Returns the corruption percentage applied to city trade under this
     * government (e.g. 20 = 20% of trade lost to corruption).
     */
    public int getCorruptionPct() {
        return corruptionPct;
    }

    // Setters (if needed)
    public void setName(String name) {
        this.name = name;
    }

    public void setRuleName(String ruleName) {
        this.ruleName = ruleName;
    }

    public void setHelptext(String helptext) {
        this.helptext = helptext;
    }

    public void setTechReq(String techReq) {
        this.techReq = techReq;
    }

    public void setCorruptionPct(int corruptionPct) {
        this.corruptionPct = corruptionPct;
    }

    @Override
    public String toString() {
        return "Government{" +
                "name='" + name + '\'' +
                ", ruleName='" + ruleName + '\'' +
                ", helptext='" + helptext + '\'' +
                '}';
    }
}
