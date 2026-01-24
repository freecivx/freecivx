# Standalone Client Plan for Freeciv-web

## Overview

This document describes the plan and implementation for the standalone renderer for Freeciv-web. The standalone client is a simplified version that can run without the full server infrastructure, useful for development, testing, and offline demonstrations.

## Goals

1. Create a standalone HTML file that can load the Freeciv-web client independently
2. Maintain compatibility with the existing build system and code patterns
3. Allow for standalone-specific customizations through a dedicated JavaScript file
4. Ensure the standalone version uses the same JavaScript build process as the main application

## Architecture

### File Structure

- **HTML Entry Point**: `/freeciv-web/src/main/webapp/freeciv-web-standalone.html`
  - Standalone HTML file that initializes the client
  - Similar structure to `index.jsp` but as a static HTML file
  - Includes all necessary CSS, JavaScript, and initialization code

- **Standalone JavaScript**: `/freeciv-web/src/main/webapp/javascript/standalone.js`
  - Contains standalone-specific initialization code
  - Handles differences between standalone and server-connected modes
  - Provides mock data or local storage capabilities if needed

- **Documentation**: `/doc/STANDALONE_CLIENT_PLAN.md` (this file)
  - Describes the architecture and implementation
  - Updated as the implementation progresses

### Integration with Existing Code

The standalone client follows the same patterns as the main application:

1. **Build System Integration**:
   - `pom.xml` includes `standalone.js` in the JavaScript minification process
   - The same Maven build produces both main and standalone JavaScript bundles
   - Follows the existing concatenation and minification pipeline

2. **Code Patterns**:
   - Uses the same initialization sequence as `index.jsp`
   - Leverages existing modules and components
   - Minimal duplication of code
   - `standalone.js` acts as an adapter layer for standalone-specific functionality

3. **Client Initialization**:
   - Based on the pattern from `webclient/index.jsp`
   - Initializes global configuration variables
   - Loads Three.js ES Module System with importmap
   - Loads the main application bundle (`webclient.min.js`)
   - Includes standalone-specific initialization from `standalone.js`

## Implementation Details

### HTML Structure (`freeciv-web-standalone.html`)

The standalone HTML file includes:
- Standard HTML5 doctype and structure
- CSS dependencies (Bootstrap, Font Awesome, webclient.min.css)
- Global configuration variables (similar to JSP variables)
- Three.js ES Module System setup with importmap
- Three.js module loader
- Main application bundle (webclient.min.js)
- Standalone-specific script (standalone.js)
- Game UI structure (pregame and game sections)

### Standalone JavaScript (`standalone.js`)

The standalone script provides:
- Standalone mode detection and initialization
- Local configuration management
- Stub implementations for server-dependent features
- Optional local storage for game state
- Development utilities and debugging aids

### Build Process

The Maven build process:
1. Copies JavaScript files to target directory
2. Minifies individual application files using Closure Compiler
3. Concatenates libraries (jQuery, Stacktrace) with minified application code
4. Includes `standalone.js` in the minification and concatenation process
5. Produces `webclient.min.js` and `webclient-app.min.js`

## Usage

### Development

For development purposes:
1. Build the project: `mvn compile`
2. Open `target/freeciv-web/freeciv-web-standalone.html` in a browser
3. The standalone client will initialize with mock data or local configuration

### Deployment

For deployment:
1. Full build: `mvn package`
2. The standalone HTML and JavaScript are included in the WAR file
3. Can be accessed at `/freeciv-web-standalone.html` when deployed

## Differences from Main Client

The standalone version differs from the main client in:

1. **No JSP Processing**: Static HTML instead of server-side rendering
2. **Hardcoded Configuration**: Configuration embedded in HTML rather than loaded from server
3. **Local Data**: May use local storage or mock data instead of server API calls
4. **Simplified Networking**: Optional WebSocket connection or mock networking layer

## Future Enhancements

Potential future improvements:
- Local game state persistence using IndexedDB
- Offline AI opponent capabilities
- Hot-reloading for development
- Scenario editor integration
- Mobile-optimized layout

## Testing

Testing approach:
1. Verify standalone HTML loads correctly
2. Check JavaScript initialization completes without errors
3. Ensure no regression in main client functionality
4. Test build process produces correct artifacts
5. Validate browser compatibility

## Status

### Completed
- ✅ Analysis of existing codebase structure
- ✅ Documentation plan created
- ✅ Implementation of standalone.js with mock data generation
- ✅ Implementation of freeciv-web-standalone.html
- ✅ Integration with build system (pom.xml)
- ✅ Added standalone mode checks to prevent network calls and login dialogs
- ✅ Created comprehensive mock data (40x30 map, 3 players, 3 cities, 4 units)
- ✅ Implemented auto-start functionality
- ✅ Added serving instructions (Python, Node.js, PHP)
- ✅ Testing and validation with Maven build
- ✅ Created development version (freeciv-web-standalone-dev.html)

### Known Issues
- ⚠️ WebGL map rendering has errors (need to initialize tileset and graphics data)
- ⚠️ Some 404 errors for missing static assets (flags, textures)
- ⚠️ Game state panel and unit info panels need mock data initialization

### Next Steps (Priority Order)

#### High Priority
1. **Fix WebGL Map Rendering**
   - Initialize tileset data for terrain rendering
   - Add mock graphics configuration (sprite positions, terrain graphics)
   - Fix "Cannot read properties of undefined (reading 'is_visible')" error in init_webgl_mapview
   - Ensure map tiles are visible on the 3D canvas

2. **Add Missing Mock Data**
   - Diplomacy states between players
   - Tech tree research progress
   - Game info (turn number, year, timeouts)
   - Calendar info for year calculation
   - Tile extras (roads, resources, bases)

3. **Improve User Experience**
   - Center camera on player's capital city on startup
   - Add initial focus to a unit for player interaction
   - Display game status panel (gold, science, turn info)
   - Show unit info panel for selected units

#### Medium Priority
4. **Add Interactivity**
   - Enable unit selection and movement (mock commands)
   - Allow tile inspection (show tile info)
   - Enable city dialog opening (read-only mode)
   - Add tech tree visualization
   - Make nations tab functional

5. **Documentation and Examples**
   - Create a tutorial/guide for extending mock data
   - Document which game features work vs. don't work in standalone
   - Add comments explaining mock data structure choices
   - Create examples of different map sizes and configurations

6. **Testing and Validation**
   - Test on different browsers (Chrome, Firefox, Safari)
   - Test on mobile devices
   - Verify no console errors after initialization
   - Performance testing with larger maps

#### Low Priority
7. **Enhanced Features**
   - Local state persistence using IndexedDB
   - Multiple save slots for different mock scenarios
   - Scenario presets (small map, large map, historical starts)
   - Screenshot/share functionality
   - Offline AI opponent simulation (basic)

8. **Developer Tools**
   - Hot-reloading for development
   - Mock data editor UI
   - Debug panel showing game state
   - Console commands for manipulating mock data

### Future Enhancements
- ⏳ Complete local game state persistence using IndexedDB
- ⏳ Offline AI opponent capabilities (requires game logic implementation)
- ⏳ Scenario editor integration
- ⏳ Mobile-optimized layout and controls
- ⏳ Progressive Web App (PWA) support for offline use
- ⏳ Unit movement and city production simulation
- ⏳ Save/load functionality for mock game states
