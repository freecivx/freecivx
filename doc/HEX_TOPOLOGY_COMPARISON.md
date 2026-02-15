# Hex Topology (Non-Isometric) Comparison: C Server vs JavaScript Client

## Overview

This document compares the implementation of **pure hex topology** (`TF_HEX` without `TF_ISO`) between the Freeciv C server and the FreecivWorld JavaScript client. The focus is on identifying discrepancies, error sources, and recommendations for making hex topology work correctly.

> **Important Distinction**: Freeciv supports two hex variants:
> - **Iso-Hex** (`TF_HEX | TF_ISO`, topology_id = 3): Most common, server default
> - **Pure Hex** (`TF_HEX` only, topology_id = 2): Top-down view, focus of this document

---

## 1. Topology Flags

### C Server (`freeciv/freeciv/common/fc_types.h`)

```c
#define SPECENUM_VALUE0 TF_ISO  // Bit 0 = Isometric view
#define SPECENUM_VALUE1 TF_HEX  // Bit 1 = Hexagonal tiles
```

**Topology Combinations**:
| topology_id | Flags | Description |
|-------------|-------|-------------|
| 0 | None | Square tiles, overhead view |
| 1 | TF_ISO | Square tiles, isometric view |
| 2 | TF_HEX | Hex tiles, overhead (pure hex) |
| 3 | TF_ISO \| TF_HEX | Hex tiles, isometric (iso-hex) |

### JavaScript Client (`freeciv-web/.../javascript/map.js`)

```javascript
var TF_ISO = 1;  // Matches C server
var TF_HEX = 2;  // Matches C server
```

**Assessment**: ✅ **Flags match** between C and JavaScript implementations.

---

## 2. Direction System

Both implementations use an 8-direction system where 2 directions are invalid for hex topologies.

### C Server Direction Constants (`common/map.h`)

```c
enum direction8 {
  DIR8_NORTHWEST = 0,
  DIR8_NORTH = 1,
  DIR8_NORTHEAST = 2,
  DIR8_WEST = 3,
  DIR8_EAST = 4,
  DIR8_SOUTHWEST = 5,
  DIR8_SOUTH = 6,
  DIR8_SOUTHEAST = 7,
  DIR8_LAST = 8
};
```

### JavaScript Direction Constants (`map.js`)

```javascript
var DIR8_NORTHWEST = 0;
var DIR8_NORTH = 1;
var DIR8_NORTHEAST = 2;
var DIR8_WEST = 3;
var DIR8_EAST = 4;
var DIR8_SOUTHWEST = 5;
var DIR8_SOUTH = 6;
var DIR8_SOUTHEAST = 7;
var DIR8_LAST = 8;
```

**Assessment**: ✅ **Direction constants match** perfectly.

### Direction Offset Arrays

Both implementations use the same offset arrays for stepping to adjacent tiles:

#### C Server (`common/map.c`)

```c
const int DIR_DX[8] = { -1, 0, 1, -1, 1, -1, 0, 1 };
const int DIR_DY[8] = { -1, -1, -1, 0, 0, 1, 1, 1 };
```

#### JavaScript (`map.js`)

```javascript
var DIR_DX = [ -1, 0, 1, -1, 1, -1, 0, 1 ];
var DIR_DY = [ -1, -1, -1, 0, 0, 1, 1, 1 ];
```

**Direction to Offset Mapping**:
| Direction | Index | DX | DY | Visual Direction |
|-----------|-------|----|----|------------------|
| NW | 0 | -1 | -1 | ↖ |
| N  | 1 |  0 | -1 | ↑ |
| NE | 2 | +1 | -1 | ↗ |
| W  | 3 | -1 |  0 | ← |
| E  | 4 | +1 |  0 | → |
| SW | 5 | -1 | +1 | ↙ |
| S  | 6 |  0 | +1 | ↓ |
| SE | 7 | +1 | +1 | ↘ |

**Assessment**: ✅ **Offset arrays match**.

---

## 3. Direction Validity (`is_valid_dir()`)

This is where hex topology differs from square topology. Hex tiles have only 6 neighbors, not 8.

### C Server Implementation (`common/map.c`)

```c
static bool is_valid_dir_calculate(enum direction8 dir)
{
  switch (dir) {
  case DIR8_SOUTHEAST:
  case DIR8_NORTHWEST:
    /* These directions are invalid in hex topologies. */
    return !(current_topo_has_flag(TF_HEX) && !current_topo_has_flag(TF_ISO));
  case DIR8_NORTHEAST:
  case DIR8_SOUTHWEST:
    /* These directions are invalid in iso-hex topologies. */
    return !(current_topo_has_flag(TF_HEX) && current_topo_has_flag(TF_ISO));
  case DIR8_NORTH:
  case DIR8_EAST:
  case DIR8_SOUTH:
  case DIR8_WEST:
    return TRUE;
  default:
    return FALSE;
  }
}
```

