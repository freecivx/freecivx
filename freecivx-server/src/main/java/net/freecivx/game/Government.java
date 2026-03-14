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

    // Constructor
    public Government(String name, String ruleName, String helptext) {
        this.name = name;
        this.ruleName = ruleName;
        this.helptext = helptext;
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

    @Override
    public String toString() {
        return "Government{" +
                "name='" + name + '\'' +
                ", ruleName='" + ruleName + '\'' +
                ", helptext='" + helptext + '\'' +
                '}';
    }
}
