# Hexagonal Map Tiles Implementation Plan

## Overview
This document outlines the plan for implementing support for hexagonal map tiles in FreecivWorld.net, in addition to the current square map tiles. The implementation will allow players to choose between square and hexagonal map topologies in the pregame settings.

## Current State Analysis

### Existing Topology Support

#### Server-Side (C Code in `freeciv/freeciv/`)
The Freeciv server has **full support** for hexagonal topologies:

**Topology Flags** (`common/fc_types.h`):
- `TF_ISO = 0` - Isometric view (bit 0)
- `TF_HEX = 1` - Hexagonal tiles (bit 1)
- Combined: `TF_ISO|TF_HEX = 2` - Isometric hexagonal view

**Hexagonal Topology Types**:
1. **Pure Hex** (`TF_HEX` only): Flat-top or pointy-top hexagons
2. **Iso-Hex** (`TF_ISO|TF_HEX`): Isometric view with hexagonal tiles (most common)

**Direction System** (`common/map.c`):
- Square maps use 8 directions (DIR8_NORTHWEST through DIR8_SOUTHEAST)
- Hexagonal maps use 6 valid directions:
  - **Non-iso hex**: DIR8_NORTH, EAST, SOUTH, WEST, NORTHEAST, SOUTHWEST (invalidates NW and SE)
  - **Iso-hex**: DIR8_NORTH, EAST, SOUTH, WEST, NORTHWEST, SOUTHEAST (invalidates NE and SW)
- Server dynamically calculates valid directions based on topology in `map_init_topology()`
- Cardinal directions differ between square (4) and hex (6) maps

**Key Server Functions**:
- `map_init_topology()` - Initializes valid_dirs and cardinal_dirs arrays based on topology
- `is_valid_dir_calculate()` - Determines which of the 8 directions are valid for current topology
- `is_cardinal_dir_calculate()` - Determines which directions are cardinal (edge-adjacent) for topology

**Default Topology**: `MAP_DEFAULT_TOPO = (TF_ISO|TF_HEX)` - The server defaults to iso-hex!

#### Client-Side (JavaScript in `freeciv-web/`)
The JavaScript client has **partial support** for hexagonal topologies:

**Topology Infrastructure**:
- **map.js** contains hexagonal direction constants (`DIR6_*`) and hex direction arrays (`DIR_HEX_DX`, `DIR_HEX_DY`)
- **Topology flags** exist (`TF_HEX = 2`) to indicate hexagonal maps
- **pregame.js** has topology selection dropdown that can set hex mode (topology value 1 or 2)
- **packhand.js** receives topology from server via `handle_set_topology()` packet

**What's Missing - WebGL 3D Rendering**:
The 3D WebGL renderer currently **only supports square tiles**:
- Terrain geometry is generated for rectangular grid in `heightmap_square.js`
- Shaders in `shaders_square/` directory render square tiles
- Camera, map utilities, goto, roads, and object positioning all assume square topology
- No hex-specific geometry generation or rendering code exists

## Implementation Strategy

### Approach: Separate Shader Path for Hex Tiles
Create parallel implementations for hexagonal tiles rather than modifying the existing square tile code. This approach:
- Minimizes risk of breaking existing square tile functionality
- Makes code clearer with separate concerns
- Allows for topology-specific optimizations
- Follows the existing file naming convention (`*_square.js`)

## Detailed Implementation Plan

### 1. Shader Updates

#### Option A: Create Separate Hex Shaders (RECOMMENDED)
Create new shader directory and files:
- `freeciv-web/src/main/webapp/javascript/webgl/shaders_hex/`
  - `terrain_vertex_shader.glsl` - Vertex shader for hex tiles
  - `terrain_fragment_shader.glsl` - Fragment shader for hex tiles
  - `README.md` - Documentation for hex shaders

**Key differences for hex shaders:**
- **Vertex positions**: Hexagonal grid layout (offset or axial coordinates)
- **UV mapping**: Adjust texture coordinates for hexagonal tile shape
- **Tile grid rendering**: Hexagonal grid lines instead of square (modify line 174, 232-234, 244-246, 341-343 in fragment shader)
- **Neighbor calculations**: Account for 6 neighbors instead of 8
- **Texture tiling**: Hexagons have different aspect ratio than squares

