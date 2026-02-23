# Rust AI Module for Freeciv

This directory contains the Rust AI module for Freeciv C server.

## Current Status

The Rust AI module is a **hybrid implementation** combining C wrappers with actual Rust code. It provides all core AI functionality by delegating to the Default AI implementation while also containing genuine Rust code for enhanced features and future development.

### Features

- ✅ **Complete AI functionality** - Implements all major AI callbacks via Default AI delegation
- ✅ **Actual Rust code** - Contains real Rust implementation with FFI bindings
- ✅ **Player management** - Rust-based player data structures and aggression tracking
- ✅ **Tile evaluation** - Rust-implemented tile scoring algorithm
- ✅ **Logging** - Rust-based logging for debugging
- ✅ **Unit tests** - Comprehensive Rust test suite
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

- `rust_ai_player_init(player_id)` - Initialize Rust player data structure
- `rust_ai_player_free(data)` - Free Rust player data
- `rust_ai_get_aggression(data)` - Get AI aggression level (0-100)
- `rust_ai_set_aggression(data, level)` - Set AI aggression level
- `rust_ai_get_expansion_focus(data)` - Get AI expansion priority (0-100)
- `rust_ai_set_expansion_focus(data, level)` - Set expansion focus (0=defensive, 100=expansionist)
- `rust_ai_get_science_focus(data)` - Get AI science vs military balance (0-100)
- `rust_ai_set_science_focus(data, level)` - Set science focus (0=military, 100=science)
- `rust_ai_log(message)` - Log messages from Rust
- `rust_ai_evaluate_tile(x, y, terrain)` - Evaluate tile desirability
- `rust_ai_evaluate_city_placement(x, y, terrain, water, land)` - Score city placement quality
- `rust_ai_evaluate_unit_strength(attack, defense, move, hp, max_hp)` - Calculate unit combat value
- `rust_ai_assess_threat(enemies, strength, distance, our_defense)` - Assess threat level (0-100)
- `rust_ai_get_version()` - Get Rust AI version string

### Data Structures

```rust
pub struct RustAIPlayerData {
    player_id: c_int,
    turn_initialized: c_int,
    aggression_level: c_int,     // 0-100: AI aggression
    expansion_focus: c_int,       // 0-100: 0=defensive, 100=expansionist
    science_focus: c_int,         // 0-100: 0=military, 100=science
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
- Parameter clamping and edge cases
- Memory safety (allocation/deallocation)

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

### Phase 2: Core Logic (In Progress)
- [ ] Incremental porting - Replace wrapper functions with Rust implementations
- [ ] Game state bindings - Rust structs for cities, units, tiles
- [ ] Decision algorithms - AI decision-making in Rust
- [ ] Performance testing - Ensure behavior matches original AI

### Phase 3: Advanced Features
- [ ] Machine learning - Experimental ML-based strategies
- [ ] Parallel processing - Leverage Rust's concurrency
- [ ] Advanced algorithms - New AI strategies
- [ ] Optimization - Performance improvements with Rust

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
