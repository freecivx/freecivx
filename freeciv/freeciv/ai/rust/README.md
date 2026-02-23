# Rust AI Module for Freeciv

This directory contains the Rust AI module for Freeciv C server.

## Current Status

Currently, this is a minimal C stub implementation that serves as a foundation for 
integrating Rust AI code. The module is functional and can be loaded by the Freeciv 
server, but does not yet contain the full AI logic.

## DEITY Difficulty Level

This PR also adds the DEITY difficulty level, which is the highest difficulty 
setting with no AI handicaps. The DEITY level is independent of which AI module 
is used (classic, stub, rust, etc.) and can be applied to any AI player.

To use DEITY difficulty with the Rust AI:
1. Build the server with the Rust AI enabled (see Building section)
2. Set a player to use the Rust AI type
3. Set the difficulty level to DEITY

## Building

The Rust AI can be built statically into the Freeciv server by configuring with:

```bash
./autogen.sh
./configure --enable-ai-static=rust
make
```

## Future Development

The plan is to port the C AI logic from `freeciv/ai/classic/` to Rust, providing:

1. A Rust implementation of the AI decision-making algorithms
2. FFI bindings between C and Rust
3. Gradual replacement of C AI functions with Rust equivalents

This will allow for:
- Memory safety through Rust's ownership system
- Better maintainability and testability
- Potential performance improvements
- Easier experimentation with new AI algorithms

## Architecture

The module follows the standard Freeciv AI module pattern:

- `fc_ai_rust_capstr()`: Returns the AI module capability string
- `fc_ai_rust_setup()`: Initializes the AI module and sets up callbacks
- Callback functions: Handle various game events (turns, cities, units, etc.)

Currently, only minimal callbacks are implemented to mark player turns as complete.