**Hex Grid Mathematics:**
- Pointy-top hexagons: width = size * √3, height = size * 2
- Flat-top hexagons: width = size * 2, height = size * √3
- Offset coordinate system (odd-r or even-r for rows)
- OR Axial/Cube coordinate system for easier neighbor calculations

**Which Hex Topology to Support?**

Based on server analysis, we should support **both hex topology variants**:

1. **Iso-Hex** (`TF_ISO | TF_HEX`, topology_id = 2 or 3):
   - Most common, server default (`MAP_DEFAULT_TOPO`)
   - Uses 6 directions: NORTH, SOUTH, EAST, WEST, NORTHWEST, SOUTHEAST
   - Isometric view angle
   - All 6 directions are cardinal (edge-adjacent)

2. **Pure Hex** (`TF_HEX` only, topology_id = 1):
   - Alternative hex layout
   - Uses 6 directions: NORTH, SOUTH, EAST, WEST, NORTHEAST, SOUTHWEST
   - Top-down view angle
   - All 6 directions are cardinal (edge-adjacent)

**Recommendation**: Start with **Iso-Hex** as it's the server default and most commonly used. Pure hex can be added later if needed, as the difference is mainly in which 6 directions are used and viewing angle.

#### Option B: Unified Shader with Topology Uniform
Extend existing shaders with topology awareness:
- Add `uniform int topology_type;` to both shaders
- Branch logic based on square vs hex topology
- More complex but single code path

**Recommendation**: Use **Option A** (separate shaders) for clarity and maintainability.

### 2. WebGL JavaScript Files

Create hexagonal equivalents of square-specific files:

#### New Files to Create:
1. **`heightmap_hex.js`**
   - Generate hexagonal tile geometry
   - Calculate vertex positions for hex grid
   - Handle height mapping for hex tiles
   - Functions: Similar to `heightmap_square.js` but adapted for hex layout

2. **`camera_hex.js`**
   - Camera positioning for hex grid
   - Convert hex tile coordinates to 3D scene coordinates
   - Function: `map_to_scene_coords_hex(x, y)` - converts hex tile to world position
   - Adjust `MAPVIEW_ASPECT_FACTOR` for hex geometry

3. **`maputil_hex.js`**
   - Hex tile coordinate utilities
   - Neighbor tile calculations (6 neighbors)
   - Distance and pathfinding helpers for hex grid
   - Functions: `hex_to_pixel()`, `pixel_to_hex()`, hex neighbor lookups

4. **`mapctrl_hex.js`**
   - Map control/interaction for hex tiles
   - Mouse picking for hex tiles
   - Selection and highlighting hex tiles

5. **`goto_hex.js`**
   - Path rendering for hex tiles
   - Movement arrows/paths on hex grid
   - Adapt goto line drawing for hex layout

6. **`roads_hex.js`**
   - Road and railroad rendering on hex tiles
   - Connection logic for 6-way hex intersections
   - Sprite positioning for hex road segments

7. **`borders_hex.js`** (if needed)
   - National border rendering on hex tiles
   - Hex edge highlighting for borders

8. **`object_position_handler_hex.js`**
   - Position units, cities, and objects on hex tiles
   - 3D model placement accounting for hex geometry

#### Modified Files:
1. **`mapview_webgl.js`**
   - Add topology detection logic
   - Load appropriate shaders based on topology (square vs hex)
   - Switch between square and hex helper modules
   - Add topology state variable: `var current_topology = TF_ISO; // or TF_HEX`
   - Modify `webgl_start_renderer()` to check topology and load correct shaders

2. **`preload.js`**
   - Load hex-specific shaders when needed
   - Conditionally preload hex vs square resources

3. **`renderer_init.js`** (if exists)
   - Initialize renderer with topology awareness

### 3. Pregame UI Changes

#### File: `freeciv-web/src/main/webapp/javascript/pregame.js`

**Add Topology Selector to Settings Dialog:**

Location: In `pregame_settings()` function, around line 498 (after generator select)

