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

/**
 * Represents a city building/improvement type (e.g. Barracks, Library).
 */
public class Improvement {

    private long id;
    private String name;
    private String ruleName;
    private String graphicStr;
    private String graphicAlt;
    private int genus;        // 0=GreatWonder, 1=SmallWonder, 2=Improvement, 3=Special
    private int buildCost;
    private int upkeep;
    private int sabotage;
    private String soundtag;
    private String soundtagAlt;
    private String helptext;
    private long techReqId;   // Technology required to build (-1 = none)

    public Improvement(long id, String name, String ruleName, String graphicStr,
                       String graphicAlt, int genus, int buildCost, int upkeep,
                       int sabotage, String soundtag, String soundtagAlt,
                       String helptext, long techReqId) {
        this.id = id;
        this.name = name;
        this.ruleName = ruleName;
        this.graphicStr = graphicStr;
        this.graphicAlt = graphicAlt;
        this.genus = genus;
        this.buildCost = buildCost;
        this.upkeep = upkeep;
        this.sabotage = sabotage;
        this.soundtag = soundtag;
        this.soundtagAlt = soundtagAlt;
        this.helptext = helptext;
        this.techReqId = techReqId;
    }

    public long getId() { return id; }
    public String getName() { return name; }
    public String getRuleName() { return ruleName; }
    public String getGraphicStr() { return graphicStr; }
    public String getGraphicAlt() { return graphicAlt; }
    public int getGenus() { return genus; }
    public int getBuildCost() { return buildCost; }
    public int getUpkeep() { return upkeep; }
    public int getSabotage() { return sabotage; }
    public String getSoundtag() { return soundtag; }
    public String getSoundtagAlt() { return soundtagAlt; }
    public String getHelptext() { return helptext; }
    public long getTechReqId() { return techReqId; }

    @Override
    public String toString() {
        return "Improvement{id=" + id + ", name='" + name + "'}";
    }
}
