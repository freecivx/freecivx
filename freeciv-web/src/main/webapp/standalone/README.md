# Freeciv-web Standalone 3D Testing Environment

This directory contains the standalone testing environment for Freeciv-web's 3D rendering engine. It allows testing and development of the WebGL/Three.js rendering code without requiring a running Tomcat server or Freeciv C server.

## Overview

The standalone testing environment provides:
- Mock game data for rendering tests
- Offline operation without server dependencies
- Test scenarios for various game states
- Screenshot capture for visual validation
- Automated test execution

## Files

### Core Files

- **mock-data.js** - Mock game state data (map, tiles, units, cities, players, nations)
- **mock-server.js** - Stub implementations of server communication functions
- **renderer-bootstrap.js** - Initializes the 3D renderer in standalone mode
- **test-scenarios.js** - Test case definitions for different rendering scenarios
- **screenshot-capture.js** - Screenshot capture and saving functionality
- **test-runner.js** - Automated test execution and result reporting

### Main HTML File

The main entry point is `freeciv-web-standalone.html` located in the parent directory (`/freeciv-web/src/main/webapp/`).

## Usage

### Basic Usage

1. Open `freeciv-web-standalone.html` in a modern web browser
2. The 3D renderer will initialize with mock data
3. Use the test runner controls to execute test scenarios
4. Capture screenshots for validation

### Test Runner Controls

The test runner UI provides:
- **Run All Tests** - Executes all test scenarios sequentially
- Individual scenario buttons - Run specific test scenarios
- **Hide** - Toggle visibility of controls

### Screenshot Controls

Screenshot capture UI provides:
- **Download Screenshot** - Save current view as PNG file
- **Preview Screenshot** - Open current view in new window
- **Hide Controls** - Toggle visibility of controls

### Programmatic API

```javascript
// Load a specific test scenario
load_test_scenario('small_varied_terrain');

// Run all tests with options
run_all_tests({
  delay: 3000,        // Delay between tests in ms
  screenshots: true   // Capture screenshots
});

// Run a single test
run_single_test('cities_test', {
  screenshot: true
});

// Capture screenshot
var dataURL = capture_screenshot();

// Download screenshot
download_screenshot('my-screenshot.png');

// Get screenshot data for automation
var data = save_screenshot_data('scenario_name');
```

## Test Scenarios

### Available Scenarios

1. **Small Varied Terrain** - 40x30 map with diverse terrain types
2. **Flat Grassland** - Simple flat map for basic rendering
3. **Cities Test** - Multiple cities of various sizes
4. **Units Test** - Various units placed strategically
5. **Mountain Range** - Dramatic terrain with central mountain range

### Creating Custom Scenarios

Add new scenarios to `test-scenarios.js`:

```javascript
test_scenarios.my_scenario = {
  name: "My Scenario",
  description: "Description of what this tests",
  setup: function() {
    // Initialize mock data
    init_all_mock_data();
    
    // Customize data as needed
    // Modify map, tiles, cities, units, etc.
  }
};
```

## Technical Details

### Mock Data Structure

The mock data provides:
- **map** - Map dimensions and topology
- **tiles** - Individual tile data (terrain, height, ownership)
- **terrains** - Terrain type definitions
- **players** - Player data
- **nations** - Nation data
- **cities** - City locations and properties
- **units** - Unit positions and types
- **unit_types** - Unit type definitions

### Global Variables

The standalone environment defines these globals:
- `STANDALONE_MODE` - Flag indicating standalone operation
- `map`, `tiles` - Game map data
- `cities`, `units` - Game entities
- `players`, `nations` - Player data
- `terrains` - Terrain definitions
- `scene`, `camera`, `maprenderer` - Three.js objects

### Renderer Initialization

The renderer bootstrap process:
1. Initialize mock data
2. Load WebGL textures and models
3. Start WebGL renderer
4. Initialize map view
5. Begin render loop

## Browser Compatibility

Requires a modern browser with:
- WebGL support
- ES6 JavaScript support
- Canvas API support

Tested on:
- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Limitations

The standalone environment:
- Cannot connect to real game servers
- Does not support multiplayer features
- Has limited game logic (rendering focus)
- Cannot save/load games via server
- Uses simplified mock data

## Development

### Adding New Features

1. Add mock data to `mock-data.js` if needed
2. Add stub functions to `mock-server.js` if needed
3. Create test scenarios in `test-scenarios.js`
4. Update renderer bootstrap if initialization changes

### Debugging

Open browser developer console to see:
- Mock data initialization logs
- Renderer initialization progress
- Test execution results
- Error messages

Enable verbose logging:
```javascript
console.log("Debug info");
```

## Integration with CI/CD

For automated testing in headless browsers:

```javascript
// Run tests programmatically
var results = run_all_tests({
  delay: 2000,
  screenshots: true
});

// Access results
results.forEach(function(result) {
  console.log(result.scenario_name, result.success);
  if (result.screenshot) {
    // Process screenshot data
  }
});
```

## Troubleshooting

### Renderer Not Starting

- Check browser console for errors
- Verify WebGL is supported and enabled
- Check that Three.js is loaded properly

### Textures Not Loading

- Check network tab for 404 errors
- Verify texture paths are correct
- Ensure CORS is not blocking resources

### Blank Screen

- Wait a few seconds for initialization
- Check console for JavaScript errors
- Verify mock data initialized correctly

## Future Enhancements

Potential improvements:
- More test scenarios
- Automated visual regression testing
- Performance benchmarking
- Memory leak detection
- Shader testing
- Animation testing

## License

This software is licensed under the GNU Affero General Public License version 3.
See LICENSE.md in the root directory for details.

## Support

For issues or questions:
- Check the main Freeciv-web documentation
- Review browser console errors
- See `doc/COPILOT_STANDALONE_TESTING.md` for additional details