```javascript
"<tr title='Map tile topology: Square or Hexagonal tiles'><td>Map Topology:</td>" +
"<td><select name='topology' id='topology'>" +
  "<option value='0'>Square tiles (ISO)</option>" +
  "<option value='1'>Hexagonal tiles (Hex)</option>" +
  "<option value='2'>Hexagonal tiles (Iso-Hex, recommended)</option>" +
"</select></td></tr>"
```

**Topology Value Mapping**:
- **Value 0**: Square tiles with isometric view (`TF_ISO` only)
- **Value 1**: Pure hex tiles (`TF_HEX` only)
- **Value 2**: Iso-hex tiles (`TF_ISO | TF_HEX`) - **Server default**

The current code at lines 617-624 maps server topology value 2 to UI value 1, but this should be clarified to distinguish pure hex from iso-hex.

**Notes:**
- Current code at lines 617-624 already handles topology setting synchronization
- Current code at lines 732-738 already handles topology change events
- The server's `topology_id` is a bitfield, but the UI presents simple options
- Need to update the dropdown to properly expose iso-hex as the recommended option
- Server command: `/set topology HEX` sets pure hex, `/set topology ISO|HEX` sets iso-hex

**Additional UI Considerations:**
- Add tooltip: "Hexagonal tiles provide different strategy with 6-way movement. Iso-Hex is recommended as it matches the classic Civilization hex style."
- Consider adding preview images showing square vs hex tile layouts
- May need to update map size recommendations (hex maps feel different at same dimensions)
- Ensure topology cannot be changed after game starts (server enforces this)

### 4. Tile Visibility and Fog of War

**File**: `tile_visibility_handler.js`
- Should work with both topologies as it uses vertex colors
- May need minor adjustments for hex tile shapes

### 5. Texture and Sprite Considerations

- **Terrain textures**: May need hex-optimized textures to tile properly
- **Road/railroad sprites**: Need hex-compatible sprite sheets with 6-way connections
- **Border rendering**: Hex edges require different border drawing approach
- **Unit placement**: Should work with either topology

### 6. Map Coordinate System

**Important**: The Freeciv server uses **native x,y coordinates** for both square and hex maps. The same tile indexing system works for both topologies - only the interpretation differs.

**Server Coordinate System** (from `common/map.c`):
- Maps use simple x,y indexing: `tile_index = y * map.xsize + x`
- Works identically for square and hex topologies
- Direction vectors (`DIR_DX[]`, `DIR_DY[]`) handle neighbor calculations
- For hex maps, the server adjusts which direction vectors are valid

**Hexagonal Coordinate Systems for Client Rendering**:

The client must convert server's x,y coordinates to visual hex positions. Several systems exist:

1. **Offset Coordinates** (Odd-R or Even-R) - **RECOMMENDED**
   - Uses same x,y as server, just interprets differently
   - Odd rows (or even rows) are offset by half a hex width
   - Most compatible with existing code
   - Used by Freeciv server internally
   - **Odd-R**: Odd rows shifted right by 0.5 hex width
   - **Even-R**: Even rows shifted right by 0.5 hex width

2. **Axial Coordinates** (q, r)
   - Two coordinates instead of three
   - Easier neighbor calculations in some cases
   - Requires conversion to/from offset coordinates
   - Good for algorithms

3. **Cube Coordinates** (x, y, z where x+y+z=0)
   - Most elegant for hex math and distance
   - Easiest pathfinding and range calculations
   - Requires conversion to/from axial
   - Primarily useful for algorithms

**Recommendation**: Use **Offset Coordinates (Odd-R)** for client rendering:
- Server already uses this system internally
- Minimal conversion needed from server data
- Direct mapping: `server (x, y) -> client hex tile at (x, y) with row offset`
- Convert to 3D scene coordinates accounting for hex geometry

**Conversion Formula (Offset to 3D scene)**:
```javascript
// For odd-r horizontal hexagons
function hex_to_scene(x, y) {
  const hex_width = HEX_SIZE * Math.sqrt(3);  // Distance between hex centers horizontally
  const hex_height = HEX_SIZE * 1.5;           // Distance between hex centers vertically
  
  scene_x = x * hex_width + (y % 2) * (hex_width / 2);  // Offset odd rows
  scene_z = y * hex_height;
  
  return {x: scene_x, z: scene_z};
}
```