### JavaScript Implementation (`map.js`)

```javascript
function is_valid_dir(dir)
{
  switch (dir) {
  case DIR8_SOUTHEAST:
  case DIR8_NORTHWEST:
    /* These directions are invalid in pure hex topologies. */
    return !(topo_has_flag(TF_HEX) && !topo_has_flag(TF_ISO));
  case DIR8_NORTHEAST:
  case DIR8_SOUTHWEST:
    /* These directions are invalid in iso-hex topologies. */
    return !(topo_has_flag(TF_HEX) && topo_has_flag(TF_ISO));
  case DIR8_NORTH:
  case DIR8_EAST:
  case DIR8_SOUTH:
  case DIR8_WEST:
    return true;
  default:
    return false;
  }
}
```

### Valid Directions Summary

| Topology | Invalid Directions | Valid Directions (6) |
|----------|-------------------|----------------------|
| **Pure Hex** (TF_HEX only) | NW, SE | N, NE, E, W, SW, S |
| **Iso-Hex** (TF_HEX \| TF_ISO) | NE, SW | N, E, W, S, NW, SE |

**Assessment**: ✅ **Logic matches** between C and JavaScript after PR #289 fix.

---

## 4. Cardinal Directions (`is_cardinal_dir()`)

Cardinal directions are those where tiles share an edge (not just a vertex). In hex topologies, all 6 valid directions are cardinal.

### C Server Implementation

```c
static bool is_cardinal_dir_calculate(enum direction8 dir)
{
  switch (dir) {
  case DIR8_NORTH:
  case DIR8_SOUTH:
  case DIR8_EAST:
  case DIR8_WEST:
    return TRUE;
  case DIR8_SOUTHEAST:
  case DIR8_NORTHWEST:
    /* These directions are cardinal in iso-hex topologies. */
    return current_topo_has_flag(TF_HEX) && current_topo_has_flag(TF_ISO);
  case DIR8_NORTHEAST:
  case DIR8_SOUTHWEST:
    /* These directions are cardinal in hexagonal topologies. */
    return current_topo_has_flag(TF_HEX) && !current_topo_has_flag(TF_ISO);
  }
  return FALSE;
}
```

### JavaScript Implementation

```javascript
function is_cardinal_dir(dir)
{
  switch (dir) {
  case DIR8_NORTH:
  case DIR8_SOUTH:
  case DIR8_EAST:
  case DIR8_WEST:
    return true;
  case DIR8_SOUTHEAST:
  case DIR8_NORTHWEST:
    /* These directions are cardinal in iso-hex topologies. */
    return topo_has_flag(TF_HEX) && topo_has_flag(TF_ISO);
  case DIR8_NORTHEAST:
  case DIR8_SOUTHWEST:
    /* These directions are cardinal in pure hex topologies. */
    return topo_has_flag(TF_HEX) && !topo_has_flag(TF_ISO);
  default:
    return false;
  }
}
```

**Assessment**: ✅ **Logic matches** after PR #289 fix.

---

## 5. Distance Calculations

Distance calculations differ significantly between square and hex topologies.

### C Server (`common/map.c`)

```c
int map_vector_to_real_distance(int dx, int dy)
{
  const int absdx = abs(dx), absdy = abs(dy);

  if (current_topo_has_flag(TF_HEX)) {
    if (current_topo_has_flag(TF_ISO)) {
      /* Iso-hex: you can't move NE or SW. */
      if ((dx < 0 && dy > 0) || (dx > 0 && dy < 0)) {
        return absdx + absdy;
      } else {
        return MAX(absdx, absdy);
      }
    } else {
      /* Pure hex: you can't move SE or NW. */
      if ((dx > 0 && dy > 0) || (dx < 0 && dy < 0)) {
        return absdx + absdy;
      } else {
        return MAX(absdx, absdy);
      }
    }
  } else {
    return MAX(absdx, absdy);
  }
}
```

### JavaScript (`map.js`)

