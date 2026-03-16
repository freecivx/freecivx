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
import net.freecivx.game.Government;
import net.freecivx.game.Improvement;
import net.freecivx.game.Player;
import net.freecivx.game.Technology;
import net.freecivx.game.Tile;
import net.freecivx.game.Unit;
import net.freecivx.game.UnitType;
import net.freecivx.server.CityTurn;
import net.freecivx.server.TechTools;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

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

    private static final Logger log = LoggerFactory.getLogger(AiPlayer.class);

    private final Game game;
    private final Random random = new Random();

    // Per-unit persistent target tile IDs (inspired by daiunit.c unit-task system).
    // Storing targets across turns prevents units from changing goals every turn.
    private final Map<Long, Long> unitTargets = new HashMap<>();

    // Per-unit consecutive-turns-stuck counter.
    // When a settler (or other unit) fails to make progress toward its target for
    // SETTLER_STUCK_TURNS consecutive turns, the target is evicted so the unit
    // searches for a new, hopefully reachable, destination.
    // Mirrors the "turns to go" reachability check in the C Freeciv server's
    // daisettler.c where a settler gives up on a site it cannot reach in time.
    private final Map<Long, Integer> unitStuckTurns = new HashMap<>();

    // Maximum consecutive turns a settler may fail to move toward its target
    // before the target is considered unreachable and cleared.
    // A value of 5 is sufficient to survive temporary obstacles (e.g. enemy units
    // blocking a corridor) while quickly releasing targets on the far side of water.
    private static final int SETTLER_STUCK_TURNS = 5;

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

    // Danger score threshold above which a city is considered in grave danger
    // and triggers an emergency production override regardless of the current
    // build queue.  Mirrors city_data->grave_danger in daimilitary.c.
    private static final int GRAVE_DANGER_THRESHOLD = 15;

    // Maximum distance (Manhattan) at which enemy units contribute to a city's
    // danger score.  Mirrors ASSESS_DANGER_MAX_DISTANCE in daimilitary.c.
    private static final int ASSESS_DANGER_MAX_DISTANCE = 6;

    // Distance within which enemy military units make a settler tile "unsafe",
    // mirroring adv_settler_safe_tile() radius in daisettler.c.
    private static final int SETTLER_SAFE_DISTANCE = 2;

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
    private static final int TERRAIN_MOUNTAINS = 10;
    private static final int TERRAIN_FOREST    = 6;
    private static final int TERRAIN_JUNGLE    = 9;
    private static final int TERRAIN_DESERT    = 5;
    private static final int TERRAIN_TUNDRA    = 13;
    private static final int TERRAIN_OCEAN     = 2;
    private static final int TERRAIN_DEEP_OCEAN = 3;

    // Improvement IDs — resolved at runtime by name in resolveGameIds() because IDs
    // are assigned in the order buildings appear in the ruleset file.
    // Initial values of -1 (unknown) are overwritten on the first AI turn.
    private int imprBarracks      = -1;
    private int imprGranary       = -1;
    private int imprLibrary       = -1;
    private int imprMarketplace   = -1;
    private int imprCityWalls     = -1;
    private int imprTemple        = -1;
    private int imprAqueduct      = -1; // Allows cities to grow beyond size 8
    // Mid/late-game buildings — mirrors dai_city_choose_build() priorities in daicity.c
    private int imprColosseum     = -1; // Happiness (Construction tech required)
    private int imprUniversity    = -1; // Science × 2 (University tech, Library prereq)
    private int imprBank          = -1; // Gold × 1.5 (Banking tech, Marketplace prereq)
    private int imprCourthouse    = -1; // Reduces corruption (Code of Laws required)
    // Late-game production and economy buildings
    private int imprFactory       = -1; // Shields +50% (Industrialization tech)
    private int imprResearchLab   = -1; // Science +200% with Library+University (Computers tech)
    private int imprStockExchange = -1; // Gold+Luxury +50% when Bank present (Economics tech)

    // Unit-type IDs — resolved at runtime by name in resolveGameIds().
    // Initial values of -1 are overwritten on the first AI turn.
    private static final int UNIT_SETTLERS = 0;
    private static final int UNIT_WORKERS  = 1;
    private static final int UNIT_WARRIORS = 3;
    private int unitPhalanx  = -1; // Bronze Working — best early defender
    private int unitArchers  = -1; // Warrior Code — strong attacker
    private int unitLegion   = -1; // Iron Working  — best early all-rounder
    private int unitPikemen  = -1; // Feudalism      — anti-horse specialist
    private int unitHorsemen = -1; // Horseback Riding — fast raider

    // Technology IDs — resolved at runtime by name in resolveGameIds().
    // Initial values of -1 are overwritten on the first AI turn.
    private long techAlphabet           = -1L;
    private long techMathematics        = -1L;
    private long techTheRepublic        = -1L;
    private long techMasonry            = -1L;
    private long techBronzeWorking      = -1L;
    private long techIronWorking        = -1L;
    private long techWriting            = -1L;
    private long techCodeOfLaws         = -1L;
    private long techHorsebackRiding    = -1L;
    private long techPottery            = -1L;
    private long techWarriorCode        = -1L;
    private long techCeremonialBurial   = -1L;
    private long techMonarchy           = -1L;
    private long techDemocracy          = -1L;
    private long techFeudalism          = -1L; // Pikemen (anti-horse); req: Warrior Code + Monarchy
    private long techCurrency           = -1L; // req: Bronze Working — unlocks Construction
    private long techConstruction       = -1L; // req: Masonry + Currency — unlocks Aqueduct, Colosseum
    private long techMysticism          = -1L; // req: Ceremonial Burial — Philosophy prereq
    private long techLiteracy           = -1L; // req: Writing + Code of Laws — Philosophy, University prereq
    private long techTrade              = -1L; // req: Currency + Code of Laws — Banking prereq
    private long techBanking            = -1L; // req: Trade + The Republic — unlocks Bank
    private long techUniversity         = -1L; // req: Mathematics + Philosophy — unlocks University building
    private long techIndustrialization  = -1L; // req: Gunpowder + Trade — Factory
    private long techEconomics          = -1L; // req: Trade + University — Stock Exchange

    private static final int[] DIR_DX = {-1, 0, 1, -1, 1, -1, 0, 1};
    private static final int[] DIR_DY = {-1, -1, -1, 0, 0, 1, 1, 1};

    public AiPlayer(Game game) {
        this.game = game;
    }

    /**
     * Executes all AI actions for the current turn synchronously.
     */
    public void runAiTurns() {
        try {
            executeAiTurns();
        } catch (Exception e) {
            log.error("AI turn error: {}", e.getMessage(), e);
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

        // Phase 0b: Adjust tax/science/luxury rates to maintain a positive gold balance
        // while maximising research speed.  Mirrors dai_manage_taxes() in aihand.c.
        manageAiTaxRates();

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

            // Non-military land units with no attack (Engineers, etc.): treat as
            // workers and build terrain improvements.  Mirrors the C Freeciv server's
            // autosettlers.c behaviour where Engineers are driven by the same
            // auto-settler logic as Workers.  Uses the hasSettlersFlag (parsed from
            // the classic ruleset "Settlers" unit flag) so only terrain-improvement
            // units are routed here, not Diplomats or Spies which share the NonMil
            // flag but have different roles.
            if (utype.hasSettlersFlag() && utype.getAttackStrength() == 0) {
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
     * Resolves improvement, unit-type, and technology IDs from the loaded game
     * data by name.  This is necessary because IDs are assigned in the order
     * buildings/techs/units appear in the ruleset file.
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
                case "Barracks":       imprBarracks      = id; break;
                case "Granary":        imprGranary       = id; break;
                case "Library":        imprLibrary       = id; break;
                case "Marketplace":    imprMarketplace   = id; break;
                case "City Walls":     imprCityWalls     = id; break;
                case "Temple":         imprTemple        = id; break;
                case "Aqueduct":       imprAqueduct      = id; break;
                case "Colosseum":      imprColosseum     = id; break;
                case "University":     imprUniversity    = id; break;
                case "Bank":           imprBank          = id; break;
                case "Courthouse":     imprCourthouse    = id; break;
                case "Factory":        imprFactory       = id; break;
                case "Research Lab":   imprResearchLab   = id; break;
                case "Stock Exchange": imprStockExchange = id; break;
                default: break;
            }
        }
        for (Map.Entry<Long, Technology> e : game.techs.entrySet()) {
            String n = e.getValue().getName();
            long id = e.getKey();
            switch (n) {
                case "Alphabet":          techAlphabet          = id; break;
                case "Mathematics":       techMathematics       = id; break;
                case "The Republic":      techTheRepublic       = id; break;
                case "Masonry":           techMasonry           = id; break;
                case "Bronze Working":    techBronzeWorking     = id; break;
                case "Iron Working":      techIronWorking       = id; break;
                case "Writing":           techWriting           = id; break;
                case "Code of Laws":      techCodeOfLaws        = id; break;
                case "Horseback Riding":  techHorsebackRiding   = id; break;
                case "Pottery":           techPottery           = id; break;
                case "Warrior Code":      techWarriorCode       = id; break;
                case "Ceremonial Burial": techCeremonialBurial  = id; break;
                case "Monarchy":          techMonarchy          = id; break;
                case "Democracy":         techDemocracy         = id; break;
                case "Feudalism":         techFeudalism        = id; break;
                case "Currency":          techCurrency          = id; break;
                case "Construction":      techConstruction      = id; break;
                case "Mysticism":         techMysticism         = id; break;
                case "Literacy":          techLiteracy          = id; break;
                case "Trade":             techTrade             = id; break;
                case "Banking":           techBanking           = id; break;
                case "University":        techUniversity        = id; break;
                case "Industrialization": techIndustrialization = id; break;
                case "Economics":         techEconomics         = id; break;
                default: break;
            }
        }
        // Resolve advanced unit type IDs — these vary between ruleset files
        // (Settlers=0, Workers=1, Engineers=2, Warriors=3, Phalanx=4, …).
        for (Map.Entry<Long, UnitType> e : game.unitTypes.entrySet()) {
            String n = e.getValue().getName();
            int id = e.getKey().intValue();
            switch (n) {
                case "Phalanx":  unitPhalanx  = id; break;
                case "Archers":  unitArchers  = id; break;
                case "Legion":   unitLegion   = id; break;
                case "Pikemen":  unitPikemen  = id; break;
                case "Horsemen": unitHorsemen = id; break;
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
                log.info("Player {} switched government: Despotism → Monarchy", player.getUsername());
                game.getServer().sendPlayerInfoAll(player);
                return;
            }
        }

        if (currentGov == 2) {
            // Try to advance from Monarchy (2) to Republic (4)
            if (player.hasTech(techTheRepublic)) {
                player.setGovernmentId(4); // Republic
                log.info("Player {} switched government: Monarchy → Republic", player.getUsername());
                game.getServer().sendPlayerInfoAll(player);
                return;
            }
        }

        if (currentGov == 4) {
            // Try to advance from Republic (4) to Democracy (5)
            if (player.hasTech(techDemocracy)) {
                player.setGovernmentId(5); // Democracy
                log.info("Player {} switched government: Republic → Democracy", player.getUsername());
                game.getServer().sendPlayerInfoAll(player);
            }
        }
    }

    // =========================================================================
    // Tax rate management (inspired by dai_manage_taxes() in aihand.c)
    // =========================================================================

    /**
     * Adjusts the tax/science/luxury rates of every AI player to maintain a
     * positive gold balance while maximising research speed.  Inspired by
     * {@code dai_manage_taxes()} in the C Freeciv server's
     * {@code ai/default/aihand.c}.
     *
     * <p>Algorithm (simplified version of the C server logic):
     * <ol>
     *   <li>Estimate net gold income: sum of city tax contributions minus
     *       building upkeep and military unit upkeep.</li>
     *   <li>If gold is critically low (below a reserve threshold) <em>and</em>
     *       the estimated income is negative, increase the tax rate by 10 pp
     *       (reduce science by 10 pp) to recover the treasury.  Mirrors the
     *       gold-reserve check in {@code dai_gold_reserve()} in
     *       {@code ai/default/aihand.c}.</li>
     *   <li>If gold is comfortable and income is positive, decrease the tax
     *       rate by 10 pp (increase science by 10 pp) to accelerate research,
     *       up to a maximum science rate of {@value #MAX_AI_SCIENCE_RATE}.</li>
     *   <li>Luxury is held at zero unless unhappy cities remain after the
     *       happiness buildings (Temple, Colosseum) cannot satisfy citizens.
     *       In that case a small luxury allocation (10 pp) is added to keep
     *       citizens content, mirroring the luxury check in daicity.c.</li>
     * </ol>
     *
     * <p>All rates are clamped to multiples of 10 so they are valid for the
     * server-side rate slider (the classic Freeciv client only allows multiples
     * of 10 in tax rates).  Mirrors the {@code RATE_REMAINS} / 10-step
     * iteration in {@code dai_manage_taxes()}.
     */
    private void manageAiTaxRates() {
        for (Player player : new ArrayList<>(game.players.values())) {
            if (!player.isAi() || !player.isAlive()) continue;
            adjustTaxRatesForPlayer(player);
        }
    }

    /**
     * Computes and applies the optimal tax/science/luxury rates for one AI
     * player.  Called from {@link #manageAiTaxRates()}.
     *
     * @param player the AI player whose rates should be adjusted
     */
    private void adjustTaxRatesForPlayer(Player player) {
        long pid = player.getPlayerNo();

        // --- Estimate gross gold income from cities this turn ---
        int estimatedGoldIncome = 0;
        for (Map.Entry<Long, City> entry : game.cities.entrySet()) {
            if (entry.getValue().getOwner() == pid) {
                estimatedGoldIncome += net.freecivx.server.CityTurn
                        .cityTaxContribution(game, entry.getKey());
            }
        }

        // --- Estimate upkeep (mirrors city_support() / unit_gold_upkeep()) ---
        int buildingUpkeep = 0;
        int militaryUnits  = 0;
        long numCities = 0;
        for (Map.Entry<Long, City> entry : game.cities.entrySet()) {
            City city = entry.getValue();
            if (city.getOwner() != pid) continue;
            numCities++;
            for (int improvId : city.getImprovements()) {
                Improvement impr = game.improvements.get((long) improvId);
                if (impr != null) buildingUpkeep += impr.getUpkeep();
            }
        }
        for (Unit unit : game.units.values()) {
            if (unit.getOwner() != pid) continue;
            UnitType utype = game.unitTypes.get((long) unit.getType());
            if (utype != null && utype.getAttackStrength() > 0) militaryUnits++;
        }
        // Classic Freeciv: governments that support units for free in cities
        // (Anarchy/Despotism/Monarchy/Communism) provide 1 free unit per city.
        int govId = player.getGovernmentId();
        boolean hasFreeUnits = govGrantsFreeUnits(govId);
        int freeUnits = hasFreeUnits ? (int) (AI_FREE_UNITS_PER_CITY * numCities) : 0;
        int paidMilitaryUnits = Math.max(0, militaryUnits - freeUnits);
        int totalExpenses = buildingUpkeep + paidMilitaryUnits;

        int netIncome   = estimatedGoldIncome - totalExpenses;
        int currentGold = player.getGold();

        // Gold reserve heuristic: keep at least 2 turns of expenses in the
        // treasury.  Mirrors dai_gold_reserve() in ai/default/aihand.c.
        int goldReserve = Math.max(AI_GOLD_RESERVE_MIN, totalExpenses * AI_GOLD_RESERVE_EXPENSE_MULTIPLIER);

        int sciRate = player.getScienceRate();
        int taxRate = player.getTaxRate();
        int luxRate = player.getLuxuryRate();

        // --- Luxury adjustment ---
        // Give a small luxury allocation when any of the player's cities are
        // unhappy.  Remove luxury if all cities are content.
        boolean hasUnhappyCities = game.cities.values().stream()
                .anyMatch(c -> c.getOwner() == pid && c.isUnhappy());
        if (hasUnhappyCities && luxRate < 20 && sciRate > 10) {
            // Add 10 pp luxury taken from science
            luxRate += 10;
            sciRate -= 10;
        } else if (!hasUnhappyCities && luxRate > 0) {
            // Reclaim luxury allocation for science/tax
            sciRate += luxRate;
            luxRate  = 0;
        }

        // --- Gold adjustment ---
        // If running out of gold: increase tax rate (decrease science).
        if (currentGold < goldReserve && netIncome < 0 && sciRate > 20) {
            taxRate += 10;
            sciRate -= 10;
            log.debug("Player {} raising tax to {}% (gold={}, netIncome={})",
                    player.getUsername(), taxRate, currentGold, netIncome);
        }
        // If flush with cash and income is positive: decrease tax (increase science).
        else if (currentGold >= goldReserve * 2 && netIncome > 0 && sciRate < MAX_AI_SCIENCE_RATE) {
            taxRate -= 10;
            sciRate += 10;
            log.debug("Player {} lowering tax to {}% (gold={}, netIncome={})",
                    player.getUsername(), taxRate, currentGold, netIncome);
        }

        // Clamp all rates to [0,100] in multiples of 10 with the three summing to 100.
        sciRate = Math.max(0, Math.min(MAX_AI_SCIENCE_RATE, (sciRate / 10) * 10));
        luxRate = Math.max(0, Math.min(MAX_AI_LUXURY_RATE, (luxRate / 10) * 10));
        taxRate = 100 - sciRate - luxRate;
        // Guard against rounding drift
        if (taxRate < 0) { sciRate += taxRate; taxRate = 0; }

        if (sciRate != player.getScienceRate()
                || taxRate != player.getTaxRate()
                || luxRate != player.getLuxuryRate()) {
            player.setScienceRate(sciRate);
            player.setTaxRate(taxRate);
            player.setLuxuryRate(luxRate);
        }
    }

    /** Maximum science rate the AI will ever set (percentage).
     *  Mirrors the maxrate cap in dai_manage_taxes() (default 100 for AI). */
    private static final int MAX_AI_SCIENCE_RATE = 80;

    /** Maximum luxury rate the AI will ever set (percentage).
     *  A small luxury allocation satisfies most unhappy citizens without
     *  sacrificing too much science.  Mirrors the luxury-minimum calculation
     *  in dai_manage_taxes() in ai/default/aihand.c. */
    private static final int MAX_AI_LUXURY_RATE = 20;

    /** Minimum gold reserve target (absolute floor, in gold units).
     *  Mirrors AI_GOLD_RESERVE_MIN_TURNS × typical expenses in aihand.c. */
    private static final int AI_GOLD_RESERVE_MIN = 20;

    /** Number of turns of expenses that define the gold reserve.
     *  Mirrors AI_GOLD_RESERVE_MIN_TURNS in ai/default/aihand.c. */
    private static final int AI_GOLD_RESERVE_EXPENSE_MULTIPLIER = 2;

    /** Number of military units supported for free per city by certain governments
     *  (Anarchy, Despotism, Monarchy, Communism) in the classic Freeciv ruleset.
     *  Mirrors the Unit_Upkeep_Free_Per_City effect in classic effects.ruleset and
     *  the FREE_UNITS_PER_CITY constant used in CityTurn. */
    private static final int AI_FREE_UNITS_PER_CITY = 3;

    /**
     * Returns {@code true} if the given government grants free unit support
     * (Unit_Upkeep_Free_Per_City > 0) in the classic Freeciv ruleset.
     *
     * <p>In the classic ruleset the first four governments (IDs 0–3: Anarchy,
     * Despotism, Monarchy, Communism) each support
     * {@link #AI_FREE_UNITS_PER_CITY} military units per city for free.
     * Republic (4) and Democracy (5) require gold for every military unit.
     * Using a method rather than a bare ID comparison makes the intent clear
     * and mirrors the Unit_Upkeep_Free_Per_City effect look-up in the C Freeciv
     * server's {@code common/effects.c}.
     *
     * @param govId the player's current government ID
     * @return {@code true} if the government provides free unit support per city
     */
    private static boolean govGrantsFreeUnits(int govId) {
        // IDs 0–3: Anarchy, Despotism, Monarchy, Communism — all grant free units.
        // IDs 4–5: Republic, Democracy — no free units.
        return govId <= 3;
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
     *   <li>Bronze Working → Phalanx (better defender) and military chain</li>
     *   <li>Currency → prerequisite for Construction (Aqueduct, Colosseum chain)</li>
     *   <li>Warrior Code → Archers (strong attacker) and Feudalism prereq</li>
     *   <li>Masonry → Barracks and City Walls (defence) and Construction prereq</li>
     *   <li>Construction → Aqueduct (city growth beyond size 8), Colosseum (happiness)</li>
     *   <li>Alphabet → Temple (happiness) and many prerequisites</li>
     *   <li>Writing → Library (science bonus) and Literacy prereq</li>
     *   <li>Code of Laws → Marketplace (trade bonus) and Monarchy/Literacy prerequisite</li>
     *   <li>Literacy → prerequisite for Philosophy → University</li>
     *   <li>Ceremonial Burial → Temple (happiness) and Monarchy prerequisite</li>
     *   <li>Mysticism → prerequisite for Philosophy → University</li>
     *   <li>Monarchy → better government (less corruption) once both prerequisites met</li>
     *   <li>Feudalism → Pikemen (anti-horse unit, 2× defence vs Horse units)</li>
     *   <li>Horseback Riding → Horsemen (fast raider, 2 move)</li>
     *   <li>Iron Working → Legion (best early all-rounder: 4 atk / 2 def)</li>
     *   <li>Mathematics → University tech prerequisite</li>
     *   <li>Trade → prerequisite for Banking</li>
     *   <li>The Republic → Republic government and Banking prerequisite</li>
     *   <li>Banking → Bank building (gold income ×1.5)</li>
     *   <li>University tech → University building (science ×2)</li>
     *   <li>Democracy → Democracy government (zero corruption)</li>
     * </ol>
     *
     * @param player   the AI player
     * @param playerId the player's connection ID
     */
    private void pickResearchGoal(Player player, long playerId) {
        if (player.getResearchingTech() >= 0) return; // Already researching

        long[] priorityTechs = {
            techPottery,              // Granary → faster city growth
            techBronzeWorking,        // Phalanx + military prerequisite chain
            techCurrency,             // Construction prerequisite (Aqueduct/Colosseum chain)
            techWarriorCode,          // Archers (strong attacker) + Feudalism prereq
            techMasonry,              // Barracks + City Walls + Construction prereq
            techConstruction,         // Aqueduct (growth >8) + Colosseum (happiness)
            techAlphabet,             // Temple (happiness) + many prerequisites
            techWriting,              // Library → science bonus + Literacy prereq
            techCodeOfLaws,           // Marketplace + Monarchy/Literacy prerequisite
            techLiteracy,             // Philosophy prereq → University chain
            techCeremonialBurial,     // Temple + Monarchy prerequisite
            techMysticism,            // Philosophy prereq → University chain
            techMonarchy,             // Better government (less corruption)
            techFeudalism,            // Pikemen — 2× defence vs Horse units
            techHorsebackRiding,      // Horsemen (fast raider, 2 move)
            techIronWorking,          // Legion — 4 atk / 2 def, best early unit
            techMathematics,          // University tech prerequisite
            techTrade,                // Banking + Industrialization prerequisite
            techTheRepublic,          // Republic government
            techBanking,              // Bank — gold income ×1.5
            techUniversity,           // University building — science ×2
            techDemocracy,            // Democracy government (zero corruption)
            techIndustrialization,    // Factory — shields ×1.5
            techEconomics,            // Stock Exchange — gold/luxury ×1.5 additional
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
     *   <li><b>Emergency defense override</b>: when the danger score reaches
     *       {@link #GRAVE_DANGER_THRESHOLD} and the city has no garrison, interrupt
     *       any ongoing production and queue the best available defender immediately.
     *       Mirrors {@code city_data->grave_danger} handling in daimilitary.c.</li>
     *   <li>Produce best available defender when the city is undefended or under
     *       any measurable threat (danger score > 0).</li>
     *   <li><b>Happiness emergency</b>: when the city is unhappy, build a Temple or
     *       Colosseum before expansion.  Mirrors the C AI's unhappy-city priority in
     *       daicity.c citizen management.</li>
     *   <li>Build a Barracks for veteran units and fast healing (no tech required).</li>
     *   <li>Produce Settlers immediately when the empire has only 1 city (early expansion),
     *       provided the city has a food surplus to survive the population cost.</li>
     *   <li>Build a Granary for sustained food growth (Pottery required).</li>
     *   <li>Produce more Settlers when the empire still has fewer than 4 cities and the
     *       city has a food surplus.</li>
     *   <li>Build a Temple for citizen happiness (Ceremonial Burial required).</li>
     *   <li>Produce a Worker for terrain improvements (when city count ≥ 2, size ≥ 3,
     *       and workers are below one per city).</li>
     *   <li>Build a Library for science output (Writing required).</li>
     *   <li>Build a University for science bonus (University tech + Library required).</li>
     *   <li>Build an Aqueduct when the city is approaching size 8 so it can continue
     *       growing (Construction tech required).</li>
     *   <li>Build a Colosseum for citizen happiness in larger cities
     *       (Construction tech required).</li>
     *   <li>Build a Marketplace for gold income (Code of Laws required).</li>
     *   <li>Build a Bank for additional gold income (Banking tech + Marketplace required).</li>
     *   <li>Build City Walls for passive defence (Masonry required).</li>
     *   <li>Default: produce the best available offensive unit for army expansion.</li>
     * </ol>
     *
     * <p>Non-emergency production decisions are only made when the slot is empty
     * ({@code productionKind == 0 && productionValue == -1}), which is the
     * state {@link net.freecivx.server.CityTurn#cityProduction} sets after an
     * improvement completes.
     *
     * @param city   the city to manage
     * @param cityId the city's key in {@code game.cities}
     * @param owner  the AI player who owns the city
     */
    private void manageAiCity(City city, long cityId, Player owner) {
        long ownerId = city.getOwner();
        int defenders = countUnitsOnTile(city.getTile(), ownerId);
        int dangerScore = assessCityDanger(city);

        // Pick the best military unit this player can currently build.
        int bestDefender = bestAvailableDefender(owner);

        // Emergency defense: grave danger with no garrison overrides any in-progress
        // production to immediately queue a defender.  Mirrors the C Freeciv AI in
        // daimilitary.c where assess_danger() sets city_data->grave_danger and the
        // city production loop forces a defender build regardless of other priorities.
        if (dangerScore >= GRAVE_DANGER_THRESHOLD && defenders == 0) {
            city.setProductionKind(0);
            city.setProductionValue(bestDefender);
            return;
        }

        // For non-emergency decisions, only fill an empty production slot
        // (-1 = nothing queued); do not override in-progress work.
        if (city.getProductionKind() != 0 || city.getProductionValue() != -1) return;

        // Priority 1: Defend the city (from daimilitary.c danger assessment).
        // Use the best available unit — Phalanx (Bronze Working), Archers (Warrior Code),
        // Legion (Iron Working) or Warriors as a fallback.
        // Give one defender to ungarrisoned cities; add a second when the city is
        // under significant threat (mirrors the garrison-size logic in daimilitary.c
        // where cities with danger > 0 are given at least two garrison units).
        if (defenders == 0 || (dangerScore > 0 && defenders < 2)) {
            city.setProductionKind(0);
            city.setProductionValue(bestDefender);
            return;
        }

        // Priority 1.5: Happiness emergency — when the city is unhappy, build
        // a happiness building before anything else (except defense).  Mirrors the
        // C Freeciv AI which checks city->ppl_unhappy > 0 and raises the priority
        // of Temple and Colosseum for unhappy cities (daicity.c citizen handling).
        if (city.isUnhappy()) {
            if (!city.hasImprovement(imprTemple)) {
                Improvement temple = game.improvements.get((long) imprTemple);
                if (temple != null && canBuildImprovement(owner, city, temple)) {
                    city.setProductionKind(1);
                    city.setProductionValue(imprTemple);
                    return;
                }
            }
            if (!city.hasImprovement(imprColosseum) && imprColosseum >= 0) {
                Improvement colosseum = game.improvements.get((long) imprColosseum);
                if (colosseum != null && canBuildImprovement(owner, city, colosseum)) {
                    city.setProductionKind(1);
                    city.setProductionValue(imprColosseum);
                    return;
                }
            }
        }

        // Priority 2: Barracks for fast unit healing (no tech required).
        // Mirrors the high priority given to Barracks in the C Freeciv AI because
        // veteran-producing and full-healing Barracks are essential for sustained
        // military campaigns.
        if (!city.hasImprovement(imprBarracks)) {
            Improvement barracks = game.improvements.get((long) imprBarracks);
            if (barracks != null && canBuildImprovement(owner, city, barracks)) {
                city.setProductionKind(1);
                city.setProductionValue(imprBarracks);
                return;
            }
        }

        // Compute empire city count once; used by both the early-expansion
        // and later-expansion settler priorities below.
        long myCityCount = game.cities.values().stream()
                .filter(c -> c.getOwner() == ownerId).count();

        // Priority 3: Early expansion – produce Settlers before Granary when the empire is
        // very small (just 1 city).  Mirrors the C Freeciv default AI behaviour where
        // expansion is the top strategic goal in the early game (dai_manage_cities /
        // dai_settler_manage in daicity.c / daisettler.c).  A city must be at least
        // size 2 so the pop_cost=1 of Settlers does not destroy the last citizen.
        // Also require a positive food surplus so the city won't starve after paying
        // the population cost — mirrors the food-loss calculation in daicity.c.
        if (myCityCount < 2 && city.getSize() >= 2 && cityHasFoodSurplus(city)) {
            city.setProductionKind(0);
            city.setProductionValue(UNIT_SETTLERS);
            return;
        }

        // Priority 4: Granary for sustained food growth (Pottery required)
        if (!city.hasImprovement(imprGranary)) {
            Improvement granary = game.improvements.get((long) imprGranary);
            if (granary != null && canBuildImprovement(owner, city, granary)) {
                city.setProductionKind(1);
                city.setProductionValue(imprGranary);
                return;
            }
        }

        // Priority 5: Settlers to continue expanding the empire.
        // Mirrors the C Freeciv AI which expands aggressively as long as good land
        // is available (daisettler.c / daicity.c — no hard city cap in the C AI).
        // The food-surplus check prevents starvation, and the settler AI itself
        // will halt expansion when no good city sites remain.
        // Require food surplus so the city won't stagnate after paying pop_cost=1.
        if (myCityCount < 8 && city.getSize() >= 2 && cityHasFoodSurplus(city)) {
            city.setProductionKind(0);
            city.setProductionValue(UNIT_SETTLERS);
            return;
        }

        // Priority 6: Temple for citizen happiness (Ceremonial Burial required).
        // Mirrors the C Freeciv AI prioritising temples early to keep citizens content
        // so more of the city's output can be used for production (dai_city_choose_build
        // in daicity.c ranks temples highly for unhappy cities).
        if (!city.hasImprovement(imprTemple)) {
            Improvement temple = game.improvements.get((long) imprTemple);
            if (temple != null && canBuildImprovement(owner, city, temple)) {
                city.setProductionKind(1);
                city.setProductionValue(imprTemple);
                return;
            }
        }

        // Priority 7: Workers for terrain improvements (roads, irrigation, mines).
        // Keep at most one Worker per city; any more and returns diminish quickly.
        // A city must be at least size 3 so building a Worker (pop_cost=0) doesn't
        // leave it at minimum population.  Mirrors the auto-settler management in
        // autosettlers.c / daisettler.c where Workers continuously improve tiles
        // to boost output for nearby cities.
        if (myCityCount >= 2 && city.getSize() >= 3) {
            int myWorkers = countUnitsOfType(ownerId, UNIT_WORKERS);
            if (myWorkers < myCityCount) {
                city.setProductionKind(0);
                city.setProductionValue(UNIT_WORKERS);
                return;
            }
        }

        // Priority 8: Library for science output (Writing required)
        if (!city.hasImprovement(imprLibrary) && city.getSize() >= 2) {
            Improvement library = game.improvements.get((long) imprLibrary);
            if (library != null && canBuildImprovement(owner, city, library)) {
                city.setProductionKind(1);
                city.setProductionValue(imprLibrary);
                return;
            }
        }

        // Priority 9: University for science bonus (University tech + Library prereq).
        // Mirrors daicity.c which prioritises science buildings to accelerate the
        // tech tree; University doubles science output from a city.
        if (!city.hasImprovement(imprUniversity) && imprUniversity >= 0 && city.getSize() >= 3) {
            Improvement university = game.improvements.get((long) imprUniversity);
            if (university != null && canBuildImprovement(owner, city, university)) {
                city.setProductionKind(1);
                city.setProductionValue(imprUniversity);
                return;
            }
        }

        // Priority 10: Aqueduct to allow city growth beyond size 8.
        // Cities approaching size 8 should pre-emptively build the Aqueduct so
        // growth is never blocked.  Mirrors the size-limit check in
        // CityTurn.cityGrowth() which halts growth at size 8 without an Aqueduct.
        if (!city.hasImprovement(imprAqueduct) && city.getSize() >= 6) {
            Improvement aqueduct = game.improvements.get((long) imprAqueduct);
            if (aqueduct != null && canBuildImprovement(owner, city, aqueduct)) {
                city.setProductionKind(1);
                city.setProductionValue(imprAqueduct);
                return;
            }
        }

        // Priority 11: Colosseum for citizen happiness in larger cities
        // (Construction tech required).  Mirrors daicity.c where happiness buildings
        // are ranked highly for larger cities — each unhappy citizen costs a unit
        // of production, so the Colosseum pays for itself quickly in large cities.
        if (!city.hasImprovement(imprColosseum) && imprColosseum >= 0 && city.getSize() >= 5) {
            Improvement colosseum = game.improvements.get((long) imprColosseum);
            if (colosseum != null && canBuildImprovement(owner, city, colosseum)) {
                city.setProductionKind(1);
                city.setProductionValue(imprColosseum);
                return;
            }
        }

        // Priority 12: Marketplace for trade income (Code of Laws required)
        if (!city.hasImprovement(imprMarketplace) && city.getSize() >= 3) {
            Improvement marketplace = game.improvements.get((long) imprMarketplace);
            if (marketplace != null && canBuildImprovement(owner, city, marketplace)) {
                city.setProductionKind(1);
                city.setProductionValue(imprMarketplace);
                return;
            }
        }

        // Priority 13: Bank for additional gold income (Banking tech + Marketplace prereq).
        // Mirrors daicity.c which ranks Banks highly for cities with good trade output.
        if (!city.hasImprovement(imprBank) && imprBank >= 0 && city.getSize() >= 3) {
            Improvement bank = game.improvements.get((long) imprBank);
            if (bank != null && canBuildImprovement(owner, city, bank)) {
                city.setProductionKind(1);
                city.setProductionValue(imprBank);
                return;
            }
        }

        // Priority 14: Courthouse to reduce corruption in governments that suffer from it.
        // Only useful when the player is under Despotism, Monarchy, or Communism (which
        // have non-zero corruption percentages in the classic ruleset).  Mirrors
        // dai_city_choose_build() in daicity.c which evaluates corruption-reducing buildings
        // for empires with more than 2 cities — larger empires have more to gain from
        // reducing corruption at distant cities.
        if (!city.hasImprovement(imprCourthouse) && imprCourthouse >= 0 && myCityCount >= 3) {
            Government gov = game.governments.get((long) owner.getGovernmentId());
            if (gov != null && gov.getCorruptionPct() > 0) {
                Improvement courthouse = game.improvements.get((long) imprCourthouse);
                if (courthouse != null && canBuildImprovement(owner, city, courthouse)) {
                    city.setProductionKind(1);
                    city.setProductionValue(imprCourthouse);
                    return;
                }
            }
        }

        // Priority 15: City Walls for passive defence (Masonry required)
        if (!city.hasImprovement(imprCityWalls)) {
            Improvement walls = game.improvements.get((long) imprCityWalls);
            if (walls != null && canBuildImprovement(owner, city, walls)) {
                city.setProductionKind(1);
                city.setProductionValue(imprCityWalls);
                return;
            }
        }

        // Priority 16: Factory for shield production bonus (+50% shields per turn).
        // Industrialization required; only valuable in mid-sized cities that
        // already have most essential buildings.  Mirrors dai_city_choose_build()
        // in daicity.c where production multipliers are ranked after basic services.
        if (!city.hasImprovement(imprFactory) && imprFactory >= 0 && city.getSize() >= 5) {
            Improvement factory = game.improvements.get((long) imprFactory);
            if (factory != null && canBuildImprovement(owner, city, factory)) {
                city.setProductionKind(1);
                city.setProductionValue(imprFactory);
                return;
            }
        }

        // Priority 17: Stock Exchange for gold and luxury bonus.
        // Requires Economics tech + Bank; increases gold and luxury by 50%.
        // Mirrors daicity.c ranking of economic buildings after science and defense.
        if (!city.hasImprovement(imprStockExchange) && imprStockExchange >= 0 && city.getSize() >= 4) {
            Improvement stockExchange = game.improvements.get((long) imprStockExchange);
            if (stockExchange != null && canBuildImprovement(owner, city, stockExchange)) {
                city.setProductionKind(1);
                city.setProductionValue(imprStockExchange);
                return;
            }
        }

        // Priority 18: Research Lab for science bonus (+200% with Library+University).
        // Computers tech required; only valuable in cities that already have both
        // Library and University.  Mirrors daicity.c science building prioritisation.
        if (!city.hasImprovement(imprResearchLab) && imprResearchLab >= 0 && city.getSize() >= 4) {
            Improvement researchLab = game.improvements.get((long) imprResearchLab);
            if (researchLab != null && canBuildImprovement(owner, city, researchLab)) {
                city.setProductionKind(1);
                city.setProductionValue(imprResearchLab);
                return;
            }
        }

        // Default: produce the best available offensive unit for army expansion.
        // Mirrors dai_choose_attacker() in ai/default/daimilitary.c — when the
        // empire is secure, build mobile offensive units (Horsemen) rather than
        // pure defenders so the AI can raid and capture undefended enemy cities.
        city.setProductionKind(0);
        city.setProductionValue(bestAvailableAttacker(owner));
    }


    /**
     * Returns {@code true} if the player has the prerequisite technology and
     * any required city-building improvement to build the given improvement in
     * the specified city.  Mirrors {@code can_city_build_improvement_direct()}
     * in the C Freeciv server's {@code common/city.c}.
     *
     * @param player the building player
     * @param city   the city where the improvement would be built
     * @param impr   the improvement type to test
     */
    private boolean canBuildImprovement(Player player, City city, Improvement impr) {
        long techReq = impr.getTechReqId();
        if (techReq >= 0 && !player.hasTech(techReq)) return false;
        // Check city-building prerequisite (e.g. Cathedral requires Temple).
        String reqBldgName = impr.getRequiredBuildingName();
        if (reqBldgName != null && !reqBldgName.isEmpty()
                && !net.freecivx.server.CityTurn.cityHasImprovementByName(game, city, reqBldgName)) {
            return false;
        }
        return true;
    }

    /**
     * Returns {@code true} if the player has the prerequisite technology to
     * build the given improvement (no city-context check).
     * Used for player-level tech checks only.
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
     * Returns the number of units of the given type belonging to
     * {@code ownerId}.  Used to cap Worker production to a reasonable number
     * relative to the empire's city count.
     */
    private int countUnitsOfType(long ownerId, int unitType) {
        int count = 0;
        for (Unit u : game.units.values()) {
            if (u.getOwner() == ownerId && u.getType() == unitType) count++;
        }
        return count;
    }

    /**
     * Returns the best available military defender the player can build given
     * their current technology.  Mirrors the unit-selection logic in
     * {@code dai_build_adv_adjust_tech()} ({@code ai/default/daibuild.c}):
     * prefer the unit with the best defence value for which the required tech
     * is already known.
     *
     * <p>Priority (classic Freeciv early game):
     * <ol>
     *   <li>Legion (Iron Working) — 4 atk / 2 def, best early all-rounder</li>
     *   <li>Archers (Warrior Code) — 3 atk / 2 def, strong attacker</li>
     *   <li>Phalanx (Bronze Working) — 1 atk / 2 def, best pure defender</li>
     *   <li>Warriors (none) — 1 atk / 1 def, always buildable</li>
     * </ol>
     *
     * @param player the AI player
     * @return the unit-type ID of the best available defender
     */
    private int bestAvailableDefender(Player player) {
        if (player.hasTech(techIronWorking))   return unitLegion;
        if (player.hasTech(techWarriorCode))   return unitArchers;
        if (player.hasTech(techBronzeWorking)) return unitPhalanx;
        return UNIT_WARRIORS;
    }

    /**
     * Returns the best available offensive unit the player can build given
     * their current technology.  Mirrors {@code dai_choose_attacker()} in
     * {@code ai/default/daimilitary.c}: when the empire is secure and units
     * are being built for expansion/raiding, prefer fast mobile units and
     * high-attack units over pure defenders.
     *
     * <p>Priority (classic Freeciv early game):
     * <ol>
     *   <li>Horsemen (Horseback Riding) — 2 atk / 1 def / 2 move, best raider</li>
     *   <li>Legion (Iron Working) — 4 atk / 2 def / 1 move, strongest attacker</li>
     *   <li>Archers (Warrior Code) — 3 atk / 2 def / 1 move, strong attacker</li>
     *   <li>Warriors (none) — 1 atk / 1 def / 1 move, always buildable</li>
     * </ol>
     *
     * @param player the AI player
     * @return the unit-type ID of the best available attacker
     */
    private int bestAvailableAttacker(Player player) {
        if (player.hasTech(techHorsebackRiding)) return unitHorsemen;
        if (player.hasTech(techIronWorking))     return unitLegion;
        if (player.hasTech(techWarriorCode))     return unitArchers;
        return UNIT_WARRIORS;
    }

    /**
     * Computes a numeric danger score for a city by summing enemy military unit
     * attack strength weighted by proximity.  Units closer to the city
     * contribute more to the score.  Only enemy units with positive attack
     * strength (i.e. military units, not Settlers or Workers) within
     * {@link #ASSESS_DANGER_MAX_DISTANCE} tiles are considered.
     *
     * <p>Danger formula (mirrors assess_danger() in daimilitary.c):
     * <pre>
     *   danger += attack_strength × (MAX_DIST + 1 − distance)
     * </pre>
     * Returns 0 when the city is completely safe.  Values ≥
     * {@link #GRAVE_DANGER_THRESHOLD} indicate imminent threat and trigger an
     * emergency production override in {@link #manageAiCity}.
     *
     * @param city the city to evaluate
     * @return non-negative danger score; 0 = no threat
     */
    private int assessCityDanger(City city) {
        long cx = city.getTile() % game.map.getXsize();
        long cy = city.getTile() / game.map.getXsize();
        long ownerId = city.getOwner();
        int dangerScore = 0;

        for (Unit u : game.units.values()) {
            if (u.getOwner() == ownerId) continue;
            UnitType utype = game.unitTypes.get((long) u.getType());
            if (utype == null || utype.getAttackStrength() == 0) continue;

            long ux = u.getTile() % game.map.getXsize();
            long uy = u.getTile() / game.map.getXsize();
            long dist = Math.abs(ux - cx) + Math.abs(uy - cy);
            if (dist > ASSESS_DANGER_MAX_DISTANCE) continue;

            // Closer units contribute more: attack × (MAX_DIST + 1 − distance).
            dangerScore += utype.getAttackStrength() * (ASSESS_DANGER_MAX_DISTANCE + 1 - dist);
        }
        return dangerScore;
    }

    /**
     * Returns {@code true} if any enemy military unit is within
     * {@link #SETTLER_SAFE_DISTANCE} tiles of the settler.  Used to prevent
     * settlers from wandering into enemy-controlled territory without a
     * military escort, mirroring {@code adv_settler_safe_tile()} in
     * {@code ai/default/daisettler.c}.
     *
     * <p>Only units with positive attack strength are considered (Workers and
     * Settlers are harmless and thus ignored).
     *
     * @param settler the settler unit to check
     * @return {@code true} if the settler's current tile is unsafe
     */
    private boolean isSettlerUnsafe(Unit settler) {
        long sx = settler.getTile() % game.map.getXsize();
        long sy = settler.getTile() / game.map.getXsize();
        long ownerId = settler.getOwner();
        for (Unit u : game.units.values()) {
            if (u.getOwner() == ownerId) continue;
            UnitType utype = game.unitTypes.get((long) u.getType());
            if (utype == null || utype.getAttackStrength() == 0) continue;
            long ux = u.getTile() % game.map.getXsize();
            long uy = u.getTile() / game.map.getXsize();
            if (Math.abs(ux - sx) + Math.abs(uy - sy) <= SETTLER_SAFE_DISTANCE) return true;
        }
        return false;
    }

    /**
     * Returns {@code true} if the city produces more food than its citizens
     * consume (positive food surplus).  Used to gate Settler production so the
     * AI does not build a Settler when doing so would starve the city after the
     * pop_cost=1 is paid.  Mirrors the food-loss calculation in
     * {@code daicity.c} ({@code settler_evals_food_loss}).
     *
     * <p>Food surplus is approximated as: sum of food from all worked tiles
     * (using {@link net.freecivx.server.CityTurn#getTileOutput}) minus
     * {@code city.size × FOOD_UPKEEP_PER_CITIZEN} (2 food per citizen per turn).
     *
     * @param city the city to evaluate
     * @return {@code true} when the city's food output exceeds its upkeep
     */
    private boolean cityHasFoodSurplus(City city) {
        Tile centerTile = game.tiles.get(city.getTile());
        if (centerTile == null) return false;

        // Sum food output from the city-centre tile plus all worked tiles.
        int totalFood = CityTurn.getTileOutput(game, centerTile, true)[0];
        for (Long workedTileId : city.getWorkedTiles()) {
            Tile t = game.tiles.get(workedTileId);
            if (t != null) {
                totalFood += CityTurn.getTileOutput(game, t, false)[0];
            }
        }

        // Each citizen consumes 2 food per turn (FOOD_UPKEEP_PER_CITIZEN = 2).
        int foodUpkeep = city.getSize() * 2;
        return totalFood > foodUpkeep;
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

        // Evict a stale target if the tile has since been claimed, is gone, too
        // close to an existing city, or the settler has been unable to reach it
        // for SETTLER_STUCK_TURNS consecutive turns (unreachable across water, etc.).
        // The stuck-turn check mirrors the "turns to go" reachability guard in the
        // C Freeciv server's daisettler.c where a settler abandons a site it
        // cannot reach within a reasonable timeframe.
        Long target = unitTargets.get(unitId);
        if (target != null) {
            Tile t = game.tiles.get(target);
            int stuck = unitStuckTurns.getOrDefault(unitId, 0);
            if (t == null || t.getWorked() >= 0
                    || !CITY_SUITABLE_TERRAINS.contains(t.getTerrain())
                    || tooCloseToExistingCity(target)
                    || stuck >= SETTLER_STUCK_TURNS) {
                unitTargets.remove(unitId);
                unitStuckTurns.remove(unitId);
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
            unitStuckTurns.remove(unitId);
            return;
        }

        // Move toward the best candidate tile, caching the target across turns.
        if (target == null) {
            long found = findBestCitySpot(unit.getTile(), unit.getOwner());
            if (found >= 0) {
                unitTargets.put(unitId, found);
                unitStuckTurns.remove(unitId);
                target = found;
            }
        }

        // Safety check: do not move into enemy-controlled territory without a
        // military escort.  Mirrors adv_settler_safe_tile() in daisettler.c which
        // cancels settler movement when enemies are adjacent.  We still allow
        // founding a city on the current tile (done above) so a settler that reaches
        // its target despite threat can still found immediately.
        if (isSettlerUnsafe(unit)) {
            return; // Wait for danger to pass
        }

        if (target != null && target >= 0) {
            boolean moved = moveUnitToward(unit, utype, target);
            if (moved) {
                // Progress made — reset the stuck counter.
                unitStuckTurns.remove(unitId);
            } else {
                // No progress this turn — increment the stuck counter.
                // When it reaches SETTLER_STUCK_TURNS the target will be evicted
                // on the next call so the settler searches for a new destination.
                unitStuckTurns.merge(unitId, 1, Integer::sum);
            }
        } else {
            moveUnitRandomly(unit, utype);
        }
    }

    /**
     * Scores a tile's suitability for city founding based on terrain output.
     * Uses actual terrain food and shield values (from {@link net.freecivx.game.Terrain})
     * to score tiles, so the AI correctly prefers Grassland (food=2) over Plains
     * (food=1, shield=1) and Plains over Desert (food=0).  Mirrors the food/shield
     * weighting in {@code city_desirability()} ({@code ai/default/daisettler.c}):
     * food is weighted 2× because a food surplus is critical for growth, while
     * shields and trade bonuses provide secondary value.
     *
     * @param tile the tile to evaluate
     * @return a non-negative integer; higher is better
     */
    private int tileSettlerScore(Tile tile) {
        net.freecivx.game.Terrain terrain = game.terrains.get((long) tile.getTerrain());
        if (terrain == null) return 0;
        // Food weighted 2× (critical for city growth), shield and best-case improvements secondary.
        // Road trade bonus counts as 1 extra point (trade potential once road is built).
        int score = terrain.getFood() * 2
                + terrain.getShield()
                + terrain.getRoadTradeBonus()
                + Math.max(terrain.getIrrigationFoodBonus(), terrain.getMiningShieldBonus());
        return Math.max(0, score);
    }

    /**
     * Scores a potential city site by summing the terrain output of all land
     * tiles within the city's working radius (2 tiles Chebyshev distance from
     * the center).  Mirrors {@code city_desirability()} in
     * {@code ai/default/daisettler.c} which evaluates the full city radius —
     * not just the center tile — to identify sites with a rich surrounding area.
     *
     * <p>Ocean tiles within the radius are skipped (they cannot be worked by
     * land cities in the classic ruleset).  The center tile's score is counted
     * separately and contributes the most value.
     *
     * @param tileId the candidate city center tile
     * @return sum of {@link #tileSettlerScore} across all usable tiles in the radius
     */
    private int cityRadiusScore(long tileId) {
        Tile centerTile = game.tiles.get(tileId);
        if (centerTile == null) return 0;
        int total = tileSettlerScore(centerTile);

        long cx = tileId % game.map.getXsize();
        long cy = tileId / game.map.getXsize();
        for (int dy = -2; dy <= 2; dy++) {
            for (int dx = -2; dx <= 2; dx++) {
                if (dx == 0 && dy == 0) continue; // center already counted
                if (Math.max(Math.abs(dx), Math.abs(dy)) > 2) continue; // outside radius 2
                long nx = cx + dx;
                long ny = cy + dy;
                if (nx < 0 || nx >= game.map.getXsize()
                        || ny < 0 || ny >= game.map.getYsize()) continue;
                Tile t = game.tiles.get(ny * game.map.getXsize() + nx);
                if (t == null) continue;
                int terrain = t.getTerrain();
                if (terrain == TERRAIN_OCEAN || terrain == TERRAIN_DEEP_OCEAN) continue;
                total += tileSettlerScore(t);
            }
        }
        return total;
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
     * Returns {@code true} if any <em>enemy</em> military unit is within
     * {@link #SETTLER_SAFE_DISTANCE} tiles of the given tile.  Used to filter
     * out dangerous city sites in {@link #findBestCitySpot}, mirroring the
     * {@code adv_danger_at()} check in {@code city_desirability()} in
     * {@code ai/default/daisettler.c} which rejects tiles guarded by enemies.
     *
     * @param tileId  the map tile to test
     * @param ownerId the player ID whose enemies to check (own units are safe)
     * @return {@code true} if an enemy military unit is dangerously close
     */
    private boolean isTileThreatenedByEnemy(long tileId, long ownerId) {
        long tx = tileId % game.map.getXsize();
        long ty = tileId / game.map.getXsize();
        for (Unit u : game.units.values()) {
            if (u.getOwner() == ownerId) continue; // skip own units
            UnitType utype = game.unitTypes.get((long) u.getType());
            if (utype == null || utype.getAttackStrength() == 0) continue;
            long ux = u.getTile() % game.map.getXsize();
            long uy = u.getTile() / game.map.getXsize();
            if (Math.abs(ux - tx) + Math.abs(uy - ty) <= SETTLER_SAFE_DISTANCE) return true;
        }
        return false;
    }

    /**
     * Finds the highest-scored unoccupied tile within
     * {@link #SETTLER_SEARCH_RADIUS} that is not too close to an existing city
     * and has a center-tile score of at least {@link #SETTLER_FOUND_SCORE}.
     * Sites are ranked by {@link #cityRadiusScore} — the sum of terrain output
     * across the full city working radius — so the AI prefers sites surrounded
     * by productive land rather than just a single fertile tile.  Ties are
     * broken by proximity.  Mirrors {@code find_best_city_placement()} in
     * {@code ai/default/daisettler.c}.
     *
     * @param fromTile the settler's current tile ID
     * @param ownerId  the settling player's ID (used to identify enemy units)
     * @return the best candidate tile ID, or {@code -1} if none is found
     */
    private long findBestCitySpot(long fromTile, long ownerId) {
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

                // Center tile must be at least minimally fertile so the settler
                // can found here on arrival (mirrors SETTLER_FOUND_SCORE check in
                // handleSettler).
                if (tileSettlerScore(tile) < SETTLER_FOUND_SCORE) continue;

                // Skip sites that are within striking distance of enemy units.
                // Mirrors city_desirability() in daisettler.c which calls
                // adv_danger_at() and returns NULL for dangerous tiles, preventing
                // the AI from sending settlers into contested territory.
                if (isTileThreatenedByEnemy(tileId, ownerId)) continue;

                // Rank by total output across the full city radius (mirrors the
                // city_desirability() multi-tile evaluation in daisettler.c).
                int score = cityRadiusScore(tileId);
                long dist = Math.abs(tx - x) + Math.abs(ty - y);
                // Prefer higher radius score; break ties by proximity
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
                || activity == CityTurn.ACTIVITY_MINE
                || activity == CityTurn.ACTIVITY_RAILROAD) {
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

        // Priority 2: Upgrade road to railroad if none exists.
        // Railroads further halve movement cost and boost trade output.
        boolean hasRail = (currentTile.getExtras()
                & (1 << CityTurn.EXTRA_BIT_RAIL)) != 0;
        if (!hasRail) {
            game.changeUnitActivity(unit.getId(),
                    CityTurn.ACTIVITY_RAILROAD);
            return;
        }

        // Priority 3: Irrigate Grassland or Plains to boost food output.
        boolean hasIrrigation = (currentTile.getExtras()
                & (1 << CityTurn.EXTRA_BIT_IRRIGATION)) != 0;
        if (!hasIrrigation
                && (terrain == TERRAIN_GRASSLAND || terrain == TERRAIN_PLAINS)) {
            game.changeUnitActivity(unit.getId(),
                    CityTurn.ACTIVITY_IRRIGATE);
            return;
        }

        // Priority 4: Mine Hills or Mountains to boost production output.
        // Hills give the highest mining bonus (+3 shields in classic ruleset),
        // while Mountains also benefit from mining (+1 shield).  Both are worth
        // improving.  Mirrors the C Freeciv server's auto_settler logic which
        // evaluates terrain mining bonuses and mines any terrain where
        // mining_shield_incr > 0.
        boolean hasMine = (currentTile.getExtras()
                & (1 << CityTurn.EXTRA_BIT_MINE)) != 0;
        if (!hasMine && (terrain == TERRAIN_HILLS || terrain == TERRAIN_MOUNTAINS)) {
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
     * Finds the best land tile within a search radius that would benefit from
     * a terrain improvement.  Tiles within a city's working radius (3 tiles
     * Chebyshev distance) are preferred because improvements there directly
     * boost city output — mirrors the {@code auto_settler_findwork} heuristic in
     * {@code server/settlers.c} which scores improvement candidates by how much
     * they benefit the closest city.  Within the city-radius preference, tiles
     * are further ranked by the expected output gain from the improvement (using
     * actual terrain bonus values from {@link net.freecivx.game.Terrain}), so
     * high-yield improvements are preferred over low-yield ones regardless of
     * travel distance.  Remaining ties go to the nearest tile.
     *
     * @param fromTile the worker's current tile ID
     * @return the tile ID of the best improvement target, or {@code -1}
     */
    private long findBestWorkerTarget(long fromTile) {
        final int WORKER_SEARCH_RADIUS = 8;
        // City working radius (Chebyshev distance); tiles closer than this to a
        // friendly city yield direct output gains when improved.
        final int CITY_WORK_RADIUS = 3;
        long x = fromTile % game.map.getXsize();
        long y = fromTile / game.map.getXsize();
        long bestTile = -1;
        // Composite score: higher is better (in-city-radius tiles score higher)
        int bestScore = Integer.MIN_VALUE;
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
                boolean railMissing = !roadMissing
                        && (extras & (1 << CityTurn.EXTRA_BIT_RAIL)) == 0;
                boolean irrigationUseful = (t == TERRAIN_GRASSLAND || t == TERRAIN_PLAINS)
                        && (extras & (1 << CityTurn.EXTRA_BIT_IRRIGATION)) == 0;
                // Mine Hills (miningShieldBonus=3) or Mountains (miningShieldBonus=1)
                // when not already mined.  Mirrors the C server's auto_settler_findwork()
                // which evaluates mining_shield_incr > 0 for any terrain.
                boolean mineUseful = (t == TERRAIN_HILLS || t == TERRAIN_MOUNTAINS)
                        && (extras & (1 << CityTurn.EXTRA_BIT_MINE)) == 0;

                if (!roadMissing && !railMissing && !irrigationUseful && !mineUseful) continue;

                // Bonus if this tile is within the working radius of a friendly city.
                // Improvements here have an immediate payoff every turn the city works
                // that tile, so they are strongly preferred over remote improvements.
                int cityProximityBonus = 0;
                for (City city : game.cities.values()) {
                    long cx = city.getTile() % game.map.getXsize();
                    long cy = city.getTile() / game.map.getXsize();
                    long chebyshev = Math.max(Math.abs(tx - cx), Math.abs(ty - cy));
                    if (chebyshev <= CITY_WORK_RADIUS) {
                        cityProximityBonus = 100; // strongly prefer in-radius tiles
                        break;
                    }
                }

                // Improvement value: estimate expected output gain from the best
                // applicable improvement.  Higher-yield improvements are preferred
                // over lower-yield ones when city proximity is equal.  Mirrors the
                // auto_settler_findwork() scoring in settlers.c which uses the
                // actual output delta of each improvement action.
                int improvementValue = 0;
                net.freecivx.game.Terrain terrainObj = game.terrains.get((long) t);
                int irrigBonus  = (terrainObj != null) ? terrainObj.getIrrigationFoodBonus()  : 1;
                int mineBonus   = (terrainObj != null) ? terrainObj.getMiningShieldBonus()     : 1;
                int roadBonus   = (terrainObj != null) ? terrainObj.getRoadTradeBonus()        : 1;
                if (irrigationUseful) {
                    // Irrigation adds food — weight food 2× (same as settler scoring).
                    improvementValue = irrigBonus * 2;
                } else if (mineUseful) {
                    improvementValue = mineBonus;
                } else if (roadMissing) {
                    // Roads provide a trade bonus on most terrains.
                    improvementValue = Math.max(1, roadBonus);
                } else if (railMissing) {
                    improvementValue = 1; // Railroad: movement + modest trade bonus
                }

                long dist = Math.abs(tx - x) + Math.abs(ty - y);
                // Score = city proximity bonus (0 or 100) + improvement value – travel distance.
                // In-radius tiles with high-yield improvements beat remote low-yield ones.
                int score = cityProximityBonus + improvementValue * 5 - (int) dist;
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
    // Military unit AI (inspired by daiunit.c / daimilitary.c)
    // =========================================================================

    /**
     * Military unit AI: assign units to defend ungarrisoned friendly cities
     * before hunting enemies.  Mirrors the city-garrison and danger-assessment
     * logic in {@code ai/default/daimilitary.c} and the persistent unit-task
     * assignment in {@code ai/default/daiunit.c}.
     *
     * <p>When all friendly cities are garrisoned the unit advances toward the
     * nearest strategic target — preferring undefended enemy cities (which can
     * be captured without combat) over defended cities and roaming units.
     * Mirrors the offensive logic in {@code dai_military_attack()} in
     * {@code ai/default/daimilitary.c} where the AI advances on enemy cities
     * once its own empire is secure.
     *
     * <p>A unit that stays in a city to garrison it is switched to
     * {@code ACTIVITY_FORTIFIED} (activity=4) after reaching its post, matching
     * the C Freeciv server's {@code daiunit.c} behaviour where AIUNIT_DEFEND_HOME
     * units call {@code unit_activity_handling(punit, ACTIVITY_FORTIFYING)} once
     * they are in place.  Fortified units receive a +50% defence bonus (mirrors
     * {@code Fortify_Defense_Bonus = 50} in classic {@code effects.ruleset}).
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
                        // Stay put – we are the sole defender.  Switch to FORTIFY
                        // so the unit gets the +50% defence bonus while on guard duty.
                        // Mirrors the AIUNIT_DEFEND_HOME → ACTIVITY_FORTIFYING path
                        // in daiunit.c (see dai_manage_unit()).
                        if (unit.getActivity() != CityTurn.ACTIVITY_FORTIFIED) {
                            game.changeUnitActivity(unitId, CityTurn.ACTIVITY_FORTIFIED);
                        }
                        break;
                    }
                } else {
                    if (!moveUnitToward(unit, utype, defenseTarget)) break;
                }
            } else {
                // No defence assignment: advance toward the nearest strategic
                // target.  Prefer undefended enemy cities (free capture) over
                // defended positions and roaming units.  Mirrors the offensive
                // targeting in dai_military_attack() (daiunit.c / daimilitary.c).
                long offensiveTarget = findNearestOffensiveTarget(unit.getTile(), ownerId);
                if (offensiveTarget >= 0) {
                    if (!moveUnitToward(unit, utype, offensiveTarget)) break;
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
     * Looks for an enemy <em>military</em> unit on a tile adjacent to {@code unit}
     * and attacks it if one is found.  Civilian units (Settlers, Workers and any
     * other unit with zero attack strength) are intentionally skipped: attacking
     * defenceless units wastes move points and prevents settlers from founding
     * cities, stalling the opponent's expansion rather than defeating them.
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
                if (other.getTile() != neighborTileId) continue;
                if (other.getOwner() == owner.getPlayerNo()) continue;
                // Skip civilian units (Settlers, Workers, etc.) – only attack military units.
                UnitType otherType = game.unitTypes.get((long) other.getType());
                if (otherType == null || otherType.getAttackStrength() == 0) continue;
                game.attackUnit(unit.getId(), other.getId());
                return true;
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
     * Returns the tile ID of the best offensive target for a military unit.
     * Prefers undefended enemy cities (which can be captured by simply moving
     * onto the tile) over defended cities and roaming enemy units.  Mirrors the
     * target-selection heuristic in {@code dai_military_attack()} and
     * {@code find_city_want()} in {@code ai/default/daimilitary.c}, where the
     * C AI specifically looks for undefended or weakly-defended enemy cities
     * before hunting roaming military units.
     *
     * <p>Priority:
     * <ol>
     *   <li>Nearest undefended enemy city (no enemy units on its tile) — best target</li>
     *   <li>Nearest enemy city (defended) — secondary target</li>
     *   <li>Nearest enemy unit — fallback when no enemy city is reachable</li>
     * </ol>
     *
     * @param fromTile the attacker's current tile ID
     * @param ownerId  the attacker's player ID
     * @return the tile ID of the best offensive target, or {@code -1} if none found
     */
    private long findNearestOffensiveTarget(long fromTile, long ownerId) {
        long x = fromTile % game.map.getXsize();
        long y = fromTile / game.map.getXsize();

        long bestUndefCityTile = -1;
        long bestUndefCityDist = Long.MAX_VALUE;
        long bestDefCityTile = -1;
        long bestDefCityDist = Long.MAX_VALUE;

        for (City city : game.cities.values()) {
            if (city.getOwner() == ownerId) continue; // skip own cities
            long cx = city.getTile() % game.map.getXsize();
            long cy = city.getTile() / game.map.getXsize();
            long dist = Math.abs(cx - x) + Math.abs(cy - y);

            // Check whether the enemy city is defended by its owner's units.
            // A city is considered defended when the city owner has at least one
            // unit on the tile.  This correctly handles multi-player scenarios where
            // a third-party unit on the tile should not be counted as a defender of
            // the city's owner — mirrors the garrison-count logic in daimilitary.c.
            boolean defended = false;
            long cityOwner = city.getOwner();
            for (Unit u : game.units.values()) {
                if (u.getTile() == city.getTile() && u.getOwner() == cityOwner) {
                    defended = true;
                    break;
                }
            }

            if (!defended) {
                if (dist < bestUndefCityDist) {
                    bestUndefCityDist = dist;
                    bestUndefCityTile = city.getTile();
                }
            } else {
                if (dist < bestDefCityDist) {
                    bestDefCityDist = dist;
                    bestDefCityTile = city.getTile();
                }
            }
        }

        // Prefer undefended enemy cities
        if (bestUndefCityTile >= 0) return bestUndefCityTile;
        // Fall back to defended enemy cities
        if (bestDefCityTile >= 0) return bestDefCityTile;
        // Last resort: find nearest enemy unit
        return findNearestEnemyTile(fromTile, ownerId);
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
     * No-op shutdown method kept for API compatibility.
     */
    public void shutdown() {
    }
}
