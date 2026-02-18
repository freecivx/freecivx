Freeciv-web pure JavaScript server
==================================

A pure JavaScript implementation of Freeciv server-side game logic that runs entirely in the browser.

## Overview

This directory contains the JavaScript server implementation for Freeciv-web. Unlike traditional game servers that run on backend infrastructure, this "server" runs in the browser alongside the client, enabling:

- **Offline gameplay** - No network connection required
- **Standalone mode** - Play without server infrastructure
- **Local game state** - All game logic runs client-side
- **Future multiplayer** - Foundation for peer-to-peer or hybrid architectures

## Architecture

The JavaScript server is organized into modular components:

### Core Modules

| Module | Purpose | Key Functions |
|--------|---------|---------------|
| `server.js` | Main orchestration | `server_create_game()` |
| `generator.js` | Advanced map generation | `generator_create_map()`, `generator_initialize_terrain_types()` |
| `map.js` | Map interface | `server_create_map()` |
| `ruleset.js` | Game rules | `server_create_ruleset()`, `server_create_nations()` |
| `game.js` | Game state | `server_create_players()`, `server_setup_client_connection()` |
| `cities.js` | City management | `server_create_cities()` |
| `units.js` | Unit management | `server_create_units()` |
| `vision.js` | Fog of war | `server_initialize_all_vision()` |
| `ai.js` | AI behavior | `server_ai_process_turn()` |
| `nations.js` | Nation definitions | 563+ predefined nations |

### Enhanced Modules

Newly implemented modules with game features:

| Module | Purpose | Key Functions |
|--------|---------|---------------|
| `tech.js` | Technology tree | `server_create_technologies()` - 31 techs with prerequisites |
| `diplomacy.js` | Diplomatic relations | `server_declare_war()`, `server_make_peace()`, `server_form_alliance()` |
| `tile.js` | Tile operations | `server_tile_add_extra()`, `server_tile_remove_extra()`, `server_tile_set_owner()` |
| `goto.js` | Pathfinding | `server_goto_find_path()`, `server_goto_get_movement_cost()` |

## Game Features

The JavaScript server now supports:

**31 Technologies** spanning Ancient to Renaissance eras with proper prerequisite chains

**15 Unit Types** including Settlers, Workers, military units (Warriors, Phalanx, Archers, Legion, Knights, etc.), and naval units (Trireme, Caravel, Frigate)

**3 Unit Classes** - Land, Sea, Air

**5 Governments** - Anarchy, Despotism, Monarchy, Republic, Democracy

**15 City Improvements** including infrastructure (Palace, Barracks, Granary) and wonders (Great Library, Pyramids, Colossus)

**3 Specialists** - Elvis, Scientist, Taxman

**10 Terrain Resources** - Gold, Iron, Wheat, Fish, Game, Pheasant, Coal, Oasis, Peat, Gems

**Diplomacy System** with 5 states: No Contact, War, Ceasefire, Peace, Alliance

**Pathfinding** with distance calculation and simple path algorithms

**Tile Operations** for managing improvements and ownership

## Usage

### Basic Usage

```javascript
// Create a game with default settings
server_create_game();

// Create a custom game
server_create_game({
  mapWidth: 50,
  mapHeight: 40,
  numPlayers: 4
});
```

### Integration

To use the JavaScript server in your HTML page:

```html
<!-- Load all server modules -->
<script src="javascript/server/server.js"></script>
<script src="javascript/server/generator.js"></script>
<script src="javascript/server/map.js"></script>
<script src="javascript/server/ruleset.js"></script>
<script src="javascript/server/game.js"></script>
<script src="javascript/server/cities.js"></script>
<script src="javascript/server/units.js"></script>

<!-- Initialize game -->
<script>
  // Initialize client first
  game_init();
  
  // Create server-side game state
  server_create_game();
  
  // Start the game
  set_client_state(C_S_RUNNING);
</script>
```

## API Reference

### server_create_game(options)

Creates a complete game with all necessary state.

**Parameters:**
- `options.mapWidth` (number) - Map width in tiles (default: 40)
- `options.mapHeight` (number) - Map height in tiles (default: 30)
- `options.numPlayers` (number) - Number of players (default: 3)

**Example:**
```javascript
server_create_game({
  mapWidth: 60,
  mapHeight: 50,
  numPlayers: 5
});
```

### Module-Specific Functions

See [FREECIV-JAVASCRIPT-SERVER-PLAN.md](FREECIV-JAVASCRIPT-SERVER-PLAN.md) for detailed documentation of individual module functions.

## Development

### Adding New Features

1. Identify the appropriate module (or create a new one)
2. Follow the naming convention: `server_module_action()`
3. Add comprehensive logging: `console.log("[Server Module] Message")`
4. Update this README and the plan document
5. Maintain backward compatibility

### Code Style

- All server functions use `server_` prefix
- Each module has a descriptive header comment
- Functions include JSDoc-style documentation
- Console logging uses consistent format: `[Server Module] message`

### Testing

Currently tested through standalone mode:
1. Open `freeciv-web-standalone.html`
2. Verify game loads correctly
3. Check browser console for errors
4. Validate game state (map, units, cities)

## Current Status

**Phase 1: Foundation** - ✅ COMPLETED
- Core modules implemented
- Basic game state creation working
- Integrated with standalone mode

**Phase 2: Enhanced Game Features** - ✅ COMPLETED
- Expanded technology tree (31 technologies)
- Enhanced unit types (15 units, 3 classes)
- Expanded governments (5 types)
- Expanded improvements (15 buildings including wonders)
- Added specialists and terrain resources
- Implemented tile operations module
- Implemented pathfinding/goto module
- Implemented diplomacy module

**Phase 3: Integration and Testing** - 🔄 IN PROGRESS
- Testing and validation
- HTML file updates
- Bug fixes

See [FREECIV-JAVASCRIPT-SERVER-PLAN.md](FREECIV-JAVASCRIPT-SERVER-PLAN.md) for detailed roadmap.

## Migration from standalone.js

Code from `standalone.js` has been systematically moved to appropriate server modules:

| Original Function | New Location | New Function |
|-------------------|--------------|--------------|
| `create_mock_map()` | `map.js` | `server_create_map()` |
| `create_mock_ruleset()` | `ruleset.js` | `server_create_ruleset()` |
| `create_mock_players()` | `game.js` | `server_create_players()` |
| `create_mock_cities()` | `cities.js` | `server_create_cities()` |
| `create_mock_units()` | `units.js` | `server_create_units()` |
| `create_mock_server_settings()` | `game.js` | `server_create_settings()` |
| `setup_mock_client_connection()` | `game.js` | `server_setup_client_connection()` |

Old functions remain in `standalone.js` marked as `@deprecated` for backward compatibility.

## License

GNU Affero General Public License version 3 or later.

See the [LICENSE](../../../../LICENSE) file for details.

## Contributing

When contributing to the JavaScript server:

1. Follow the modular architecture
2. Maintain the `server_` naming convention
3. Add comprehensive documentation
4. Update both README.md and FREECIV-JAVASCRIPT-SERVER-PLAN.md
5. Test with standalone mode
6. Ensure backward compatibility

## Links

- [Main Freeciv-web Repository](https://github.com/freecivworld/freecivworld)
- [Implementation Plan](FREECIV-JAVASCRIPT-SERVER-PLAN.md)
- [Standalone Mode](../../freeciv-web-standalone.html)