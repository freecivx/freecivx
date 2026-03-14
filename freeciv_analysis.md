# Freeciv C Server Ruleset vs Freecivx-Server Comparison

## 1. RULESET FILES IN /home/runner/work/freecivworld/freecivworld/freeciv/freeciv/data/classic/

Both the C server and freecivx-server have identical ruleset file structures:

**C Server Location**: `/freeciv/freeciv/data/classic/`
**Freecivx-Server Location**: `/freecivx-server/src/main/resources/classic/`

### Files Present:
- `actions.ruleset` - Unit actions and diplomacy
- `buildings.ruleset` - City improvements and wonders
- `cities.ruleset` - City rules and happiness
- `effects.ruleset` - Building/government effects
- `game.ruleset` - Core game parameters
- `governments.ruleset` - Government types and rules
- `nations.ruleset` - Starting nations and colors
- `styles.ruleset` - City appearance styles
- `techs.ruleset` - Technology tree
- `terrain.ruleset` - Terrain types and properties
- `units.ruleset` - Unit definitions

---

## 2. TERRAIN TYPES (from terrain.ruleset)

### Base Terrain Classifications:

**Inaccessible (`[terrain_inaccesible]`)**
- Movement cost: 0 (impassable)
- Food: 0, Shield: 0, Trade: 0
- No units can enter; no cities can work these tiles
- Flags: NotGenerated, NoPollution, NoCities, UnsafeCoast, Frozen

**Lake (`[terrain_lake]`)**
- Movement cost: 1, Defense: 0
- Food: 1, Shield: 0, Trade: 2
- Resources: Fish
- Native to: Sea, Air, Missile, Helicopter, Trireme
- Flags: NoCities, NoBarbs, NoPollution, FreshWater, NoZoc, NoFortify
- Transforms to Swamp (36 turns)

**Ocean (`[terrain_ocean]`)**
- Movement cost: 1, Defense: 0
- Food: 1, Shield: 0, Trade: 2
- Resources: Fish, Whales
- Native to: Sea, Air, Missile, Helicopter, Trireme
- Flags: NoCities, NoPollution, UnsafeCoast, NoZoc, NoFortify

**Deep Ocean (`[terrain_deep_ocean]`)**
- Similar to Ocean; property_ocean_depth = 32

**Land Terrains**:
- Grassland, Plains, Hills, Forest, Jungle, Desert, Tundra, Glacier
- All have movement_cost = 1
- Varying food/shield/trade outputs
- Can support cities and improvements

### Movement Cost System:
- `move_fragments = 3` (base movement system)
- `igter_cost = 1` (ignored terrain movement cost)
- `pythagorean_diagonal = FALSE` (no diagonal movement penalty)

### Resource Transformations:
- Lake ↔ Swamp (warmer_drier_result)
- Ocean ↔ Glacier (cooler_wetter_result)
- Ocean ↔ Swamp (warmer_drier_result)
- Terrain elevation changes via warmer/cooler/wetter/drier results

---

## 3. BUILDINGS/IMPROVEMENTS (from buildings.ruleset)

### Key Building Categories:

**Production & Economic Buildings:**

1. **Granary** (build_cost=30, upkeep=2)
   - Increases food storage by 50%
   - Retains 50% of food when city grows
   - Essential for population growth

2. **Library** (build_cost=60, upkeep=1)
   - Req: Writing tech
   - Effect: +100% science output
   - Combined with University: +150% additional science (×3.5 total)

3. **Marketplace** (build_cost=60, upkeep=0)
   - Req: Currency tech
   - Effect: +50% luxury and tax output
   - With Bank: +100% luxury and tax

4. **Bank** (build_cost=80, upkeep=2)
   - Req: Banking tech + Marketplace
   - Effect: +100% tax/luxury WITH Marketplace

5. **Factory** (build_cost=210, upkeep=5)
   - Effect: +50% shield production
   - With Mfg. Plant: additional bonuses

6. **Windmill** (build_cost=15, upkeep=1)
   - Effect: +50% tax production
   - Halves food waste

**Defense & Military:**

7. **Barracks** (build_cost=30, upkeep=1)
   - New land units gain Veteran status (+50% attack/defense)
   - Damaged units heal fully in one turn
   - Flag: "Barracks"
   - Obsoletes to: Barracks II (at Gunpowder), then Barracks III (at Mobile Warfare)

8. **Barracks II** (build_cost=30, upkeep=1)
   - Same as Barracks
   - Req: Gunpowder tech

