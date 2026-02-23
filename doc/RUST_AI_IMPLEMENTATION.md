# Rust AI Integration for Freeciv - Implementation Summary

This document summarizes the changes made to integrate a Rust AI module and DEITY difficulty level into the Freeciv C server.

## Overview

This implementation adds:
1. A new DEITY difficulty level (highest difficulty, no handicaps)
2. A Rust AI module framework (currently a minimal C stub for future Rust implementation)

These are **independent, orthogonal features**:
- **Difficulty levels** (novice, easy, normal, hard, cheating, deity) apply to any AI module
- **AI modules** (classic, stub, rust, etc.) are different AI implementations

## Files Modified

### Difficulty Level Changes

1. **freeciv/freeciv/common/fc_types.h**
   - Added `AI_LEVEL_DEITY` to the `ai_level` enum (VALUE6)
   - Adjusted enum numbering for EXPERIMENTAL and AWAY in debug/non-debug builds

2. **freeciv/freeciv/ai/difficulty.c**
   - Added DEITY handling in `handicap_of_skill_level()` - no handicaps
   - Added DEITY handling in `fuzzy_of_skill_level()` - 0 fuzziness (perfect decisions)
   - Added DEITY handling in `science_cost_of_skill_level()` - 100 (normal research speed)
   - Added DEITY handling in `expansionism_of_skill_level()` - 100 (normal expansion)

3. **freeciv/freeciv/server/commands.h**
   - Added `CMD_DEITY` command enum value

4. **freeciv/freeciv/server/commands.c**
   - Added "deity" command definition with help text

5. **freeciv/freeciv/server/stdinhand.c**
   - Added DEITY case to `cmd_of_level()` function to map difficulty to command

### Rust AI Module Changes

6. **freeciv/freeciv/ai/rust/rustai.c** (new file)
   - Minimal C stub implementation of Rust AI module
   - Implements `fc_ai_rust_capstr()` - returns capability string
   - Implements `fc_ai_rust_setup()` - initializes AI with name "rust"
   - Implements `rust_end_turn()` - basic callback to mark turns complete

7. **freeciv/freeciv/ai/rust/Makefile.am** (new file)
   - Build configuration for Rust AI module
   - Supports both static and dynamic linking

8. **freeciv/freeciv/ai/rust/README.md** (new file)
   - Documentation for the Rust AI module
   - Explains current status and future plans

9. **freeciv/freeciv/ai/Makefile.am**
   - Added rust subdirectory to module_dirs for both static and dynamic builds

10. **freeciv/freeciv/configure.ac**
    - Added `AI_MOD_STATIC_RUST` configuration option
    - Added support for `--enable-ai-static=rust` configure flag
    - Added ai/rust/Makefile to AC_CONFIG_FILES

11. **freeciv/freeciv/server/aiiface.c**
    - Added extern declaration for `fc_ai_rust_setup()`
    - Added initialization code for static Rust AI module in `ai_init()`

## How to Use

### Building with Rust AI

```bash
cd freeciv/freeciv
./autogen.sh
./configure --enable-ai-static=rust
make
```

### Setting DEITY Difficulty

In the Freeciv server console or client chat:
```
/deity                  # Set all AI players to DEITY difficulty
/deity <player-name>    # Set specific player to DEITY difficulty
```

### Combining Rust AI with DEITY Difficulty

1. Build with Rust AI enabled
2. Create or assign an AI player
3. Set the player's AI type to "rust" (if not default)
4. Set the difficulty to deity: `/deity <player-name>`

## Future Work

The current Rust AI is a minimal stub. Future work includes:

1. **Create actual Rust implementation**
   - Add Cargo.toml for Rust crate
   - Implement Rust AI logic (port from ai/classic)
   - Create FFI bindings between C and Rust

2. **Implement full AI callbacks**
   - City management
   - Unit movement and combat
   - Diplomacy
   - Research and technology
   - Economy management

3. **Testing and optimization**
   - Ensure memory safety across FFI boundary
   - Performance benchmarking
   - Integration tests

## Technical Notes

- The Rust AI follows the standard Freeciv AI module pattern
- Uses the same callback interface as classic, stub, and tex AI modules
- Currently compiled as static library (.la file)
- Can be extended to support dynamic loading (.so file)
- DEITY difficulty behaves like HARD/CHEATING but is a distinct level

## Compatibility

- Changes are backward compatible with existing AI modules
- DEITY level is a new enum value, saved games may need updating
- Network protocol updated to include new AI level (check SPECENUM versioning)
