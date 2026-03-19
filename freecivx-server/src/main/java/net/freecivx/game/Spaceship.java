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

/**
 * Represents a player's spaceship in the Space Race.
 * Mirrors {@code struct player_spaceship} from the C Freeciv server's
 * {@code common/spaceship.h} and the logic in {@code server/spacerace.c}.
 *
 * <p>Parts built in cities increment the total part counts
 * (structurals / components / modules) and are auto-placed into
 * the ship.  Components are split equally between fuel and
 * propulsion; modules cycle through habitation, life support, and
 * solar panels to maximise {@link #calcDerived() success rate}.
 */
public class Spaceship {

    /** Mirrors the {@code spaceship_state} enum in spaceship.h. */
    public enum State {
        NONE,     // 0 – no spaceship activity yet
        STARTED,  // 1 – at least one part has been built
        LAUNCHED, // 2 – spaceship is en route to Alpha Centauri
        ARRIVED   // 3 – spaceship has reached its destination
    }

    // Maximum part counts (from spaceship.h)
    public static final int MAX_STRUCTURALS  = 32;
    public static final int MAX_COMPONENTS   = 16; // 8 fuel + 8 propulsion
    public static final int MAX_MODULES      = 12; // 4 each of hab/LS/solar

    // ---------------------------------------------------------------
    // Part counters (total built / placed)
    // ---------------------------------------------------------------
    private int structurals  = 0;
    private int components   = 0;
    private int modules      = 0;

    // Placed sub-counts for components
    private int fuel         = 0;
    private int propulsion   = 0;

    // Placed sub-counts for modules
    private int habitation   = 0;
    private int lifeSupport  = 0;
    private int solarPanels  = 0;

    // ---------------------------------------------------------------
    // State & launch year
    // ---------------------------------------------------------------
    private State state      = State.NONE;
    /** Year the spaceship was launched; 9999 means not yet launched. */
    private int launchYear   = 9999;

    // ---------------------------------------------------------------
    // Derived statistics (recalculated by calcDerived())
    // ---------------------------------------------------------------
    private int    population   = 0;
    private int    mass         = 0;
    private double supportRate  = 0.0;
    private double energyRate   = 0.0;
    private double successRate  = 0.0;
    private double travelTime   = 9999.0;

    // ---------------------------------------------------------------
    // Part-building methods (called when city production completes)
    // ---------------------------------------------------------------

    /**
     * Records one Space Structural being built.
     * Mirrors the handling of {@code B_SPACE_STRUCTURAL} in spacerace.c.
     */
    public void addStructural() {
        if (structurals < MAX_STRUCTURALS) {
            structurals++;
            if (state == State.NONE) state = State.STARTED;
            calcDerived();
        }
    }

    /**
     * Records one Space Component being built and auto-places it as
     * either fuel or propulsion to keep them balanced.
     * Mirrors the {@code SSHIP_PLACE_FUEL} / {@code SSHIP_PLACE_PROPULSION}
     * handling in spacerace.c.
     */
    public void addComponent() {
        if (components < MAX_COMPONENTS) {
            components++;
            // Auto-place: alternate fuel ↔ propulsion (keep balanced)
            if (fuel <= propulsion && fuel < MAX_COMPONENTS / 2) {
                fuel++;
            } else if (propulsion < MAX_COMPONENTS / 2) {
                propulsion++;
            } else if (fuel < MAX_COMPONENTS / 2) {
                fuel++;
            }
            if (state == State.NONE) state = State.STARTED;
            calcDerived();
        }
    }

    /**
     * Records one Space Module being built and auto-places it as
     * habitation, life support, or solar panels to maximise success rate.
     * Mirrors the {@code SSHIP_PLACE_HABITATION} / {@code SSHIP_PLACE_LIFE_SUPPORT}
     * / {@code SSHIP_PLACE_SOLAR_PANELS} handling in spacerace.c.
     */
    public void addModule() {
        if (modules < MAX_MODULES) {
            modules++;
            // Auto-place: keep habitation == life_support, solar_panels ~ half
            if (habitation <= lifeSupport && habitation < MAX_MODULES / 3) {
                habitation++;
            } else if (lifeSupport < MAX_MODULES / 3) {
                lifeSupport++;
            } else if (solarPanels < MAX_MODULES / 3) {
                solarPanels++;
            } else if (habitation < MAX_MODULES / 3) {
                habitation++;
            } else if (lifeSupport < MAX_MODULES / 3) {
                lifeSupport++;
            }
            if (state == State.NONE) state = State.STARTED;
            calcDerived();
        }
    }

    // ---------------------------------------------------------------
    // Derived-statistic calculation
    // ---------------------------------------------------------------

    /**
     * Recalculates all derived spaceship statistics.
     * Mirrors {@code spaceship_calc_derived()} in {@code server/spacerace.c}.
     *
     * <p>Mass is computed from placed part counts, using the same
     * per-structural weight scheme as the C server (first 6 structurals
     * weigh 200 each; the remainder weigh 100 each).  Success rate and
     * travel time follow the same formulae.
     */
    public void calcDerived() {
        // Mass from structurals (approximation without placement grid)
        int m = Math.min(structurals, 6) * 200
                + Math.max(0, structurals - 6) * 100;
        // Mass from placed modules/components
        m += (habitation  + lifeSupport) * 1600;
        m += (solarPanels + propulsion   + fuel) * 400;
        this.mass = m;

        this.population = habitation * 10_000;

        this.supportRate = (habitation > 0)
                ? (double) lifeSupport / habitation
                : 0.0;

        this.energyRate = (lifeSupport + habitation > 0)
                ? 2.0 * solarPanels / (lifeSupport + habitation)
                : 0.0;

        if (fuel > 0 && propulsion > 0) {
            this.successRate = Math.min(supportRate, 1.0)
                             * Math.min(energyRate,  1.0);
        } else {
            this.successRate = 0.0;
        }

        // Travel time (years) – mirrors spacerace.c formula.
        // spaceship_travel_pct default = 100 → factor = 1.0
        int minPF = Math.min(propulsion, fuel);
        this.travelTime = (minPF > 0 && successRate > 0)
                ? (double) mass / (200.0 * minPF + 20.0)
                : 9999.0;
    }

    /** Calculates the fractional year of arrival, used for ranking. */
    public double getArrivalYear() {
        return launchYear + travelTime;
    }

    // ---------------------------------------------------------------
    // Getters & setters
    // ---------------------------------------------------------------

    public State getState()       { return state; }
    public void  setState(State s){ this.state = s; }

    public int getStructurals()   { return structurals; }
    public int getComponents()    { return components; }
    public int getModules()       { return modules; }

    public int getFuel()          { return fuel; }
    public int getPropulsion()    { return propulsion; }
    public int getHabitation()    { return habitation; }
    public int getLifeSupport()   { return lifeSupport; }
    public int getSolarPanels()   { return solarPanels; }

    public int getLaunchYear()    { return launchYear; }
    public void setLaunchYear(int y){ this.launchYear = y; }

    public int    getPopulation() { return population; }
    public int    getMass()       { return mass; }
    public double getSupportRate(){ return supportRate; }
    public double getEnergyRate() { return energyRate; }
    public double getSuccessRate(){ return successRate; }
    public double getTravelTime() { return travelTime; }
}
