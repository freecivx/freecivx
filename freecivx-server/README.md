# Freecivx Java Server

**freecivx-server** is a fully playable Freeciv-compatible multiplayer game server implemented in Java for [Freecivx.com](https://freecivx.com).

*"FreecivX Java server — because Freeciv should not segfault!"*

License: GNU Affero General Public License

## Current state

The server implements a complete Freeciv classic ruleset game loop:

- Full city management: workers, specialists, buildings, wonders, production queues, happiness, rapture growth, starvation, pollution, and global warming.
- Full unit management: movement, combat, goto pathfinding, transport, disbanding, upgrading, and home-city assignment.
- Technology research, government transitions (Despotism → Monarchy → Republic → Democracy), and tax/science/luxury rate management.
- Diplomacy: war, peace, ceasefire, and alliance between players.
- Diplomat and spy unit actions.
- Space Race: build spaceship parts and launch to Alpha Centauri.
- Barbarian spawning system.
- Procedural map generation and scenario loading.
- AI players with full city, settler, military, naval, diplomacy, and research strategies.
- MMO multiplayer mode (players may join at any time and resume their nation) and classic singleplayer mode.
- Turn timer with configurable timeout.
- Metaserver registration for public game listing.

## Features

- **Freeciv classic ruleset compatibility**: Ships with the full classic ruleset (terrains, units, buildings, wonders, governments, technologies, nations, effects, and actions).
- **AI players**: Computer-controlled opponents managed by `AiPlayer`, `AiCity`, `AiMilitary`, `AiSettler`, `AiDiplomacy`, and `Barbarian`.
- **Scalability**:
  - Supports many concurrent players (1,000+).
  - Handles large maps for MMO-style gameplay (up to 1,000 × 1,000 tiles).
  - Designed for long-running games where players may join at any time.
- **Modern Java**:
  - Requires **Java 21** or later.
  - Uses **virtual threads** for high concurrency and lightweight task management.
- **Protocol**:
  - **WebSockets** for real-time bidirectional communication.
  - **JSON** packets whose `pid` numbers mirror those of the original C Freeciv server.
- **Security**: Java eliminates entire classes of C vulnerabilities (memory corruption, buffer overflows, segfaults).


## Getting Started

### Prerequisites

- **Java 21** or later.
- **Maven** for building the project.

### Build and Run

```bash
# Build a self-contained fat JAR
cd freecivx-server
mvn clean package

# Run on the default port (7800 WebSocket, 7801 HTTP status)
java -jar target/freecivx-server-1.0.jar

# Run on a custom port
java -jar target/freecivx-server-1.0.jar 7900

# Or use the convenience script (logs to ../logs/freecivx-server.log)
./civserver.sh
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for a full description of the package layout, protocol design, and class reference.
