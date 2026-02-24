# Rust AI Improvement Plan

## Overview

This document describes the plan and implementation for improving the Deity Rust AI for Freeciv. The AI is a standalone Rust-based client that connects to the Freeciv C server using the JSON protocol and plays the game autonomously.

**Goal**: Make the Deity Rust AI behave like the Freeciv Classic AI (the default AI implementation in the C server). This AI should replicate the decision-making, strategies, and behaviors of `freeciv/freeciv/ai/default/*` and `freeciv/freeciv/ai/classic/*`.

## Current Status

The current implementation (v0.1.0) provides:
- Basic TCP connection to Freeciv server
- JSON packet serialization/deserialization framework
- Command-line argument parsing
- Packet length-header protocol implementation
- Safety features (max packet size validation)

### Current Limitations

- **No Authentication**: Does not send join request or handle authentication
- **No Packet Handling**: All packets are logged but not processed
- **No Game State**: No internal representation of game state
- **No AI Logic**: No decision-making or gameplay capabilities
- **No Error Recovery**: No reconnection or error handling

## Goals

### Phase 1: Connection and Authentication (HIGH PRIORITY)
1. Implement proper server connection handshake
2. Add authentication packet handling
3. Handle server join request/response
4. Implement capability negotiation
5. Handle connection errors gracefully

### Phase 2: Game State Management (HIGH PRIORITY)
1. Create internal game state structures
2. Track players, cities, units, and tiles
3. Handle game info packets
4. Maintain synchronized state with server
5. Track turn progression

### Phase 3: Classic AI Decision Making (MEDIUM PRIORITY)

Replicate the behavior of Freeciv's classic/default AI found in:
- `freeciv/freeciv/ai/default/` - Core AI logic
- `freeciv/freeciv/ai/classic/` - Classic AI wrapper

Key AI modules to replicate:
1. **aihand.c** - AI handler, main turn processing
2. **daiunit.c** - Unit management and movement
3. **daicity.c** - City management and production
4. **aitech.c** - Technology research decisions
5. **daimilitary.c** - Military strategy and warfare
6. **daisettler.c** - Settler and city founding logic
7. **daidiplomacy.c** - Diplomatic relations
8. **aitools.c** - Utility functions and helpers
9. **aiferry.c** - Ferry and transport management
10. **aidiplomat.c** - Diplomat/spy operations
11. **aiair.c** - Aircraft operations
12. **aiguard.c** - Unit guarding logic
13. **aihunt.c** - Enemy hunting and pursuit
14. **aiparatrooper.c** - Paratrooper operations

### Phase 4: Advanced Classic AI Features (LOW PRIORITY)
1. **daieffects.c** - Effect evaluation for buildings
2. **daiactions.c** - Action evaluation (new actions system)
3. **daiplayer.c** - Player-level AI coordination
4. **daidata.c** - AI data structures and caching
5. **dailog.c** - AI logging and debugging
6. **daidomestic.c** - Domestic policy and improvements

### Phase 5: Robustness and Performance (ONGOING)
1. Error handling and recovery
2. Reconnection logic
3. Performance optimization
4. Logging and debugging tools
5. Configuration system

## Architecture

### Proposed Module Structure

```
src/
├── main.rs                 # Entry point, CLI, main loop
├── connection/
│   ├── mod.rs             # Connection management
│   ├── protocol.rs        # Protocol implementation
│   └── packets.rs         # Packet definitions
├── state/
│   ├── mod.rs             # Game state management
│   ├── player.rs          # Player state
│   ├── city.rs            # City state
│   ├── unit.rs            # Unit state
│   ├── tile.rs            # Tile/map state
│   └── tech.rs            # Technology state
├── ai/
│   ├── mod.rs             # AI coordinator
│   ├── strategy.rs        # Strategic planning
│   ├── tactics.rs         # Tactical decisions
│   ├── economy.rs         # Economic management
│   ├── military.rs        # Military operations
│   └── diplomacy.rs       # Diplomatic decisions
└── utils/
    ├── mod.rs             # Utility functions
    ├── logger.rs          # Logging utilities
    └── config.rs          # Configuration management
```

