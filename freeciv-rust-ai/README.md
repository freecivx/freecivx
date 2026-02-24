# Deity Rust AI

A Rust-based AI client for Freeciv that connects to the Freeciv C server using the JSON protocol.

## Overview

The Deity Rust AI is a standalone executable that connects to a running Freeciv server and plays the game autonomously. It communicates with the server using the JSON protocol defined in `freeciv/freeciv/common/networking/packets.def`.

## Building

To build the Deity Rust AI, you need Rust and Cargo installed. From this directory:

```bash
cargo build --release
```

The compiled executable will be available at `target/release/deity-rust-ai`.

## Running

To run the AI, you need a running Freeciv server. Then execute:

```bash
cargo run -- --port <PORT>
```

Or use the compiled binary:

```bash
./target/release/deity-rust-ai --port <PORT>
```

### Command-Line Options

- `--port, -p <PORT>`: Port number of the Freeciv server (default: 6000)
- `--host, -H <HOST>`: Host address of the Freeciv server (default: 127.0.0.1)
- `--username, -u <USERNAME>`: Username for the AI player (default: DeityRustAI)
- `--help`: Show help information

### Example

```bash
# Connect to a local Freeciv server on port 6000
./target/release/deity-rust-ai --port 6000

# Connect to a remote server
./target/release/deity-rust-ai --host 192.168.1.100 --port 5556 --username "MyRustAI"
```

## Architecture

The AI is structured as follows:

- **main.rs**: Entry point with command-line argument parsing and main event loop
- **packets.rs**: Packet type definitions and serialization/deserialization
- **state.rs**: Game state structures (Player, City, Unit, GameState)
- **ai/mod.rs**: AI coordinator that orchestrates all AI activities
- **ai/aihand.rs**: AI handler for turn processing and high-level activities
- **ai/aiunit.rs**: Unit management, movement, and tactics
- **ai/aicity.rs**: City management, production, and growth
- **ai/aitech.rs**: Technology research and tech tree management
- **ai/aitools.rs**: Utility functions and helpers for AI decision making

This modular structure mirrors the Freeciv C AI architecture found in `freeciv/freeciv/ai/default/`, making it easier to replicate the classic AI behavior.

## Protocol

The AI communicates with the Freeciv server using JSON-encoded packets as defined in:
`freeciv/freeciv/common/networking/packets.def`

Each packet consists of:
1. 2-byte length header (big-endian)
2. JSON-encoded packet data with a `pid` (packet ID) field

## Development Status

### Completed Features

- ✅ TCP connection to Freeciv server
- ✅ JSON packet protocol with length headers
- ✅ Packet serialization/deserialization
- ✅ Server join request/reply handling
- ✅ Authentication packet handling
- ✅ Game state tracking (players, cities, units)
- ✅ Player identification (recognizes own player ID)
- ✅ Packet type constants from packets.def
- ✅ Structured packet types for common packets
- ✅ Connection state management
- ✅ Modular AI structure (aihand, aiunit, aicity, aitech, aitools)
- ✅ Turn-based processing with PACKET_PLAYER_PHASE_DONE
- ✅ AI coordinator for orchestrating AI activities

### In Progress

- 🚧 Classic AI behavior implementation
- 🚧 Unit movement and orders
- 🚧 City management and production
- 🚧 Technology research selection
- 🚧 Diplomatic decisions

### Planned Features

- ⏳ Full game state synchronization
- ⏳ AI decision-making (based on Freeciv Classic AI)
- ⏳ Turn-based gameplay
- ⏳ Military strategy
- ⏳ Economic management
- ⏳ Diplomatic interactions

## License

This project is licensed under the GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later), consistent with the Freeciv project.
