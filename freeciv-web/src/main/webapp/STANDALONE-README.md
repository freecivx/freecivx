# Freeciv Standalone Client - Developer Notes

## Overview

The standalone client is a browser-based version of Freeciv-web that runs without a server connection. It's perfect for:

- **Testing 3D rendering** without setting up the full server stack
- **UI development** with quick iteration cycles  
- **Learning the codebase** in a simplified environment
- **Debugging game mechanics** in isolation

## Quick Start

See [QUICKSTART.md](../../QUICKSTART.md) in the repository root for setup instructions.

## Key Files

| File | Purpose |
|------|---------|
| `freeciv-web-standalone.html` | Entry point HTML page |
| `javascript/standalone.js` | Mock data generation and initialization |
| `javascript/webgl/mapview_webgl.js` | 3D map rendering |
| `javascript/client_main.js` | Game loop and state management |

## Architecture

```
User opens HTML
    ↓
init_standalone() called
    ↓
Sprites/textures load (1000ms delay)
    ↓
setup_standalone_environment()
    ↓
start_standalone_game()
    ↓
create_mock_game_data()
    ├─ create_mock_map() (40x30 tiles, 9 terrain types)
    ├─ create_mock_players() (3 players: 1 human, 2 AI)
    ├─ create_mock_cities() (3 cities, 1 per player)
    ├─ create_mock_units() (4 units: settlers, warriors)
    └─ setup_mock_client_connection()
    ↓
initialize_standalone_webgl()
    ↓
WebGL init delay (500ms)
    ↓
set_client_state(C_S_RUNNING)
    ↓
Game starts!
```

## Debugging Utilities

The standalone client includes several debugging helpers accessible from the browser console:

### Print Diagnostics

```javascript
// Print comprehensive diagnostic information
standalone_print_diagnostics()

// Output:
// === STANDALONE MODE DIAGNOSTICS ===
// Mode: standalone
// Initialized: true
// Map Configuration:
//   Size: 40x30
//   Total tiles: 1200
// ...
```

### Get Diagnostics Object

```javascript
// Get diagnostics as a JavaScript object
var diag = standalone_get_diagnostics()
console.log(diag)

// Returns:
// {
//   mode: "standalone",
//   initialized: true,
//   mapSize: { width: 40, height: 30, tileCount: 1200 },
//   gameState: { tilesCreated: 1200, playersCreated: 3, ... },
//   webgl: { texturesLoaded: 15, modelsLoaded: 8, ... },
//   errors: 0,
//   warnings: 2,
//   ...
// }
```

### Reload Client

```javascript
// Quick reload (useful during development)
standalone_reload()
```

### Resize Map

```javascript
// Change map size and reload (for testing)
standalone_resize_map(60, 40)  // 60x40 map
standalone_resize_map(20, 15)  // Smaller 20x15 map
```

### Check Errors and Warnings

```javascript
// View all errors encountered
console.log(standalone_errors)

// View all warnings
console.log(standalone_warnings)
```

## Mock Data Details

### Map Generation

- **Size:** 40×30 tiles (configurable via `STANDALONE_MAP_WIDTH/HEIGHT`)
- **Terrains:** 9 types (Grassland, Ocean, Plains, Forest, Hills, Mountains, Desert, Tundra, Swamp)
- **Heights:** Procedurally generated (0-1.0 range) for 3D terrain relief
- **Ocean borders:** 2-tile border of ocean on all edges
- **Interior:** Random distribution of land terrains

### Players

| Player | Name | Nation | Type |
|--------|------|--------|------|
| 0 | You | Romans | Human |
| 1 | Cleopatra | Egyptians | AI |
| 2 | Pericles | Greeks | AI |

### Cities

| City | Owner | Size | Position |
|------|-------|------|----------|
| Rome | Player 0 | 3 | (5, 5) |
| Memphis | Player 1 | 2 | (30, 15) |
| Athens | Player 2 | 2 | (25, 20) |

### Units

| Unit | Type | Owner | Position |
|------|------|-------|----------|
| Settlers | Settlers | Player 0 | (7, 5) |
| Warriors | Warriors | Player 0 | (6, 6) |
| Warriors | Warriors | Player 1 | (31, 15) |
| Phalanx | Phalanx | Player 2 | (26, 20) |

## Timing Dependencies

⚠️ **Important:** The standalone client has timing dependencies due to asynchronous resource loading.

