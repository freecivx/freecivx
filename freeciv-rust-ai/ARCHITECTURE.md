# Rust AI Module Structure

## Overview

The Deity Rust AI has been refactored into a modular structure that mirrors the Freeciv C AI architecture found in `freeciv/freeciv/ai/default/`. This makes it easier to understand, maintain, and implement AI behaviors that match the classic Freeciv AI.

## Module Structure

```
src/
├── main.rs                 # Entry point, connection handling, packet processing
├── packets.rs              # Packet type definitions and structures
├── state.rs                # Game state management (Player, City, Unit, GameState)
└── ai/
    ├── mod.rs             # AI coordinator - orchestrates all AI activities
    ├── aihand.rs          # AI handler - turn processing and high-level activities
    ├── aiunit.rs          # Unit management - movement, tactics, unit orders
    ├── aicity.rs          # City management - production, growth, improvements
    ├── aitech.rs          # Technology research - tech tree, research priorities
    └── aitools.rs         # Utility functions - helpers for AI decision making
```

## Module Responsibilities

### main.rs
- TCP connection management
- Packet sending/receiving with JSON protocol
- Packet handling and dispatching
- Main event loop
- Command-line interface

### packets.rs
- Packet type constants (PACKET_*)
- Packet structure definitions
- Serialization/deserialization helpers
- Mirrors `freeciv/freeciv/common/networking/packets.def`

### state.rs
- `GameState` - Central game state container
- `Player` - Player information and resources
- `City` - City data and production
- `Unit` - Unit information and status
- State update methods
- Query helpers (get_our_cities, get_our_units, etc.)

### ai/mod.rs - AI Coordinator
- `DeityAI` struct - Main AI coordinator
- `process_turn()` - Orchestrates AI activities for each turn
- `should_process_turn()` - Determines if AI should act
- Turn sequencing and coordination

### ai/aihand.rs - AI Handler
Based on `freeciv/freeciv/ai/default/aihand.c`

**Responsibilities:**
- `do_first_activities()` - Turn start activities
  - Economic data calculation
  - Government management
  - Tax rate adjustments
- `do_last_activities()` - Turn end activities
  - Turn summary logging
  - Final cleanup

**Current Implementation:**
- ✅ Turn initialization
- ✅ Economic data logging
- ✅ Turn summary
- 🚧 Government management (stub)
- 🚧 Tax optimization (stub)

### ai/aiunit.rs - Unit Management
Based on `freeciv/freeciv/ai/default/daiunit.c`

**Responsibilities:**
- `manage_units()` - Process all units
- Unit classification (settler, worker, military, explorer, diplomat)
- Unit-specific AI routines:
  - Settler management (city founding)
  - Worker management (tile improvements)
  - Military unit tactics (attack, defend, fortify)
  - Explorer movement (map exploration)
  - Diplomat operations (espionage, sabotage)

**Current Implementation:**
- ✅ Unit enumeration
- ✅ Unit role classification framework
- ✅ Per-unit processing loop
- 🚧 Settler AI (stub)
- 🚧 Worker AI (stub)
- 🚧 Military AI (stub)
- 🚧 Explorer AI (stub)
- 🚧 Diplomat AI (stub)

### ai/aicity.rs - City Management
Based on `freeciv/freeciv/ai/default/daicity.c`

**Responsibilities:**
- `manage_cities()` - Process all cities
- Production selection (units, buildings, wonders)
- City growth optimization
- Worker/specialist allocation
- Building purchases
- Building sales (obsolete/redundant)

**Current Implementation:**
- ✅ City enumeration
- ✅ Production status checking
- 🚧 Production choice AI (stub)
- 🚧 Worker management (stub)
- 🚧 Buy logic (stub)
- 🚧 Sell logic (stub)

### ai/aitech.rs - Technology Research
Based on `freeciv/freeciv/ai/default/aitech.c`

**Responsibilities:**
- `choose_tech()` - Select research goal
- Technology value calculation
- Tech tree analysis
- Research priority system