### 7. Testing Strategy

#### Unit Tests (if framework exists):
- Hex coordinate conversion functions
- Neighbor tile calculations
- Distance calculations on hex grid
- Path finding on hex grid

#### Visual/Manual Tests:
1. Create new game with hex topology selected
2. Verify terrain renders correctly
3. Test unit movement (should be 6-way instead of 8-way)
4. Test goto/pathfinding
5. Test city placement and borders
6. Test roads and railroads
7. Test fog of war
8. Test camera controls and centering
9. Test tile selection and highlighting
10. Verify map wrapping (if enabled)

### 8. Performance Considerations

- Hex tiles may have more vertices per tile than squares
- Consider level-of-detail (LOD) for distant hex tiles
- Optimize hex grid line rendering in fragment shader
- Batch similar hex tile types together for rendering efficiency

### 9. Documentation Updates

Files to update:
1. **`freeciv-web/src/main/webapp/javascript/webgl/README.md`**
   - Document hex tile support
   - Explain topology selection

2. **`doc/ADVANCED.md`** or **`doc/CONTRIBUTING.md`**
   - Developer guide for hex vs square systems
   - How to add features that work with both topologies

3. **In-game help** (if exists)
   - Explain hex vs square topology differences to players

## Implementation Phases

### Phase 1: Foundation (Hex Shader + Basic Rendering)
1. Create `shaders_hex/` directory with new shaders
2. Create `heightmap_hex.js` for hex geometry generation
3. Modify `mapview_webgl.js` to detect topology and load correct shaders
4. Get basic hex terrain rendering working (no roads, borders, or special features)

### Phase 2: Coordinate System and Map Utilities
1. Implement `maputil_hex.js` with hex coordinate functions
2. Create `camera_hex.js` for hex-aware camera controls
3. Implement `mapctrl_hex.js` for hex tile interaction
4. Test tile selection and mouse interaction

### Phase 3: Game Features
1. Implement `roads_hex.js` for road/railroad rendering
2. Implement `goto_hex.js` for movement paths
3. Create `object_position_handler_hex.js` for unit/city placement
4. Implement borders for hex tiles

### Phase 4: UI and Polish
1. Add hex topology option to pregame settings UI
2. Ensure proper synchronization with server topology setting
3. Add user guidance and tooltips
4. Test all game features with hex topology

### Phase 5: Testing and Optimization
1. Comprehensive testing of all features with hex tiles
2. Performance optimization
3. Cross-browser testing
4. Documentation updates

## Technical Challenges and Solutions

### Challenge 1: Texture Tiling on Hexagons
- **Problem**: Square textures don't tile seamlessly on hexagons
- **Solution**: Use careful UV mapping, or create hex-specific textures, or use procedural textures

### Challenge 2: Road/Railroad Connections
- **Problem**: Current road sprites are designed for 8-way connections (square tiles)
- **Solution**: Create new sprite sheet with 6-way hex road segments, or use procedural road rendering

### Challenge 3: Maintaining Two Rendering Paths
- **Problem**: Code duplication between square and hex implementations
- **Solution**: 
  - Extract common functions to shared utilities
  - Use topology-agnostic interfaces where possible
  - Consider creating a topology abstraction layer in future

### Challenge 4: Server-Client Topology Sync
- **Problem**: Ensuring client renders correctly based on server's topology setting
- **Solution**: 
  - Topology is already sent from server (see `handle_set_topology()` in packhand.js)
  - Client must reload/reinitialize WebGL when topology changes
  - Prevent topology changes after map is generated

### Challenge 5: Existing Game State
- **Problem**: Loading saved games with different topologies
- **Solution**:
  - Read topology from game state
  - Initialize correct rendering path on load
  - Consider migration path for old saves

## File Structure Overview

