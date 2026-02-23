# Rust AI Module - Quick Start Guide

## What is the Rust AI?

The Rust AI is a hybrid AI module for Freeciv that combines:
- **Rust implementation** for tile evaluation, player data management, and game logic
- **C wrapper** that integrates with Freeciv's AI system
- **Default AI delegation** for full game functionality

## Status: ✅ Working!

As of this fix, the Rust AI module is **minimally working** and can be used in games.

## How to Build

The Rust AI is built automatically when you build Freeciv with Meson:

```bash
cd freeciv
./prepare_freeciv.sh
```

This will:
1. Compile the Rust library (`cargo build --release`)
2. Link it with the C server code
3. Register it as a static AI module

## How to Use

Once the server is running, you can enable the Rust AI for any player:

### In-Game Commands

```
/aitoggle <player> rust    # Switch a player to Rust AI
/list                      # Show available AI types
/set aifill rust          # Set Rust AI as default for new AI players
```

### Example Session

```
> /aitoggle Player1 rust
Player1 is now controlled by rust AI.

> /list
Available AI types: classic, tex, rust
```

## What the Rust AI Does

Currently, the Rust AI provides:

1. **Player Data Management** (Rust)
   - Tracks aggression level (0-100)
   - Tracks expansion focus (0-100)
   - Tracks science vs. military focus (0-100)

2. **Game State Bindings** (Rust) - **NEW in v0.4.0**
   - Rust structs for City, Unit, and Tile
   - FFI-safe game state representation
   - Memory-safe data handling

3. **Decision Algorithms** (Rust) - **NEW in v0.4.0**
   - City production decisions (settler/unit/building/wonder)
   - Unit movement evaluation (strategic positioning)
   - Combat attack decisions (with win probability)
   - Settler placement evaluation (optimal city locations)
   - City growth strategy (food/production/wealth balance)

4. **Tile Evaluation** (Rust)
   - Scores terrain types for desirability
   - Evaluates city placement locations
   - Assesses resource distribution

5. **Unit Combat Assessment** (Rust)
   - Calculates unit strength based on stats
   - Factors in health, mobility, attack/defense
   - Predicts battle outcomes with probability

6. **Threat Assessment** (Rust)
   - Evaluates danger from enemy forces
   - Considers distance and relative strength

7. **Technology Management** (Rust)
   - Evaluates research priorities
   - Considers military and economic value
   - Factors in enabled units, buildings, and wonders
   - Optimizes cost vs. benefit

8. **Diplomacy System** (Rust)
   - Assesses diplomatic stances (-100 to 100)
   - Considers military strength, borders, history
   - Evaluates trade benefits and tech advancement
   - Balances aggression vs. cooperation

9. **Economic Planning** (Rust)
   - Evaluates trade route potential
   - Optimizes city production decisions
   - Recommends specialist allocation
   - Plans city build orders

10. **Full Game AI** (Default AI delegation)
    - City management
    - Unit movement and combat
    - Diplomacy
    - Technology research
    - Settler automation
    - All other game mechanics

## Technical Details

### The Fix

The issue was that `AI_MOD_STATIC_RUST` wasn't defined in the build configuration, preventing the Rust AI from being registered. This has been fixed by adding one line to `freeciv/freeciv/gen_headers/meson_fc_config.h.in`:

```c
#define AI_MOD_STATIC_RUST
```

### Code Structure

```
freeciv/freeciv/ai/rust/
├── Cargo.toml           # Rust package configuration
├── src/
│   └── lib.rs          # Rust AI implementation (2000+ lines)
├── rustai.c            # C wrapper and integration (700+ lines)
├── Makefile.am         # Autotools build config
└── README.md          # Detailed documentation
```

### Testing

The Rust code includes comprehensive unit tests:

```bash
cd freeciv/freeciv/ai/rust
cargo test
```

All tests pass ✓ (20 tests covering all features including Phase 2 decision algorithms)

## Future Development

The Rust AI is designed to incrementally replace C AI logic with Rust implementations:

- **Phase 1: Foundation** ✅ Complete
  - FFI bindings
  - Basic data structures
  - Build integration
  - Unit tests

- **Phase 2: Core Logic** ✅ Complete
  - Game state bindings (City, Unit, Tile structs)
  - Decision algorithms in Rust
  - City production decisions
  - Unit movement and combat evaluation
  - Settler placement and city growth strategies

- **Phase 3: Advanced Features** (Next)
  - Machine learning strategies
  - Parallel processing
  - Advanced algorithms
  - Performance optimizations

## Contributing

To add new Rust AI features:

1. Add Rust functions to `src/lib.rs` with `#[no_mangle]` and `extern "C"`
2. Declare them in `rustai.c`
3. Call them from the AI callback functions
4. Add unit tests in Rust
5. Update documentation

## Questions?

- See the detailed [README.md](README.md) for more information
- Check the Rust code in `src/lib.rs` for implementation details
- Review `rustai.c` for C integration examples