### Key Data Structures

#### GameState
```rust
struct GameState {
    players: HashMap<u32, Player>,
    cities: HashMap<u32, City>,
    units: HashMap<u32, Unit>,
    tiles: HashMap<(u32, u32), Tile>,
    technologies: Vec<Technology>,
    current_turn: u32,
    game_info: GameInfo,
}
```

#### Player
```rust
struct Player {
    id: u32,
    name: String,
    nation: String,
    is_alive: bool,
    gold: u32,
    science: u32,
    cities: Vec<u32>,
    units: Vec<u32>,
    researching: Option<u32>,
}
```

#### Unit
```rust
struct Unit {
    id: u32,
    owner: u32,
    type_id: u32,
    x: u32,
    y: u32,
    moves_left: u32,
    hp: u32,
    veteran_level: u32,
    activity: Activity,
}
```

#### City
```rust
struct City {
    id: u32,
    owner: u32,
    name: String,
    x: u32,
    y: u32,
    size: u32,
    production: Production,
    food_stock: u32,
    shield_stock: u32,
}
```

## Protocol Implementation

### Essential Packets (Phase 1)

Based on `freeciv/freeciv/common/networking/packets.def`:

#### Client to Server (cs)
- `PACKET_SERVER_JOIN_REQ = 4` - Initial join request
- `PACKET_AUTHENTICATION_REPLY = 7` - Authentication response
- `PACKET_NATION_SELECT_REQ = 10` - Select nation
- `PACKET_PLAYER_READY = 11` - Signal ready to start
- `PACKET_CHAT_MSG_REQ = 26` - Send chat messages
- `PACKET_PLAYER_PHASE_DONE = 52` - End turn

#### Server to Client (sc)
- `PACKET_PROCESSING_STARTED = 0` - Processing started
- `PACKET_PROCESSING_FINISHED = 1` - Processing finished
- `PACKET_SERVER_JOIN_REPLY = 5` - Join response
- `PACKET_AUTHENTICATION_REQ = 6` - Authentication request
- `PACKET_SERVER_SHUTDOWN = 8` - Server shutdown
- `PACKET_GAME_INFO = 16` - Game information
- `PACKET_MAP_INFO = 17` - Map information
- `PACKET_CHAT_MSG = 25` - Chat messages
- `PACKET_SERVER_INFO = 29` - Server information
- `PACKET_PLAYER_INFO = 51` - Player information

### Essential Packets (Phase 2)

#### Game State Packets
- `PACKET_TILE_INFO = 15` - Tile information
- `PACKET_CITY_INFO = 31` - City information
- `PACKET_CITY_REMOVE = 30` - City removed
- `PACKET_UNIT_INFO = 60` - Unit information
- `PACKET_UNIT_REMOVE = 61` - Unit removed
- `PACKET_TECH_DISCOVERED = 81` - Technology discovered

### Packet Structure

All packets follow JSON format with 2-byte big-endian length header:

```
[2 bytes: length (big-endian)] [JSON: {"pid": <packet_id>, <fields...>}]
```

Example JOIN_REQ packet:
```json
{
  "pid": 4,
  "username": "DeityRustAI",
  "capability": "+Freeciv-3.3-2024.May.01",
  "version_label": "3.3.0",
  "major_version": 3,
  "minor_version": 3,
  "patch_version": 0
}
```

## Implementation Plan

### Phase 1: Connection and Authentication

#### Step 1.1: Define Packet Structures (COMPLETED)
- [x] Create packet enum with all packet types
- [x] Implement packet serialization/deserialization
- [x] Add packet-specific data structures

#### Step 1.2: Implement Connection Handshake
- [ ] Send `PACKET_SERVER_JOIN_REQ` on connection
- [ ] Handle `PACKET_SERVER_JOIN_REPLY`
- [ ] Parse connection acceptance/rejection
- [ ] Store assigned player ID

#### Step 1.3: Implement Authentication
- [ ] Handle `PACKET_AUTHENTICATION_REQ`
- [ ] Send `PACKET_AUTHENTICATION_REPLY`
- [ ] Support different auth types (none, plain, etc.)

