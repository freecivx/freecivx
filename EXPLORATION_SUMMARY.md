# FREECIV CODEBASE EXPLORATION SUMMARY

## Overview

This document summarizes the exploration of the Freeciv C server codebase to identify key game mechanics and data structures that should be implemented in a Java server.

## Exploration Scope

**Key Source Locations Examined:**
- `/freeciv/data/classic/` - Ruleset definitions (units, techs, buildings)
- `/freeciv/common/` - Core game mechanics (unit.h, tech.h, combat.h, movement.h, city.h)
- `/freeciv/server/` - Server-side rule application

**Files Analyzed:**
1. `data/classic/units.ruleset` (lines 1-600) - All unit definitions, classes, flags
2. `data/classic/techs.ruleset` (lines 1-200) - Technology tree structure
3. `data/classic/buildings.ruleset` (lines 1-100) - Building definitions
4. `common/unit.h` (lines 1-250) - Unit instance and order structures
5. `common/unittype.h` (lines 1-150) - Unit type definition
6. `common/tech.h` (lines 1-250) - Technology/advance structures
7. `common/combat.h` - Combat calculation interface
8. `common/movement.h` (lines 1-80) - Movement mechanics
9. `common/city.h` (lines 1-150) - City structure

## Key Findings

### 1. UNIT SYSTEM - Complex & Central

**Unit Classes (Hierarchical):**
- Land, Sea, Trireme, Air, Helicopter, Missile
- Each with different movement costs, damage slows, ZOC behavior
- **CRITICAL:** Helicopters lose 10% HP per turn outside bases!

**Unit Type Attributes:**
- Combat: attack, defense, firepower, hitpoints
- Movement: move_rate (whole points, internally fractional)
- Economics: build_cost, pop_cost, upkeep[shield, food, gold]
- Special: 50+ flags affecting behavior (Marines, CityBuster, Settlers, etc.)

**Veteran System (4 Levels):**
- Green (100%) → Veteran (150%) → Hardened (175%) → Elite (200%)
- Affects combat power multiplicatively, potentially movement
- Promotion: 50%, 33%, 20%, 0% chances in combat by level

### 2. COMBAT SYSTEM - Probabilistic

**Calculation Method:**
- POWER_FACTOR = 10 (internal precision multiplier)
- Combat runs multiple rounds of probabilistic exchanges
- Veteran multipliers apply to both sides
- City walls provide 3× defense multiplier
- Combat ends when one side reaches 0 HP or 50% HP

**Critical Details:**
- Server calculates win_chance() probability
- Outcome is random but deterministic (seeded RNG for replays)
- Firepower determines HP removed per round (minimum 1)
- Multiple combat bonuses from ruleset (DefenseMultiplier, etc.)

### 3. MOVEMENT SYSTEM - Fractional Internally

**Fractional Movement Points:**
- SINGLE_MOVE = 3 fragments = 1 whole point
- Stored internally as fragments for precision
- Terrain costs vary: grassland=1frag, forest=2frag, mountain=3frag
- Roads override terrain cost to 1 fragment

**Key Rules:**
- Damage slows units (DamageSlows flag): ÷2 at 50% HP
- Zone of Control (ZOC) blocks enemy movement
- Air/missile units ignore ZOC
- Non-native terrain may be unreachable

### 4. TECHNOLOGY TREE - Prerequisite Structure

**Tech Structure:**
- Three requirement types: req1, req2, root_req
- req1 AND req2 must be known before researching
- root_req blocks entire subtree of dependent techs
- Cost: fixed (Classic+) or dynamic (Civ1Civ2)

**Research Progression:**
- Accumulate "bulbs" (science points) each turn
- When accumulated ≥ tech cost: tech complete, reset counter
- Each tech can have multiple prerequisites

### 5. CITY & PRODUCTION SYSTEM - Accumulation Model

**City Structure:**
- Size (population 1-255)
- Workable tiles: 1 center + 8 ring1 + 16 ring2 = 25 tiles (default)
- Citizens work tiles or become specialists
- Productions accumulate until reaching cost

**Production Model:**
- Each turn: production_value += city_shields_per_turn
- When production_value ≥ build_cost: complete unit/building
- Types: Unit, Improvement, Wonder, Gold

**Buildings:**
- Genus: GreatWonder (unique game-wide), SmallWonder (unique per player), Improvement
- Properties: build_cost, upkeep (gold/turn), tech_req, obsolete_by
- Effects: Barracks (+veteran), Airport (+air units), Wall (×3 defense), etc.

### 6. UNIT ACTIVITIES - Long-Term Tasks