```
freeciv-web/src/main/webapp/javascript/webgl/
├── shaders_square/          # Existing square tile shaders
│   ├── terrain_vertex_shader.glsl
│   ├── terrain_fragment_shader.glsl
│   └── README.md
├── shaders_hex/             # NEW: Hex tile shaders
│   ├── terrain_vertex_shader.glsl
│   ├── terrain_fragment_shader.glsl
│   └── README.md
├── mapview_webgl.js         # MODIFY: Add topology detection
├── preload.js               # MODIFY: Load correct shaders
├── camera_square.js         # Existing square camera
├── camera_hex.js            # NEW: Hex camera
├── heightmap_square.js      # Existing square heightmap
├── heightmap_hex.js         # NEW: Hex heightmap
├── maputil_square.js        # Existing square utilities
├── maputil_hex.js           # NEW: Hex utilities
├── mapctrl_square.js        # Existing square controls
├── mapctrl_hex.js           # NEW: Hex controls
├── goto_square.js           # Existing square goto
├── goto_hex.js              # NEW: Hex goto
├── roads_square.js          # Existing square roads
├── roads_hex.js             # NEW: Hex roads
├── object_position_handler_square.js  # Existing
├── object_position_handler_hex.js     # NEW: Hex object positioning
└── [other shared files remain unchanged]
```

## Server-Side Considerations

The Freeciv C server (`freeciv/freeciv/`) has **complete hexagonal topology support**:

### Server Topology System

**Topology Initialization** (`common/map.c`):
1. Server sets `topology_id` which is a bitfield of topology flags
2. `map_init_topology()` is called to configure the map based on topology
3. Function dynamically populates `valid_dirs[]` and `cardinal_dirs[]` arrays
4. Different hex topologies use different subsets of the 8 possible directions

**Hex Direction Validation**:
- **Non-iso hex** (`TF_HEX` only, no `TF_ISO`):
  - Valid directions: NORTH, SOUTH, EAST, WEST, NORTHEAST, SOUTHWEST (6 total)
  - Invalidates: NORTHWEST and SOUTHEAST
  - Cardinal: All 6 directions are cardinal (edge-adjacent)

- **Iso-hex** (`TF_HEX | TF_ISO`):
  - Valid directions: NORTH, SOUTH, EAST, WEST, NORTHWEST, SOUTHEAST (6 total)
  - Invalidates: NORTHEAST and SOUTHWEST  
  - Cardinal: All 6 directions are cardinal (edge-adjacent)

**Key Insight**: The server treats hex maps as having 6-way connectivity where **all 6 directions are cardinal** (edge-adjacent). In square maps, only 4 of 8 directions are cardinal.

### Server-Client Protocol

**Topology Synchronization**:
1. Server sends topology via `PACKET_SET_TOPOLOGY` (handled by `handle_set_topology()` in `packhand.js`)
2. Client receives `topology_id` value
3. Client must initialize rendering based on received topology
4. Topology cannot change after map generation begins

**Movement and Pathfinding**:
- Server handles all movement validation using its 6-way direction system
- Server computes valid paths based on hex topology
- Client receives goto paths from server and visualizes them
- Client must convert server's direction commands to visual hex paths

### Client Responsibilities:
- Visual representation of hex tiles (WebGL geometry)
- Mouse interaction with hex tiles (raycasting, picking)
- Path visualization on hex grid (arrows, lines)
- UI/UX for hex grid (camera, controls)
- Tile highlighting and selection

### Server Responsibilities:
- Map generation with hex topology
- Unit movement rules (6-way movement)
- Pathfinding algorithms for hex grids
- Combat, visibility, and all game logic
- Sending tile data and topology to client

## Resources and References

### Freeciv Server Code Reference

Key files in `freeciv/freeciv/` for understanding hex topology:

1. **`common/fc_types.h`**:
   - Lines defining topology flags: `TF_ISO`, `TF_HEX`, `TF_WRAPX`, `TF_WRAPY`
   - Direction8 enum: `DIR8_NORTHWEST` through `DIR8_SOUTHEAST`
   - These are used in network protocol

2. **`common/map_types.h`**:
   - `struct civ_map` - contains `topology_id`, `wrap_id`, `valid_dirs[]`, `cardinal_dirs[]`
   - Map size and dimension fields

3. **`common/map.h`**:
   - `#define MAP_IS_ISOMETRIC` - checks if ISO or HEX flag is set
   - `#define ALL_DIRECTIONS_CARDINAL()` - returns true for hex maps
   - `#define MAP_DEFAULT_TOPO (TF_ISO|TF_HEX)` - server defaults to iso-hex!