9. **Barracks III** (build_cost=30, upkeep=1)
   - Same veteran/healing effects
   - Req: Mobile Warfare tech

10. **City Walls** (build_cost=60, upkeep=2)
    - Passive defense boost
    - Protects from land attacks

**Government & Administration:**

11. **Palace** (genus=SmallWonder, build_cost=70, upkeep=0)
    - Makes city a capital
    - Corruption in other cities based on distance from capital
    - Capital has half the corruption of other cities (like a Courthouse)
    - Flag: SaveSmallWonder

12. **Courthouse** (build_cost=120, upkeep=1)
    - Halves corruption AND production waste
    - Critical for large empires

**Growth & Health:**

13. **Aqueduct** (build_cost=60, upkeep=2)
    - Allows city to grow beyond size 8
    - With Sewer System: allows growth to size 12+

14. **Temple** (build_cost=40, upkeep=1)
    - Effect: +1 content citizen
    - Makes one unhappy citizen content

15. **Colosseum** (build_cost=100, upkeep=4)
    - Effect: +3 content citizens
    - Makes three unhappy citizens content

16. **Cathedral** (build_cost=80, upkeep=3)
    - Effect: +3 content citizens
    - Religious happiness improvement

**Utilities:**

17. **Airport** (build_cost=120, upkeep=3)
    - Req: Radio tech
    - Allows veteran air unit production
    - Heals air units (including helicopters)
    - Two cities with Airports can airlift units

18. **Mass Transit** (build_cost=120, upkeep=4)
    - Neutralizes pollution from population

19. **Offshore Platform** (build_cost=120, upkeep=3)
    - Req: Miniaturization + Adjacent Oceanic terrain
    - +1 shield per oceanic tile worked

20. **Nuclear Plant**, **Hydro Plant**, **Solar Plant**, **Power Plant**
    - Production and pollution modifiers
    - Complex stacking rules (only one primary plant per city)

---

## 4. FREECIVX-SERVER AIPLAYER.JAVA (834 lines)

### File: `/freecivx-server/src/main/java/net/freecivx/ai/AiPlayer.java`

**Key Features:**

#### Initialization:
- Singleton ThreadPool executor (`Executors.newSingleThreadExecutor()`)
- Persistent unit target tracking across turns (HashMap<Long, Long>)
- AI-suitable terrain constants (Grassland, Forest, Plains, Hills, Jungle, Desert, Tundra)

#### Terrain Mapping:
```
TERRAIN_GRASSLAND = 7
TERRAIN_PLAINS    = 11
TERRAIN_HILLS     = 8
TERRAIN_FOREST    = 6
TERRAIN_JUNGLE    = 9
TERRAIN_DESERT    = 5
TERRAIN_TUNDRA    = 13
TERRAIN_OCEAN     = 2
TERRAIN_DEEP_OCEAN = 3
```

#### Improvement Priorities:
```
IMPR_GRANARY      = 2
IMPR_LIBRARY      = 3
IMPR_MARKETPLACE  = 4
IMPR_CITY_WALLS   = 7
```

#### Unit Types:
```
UNIT_SETTLERS = 0
UNIT_WARRIORS = 3
```

#### Key Technologies:
- POTTERY (10), BRONZE_WORKING (4), WARRIOR_CODE (11)
- MASONRY (3), ALPHABET (0), WRITING (7), CODE_OF_LAWS (8)
- HORSEBACK_RIDING (9), MATHEMATICS (1), IRON_WORKING (5)
- THE_REPUBLIC (2)

### AI Decision-Making Pipeline:

**Phase 1: Government Management (`manageAiGovernments`)**
- Despotism → Monarchy (when Monarchy tech available)
- Monarchy → Republic (when The Republic tech available)
- Mirrors `dai_manage_government()` from C server's `ai/default/daicity.c`

**Phase 2: Research Planning (`pickResearchGoals`)**
- Priority tech research order (Pottery → Bronze Working → Warrior Code → Masonry → Alphabet...)
- Each AI player chooses one tech to research per turn
- Mirrors `dai_select_tech()` from `ai/default/aitech.c`

**Phase 3: City Production Management (`manageAiCities`)**
- **Priority 1**: Granary (if city size < 2) 
- **Priority 2**: Barracks (if threatened or small military)
- **Priority 3**: Library (if city size ≥ 2)
- **Priority 4**: Marketplace (if city size ≥ 3)
- **Priority 5**: City Walls
- **Default**: Warriors (military expansion)
- Mirrors `daicity.c` building logic

