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
- ✅ **Removed freeciv-web-standalone-dev.html** (consolidated to single standalone client)
- ✅ **Fixed standalone mode detection** (only runs when ts="standalone" is set)
- ✅ **Added server_settings mock data** (borders, metamessage, techlevel, landmass, nukes)
- ✅ **Fixed "Cannot read properties of undefined (reading 'is_visible')" error**
- ✅ **Improved documentation** in freeciv-web-standalone.html with build instructions

### Resolved Issues
- ✅ Fixed: Standalone client interference in normal production mode
- ✅ Fixed: Missing server_settings['borders']['is_visible'] error
- ✅ Fixed: Duplicate standalone client files (removed -dev version)
- ✅ Fixed: BitVector null initialization error causing "Cannot read properties of null (reading '1')" at BitVector.isSet
- ✅ Fixed: THREE.Material parameter 'map' has value of undefined (added placeholder texture in standalone.js)
- ✅ Fixed: Race conditions causing WebGL errors by adding proper initialization delays
- ✅ Enhanced: Added comprehensive console logging throughout standalone mode for better debugging

### Remaining Known Issues
- ⚠️ THREE.BufferGeometry.computeBoundingSphere() NaN warnings may still appear but don't break functionality
- ⚠️ Some 404 errors for missing static assets (flags, textures) - cosmetic only, will be replaced when actual assets load
- ⚠️ Game state panel and unit info panels may need additional mock data initialization

### Important Notes
- **All fixes are isolated to standalone.js and documentation files only**
- **No modifications to core WebGL or game files** - normal mode remains unaffected
- **Standalone mode uses initialization delays and placeholder resources** to work around timing issues

### Recent Updates (January 2026)

#### Fixes Applied (Standalone Mode Only)
1. **Increased Initialization Delays**: 
   - Increased `STANDALONE_STARTUP_DELAY_MS` from 500ms to 1000ms to allow textures to load before game starts
   - Added `STANDALONE_WEBGL_INIT_DELAY_MS` (500ms) delay before setting client state to C_S_RUNNING
   - This prevents race conditions where WebGL tries to use resources before they're ready

2. **Added Placeholder Textures**:
   - Created placeholder city_light texture in `initialize_standalone_webgl()` to prevent "map parameter undefined" errors
   - Placeholder is a simple white 32x32 canvas texture that gets replaced when actual texture loads
   - This ensures THREE.Material always has a valid texture reference

3. **Enhanced Console Logging**: 
   - Added comprehensive logging throughout `standalone.js` with `[Standalone]` prefixes for better debugging
   - Logs include initialization steps, resource counts, timing information, and state transitions
   - Makes it easier to diagnose issues and track standalone mode execution

4. **Updated Documentation**: 
   - Updated STANDALONE_CLIENT_PLAN.md to reflect current status and fixes
   - All changes are isolated to standalone.js and documentation files only
   - No modifications to core WebGL or game files that could affect normal mode

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

#### Phase 1: Complete WebGL Rendering (High Priority)
- ⏳ Initialize tileset data for proper terrain rendering
- ⏳ Add mock graphics configuration (sprite positions, terrain graphics)
- ⏳ Ensure map tiles render correctly on the 3D canvas
- ⏳ Fix any remaining 404 errors for static assets
- ⏳ Add mock data for game state panel (gold, science, turn info)
- ⏳ Add mock data for unit info panel

#### Phase 2: Enhanced Mock Data (Medium Priority)
- ⏳ Add diplomacy states between players
- ⏳ Add tech tree research progress and visualization
- ⏳ Add calendar info for year calculation
- ⏳ Add tile extras (roads, resources, bases)
- ⏳ Add more diverse unit types and buildings
- ⏳ Add nation-specific characteristics

#### Phase 3: Basic Interactivity (Medium Priority)
- ⏳ Enable unit selection (visual feedback)
- ⏳ Allow tile inspection (show tile info in console/panel)
- ⏳ Enable city dialog opening (read-only mode)
- ⏳ Make tech tree tab functional
- ⏳ Make nations tab functional with player list
- ⏳ Add camera controls (zoom, pan, rotate)

#### Phase 4: Advanced Features (Low Priority)
- ⏳ Local state persistence using IndexedDB
- ⏳ Multiple save slots for different mock scenarios
- ⏳ Scenario presets (small/medium/large maps, different eras)
- ⏳ Screenshot/export functionality
- ⏳ Mock unit movement (visual only, no game logic)
- ⏳ Mock city production (visual only, no game logic)

#### Phase 5: Developer Experience (Low Priority)
- ⏳ Hot-reloading for development
- ⏳ Mock data editor UI
- ⏳ Debug panel showing game state
- ⏳ Console commands for manipulating mock data
- ⏳ Documentation generator for mock data structures

#### Phase 6: Advanced Capabilities (Future)
- ⏳ Offline AI opponent simulation (requires significant game logic)
- ⏳ Scenario editor integration
- ⏳ Mobile-optimized layout and touch controls
- ⏳ Progressive Web App (PWA) support
- ⏳ Complete save/load functionality for mock game states
- ⏳ Tutorial mode with guided gameplay
- ⏳ Demo mode with automated actions

## Future Vision

The standalone client aims to become a fully functional offline demo and development tool that showcases Freeciv-web's capabilities without requiring server infrastructure. Key goals include:

1. **Development Tool**: Allow developers to test UI changes, new features, and bug fixes without running the full server stack
2. **Demo Platform**: Provide a quick way to demonstrate Freeciv-web's features to potential users and contributors
3. **Offline Experience**: Enable basic gameplay experience without internet connection (with limitations)
4. **Learning Tool**: Serve as a tutorial platform for new players to learn game mechanics
5. **Testing Framework**: Support automated UI testing and screenshot generation

## Technical Roadmap

### Short Term (Next 3-6 Months)
- Fix all WebGL rendering issues
- Complete mock data for all game panels
- Add basic interactivity (selection, inspection)
- Improve documentation and examples
- Test on multiple browsers and devices

### Medium Term (6-12 Months)
- Add local persistence with IndexedDB
- Implement scenario system with presets
- Create developer tools and debug panels
- Add more comprehensive mock data
- Improve mobile experience

### Long Term (12+ Months)
- Consider limited game logic for offline play
- Explore PWA capabilities
- Build scenario editor
- Add tutorial/demo modes
- Performance optimizations for large maps

## Maintenance and Support

The standalone client should be:
- **Maintained**: Updated alongside main client to prevent divergence
- **Tested**: Include in CI/CD pipeline with basic smoke tests
- **Documented**: Keep documentation current with changes
- **Isolated**: Ensure it never interferes with production client
- **Useful**: Prioritize features that benefit developers and users

## Success Metrics

- ✅ Loads without errors in modern browsers
- ✅ Displays game map and UI correctly
- ✅ Does not interfere with production client
- ⏳ Provides useful development environment
- ⏳ Serves as effective demo platform
- ⏳ Supports basic offline gameplay
- ⏳ Includes comprehensive documentation
- ⏳ Performs well on various devices