#### Step 1.4: Implement Nation Selection
- [ ] Receive available nations list
- [ ] Send `PACKET_NATION_SELECT_REQ`
- [ ] Confirm nation selection

#### Step 1.5: Game Start
- [ ] Send `PACKET_PLAYER_READY`
- [ ] Wait for game start
- [ ] Begin receiving game state

### Phase 2: Game State Management

#### Step 2.1: Create State Structures
- [ ] Define `GameState` with all collections
- [ ] Implement `Player`, `City`, `Unit`, `Tile` structs
- [ ] Add helper methods for state queries

#### Step 2.2: Implement Packet Handlers
- [ ] Handle `PACKET_GAME_INFO` - basic game configuration
- [ ] Handle `PACKET_MAP_INFO` - map size and topology
- [ ] Handle `PACKET_PLAYER_INFO` - player data
- [ ] Handle `PACKET_CITY_INFO` - city data
- [ ] Handle `PACKET_UNIT_INFO` - unit data
- [ ] Handle `PACKET_TILE_INFO` - tile/terrain data

#### Step 2.3: State Synchronization
- [ ] Update state on each packet
- [ ] Handle entity removal packets
- [ ] Track state changes for AI decisions

### Phase 3: Basic AI Decision Making

#### Step 3.1: Unit Management
- [ ] Implement `PACKET_UNIT_ORDERS` sending
- [ ] Basic unit movement (exploration)
- [ ] Unit actions (build city, irrigate, etc.)
- [ ] Combat decisions

#### Step 3.2: City Management
- [ ] Production queue management
- [ ] City growth optimization
- [ ] Building/unit construction decisions
- [ ] Citizen allocation

#### Step 3.3: Technology Research
- [ ] Tech tree parsing
- [ ] Research priority system
- [ ] Send tech choice packets

#### Step 3.4: Turn Management
- [ ] Process all units each turn
- [ ] Make city production decisions
- [ ] Send `PACKET_PLAYER_PHASE_DONE`

### Phase 4: Advanced AI

#### Step 4.1: Strategic Planning
- [ ] Long-term goal setting
- [ ] Resource allocation
- [ ] Expansion strategy
- [ ] Victory condition pursuit

#### Step 4.2: Military Strategy
- [ ] Threat assessment
- [ ] Army composition
- [ ] Attack/defense coordination
- [ ] City defense

#### Step 4.3: Diplomacy
- [ ] Diplomatic state tracking
- [ ] Treaty negotiation
- [ ] Alliance management
- [ ] Peace/war decisions

### Phase 5: Robustness

#### Step 5.1: Error Handling
- [ ] Connection error recovery
- [ ] Invalid packet handling
- [ ] State inconsistency detection
- [ ] Graceful degradation

#### Step 5.2: Logging and Debugging
- [ ] Structured logging system
- [ ] Debug output modes
- [ ] State dump functionality
- [ ] Performance metrics

#### Step 5.3: Configuration
- [ ] AI personality settings
- [ ] Difficulty levels
- [ ] Strategy preferences
- [ ] Configuration file support

## Dependencies

Current dependencies:
- `serde` + `serde_json` - JSON serialization
- `tokio` - Async runtime and networking
- `clap` - Command-line parsing
- `anyhow` - Error handling

Potential additions:
- `tracing` - Advanced logging
- `config` - Configuration management
- `rand` - Random number generation for AI decisions
- `petgraph` - Graph structures for tech tree

## Testing Strategy

### Unit Tests
- Packet serialization/deserialization
- State update logic
- AI decision algorithms

### Integration Tests
- Connection handshake
- Full game simulation
- Error recovery scenarios

### Manual Testing
- Connect to local Freeciv server
- Observe AI gameplay
- Test against different server versions
- Multiplayer scenarios with other AIs

## Performance Considerations

- Use `HashMap` for O(1) entity lookups
- Minimize allocations in hot paths
- Use async I/O to avoid blocking
- Consider caching frequently accessed data
- Profile and optimize bottlenecks

## Security Considerations

