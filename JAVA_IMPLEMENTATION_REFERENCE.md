# FREECIV JAVA SERVER IMPLEMENTATION REFERENCE

## Quick Reference: What Every Component Needs

### 1. UNIT MECHANICS (Most Complex)

**Key Files:**
- `data/classic/units.ruleset` - All unit definitions
- `common/unit.h` - Instance structure
- `common/unittype.h` - Type definitions
- `common/combat.h` - Combat functions

**Must Implement:**
```java
class Unit {
    // Identity
    int id;
    UnitType type;
    Player owner;
    int homecity;  // City supporting this unit
    
    // State
    int hp;  // Current health
    int veteran;  // 0-3 (Green, Veteran, Hardened, Elite)
    int fuel;  // For helicopters/aircraft
    int movesLeft;  // Whole movement points remaining
    
    // Location & Transport
    Tile tile;
    Unit transporter;  // If transported by another unit
    List<Unit> transporting;  // What this unit is carrying
    
    // Activity
    Activity activity;  // MINE, IRRIGATE, BUILD_ROAD, etc.
    int activityCount;  // Progress on current activity
    Extra activityTarget;  // What extra (road, mine, etc.)
    
    // Movement Orders
    boolean hasOrders;
    UnitOrder[] orders;
    int orderIndex;
    boolean repeatOrders;
}

interface CombatEngine {
    // Returns probability 0.0-1.0
    double winChance(Unit attacker, Unit defender);
    
    // Returns power multiplier based on veteran level
    double getVeteranPowerFactor(Unit unit);
    
    // Complete attack resolution
    void resolveAttack(Unit attacker, Unit defender);
}

interface MovementEngine {
    // Gets whole movement points for this turn
    int getMoveRate(Unit unit);
    
    // Gets terrain cost in fragments (not whole points!)
    int getTerrainCost(Unit unit, Tile tile);
    
    // Check if move is valid
    boolean canMoveTo(Unit unit, Tile destination);
}
```

**Critical Values:**
- `move_rate` = whole movement points per turn
- Internally store as: `movesLeft = move_rate × 3` (fragments)
- Terrain costs are in fragments (1=1/3 point, 3=1 full point)
- Veteran power factors: 100, 150, 175, 200

### 2. COMBAT MECHANICS

**Formula (Simplified):**
```
attack_power = base_attack × veteran_factor
defense_power = base_defense × terrain_bonus × city_walls(3x) × veteran_factor

Each round:
  attacker loses: firepower × random(0.5-1.5) damage
  defender loses: firepower × random(0.5-1.5) damage
  
Continue until one side reaches 0 HP or 50% HP
```

**Must Calculate Server-Side:**
- win_chance() probability
- Random combat outcome
- Damage applied to loser
- Veteran promotion (50%, 33%, 20%, 0% chances)

**Example Combat:**
```
Attacker: Swordsman (attack=3, hp=15, firepower=1, veteran)
Defender: Spearman in city with walls (defense=2, hp=15, firepower=1)

Effective defense = 2 × 3(walls) × 1.5(veteran) = 9
Attacker wins with ~65% probability
Combat lasts ~3 rounds
Swordsman: 15 - (1 × 1) × 3 = 12 HP
Spearman: 15 - (1 × 1) × 3 = 12 HP (then city protects)
```

### 3. TECHNOLOGY TREE

**Structure:**
```java
class Advance {
    String name;
    double cost;  // In "bulbs" (research points)
    Advance[] requires;  // [req1, req2, rootReq]
    Set<String> flags;  // Bonus_Tech, Bridge, etc.
}

// Special IDs:
A_NONE      = 0      (always known)
A_FUTURE            (infinite future techs)
A_UNSET             (no tech selected)
```

**Research Progress:**
```
Each turn:
  city_science = calculate_science_output(city)
  player_bulbs += city_science
  
  if player_bulbs >= current_tech_cost:
    complete_tech()
    player_bulbs = 0
```

**Tech Cost (Classic+ style):**
```
cost = tech.cost (from ruleset)
```

**Tech Cost (Civ1Civ2 style):**
```
cost = base_cost × sqrt(cost_multiplier) × num_reqs
// Increases as player researches more
```

### 4. CITY PRODUCTION

**Accumulation Model:**
```
Each turn:
  city_shields = calculate_production(city)
  production_value += city_shields
  
  if production_value >= item_cost:
    complete_production(city)
    production_value = 0  // Reset
```

**Production Types:**
- Unit (military/worker)
- Improvement (building)
- Wonder (great/small wonder)
- Gold (conversion, not actual production)

**Key:** Production accumulates year-over-year until complete

### 5. VETERAN SYSTEM (Critical Detail)

**4 Levels with Multiplicative Combat Power:**
```
Green       (level 0): 100% = ×1.00
Veteran     (level 1): 150% = ×1.50
Hardened    (level 2): 175% = ×1.75
Elite       (level 3): 200% = ×2.00
```

