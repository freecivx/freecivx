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

package net.freecivx.ai;

import net.freecivx.game.City;
import net.freecivx.game.Game;
import net.freecivx.game.Improvement;
import net.freecivx.game.Player;
import net.freecivx.game.Technology;
import net.freecivx.game.Tile;
import net.freecivx.game.Unit;
import net.freecivx.game.UnitType;
import net.freecivx.server.CityTurn;
import net.freecivx.server.TechTools;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/**
 * AiPlayer handles all AI decision-making for computer-controlled players.
 * AI turns are executed in a dedicated background thread to keep the main
 * game loop responsive.
 *
 * <p>Strategies are based on the Freeciv C server default AI (ai/default/):
 * <ul>
 *   <li>Technology research selection – aitech.c</li>
 *   <li>City production management – daicity.c</li>
 *   <li>Settler site evaluation – daisettler.c</li>
 *   <li>Military unit coordination and city defence – daimilitary.c / daiunit.c</li>
 * </ul>
 */
public class AiPlayer {

    private final Game game;
    private final Random random = new Random();
    private final ExecutorService executor;

    // Per-unit persistent target tile IDs (inspired by daiunit.c unit-task system).
    // Storing targets across turns prevents units from changing goals every turn.
    private final Map<Long, Long> unitTargets = new HashMap<>();

    // Flag to ensure improvement and technology IDs are resolved only once.
    // IDs are assigned when the game starts and never change, so a single
    // resolution pass is sufficient.
    private boolean idsResolved = false;

    // Terrain types suitable for city founding (excludes ocean and impassable tiles)
    private static final Set<Integer> CITY_SUITABLE_TERRAINS = new HashSet<>();
    static {
        CITY_SUITABLE_TERRAINS.add(5);  // Desert
        CITY_SUITABLE_TERRAINS.add(6);  // Forest
        CITY_SUITABLE_TERRAINS.add(7);  // Grassland
        CITY_SUITABLE_TERRAINS.add(8);  // Hills
        CITY_SUITABLE_TERRAINS.add(9);  // Jungle
        CITY_SUITABLE_TERRAINS.add(11); // Plains
        CITY_SUITABLE_TERRAINS.add(13); // Tundra
    }

    // How far (in tiles) a settler searches for a good city spot.
    // Radius 12 covers ~25×25 tiles, enough to find quality land near start
    // positions while keeping the search cost low on a 45×45 map.
    private static final int SETTLER_SEARCH_RADIUS = 12;

    // Minimum Manhattan-distance between two cities (from daisettler.c)
    private static final int MIN_CITY_SEPARATION = 3;

    // Minimum tile-founding score to build immediately on the current tile
    private static final int SETTLER_FOUND_SCORE = 2;

    private static final String[] AI_CITY_NAMES = {
        "Rome", "Athens", "Cairo", "Babylon", "Carthage", "Persepolis",
        "Thebes", "Memphis", "Nineveh", "Tyre", "Samarkand", "Antioch",
        "Corinth", "Sparta", "Troy", "Alexandria", "Damascus", "Jericho"
    };
    private int aiCityNameIndex = 0;

    // Terrain IDs – match Game.initGame() and are used in tileSettlerScore().
    private static final int TERRAIN_GRASSLAND = 7;
    private static final int TERRAIN_PLAINS    = 11;
    private static final int TERRAIN_HILLS     = 8;
    private static final int TERRAIN_FOREST    = 6;
    private static final int TERRAIN_JUNGLE    = 9;
    private static final int TERRAIN_DESERT    = 5;
    private static final int TERRAIN_TUNDRA    = 13;
    private static final int TERRAIN_OCEAN     = 2;
    private static final int TERRAIN_DEEP_OCEAN = 3;

    // Improvement IDs — resolved at runtime by name in resolveGameIds() because IDs
    // differ between the loaded ruleset (alphabetical order) and the hardcoded fallback.
    // Fallback values match populateFallback() in Game.java.
    private int imprBarracks    = 1;
    private int imprGranary     = 2;
    private int imprLibrary     = 3;
    private int imprMarketplace = 4;
    private int imprCityWalls   = 7;

    // Unit-type IDs — must match the constants initialised in Game.initGame().
    private static final int UNIT_SETTLERS = 0;
    private static final int UNIT_WORKERS  = 1;
    private static final int UNIT_WARRIORS = 3;

    // Technology IDs — resolved at runtime by name in resolveGameIds() because IDs
    // differ between the loaded ruleset (alphabetical order) and the hardcoded fallback.
    // Fallback values match populateFallback() in Game.java.
    private long techAlphabet        =  0L;
    private long techMathematics     =  1L;
    private long techTheRepublic     =  2L;
    private long techMasonry         =  3L;
    private long techBronzeWorking   =  4L;
    private long techIronWorking     =  5L;
    private long techWriting         =  7L;
    private long techCodeOfLaws      =  8L;
    private long techHorsebackRiding =  9L;
    private long techPottery         = 10L;
    private long techWarriorCode     = 11L;
    private long techMonarchy        = 13L;
    private long techDemocracy       = 14L;

