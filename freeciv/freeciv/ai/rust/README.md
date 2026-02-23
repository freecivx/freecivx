# Rust AI Module for Freeciv

This directory contains the Rust AI module for Freeciv C server.

## Current Status

The Rust AI module is now a **fully functional wrapper** around the Default AI implementation. It provides all the core AI functionality by delegating to the proven Default AI logic while maintaining a clean interface for future Rust code integration.

### Features

- ✅ **Complete AI functionality** - Implements all major AI callbacks
- ✅ **Player management** - Allocation, lifecycle, and control
- ✅ **City management** - City AI decisions, building choices, and optimization
- ✅ **Unit management** - Unit control, movement, combat, and tasks
- ✅ **Settler automation** - Automated settler and worker units
- ✅ **Diplomacy** - Treaty evaluation, first contact, and incidents
- ✅ **Military AI** - Attack and defense coordination
- ✅ **Economic AI** - Government choices and technology research
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

The Rust AI is now **built by default** when using `prepare_freeciv.sh`:

```bash
cd /path/to/freeciv
./prepare_freeciv.sh
```

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

## Usage

Once built, the Rust AI can be selected in-game:

1. Start the Freeciv server
2. Use `/aitoggle <player> rust` to switch a player to Rust AI
3. Or set default AI: `/set aifill rust`

## Architecture

The module follows the standard Freeciv AI module pattern:

- `fc_ai_rust_capstr()` - Returns the AI module capability string
- `fc_ai_rust_setup()` - Initializes the AI module and sets up callbacks
- **43+ callback functions** - Handle various game events and decisions

### Current Implementation

The Rust AI currently acts as a **wrapper** that delegates to the Default AI (`ai/default/`):

| Category | Functions | Purpose |
|----------|-----------|---------|
| **Module** | module_close | Resource cleanup |
| **Player** | player_alloc, player_free, gained_control, etc. | Player lifecycle |
| **City** | city_alloc, city_free, choose_building, etc. | City management |
| **Unit** | unit_alloc, unit_free, unit_move, etc. | Unit control |
| **Settler** | settler_reset, settler_run, settler_cont | Automated workers |
| **Turn** | first_activities, restart_phase, last_activities | Turn phases |
| **Diplomacy** | treaty_evaluate, first_contact, incident | Diplomatic actions |
| **Build** | build_adv_init, build_adv_adjust, gov_value | Economic decisions |

## Future Development

The plan is to incrementally port the C AI logic from `ai/default/` to Rust:

1. **FFI Layer** - Create Rust FFI bindings to C game structures
2. **Incremental Porting** - Replace wrapper functions with Rust implementations
3. **Testing** - Ensure behavior matches the original AI
4. **Optimization** - Leverage Rust's performance and safety features

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
- The module maintains an `ai_type` pointer via `rust_ai_get_self()`

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
