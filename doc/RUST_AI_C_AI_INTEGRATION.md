# Rust AI - Classic C AI Integration

## Overview

This document describes the integration of algorithms and logic from the Freeciv Classic C AI (located in `freeciv/freeciv/ai/default/`) into the Rust AI implementation (`freeciv-rust-ai/`).

## Goals

The primary goal is to make the Rust AI behave similarly to the Freeciv Classic AI by porting proven algorithms and decision-making logic. This ensures the Rust AI plays competently and makes reasonable strategic and tactical decisions.

## Integration Approach

Rather than a complete 1:1 port, we adopt key algorithms and patterns from the C AI:

1. **Core Decision Logic**: Port the fundamental decision-making algorithms
2. **Priority Systems**: Implement the same priority-based decision making
3. **Evaluation Functions**: Use similar evaluation criteria and weights
4. **Simplified Implementation**: Start with simplified versions, gradually add complexity

## Algorithms Ported from C AI

### 1. Amortization (aitools.c)

**C AI Source**: `freeciv/freeciv/ai/default/aitools.c` - `military_amortize()`

**Purpose**: Discount future value by the time needed to achieve it, making immediate gains more valuable than distant ones.

**Implementation** (`aitools.rs`):
```rust
pub fn amortize(value: i32, delay: i32) -> i32 {
    if value <= 0 || delay < 0 {
        return 0;
    }
    let turns = 40; // Average game length factor
    (value * turns) / (turns + delay)
}
```

**Usage**: 
- Evaluating settler destinations (closer locations are preferred)
- Technology research (faster techs are preferred)
- Production choices (quick builds vs. long-term investments)

### 2. City Danger Assessment (daimilitary.c)

**C AI Source**: `freeciv/freeciv/ai/default/daimilitary.c` - `dai_assess_danger()`

**Purpose**: Evaluate the threat level to a city based on nearby enemy units and defensive strength.

**Implementation** (`aitools.rs`):
```rust
pub fn assess_city_danger(state: &GameState, city: &City) -> i32 {
    let our_strength = military_strength_at_tile(state, city.tile, city.owner);
    
    if our_strength == 0 {
        return 100; // Maximum danger if undefended
    }
    
    let enemy_strength: i32 = state.units
        .values()
        .filter(|u| u.owner != city.owner && tile_distance(u.tile, city.tile) < 5)
        .map(|u| {
            let str = calculate_unit_strength(u);
            let dist = tile_distance(u.tile, city.tile);
            // Discount by distance - closer threats are more dangerous
            str / (dist + 1)
        })
        .sum();
    
    let danger = (enemy_strength * 100) / (our_strength + 1);
    danger.min(100)
}
```

**Key Features**:
- Returns 0-100 danger level
- Accounts for distance (closer enemies are more dangerous)
- Considers defensive strength
- Returns max danger if city is undefended

**Usage**:
- Production decisions (build defenders if danger > 50)
- Unit deployment (send units to defend threatened cities)
- Tech selection (prioritize military techs if danger is high)

### 3. City Tile Evaluation for Settlers (daisettler.c)

**C AI Source**: `freeciv/freeciv/ai/default/daisettler.c` - `city_desirability()`

**Purpose**: Evaluate how good a tile location is for founding a new city.

**Implementation** (`aitools.rs`):
```rust
pub fn evaluate_city_tile(state: &GameState, tile: i32) -> i32 {
    let mut value = 100; // Base value
    
    // Check if too close to existing cities (citymindist)
    if let Some(player_id) = state.our_player_id {
        for city in state.cities.values() {
            if city.owner == player_id {
                let dist = tile_distance(city.tile, tile);
                if dist < 3 {
                    return 0; // Too close to existing city
                }
                if dist < 5 {
                    value -= (5 - dist) * 20; // Penalty for crowding
                }
            }
        }
    }
    
    // Bonus for good expansion distance
    if let Some(dist) = find_nearest_city_distance_to_tile(state, tile) {
        if dist > 3.0 && dist < 10.0 {
            value += 20; // Good expansion distance
        }
    } else {
        value += 50; // First city bonus
    }
    
    value.max(0)
}
```

**C AI Factors** (simplified in Rust implementation):
- Food/shield/trade output of tile and surroundings
- Distance from other cities (citymindist enforcement)
- Terrain defense bonus
- Naval access (proximity to water)
- Danger at location

**Usage**:
- Settler decides where to found cities
- Threshold value (>80) triggers city founding

### 4. Combat Evaluation (daiunit.c)

**C AI Source**: `freeciv/freeciv/ai/default/daiunit.c` - Attack/defense logic

**Purpose**: Determine if a unit should attack an enemy or defend.

**Implementation** (`aiunit.rs`):
```rust
fn should_attack(attacker: &Unit, defender: &Unit, _state: &GameState) -> bool {
    let attacker_strength = calculate_unit_strength(attacker);
    let defender_strength = calculate_unit_strength(defender);
    
    // Attack if we have 1.5x strength advantage
    attacker_strength >= (defender_strength * 3) / 2
}

fn calculate_attack_priority(attacker: &Unit, defender: &Unit, state: &GameState) -> i32 {
    let dist = state.map.distance(attacker.tile, defender.tile);
    let defender_hp = defender.hp;
    
    // Prefer weaker, closer targets
    (dist * 10) + defender_hp as i32
}
```

