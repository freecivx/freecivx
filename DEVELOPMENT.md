# Freeciv Standalone Client - Development Guide

This guide provides detailed information about the architecture, development workflow, and best practices for working on the Freeciv standalone client.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Module Structure](#module-structure)
3. [Build System](#build-system)
4. [Standalone Mode](#standalone-mode)
5. [Development Workflow](#development-workflow)
6. [Testing](#testing)
7. [Debugging](#debugging)
8. [Contributing](#contributing)

## Architecture Overview

### High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Client)                          │
├─────────────────────────────────────────────────────────────┤
│  freeciv-web-standalone.html (Entry Point)                  │
│  ├─ Three.js (3D Rendering via WebGL 2/WebGPU)             │
│  ├─ jQuery/jQuery UI (UI Framework)                        │
│  └─ Freeciv-web JavaScript Modules                         │
│     ├─ standalone.js (Mock Data & Initialization)          │
│     ├─ client_main.js (Game Loop)                          │
│     ├─ control.js (User Input Handling)                    │
│     ├─ mapview_webgl.js (3D Map Rendering)                 │
│     ├─ game.js (Game State Management)                     │
│     └─ ... (100+ other modules)                            │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | HTML5, JavaScript (ES5/ES6), CSS3 | User interface |
| **3D Engine** | Three.js r148+ | WebGL 2/WebGPU rendering |
| **UI Framework** | jQuery 3.x, jQuery UI | DOM manipulation, widgets |
| **Build** | Maven 3.9+, Closure Compiler | Compilation, minification |
| **Backend** | Java 17+, Jakarta Servlets, Tomcat | Web application server |
| **Database** | H2 (dev), MySQL (prod) | Persistence |
| **Testing** | Playwright | E2E browser testing |

## Module Structure

### Core JavaScript Modules

Located in `freeciv-web/src/main/webapp/javascript/`:

#### Game State
- **`game.js`** - Global game state (game_info, client, etc.)
- **`player.js`** - Player management
- **`city.js`** - City mechanics (production, improvements)
- **`unit.js`** - Unit mechanics (movement, combat)
- **`tile.js`** - Tile data structures
- **`map.js`** - Map topology and utilities

#### Rendering
- **`webgl/mapview_webgl.js`** - 3D map rendering
- **`webgl/renderer_init.js`** - WebGL initialization
- **`webgl/preload.js`** - Texture/model loading
- **`2dcanvas/mapview.js`** - 2D fallback rendering

#### Client Logic
- **`client_main.js`** - Main game loop
- **`control.js`** - Mouse/keyboard input
- **`civclient.js`** - Client initialization
- **`network.js`** - WebSocket communication (bypassed in standalone)

#### UI
- **`messagestack.js`** - Chat/messages
- **`dialogbox.js`** - Modal dialogs
- **`city_dialog.js`** - City management UI

#### Standalone
- **`standalone.js`** - **Entry point for standalone mode**

## Build System

### Maven Project Structure

```
freeciv-web/
├── pom.xml                          # Maven configuration
├── src/
│   ├── main/
│   │   ├── java/                    # Servlets, filters
│   │   ├── webapp/                  # Web content
│   │   │   ├── freeciv-web-standalone.html
│   │   │   ├── javascript/          # JS source files
│   │   │   ├── css/                 # Stylesheets
│   │   │   ├── gltf/                # 3D models
│   │   │   └── images/              # Textures, sprites
│   │   └── resources/               # Configuration
│   └── derived/                     # Generated from Freeciv C
│       └── webapp/
│           └── javascript/
│               └── packhand_gen.js  # Protocol handlers
└── target/                          # Build output
    └── freeciv-web/                 # Deployable webapp
```

### Build Commands

```bash
# Full build (requires Java 21+)
mvn clean package

# Compile only (faster, Java 17+)
mvn compile -DskipTests=true

# Skip JavaScript minification (Java 17+)
mvn compile -DskipTests=true -Dskip-minify-js=true

# JavaScript-only rebuild (development)
./build-js.sh

# Build with Flyway migrations
./build.sh
```

### Build Artifacts

| File | Location | Purpose |
|------|----------|---------|
| `webclient.min.js` | `target/freeciv-web/javascript/` | Minified JS bundle |
| `webclient.min.css` | `target/freeciv-web/css/` | Minified CSS bundle |
| `*.class` | `target/classes/` | Compiled Java servlets |

## Standalone Mode

### What Makes It "Standalone"?

The standalone client bypasses the normal Freeciv C server architecture by:

1. **Skipping network initialization** - No WebSocket connection
2. **Generating mock game data** - Procedurally creates map, players, cities, units
3. **Disabling server-side logic** - No AI turns, no multiplayer
4. **Providing view-only experience** - Limited interaction

### Initialization Flow

```javascript
// 1. HTML loads (freeciv-web-standalone.html)
$(document).ready(function() {
    init_standalone();  // Called from HTML
});

// 2. Initialize sprites and setup environment
function init_standalone() {
    standalone_mode = true;
    init_sprites();
    
    // After delay to allow assets to load
    setTimeout(function() {
        setup_standalone_environment();
        start_standalone_game();
    }, STANDALONE_STARTUP_DELAY_MS);  // 1000ms
}

// 3. Create mock game state
function start_standalone_game() {
    game_init();
    create_mock_game_data();  // ← Key function
    initialize_standalone_webgl();
    
    // After WebGL init delay
    setTimeout(function() {
        set_client_state(C_S_RUNNING);  // Start game
        advance_unit_focus();
    }, STANDALONE_WEBGL_INIT_DELAY_MS);  // 500ms
}
```

### Mock Data Generation

The `create_mock_game_data()` function in `standalone.js` creates:

| Data Structure | Count | Notes |
|----------------|-------|-------|
| **Tiles** | 1,200 (40×30) | 9 terrain types, varied heights for 3D |
| **Players** | 3 | 1 human (Romans), 2 AI (Egyptians, Greeks) |
| **Cities** | 3 | 1 per player (Rome, Memphis, Athens) |
| **Units** | 4 | Settlers, Warriors, Phalanx |
| **Terrains** | 9 | Grassland, Ocean, Plains, Forest, Hills, Mountains, Desert, Tundra, Swamp |
| **Governments** | 3 | Despotism, Monarchy, Republic |
| **Technologies** | 4 | Alphabet, Bronze Working, Pottery, The Wheel |

### Timing Dependencies

⚠️ **Critical:** Standalone mode has race conditions due to asynchronous WebGL initialization.

```javascript
// Delays needed for proper initialization:
STANDALONE_STARTUP_DELAY_MS = 1000;      // Sprite loading
STANDALONE_WEBGL_INIT_DELAY_MS = 500;    // Texture/geometry loading
```

**Why delays are needed:**
- Three.js models load asynchronously via GLTFLoader
- Textures are fetched via network requests
- Geometry buffers must be created before rendering

**Future improvement:** Replace delays with proper Promise-based initialization.

## Development Workflow

### Recommended IDE Setup

1. **VS Code Extensions:**
   - GitHub Copilot (code suggestions)
   - ESLint (JavaScript linting)
   - Debugger for Chrome (browser debugging)

2. **Browser Dev Tools:**
   - Chrome DevTools or Firefox Developer Edition
   - Enable "Disable cache (while DevTools is open)"
   - Use Console for errors, Network for asset loading

### Making Changes

#### 1. JavaScript Changes

```bash
# Edit files in src/main/webapp/javascript/
vim src/main/webapp/javascript/standalone.js

# Quick rebuild (JS only)
./build-js.sh

# Or full rebuild
mvn compile -DskipTests=true -Dskip-minify-js=true

# Refresh browser (hard refresh: Ctrl+Shift+R)
```

#### 2. HTML/CSS Changes

```bash
# Edit files in src/main/webapp/
vim src/main/webapp/freeciv-web-standalone.html

# Rebuild
mvn compile -DskipTests=true

# Refresh browser
```

#### 3. Java Servlet Changes

```bash
# Edit files in src/main/java/
vim src/main/java/org/freeciv/servlet/LoginServlet.java

# Rebuild
mvn compile

# Restart Tomcat (if using servlet container)
```

### Live Development Server

For faster iteration, use a file watcher:

```bash
# Install fswatch (macOS)
brew install fswatch

# Watch and auto-rebuild
fswatch -o src/main/webapp/javascript/ | xargs -n1 -I{} ./build-js.sh
```

Or use Maven's continuous build:

```bash
mvn compile -DskipTests=true -Dskip-minify-js=true -Dcontinuous
```

## Testing

### Manual Testing Checklist

When testing standalone client changes:

- [ ] Map renders in 3D (check browser console for WebGL errors)
- [ ] Tiles have correct terrain types and colors
- [ ] Cities are visible at correct positions
- [ ] Units appear on the map
- [ ] No JavaScript errors in console
- [ ] Performance is acceptable (60 FPS target)

### Automated Testing

Playwright tests are in `freeciv-web/tests/playwright/`:

```bash
# Install dependencies
npm install

# Run standalone test
npx playwright test standalone.test.js

# Run with UI
npx playwright test standalone.test.js --ui
```

### Adding New Tests

Example test structure:

```javascript
// freeciv-web/tests/playwright/standalone.test.js
const { test, expect } = require('@playwright/test');

test('standalone client loads', async ({ page }) => {
  await page.goto('http://localhost:8080/freeciv-web-standalone.html');
  
  // Wait for game to initialize
  await page.waitForTimeout(2000);
  
  // Check for errors
  const errors = await page.evaluate(() => {
    return window.console_errors || [];
  });
  expect(errors).toHaveLength(0);
});
```

## Debugging

### Common Debug Techniques

#### 1. Console Logging

```javascript
// Add detailed logging
console.log("[Standalone] Starting game with " + Object.keys(tiles).length + " tiles");

// Use console groups for nested logs
console.group("Mock Data Creation");
console.log("Creating players...");
create_mock_players();
console.log("Creating cities...");
create_mock_cities();
console.groupEnd();
```

#### 2. Browser Breakpoints

1. Open DevTools → Sources
2. Navigate to `standalone.js`
3. Click line number to set breakpoint
4. Refresh page to trigger

#### 3. Three.js Inspector

```javascript
// Add to global scope for debugging
window.scene = scene;
window.camera = camera;
window.renderer = renderer;

// Then in console:
scene.children  // Inspect 3D objects
```

#### 4. WebGL Debugging

Enable WebGL debugging in Chrome:
```
chrome://flags/#enable-webgl-developer-extensions
```

Use WebGL Inspector extension for detailed rendering analysis.

### Common Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **NaN heights** | Tiles render at wrong positions | Check `tiles[index].height` values in `create_mock_map()` |
| **Missing textures** | Gray/black terrain | Verify texture paths in `webgl/preload.js` |
| **Units not visible** | Console error "undefined unit type" | Check `unit_types` initialization in `create_mock_ruleset()` |
| **WebGL context lost** | Blank 3D view | Reduce geometry complexity or texture sizes |

## Contributing

### Code Style

- **JavaScript:** Follow existing style (mix of ES5/ES6)
- **Indentation:** 2 spaces (not tabs)
- **Naming:** `camelCase` for functions, `UPPER_CASE` for constants
- **Comments:** Use JSDoc-style comments for functions

Example:

```javascript
/**
 * Create mock game data for standalone mode
 * 
 * Initializes all game structures with procedurally generated data:
 * - Map tiles with varied terrain
 * - Players (human + AI)
 * - Cities and units
 * - Ruleset data (nations, technologies, governments)
 */
function create_mock_game_data() {
  // ...
}
```

### Pull Request Guidelines

1. **Small, focused changes** - One feature/fix per PR
2. **Test your changes** - Run validation script, test in browser
3. **Update documentation** - If adding features, update relevant docs
4. **Follow existing patterns** - Look at similar code for consistency
5. **Add comments** - Explain complex logic, especially timing-sensitive code

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/improve-standalone-init

# Make changes and commit
git add src/main/webapp/javascript/standalone.js
git commit -m "Fix: Remove hardcoded delays in standalone init"

# Push and create PR
git push origin feature/improve-standalone-init
```

## Performance Optimization

### Profiling

Use Chrome DevTools Performance tab:

1. Open DevTools → Performance
2. Click Record
3. Interact with game
4. Stop recording
5. Analyze flame graph for bottlenecks

### Optimization Tips

- **Reduce draw calls:** Batch similar geometry
- **Texture atlases:** Combine small textures into larger ones
- **Level of Detail (LOD):** Use simpler models at distance
- **Frustum culling:** Don't render off-screen objects
- **Lazy loading:** Load 3D models on-demand

### Memory Management

```javascript
// Dispose Three.js objects to prevent memory leaks
function dispose_webgl_resources() {
  scene.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(m => m.dispose());
      } else {
        object.material.dispose();
      }
    }
  });
}
```

## Resources

- **Freeciv Documentation:** https://freeciv.org/wiki/
- **Three.js Docs:** https://threejs.org/docs/
- **WebGL Reference:** https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API
- **Maven Guide:** https://maven.apache.org/guides/

---

**Happy coding!** For questions or issues, see [CONTRIBUTING.md](doc/CONTRIBUTING.md) or open a GitHub issue.
