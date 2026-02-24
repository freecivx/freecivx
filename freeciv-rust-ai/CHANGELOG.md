# Changelog - Rust AI Improvements

## Version 0.2.0 - Modular Architecture (2026-02-24)

### Major Changes

#### Modular Architecture
- **Refactored AI into multiple modules** following the Freeciv C AI structure
- Created dedicated modules for different AI responsibilities:
  - `ai/mod.rs` - AI coordinator
  - `ai/aihand.rs` - Turn processing and high-level activities
  - `ai/aiunit.rs` - Unit management and movement
  - `ai/aicity.rs` - City management and production
  - `ai/aitech.rs` - Technology research
  - `ai/aitools.rs` - Utility functions

#### Turn-Based Processing
- **Implemented turn completion** - AI now sends `PACKET_PLAYER_PHASE_DONE`
- **Added turn state tracking** - `turn_started` and `turn_done` flags
- **Created AI turn processing loop** that executes in sequence:
  1. First activities (economic calculations)
  2. City management
  3. Unit management
  4. Technology selection
  5. Last activities (summary)
  6. Send turn completion packet

#### Enhanced State Management
- **Extended Unit structure** with:
  - `unit_type` - Type identifier
  - `moves_left` - Movement points remaining
  - `hp` - Hit points
- **Extended City structure** with:
  - `production_kind` - What is being produced
  - `production_value` - Production target ID
- **Added turn state methods**:
  - `start_turn()` - Mark turn as started
  - `end_turn()` - Mark turn as complete

#### Packet Handling Improvements
- **Added new packet types**:
  - `PACKET_BEGIN_TURN` - Turn start signal
  - `PACKET_END_TURN` - Turn end signal
  - `PACKET_START_PHASE` - Phase start signal
- **Enhanced packet processing**:
  - Better logging of unit and city information
  - Turn-triggered AI processing
  - Automatic turn completion

### Testing
- **Added 9 unit tests** covering:
  - Game state creation
  - Entity management (players, cities, units)
  - Ownership queries
  - Turn state transitions
- **All tests passing** ✅

### Documentation
- **Created ARCHITECTURE.md** - Comprehensive guide to the modular structure
- **Updated README.md** with new architecture details
- **Added inline documentation** in all new modules
- **Module-level comments** explaining purpose and responsibilities

### Code Quality
- Builds successfully in both debug and release modes
- Warnings only for intentional stub functions
- Clean module separation and interfaces
- Functional style with minimal side effects

### Comparison with C AI

The new structure mirrors the Freeciv C AI in `freeciv/freeciv/ai/default/`:

| Rust Module | C AI Equivalent | Status |
|-------------|-----------------|--------|
| ai/aihand.rs | aihand.c | ✅ Framework complete, stubs for details |
| ai/aiunit.rs | daiunit.c | ✅ Framework complete, stubs for details |
| ai/aicity.rs | daicity.c | ✅ Framework complete, stubs for details |
| ai/aitech.rs | aitech.c | ✅ Framework complete, stubs for details |
| ai/aitools.rs | aitools.c | ✅ Utility functions implemented |

### Next Steps

Priority areas for future development:

1. **Unit Movement** - Implement actual unit orders and movement
2. **Exploration AI** - Basic map exploration with scouts
3. **City Production** - Implement production choice algorithm
4. **Tech Selection** - Add tech value calculation and research goals
5. **Military AI** - Basic attack/defense decisions

### Breaking Changes

None - this is a structural refactoring that maintains backward compatibility with the existing protocol and behavior.

### Performance

- Release binary size: 1.8MB
- Compilation time: ~15 seconds (release mode)
- Test execution: <1 second

---

## Version 0.1.0 - Initial Implementation

### Features
- TCP connection to Freeciv server
- JSON packet protocol with length headers
- Server join and authentication
- Basic game state tracking
- Command-line interface
