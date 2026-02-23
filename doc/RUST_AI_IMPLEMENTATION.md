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

6. **freeciv/freeciv/ai/rust/rustai.c** (modified)
   - Updated C stub implementation with Rust FFI declarations
   - Added calls to Rust functions for initialization and logging
   - Implements `fc_ai_rust_capstr()` - returns capability string
   - Implements `fc_ai_rust_setup()` - initializes AI with name "rust"
   - Implements `rust_end_turn()` - basic callback to mark turns complete

7. **freeciv/freeciv/ai/rust/Cargo.toml** (new file)
   - Rust package configuration
   - Defines staticlib crate type for C FFI
   - Specifies dependencies (libc)

8. **freeciv/freeciv/ai/rust/src/lib.rs** (new file)
   - Actual Rust implementation code
   - FFI exports for player management, tile evaluation, logging
   - Safe Rust data structures with comprehensive tests
   - Player aggression tracking and tile scoring algorithms

9. **freeciv/freeciv/ai/rust/Makefile.am** (modified)
   - Build configuration for Rust AI module
   - Integrates cargo build into autotools
   - Supports both static and dynamic linking
   - Links Rust static library with C wrapper

10. **freeciv/freeciv/meson.build** (modified)
    - Added custom target for Rust library compilation
    - Added 'ai/rust/rustai.c' to AI sources
    - Links Rust static library (librustai.a) into fc_ai library

11. **freeciv/freeciv/ai/rust/README.md** (modified)
    - Documentation for the Rust AI module
    - Explains current hybrid C/Rust implementation
    - Documents FFI exports and testing procedures

12. **scripts/install/deb.sh** (modified)
    - Added cargo and rustc to dependency list
    - Ensures Rust toolchain is installed on Debian-based systems

13. **freeciv/freeciv/ai/Makefile.am**
    - Added rust subdirectory to module_dirs for both static and dynamic builds

14. **freeciv/freeciv/configure.ac**
    - Added `AI_MOD_STATIC_RUST` configuration option
    - Added support for `--enable-ai-static=rust` configure flag
    - Added ai/rust/Makefile to AC_CONFIG_FILES

15. **freeciv/freeciv/server/aiiface.c**
    - Added extern declaration for `fc_ai_rust_setup()`
    - Added initialization code for static Rust AI module in `ai_init()`

## How to Use

### Building with Rust AI

The Rust AI is now integrated into the standard build process. The project uses Meson for building:

```bash
cd freeciv
mkdir build
cd build
meson setup ..
ninja
ninja install
```

The Rust code will be automatically compiled during the build process via the custom Meson target.

Alternatively, you can use the prepare script:

```bash
cd freeciv
./prepare_freeciv.sh
```

For manual autotools build (legacy):

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

The Rust AI now has actual Rust implementation alongside the C wrapper. Current progress:

1. **✅ Create Rust implementation foundation** 
   - ✅ Added Cargo.toml for Rust crate
   - ✅ Implemented Rust AI logic with FFI exports
   - ✅ Created FFI bindings between C and Rust
   - ✅ Integrated Rust build into Meson and Makefile.am

2. **⏳ Implement full AI callbacks in Rust**
   - Current: Most callbacks delegate to Default AI (C)
   - Next: Incrementally port callbacks to Rust
   - Goals: City management, unit movement, diplomacy, research

3. **🔄 Testing and optimization**
   - ✅ Memory safety across FFI boundary (Rust ownership)
   - ✅ Unit tests for Rust code
   - ⏳ Performance benchmarking vs C implementation
   - ⏳ Integration tests with actual gameplay

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
