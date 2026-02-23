# Rust AI Module for Freeciv

This directory contains the Rust AI module for Freeciv C server.

## Current Status

✅ **WORKING** - The Rust AI module is now properly registered and functional!

The Rust AI module is a **hybrid implementation** combining C wrappers with actual Rust code. It provides all core AI functionality by delegating to the Default AI implementation while also containing genuine Rust code for enhanced features and future development.

### Features

**Latest Enhancement (v0.5.0 - Phase 3):** C AI Alignment - Restructured Rust AI to mirror the C Default AI (ai/default) architecture. Added new modules following C AI patterns: military.rs (daimilitary.c), city_management.rs (daicity.c), settler.rs (daisettler.c), wants.rs (adv_want system), and diplomacy.rs (daidiplomacy.c). Implemented hard mode characteristics: aggressive expansion (100% expansion focus), full map awareness, danger assessment, wants-based decision making, and strategic diplomacy.

**Previous Enhancement (v0.4.0 - Phase 2):** Completed Phase 2: Core Logic implementation with comprehensive game state bindings and decision algorithms. Added Rust structs for cities, units, and tiles, plus advanced decision-making functions for city production, unit movement, combat evaluation, settler placement, and city growth strategies.

**Foundation (2024):** The Rust AI module is now properly registered at runtime. The `AI_MOD_STATIC_RUST` preprocessor macro has been added to `meson_fc_config.h.in`, enabling the Rust AI to initialize when the Freeciv server starts. This means the Rust AI is now minimally working and can be selected in games!

## Architecture - C AI Alignment

The Rust AI now follows the structure and logic of the C Default AI (ai/default/):

### Module Structure (mirrors C AI files)

| Rust Module | C AI Equivalent | Purpose |
|-------------|----------------|---------|
| **military.rs** | daimilitary.c/h | Danger assessment, defense evaluation, military production |
| **city_management.rs** | daicity.c/h | City AI decisions, production choices, citizen management |
| **settler.rs** | daisettler.c/h | Expansion logic, settler automation, city founding |
| **wants.rs** | adv_want system | Desire-based scoring for units, buildings, settlers, wonders |
| **diplomacy.rs** | daidiplomacy.c/h | Treaty evaluation, war desire, diplomatic stance |
| **evaluation.rs** | aitools.c | Tile/unit evaluation, threat assessment |
| **planning.rs** | Production planning | Battle prediction, specialist allocation |
| **decision.rs** | High-level decisions | Production, movement, combat, growth strategies |
| **player_management.rs** | daiplayer.c/h | Player data structures |
| **data_structures.rs** | Game state | City, Unit, Tile structures |

Core features:

- ✅ **C AI Architecture** - Mirrors ai/default structure and logic (NEW in v0.5.0)
- ✅ **Hard Mode AI** - Aggressive expansion, full awareness, strategic decisions (NEW in v0.5.0)
- ✅ **Military AI** - Danger assessment, defense evaluation, attack decisions (NEW in v0.5.0)
- ✅ **City Management** - Production choices, citizen allocation, buying (NEW in v0.5.0)
- ✅ **Settler AI** - Expansion desire, site evaluation, settler automation (NEW in v0.5.0)
- ✅ **Wants System** - Desire-based scoring for all production choices (NEW in v0.5.0)
- ✅ **Diplomacy AI** - Treaty evaluation, war desire, diplomatic stance (NEW in v0.5.0)
- ✅ **Complete AI functionality** - Implements all major AI callbacks via Default AI delegation
- ✅ **Actual Rust code** - Contains real Rust implementation with FFI bindings
- ✅ **Game state bindings** - Rust structs for City, Unit, and Tile
- ✅ **Decision algorithms** - AI decision-making in Rust
- ✅ **City production AI** - Intelligent build decisions based on game state
- ✅ **Unit movement AI** - Strategic movement evaluation
- ✅ **Combat AI** - Attack decision-making with win probability
- ✅ **Settler AI** - Optimal city placement evaluation
- ✅ **Growth strategy** - Dynamic city growth management
- ✅ **Player management** - Rust-based player data structures and aggression tracking
- ✅ **Tile evaluation** - Rust-implemented tile scoring algorithm
- ✅ **City placement** - Advanced city location evaluation
- ✅ **Unit strength** - Combat value calculation with health modifiers
- ✅ **Threat assessment** - Enemy force danger evaluation
- ✅ **Technology evaluation** - Research priority calculation
- ✅ **Diplomacy assessment** - Diplomatic stance evaluation
- ✅ **Trade route optimization** - Trade route value calculation
- ✅ **Production planning** - Optimal city production decisions
- ✅ **Battle prediction** - Combat outcome probability
- ✅ **Specialist allocation** - City specialist recommendations
- ✅ **Build order planning** - City building priority system
- ✅ **Logging** - Rust-based logging for debugging
- ✅ **Unit tests** - Comprehensive Rust test suite (39 tests)
- ✅ **Memory safety** - Rust's ownership system ensures safe FFI interactions
- ✅ **Player management** - Allocation, lifecycle, and control (via Default AI)
- ✅ **City management** - City AI decisions, building choices, and optimization (via Default AI)
- ✅ **Unit management** - Unit control, movement, combat, and tasks (via Default AI)
- ✅ **Settler automation** - Automated settler and worker units (via Default AI)
- ✅ **Diplomacy** - Treaty evaluation, first contact, and incidents (via Default AI)
- ✅ **Military AI** - Attack and defense coordination (via Default AI)
- ✅ **Economic AI** - Government choices and technology research (via Default AI)
- ✅ **Save/Load support** - Persistence of AI state