```javascript
function map_vector_to_distance(dx, dy)
{
  if (topo_has_flag(TF_HEX)) {
    if (topo_has_flag(TF_ISO)) {
      // Iso-hex
      if ((dx < 0 && dy > 0) || (dx > 0 && dy < 0)) {
        return Math.abs(dx) + Math.abs(dy);
      } else {
        return Math.max(Math.abs(dx), Math.abs(dy));
      }
    } else {
      // Pure hex
      if ((dx > 0 && dy > 0) || (dx < 0 && dy < 0)) {
        return Math.abs(dx) + Math.abs(dy);
      } else {
        return Math.max(Math.abs(dx), Math.abs(dy));
      }
    }
  } else {
    return Math.max(Math.abs(dx), Math.abs(dy));
  }
}
```

**Assessment**: ✅ **Logic matches** between C and JavaScript.

---

## 6. Historical Error Sources (From Recent PRs)

### PR #288: "Fix hexagonal map movement directions and numpad controls"

**Problem**: `is_valid_dir()` had incorrect logic blocking N/S instead of the correct directions for hex mode.

**Root Cause**: Original JavaScript code unconditionally blocked N/S directions for all hex maps, when it should have blocked:
- NW/SE for pure hex
- NE/SW for iso-hex

**Impact**: Numpad movement was rotated - pressing 6 (east) moved units southeast.

---

### PR #289: "Fix hex topology direction validation to match C server"

**Problem**: After PR #288, directions were still incorrectly validated.

**Root Cause**: The condition logic was inverted. Code was checking for wrong topology flag combinations.

**Fix Applied**:
```javascript
// Before (wrong): blocked NE/SW in iso-hex, allowed N/S
case DIR8_NORTH:
case DIR8_SOUTH:
  return false;  // Always blocked N/S

// After (correct): mirrors C server
case DIR8_NORTHEAST:
case DIR8_SOUTHWEST:
  return !(topo_has_flag(TF_HEX) && topo_has_flag(TF_ISO));
case DIR8_SOUTHEAST:
case DIR8_NORTHWEST:
  return !(topo_has_flag(TF_HEX) && !topo_has_flag(TF_ISO));
```

---

### PR #291: "Revert 6-way hex direction changes in map.js"

**Problem**: An earlier commit attempted to reduce the direction system from 8 to 6 directions for hex maps.

**Root Cause**: Changing `DIR8_LAST` from 8 to 6 and removing N/S constants broke the indexing of `DIR_DX`/`DIR_DY` arrays.

**Lesson Learned**: The correct approach is to keep all 8 directions defined and filter invalid ones via `is_valid_dir()`, not to remove direction constants.

---

### PR #341 & #343: "Enforce hex-only topology" and "Revert"

**Problem**: Attempted to enforce hex-only topology but was reverted.

**Root Cause**: The change was too broad and broke existing functionality. The JavaScript client still needs to support multiple topologies for compatibility with the C server.

---

## 7. Identified Discrepancies and Potential Issues

### 7.1 ✅ Direction System - RESOLVED

The direction validation logic now matches between C and JavaScript after PR #289.

### 7.2 ⚠️ Coordinate System Rendering

**Issue**: The JavaScript 3D renderer may not correctly offset rows for hex tile placement.

**C Server Expectation**: Uses offset coordinates where odd rows (or even rows) are shifted horizontally.

**Recommendation**: Verify that the WebGL/WebGPU renderer applies the correct row offset formula:
```javascript
// For pure hex (TF_HEX, !TF_ISO)
scene_x = x * hex_width + (y % 2) * (hex_width / 2);
scene_z = y * hex_height;
```

### 7.3 ⚠️ Tile Picking / Mouse Interaction

**Issue**: Mouse clicks on hex tiles require different math than square tiles.

**Recommendation**: Implement proper hex-to-pixel and pixel-to-hex conversion:
```javascript
// Pixel to hex (for mouse clicks)
function pixel_to_hex(px, py) {
  var q = (px * Math.sqrt(3)/3 - py / 3) / hex_size;
  var r = py * 2/3 / hex_size;
  return cube_to_offset(axial_to_cube(q, r));
}
```

### 7.4 ⚠️ Pathfinding and Goto

**Issue**: Pathfinding algorithms must use `is_valid_dir()` when iterating neighbors.

**Current State**: The `mapstep()` function correctly filters invalid directions.

**Recommendation**: Ensure all pathfinding loops use `map.num_valid_dirs` or check `is_valid_dir()`:
```javascript
// Correct way to iterate hex neighbors
for (var dir = 0; dir < DIR8_LAST; dir++) {
  if (is_valid_dir(dir)) {
    var neighbor = mapstep(tile, dir);
    // ... process neighbor
  }
}
```

### 7.5 ⚠️ Visual Direction Arrows

**Issue**: Movement arrows and path indicators may show 8 directions instead of 6.

**Recommendation**: Arrow sprites should only be generated for valid directions in current topology.

---

