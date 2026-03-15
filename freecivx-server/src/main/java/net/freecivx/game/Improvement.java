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

    /**
     * Name of the technology that makes this improvement obsolete, as read from
     * the {@code obsolete_by} table in the buildings ruleset.  {@code null} means
     * the building never becomes obsolete via technology.
     * Mirrors the {@code obsolete_by} Tech-type requirement in the C Freeciv server's
     * {@code server/cityturn.c:remove_obsolete_buildings_city()}.
     */
    private String obsoletedByTechName = null;

    /**
     * Name of the city improvement that must already be present in the city
     * before this improvement can be built.  {@code null} means no building
     * prerequisite.  Parsed from the first {@code "Building"} / {@code "City"}
     * row of the {@code reqs} table in the buildings ruleset.
     * Mirrors {@code can_city_build_improvement_direct()} in the C Freeciv
     * server's {@code common/city.c}.
     */
    private String requiredBuildingName = null;

    /**
     * Whether this improvement requires the city to be on a coastal tile
     * (i.e. at least one adjacent tile must have ocean terrain).
     * Parsed from {@code "TerrainClass", "Oceanic", "Adjacent"} rows in the
     * buildings ruleset's {@code reqs} table.
     * Examples: Harbor, Coastal Defense, Port Facility, Offshore Platform.
     * Mirrors the {@code TerrainClass} requirement check in the C Freeciv
     * server's {@code can_city_build_improvement_direct()} in
     * {@code common/city.c}.
     */
    private boolean requiresCoastal = false;

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

    /**
     * Returns the name of the technology that makes this improvement obsolete,
     * or {@code null} if no technology obsoletes it.
     */
    public String getObsoletedByTechName() { return obsoletedByTechName; }

    /**
     * Sets the name of the technology that makes this improvement obsolete.
     * Called during ruleset loading once the {@code obsolete_by} table has been parsed.
     *
     * @param techName the technology name, or {@code null} for none
     */
    public void setObsoletedByTechName(String techName) { this.obsoletedByTechName = techName; }

    /**
     * Returns the name of the city improvement that must be present in a city
     * before this improvement can be built, or {@code null} if none is required.
     * Mirrors the {@code "Building"/"City"} requirement rows from the C Freeciv
     * server's buildings ruleset.
     */
    public String getRequiredBuildingName() { return requiredBuildingName; }

    /**
     * Sets the required building prerequisite name.
     * Called during ruleset loading when a {@code "Building"} / {@code "City"}
     * entry is found in the {@code reqs} table.
     *
     * @param buildingName the prerequisite building name, or {@code null} for none
     */
    public void setRequiredBuildingName(String buildingName) { this.requiredBuildingName = buildingName; }

    /**
     * Returns {@code true} if this improvement requires the city to be coastal
     * (at least one adjacent tile must be ocean terrain).
     */
    public boolean isRequiresCoastal() { return requiresCoastal; }

    /**
     * Sets whether this improvement requires a coastal city.
     * Called during ruleset loading when a {@code "TerrainClass", "Oceanic",
     * "Adjacent"} entry is found in the {@code reqs} table.
     *
     * @param requiresCoastal {@code true} if a coastal city is required
     */
    public void setRequiresCoastal(boolean requiresCoastal) { this.requiresCoastal = requiresCoastal; }

    @Override
    public String toString() {
        return "Improvement{id=" + id + ", name='" + name + "'}";
    }
}