## DEITY Difficulty Level

This module supports the DEITY difficulty level, which is the highest difficulty 
setting with no AI handicaps. The DEITY level is independent of which AI module 
is used (classic, stub, rust, etc.) and can be applied to any AI player.

To use DEITY difficulty with the Rust AI:
1. Build the server with the Rust AI enabled (see Building section)
2. Set a player to use the Rust AI type
3. Set the difficulty level to DEITY

## Building

The Rust AI is **built by default** when using `prepare_freeciv.sh`. The build process now compiles actual Rust code:

```bash
cd /path/to/freeciv
./prepare_freeciv.sh
```

This will:
1. Compile Rust code using Cargo (creates `target/release/librustai.a`)
2. Build C wrapper code (`rustai.c`)
3. Link both together into the final AI module

### Prerequisites

- Rust toolchain (rustc and cargo)
- Standard C build tools (gcc, make, autotools)
- Default AI module (required for delegation)

### Manual Build

You can also build manually with autotools:

```bash
cd freeciv
./autogen.sh
./configure --enable-ai-static=rust
make
```

### Build Options

- `--enable-ai-static=rust` - Statically links the Rust AI module
- `--with-default-ai=rust` - Sets Rust AI as the default AI type

## Rust Implementation

The module includes actual Rust code in `src/lib.rs` that provides:

### FFI Exports

#### Player Management
- `rust_ai_player_init(player_id)` - Initialize Rust player data structure
- `rust_ai_player_free(data)` - Free Rust player data
- `rust_ai_get_aggression(data)` - Get AI aggression level (0-100)
- `rust_ai_set_aggression(data, level)` - Set AI aggression level
- `rust_ai_get_expansion_focus(data)` - Get AI expansion priority (0-100)
- `rust_ai_set_expansion_focus(data, level)` - Set expansion focus (0=defensive, 100=expansionist)
- `rust_ai_get_science_focus(data)` - Get AI science vs military balance (0-100)
- `rust_ai_set_science_focus(data, level)` - Set science focus (0=military, 100=science)

#### Evaluation Functions
- `rust_ai_evaluate_tile(x, y, terrain)` - Evaluate tile desirability
- `rust_ai_evaluate_city_placement(x, y, terrain, water, land)` - Score city placement quality
- `rust_ai_evaluate_unit_strength(attack, defense, move, hp, max_hp)` - Calculate unit combat value
- `rust_ai_assess_threat(enemies, strength, distance, our_defense)` - Assess threat level (0-100)
- `rust_ai_evaluate_tech(cost, military, economic, units, buildings, wonders)` - Technology research priority
- `rust_ai_evaluate_diplomacy(our_str, their_str, borders, wars, trade, tech)` - Diplomatic stance (-100 to 100)
- `rust_ai_evaluate_trade_route(our_size, their_size, dist, our_bonus, their_bonus, connection)` - Trade route value