**Phase 4: Unit Actions**

*Settlers (type 0):*
- Search radius: 12 tiles (covers ~25×25 area)
- Scoring system: evaluates tiles for city founding
- Minimum city separation: 3 tiles (Manhattan distance)
- Founding threshold: score ≥ 2
- Persistent target tracking prevents goal-jitter

*Military units:*
- Opportunistic adjacent enemy attacks
- Defense assignment: protect ungarrisoned cities
- If city has ≥2 defenders, unit roams
- Otherwise: garrison the city
- Fallback: advance toward nearest enemy

*Other units:* Random movement

### Settler Scoring System (`tileSettlerScore`):
Evaluates tile fitness for city founding based on:
- Terrain type bonuses
- Proximity to resources
- Defensive position
- Water access
- Existing city overlap avoidance

### Unit Target Persistence:
- Stores unit → target tile mappings across turns
- Prevents continuous goal recalculation
- Mirrors C server's persistent unit-task system (`daiunit.c`)

---

## 5. FREECIVX-SERVER AUTOGAME.JAVA (315 lines)

### File: `/freecivx-server/src/main/java/net/freecivx/main/AutoGame.java`

**Purpose**: Simulate complete Freecivx game with AI-controlled civilisations without WebSocket clients. All network broadcasts suppressed.

**Constants:**
```java
DEFAULT_AI_PLAYERS = 5
DEFAULT_TURNS = 100
```

**Constructor Parameters:**
```java
AutoGame(int numAiPlayers, int numTurns, int seed)
- numAiPlayers: number of AI civilisations (≥ 1)
- numTurns: number of turns to simulate (≥ 1)
- seed: map/game seed; -1 for random (mirrors mapseed/gameseed in C Freeciv test script)
```

**Headless Server Implementation:**
- Creates `CivServer` subclass with all `send*()` methods as no-ops
- Port 0 (OS assigns ephemeral port; no real socket opened)
- Allows pure game logic exercise without network layer

**Main Simulation Loop (`run` method):**

```java
1. Game initialization
   - AI players created with standard names (Caesar, Alexander, Napoleon, etc.)
   - Starting units spawned
   
2. Turn loop (t = 1 to numTurns)
   - Call game.turnDone()
   - Print progress every 10 turns
   - Early termination if only ≤1 player alive
   
3. Progress logging
   - Turn number, historical year (calculated from turn)
   - Number of alive players, total units, cities
   - Classic Freeciv year calculation: 4000 BCE + (turn - 1) × 20 years
   
4. Final summary
   - Per-civilisation report sorted by city count
   - Displays: cities, units, techs, gold, government, status
```

**Command-line Arguments:**
```bash
-players N    # AI player count (default: 5)
-turns N      # Turn count (default: 100)
-seed N       # Reproducibility seed (default: random)
```

**Entry Point:**
```bash
java net.freecivx.main.AutoGame -players 6 -turns 200 -seed 12345
```

---

## 6. FREECIVX-SERVER CITYTURN.JAVA (888 lines)

### File: `/freecivx-server/src/main/java/net/freecivx/server/CityTurn.java`

**Purpose**: Turn-based city processing mirror of C Freeciv `cityturn.c`

**Key Constants:**
```java
MIN_UNIT_COST = 10
IMPR_BARRACKS = 1      // Units restore to full HP
IMPR_COURTHOUSE = 9    // Halves corruption & waste
IMPR_TEMPLE = 6        // +1 content citizen
IMPR_COLOSSEUM = 11    // +3 content citizens
IMPR_CATHEDRAL = 12    // +3 content citizens
HP_RESTORE_DIVISOR = 5 // Non-Barracks HP restore: 1/5 per turn
HAPPY_COST = 2         // Luxury cost per content→happy upgrade
```

### Core Processing Methods:

**1. `cityGranarySize(int citySize)` - Granary Capacity**
```
size ≤ 0: 0
size = 1: 20 (base)
size > 1: 10*size + 10
Example: size 5 → 60 food required to grow

Formula matches C server: RS_DEFAULT_GRANARY_FOOD_INI=20, FOOD_INC=10
```

**2. `cityProduction(Game game, long cityId)` - Production Queue**

*Shield Accumulation:*
- Base shields: max(1, city size) per turn
- Simplified to 1 shield per population