4. **`common/map.c`**:
   - `map_init_topology()` - **Critical function** that sets up valid/cardinal directions
   - `is_valid_dir_calculate()` - Determines which directions are valid for topology
   - `is_cardinal_dir_calculate()` - Determines cardinal (edge-adjacent) directions
   - Direction arrays: `DIR_DX[8]`, `DIR_DY[8]`

**How Server Handles Hex**:
```c
// From common/map.c
static bool is_valid_dir_calculate(enum direction8 dir) {
  switch (dir) {
  case DIR8_SOUTHEAST:
  case DIR8_NORTHWEST:
    // Invalid in pure hex (TF_HEX without TF_ISO)
    return !(current_topo_has_flag(TF_HEX) && !current_topo_has_flag(TF_ISO));
  case DIR8_NORTHEAST:
  case DIR8_SOUTHWEST:
    // Invalid in iso-hex (TF_HEX with TF_ISO)
    return !(current_topo_has_flag(TF_HEX) && current_topo_has_flag(TF_ISO));
  case DIR8_NORTH:
  case DIR8_EAST:
  case DIR8_SOUTH:
  case DIR8_WEST:
    return TRUE;  // Always valid
  default:
    return FALSE;
  }
}
```

This shows exactly which 6 directions are used for each hex variant!

### Hexagonal Grids:
- [Red Blob Games - Hexagonal Grids](https://www.redblobgames.com/grids/hexagons/) - Comprehensive guide to hex grid math
- Amit's guide to hex coordinate systems and algorithms

### Three.js:
- [Three.js Documentation](https://threejs.org/docs/)
- Three.js BufferGeometry for custom hex tile geometry
- Three.js ShaderMaterial for custom shaders

### Freeciv:
- Freeciv supports both ISO and HEX topologies
- Freeciv-web should match Freeciv behavior

## Future Enhancements

After basic hex support is implemented:
1. **Isometric hex view**: Additional viewing angle for hex maps
2. **Hybrid rendering**: Mix hex and square in same view (not recommended)
3. **Procedural hex textures**: Generate seamless hex textures
4. **Hex-specific animations**: Units moving along hex grid
5. **Performance optimizations**: Instanced rendering for hex tiles
6. **Hex mini-map**: Overview map rendering for hex topology

## Open Questions

1. **Texture format**: Do we need new texture assets for hexagons, or can we reuse square textures?
2. **Server topology lock**: Can topology change after game starts, or is it locked at game creation?
3. **Mixed games**: Do we need to support switching topology mid-game? (Probably not)
4. **Default topology**: Should default be square (current) or give equal prominence to hex?
5. **Backward compatibility**: How do we handle old saved games or replays?

## Success Criteria

Implementation is complete when:
- [ ] Players can select hex or square topology in pregame settings
- [ ] Hex maps render correctly with proper terrain, roads, borders
- [ ] All game features work on hex maps (movement, combat, cities, etc.)
- [ ] Performance is acceptable on hex maps
- [ ] No regressions in square map functionality
- [ ] Code is well-documented and maintainable
- [ ] Both topologies are tested and stable

## Timeline Estimate

- **Phase 1 (Foundation)**: 2-3 weeks
- **Phase 2 (Coordinate System)**: 1-2 weeks  
- **Phase 3 (Game Features)**: 2-3 weeks
- **Phase 4 (UI and Polish)**: 1 week
- **Phase 5 (Testing)**: 1-2 weeks

**Total: 7-11 weeks** for full implementation by an experienced developer familiar with the codebase.

## Conclusion

Implementing hexagonal map tile support requires:
1. Creating parallel shader and rendering infrastructure for hex tiles
2. Implementing hex-specific geometry generation and coordinate systems
3. Adapting all square-specific features (roads, borders, camera, etc.) for hexagons
4. Adding user-friendly topology selection in pregame UI
5. Thorough testing of both square and hex topologies

The recommended approach is to create separate, parallel implementations (Option A) rather than trying to unify square and hex in single code paths. This makes the code clearer, more maintainable, and reduces the risk of breaking existing square tile functionality.

This plan provides a roadmap for implementing complete hexagonal map tile support in FreecivWorld.net while maintaining compatibility with existing square tile maps.