```javascript
// Delays currently used:
STANDALONE_STARTUP_DELAY_MS = 1000      // Wait for sprites/textures
STANDALONE_WEBGL_INIT_DELAY_MS = 500    // Wait for WebGL context/geometry
```

**Why delays exist:**
- Three.js loads 3D models asynchronously via GLTFLoader
- Textures are fetched over the network
- WebGL context and geometry buffers must be ready before rendering

**Future improvement:** Replace setTimeout delays with Promise-based initialization.

## Common Issues

### Issue: Blank screen after loading

**Causes:**
- JavaScript errors (check browser console)
- CORS restrictions (must use HTTP server, not file://)
- WebGL not supported

**Solution:**
```javascript
// Check diagnostics
standalone_print_diagnostics()

// Look for errors
console.log(standalone_errors)
```

### Issue: Missing 3D models

**Symptoms:** Console warnings about missing GLTF files

**Solution:** This is normal in standalone mode. The client handles missing models gracefully and uses fallback rendering.

### Issue: NaN tile heights

**Symptoms:** Tiles render at wrong positions, console errors

**Solution:**
```javascript
// Check tile data integrity
Object.keys(tiles).forEach(function(idx) {
  if (isNaN(tiles[idx].height)) {
    console.log("Invalid height at tile", idx);
  }
});
```

The standalone client includes automatic validation that fixes invalid heights.

### Issue: Performance problems

**Causes:**
- Large map size
- Too many 3D models
- GPU limitations

**Solution:**
```javascript
// Reduce map size for testing
standalone_resize_map(20, 15)

// Or edit standalone.js:
STANDALONE_MAP_WIDTH = 20
STANDALONE_MAP_HEIGHT = 15
```

## Development Workflow

### 1. Make Changes

Edit files in `src/main/webapp/javascript/`

### 2. Rebuild

```bash
# Quick rebuild (JavaScript only)
cd freeciv-web
./build-js.sh

# Or full rebuild
make quick  # if using Makefile.dev
```

### 3. Test

Hard refresh browser: **Ctrl+Shift+R** (or Cmd+Shift+R on Mac)

### 4. Debug

Use browser DevTools:
- **Console:** Check for errors
- **Network:** Verify asset loading
- **Sources:** Set breakpoints in JavaScript
- **Performance:** Profile rendering

## Testing Scenarios

### Scenario 1: Map Generation

```javascript
// After loading, check map data
standalone_print_diagnostics()
// Should show 1200 tiles created

// Verify terrain distribution
var terrainCounts = {}
Object.keys(tiles).forEach(function(idx) {
  var t = tiles[idx].terrain
  terrainCounts[t] = (terrainCounts[t] || 0) + 1
})
console.log(terrainCounts)
```

### Scenario 2: Player Initialization

```javascript
// Check player data
console.log(players)
// Should show 3 players

// Verify current player
console.log(client.conn.playing)
// Should be player 0 (Romans)
```

### Scenario 3: WebGL Rendering

```javascript
// Check WebGL state
standalone_print_diagnostics()
// Look at webgl.texturesLoaded and webgl.modelsLoaded

// Inspect Three.js scene
console.log(scene)          // 3D scene object
console.log(camera)         // Camera configuration
console.log(renderer)       // WebGL renderer
```

## Contributing

When making changes to standalone mode:

1. **Update documentation** if you change behavior
2. **Add error handling** for new failure modes
3. **Log important events** with `console.log("[Standalone] ...")`
4. **Test thoroughly** with `standalone_print_diagnostics()`
5. **Consider timing** - avoid race conditions

## Performance Tips

- Keep map size reasonable (40×30 is a good default)
- Limit 3D model complexity
- Use texture atlases where possible
- Profile with browser Performance tab
- Test on lower-end hardware

## Additional Resources

- **Main docs:** [QUICKSTART.md](../../QUICKSTART.md), [DEVELOPMENT.md](../../DEVELOPMENT.md)
- **Three.js docs:** https://threejs.org/docs/
- **WebGL reference:** https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API
- **Freeciv wiki:** https://freeciv.org/wiki/

## Contact

For questions or issues with the standalone client:
- Open an issue: https://github.com/freecivworld/freecivworld/issues
- See contributing guide: [CONTRIBUTING.md](../../doc/CONTRIBUTING.md)

---

**Happy developing!** 🎮