*Production Waste Calculation:*
- Government waste: `gov.corruptionPct() / 2`
- Courthouse halves waste further
- Wasted shields: `shieldOutput * wastePct / 100`
- Minimum output: 1

*Unit Production (productionKind = 0):*
- Tech prerequisite checked before completion
- Population cost deducted (e.g., Settlers cost 1 population)
- City size minimum enforced: `city.size > popCost`
- On completion: new unit created, production reset

*Building Production (productionKind = 1):*
- Tech prerequisite checked before completion
- Cost deducted from shield stock
- Building added to city improvements
- Shields queued indefinitely if tech not yet researched

**3. `cityGrowth(Game game, long cityId)` - Population Growth**

*Food Surplus System:*
- Base: 2 food/turn (grassland city center)
- +1 if Granary present
- Simplified food generation

*Growth Calculation:*
- Accumulate food each turn: `foodStock += foodSurplus`
- When `foodStock ≥ granarySize`: city grows
- Aqueduct required for size > 8; Sewer System for size > 12
- Without Aqueduct: food capped at granary size (blocked from growing)

*Granary Retention:*
- With Granary: 50% of new granary capacity retained
- Without Granary: food reset to 0

*Starvation:*
- If `foodStock < 0` and city size > 1: shrink by 1
- Reset food stock to 0

**4. `cityTaxContribution(Game game, long cityId)` - Gold Income**

*Base Tax:*
- 1 gold per population point (simplified)

*Corruption Calculation:*
- Government corruption: `gov.corruptionPct()`
- Courthouse halves corruption
- Final tax: `taxBase * (100 - corruption%) / 100`

**5. `cityScienceContribution(Game game, long cityId)` - Science Output**

*Base Science:*
- 1 bulb per population point

*Science Bonuses:*
- Library: +100% science (×2 multiplier)
- Library + University: +150% additional (×3.5 total)
- Applied additively: `(100 + 100 + 150) / 100 = 3.5`

*Corruption Applied:*
- Same government corruption as gold
- Courthouse halves the penalty

**6. `updateCityHappiness(Game game, long cityId)` - Happiness System**

*Base Content Citizens:*
- `size / 2` citizens naturally content (rounded down)
- Remainder unhappy

*Happiness Buildings:*
- Temple: +1 content
- Colosseum: +3 content
- Cathedral: +3 content

*Luxury Mechanics:*
- HAPPY_COST = 2 luxury per citizen upgrade
- 2 units of luxury can convert 1 unhappy → happy directly

**7. `updateAllCities(Game game)` - Main Orchestrator**

*Execution Order (per turn):*
1. Restore unit HP in friendly cities
   - Barracks: full HP restoration
   - Otherwise: `max_hp / HP_RESTORE_DIVISOR` (20%)
   
2. Process worker activities (roads, mines, irrigation)

3. For each city:
   - Update population growth
   - Process production queue
   - Update happiness

4. Aggregate per-player gold income from all cities