**Activity Types:**
- MINE, IRRIGATE, PILLAGE, GEN_ROAD, TRANSFORM, CONVERT, BASE, etc.
- Progress tracked in activity_count
- Can pause and resume without loss
- Completion varies by unit (Engineers faster than Settlers)

### 7. UPKEEP SYSTEM - Three Independent Types

**Upkeep Components:**
- O_SHIELD: Production cost from city
- O_FOOD: Food cost from city production
- O_GOLD: Gold cost from treasury

**Mechanics:**
- Deducted before production completes
- Food upkeep: can't be skipped → unit dies if homecity can't provide
- Flag "Shield2Gold": can convert shield to gold upkeep

### 8. RULESET-DRIVEN DESIGN - NOT Hardcoded

**Critical Insight:** Freeciv is completely **ruleset-based**
- All units, techs, buildings defined in XML rulesets
- Game balance is configuration, not code
- Effects calculated from effects.ruleset
- Must support dynamic ruleset loading

**Rulesets:**
- data/classic/ - Default balanced ruleset
- Each element has "rule_name" (for savegames) and display name
- Format version tracked for compatibility

## Recommended Java Implementation Classes

```java
// Core Game Objects
class Unit {
  UnitType type; Tile tile; Player owner;
  int hp, veteran, fuel, movesLeft;
  Activity activity; int activityCount;
  Unit transporter; List<Unit> transporting;
  UnitOrder[] orders;
}

class UnitType {
  String name; UnitClass unitClass;
  int attack, defense, firepower, hitpoints;
  int moveRate, buildCost; int[] upkeep;
  int[] veteranPowerFact = {100, 150, 175, 200};
  Set<String> flags;
}

class City {
  int id; Tile tile; Player owner; int size;
  int foodStock, productionValue;
  Production currentProduction;
  Map<Building, Boolean> improvements;
}

class Advance {
  String name;
  Advance[] requires; // [req1, req2, rootReq]
  double cost;
  Set<String> flags;
}

// Engine Interfaces
interface CombatEngine {
  double winChance(Unit attacker, Unit defender);
  void resolveAttack(Unit attacker, Unit defender);
}

interface MovementEngine {
  int getMoveRate(Unit unit);
  int getTerrainCost(Unit unit, Tile tile);
  boolean canMoveTo(Unit unit, Tile destination);
}

interface ResearchEngine {
  void researchTech(Player player, Advance tech);
  double getTechCost(Advance tech, Player player);
}
```

## Critical Implementation Points

1. **Movement Tracking:** Store as fragments internally (3 = 1 point), send whole points to client
2. **Combat:** Server-side probabilistic calculation with seeded RNG for reproducibility
3. **Veteran System:** Multiplicative power factors (100%, 150%, 175%, 200%)
4. **Helicopter Special Case:** Loses 10% HP per turn outside bases
5. **Upkeep Priority:** Shield/food deducted before production completion
6. **ZOC Mechanics:** Land units block movement unless passing through
7. **Ruleset Loading:** Must parse XML and apply all bonuses/effects dynamically

## Generated Documentation

Two comprehensive guides have been created:

1. **FREECIV_MECHANICS_GUIDE.txt** (9.8 KB)
   - Detailed overview of all 10 game systems
   - Critical constants and values
   - Key implementation notes
   - Quick reference tables

2. **JAVA_IMPLEMENTATION_REFERENCE.md** (13 KB)
   - Code-level implementation guidance
   - Java class structure recommendations
   - Combat formula specifics
   - Activity system details
   - Common pitfalls and testing checklist
   - Source file quick reference

## Conclusion

The Freeciv codebase is well-architected around a **ruleset-driven design pattern** where game mechanics are defined declaratively in XML files rather than hardcoded. A Java implementation should:

1. **Parse rulesets** into type objects (Unit, Building, Advance)
2. **Implement core engines** for combat, movement, research, production
3. **Use fractional movement** internally while exposing whole points to clients
4. **Calculate all effects** from both rulesets and runtime conditions
5. **Ensure deterministic combat** for multiplayer synchronization
6. **Track unit activities** with resumable progress
7. **Enforce upkeep deductions** before production completion

The original Freeciv design demonstrates mature game mechanics including probabilistic combat, complex veterancy systems, prerequisite trees, and nuanced resource management—all excellent patterns to replicate in Java.

---

**Exploration Date:** March 14, 2024
**Source:** Freeciv Classic Ruleset v3.3-Devel-2023.Feb.24
**Files Analyzed:** 9 core files from common/ and data/classic/ directories

