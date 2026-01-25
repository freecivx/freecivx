Freeciv-web pure JavaScript server
==================================

Place for documenting the plan and progress of making the Freeciv pure Javascript server

## Overview

The Freeciv JavaScript server is a pure JavaScript implementation of server-side game logic that runs in the browser. It acts as a "server" for the Freeciv-web client, enabling standalone gameplay without requiring a backend server.

## Architecture

The JavaScript server is organized into several modules, each responsible for a specific aspect of game state:

### Core Modules

1. **server.js** - Main entry point and orchestration
   - `server_create_game(options)` - Creates a complete game state
   - Coordinates all other server modules

2. **map.js** - Map generation and management
   - `server_create_map(width, height)` - Creates the game map
   - `server_initialize_terrain_types()` - Sets up terrain definitions
   - `server_create_tile(x, y, index)` - Creates individual tiles
   - Handles terrain generation with varied heights for 3D rendering

3. **ruleset.js** - Game rules and definitions
   - `server_create_ruleset()` - Creates complete ruleset
   - `server_create_nations()` - Nation definitions
   - `server_create_governments()` - Government types
   - `server_create_technologies()` - Technology tree
   - `server_create_unit_types()` - Unit type definitions
   - `server_create_improvements()` - Building/improvement definitions
   - `server_create_city_styles()` - City visual styles
   - `server_create_extras()` - Terrain extras (roads, mines, etc.)

4. **game.js** - Game state and player management
   - `server_create_settings()` - Server configuration
   - `server_create_players(numPlayers)` - Player initialization
   - `server_setup_client_connection()` - Client connection setup
   - Manages game info, calendar, and player data

5. **cities.js** - City management
   - `server_create_cities()` - Creates cities for all players
   - Handles city properties, production, and tile ownership

6. **units.js** - Unit management
   - `server_create_units()` - Creates units for all players
   - Manages unit placement and properties

### Future Modules (Planned)

- **ai.js** - AI player logic
- **diplomacy.js** - Diplomatic relations
- **tech.js** - Technology research mechanics
- **tile.js** - Tile-specific operations
- **goto.js** - Pathfinding and movement
- **generator.js** - Advanced map generation algorithms

## Implementation Progress

### Phase 1: Foundation (COMPLETED)
- [x] Move map generation from standalone.js to server/map.js
- [x] Move ruleset creation from standalone.js to server/ruleset.js
- [x] Move game initialization from standalone.js to server/game.js
- [x] Move player creation from standalone.js to server/game.js
- [x] Move city creation from standalone.js to server/cities.js
- [x] Move unit creation from standalone.js to server/units.js
- [x] Create main server orchestration in server/server.js
- [x] Update standalone.js to use new server modules
- [x] Mark old standalone functions as deprecated

### Phase 2: Integration (IN PROGRESS)
- [ ] Ensure all server modules are loaded in freeciv-web-standalone.html
- [ ] Test standalone mode with new server architecture
- [ ] Validate game state creation
- [ ] Fix any compatibility issues

### Phase 3: Enhancement (PLANNED)
- [ ] Implement advanced map generation algorithms
- [ ] Add AI player decision-making
- [ ] Implement turn processing
- [ ] Add diplomatic interactions
- [ ] Implement technology research mechanics
- [ ] Add unit movement and combat logic
- [ ] Implement city production and growth

### Phase 4: Server API (PLANNED)
- [ ] Define server API for client-server communication
- [ ] Implement message handling
- [ ] Add event system for game state changes
- [ ] Create server command interface
- [ ] Implement game save/load functionality

## Usage

### Creating a Game

```javascript
// Create a game with default settings (40x30 map, 3 players)
server_create_game();

// Create a game with custom settings
server_create_game({
  mapWidth: 50,
  mapHeight: 40,
  numPlayers: 4
});
```

### Integration with Standalone Mode

The standalone mode now uses the JavaScript server:

```javascript
function create_mock_game_data() {
  server_create_game({
    mapWidth: STANDALONE_MAP_WIDTH,
    mapHeight: STANDALONE_MAP_HEIGHT,
    numPlayers: 3
  });
}
```

## Design Principles

1. **Modularity** - Each module has a specific, well-defined purpose
2. **Consistency** - All server functions use `server_` prefix
3. **Logging** - Comprehensive console logging for debugging
4. **Compatibility** - Maintains compatibility with existing client code
5. **Progressive Enhancement** - Build incrementally from standalone code
6. **No Breaking Changes** - Old standalone functions remain for backward compatibility

## Next Steps

1. Update freeciv-web-standalone.html to include all server module scripts
2. Test the new architecture thoroughly
3. Begin implementing turn processing logic
4. Add AI player behavior
5. Implement advanced game mechanics

## Notes

- The JavaScript server is not a traditional network server
- It runs entirely in the browser alongside the client
- Designed to work offline without backend infrastructure
- Can be extended to support multiplayer in the future
- All game logic will eventually migrate from standalone.js to server modules