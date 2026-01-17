# Hexagonal Mode Implementation Summary

## Overview
This implementation adds support for hexagonal tile topology to Freeciv world 3D, following the plan outlined in `/doc/HEX_PLAN.md`.

## Changes Made

### 1. Shader Infrastructure
- **Created `shaders_hex/` directory** containing:
  - `terrain_vertex_shader.glsl` - Vertex shader for hex tiles (identical to square for now)
  - `terrain_fragment_shader.glsl` - Fragment shader with hex tile rendering support
  - `README.md` - Documentation for hex shaders

### 2. JavaScript Modules

#### Coordinate Conversion and Map Utilities
- **`maputil_hex.js`**: Hexagonal coordinate conversion functions using odd-r offset coordinate system
  - `map_to_scene_coords_hex()` - Converts map coordinates to 3D scene coordinates
  - `scene_to_map_coords_hex()` - Inverse conversion
  - `webgl_canvas_pos_to_tile_hex()` - Canvas click to hex tile
  - `convert_unit_rotation_hex()` - 6-direction rotation for hex maps

#### Camera Control
- **`camera_hex.js`**: Camera functions adapted for hexagonal layout
  - `camera_look_at_hex()` - Point camera at hex coordinates
  - `center_tile_mapcanvas_3d_hex()` - Center view on hex tile
  - `enable_mapview_slide_3d_hex()` - Smooth camera sliding for hex

#### Supporting Modules
- **`heightmap_hex.js`**: Height map generation for hex tiles (copied from square, mostly topology-agnostic)
- **`roads_hex.js`**: Road rendering stub (TODO: needs 6-way connectivity implementation)
- **`goto_hex.js`**: Movement path rendering (copied from square, needs hex adaptation)
- **`mapctrl_hex.js`**: Map controls and interaction (copied from square)
- **`object_position_handler_hex.js`**: Unit and city positioning (copied from square)

### 3. Topology Dispatch Layer
- **`topology_dispatch.js`**: Central dispatch system that routes function calls to square or hex implementations based on `use_hex_topology` flag
  - Provides topology-agnostic wrapper functions
  - Allows existing code to work without modification

### 4. Modified Files

#### mapview_webgl.js
- Added `use_hex_topology` global variable
- Added topology detection: `use_hex_topology = topo_has_flag(TF_HEX);`
- Modified shader loading to select `shaders_square/` or `shaders_hex/` based on topology
- Logs detected topology to console

#### pregame.js
- Added "Map Topology" dropdown selector with three options:
  - Square tiles (ISO) - value 0
  - Hexagonal tiles (Hex) - value 1
  - Hexagonal tiles (Iso-Hex, recommended) - value 2 (default)

#### maputil_square.js & camera_square.js
- Renamed functions to add `_square` suffix
- Updated internal function calls to use suffixed names
- Maintains backward compatibility through dispatch layer

## How It Works

### Topology Detection Flow
1. Server sends topology via `PACKET_SET_TOPOLOGY` (handled by `handle_set_topology()` in `packhand.js`)
2. Map initialization sets `map['topology_id']`
3. `webgl_start_renderer()` or `init_webgl_mapview()` checks topology with `topo_has_flag(TF_HEX)`
4. Appropriate shaders and modules are selected based on topology

### Function Dispatch
When any code calls `map_to_scene_coords()`, the dispatch layer:
1. Checks `use_hex_topology` flag
2. Routes to either `map_to_scene_coords_square()` or `map_to_scene_coords_hex()`
3. Returns appropriate result

### Hexagonal Coordinate System
Uses **odd-r offset coordinates** (as recommended in HEX_PLAN.md):
- Odd rows (y % 2 == 1) are offset by half a hex width
- Hex width = MAPVIEW_ASPECT_FACTOR * √3
- Hex height = MAPVIEW_ASPECT_FACTOR * 1.5
- Compatible with Freeciv server's internal hex topology

## Current Status

### Working
✅ Topology detection from server
✅ Shader selection based on topology
✅ Hex coordinate conversion functions
✅ UI selector for topology choice
✅ Dispatch layer for function routing
✅ Basic infrastructure in place

### TODO / Known Limitations
⚠️ **Roads**: Currently uses 8-directional square logic; needs 6-directional hex implementation
⚠️ **Goto paths**: May not render correctly on hex tiles
⚠️ **Grid lines in shader**: Currently renders square grid; needs hexagonal grid pattern
⚠️ **Unit positioning**: Copied from square, may need hex-specific adjustments
⚠️ **Testing**: Implementation has not been tested with actual running game

## Testing Recommendations

1. **Start a game with hex topology selected**:
   - In pregame settings, select "Hexagonal tiles (Iso-Hex, recommended)"
   - Start game and verify:
     - Console shows "Topology detected: Hexagonal"
     - Hex shaders are loaded
     - Map renders (even if incorrectly at first)

2. **Verify coordinate conversion**:
   - Click on tiles and verify selection works
   - Check camera centering on hex tiles
   - Test unit movement

3. **Known visual issues to expect**:
   - Grid lines will be square (not hexagonal)
   - Roads may not connect properly
   - Tile shapes may look stretched or wrong

## Next Steps

### Priority 1: Test Basic Rendering
1. Run the game with hex topology
2. Verify shaders load correctly
3. Check for JavaScript errors in console
4. Validate basic tile rendering works

### Priority 2: Fix Grid Rendering
Update `shaders_hex/terrain_fragment_shader.glsl` to render hexagonal grid lines instead of square grid (lines 174, 232, 234, 244, 341-343).

### Priority 3: Fix Roads
Implement proper 6-way road connectivity in `roads_hex.js`:
- Update neighbor calculation for hex topology
- Modify road connection logic for 6 directions
- May need new road sprites for hex tiles

### Priority 4: Geometry Generation
If tile geometry looks wrong, update `init_land_geometry()` and `update_land_geometry()` in `mapview_webgl.js` to generate hexagonal mesh geometry instead of square grid.

## Server Compatibility

The implementation is designed to work with Freeciv server's existing hex topology support:
- Server defaults to iso-hex: `MAP_DEFAULT_TOPO = (TF_ISO|TF_HEX)`
- Server validates 6 directions for hex maps (not 8)
- All game logic (movement, combat, etc.) is handled server-side
- Client only needs to render correctly and convert coordinates

## File Load Order Requirements

For the dispatch layer to work, files must be loaded in this order:
1. `mapview_webgl.js` (defines `use_hex_topology`)
2. `maputil_square.js` and `maputil_hex.js` (topology-specific implementations)
3. `camera_square.js` and `camera_hex.js` (topology-specific implementations)
4. `topology_dispatch.js` (dispatch wrappers)
5. Other webgl modules that call dispatch functions

## References

- `/doc/HEX_PLAN.md` - Original implementation plan
- Freeciv server source: `freeciv/freeciv/common/map.c` - Hex topology implementation
- Red Blob Games: Hexagonal Grids guide - https://www.redblobgames.com/grids/hexagons/
