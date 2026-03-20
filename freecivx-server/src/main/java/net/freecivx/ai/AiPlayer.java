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

package net.freecivx.ai;

import net.freecivx.game.City;
import net.freecivx.game.Game;
import net.freecivx.game.Improvement;
import net.freecivx.game.Player;
import net.freecivx.game.Technology;
import net.freecivx.game.Unit;
import net.freecivx.game.UnitType;
import net.freecivx.server.CityTurn;
import net.freecivx.server.TechTools;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

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

    final Game game;
    final Random random = new Random();

    // Per-unit persistent target tile IDs (inspired by daiunit.c unit-task system).
    // Storing targets across turns prevents units from changing goals every turn.
    final Map<Long, Long> unitTargets = new HashMap<>();

    // Per-unit consecutive-turns-stuck counter.
    // When a settler (or other unit) fails to make progress toward its target for
    // SETTLER_STUCK_TURNS consecutive turns, the target is evicted so the unit
    // searches for a new, hopefully reachable, destination.
    // Mirrors the "turns to go" reachability check in the C Freeciv server's
    // daisettler.c where a settler gives up on a site it cannot reach in time.
    final Map<Long, Integer> unitStuckTurns = new HashMap<>();

    // Maximum consecutive turns a settler may fail to move toward its target
    // before the target is considered unreachable and cleared.
    // A value of 5 is sufficient to survive temporary obstacles (e.g. enemy units
    // blocking a corridor) while quickly releasing targets on the far side of water.
    static final int SETTLER_STUCK_TURNS = 5;

    // Flag to ensure improvement and technology IDs are resolved only once.
    // IDs are assigned when the game starts and never change, so a single
    // resolution pass is sufficient.
    private boolean idsResolved = false;

    // Danger score threshold above which a city is considered in grave danger
    // and triggers an emergency production override.  Exposed to AiCity/AiMilitary.
    static final int GRAVE_DANGER_THRESHOLD = 15;

    // Improvement IDs — resolved at runtime by name in resolveGameIds() because IDs
    // are assigned in the order buildings appear in the ruleset file.
    // Initial values of -1 (unknown) are overwritten on the first AI turn.
    int imprBarracks      = -1;
    int imprGranary       = -1;
    int imprLibrary       = -1;
    int imprMarketplace   = -1;
    int imprCityWalls     = -1;
    int imprTemple        = -1;
    int imprAqueduct      = -1; // Allows cities to grow beyond size 8
    // Mid/late-game buildings — mirrors dai_city_choose_build() priorities in daicity.c
    int imprColosseum     = -1; // Happiness (Construction tech required)
    int imprUniversity    = -1; // Science × 2 (University tech, Library prereq)
    int imprBank          = -1; // Gold × 1.5 (Banking tech, Marketplace prereq)
    int imprCourthouse    = -1; // Reduces corruption (Code of Laws required)
    int imprCathedral     = -1; // Happiness +3 (Monotheism tech, Temple prereq)
    // Late-game production and economy buildings
    int imprFactory       = -1; // Shields +50% (Industrialization tech)
    int imprResearchLab   = -1; // Science +200% with Library+University (Computers tech)
    int imprStockExchange = -1; // Gold+Luxury +50% when Bank present (Economics tech)
    // Space Race buildings
    int imprApolloProgram    = -1; // Great Wonder – enables spaceship construction
    int imprSpaceStructural  = -1; // Space Race part (Special genus, unlimited)
    int imprSpaceComponent   = -1; // Space Race part (Special genus, unlimited)
    int imprSpaceModule      = -1; // Space Race part (Special genus, unlimited)

    // Unit-type IDs — resolved at runtime by name in resolveGameIds().
    // Initial values of -1 are overwritten on the first AI turn.
    static final int UNIT_SETTLERS = 0;
    static final int UNIT_WORKERS  = 1;
    static final int UNIT_WARRIORS = 3;
    int unitPhalanx  = -1; // Bronze Working — best early defender
    int unitArchers  = -1; // Warrior Code — strong attacker
    int unitLegion   = -1; // Iron Working  — best early all-rounder
    int unitPikemen  = -1; // Feudalism      — anti-horse specialist
    int unitHorsemen = -1; // Horseback Riding — fast raider
    int unitKnights  = -1; // Chivalry — strong mid-game cavalry attacker
    int unitMusketeers = -1; // Gunpowder — mid-game attacker/defender
    int unitRiflemen = -1; // Conscription — strong late attacker/defender
    int unitCavalry  = -1; // Tactics — powerful late-game cavalry
    int unitArmor    = -1; // Mobile Warfare — best land attacker
    // Naval unit-type IDs
    int unitTrireme   = -1; // Map Making — earliest naval combat unit
    int unitCaravel   = -1; // Navigation — mid-game naval explorer
    // Air unit-type IDs
    int unitFighter   = -1; // Flight — earliest air combat unit
    // Diplomat unit-type ID
    int unitDiplomat  = -1; // Writing — diplomatic unit

    // Technology IDs — resolved at runtime by name in resolveGameIds().
    // Initial values of -1 are overwritten on the first AI turn.
    long techAlphabet           = -1L;
    long techMathematics        = -1L;
    long techTheRepublic        = -1L;
    long techMasonry            = -1L;
    long techBronzeWorking      = -1L;
    long techIronWorking        = -1L;
    long techWriting            = -1L;
    long techCodeOfLaws         = -1L;
    long techHorsebackRiding    = -1L;
    long techPottery            = -1L;
    long techWarriorCode        = -1L;
    long techCeremonialBurial   = -1L;
    long techMonarchy           = -1L;
    long techDemocracy          = -1L;
    long techFeudalism          = -1L; // Pikemen (anti-horse); req: Warrior Code + Monarchy
    long techCurrency           = -1L; // req: Bronze Working — unlocks Construction
    long techConstruction       = -1L; // req: Masonry + Currency — unlocks Aqueduct, Colosseum
    long techMysticism          = -1L; // req: Ceremonial Burial — Philosophy prereq
    long techLiteracy           = -1L; // req: Writing + Code of Laws — Philosophy, University prereq
    long techTrade              = -1L; // req: Currency + Code of Laws — Banking prereq
    long techBanking            = -1L; // req: Trade + The Republic — unlocks Bank
    long techUniversity         = -1L; // req: Mathematics + Philosophy — unlocks University building
    long techIndustrialization  = -1L; // req: Gunpowder + Trade — Factory
    long techEconomics          = -1L; // req: Trade + University — Stock Exchange
    long techGunpowder          = -1L; // req: Invention + Iron Working — Musketeers
    long techChivalry           = -1L; // req: Feudalism + Horseback Riding — Knights
    long techConscription       = -1L; // req: Democracy — Riflemen
    long techTactics            = -1L; // req: Conscription + Horseback Riding — Cavalry
    long techMobileWarfare      = -1L; // req: Automobile + Tactics — Armor
    long techMapMaking          = -1L; // req: Alphabet — unlocks Trireme (naval)
    long techNavigation         = -1L; // req: Astronomy + Math — unlocks Caravel
    long techFlight             = -1L; // req: Combustion + Theory of Gravity — Fighter
    long techRocketry           = -1L; // req: Advanced Flight + Electronics — Apollo Program
    long techPlastics           = -1L; // req: Refining + Space Flight — Space Component
    long techSuperconductors    = -1L; // req: Plastics + Labor Union — Space Module
    long techSpaceFlight        = -1L; // req: Computers + Rocketry — Space Structural, Apollo Program
    long techMonotheism         = -1L; // req: Philosophy + Mysticism — Cathedral

    /** AI diplomacy subsystem. Mirrors daidiplomacy.c in the C Freeciv server. */
    private final AiDiplomacy aiDiplomacy = new AiDiplomacy();

    /** Military unit AI sub-module. */
    final AiMilitary aiMilitary;

    /** Settler and worker terrain-improvement AI sub-module. */
    final AiSettler aiSettler;

    /** City production management AI sub-module. */
    final AiCity aiCity;

    public AiPlayer(Game game) {
        this.game = game;
        this.aiMilitary = new AiMilitary(this);
        this.aiSettler  = new AiSettler(this);
        this.aiCity     = new AiCity(this);
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

    /**
     * Reports a military incident to the AI diplomacy subsystem.
     * Should be called whenever any player (human or AI) attacks another player's
     * unit or city so that AI love values can be updated accordingly.
     * Mirrors {@code dai_incident()} in daidiplomacy.c.
     *
     * @param attackerId connection ID of the aggressor
     * @param defenderId connection ID of the victim
     */
    public void reportIncident(long attackerId, long defenderId) {
        aiDiplomacy.handleIncident(game, attackerId, defenderId,
                AiDiplomacy.LOVE_PENALTY_ATTACK);
    }

    /** Performs all AI actions for the current turn (runs on the AI thread). */
    private void executeAiTurns() {
        resolveGameIds();

        // Phase 0a: diplomacy
        aiDiplomacy.beginNewPhase(game);
        aiDiplomacy.performDiplomaticActions(game);

        // Phase 0a-ii: share technologies with allies.
        // Mirrors dai_share() in daidiplomacy.c: allied AI players exchange
        // all applicable techs so they do not duplicate each other's research.
        aiDiplomacy.performTechSharing(game);

        // Phase 0b: government evolution
        manageAiGovernments();

        // Phase 0c: tax / science / luxury rates
        manageAiTaxRates();

        // Phase 1: research goals
        pickResearchGoals();

        // Phase 2: city production — delegate to AiCity
        aiCity.manageAiCities();

        // Phase 2.5: spaceship launch — if any AI player's spaceship is ready
        // (state == STARTED and success_rate > 0), launch it automatically.
        // Mirrors the end-of-turn launch check in the C Freeciv AI.
        for (Player aiPlayer : game.players.values()) {
            if (!aiPlayer.isAi() || !aiPlayer.isAlive()) continue;
            net.freecivx.game.Spaceship ship = aiPlayer.getSpaceship();
            if (ship.getState() == net.freecivx.game.Spaceship.State.STARTED
                    && ship.getSuccessRate() > 0.0) {
                game.handleSpaceshipLaunch(aiPlayer.getPlayerNo());
            }
        }

        // Phase 3: unit actions — delegate to sub-modules
        List<Unit> unitsSnapshot = new ArrayList<>(game.units.values());
        for (Unit unit : unitsSnapshot) {
            Player owner = game.players.get(unit.getOwner());
            if (owner == null || !owner.isAi()) continue;
            if (!game.units.containsKey(unit.getId())) continue;

            UnitType utype = game.unitTypes.get((long) unit.getType());
            if (utype == null) continue;

            if (unit.getType() == UNIT_SETTLERS) {
                aiSettler.handleSettler(unit, utype);
                continue;
            }

            if (unit.getType() == UNIT_WORKERS
                    || (utype.hasSettlersFlag() && utype.getAttackStrength() == 0)) {
                aiSettler.handleWorker(unit, utype);
                continue;
            }

            if (utype.isNonMilitary() && !utype.hasSettlersFlag()
                    && utype.getAttackStrength() == 0) {
                aiMilitary.handleDiplomatUnit(unit, utype, owner);
                continue;
            }

            // Naval units get dedicated naval AI (patrol/attack enemy ships and coastal cities).
            // Mirrors the sea-unit branch in dai_manage_unit() in daiunit.c.
            if (utype.getDomain() == 1 && utype.getAttackStrength() > 0) {
                aiMilitary.handleNavalUnit(unit, utype, owner);
                continue;
            }

            if (utype.getAttackStrength() > 0) {
                aiMilitary.handleMilitaryUnit(unit, utype, owner);
                continue;
            }

            // Explorers and other non-combat units: move randomly
            int movesUsed = 0;
            while (unit.getMovesleft() > 0 && movesUsed < utype.getMoveRate()) {
                if (!aiMilitary.moveUnitRandomly(unit, utype)) break;
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
                case "Cathedral":      imprCathedral     = id; break;
                case "Factory":          imprFactory          = id; break;
                case "Research Lab":     imprResearchLab      = id; break;
                case "Stock Exchange":   imprStockExchange    = id; break;
                case "Apollo Program":   imprApolloProgram    = id; break;
                case "Space Structural": imprSpaceStructural  = id; break;
                case "Space Component":  imprSpaceComponent   = id; break;
                case "Space Module":     imprSpaceModule      = id; break;
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
                case "Gunpowder":         techGunpowder         = id; break;
                case "Chivalry":          techChivalry          = id; break;
                case "Conscription":      techConscription      = id; break;
                case "Tactics":           techTactics           = id; break;
                case "Mobile Warfare":    techMobileWarfare     = id; break;
                case "Map Making":        techMapMaking         = id; break;
                case "Navigation":        techNavigation        = id; break;
                case "Flight":            techFlight            = id; break;
                case "Rocketry":          techRocketry          = id; break;
                case "Plastics":          techPlastics          = id; break;
                case "Superconductors":   techSuperconductors   = id; break;
                case "Space Flight":      techSpaceFlight       = id; break;
                case "Monotheism":        techMonotheism        = id; break;
                default: break;
            }
        }
        // Resolve advanced unit type IDs — these vary between ruleset files
        // (Settlers=0, Workers=1, Engineers=2, Warriors=3, Phalanx=4, …).
        for (Map.Entry<Long, UnitType> e : game.unitTypes.entrySet()) {
            String n = e.getValue().getName();
            int id = e.getKey().intValue();
            switch (n) {
                case "Phalanx":     unitPhalanx    = id; break;
                case "Archers":     unitArchers    = id; break;
                case "Legion":      unitLegion     = id; break;
                case "Pikemen":     unitPikemen    = id; break;
                case "Horsemen":    unitHorsemen   = id; break;
                case "Knights":     unitKnights    = id; break;
                case "Musketeers":  unitMusketeers = id; break;
                case "Riflemen":    unitRiflemen   = id; break;
                case "Cavalry":     unitCavalry    = id; break;
                case "Armor":       unitArmor      = id; break;
                case "Trireme":   unitTrireme  = id; break;
                case "Caravel":   unitCaravel  = id; break;
                case "Fighter":   unitFighter  = id; break;
                case "Diplomat":  unitDiplomat = id; break;
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
            // Barbarians have no government, technology, or cities.
            if (player.getPlayerNo() == Barbarian.BARBARIAN_PLAYER_ID) continue;
            upgradeGovernmentIfPossible(player);
        }
    }

    /**
     * Checks whether the given AI player can adopt a superior government and
     * switches to it immediately.  The government names and tech requirements
     * mirror the classic Freeciv ruleset.  Uses the resolved tech IDs from
     * {@link #resolveGameIds()} so this works with both the loaded ruleset and
     * the hardcoded fallback.
     *
     * <p>The AI picks the <em>best</em> available government in one step,
     * mirroring {@code dai_manage_government()} in the C Freeciv server's
     * {@code ai/default/daicity.c}: it does not need to pass through every
     * intermediate tier.  For example, a player who has researched
     * {@code The Republic} directly (without first researching {@code Monarchy})
     * may jump straight from Despotism to Republic.
     *
     * <p>Upgrade priority (highest first):
     * <ol>
     *   <li>Democracy (id 5) – requires "Democracy" tech</li>
     *   <li>Republic  (id 4) – requires "The Republic" tech</li>
     *   <li>Monarchy  (id 2) – requires "Monarchy" tech</li>
     * </ol>
     *
     * @param player the AI player whose government may be upgraded
     */
    private void upgradeGovernmentIfPossible(Player player) {
        int currentGov = player.getGovernmentId();

        // Democracy is the best government – check first so we skip Republic if
        // both Democracy and Republic are available simultaneously.
        if (currentGov < GOV_DEMOCRACY && techDemocracy >= 0 && player.hasTech(techDemocracy)) {
            player.setGovernmentId(GOV_DEMOCRACY);
            log.info("Player {} switched government to Democracy", player.getUsername());
            game.getServer().sendPlayerInfoAll(player);
            return;
        }

        // Republic is better than Monarchy and Despotism.
        // Allow a direct jump from Despotism without passing through Monarchy,
        // which mirrors the C server where any known-tech government can be adopted
        // immediately regardless of the current government.
        if (currentGov < GOV_REPUBLIC && techTheRepublic >= 0 && player.hasTech(techTheRepublic)) {
            player.setGovernmentId(GOV_REPUBLIC);
            log.info("Player {} switched government to Republic", player.getUsername());
            game.getServer().sendPlayerInfoAll(player);
            return;
        }

        // Monarchy is better than Despotism/Anarchy.
        if (currentGov < GOV_MONARCHY && techMonarchy >= 0 && player.hasTech(techMonarchy)) {
            player.setGovernmentId(GOV_MONARCHY);
            log.info("Player {} switched government to Monarchy", player.getUsername());
            game.getServer().sendPlayerInfoAll(player);
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
            // Barbarians have no cities or economy – skip.
            if (player.getPlayerNo() == Barbarian.BARBARIAN_PLAYER_ID) continue;
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
        // Calculate the minimum luxury rate needed to keep all cities content,
        // then move the current rate towards that target one step (10 pp) per
        // turn.  This mirrors the city-mood scan in dai_manage_taxes() in
        // ai/default/aihand.c and prevents oscillation caused by removing all
        // luxury in a single turn.
        int requiredLuxRate = CityTurn.computeRequiredLuxuryRate(game, pid);
        requiredLuxRate = Math.min(requiredLuxRate, MAX_AI_LUXURY_RATE);

        if (luxRate < requiredLuxRate) {
            // Raise luxury by 10 pp per turn: take from science first, then tax.
            // Keep a minimum 10 pp floor in the donor rate so the AI always
            // retains a small science/tax allocation after the transfer.
            int increase = Math.min(10, requiredLuxRate - luxRate);
            if (sciRate >= increase + 10) {
                sciRate -= increase;
            } else if (taxRate >= increase + 10) {
                taxRate -= increase;
            } else {
                increase = 0; // cannot raise luxury without breaking other rates
            }
            luxRate += increase;
        } else if (luxRate > requiredLuxRate) {
            // Gradually return excess luxury to science (10 pp per turn)
            int decrease = Math.min(10, luxRate - requiredLuxRate);
            luxRate  -= decrease;
            sciRate  += decrease;
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
     *  The AI may raise luxury up to this cap to prevent cities from falling
     *  into revolt.  A higher cap allows the AI to satisfy larger cities that
     *  lack happiness buildings.  Mirrors the luxury-minimum calculation in
     *  dai_manage_taxes() in ai/default/aihand.c. */
    private static final int MAX_AI_LUXURY_RATE = 50;

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

    // Government IDs used in government-transition logic.
    // Values match governments.ruleset load order: Anarchy=0, Despotism=1,
    // Monarchy=2, Communism=3, Republic=4, Democracy=5.
    private static final int GOV_MONARCHY  = 2;
    private static final int GOV_REPUBLIC  = 4;
    private static final int GOV_DEMOCRACY = 5;

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
            // Barbarians have no technology tree – skip.
            if (player.getPlayerNo() == Barbarian.BARBARIAN_PLAYER_ID) continue;
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
     *   <li>Map Making → Trireme (earliest naval unit, coastal patrol)</li>
     *   <li>Mathematics → University tech prerequisite + Navigation prerequisite</li>
     *   <li>Navigation → Caravel (mid-game naval explorer)</li>
     *   <li>Trade → prerequisite for Banking</li>
     *   <li>The Republic → Republic government and Banking prerequisite</li>
     *   <li>Banking → Bank building (gold income ×1.5)</li>
     *   <li>University tech → University building (science ×2)</li>
     *   <li>Democracy → Democracy government (zero corruption)</li>
     *   <li>Industrialization → Factory (shields ×1.5)</li>
     *   <li>Economics → Stock Exchange (gold/luxury ×1.5)</li>
     *   <li>Flight → Fighter air unit (air supremacy)</li>
     * </ol>
     *
     * <p>A long-term strategic goal is maintained so that
     * {@link TechTools#pickNextResearchTowardGoal} can auto-advance research
     * after each technology completes, mirroring the {@code choose_tech_goal()}
     * / {@code tech_goal} mechanism in the C Freeciv server.
     *
     * @param player   the AI player
     * @param playerId the player's connection ID
     */
    private void pickResearchGoal(Player player, long playerId) {
        // Maintain a long-term strategic goal so that pickNextResearchTowardGoal
        // can advance research automatically after each tech completes.
        // Mirrors choose_tech_goal() / tech_goal in the C Freeciv server's aitech.c.
        if (player.getTechGoal() < 0 || player.hasTech(player.getTechGoal())) {
            player.setTechGoal(pickStrategicGoal(player));
        }

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
            techMonotheism,           // Cathedral (happiness +3, requires Temple)
            techMonarchy,             // Better government (less corruption)
            techFeudalism,            // Pikemen — 2× defence vs Horse units
            techHorsebackRiding,      // Horsemen (fast raider, 2 move)
            techIronWorking,          // Legion — 4 atk / 2 def, best early unit
            techMapMaking,            // Trireme naval unit — coastal expansion/patrol
            techMathematics,          // University tech prerequisite + Navigation prereq
            techNavigation,           // Caravel naval unit — mid-game naval exploration
            techTrade,                // Banking + Industrialization prerequisite
            techTheRepublic,          // Republic government
            techBanking,              // Bank — gold income ×1.5
            techUniversity,           // University building — science ×2
            techDemocracy,            // Democracy government (zero corruption)
            techIndustrialization,    // Factory — shields ×1.5
            techEconomics,            // Stock Exchange — gold/luxury ×1.5 additional
            techFlight,               // Fighter air unit — air supremacy
            techRocketry,             // Apollo Program wonder prerequisite
            techSpaceFlight,          // Space Structural + Apollo Program
            techPlastics,             // Space Component
            techSuperconductors,      // Space Module
        };

        for (long techId : priorityTechs) {
            if (TechTools.canPlayerResearch(game, playerId, techId)) {
                player.setResearchingTech(techId);
                return;
            }
        }

        // If the priority list yields nothing but a strategic goal path exists,
        // follow the BFS path toward the goal.
        long nextTech = TechTools.pickNextResearchTowardGoal(game, player);
        if (nextTech >= 0) {
            player.setResearchingTech(nextTech);
            return;
        }

        // Final fallback: research the first available technology
        for (long techId : game.techs.keySet()) {
            if (TechTools.canPlayerResearch(game, playerId, techId)) {
                player.setResearchingTech(techId);
                return;
            }
        }
    }

    /**
     * Selects a long-term strategic technology goal for the AI player.
     * The AI aims for the first not-yet-known entry in a list of powerful
     * late-game technologies; once a goal is achieved the next is adopted.
     * This guides {@link TechTools#pickNextResearchTowardGoal} in choosing
     * prerequisite steps after each technology is completed, mirroring
     * {@code choose_tech_goal()} in the C Freeciv server's aitech.c.
     *
     * @param player the AI player
     * @return the ID of the strategic goal technology, or -1 if all are known
     */
    private long pickStrategicGoal(Player player) {
        // Ordered by ascending strategic importance: the AI always aims for the
        // first goal it has not yet acquired.
        long[] goalTargets = {
            techUniversity,        // Science multiplier — accelerates all future research
            techDemocracy,         // Zero-corruption government
            techIndustrialization, // Factory — production boost
            techEconomics,         // Stock Exchange — trade/gold boost
            techFlight,            // Fighter unit — air superiority
            techRocketry,          // Apollo Program wonder prerequisite
            techSpaceFlight,       // Space Structural + Apollo Program
            techPlastics,          // Space Component
            techSuperconductors,   // Space Module
        };
        for (long goalId : goalTargets) {
            if (goalId >= 0 && !player.hasTech(goalId)) {
                return goalId;
            }
        }
        return -1L;
    }

    /**
     * Runs the auto-settler (worker/engineer) logic for a human-controlled unit
     * that has been set to {@link net.freecivx.server.Packets#SSA_AUTOSETTLER}.
     * Delegates to the settler AI's worker handler so that the same terrain-
     * improvement heuristics (road → railroad → irrigate → mine) apply to both
     * AI and human auto-worker units.
     *
     * @param unit  the worker/engineer unit
     * @param utype the unit type
     */
    public void runAutoSettler(Unit unit, net.freecivx.game.UnitType utype) {
        aiSettler.handleWorker(unit, utype);
    }

    /**
     * No-op shutdown method kept for API compatibility.
     */
    public void shutdown() {
    }
}
