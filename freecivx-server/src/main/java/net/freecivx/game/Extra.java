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

public class Extra {
    private String name;

    // Constructor
    public Extra(String name) {
        this.name = name;
    }

    // Getter for the name field
    public String getName() {
        return name;
    }

    // Setter for the name field
    public void setName(String name) {
        this.name = name;
    }

    // Overriding the toString method for a meaningful representation
    @Override
    public String toString() {
        return "Extra{name='" + name + "'}";
    }
}
