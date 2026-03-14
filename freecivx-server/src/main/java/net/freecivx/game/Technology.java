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

public class Technology {

    private String name; // Name of the technology
    private String graphicsStr; // Graphics identifier for the technology
    private String helptext; // Description or legend of the technology
    /** Name of the first prerequisite technology, or "None" if no prerequisite. */
    private String prereq1 = "None";
    /** Name of the second prerequisite technology, or "None" if no prerequisite. */
    private String prereq2 = "None";
    /** Base research cost (bulbs required); 0 means use default scaling. */
    private int cost = 0;

    // Constructor (backwards-compatible)
    public Technology(String name, String graphicsStr, String legend) {
        this.name = name;
        this.graphicsStr = graphicsStr;
        this.helptext = legend;
    }

    public Technology(String name, String graphicsStr, String helptext,
                      String prereq1, String prereq2, int cost) {
        this.name = name;
        this.graphicsStr = graphicsStr;
        this.helptext = helptext;
        this.prereq1 = prereq1 != null ? prereq1 : "None";
        this.prereq2 = prereq2 != null ? prereq2 : "None";
        this.cost = cost;
    }

    // Getter for name
    public String getName() {
        return name;
    }

    // Setter for name
    public void setName(String name) {
        this.name = name;
    }

    // Getter for graphicsStr
    public String getGraphicsStr() {
        return graphicsStr;
    }

    // Setter for graphicsStr
    public void setGraphicsStr(String graphicsStr) {
        this.graphicsStr = graphicsStr;
    }

    // Getter for legend
    public String getHelptext() {
        return helptext;
    }

    // Setter for legend
    public void setHelptext(String helptext) {
        this.helptext = helptext;
    }

    /**
     * Returns the name of the first prerequisite technology required before this
     * one can be researched.  Mirrors {@code req1} in the Freeciv techs ruleset.
     * Returns "None" when no prerequisite is needed.
     */
    public String getPrereq1() {
        return prereq1;
    }

    public void setPrereq1(String prereq1) {
        this.prereq1 = prereq1 != null ? prereq1 : "None";
    }

    /**
     * Returns the name of the second prerequisite technology.
     * Returns "None" when not required.
     */
    public String getPrereq2() {
        return prereq2;
    }

    public void setPrereq2(String prereq2) {
        this.prereq2 = prereq2 != null ? prereq2 : "None";
    }

    /**
     * Returns the explicit bulb cost defined in the ruleset (0 = use default
     * scaling formula as in the C server's {@code researchTechCost}).
     */
    public int getCost() {
        return cost;
    }

    public void setCost(int cost) {
        this.cost = cost;
    }

    // Method to display information about the technology
    @Override
    public String toString() {
        return "Technology{" +
                "name='" + name + '\'' +
                ", graphicsStr='" + graphicsStr + '\'' +
                ", legend='" + helptext + '\'' +
                ", prereq1='" + prereq1 + '\'' +
                ", prereq2='" + prereq2 + '\'' +
                '}';
    }
}