    private static final int[] DIR_DX = {-1, 0, 1, -1, 1, -1, 0, 1};
    private static final int[] DIR_DY = {-1, -1, -1, 0, 0, 1, 1, 1};

    public AiPlayer(Game game) {
        this.game = game;
        this.executor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "freecivx-ai");
            t.setDaemon(true);
            return t;
        });
    }

    /**
     * Submits AI turn processing to the dedicated AI thread and waits for
     * completion before returning, so that game-state broadcasts happen only
     * after every AI unit has acted.
     */
    public void runAiTurns() {
        Future<?> future = executor.submit(this::executeAiTurns);
        try {
            future.get();
        } catch (Exception e) {
            System.err.println("AI turn error: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /** Performs all AI actions for the current turn (runs on the AI thread). */
    private void executeAiTurns() {
        // Resolve improvement and tech IDs from the loaded game data on the first
        // turn.  IDs are stable for the lifetime of the game (ruleset loaded once
        // at startup), so this is a one-time O(n) pass.  Mirrors the name-based
        // lookup used in the C Freeciv server's ruleset.c.
        resolveGameIds();

        // Phase 0: Manage government evolution when better governments are available.
        // Mirrors dai_manage_government() in ai/default/daicity.c.
        manageAiGovernments();

        // Phase 1: Choose research goals for AI players (inspired by aitech.c).
        pickResearchGoals();

        // Phase 2: Choose city production for AI cities (inspired by daicity.c).
        manageAiCities();

        // Phase 3: Move/act with each AI unit.
        List<Unit> unitsSnapshot = new ArrayList<>(game.units.values());
        for (Unit unit : unitsSnapshot) {
            Player owner = game.players.get(unit.getOwner());
            if (owner == null || !owner.isAi()) continue;
            if (!game.units.containsKey(unit.getId())) continue;

            UnitType utype = game.unitTypes.get((long) unit.getType());
            if (utype == null) continue;

            // Settlers (type 0): seek a good city spot and found a city
            if (unit.getType() == UNIT_SETTLERS) {
                handleSettler(unit, utype);
                continue;
            }

            // Workers (type 1): build terrain improvements (roads, irrigation, mines)
            if (unit.getType() == UNIT_WORKERS) {
                handleWorker(unit, utype);
                continue;
            }

            // Military units: defend cities first, then attack enemies
            if (utype.getAttackStrength() > 0) {
                handleMilitaryUnit(unit, utype, owner);
                continue;
            }

            // Other units (explorers): move randomly
            int movesUsed = 0;
            while (unit.getMovesleft() > 0 && movesUsed < utype.getMoveRate()) {
                if (!moveUnitRandomly(unit, utype)) break;
                movesUsed++;
            }
        }
    }

    // =========================================================================
    // Runtime ID resolution
    // =========================================================================

    /**
     * Resolves improvement and technology IDs from the loaded game data by name.
     * This is necessary because IDs are assigned in the order buildings/techs
     * appear in the ruleset file (alphabetical), which differs from the hardcoded
     * fallback in {@code Game.populateFallback()}.
     *
     * <p>Runs only once: IDs are stable for the lifetime of the game since the
     * ruleset is loaded once at startup.  Mirrors the name-based lookup pass in
     * the C Freeciv server's {@code server/ruleset.c}.
     */
    private void resolveGameIds() {
        if (idsResolved) return;
        idsResolved = true;

        for (Map.Entry<Long, Improvement> e : game.improvements.entrySet()) {
            String n = e.getValue().getName();
            int id = e.getKey().intValue();
            switch (n) {
                case "Barracks":    imprBarracks    = id; break;
                case "Granary":     imprGranary     = id; break;
                case "Library":     imprLibrary     = id; break;
                case "Marketplace": imprMarketplace = id; break;
                case "City Walls":  imprCityWalls   = id; break;
                default: break;
            }
        }
        for (Map.Entry<Long, Technology> e : game.techs.entrySet()) {
            String n = e.getValue().getName();
            long id = e.getKey();
            switch (n) {
                case "Alphabet":          techAlphabet        = id; break;
                case "Mathematics":       techMathematics     = id; break;
                case "The Republic":      techTheRepublic     = id; break;
                case "Masonry":           techMasonry         = id; break;
                case "Bronze Working":    techBronzeWorking   = id; break;
                case "Iron Working":      techIronWorking     = id; break;
                case "Writing":           techWriting         = id; break;
                case "Code of Laws":      techCodeOfLaws      = id; break;
                case "Horseback Riding":  techHorsebackRiding = id; break;
                case "Pottery":           techPottery         = id; break;
                case "Warrior Code":      techWarriorCode     = id; break;
                case "Monarchy":          techMonarchy        = id; break;
                case "Democracy":         techDemocracy       = id; break;
                default: break;
            }
        }
    }

    // =========================================================================
    // Government management (inspired by dai_manage_government() in daicity.c)
    // =========================================================================

    /**
     * Upgrades the government of every AI player that has researched a better
     * government technology.  Mirrors the {@code dai_manage_government()} logic
     * in {@code ai/default/daicity.c}: the AI moves to the best government
     * it can sustain once the required tech is available.
     *
     * <p>Upgrade path (classic Freeciv):
     * <ol>
     *   <li>Despotism (default) → <b>Monarchy</b> when "Monarchy" tech is known</li>
     *   <li>Monarchy → <b>Republic</b> when "The Republic" tech is known</li>
     * </ol>
     */
    private void manageAiGovernments() {
        for (Player player : new ArrayList<>(game.players.values())) {
            if (!player.isAi()) continue;
            upgradeGovernmentIfPossible(player);
        }
    }

    /**
     * Checks whether the given AI player can adopt a superior government and
     * switches to it.  The government names and tech requirements mirror the
     * classic Freeciv ruleset.  Uses the resolved tech IDs from
     * {@link #resolveGameIds()} so this works with both the loaded ruleset and
     * the hardcoded fallback.
     *
     * @param player the AI player whose government may be upgraded
     */
    private void upgradeGovernmentIfPossible(Player player) {
        int currentGov = player.getGovernmentId();

        if (currentGov <= 1) {
            // Try to advance from Despotism (1) to Monarchy (2)
            if (player.hasTech(techMonarchy)) {
                player.setGovernmentId(2); // Monarchy
                game.getServer().sendPlayerInfoAll(player);
                return;
            }
        }

        if (currentGov == 2) {
            // Try to advance from Monarchy (2) to Republic (4)
            if (player.hasTech(techTheRepublic)) {
                player.setGovernmentId(4); // Republic
                game.getServer().sendPlayerInfoAll(player);
                return;
            }
        }

        if (currentGov == 4) {
            // Try to advance from Republic (4) to Democracy (5)
            if (player.hasTech(techDemocracy)) {
                player.setGovernmentId(5); // Democracy
                game.getServer().sendPlayerInfoAll(player);
            }
        }
    }

    // =========================================================================
    // Research management (inspired by aitech.c)
    // =========================================================================

    /**
     * Sets research goals for all AI players that currently have no active
     * research target.  Mirrors the {@code dai_select_tech()} loop in
     * {@code ai/default/aitech.c}.
     */
    private void pickResearchGoals() {
        for (Map.Entry<Long, Player> entry : new ArrayList<>(game.players.entrySet())) {
            Player player = entry.getValue();
            if (!player.isAi()) continue;
            pickResearchGoal(player, entry.getKey());
        }
    }

    /**
     * Selects the most strategically valuable researchable technology for one
     * AI player.  The priority order reflects the dependency chain used by the
     * C server's {@code dai_select_tech()} in {@code ai/default/aitech.c}:
     * <ol>
     *   <li>Pottery → enables Granary (food growth)</li>
     *   <li>Bronze Working → military prerequisite chain</li>
     *   <li>Warrior Code → better early warriors</li>
     *   <li>Masonry → Barracks and City Walls (defence)</li>
     *   <li>Alphabet → Temple (happiness) and many prerequisites</li>
     *   <li>Writing → Library (science bonus)</li>
     *   <li>Code of Laws → Marketplace (trade bonus)</li>
     *   <li>Horseback Riding → Horsemen (mobile military)</li>
     *   <li>Mathematics / Iron Working / The Republic → late-game benefits</li>
     * </ol>
     *
     * @param player   the AI player
     * @param playerId the player's connection ID
     */
    private void pickResearchGoal(Player player, long playerId) {
        if (player.getResearchingTech() >= 0) return; // Already researching

        long[] priorityTechs = {
            techPottery,          // Granary → faster city growth
            techBronzeWorking,    // Military prerequisite chain
            techWarriorCode,      // Better warriors
            techMasonry,          // Barracks + City Walls
            techAlphabet,         // Temple (happiness) + many prerequisites
            techWriting,          // Library → science bonus
            techCodeOfLaws,       // Marketplace + Monarchy prerequisite
            techMonarchy,         // Better government (less corruption)
            techHorsebackRiding,  // Horsemen (fast military)
            techMathematics,      // Bank prerequisite
            techIronWorking,      // Legion (strong military)
            techTheRepublic,      // Republic government
            techDemocracy,        // Democracy government (zero corruption)
        };

        for (long techId : priorityTechs) {
            if (TechTools.canPlayerResearch(game, playerId, techId)) {
                player.setResearchingTech(techId);
                return;
            }
        }

        // Fallback: research the first available technology
        for (long techId : game.techs.keySet()) {
            if (TechTools.canPlayerResearch(game, playerId, techId)) {
                player.setResearchingTech(techId);
                return;
            }
        }
    }

    // =========================================================================
    // City production management (inspired by daicity.c)
    // =========================================================================

    /**
     * Manages city production for all AI-owned cities that have an empty
     * production slot.  Mirrors the city-management loop in
     * {@code dai_city_choose_build()} ({@code ai/default/daicity.c}).
     */
    private void manageAiCities() {
        for (Map.Entry<Long, City> entry : new ArrayList<>(game.cities.entrySet())) {
            City city = entry.getValue();
            Player owner = game.players.get(city.getOwner());
            if (owner == null || !owner.isAi()) continue;
            manageAiCity(city, entry.getKey(), owner);
        }
    }

    /**
     * Chooses what to build in a single AI city based on strategic priorities.
     * Inspired by {@code dai_city_choose_build()} in {@code ai/default/daicity.c}:
     * <ol>
     *   <li>Produce Warriors when the city is undefended or threatened.</li>
     *   <li>Build a Granary for sustained food growth (Pottery required).</li>
     *   <li>Produce Settlers when the empire is small (at most three cities).</li>
     *   <li>Build a Library for science output (Writing required).</li>
     *   <li>Build a Marketplace for gold income (Code of Laws required).</li>
     *   <li>Build City Walls for passive defence (Masonry required).</li>
     *   <li>Default: produce Warriors.</li>
     * </ol>
     *
     * <p>Production is only changed when the slot is empty
     * ({@code productionKind == 0 && productionValue == 0}), which is the
     * state {@link net.freecivx.server.CityTurn#cityProduction} sets after an
     * improvement completes.
     *
     * @param city   the city to manage
     * @param cityId the city's key in {@code game.cities}
     * @param owner  the AI player who owns the city
     */
    private void manageAiCity(City city, long cityId, Player owner) {
        // Only fill an empty production slot; do not override in-progress work.
        if (city.getProductionKind() != 0 || city.getProductionValue() != 0) return;

        long ownerId = city.getOwner();
        int defenders = countUnitsOnTile(city.getTile(), ownerId);
        boolean enemyNearby = hasEnemiesNearCity(city);

        // Priority 1: Defend the city (from daimilitary.c danger assessment)
        if (defenders == 0 || (enemyNearby && defenders < 2)) {
            city.setProductionKind(0);
            city.setProductionValue(UNIT_WARRIORS);
            return;
        }

        // Priority 2: Barracks for fast unit healing (no tech required).
        // Mirrors the high priority given to Barracks in the C Freeciv AI because
        // veteran-producing and full-healing Barracks are essential for sustained
        // military campaigns.
        if (!city.hasImprovement(imprBarracks)) {
            Improvement barracks = game.improvements.get((long) imprBarracks);
            if (barracks != null && canBuildImprovement(owner, barracks)) {
                city.setProductionKind(1);
                city.setProductionValue(imprBarracks);
                return;
            }
        }

        // Priority 3: Granary for sustained food growth (Pottery required)
        if (!city.hasImprovement(imprGranary)) {
            Improvement granary = game.improvements.get((long) imprGranary);
            if (granary != null && canBuildImprovement(owner, granary)) {
                city.setProductionKind(1);
                city.setProductionValue(imprGranary);
                return;
            }
        }

        // Priority 4: Settlers to expand the empire when it is still small
        long myCityCount = game.cities.values().stream()
                .filter(c -> c.getOwner() == ownerId).count();
        if (myCityCount < 4 && city.getSize() >= 2) {
            city.setProductionKind(0);
            city.setProductionValue(UNIT_SETTLERS);
            return;
        }

        // Priority 5: Library for science output (Writing required)
        if (!city.hasImprovement(imprLibrary) && city.getSize() >= 2) {
            Improvement library = game.improvements.get((long) imprLibrary);
            if (library != null && canBuildImprovement(owner, library)) {
                city.setProductionKind(1);
                city.setProductionValue(imprLibrary);
                return;
            }
        }

        // Priority 6: Marketplace for trade income (Code of Laws required)
        if (!city.hasImprovement(imprMarketplace) && city.getSize() >= 3) {
            Improvement marketplace = game.improvements.get((long) imprMarketplace);
            if (marketplace != null && canBuildImprovement(owner, marketplace)) {
                city.setProductionKind(1);
                city.setProductionValue(imprMarketplace);
                return;
            }
        }

        // Priority 7: City Walls for passive defence (Masonry required)
        if (!city.hasImprovement(imprCityWalls)) {
            Improvement walls = game.improvements.get((long) imprCityWalls);
            if (walls != null && canBuildImprovement(owner, walls)) {
                city.setProductionKind(1);
                city.setProductionValue(imprCityWalls);
                return;
            }
        }

        // Default: produce Warriors for army expansion
        city.setProductionKind(0);
        city.setProductionValue(UNIT_WARRIORS);
    }

    /**
     * Returns {@code true} if the player has the prerequisite technology to
     * build the given improvement.  Mirrors
     * {@code can_city_build_improvement_direct()} in the C Freeciv server's
     * {@code common/city.c}.
     */
    private boolean canBuildImprovement(Player player, Improvement impr) {
        long techReq = impr.getTechReqId();
        return techReq < 0 || player.hasTech(techReq);
    }

    /**
     * Returns the number of units belonging to {@code ownerId} that are
     * currently on the given tile.  Used to determine whether a city is
     * defended.  Mirrors the garrison-count logic in
     * {@code ai/default/daimilitary.c}.
     */
    private int countUnitsOnTile(long tileId, long ownerId) {
        int count = 0;
        for (Unit u : game.units.values()) {
            if (u.getTile() == tileId && u.getOwner() == ownerId) count++;
        }
        return count;
    }

    /**
     * Returns {@code true} if there is at least one enemy unit within a small
     * search radius of the given city.  Used for threat detection in
     * {@link #manageAiCity}, mirroring {@code assess_danger()} in
     * {@code ai/default/daimilitary.c}.
     */
    private boolean hasEnemiesNearCity(City city) {
        long cx = city.getTile() % game.map.getXsize();
        long cy = city.getTile() / game.map.getXsize();
        long ownerId = city.getOwner();
        for (Unit u : game.units.values()) {
            if (u.getOwner() == ownerId) continue;
            long ux = u.getTile() % game.map.getXsize();
            long uy = u.getTile() / game.map.getXsize();
            if (Math.abs(ux - cx) + Math.abs(uy - cy) <= 4) return true;
        }
        return false;
    }

    // =========================================================================
    // Settler AI (inspired by daisettler.c)
    // =========================================================================

    /**
     * Settler AI: found a city on the current tile when it is fertile enough
     * (score ≥ {@link #SETTLER_FOUND_SCORE}) and not too close to an existing
     * city; otherwise move toward the best-scored candidate tile in the search
     * radius.  The chosen target is remembered across turns to avoid goal
     * jitter, mirroring the persistent unit-task system in
     * {@code ai/default/daiunit.c}.
     *
     * <p>Replaces the old random-chance founding with terrain-score-based
     * evaluation inspired by {@code settler_evaluate_city_building()} in
     * {@code ai/default/daisettler.c}.
     */
    private void handleSettler(Unit unit, UnitType utype) {
        long unitId = unit.getId();

        // Evict a stale target if the tile has since been claimed or is gone.
        Long target = unitTargets.get(unitId);
        if (target != null) {
            Tile t = game.tiles.get(target);
            if (t == null || t.getWorked() >= 0
                    || !CITY_SUITABLE_TERRAINS.contains(t.getTerrain())) {
                unitTargets.remove(unitId);
                target = null;
            }
        }

        Tile currentTile = game.tiles.get(unit.getTile());
        if (currentTile == null) return;

        // Found immediately when the current tile is fertile, unoccupied, and
        // far enough from existing cities.
        if (CITY_SUITABLE_TERRAINS.contains(currentTile.getTerrain())
                && currentTile.getWorked() < 0
                && tileSettlerScore(currentTile) >= SETTLER_FOUND_SCORE
                && !tooCloseToExistingCity(unit.getTile())
                && game.units.containsKey(unit.getId())) {
            String cityName = AI_CITY_NAMES[aiCityNameIndex % AI_CITY_NAMES.length];
            aiCityNameIndex++;
            game.buildCity(unit.getId(), cityName, unit.getTile());
            unitTargets.remove(unitId);
            return;
        }

        // Move toward the best candidate tile, caching the target across turns.
        if (target == null) {
            long found = findBestCitySpot(unit.getTile());
            if (found >= 0) {
                unitTargets.put(unitId, found);
                target = found;
            }
        }

        if (target != null && target >= 0) {
            moveUnitToward(unit, utype, target);
        } else {
            moveUnitRandomly(unit, utype);
        }
    }

    /**
     * Scores a tile's suitability for city founding based on terrain type.
     * Grassland and Plains score highest (best food + production balance),
     * Desert and Tundra the lowest.  Mirrors the simplified food/shield/trade
     * evaluation in {@code city_desirability()} ({@code ai/default/daisettler.c}).
     *
     * @param tile the tile to evaluate
     * @return a non-negative integer; higher is better
     */
    private int tileSettlerScore(Tile tile) {
        switch (tile.getTerrain()) {
            case TERRAIN_GRASSLAND: return 3; // high food
            case TERRAIN_PLAINS:    return 3; // balanced food + production
            case TERRAIN_HILLS:     return 2; // good production
            case TERRAIN_FOREST:    return 2; // production
            case TERRAIN_JUNGLE:    return 2; // food (but requires clearing)
            case TERRAIN_DESERT:    return 1; // minimal yields
            case TERRAIN_TUNDRA:    return 1; // minimal yields
            default:                return 0; // Ocean / impassable
        }
    }

    /**
     * Returns {@code true} if {@code tileId} is within
     * {@link #MIN_CITY_SEPARATION} tiles (Manhattan distance) of any existing
     * city.  Prevents building cities too close together, mirroring the
     * minimum-city-distance check in {@code ai/default/daisettler.c}.
     */
    private boolean tooCloseToExistingCity(long tileId) {
        long tx = tileId % game.map.getXsize();
        long ty = tileId / game.map.getXsize();
        for (City city : game.cities.values()) {
            long cx = city.getTile() % game.map.getXsize();
            long cy = city.getTile() / game.map.getXsize();
            if (Math.abs(cx - tx) + Math.abs(cy - ty) < MIN_CITY_SEPARATION) return true;
        }
        return false;
    }

    /**
     * Finds the highest-scored unoccupied tile within
     * {@link #SETTLER_SEARCH_RADIUS} that is not too close to an existing city.
     * Ties are broken by preferring the closer tile.  Mirrors
     * {@code find_best_city_placement()} in {@code ai/default/daisettler.c}.
     *
     * @param fromTile the settler's current tile ID
     * @return the best candidate tile ID, or {@code -1} if none is found
     */
    private long findBestCitySpot(long fromTile) {
        long x = fromTile % game.map.getXsize();
        long y = fromTile / game.map.getXsize();
        long bestTile = -1;
        int bestScore = -1;
        long bestDist = Long.MAX_VALUE;

        long minY = Math.max(0, y - SETTLER_SEARCH_RADIUS);
        long maxY = Math.min(game.map.getYsize() - 1, y + SETTLER_SEARCH_RADIUS);
        long minX = Math.max(0, x - SETTLER_SEARCH_RADIUS);
        long maxX = Math.min(game.map.getXsize() - 1, x + SETTLER_SEARCH_RADIUS);

        for (long ty = minY; ty <= maxY; ty++) {
            for (long tx = minX; tx <= maxX; tx++) {
                long tileId = ty * game.map.getXsize() + tx;
                Tile tile = game.tiles.get(tileId);
                if (tile == null) continue;
                if (!CITY_SUITABLE_TERRAINS.contains(tile.getTerrain())) continue;
                if (tile.getWorked() >= 0) continue; // already a city
                if (tooCloseToExistingCity(tileId)) continue;

                int score = tileSettlerScore(tile);
                long dist = Math.abs(tx - x) + Math.abs(ty - y);
                // Prefer higher score; break ties by proximity
                if (score > bestScore || (score == bestScore && dist < bestDist)) {
                    bestScore = score;
                    bestDist = dist;
                    bestTile = tileId;
                }
            }
        }
        return bestTile;
    }

    // =========================================================================
    // Worker AI (inspired by auto_settlers.c)
    // =========================================================================

    /**
     * Worker AI: build terrain improvements (roads, irrigation, mines) to boost
     * city output.  Mirrors the auto-settler logic in the C Freeciv server's
     * {@code server/settlers.c} and {@code ai/default/autosettlers.c}.
     *
     * <p>Priority (mirroring the C server's improvement evaluation order):
     * <ol>
     *   <li>If the worker is already performing a terrain improvement, do nothing
     *       (let {@link net.freecivx.server.CityTurn#processWorkerActivities} finish it).</li>
     *   <li>Build a <b>road</b> if the current land tile has none – roads boost
     *       trade output and movement speed on every terrain type.</li>
     *   <li>Build <b>irrigation</b> on Grassland or Plains if none exists – adds
     *       food surplus equivalent to an extra citizen in the C ruleset.</li>
     *   <li>Build a <b>mine</b> on Hills if none exists – converts defensive
     *       terrain into productive terrain.</li>
     *   <li>If the current tile is already fully improved, move toward the nearest
     *       unimproved land tile within a search radius, or wander randomly.</li>
     * </ol>
     *
     * @param unit  the Worker unit
     * @param utype the Worker's unit type (used for movement checks)
     */
    private void handleWorker(Unit unit, UnitType utype) {
        // If the worker is already engaged in terrain improvement, let it finish.
        // CityTurn.processWorkerActivities() advances the activity counter and
        // completes the improvement when the required turns are accumulated.
        int activity = unit.getActivity();
        if (activity == CityTurn.ACTIVITY_ROAD
                || activity == CityTurn.ACTIVITY_IRRIGATE
                || activity == CityTurn.ACTIVITY_MINE) {
            return; // Let the current task complete
        }

        Tile currentTile = game.tiles.get(unit.getTile());
        if (currentTile == null) return;

        int terrain = currentTile.getTerrain();
        // Workers only operate on traversable land terrain (not ocean or polar).
        if (terrain == TERRAIN_OCEAN || terrain == TERRAIN_DEEP_OCEAN
                || terrain == 0 /* Arctic */ || terrain == 4 /* Glacier */
                || terrain == 14 /* Inaccessible */) {
            moveUnitRandomly(unit, utype);
            return;
        }

        // Priority 1: Build a road if the tile has none.
        // Roads improve movement and provide a trade bonus on most terrain.
        boolean hasRoad = (currentTile.getExtras()
                & (1 << CityTurn.EXTRA_BIT_ROAD)) != 0;
        if (!hasRoad) {
            game.changeUnitActivity(unit.getId(),
                    CityTurn.ACTIVITY_ROAD);
            return;
        }

        // Priority 2: Irrigate Grassland or Plains to boost food output.
        boolean hasIrrigation = (currentTile.getExtras()
                & (1 << CityTurn.EXTRA_BIT_IRRIGATION)) != 0;
        if (!hasIrrigation
                && (terrain == TERRAIN_GRASSLAND || terrain == TERRAIN_PLAINS)) {
            game.changeUnitActivity(unit.getId(),
                    CityTurn.ACTIVITY_IRRIGATE);
            return;
        }

        // Priority 3: Mine Hills to boost production output.
        boolean hasMine = (currentTile.getExtras()
                & (1 << CityTurn.EXTRA_BIT_MINE)) != 0;
        if (!hasMine && terrain == TERRAIN_HILLS) {
            game.changeUnitActivity(unit.getId(),
                    CityTurn.ACTIVITY_MINE);
            return;
        }

        // Current tile is fully improved – move toward the nearest unimproved tile.
        long bestTarget = findBestWorkerTarget(unit.getTile());
        if (bestTarget >= 0) {
            moveUnitToward(unit, utype, bestTarget);
        } else {
            moveUnitRandomly(unit, utype);
        }
    }

    /**
     * Finds the nearest land tile within a search radius that would benefit from
     * a terrain improvement.  Returns the best candidate tile ID, or {@code -1}
     * if all nearby tiles are already improved or unsuitable.
     *
     * @param fromTile the worker's current tile ID
     * @return the tile ID of the best improvement target, or {@code -1}
     */
    private long findBestWorkerTarget(long fromTile) {
        final int WORKER_SEARCH_RADIUS = 8;
        long x = fromTile % game.map.getXsize();
        long y = fromTile / game.map.getXsize();
        long bestTile = -1;
        long bestDist = Long.MAX_VALUE;

        long minY = Math.max(0, y - WORKER_SEARCH_RADIUS);
        long maxY = Math.min(game.map.getYsize() - 1, y + WORKER_SEARCH_RADIUS);
        long minX = Math.max(0, x - WORKER_SEARCH_RADIUS);
        long maxX = Math.min(game.map.getXsize() - 1, x + WORKER_SEARCH_RADIUS);

        for (long ty = minY; ty <= maxY; ty++) {
            for (long tx = minX; tx <= maxX; tx++) {
                long tileId = ty * game.map.getXsize() + tx;
                Tile tile = game.tiles.get(tileId);
                if (tile == null) continue;
                int t = tile.getTerrain();
                // Skip ocean and impassable terrain
                if (t == TERRAIN_OCEAN || t == TERRAIN_DEEP_OCEAN
                        || t == 0 || t == 4 || t == 14) continue;

                int extras = tile.getExtras();
                boolean roadMissing = (extras & (1 << CityTurn.EXTRA_BIT_ROAD)) == 0;
                boolean irrigationUseful = (t == TERRAIN_GRASSLAND || t == TERRAIN_PLAINS)
                        && (extras & (1 << CityTurn.EXTRA_BIT_IRRIGATION)) == 0;
                boolean mineUseful = (t == TERRAIN_HILLS)
                        && (extras & (1 << CityTurn.EXTRA_BIT_MINE)) == 0;

                if (!roadMissing && !irrigationUseful && !mineUseful) continue;

                long dist = Math.abs(tx - x) + Math.abs(ty - y);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestTile = tileId;
                }
            }
        }
        return bestTile;
    }

    // =========================================================================
    // Military unit AI (inspired by daiunit.c / daimilitary.c)
    // =========================================================================

    /**
     * Military unit AI: assign units to defend ungarrisoned friendly cities
     * before hunting enemies.  Mirrors the city-garrison and danger-assessment
     * logic in {@code ai/default/daimilitary.c} and the persistent unit-task
     * assignment in {@code ai/default/daiunit.c}.
     */
    private void handleMilitaryUnit(Unit unit, UnitType utype, Player owner) {
        long unitId = unit.getId();
        long ownerId = owner.getPlayerNo();

        // Assign a defence target if the unit has none yet.
        Long defenseTarget = unitTargets.get(unitId);
        if (defenseTarget == null) {
            defenseTarget = findUndefendedCityTile(ownerId, unitId);
            if (defenseTarget != null) {
                unitTargets.put(unitId, defenseTarget);
            }
        }

        while (unit.getMovesleft() > 0 && game.units.containsKey(unit.getId())) {
            // Always attack an adjacent enemy first (opportunistic combat)
            if (attackAdjacentEnemy(unit, owner)) continue;

            if (defenseTarget != null) {
                if (unit.getTile() == defenseTarget) {
                    // Already at the target city; clear the assignment if there
                    // are now enough garrison units so this one can roam freely.
                    if (countUnitsOnTile(defenseTarget, ownerId) >= 2) {
                        unitTargets.remove(unitId);
                        defenseTarget = null;
                    } else {
                        break; // Stay put – we are the sole defender
                    }
                } else {
                    if (!moveUnitToward(unit, utype, defenseTarget)) break;
                }
            } else {
                // No defence assignment: advance toward nearest enemy
                long enemyTile = findNearestEnemyTile(unit.getTile(), ownerId);
                if (enemyTile >= 0) {
                    if (!moveUnitToward(unit, utype, enemyTile)) break;
                } else {
                    if (!moveUnitRandomly(unit, utype)) break;
                }
            }
        }
    }

    /**
     * Finds a friendly city tile that has no defending unit other than the
     * requesting unit.  Mirrors the garrison-check logic in
     * {@code ai/default/daimilitary.c}.
     *
     * @param ownerId the AI player's ID
     * @param unitId  the requesting unit (excluded from the garrison count)
     * @return the tile ID of an undefended city, or {@code null} if all cities
     *         are already garrisoned
     */
    private Long findUndefendedCityTile(long ownerId, long unitId) {
        for (City city : game.cities.values()) {
            if (city.getOwner() != ownerId) continue;
            long cityTile = city.getTile();
            int garrisons = 0;
            for (Unit u : game.units.values()) {
                if (u.getId() == unitId) continue;
                if (u.getOwner() == ownerId && u.getTile() == cityTile) garrisons++;
            }
            if (garrisons == 0) return cityTile;
        }
        return null;
    }

    // =========================================================================
    // Shared movement helpers
    // =========================================================================

    /**
     * Looks for an enemy unit on a tile adjacent to {@code unit} and attacks
     * it if one is found.
     *
     * @return {@code true} if an attack was initiated
     */
    private boolean attackAdjacentEnemy(Unit unit, Player owner) {
        long x = unit.getTile() % game.map.getXsize();
        long y = unit.getTile() / game.map.getXsize();

        for (int dir = 0; dir < 8; dir++) {
            long nx = x + DIR_DX[dir];
            long ny = y + DIR_DY[dir];
            if (nx < 0 || nx >= game.map.getXsize() || ny < 0 || ny >= game.map.getYsize()) continue;
            long neighborTileId = ny * game.map.getXsize() + nx;

            for (Unit other : new ArrayList<>(game.units.values())) {
                if (other.getTile() == neighborTileId && other.getOwner() != owner.getPlayerNo()) {
                    game.attackUnit(unit.getId(), other.getId());
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Returns the tile ID of the nearest enemy unit, or {@code -1} if none exist.
     */
    private long findNearestEnemyTile(long fromTile, long ownerId) {
        long x = fromTile % game.map.getXsize();
        long y = fromTile / game.map.getXsize();
        long bestDist = Long.MAX_VALUE;
        long bestTile = -1;

        for (Unit other : game.units.values()) {
            if (other.getOwner() == ownerId) continue;
            long ex = other.getTile() % game.map.getXsize();
            long ey = other.getTile() / game.map.getXsize();
            long dist = Math.abs(ex - x) + Math.abs(ey - y);
            if (dist < bestDist) {
                bestDist = dist;
                bestTile = other.getTile();
            }
        }
        return bestTile;
    }

    /**
     * Moves a unit one step in the direction that minimises Manhattan distance
     * to the target tile.  Respects terrain and map-boundary constraints.
     *
     * @return {@code true} if the unit was successfully moved
     */
    private boolean moveUnitToward(Unit unit, UnitType utype, long targetTile) {
        if (unit.getMovesleft() <= 0) return false;

        long x = unit.getTile() % game.map.getXsize();
        long y = unit.getTile() / game.map.getXsize();
        long tx = targetTile % game.map.getXsize();
        long ty = targetTile / game.map.getXsize();

        int bestDir = -1;
        long bestDist = Long.MAX_VALUE;

        for (int dir = 0; dir < 8; dir++) {
            long nx = x + DIR_DX[dir];
            long ny = y + DIR_DY[dir];
            if (nx < 0 || nx >= game.map.getXsize() || ny < 0 || ny >= game.map.getYsize()) continue;
            long newTileId = ny * game.map.getXsize() + nx;
            Tile destTile = game.tiles.get(newTileId);
            if (destTile == null) continue;
            // Land units avoid ocean tiles (terrain 2 = Ocean, 3 = Deep Ocean)
            if (utype.getDomain() == 0) {
                int terrain = destTile.getTerrain();
                if (terrain == TERRAIN_OCEAN || terrain == TERRAIN_DEEP_OCEAN) continue;
            }
            long dist = Math.abs(nx - tx) + Math.abs(ny - ty);
            if (dist < bestDist) {
                bestDist = dist;
                bestDir = dir;
            }
        }

        if (bestDir < 0) return false;
        long nx = x + DIR_DX[bestDir];
        long ny = y + DIR_DY[bestDir];
        long newTileId = ny * game.map.getXsize() + nx;
        return game.moveUnit(unit.getId(), (int) newTileId, bestDir);
    }

    /** Attempts to move a unit in a randomly chosen valid direction. */
    private boolean moveUnitRandomly(Unit unit, UnitType utype) {
        int[] shuffledDirs = {0, 1, 2, 3, 4, 5, 6, 7};
        for (int i = shuffledDirs.length - 1; i > 0; i--) {
            int j = random.nextInt(i + 1);
            int tmp = shuffledDirs[i];
            shuffledDirs[i] = shuffledDirs[j];
            shuffledDirs[j] = tmp;
        }

        long currentTile = unit.getTile();
        long x = currentTile % game.map.getXsize();
        long y = currentTile / game.map.getXsize();

        for (int dir : shuffledDirs) {
            long nx = x + DIR_DX[dir];
            long ny = y + DIR_DY[dir];
            if (nx < 0 || nx >= game.map.getXsize() || ny < 0 || ny >= game.map.getYsize()) continue;
            long newTileId = ny * game.map.getXsize() + nx;
            Tile destTile = game.tiles.get(newTileId);
            if (destTile == null) continue;
            // Land units avoid ocean tiles (terrain 2 = Ocean, 3 = Deep Ocean)
            if (utype.getDomain() == 0) {
                int terrain = destTile.getTerrain();
                if (terrain == TERRAIN_OCEAN || terrain == TERRAIN_DEEP_OCEAN) continue;
            }
            return game.moveUnit(unit.getId(), (int) newTileId, dir);
        }
        return false;
    }

    /**
     * Shuts down the AI executor service. Should be called when the game ends
     * or the server stops.
     */
    public void shutdown() {
        executor.shutdown();
    }
}
