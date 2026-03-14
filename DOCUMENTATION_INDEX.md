# FREECIV JAVA SERVER - DOCUMENTATION INDEX

## Quick Start

Start with **EXPLORATION_SUMMARY.md** for a high-level overview of what's been discovered.

## Documentation Files

### 1. EXPLORATION_SUMMARY.md ⭐ START HERE
**Purpose:** Executive summary of the entire exploration  
**Length:** ~240 lines  
**Content:**
- Overview of what was analyzed
- Key findings across 8 game systems
- Recommended Java class structure
- Critical implementation points
- Links to detailed guides

**Best for:** Understanding the big picture before diving into details

---

### 2. FREECIV_MECHANICS_GUIDE.txt
**Purpose:** Detailed reference of all game mechanics  
**Length:** ~320 lines  
**Content:**
- Section 1: Unit System (classes, types, veteran system)
- Section 2: Combat System (calculation, bonuses, flags)
- Section 3: Movement System (fractional points, ZOC, costs)
- Section 4: Technology Tree (structure, requirements, costs)
- Section 5: City & Building System (production, types, effects)
- Section 6: Unit Activities (long-term tasks)
- Section 7: Upkeep & Maintenance (three types)
- Section 8: Recommended Java classes
- Section 9: Critical constants
- Section 10: Key implementation points

**Best for:** Understanding mechanics in depth + quick lookup by section

**Example to Find:** 
- Combat formula → Section 2
- Veteran bonuses → Section 1
- Tech prerequisites → Section 4
- Unit upkeep types → Section 7

---

### 3. JAVA_IMPLEMENTATION_REFERENCE.md
**Purpose:** Code-level implementation guidance  
**Length:** ~500 lines  
**Content:**
- Section 1: Unit Mechanics (with Java class template)
- Section 2: Combat Mechanics (with formulas & examples)
- Section 3: Technology Tree (with pseudocode)
- Section 4: City Production (with pseudocode)
- Section 5: Veteran System (detailed breakdown)
- Section 6: Upkeep System (with examples)
- Section 7: Turn Processing Order (phase breakdown)
- Section 8: Unit Classes & Flags (complete reference)
- Section 9: Terrain & Movement Costs (examples)
- Section 10: Building System (detailed)
- Section 11: Zone of Control (with examples)
- Section 12: Unit Activities (with progress tracking)
- Common Pitfalls & Notes
- Testing Checklist
- Source File Quick Reference Table

**Best for:** Implementing specific systems + coding patterns

**Example to Find:**
- How to calculate move rate → Section 9
- Combat resolution pseudocode → Section 2
- Veteran promotion logic → Section 5
- Unit activity progress → Section 12

---

## Navigation by Topic

### If you want to implement...

**Unit Movement System:**
→ JAVA_IMPLEMENTATION_REFERENCE.md → Sections 3 (Fractional Points) & 9 (Terrain Costs)

**Combat Engine:**
→ FREECIV_MECHANICS_GUIDE.txt → Section 2
→ JAVA_IMPLEMENTATION_REFERENCE.md → Section 2

**Technology Research:**
→ FREECIV_MECHANICS_GUIDE.txt → Section 4
→ JAVA_IMPLEMENTATION_REFERENCE.md → Section 3

**City Production:**
→ FREECIV_MECHANICS_GUIDE.txt → Section 5
→ JAVA_IMPLEMENTATION_REFERENCE.md → Section 4

**Unit Activities (Road Building, Mining, etc):**
→ FREECIV_MECHANICS_GUIDE.txt → Section 6
→ JAVA_IMPLEMENTATION_REFERENCE.md → Section 12

**Upkeep & Maintenance:**
→ FREECIV_MECHANICS_GUIDE.txt → Section 7
→ JAVA_IMPLEMENTATION_REFERENCE.md → Section 6

**Complete Game Loop/Turn Processing:**
→ JAVA_IMPLEMENTATION_REFERENCE.md → Section 7

---

## Key Concepts Quick Reference

### Movement
- **Stored as:** Fragments (1 whole point = 3 fragments by default)
- **Shown to client as:** Whole movement points
- **Terrain costs:** Grassland=1, Forest=2, Mountain=3 (in fragments)
- **Special case:** Helicopters only, affected by DamageSlows flag

**Documents:** 
- FREECIV_MECHANICS_GUIDE.txt § 3
- JAVA_IMPLEMENTATION_REFERENCE.md § 3, 9

### Combat
- **Type:** Probabilistic (random but seeded for replays)
- **Formula:** win_chance(attack, defense, hp, firepower) → probability
- **Veteran:** Multiplies power 100% → 150% → 175% → 200%
- **City walls:** 3× defense multiplier
- **Multiple rounds:** Until 0 HP or 50% HP

**Documents:**
- FREECIV_MECHANICS_GUIDE.txt § 2
- JAVA_IMPLEMENTATION_REFERENCE.md § 2

### Technology
- **Structure:** Prerequisite tree (req1 AND req2)
- **Cost:** Fixed (Classic+) or dynamic (Civ1Civ2)
- **Research:** Accumulate bulbs until reaching cost
- **Special:** root_req blocks entire subtree

**Documents:**
- FREECIV_MECHANICS_GUIDE.txt § 4
- JAVA_IMPLEMENTATION_REFERENCE.md § 3

### City Production
- **Model:** Accumulation (shields accumulate until reaching cost)
- **Progress tracking:** accumulation + cost = completion
- **Types:** Unit, Improvement, Wonder, Gold conversion
- **Production source:** Worker citizens on tiles