## 8. Recommendations for Making Hex Topology Work Better

### 8.1 Topology Initialization

Add explicit topology validation on game start:
```javascript
function validate_hex_topology() {
  var valid_count = 0;
  for (var dir = 0; dir < DIR8_LAST; dir++) {
    if (is_valid_dir(dir)) valid_count++;
  }
  console.log("Hex topology active: " + valid_count + " valid directions");
  console.assert(topo_has_flag(TF_HEX) ? valid_count == 6 : valid_count == 8);
}
```

### 8.2 Debug Visualization

Add debug mode to highlight valid movement directions:
```javascript
function draw_valid_directions(tile) {
  for (var dir = 0; dir < DIR8_LAST; dir++) {
    var neighbor = mapstep(tile, dir);
    if (neighbor) {
      // Valid direction - draw in green
      highlight_tile(neighbor, '#00ff00');
    }
  }
}
```

### 8.3 Consistent Use of is_valid_dir()

Audit all code that iterates over directions to ensure it checks `is_valid_dir()`:

**Files to audit**:
- `goto.js` - pathfinding logic
- `control.js` - keyboard/mouse movement
- `mapview_common.js` - tile neighbor calculations
- `borders.js` - border rendering
- `roads.js` - road connection rendering

### 8.4 Unit Tests

Add unit tests for hex direction logic:
```javascript
// Test: Pure hex (TF_HEX only) - NW and SE invalid
function test_pure_hex_directions() {
  map.topology_id = TF_HEX;
  assert(is_valid_dir(DIR8_NORTH) == true);
  assert(is_valid_dir(DIR8_NORTHEAST) == true);
  assert(is_valid_dir(DIR8_EAST) == true);
  assert(is_valid_dir(DIR8_WEST) == true);
  assert(is_valid_dir(DIR8_SOUTHWEST) == true);
  assert(is_valid_dir(DIR8_SOUTH) == true);
  assert(is_valid_dir(DIR8_NORTHWEST) == false);  // Invalid in pure hex
  assert(is_valid_dir(DIR8_SOUTHEAST) == false);  // Invalid in pure hex
}

// Test: Iso-hex (TF_HEX | TF_ISO) - NE and SW invalid  
function test_iso_hex_directions() {
  map.topology_id = TF_HEX | TF_ISO;
  assert(is_valid_dir(DIR8_NORTH) == true);
  assert(is_valid_dir(DIR8_EAST) == true);
  assert(is_valid_dir(DIR8_WEST) == true);
  assert(is_valid_dir(DIR8_SOUTH) == true);
  assert(is_valid_dir(DIR8_NORTHWEST) == true);
  assert(is_valid_dir(DIR8_SOUTHEAST) == true);
  assert(is_valid_dir(DIR8_NORTHEAST) == false);  // Invalid in iso-hex
  assert(is_valid_dir(DIR8_SOUTHWEST) == false);  // Invalid in iso-hex
}
```

---

## 9. Quick Reference: Pure Hex vs Iso-Hex

| Aspect | Pure Hex (`TF_HEX`) | Iso-Hex (`TF_HEX \| TF_ISO`) |
|--------|---------------------|------------------------------|
| topology_id | 2 | 3 |
| Invalid Directions | NW, SE | NE, SW |
| Valid Directions | N, NE, E, W, SW, S | N, E, W, S, NW, SE |
| View Angle | Top-down | Isometric |
| Server Default? | No | Yes |
| 3D Renderer Support | Limited | Primary target |

---

## 10. Conclusion

After the fixes in PR #289 and PR #291, the core direction validation logic between the C server and JavaScript client is now synchronized. The main remaining challenges for hex topology are:

1. **3D Rendering**: Ensuring hex tiles are positioned correctly with proper row offsets
2. **Mouse Interaction**: Implementing correct pixel-to-hex coordinate conversion
3. **Visual Feedback**: Updating UI elements (arrows, paths, borders) to respect 6-direction limit
4. **Testing**: Adding comprehensive tests to prevent regression

The fundamental architecture (8-direction array filtered by `is_valid_dir()`) is sound and matches the C server design. Focus should be on the rendering and interaction layers rather than the core direction logic.

---

## References

- C Server: `freeciv/freeciv/common/map.c` - Direction validation and distance calculations
- C Server: `freeciv/freeciv/common/fc_types.h` - Topology flag definitions
- JavaScript Client: `freeciv-web/src/main/webapp/javascript/map.js` - Direction and topology handling
- Related PRs: #288, #289, #291, #341, #343
- Existing Documentation: `doc/HEX_PLAN.md` - Implementation roadmap