- Validate all incoming packet sizes
- Sanitize string inputs
- Prevent buffer overflows
- Handle malformed packets gracefully
- Rate-limit outgoing packets

## Documentation

- Code documentation (rustdoc)
- Architecture documentation
- Protocol reference
- AI strategy documentation
- User guide and examples

## Timeline Estimates

### Phase 1: 2-3 weeks
- Connection and authentication
- Basic packet handling
- Initial testing

### Phase 2: 3-4 weeks
- Complete state management
- All essential packet types
- State synchronization

### Phase 3: 4-6 weeks
- Basic AI logic for all areas
- Turn-based gameplay
- Functional but simple AI

### Phase 4: 6-8 weeks
- Advanced strategies
- Optimization
- Competitive AI

### Phase 5: Ongoing
- Bug fixes
- Performance tuning
- Feature additions

## Success Metrics

### Phase 1 Success
- ✅ Connects to server successfully
- ✅ Completes authentication
- ✅ Joins game as player
- ✅ Receives initial game state

### Phase 2 Success
- ✅ Maintains synchronized game state
- ✅ Tracks all players, cities, units
- ✅ Updates state each turn
- ✅ No state corruption

### Phase 3 Success
- ✅ Completes full game without crashing
- ✅ Builds cities and units
- ✅ Researches technologies
- ✅ Takes reasonable actions

### Phase 4 Success
- ✅ Competitive against other AIs
- ✅ Pursues victory conditions
- ✅ Adapts to game situations
- ✅ Uses advanced strategies

## Future Enhancements

- Machine learning integration
- Multi-threading for parallel decisions
- Support for multiple simultaneous games
- Replay analysis and learning
- Tournament mode
- Custom scenario support
- Integration with Freeciv-web
- REST API for external control

## References

- **Freeciv Classic AI Source**: `freeciv/freeciv/ai/default/` and `freeciv/freeciv/ai/classic/`
  - aihand.c - Main AI turn handler
  - daiunit.c - Unit AI
  - daicity.c - City AI
  - aitech.c - Technology research
  - daimilitary.c - Military strategy
  - daisettler.c - Settler and expansion
  - daidiplomacy.c - Diplomacy
  - aitools.c - Helper functions
- Freeciv Protocol: `freeciv/freeciv/common/networking/packets.def`
- Freeciv C Server: `freeciv/freeciv/server/`
- Freeciv C Client: `freeciv/freeciv/client/`
- JSON Protocol: `freeciv/freeciv/common/networking/packets_json.c`
- Freeciv Documentation: https://github.com/freeciv/freeciv

## Classic AI Behavior to Replicate

The Freeciv Classic AI (also known as "default" AI) uses several strategies:

### Turn-by-Turn Processing
1. Update AI data structures
2. Process diplomacy
3. Manage cities (production, workers)
4. Move units (military, workers, settlers)
5. Conduct warfare
6. Research technologies
7. End turn

### Unit Management
- Settlers: Found cities in strategic locations
- Workers: Improve tiles (irrigation, mines, roads)
- Military: Defend cities, attack enemies, explore
- Diplomats: Espionage and sabotage
- Ferries: Transport units across water
- Aircraft: Bombing and reconnaissance

### City Management
- Choose production based on needs (military, growth, infrastructure)
- Manage citizen allocation for optimal output
- Build improvements and wonders strategically
- Maintain happiness and prevent unrest

### Military Strategy
- Build military units based on threat assessment
- Defend cities with appropriate garrison
- Launch coordinated attacks on enemy cities
- Hunt down enemy units
- Conduct naval and air operations

### Technology Research
- Prioritize technologies based on current strategy
- Balance economic, military, and expansion techs
- Adapt research based on game state

### Diplomacy
- Form alliances with friendly nations
- Declare war when advantageous
- Negotiate peace treaties
- Share maps and technologies

## Completed Work

### Initial Implementation (v0.1.0)
- ✅ Project structure and build system
- ✅ TCP connection framework
- ✅ JSON packet protocol (length-header + JSON)
- ✅ Command-line interface
- ✅ Basic packet structure
- ✅ Safety validation (max packet size)
- ✅ Async I/O with Tokio
