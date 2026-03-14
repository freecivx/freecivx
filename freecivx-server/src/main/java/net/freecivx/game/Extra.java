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

public class Extra {
    private String name;
    /**
     * Bitvector of causes that produce this extra (EC_* constants from fc_types.js /
     * common/fc_types.h).  Sent in PACKET_RULESET_EXTRA so the client can classify
     * extras as resources (EC_RESOURCE=8 → bit 256), huts (EC_HUT=6 → bit 64), etc.
     */
    private int causes;
    /**
     * Graphic tag used by the tileset renderer (e.g. "ts.fish", "ts.cattle").
     * Falls back to {@code name.toLowerCase()} when {@code null}.
     */
    private String graphicStr;

    /** Constructor for extras without a specific cause (e.g. River). */
    public Extra(String name) {
        this(name, 0, null);
    }

    /**
     * Constructor with causes bitvector and an optional tileset graphic tag.
     *
     * @param name       ruleset name of the extra
     * @param causes     EC_* bitvector (0 if none)
     * @param graphicStr tileset graphic tag, or {@code null} to use {@code name.toLowerCase()}
     */
    public Extra(String name, int causes, String graphicStr) {
        this.name = name;
        this.causes = causes;
        this.graphicStr = graphicStr;
    }

    // Getters
    public String getName() {
        return name;
    }

    public int getCauses() {
        return causes;
    }

    /**
     * Returns the tileset graphic tag.  Falls back to {@code name.toLowerCase()} when
     * no explicit tag was provided.
     */
    public String getGraphicStr() {
        return graphicStr != null ? graphicStr : name.toLowerCase();
    }

    // Setters
    public void setName(String name) {
        this.name = name;
    }

    public void setCauses(int causes) {
        this.causes = causes;
    }

    public void setGraphicStr(String graphicStr) {
        this.graphicStr = graphicStr;
    }

    @Override
    public String toString() {
        return "Extra{name='" + name + "', causes=" + causes + ", graphicStr='" + getGraphicStr() + "'}";
    }
}