**Key Features**:
- Requires 1.5x strength advantage before attacking
- Prioritizes weak, nearby targets
- Considers HP and distance

**C AI Complexity** (not yet ported):
- Detailed combat odds calculation
- Terrain defense modifiers
- Veteran level effects
- Firepower calculations

### 5. Unit Management Priorities (daiunit.c)

**C AI Source**: `freeciv/freeciv/ai/default/daiunit.c` - `dai_manage_military()`

**Purpose**: Determine unit priorities and actions based on game state.

**Implementation** (`aiunit.rs`):
```rust
fn manage_attacker(state: &GameState, ai_data: &mut AIData, unit: &Unit) {
    // Priority 1: Heal if critically damaged (<50% HP)
    let hp_percent = (unit.hp * 100) / max_hp;
    if hp_percent < 50 {
        ai_data.set_unit_task(unit.id, AIUnitTask::Recover, None);
        return;
    }
    
    // Priority 2: Defend threatened cities
    for city in state.cities.values() {
        if city.owner == player_id {
            let danger = assess_city_danger(state, city);
            if danger > 30 && dist <= 3 {
                ai_data.set_unit_task(unit.id, AIUnitTask::DefendHome, Some(city.tile));
                return;
            }
        }
    }
    
    // Priority 3: Attack nearby enemies
    let enemies = find_nearby_enemies(state, unit.tile);
    if !enemies.is_empty() && should_attack(...) {
        ai_data.set_unit_task(unit.id, AIUnitTask::Attack, Some(target.tile));
        return;
    }
    
    // Priority 4: Patrol/explore
}
```

**C AI Priority Order**:
1. Heal if damaged (HP < 50%)
2. Defend home cities if threatened
3. Attack vulnerable enemies
4. Patrol or explore

### 6. Production Selection (daicity.c)

**C AI Source**: `freeciv/freeciv/ai/default/daicity.c` - `dai_manage_city()`

**Purpose**: Choose what a city should produce based on current needs.

**Implementation** (`aicity.rs`):
```rust
fn choose_production(state: &GameState, city: &City) {
    // Priority 1: Emergency defender (danger > 50)
    let danger = assess_city_danger(state, city);
    if danger > 50 && check_if_needs_defender(state, city) {
        // TODO: Build defender (highest priority)
        return;
    }
    
    // Priority 2: Basic defender (no garrison)
    if check_if_needs_defender(state, city) {
        // TODO: Build defender
        return;
    }
    
    // Priority 3: Settlers for expansion
    if should_build_settler(state, city, total_cities) {
        // TODO: Build settler
        return;
    }
    
    // Priority 4: Workers (maintain 1.5 per city ratio)
    let worker_ratio = worker_count as f32 / total_cities.max(1) as f32;
    if worker_ratio < 1.5 && city.size >= 3 {
        // TODO: Build worker
        return;
    }
    
    // Priority 5: Infrastructure (peaceful times)
    if should_build_infrastructure(state, city) {
        // TODO: Build building
        return;
    }
    
    // Default: Military units
}
```

**C AI Production System**:
- Uses "want" values for each choice
- Evaluates buildings by their effects
- Considers urgency (danger level)
- Maintains balance between economy and military

**Settler Rules** (from C AI):
```rust
fn should_build_settler(...) -> bool {
    // Don't build if we have enough cities
    if total_cities >= 5 { return false; }
    
    // City must be large enough (size 4+)
    if city.size < 4 { return false; }
    
    // Don't build too many settlers at once
    settler_count < 2
}
```

### 7. Technology Selection (aitech.c)

**C AI Source**: `freeciv/freeciv/ai/default/aitech.c` - `dai_select_tech()`

**Purpose**: Choose which technology to research based on current game state and needs.

**Implementation** (`aitech.rs`):
```rust
fn get_tech_priorities(state: &GameState) -> Vec<(String, i32)> {
    let mut priorities = Vec::new();
    let total_cities = state.get_our_cities().len();
    
    // Early game (< 3 cities): Expansion techs
    if total_cities < 3 {
        priorities.push(("Pottery".to_string(), 100));      // Granary
        priorities.push(("Bronze Working".to_string(), 80)); // Settlers
        priorities.push(("Animal Husbandry".to_string(), 70));
    }
    // Mid-game (3-6 cities): Infrastructure
    else if total_cities < 6 {
        priorities.push(("Writing".to_string(), 90));    // Library
        priorities.push(("Monarchy".to_string(), 85));   // Government
        priorities.push(("Iron Working".to_string(), 75)); // Military
    }
    // Late game: Balance economy and military
    else {
        priorities.push(("Philosophy".to_string(), 100)); // Free tech
        priorities.push(("Republic".to_string(), 90));    // Government
    }
    
    // Adjust for danger - prioritize military techs
    let avg_danger = calculate_average_city_danger(state);
    if avg_danger > 40 {
        priorities.push(("Horseback Riding".to_string(), 120));
        priorities.push(("Iron Working".to_string(), 110));
    }
    
    priorities.sort_by(|a, b| b.1.cmp(&a.1));
    priorities
}
```

