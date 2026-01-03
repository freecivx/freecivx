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

    // Constructor
    public Technology(String name, String graphicsStr, String legend) {
        this.name = name;
        this.graphicsStr = graphicsStr;
        this.helptext = legend;
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

    // Method to display information about the technology
    @Override
    public String toString() {
        return "Technology{" +
                "name='" + name + '\'' +
                ", graphicsStr='" + graphicsStr + '\'' +
                ", legend='" + helptext + '\'' +
                '}';
    }
}