**Current Implementation:**
- ✅ Research selection framework
- 🚧 Tech value calculation (stub)
- 🚧 Tech tree parsing (stub)
- 🚧 Priority system (stub)

### ai/aitools.rs - Utility Functions
Based on `freeciv/freeciv/ai/default/aitools.c`

**Responsibilities:**
- Distance calculations
- Tile queries (units at tile, city at tile)
- Strength calculations
- Threat assessment
- Build capability checks
- Population statistics
- Debug logging

**Current Implementation:**
- ✅ Distance calculation
- ✅ Nearest city finder
- ✅ Units at tile query
- ✅ City at tile query
- ✅ Military strength calculation
- ✅ Threat assessment
- ✅ Build capability checks
- ✅ Unit/city filters
- ✅ Population counting
- ✅ State logging

## Turn Processing Flow

The AI processes turns in this sequence (similar to C AI):

```
1. PACKET_BEGIN_TURN received
   ↓
2. state.start_turn() - Mark turn as started
   ↓
3. PACKET_PROCESSING_FINISHED received
   ↓
4. ai.process_turn() called
   ↓
5. aihand::do_first_activities()
   - Calculate economic data
   - Manage government/taxes
   ↓
6. aicity::manage_cities()
   - Choose production
   - Manage workers
   - Consider purchases
   ↓
7. aiunit::manage_units()
   - Move military units
   - Manage settlers/workers
   - Explore with scouts
   ↓
8. aitech::choose_tech()
   - Select research goal
   ↓
9. aihand::do_last_activities()
   - Log turn summary
   ↓
10. Send PACKET_PLAYER_PHASE_DONE
    ↓
11. state.end_turn() - Mark turn complete
```

## Key Design Patterns

### 1. Separation of Concerns
Each module has a single, well-defined responsibility, making the codebase easier to understand and maintain.

### 2. Mirror C AI Structure
The module names and functions mirror the C AI implementation, making it easier to port algorithms and compare behavior.

### 3. Stub-First Development
Functions are implemented as stubs that log their intent, allowing the system to work end-to-end while features are incrementally added.

### 4. Functional Style
Most AI functions are pure or side-effect-minimal, taking `&GameState` and returning decisions rather than mutating state directly.

## Adding New AI Behaviors

To add new AI behavior:

1. **Identify the C AI module** - Find the equivalent function in `freeciv/freeciv/ai/default/`
2. **Locate the Rust module** - Find the corresponding Rust module (aiunit.rs, aicity.rs, etc.)
3. **Implement the function** - Add the logic, following the C AI algorithm
4. **Test incrementally** - Build and test after each change
5. **Add logging** - Use println! to log decisions for debugging

Example:
```rust
// In ai/aiunit.rs
fn manage_explorer(state: &GameState, unit: &Unit) {
    // TODO: Implement exploration logic
    // 1. Find unexplored tiles
    // 2. Calculate safe path
    // 3. Move toward unexplored area
    println!("[AI Explorer] Unit #{} exploring", unit.id);
}
```

## Testing

Unit tests are in `src/state.rs`:
- Test game state creation
- Test adding/removing entities
- Test ownership queries
- Test turn state management

Run tests with:
```bash
cargo test
```

## Future Enhancements

Priority areas for implementation:

1. **Unit AI** (High Priority)
   - Basic movement
   - Exploration
   - City defense
   - Attack coordination

2. **City AI** (High Priority)
   - Production selection algorithm
   - Worker optimization
   - Growth vs. production balance

3. **Tech AI** (Medium Priority)
   - Tech value calculation
   - Research path planning
   - Beeline strategies

4. **Advanced Features** (Low Priority)
   - Diplomatic negotiations
   - Military strategy
   - Wonder building
   - Victory condition pursuit

## References

- **C AI Source**: `freeciv/freeciv/ai/default/`
- **Improvement Plan**: `doc/RUST_AI_IMPROVEMENT_PLAN.md`
- **Packet Protocol**: `freeciv/freeciv/common/networking/packets.def`