**Promotion Chances (In Combat):**
```
Level 0 → 1: 50% chance
Level 1 → 2: 33% chance
Level 2 → 3: 20% chance
Level 3: Cannot promote further (0%)
```

**Other Promotion Methods:**
- Barracks building: +1 veteran level when built
- Wonder effects: Can grant veteran
- Scripting: Can set level directly

**Movement Bonus (Optional):**
```
// Can be customized, typically 0 for classic ruleset
veteran_move_bonus = [0, 0, 0, 0]  // No bonus per level
```

### 6. UPKEEP SYSTEM (3 Independent Types)

**Structure:**
```java
class Unit {
    int[] upkeep = new int[3];  // [shield, food, gold]
}

// Constants
O_SHIELD = 0
O_FOOD   = 1
O_GOLD   = 2
```

**Shield Upkeep:**
- Deducted from city production shield accumulation
- If city produces 10 shields, unit takes 1 shield → 9 left for production

**Food Upkeep:**
- Deducted from city food storage
- If city can't provide: population starves, unit dies or city shrinks

**Gold Upkeep:**
- Deducted from player treasury
- Can't be provided by city (global resource)

**Example:**
```
Unit: Warriors
upkeep[O_SHIELD] = 1
upkeep[O_FOOD]   = 0
upkeep[O_GOLD]   = 0

City produces:
  20 shields/turn
  15 food/turn
  
Upkeep cost:
  20 - 1 = 19 shields available for production
  15 - 0 = 15 food for growth
  Treasury unaffected
```

### 7. TURN PROCESSING ORDER

**Each turn, server executes in this order:**

1. **Movement Phase**
   - Execute unit orders (movement, activities)
   - Process goto movement
   
2. **Combat Phase**
   - Resolve all battles
   - Award veterancy
   - Handle units destroyed
   
3. **Activity Phase**
   - Progress road building, mining, etc.
   - Complete activities
   
4. **City Growth Phase**
   - Accumulate food → growth
   - Citizens become specialists
   
5. **Production Phase**
   - Accumulate shields → progress toward production goal
   - Complete units/buildings
   - Apply building effects
   
6. **Upkeep Phase**
   - Deduct unit upkeep from city
   - Deduct building upkeep from treasury
   - Handle starvation/bankruptcy
   
7. **Research Phase**
   - Accumulate science → research progress
   - Complete technologies
   
8. **Diplomacy Phase**
   - Process treaties
   - Espionage actions
   - Barbarian spawning

### 8. UNIT CLASSES & FLAGS

**Land Class:**
```
Flags: TerrainSpeed, TerrainDefense, DamageSlows, CanOccupyCity,
       BuildAnywhere, CollectRansom, ZOC, CanPillage, KillCitizen
min_speed: 1
hp_loss_pct: 0
```

**Sea Class:**
```
Flags: DamageSlows, AttackNonNative, AttFromNonNative
min_speed: 2
hp_loss_pct: 0
```

**Air Class:**
```
Flags: Unreachable, DoesntOccupyTile
min_speed: 1
hp_loss_pct: 0
```

**Helicopter Class (Special!):**
```
Flags: CanOccupyCity, CollectRansom
min_speed: 1
hp_loss_pct: 10  ← LOSES 10% HP EVERY TURN OUTSIDE BASE!
```

**Critical Flags:**
- `Settlers`: Can build roads, irrigation
- `Marines`: Attack from non-native tiles
- `Unique`: Only one per player
- `Diplomat`/`Spy`: Diplomatic/espionage
- `CityBuster`: Double firepower vs cities
- `OneAttack`: One attack per turn only

### 9. TERRAIN & MOVEMENT COSTS