**C AI Tech System**:
- Maintains `tech_want[]` array
- Cities add want for techs they need
- Want values propagate to prerequisites
- Amortizes by research time
- Selects highest adjusted want

## Comparison: C AI vs Rust AI

### Complexity Levels

| Feature | C AI Implementation | Rust AI Implementation | Status |
|---------|---------------------|------------------------|--------|
| **Danger Assessment** | Complex multi-factor calculation with terrain | Simplified distance-based | ⚠️ Simplified |
| **City Placement** | Full tile evaluation with food/shield/trade | Distance and crowding only | ⚠️ Simplified |
| **Combat Odds** | Detailed firepower/HP/terrain calculation | Simple strength ratio | ⚠️ Simplified |
| **Tech Selection** | Want accumulation from all sources | Phase-based priorities | ⚠️ Simplified |
| **Production** | Building effect evaluation | Priority-based rules | ⚠️ Simplified |
| **Amortization** | Multi-purpose with city production | Time-discount only | ✅ Core logic |

### What's Missing

The Rust AI currently lacks these C AI features:

1. **Pathfinding** (`pf_tools.h`)
   - C AI uses sophisticated pathfinding for unit movement
   - Rust AI has no pathfinding yet

2. **Tile Output Calculation**
   - C AI calculates food/shield/trade for each tile
   - Rust AI doesn't have this data yet

3. **Effect System**
   - C AI evaluates building effects
   - Rust AI uses simple rules

4. **Government Analysis**
   - C AI evaluates and switches governments
   - Rust AI has stub only

5. **Diplomacy**
   - C AI has full diplomatic logic
   - Rust AI has no diplomacy

6. **Ferry Management** (`aiferry.c`)
   - C AI manages boats for transport
   - Rust AI doesn't handle water units

## Future Improvements

### Phase 2: Tile Data Integration

**Goal**: Add proper tile evaluation with food/shield/trade calculations.

**Required**:
- Parse ruleset data for terrain types
- Calculate tile output based on improvements
- Integrate into city placement evaluation

**C AI Reference**: `daisettler.c` - `tile_data_cache` system

### Phase 3: Pathfinding

**Goal**: Implement pathfinding for unit movement.

**Required**:
- Port pathfinding data structures
- Implement A* or similar algorithm
- Handle terrain movement costs

**C AI Reference**: `common/aicore/pf_tools.h`

### Phase 4: Advanced Combat

**Goal**: Implement detailed combat calculations.

**Required**:
- Unit type data (attack/defense strength)
- Terrain defense bonuses
- Firepower and HP-based odds calculation

**C AI Reference**: `daiunit.c` - combat evaluation functions

### Phase 5: Building Effects

**Goal**: Evaluate buildings by their actual effects on cities.

**Required**:
- Parse building effects from ruleset
- Calculate building want based on city needs
- Priority-based building selection

**C AI Reference**: `daicity.c` - building want calculation

## Testing Strategy

### Unit Tests

Current tests verify:
- Game state management
- Map operations
- Unit and city tracking

**Needed tests**:
- Danger assessment accuracy
- City tile evaluation
- Combat priority calculation
- Tech priority ordering

### Integration Tests

**Needed**:
- Full game simulation
- Compare Rust AI decisions to C AI
- Performance benchmarks

### Manual Testing

**Process**:
1. Start Freeciv server
2. Connect Rust AI
3. Observe decision-making
4. Compare to C AI behavior

## Performance Considerations

### C AI Optimizations to Port

1. **Caching**: C AI caches tile evaluations
2. **Early Termination**: Stop searching when "good enough" found
3. **Amortization**: Discount distant gains

### Rust-Specific Optimizations

1. Use `HashMap` for O(1) lookups
2. Minimize allocations in hot paths
3. Consider parallel evaluation of cities

## Documentation References

### C AI Source Files

Core files in `freeciv/freeciv/ai/default/`:

- `aihand.c` - Main AI turn handler
- `daiunit.c` - Unit AI and military
- `daicity.c` - City management
- `aitech.c` - Technology research
- `daisettler.c` - Settler and city founding
- `aitools.c` - Utility functions
- `daimilitary.c` - Military strategy
- `daidiplomacy.c` - Diplomatic decisions

### Related Documentation

- `doc/RUST_AI_IMPROVEMENT_PLAN.md` - Overall Rust AI roadmap
- `freeciv-rust-ai/ARCHITECTURE.md` - Rust AI module structure
- `freeciv-rust-ai/IMPROVEMENTS.md` - Change history

## Conclusion

The Rust AI now incorporates key decision-making algorithms from the Freeciv Classic C AI. While simplified compared to the full C implementation, these algorithms provide a solid foundation for competent gameplay. Future phases will add the missing complexity (tile data, pathfinding, detailed combat) to bring the Rust AI closer to C AI parity.