#### Planning Functions
- `rust_ai_optimize_production(food, prod, science, pop, military, growth, infra)` - Production recommendation
- `rust_ai_predict_battle(att_str, att_hp, att_fp, def_str, def_hp, def_fp, terrain)` - Battle win probability (0-100)
- `rust_ai_evaluate_specialist(food, shields, science_pri, tax_pri, citizens)` - Specialist type recommendation
- `rust_ai_city_build_order(is_first, turn, enemies, coastal)` - City building priority

#### Phase 2: Decision Algorithms (NEW in v0.4.0)
- `rust_ai_decide_city_production(city, nearby_enemies, our_military, turn)` - City production decisions
- `rust_ai_evaluate_unit_move(unit, target_tile, has_enemies, strategic_value)` - Unit movement evaluation
- `rust_ai_evaluate_attack(attacker, defender, terrain_bonus, support)` - Combat decision-making
- `rust_ai_evaluate_settle_location(settler, tile, nearby_cities, resources)` - Settler placement decisions
- `rust_ai_city_growth_strategy(city, population_limit, starvation_risk)` - City growth management

#### Utilities
- `rust_ai_log(message)` - Log messages from Rust
- `rust_ai_get_version()` - Get Rust AI version string

### Data Structures

```rust
// Player AI data
pub struct RustAIPlayerData {
    player_id: c_int,
    turn_initialized: c_int,
    aggression_level: c_int,     // 0-100: AI aggression
    expansion_focus: c_int,       // 0-100: 0=defensive, 100=expansionist
    science_focus: c_int,         // 0-100: 0=military, 100=science
}

// Phase 2: Game State Bindings (NEW in v0.4.0)
pub struct RustTile {
    x: c_int,
    y: c_int,
    terrain_type: c_int,
    has_river: c_int,
    has_road: c_int,
    has_railroad: c_int,
    owner_id: c_int,
    worked_by_city_id: c_int,
}

pub struct RustUnit {
    unit_id: c_int,
    owner_id: c_int,
    x: c_int,
    y: c_int,
    attack_strength: c_int,
    defense_strength: c_int,
    movement_points: c_int,
    moves_left: c_int,
    hitpoints: c_int,
    max_hitpoints: c_int,
    firepower: c_int,
    veteran_level: c_int,
    is_military: c_int,
}

pub struct RustCity {
    city_id: c_int,
    owner_id: c_int,
    x: c_int,
    y: c_int,
    population: c_int,
    food_surplus: c_int,
    shield_surplus: c_int,
    trade_production: c_int,
    science_output: c_int,
    gold_output: c_int,
    luxury_output: c_int,
    is_coastal: c_int,
    turn_founded: c_int,
}
```

### Testing

The Rust code includes comprehensive unit tests:

```bash
cd freeciv/freeciv/ai/rust
cargo test
```

Tests cover:
- Tile evaluation logic with diverse terrain types
- City placement scoring algorithm
- Unit strength calculation with health modifiers
- Threat assessment from enemy forces
- Player data management (aggression, expansion, science focus)
- Technology evaluation and research prioritization
- Diplomatic stance assessment
- Trade route value calculation
- Production optimization decisions
- Battle outcome prediction
- Specialist allocation recommendations
- City build order planning
- **Phase 2 decision algorithms** (NEW in v0.4.0):
  - City production decision-making
  - Unit movement evaluation
  - Combat attack decisions
  - Settler location evaluation
  - City growth strategy management
- Game state struct creation and access (NEW in v0.4.0)
- Parameter clamping and edge cases
- Memory safety (allocation/deallocation)

**Test Results:** All 20 tests passing ✓

## Usage

Once built, the Rust AI can be selected in-game:

1. Start the Freeciv server
2. Use `/aitoggle <player> rust` to switch a player to Rust AI
3. Or set default AI: `/set aifill rust`

## Architecture

The module follows a hybrid architecture combining Rust and C:

### C Wrapper Layer (`rustai.c`)
- Implements standard Freeciv AI module pattern
- `fc_ai_rust_capstr()` - Returns the AI module capability string
- `fc_ai_rust_setup()` - Initializes the AI module and sets up callbacks
- **43+ callback functions** - Handle various game events and decisions
- Delegates most functionality to Default AI for compatibility

### Rust Implementation Layer (`src/lib.rs`)
- Provides FFI-exported functions callable from C
- Implements custom AI logic in safe Rust
- Memory-safe data structures with ownership guarantees
- Comprehensive unit test coverage