**Native Tiles:**
- Land units: grassland, plains, forests, hills, mountains
- Sea units: ocean, coast
- Air units: anywhere (don't land on terrain)

**Movement Costs (in fragments, 3 = 1 whole point):**
```
Grassland/Plains: 1 fragment
Forest/Hills: 2 fragments
Mountain: 3 fragments
Ocean: 1 fragment (for sea)
Roads: 1 fragment (override terrain)
```

**Example Movement:**
```
Unit: Settler (move_rate = 1 whole point = 3 fragments)

Path: Grassland → Forest → Mountain
Costs: 1 + 2 + 3 = 6 fragments
Total needed: 6 fragments = 2 whole points
Settler has: 1 whole point = 3 fragments
Result: Can only move 3 tiles (1 grassland)
```

### 10. BUILDING SYSTEM

**Genus Types:**
- `GreatWonder`: Unique per game (only one in world)
- `SmallWonder`: Unique per player (each player can have one)
- `Improvement`: Normal city improvement
- `Special`: Special buildings
- `Convert`: Gold conversion (capitalization)

**Building Properties:**
```java
class Building {
    String name;
    BuildingGenus genus;
    int buildCost;      // shields required
    int upkeep;         // gold per turn
    Advance[] requirements;  // tech needed
    Advance obsoleteBy;      // tech making obsolete
    int sabotageChance; // % diplomat sabotage success
    Set<String> flags;
}
```

**Key Buildings & Effects:**
- **Barracks**: Units build at +1 veteran level
- **Harbor**: Increases sea trade routes
- **University**: +science per specialist
- **Market**: Reduces corruption, increases trade
- **Wall**: 3× defense multiplier (vs non-city-busters)
- **Airport**: Air unit production, heals air units
- **Palace**: Government headquarters, production bonus

### 11. ZONE OF CONTROL (ZOC)

**Rules:**
1. Land units with ZOC flag block movement through their tile
2. Enemy unit cannot pass through ZOC without spending all moves
3. Air/missile units ignore ZOC
4. Unit flag `IgZOC` ignores ZOC
5. Unit flag `HasNoZOC` creates no ZOC

**Example:**
```
Your Warrior at position (5, 5)
Enemy trying to move: (4, 5) → (5, 5)

Warrior creates ZOC around (5, 5)
Enemy cannot move into (5, 5) if has moves left
Must use ALL moves just to stop at ZOC edge
```

### 12. UNIT ACTIVITIES (Long-Term Tasks)

**Activities:**
```
IDLE, MINE, IRRIGATE, PILLAGE, POLLAGE, TRANSFORM,
BASE, GEN_ROAD, CONVERT, CULTIVATE, PLANT, CLEAN
```

**Activity Progress:**
```java
class Unit {
    Activity activity;      // What unit is doing
    int activityCount;      // Progress (in ACTIVITY_FACTOR units)
    Extra activityTarget;   // Road/mine/etc being built
    
    Activity changedFrom;   // Previous activity for resume
    int changedFromCount;
    Extra changedFromTarget;
}
```

**Example: Building a Road**
```
Unit: Settler
activity = ACTIVITY_GEN_ROAD
activityTarget = Road extra

Each turn:
  activityCount += work_amount  // Typically 1-3 per turn
  
When activityCount >= 10:
  Complete activity
  Place road on tile
  Reset activity to IDLE
```

---

## Common Pitfalls & Notes

**1. Movement Fragments Are Hidden**
- Client sees whole movement points (1, 2, 3)
- Server internally tracks fragments (3, 6, 9)
- When moving: deduct actual fragment costs

**2. Veteran Power is Multiplicative**
- Not additive! It's a multiplier
- 150% means ×1.5, not +1.5
- Applied to both attack AND defense equally

**3. Combat is Probabilistic**
- Same units in same situation can have different outcomes
- Must use seeded RNG for replays
- Server calculates probability, executes randomly

**4. Helicopter HP Loss is Brutal**
- 10% hp_loss_pct means 10% of max HP lost per turn
- A helicopter with 20 HP loses 2 HP per turn outside base
- Dies in 10 turns if not in city/base!

**5. Upkeep is Checked First**
- City production: produce shields → pay upkeep → rest is saved
- Food: city food → pay upkeep → rest for growth
- Can't skip upkeep even if it stops all production

**6. Techs are Prerequisite Trees**
- Multiple independent trees possible
- req1 AND req2 both needed (not OR)
- root_req blocks entire subtree

**7. City Radius is dx²+dy² Not Manhattan**
- Distance formula: dx² + dy² ≤ radius²
- With radius 2: covers tiles up to ~1.4 tiles away
- Results in "square with rounded corners" shape

**8. Production Doesn't Reset On Change**
- If building shield and switch to gold production
- Shields already accumulated are "lost" (implementation choice)
- Freeciv typically allows partial progress recovery

---

## Testing Checklist

- [ ] Unit moves correct distances on different terrains
- [ ] Veteran combat multipliers apply correctly (50%, 150%, 175%, 200%)
- [ ] Helicopter loses 10% HP per turn outside base
- [ ] ZOC blocks movement correctly
- [ ] Combat outcomes are probabilistic but reproducible
- [ ] City accumulates production correctly
- [ ] Tech prerequisites block research properly
- [ ] Upkeep is deducted before production completion
- [ ] Unit activities progress and complete
- [ ] Order queue executes in sequence

---

## Source File Quick Reference

| Component | Header File | Implementation |
|-----------|------------|-----------------|
| Unit | common/unit.h | common/unit.c |
| Unit Type | common/unittype.h | common/unittype.c |
| Combat | common/combat.h | common/combat.c |
| Movement | common/movement.h | common/movement.c |
| Technology | common/tech.h | common/tech.c |
| City | common/city.h | common/city.c |
| Building | common/improvement.h | common/improvement.c |
| Activities | common/unit.h | server/unittools.c |
| Combat Rules | server/unittools.h | server/unittools.c |
| Production | common/city.h | server/cityturn.c |
| Research | common/research.h | server/techtools.c |