**Documents:**
- FREECIV_MECHANICS_GUIDE.txt § 5
- JAVA_IMPLEMENTATION_REFERENCE.md § 4

### Upkeep
- **Three types:** Shield (from city production), Food (from growth), Gold (from treasury)
- **Critical:** If city can't provide food → unit dies
- **Timing:** Deducted before production completion
- **Flag:** Shield2Gold allows conversion

**Documents:**
- FREECIV_MECHANICS_GUIDE.txt § 7
- JAVA_IMPLEMENTATION_REFERENCE.md § 6

### Veteran System
- **Levels:** Green (100%) → Veteran (150%) → Hardened (175%) → Elite (200%)
- **Promotion:** 50% → 33% → 20% → 0% (in combat)
- **Effect:** Multiplicative power bonus to attack AND defense
- **Acquisition:** Combat, Barracks building, wondereffects

**Documents:**
- FREECIV_MECHANICS_GUIDE.txt § 1
- JAVA_IMPLEMENTATION_REFERENCE.md § 5

---

## Critical Implementation Warnings

### ⚠️ HELICOPTER SPECIAL CASE
Helicopters lose 10% HP per turn OUTSIDE bases/cities. Dies in 10 turns if not in base!
- **Source:** FREECIV_MECHANICS_GUIDE.txt § 1
- **Details:** JAVA_IMPLEMENTATION_REFERENCE.md § 1 (Unit Classes & Flags)

### ⚠️ MOVEMENT IS FRACTIONAL INTERNALLY
Must track as fragments (not whole points) for terrain cost precision.
- **Details:** JAVA_IMPLEMENTATION_REFERENCE.md § 3, 9

### ⚠️ COMBAT IS PROBABILISTIC
Same units can have different outcomes. Server calculates probability, executes randomly with seeded RNG.
- **Details:** JAVA_IMPLEMENTATION_REFERENCE.md § 2

### ⚠️ UPKEEP BEFORE PRODUCTION
Production shields are reduced by unit upkeep before being applied to production accumulation.
- **Details:** JAVA_IMPLEMENTATION_REFERENCE.md § 6

### ⚠️ RULESET-DRIVEN NOT HARDCODED
All game balance is in XML rulesets, not code. Must support dynamic loading.
- **Details:** EXPLORATION_SUMMARY.md § 8, JAVA_IMPLEMENTATION_REFERENCE.md § Overview

---

## Code Examples Provided

### Unit Class Template
JAVA_IMPLEMENTATION_REFERENCE.md § 1

### Combat Calculation Formula
JAVA_IMPLEMENTATION_REFERENCE.md § 2

### Movement Cost Example
JAVA_IMPLEMENTATION_REFERENCE.md § 9

### City Production Accumulation
JAVA_IMPLEMENTATION_REFERENCE.md § 4

### Veteran Promotion Logic
JAVA_IMPLEMENTATION_REFERENCE.md § 5

### Upkeep Example
JAVA_IMPLEMENTATION_REFERENCE.md § 6

### Turn Processing Order
JAVA_IMPLEMENTATION_REFERENCE.md § 7

---

## Testing Checklist

See **JAVA_IMPLEMENTATION_REFERENCE.md** → Testing Checklist

Key tests to implement:
- [ ] Movement on different terrains
- [ ] Combat outcomes are probabilistic
- [ ] Veteran multipliers apply correctly
- [ ] Helicopter loses 10% HP per turn
- [ ] City production accumulates correctly
- [ ] Tech prerequisites block research
- [ ] Upkeep deducted before production

---

## Source Files Referenced

All information extracted from:
- `/freeciv/data/classic/units.ruleset`
- `/freeciv/data/classic/techs.ruleset`
- `/freeciv/data/classic/buildings.ruleset`
- `/freeciv/common/unit.h` & `unit.c`
- `/freeciv/common/unittype.h`
- `/freeciv/common/tech.h`
- `/freeciv/common/combat.h`
- `/freeciv/common/movement.h`
- `/freeciv/common/city.h`
- `/freeciv/server/*.h` files

See **JAVA_IMPLEMENTATION_REFERENCE.md** → Source File Quick Reference for full mapping.

---

## Document Statistics

| Document | Lines | Size | Focus |
|----------|-------|------|-------|
| EXPLORATION_SUMMARY.md | 237 | 8.4 KB | Overview & architecture |
| FREECIV_MECHANICS_GUIDE.txt | 318 | 9.8 KB | Detailed mechanics reference |
| JAVA_IMPLEMENTATION_REFERENCE.md | 507 | 13 KB | Code-level guidance |
| **Total** | **1,062** | **31 KB** | Complete reference |

---

## Recommendation Order

**For First-Time Readers:**
1. Read EXPLORATION_SUMMARY.md (15 min)
2. Skim FREECIV_MECHANICS_GUIDE.txt sections (30 min)
3. Deep dive JAVA_IMPLEMENTATION_REFERENCE.md for target system (30+ min)
4. Reference during implementation

**For Specific System Implementation:**
1. Find topic in JAVA_IMPLEMENTATION_REFERENCE.md
2. Reference formulas/pseudocode
3. Check FREECIV_MECHANICS_GUIDE.txt for additional context
4. Use source file mapping for C code reference

**For Game Balance/Tuning:**
- All balance values in FREECIV_MECHANICS_GUIDE.txt § 9 (Critical Constants)
- All unit/tech/building definitions in original ruleset files (XML)

---

**Generated:** March 14, 2024  
**Scope:** Freeciv Classic Ruleset v3.3-Devel-2023.Feb.24  
**Target:** Java Server Implementation

