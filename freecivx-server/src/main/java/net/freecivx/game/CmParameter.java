/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.freecivx.com/
 Copyright (C) 2009-2025  The Freeciv-web project

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
 * City Management Algorithm (CMA) parameters for a city governor.
 * Mirrors the {@code cm_parameter} struct in the C Freeciv server's
 * {@code common/aicore/cm.h} and the {@code cm_parameter} field in
 * {@code PACKET_WEB_CMA_SET} (packets.def).
 *
 * <p>The six production indices used throughout this class are:
 * <ol start="0">
 *   <li>food</li>
 *   <li>shields</li>
 *   <li>trade</li>
 *   <li>gold  (derived from trade × tax rate)</li>
 *   <li>luxury (derived from trade × luxury rate)</li>
 *   <li>science (derived from trade × science rate)</li>
 * </ol>
 */
public class CmParameter {

    /** Minimum required surplus for each of the 6 output types. */
    private int[] minimalSurplus = new int[6];

    /** Weight factors for each of the 6 output types (0 = ignore, 6 = prioritise). */
    private int[] factor = new int[6];

    /** If {@code true} the city must be celebrating (all citizens happy). */
    private boolean requireHappy;

    /** If {@code true} civil disorder is tolerated. */
    private boolean allowDisorder;

    /** If {@code true} specialists may be used to fill idle citizen slots. */
    private boolean allowSpecialists;

    /** Weight applied to the city happiness score. */
    private int happyFactor;

    /**
     * If {@code true} the governor should maximise food surplus (city growth).
     * Mirrors the {@code max_growth} field in {@code PACKET_WEB_CMA_SET}.
     */
    private boolean maxGrowth;

    public int[] getMinimalSurplus() {
        return minimalSurplus;
    }

    public void setMinimalSurplus(int[] minimalSurplus) {
        this.minimalSurplus = minimalSurplus;
    }

    public int[] getFactor() {
        return factor;
    }

    public void setFactor(int[] factor) {
        this.factor = factor;
    }

    public boolean isRequireHappy() {
        return requireHappy;
    }

    public void setRequireHappy(boolean requireHappy) {
        this.requireHappy = requireHappy;
    }

    public boolean isAllowDisorder() {
        return allowDisorder;
    }

    public void setAllowDisorder(boolean allowDisorder) {
        this.allowDisorder = allowDisorder;
    }

    public boolean isAllowSpecialists() {
        return allowSpecialists;
    }

    public void setAllowSpecialists(boolean allowSpecialists) {
        this.allowSpecialists = allowSpecialists;
    }

    public int getHappyFactor() {
        return happyFactor;
    }

    public void setHappyFactor(int happyFactor) {
        this.happyFactor = happyFactor;
    }

    public boolean isMaxGrowth() {
        return maxGrowth;
    }

    public void setMaxGrowth(boolean maxGrowth) {
        this.maxGrowth = maxGrowth;
    }
}
