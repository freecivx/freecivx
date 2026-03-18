# 2D Canvas Map Renderer

Classic top-down 2D map renderer for Freeciv-web, built on the HTML5 Canvas API.

## Overview

This module renders the Freeciv game map as a 2D top-down view using the **Trident** tileset
(30×30 px tiles).  It runs alongside the main 3D WebGL/WebGPU renderer and is displayed in the
**2D Map** tab of the in-game UI.

## Files

| File | Description |
|------|-------------|
| `map2d.js` | Core 2D map renderer.  Handles canvas initialisation, tile layout, multi-layer rendering, and the deferred-repaint scheduler. |
| `mapctrl2d.js` | All input handling for the 2D map canvas: mouse wheel zoom, mouse drag panning, left-click, right-click context menu, arrow-key panning, and simplified touch controls (pan, pinch-zoom, and tap to always show context menu). |
| `mapview.js` | Tileset sprite loader and cache.  Loads the active tileset image sheets via `Promise.all`, extracts individual sprite canvases into `sprites` (amplio2, used by the 3D renderer) and `sprites_2d` (trident, used by the 2D renderer). |
| `tileset_config.js` | Tileset configuration objects for **amplio2** (default, 96×48 px isometric tiles) and **trident** (30×30 px top-down tiles).  Exports the global tileset variables consumed by the rest of the client. |
| `tilespec.js` | Tileset layer constants (`LAYER_TERRAIN1` … `LAYER_COUNT`), darkness style constants, terrain-match flags, and sprite-tag helper functions (`tileset_has_tag`, `get_tileset_entry`, `tileset_unit_graphic_tag`, etc.). |

## Rendering pipeline

`render_2d_map()` is the main entry point.  It draws five ordered layers:

1. **Terrain + fog** — grassland base tile beneath every land tile; directional Trident sprites for all other terrain types; solid colour fallback when sprites are not yet loaded.
2. **Extras + territory borders** — roads, railroads, irrigation, farmland, mines, fortresses, airbase, fallout, ruins, and player-colour border overlays.
3. **City sprites** — Trident city graphics scaled to the current zoom level, using style-specific sprites based on `pcity['style']` (European, Classical, Tropical, Asian, Babylonian, Celtic, Industrial, ElectricAge, Modern, PostModern).
4. **Unit sprites + badges** — the focused unit (or the first unit) on each tile; a count badge when multiple units are stacked. Each unit tile shows:
   - **Selection indicator** (`unit.select0`) drawn behind the focused unit so it is easy to identify.
   - **Unit sprite** (Trident `units.png`) centred on the tile.
   - **Nation shield** (top-left corner).
   - **HP bar** sprite (bottom-left corner).
   - **Veteran badge** (top-right corner, only when veteran level ≥ 1).
   - **Activity sprite** (bottom-right corner) — fortify, sentry, goto, auto-explore, etc.
5. **City labels with nation flags** — always rendered last so they appear on top of everything else.

An optional subtle grid is drawn after all layers via `map2d_draw_grid()`.

All sprite draws are rendered at **+10 % brightness** (`ctx.filter = 'brightness(1.1)'`) for improved
visual clarity.  The fog-of-war black fill and label backgrounds are unaffected because
`brightness(1.1) × black = black`.

## Tilesets

| Name | Tile size | Used for |
|------|-----------|----------|
| `amplio2` | 96×48 px (isometric) | 3D renderer, city dialog, tech dialog |
| `trident` | 30×30 px (top-down) | 2D canvas renderer |

`tileset_config.js` is the single source of truth for tile dimensions.  The global
`map2d_tileset_config` always points to the trident configuration.

## Input handling

Input handling is implemented in `mapctrl2d.js` via the `init_2d_map_controls()` function.

The canvas supports:

- **Mouse-wheel** — zoom in / out (0.3× – 6×)
- **Mouse-drag** — pan the map
- **Left-click** — select unit, open city dialog, or set goto destination
- **Right-click** — context menu for tile actions
- **Arrow keys** — pan (3 tiles per key press)
- **`+` / `-`** — zoom in / out
- **Touch tap** — context menu always shown
- **Touch drag** — pan the map
- **Two-finger pinch** — zoom in / out

## Deferred rendering

Rapid server packet bursts are coalesced into a single repaint via a 60 ms timer
(`MAP2D_RENDER_DELAY_MS`).  Call `render_2d_map()` freely; redundant redraws are
automatically suppressed.

## Related modules

- `javascript/webgpu/` — WebGPU 3D renderer for hexagonal map tiles
- `javascript/webgpu_square/` — WebGPU 3D renderer for square map tiles
- `javascript/map.js` — shared map data and coordinate helpers
- `javascript/tile.js` — tile data accessors used by all renderers