5. Per-player update:
   - Deduct building upkeep (each improvement's upkeep value)
   - Deduct unit upkeep (1 gold per military unit)
   - Auto-disband military if gold < 0
   - Trigger research progress

---

## 7. FREECIVX-SERVER GAME.JAVA - startAutoGame Method (260-280)

### File: `/freecivx-server/src/main/java/net/freecivx/game/Game.java`

**Method Signature:**
```java
public void startAutoGame(int numAiPlayers) {
    if (gameStarted) return;
    gameStarted = true;
    
    // Create AI players with standard names
    String[] aiNames = {
        "Caesar", "Alexander", "Napoleon", "Genghis", "Cleopatra",
        "Augustus", "Cyrus", "Ramesses", "Pericles", "Montezuma"
    };
    
    for (int i = 0; i < numAiPlayers; i++) {
        long aiId = 1000L + i;
        Player aiPlayer = new Player(aiId, 
            aiNames[i % aiNames.length], 
            "ai", 
            i % nations.size());
        aiPlayer.setAi(true);
        players.put(aiId, aiPlayer);
    }
    
    // Spawn starting units for each player
    for (Player player : players.values()) {
        long startPos = findStartPosition();
        spawnStartingUnits(player, startPos);
    }
}
```

**Related Initialization:**
- AI player IDs start at 1000L
- AI names cycle through predefined list if more players than names
- Each player assigned a different nation (cycles through available nations)
- Starting positions calculated via `findStartPosition()`
- Initial units spawned via `spawnStartingUnits(player, startPos)`

**Autogame Flow in AutoGame.run():**
1. Call `game.startAutoGame(numAiPlayers)`
2. Print game initialization status
3. Main turn loop: `for (t = 1; t <= numTurns; t++) game.turnDone()`
4. Early exit if only ≤1 player alive
5. Print final per-player statistics

---

## 8. KEY IMPROVEMENTS NEEDED IN AUTOGAME & AI SYSTEM

### Current Implementation Status ✓
- ✓ Basic AI government evolution (Despotism → Monarchy → Republic)
- ✓ Research goal selection with priority chain
- ✓ City production building selection (Granary, Barracks, Library, etc.)
- ✓ Settler site evaluation and city founding
- ✓ Military unit defence and offense coordination
- ✓ Unit HP restoration in cities
- ✓ Population growth with granary system
- ✓ Shield/production accumulation
- ✓ Food surplus and city growth
- ✓ Tax and science contributions
- ✓ Happiness system with happiness buildings
- ✓ Corruption and waste penalties
- ✓ Tech research progress and completion
- ✓ Auto-disband bankrupt units

### Recommended Enhancements:

**1. Advanced Settler Evaluation**
   - Current: Basic terrain score heuristics
   - Improve: Distance to fresh water, mineral resources, river access
   - Integrate: Resource-aware scoring from `terrain.ruleset`

**2. Diplomatic Relations**
   - Missing: Peace treaties, alliances, tribute
   - Add: Diplomacy action framework from `actions.ruleset`
   - Integrate: Basic alliance formation for mutual defense

**3. Advanced Military Strategy**
   - Current: Basic garrison + pursuit
   - Improve: Coordinated multi-unit attacks, retreat logic
   - Add: Naval unit support; transport logic

**4. Wonder Building**
   - Current: No wonder construction
   - Add: Great Wonders, Small Wonders (Palace, Great Library, etc.)
   - Mirrors: `effects.ruleset` wonder effects

**5. Trade and Commerce**
   - Missing: Trade route system
   - Add: Gold bonus from trade routes
   - Implement: Caravan/trade-ship logic

**6. Corruption Distance Calculation**
   - Current: Basic government corruption
   - Improve: Distance-from-capital corruption scaling
   - Integrate: Palace and Courthouse distance effects

**7. Advanced Terrain Improvements**
   - Missing: Road/irrigation worker automation
   - Add: Worker unit AI for terrain improvement (`daiworker.c`)
   - Integrate: `terrain.ruleset` transformation times

**8. Late-Game Transitions**
   - Missing: Wonder race endgame
   - Add: Space race and science victory conditions
   - Implement: Cultural/diplomatic victory paths

**9. Disaster and Climate**
   - Missing: Climate change tile transformations
   - Add: Disaster events (earthquakes, floods, volcanic eruptions)
   - Integrate: `game.ruleset` climate parameters

**10. Unit Upgrade Chains**
   - Current: Basic obsolete_by handling
   - Improve: Automatic unit upgrades when better units available
   - Add: Unit experience and promotions system

---

## SUMMARY: Architecture Alignment

**C Server** → **Freecivx-Server Mapping:**

| Component | C Server | Freecivx-Server |
|-----------|----------|-----------------|
| Terrain Rules | `terrain.ruleset` | `/classic/terrain.ruleset` |
| Buildings | `buildings.ruleset` | `/classic/buildings.ruleset` |
| Effects System | `effects.ruleset` | Applied in CityTurn.java |
| Tech Tree | `techs.ruleset` | Game.techs map + TechTools.java |
| Government | `governments.ruleset` | Game.governments map + AiPlayer |
| City Turn Logic | `cityturn.c` | CityTurn.java |
| Default AI | `ai/default/` | AiPlayer.java |
|   - Tech Selection | `aitech.c` | `pickResearchGoals()` |
|   - City Production | `daicity.c` | `manageAiCities()` |
|   - Settler Logic | `daisettler.c` | `handleSettler()` |
|   - Military | `daimilitary.c` | `handleMilitaryUnit()` |
| Headless Simulation | Server scripts | AutoGame.java |

**Key Differences:**
- Freecivx uses simplified mechanics (1 shield = 1 population, flat food generation)
- C server has more complex terrain transformation and climate systems
- Freecivx has fewer government types and wonder system not fully implemented
- Freecivx missing: full diplomat system, trade routes, climate events