### Current Implementation

The Rust AI currently acts as a **hybrid wrapper** that:
1. Delegates core game logic to the Default AI (`ai/default/`)
2. Adds Rust-specific enhancements like tile evaluation
3. Provides foundation for future Rust-based AI improvements

| Category | Functions | Purpose |
|----------|-----------|---------|
| **Module** | module_close | Resource cleanup |
| **Player** | player_alloc, player_free, gained_control, etc. | Player lifecycle (Default AI) |
| **City** | city_alloc, city_free, choose_building, etc. | City management (Default AI) |
| **Unit** | unit_alloc, unit_free, unit_move, etc. | Unit control (Default AI) |
| **Settler** | settler_reset, settler_run, settler_cont | Automated workers (Default AI) |
| **Turn** | first_activities, restart_phase, last_activities | Turn phases (Default AI) |
| **Diplomacy** | treaty_evaluate, first_contact, incident | Diplomatic actions (Default AI) |
| **Build** | build_adv_init, build_adv_adjust, gov_value | Economic decisions (Default AI) |
| **Rust Logic** | tile_evaluation, aggression_tracking | Custom Rust implementations |

## Future Development

The plan is to incrementally replace C AI logic from `ai/default/` with pure Rust implementations:

### Phase 1: Foundation (✅ Complete)
- ✅ FFI Layer - Rust FFI bindings to C game structures
- ✅ Basic data structures - Player data, tile evaluation
- ✅ Build integration - Cargo build in Makefile.am
- ✅ Unit tests - Test coverage for Rust code

### Phase 2: Core Logic (✅ Complete)
- ✅ Incremental porting - Replace wrapper functions with Rust implementations
- ✅ Game state bindings - Rust structs for cities, units, tiles
- ✅ Decision algorithms - AI decision-making in Rust
- ✅ Performance testing - Comprehensive test suite with 20 tests

### Phase 3: C AI Alignment (✅ Complete - v0.5.0)
- ✅ Module restructuring - Match ai/default architecture
- ✅ Military AI - Danger assessment, defense evaluation (military.rs)
- ✅ City management - Production choices, citizen management (city_management.rs)
- ✅ Settler AI - Expansion logic, site evaluation (settler.rs)
- ✅ Wants system - Desire-based scoring (wants.rs)
- ✅ Diplomacy AI - Treaty evaluation, war desire (diplomacy.rs)
- ✅ Hard mode characteristics - 100% expansion, full awareness
- ✅ Test coverage - 39 comprehensive tests, all passing

### Phase 4: Advanced Features (Next)
- [ ] Machine learning - Experimental ML-based strategies
- [ ] Parallel processing - Leverage Rust's concurrency
- [ ] Advanced algorithms - New AI strategies
- [ ] Optimization - Performance improvements with Rust
- [ ] Deeper C AI integration - More sophisticated algorithms from daimilitary.c, daicity.c
- [ ] Tech tree analysis - Advanced research planning
- [ ] Coordinated attacks - Multi-unit invasion planning

- [ ] ### Phase 4: Use llm to generate AI chat messages using https://github.com/ggml-org/llama.cpp or something better. Concurrency for LLM. The LLM must generate messages in a separete thread or similar.

Benefits of porting to Rust:
- **Memory safety** through Rust's ownership system
- **Better maintainability** with modern language features
- **Testability** with Rust's testing framework
- **Performance** potential with Rust's zero-cost abstractions
- **Experimentation** easier with new AI algorithms

## Development Notes

- The module requires the Default AI to be built (`AI_MOD_DEFAULT_NEEDED=yes`)
- All wrapper functions use the `rai_*` prefix (Rust AI)
- Default AI functions use the `dai_*` prefix (Default AI)
- Rust FFI functions use the `rust_ai_*` prefix
- The module maintains an `ai_type` pointer via `rust_ai_get_self()`
- Rust code uses `extern "C"` and `#[no_mangle]` for FFI compatibility

## Testing

Test the Rust AI by:
1. Building with `--enable-ai-static=rust`
2. Running a game with Rust AI players
3. Comparing behavior to Classic AI
4. Checking AI decisions in the game logs

## Contributing

When adding new functionality:
1. Follow the existing wrapper pattern
2. Include proper documentation comments
3. Test thoroughly against the Classic AI
4. Consider future Rust implementation paths
