/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2025  The Freeciv-web project

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

***********************************************************************/

/**
 * 2D Map Canvas Renderer
 *
 * Renders the Freeciv map as a classic 2D top-down view using the
 * Trident tileset sprites (30×30 px tiles).  Falls back to solid
 * colour fills when sprites are not yet available.
 *
 * Public API
 * ----------
 *  init_2d_map_canvas()  – set up canvas and input handlers (call once)
 *  render_2d_map()       – redraw the entire visible map area
 */

/* ------------------------------------------------------------------ */
/*  State                                                               */
/* ------------------------------------------------------------------ */

var map2d_center_x = 0;   /* map x-coordinate of the view centre tile */
var map2d_center_y = 0;   /* map y-coordinate of the view centre tile */
var map2d_canvas   = null;
var map2d_ctx      = null;
var map2d_initialized = false;
var map2d_zoom     = 1.0; /* zoom multiplier applied to the base tile size */

var MAP2D_MIN_ZOOM = 0.3; /* minimum zoom level */
var MAP2D_MAX_ZOOM = 6;   /* maximum zoom level */

/* Panning by mouse-drag / touch */
var map2d_drag_active = false;
var map2d_drag_start_x = 0;
var map2d_drag_start_y = 0;
var map2d_drag_center_x = 0;
var map2d_drag_center_y = 0;
var map2d_drag_moved = false;  /* true if the mouse moved during the current press */

/* Pinch-zoom state (two-finger touch) */
var map2d_pinch_start_dist = 0;
var map2d_pinch_start_zoom = 1.0;

/* Tile under the mouse cursor (for context menu) */
var map2d_mouse_tile = null;

/* Deferred render: avoids triggering dozens of redraws during packet bursts */
var map2d_render_pending = false;
var MAP2D_RENDER_DELAY_MS = 60; /* coalesce rapid packet bursts into one repaint */


/* ------------------------------------------------------------------ */
/*  Terrain → sprite-tag mapping (Trident tileset naming convention)   */
/* ------------------------------------------------------------------ */

/*
 * Trident uses directional terrain sprites for almost all terrain types.
 * Directional terrain tags follow the pattern
 * "t.l0.<terrain>_n<0|1>e<0|1>s<0|1>w<0|1>" where each flag
 * indicates whether the same terrain type lies in that direction.
 *
 * The only exception is grassland, which has a single non-directional
 * base tile "t.l0.grassland1".  This tile is drawn beneath ALL land
 * terrain overlays.  All other land terrains (plains, desert, hills,
 * mountains, arctic, forest, etc.) use directional sprites only.
 *
 * Oceanic terrains use the layer-1 naming "t.l1.coast_n…" and
 * "t.l1.floor_n…".  Both coast and floor are considered "ocean" for
 * the purpose of directional neighbor detection.
 */
var map2d_terrain_simple = {
  "grassland": true    /* only terrain with a non-directional base tile: t.l0.grassland1 */
};

/* Fallback solid colours used when sprites are missing */
var map2d_terrain_colors = {
  "grassland": "#3a7a3a",
  "plains":    "#c8b460",
  "swamp":     "#4a6b28",
  "tundra":    "#a0b4c8",
  "jungle":    "#1a6a1a",
  "hills":     "#8b7355",
  "forest":    "#1a5a1a",
  "mountains": "#888888",
  "desert":    "#d4c87a",
  "arctic":    "#e0ecf8",
  "coast":     "#4682b4",
  "floor":     "#1a3a6a"
};

/* ------------------------------------------------------------------ */
/*  Sprite-tag helpers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Returns the best matching sprite tag for the given terrain and tile,
 * trying directional variants before falling back to the simple base tag.
 */
function get_2d_terrain_sprite_tag(pterrain, ptile)
{
  var g = pterrain['graphic_str'];

  /* Simple single-sprite terrains */
  if (map2d_terrain_simple[g]) {
    return "t.l0." + g + "1";
  }

  /* Oceanic terrains use layer-1 tags.  Both coast and floor count as
   * "ocean" neighbours so the correct shoreline/transition sprite is
   * chosen regardless of whether the adjacent tile is shallow or deep. */
  if (g === "coast" || g === "floor") {
    var dir_tag = "t.l1." + g + "_n" + map2d_ocean_neighbor_flag(ptile, DIR8_NORTH)
                              + "e" + map2d_ocean_neighbor_flag(ptile, DIR8_EAST)
                              + "s" + map2d_ocean_neighbor_flag(ptile, DIR8_SOUTH)
                              + "w" + map2d_ocean_neighbor_flag(ptile, DIR8_WEST);
    if (sprites_2d_init && sprites_2d[dir_tag]) return dir_tag;
    return "t.l1." + g + "_n0e0s0w0";
  }

  /* Directional land terrains: hills, forest, mountains, desert, arctic,
   * plains, swamp, tundra, jungle — all use directional sprites in Trident */
  var base_dir = "t.l0." + g + "_n" + map2d_neighbor_flag(ptile, g, DIR8_NORTH)
                            + "e" + map2d_neighbor_flag(ptile, g, DIR8_EAST)
                            + "s" + map2d_neighbor_flag(ptile, g, DIR8_SOUTH)
                            + "w" + map2d_neighbor_flag(ptile, g, DIR8_WEST);
  if (sprites_2d_init && sprites_2d[base_dir]) return base_dir;

  /* Simplest directional variant */
  var simple_dir = "t.l0." + g + "_n0e0s0w0";
  if (sprites_2d_init && sprites_2d[simple_dir]) return simple_dir;

  /* Last resort: numbered base tag */
  return "t.l0." + g + "1";
}

/**
 * Returns 1 if the tile in direction `dir` from `ptile` has the same
 * terrain as described by `graphic_str`, 0 otherwise.
 */
function map2d_neighbor_flag(ptile, graphic_str, dir)
{
  var ntile = mapstep(ptile, dir);
  if (ntile == null) return 0;
  var nterrain = tile_terrain(ntile);
  if (nterrain == null) return 0;
  return (nterrain['graphic_str'] === graphic_str) ? 1 : 0;
}

/**
 * Returns 1 if the tile in direction `dir` from `ptile` is any ocean
 * terrain (coast or floor), 0 otherwise.  Used for the directional
 * neighbour flags of ocean tiles so that coast↔floor transitions are
 * handled correctly.
 */
function map2d_ocean_neighbor_flag(ptile, dir)
{
  var ntile = mapstep(ptile, dir);
  if (ntile == null) return 0;
  var nterrain = tile_terrain(ntile);
  if (nterrain == null) return 0;
  var ng = nterrain['graphic_str'];
  return (ng === 'coast' || ng === 'floor') ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/*  Canvas initialisation                                               */
/* ------------------------------------------------------------------ */

function init_2d_map_canvas()
{
  map2d_canvas = document.getElementById('mapcanvas_2d');
  if (!map2d_canvas) return;

  map2d_ctx = map2d_canvas.getContext('2d');
  map2d_resize_canvas();

  /* Default view centre */
  if (map && map['xsize']) {
    map2d_center_x = Math.floor(map['xsize'] / 2);
    map2d_center_y = Math.floor(map['ysize'] / 2);
  }

  /* Mouse-wheel zoom */
  map2d_canvas.addEventListener('wheel', function(e) {
    e.preventDefault();
    if (e.deltaY < 0) {
      map2d_zoom = Math.min(MAP2D_MAX_ZOOM, map2d_zoom * 1.15);
    } else {
      map2d_zoom = Math.max(MAP2D_MIN_ZOOM, map2d_zoom / 1.15);
    }
    render_2d_map();
  }, { passive: false });

  /* Mouse-drag panning */
  map2d_canvas.addEventListener('mousedown', function(e) {
    map2d_drag_active   = true;
    map2d_drag_moved    = false;
    map2d_drag_start_x  = e.clientX;
    map2d_drag_start_y  = e.clientY;
    map2d_drag_center_x = map2d_center_x;
    map2d_drag_center_y = map2d_center_y;
    map2d_canvas.style.cursor = 'grabbing';
  });

  map2d_canvas.addEventListener('mousemove', function(e) {
    /* Track tile under cursor for context menu and click handling */
    map2d_mouse_tile = map2d_tile_from_event(e);
    map2d_update_mouse_cursor();

    if (!map2d_drag_active) return;
    map2d_drag_moved = true;
    var tw = Math.max(1, Math.floor(map2d_tileset_config['normal_tile_width']  * map2d_zoom));
    var th = Math.max(1, Math.floor(map2d_tileset_config['normal_tile_height'] * map2d_zoom));
    var dx = Math.round((map2d_drag_start_x - e.clientX) / tw);
    var dy = Math.round((map2d_drag_start_y - e.clientY) / th);
    map2d_center_x = map2d_drag_center_x + dx;
    map2d_center_y = map2d_drag_center_y + dy;
    render_2d_map();
  });

  map2d_canvas.addEventListener('mouseup',   function() {
    map2d_drag_active = false;
    map2d_update_mouse_cursor();
  });
  map2d_canvas.addEventListener('mouseleave', function() {
    map2d_drag_active = false;
    map2d_canvas.style.cursor = 'grab';
  });
  map2d_canvas.style.cursor = 'grab';

  /* Arrow-key panning (canvas must be focusable).
   * stopPropagation prevents arrow keys from also triggering unit-movement
   * commands in the global keyboard listener. */
  map2d_canvas.setAttribute('tabindex', '0');
  map2d_canvas.addEventListener('keydown', function(e) {
    var step = 3;
    if (e.key === 'ArrowLeft')  { map2d_center_x -= step; render_2d_map(); e.preventDefault(); e.stopPropagation(); return; }
    if (e.key === 'ArrowRight') { map2d_center_x += step; render_2d_map(); e.preventDefault(); e.stopPropagation(); return; }
    if (e.key === 'ArrowUp')    { map2d_center_y -= step; render_2d_map(); e.preventDefault(); e.stopPropagation(); return; }
    if (e.key === 'ArrowDown')  { map2d_center_y += step; render_2d_map(); e.preventDefault(); e.stopPropagation(); return; }
    if (e.key === '+')          { map2d_zoom = Math.min(MAP2D_MAX_ZOOM, map2d_zoom * 1.2); render_2d_map(); }
    if (e.key === '-')          { map2d_zoom = Math.max(MAP2D_MIN_ZOOM, map2d_zoom / 1.2); render_2d_map(); }
  });

  /* Left-click: unit selection, city dialog, or goto destination */
  map2d_canvas.addEventListener('click', function(e) {
    if (map2d_drag_moved) { map2d_drag_moved = false; return; }
    var ptile = map2d_tile_from_event(e);
    if (ptile == null) return;
    map2d_handle_tile_click(ptile);
  });

  /* Context menu on right-click */
  map2d_canvas.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    /* Recompute tile at the exact right-click position (mousemove may not
     * have fired at this exact pixel, especially on trackpads). */
    map2d_mouse_tile = map2d_tile_from_event(e);
    map2d_show_context_menu(e);
  });

  /* ------------------------------------------------------------------
   * Touch controls for mobile devices
   * Single-finger drag = pan; two-finger pinch = zoom; tap = tile click
   * ------------------------------------------------------------------ */
  map2d_canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      var t = e.touches[0];
      map2d_drag_active   = true;
      map2d_drag_moved    = false;
      map2d_drag_start_x  = t.clientX;
      map2d_drag_start_y  = t.clientY;
      map2d_drag_center_x = map2d_center_x;
      map2d_drag_center_y = map2d_center_y;
    } else if (e.touches.length === 2) {
      map2d_drag_active = false;
      var t1 = e.touches[0];
      var t2 = e.touches[1];
      map2d_pinch_start_dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      map2d_pinch_start_zoom = map2d_zoom;
    }
  }, { passive: false });

  map2d_canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    if (e.touches.length === 1 && map2d_drag_active) {
      var t = e.touches[0];
      map2d_drag_moved = true;
      var tw = Math.max(1, Math.floor(map2d_tileset_config['normal_tile_width']  * map2d_zoom));
      var th = Math.max(1, Math.floor(map2d_tileset_config['normal_tile_height'] * map2d_zoom));
      var dx = Math.round((map2d_drag_start_x - t.clientX) / tw);
      var dy = Math.round((map2d_drag_start_y - t.clientY) / th);
      map2d_center_x = map2d_drag_center_x + dx;
      map2d_center_y = map2d_drag_center_y + dy;
      render_2d_map();
    } else if (e.touches.length === 2 && map2d_pinch_start_dist > 0) {
      var t1 = e.touches[0];
      var t2 = e.touches[1];
      var dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      map2d_zoom = Math.max(MAP2D_MIN_ZOOM, Math.min(MAP2D_MAX_ZOOM, map2d_pinch_start_zoom * dist / map2d_pinch_start_dist));
      render_2d_map();
    }
  }, { passive: false });

  map2d_canvas.addEventListener('touchend', function(e) {
    e.preventDefault();
    if (e.touches.length === 0) {
      if (map2d_drag_active && !map2d_drag_moved && e.changedTouches.length > 0) {
        /* Treat a tap as a tile click */
        var ct = e.changedTouches[0];
        var ptile = map2d_tile_from_event({clientX: ct.clientX, clientY: ct.clientY});
        if (ptile != null) map2d_handle_tile_click(ptile);
      }
      map2d_drag_active = false;
      map2d_drag_moved  = false;
      map2d_pinch_start_dist = 0;
    }
  }, { passive: false });

  map2d_canvas.addEventListener('touchcancel', function() {
    map2d_drag_active = false;
    map2d_drag_moved  = false;
    map2d_pinch_start_dist = 0;
  }, { passive: false });

  map2d_initialized = true;
}

/**
 * Resize the 2D canvas to fill the #tabs-2dmap panel.
 */
function map2d_resize_canvas()
{
  if (!map2d_canvas) return;
  var panel = document.getElementById('tabs-2dmap');
  var w = panel ? panel.clientWidth  : $(window).width();
  var h = panel ? panel.clientHeight : ($(window).height() - 38);
  if (w < 1) w = $(window).width();
  if (h < 1) h = $(window).height() - 38;
  map2d_canvas.width  = w;
  map2d_canvas.height = h;
}

/* ------------------------------------------------------------------ */
/*  Main render entry point                                             */
/* ------------------------------------------------------------------ */

/**
 * Render the full 2D map onto the canvas using multiple layers:
 *   1. Terrain  (grassland base + directional overlay, or ocean)
 *   2. Extras   (roads, railroads, irrigation, mines, fortresses, …)
 *   3. Territory borders  (dashed colored lines, separate layer)
 *   4. City sprites
 *   5. Unit sprites + shield flags
 *   6. City labels with nation flags  (always on top)
 *
 * Safe to call at any time; returns silently if data is not ready yet.
 */
function render_2d_map()
{
  if (!map2d_canvas || !map2d_ctx) {
    init_2d_map_canvas();
    if (!map2d_canvas || !map2d_ctx) return;
  }

  if (typeof map === 'undefined' || !map || !map['xsize']) return;
  if (typeof tiles === 'undefined' || !tiles) return;

  map2d_resize_canvas();

  var ctx = map2d_ctx;
  var cw  = map2d_canvas.width;
  var ch  = map2d_canvas.height;

  /* Tile dimensions at current zoom (from trident config) */
  var tw = Math.max(1, Math.floor(map2d_tileset_config['normal_tile_width']  * map2d_zoom));
  var th = Math.max(1, Math.floor(map2d_tileset_config['normal_tile_height'] * map2d_zoom));

  /* Clear */
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, cw, ch);

  /* How many tiles fit on screen (add 2 as margin) */
  var tiles_x = Math.ceil(cw / tw) + 2;
  var tiles_y = Math.ceil(ch / th) + 2;

  /* Top-left tile in map coordinates */
  var start_x = Math.floor(map2d_center_x - tiles_x / 2);
  var start_y = Math.floor(map2d_center_y - tiles_y / 2);

  /* Pixel offset so the centre tile lands in the middle of the canvas */
  var off_x = Math.floor(cw / 2 - (map2d_center_x - start_x) * tw);
  var off_y = Math.floor(ch / 2 - (map2d_center_y - start_y) * th);

  /* Build visible-tile list (avoids recomputing positions for every layer) */
  var vis = [];
  for (var ty = 0; ty < tiles_y; ty++) {
    var map_y = start_y + ty;
    if (map_y < 0 || map_y >= map['ysize']) continue;
    for (var tx = 0; tx < tiles_x; tx++) {
      var map_x = ((start_x + tx) % map['xsize'] + map['xsize']) % map['xsize'];
      var ptile = map_pos_to_tile(map_x, map_y);
      if (ptile) vis.push({ptile: ptile, cx: off_x + tx * tw, cy: off_y + ty * th});
    }
  }

  var i, v;

  /* --- Layer 1: terrain + fog --- */
  for (i = 0; i < vis.length; i++) {
    v = vis[i];
    map2d_render_terrain(ctx, v.ptile, v.cx, v.cy, tw, th);
  }

  /* --- Layer 2: extras --- */
  for (i = 0; i < vis.length; i++) {
    v = vis[i];
    if (tile_get_known(v.ptile) !== TILE_KNOWN_SEEN) continue;
    map2d_draw_tile_extras(ctx, v.ptile, v.cx, v.cy, tw, th);
  }

  /* --- Layer 3: territory borders (dashed colored lines) --- */
  for (i = 0; i < vis.length; i++) {
    v = vis[i];
    if (tile_get_known(v.ptile) !== TILE_KNOWN_SEEN) continue;
    map2d_draw_border(ctx, v.ptile, v.cx, v.cy, tw, th);
  }

  /* --- Layer 4: city sprites --- */
  var city_label_queue = [];
  for (i = 0; i < vis.length; i++) {
    v = vis[i];
    if (tile_get_known(v.ptile) !== TILE_KNOWN_SEEN) continue;
    var pcity = tile_city(v.ptile);
    if (pcity) {
      map2d_draw_city(ctx, pcity, v.cx, v.cy, tw, th);
      city_label_queue.push({pcity: pcity, cx: v.cx, cy: v.cy});
    }
  }

  /* --- Layer 5: unit sprites + shield flags --- */
  for (i = 0; i < vis.length; i++) {
    v = vis[i];
    if (tile_get_known(v.ptile) !== TILE_KNOWN_SEEN) continue;
    var punits = tile_units(v.ptile);
    if (punits && punits.length > 0) {
      map2d_draw_unit(ctx, punits[0], v.cx, v.cy, tw, th);
      if (punits.length > 1) {
        map2d_draw_unit_count(ctx, punits.length, v.cx, v.cy, tw, th);
      }
    }
  }

  /* --- Layer 6: city labels with flags (always on top) --- */
  for (i = 0; i < city_label_queue.length; i++) {
    var q = city_label_queue[i];
    map2d_draw_city_label(ctx, q.pcity, q.cx, q.cy, tw, th);
  }

  /* Draw grid lines (optional, subtle) */
  map2d_draw_grid(cw, ch, tw, th, off_x, off_y);
}

/* ------------------------------------------------------------------ */
/*  Terrain layer renderer                                              */
/* ------------------------------------------------------------------ */

/**
 * Render a single tile's terrain onto the canvas (layer 1).
 *
 * Trident uses a composited approach:
 *   – Ocean tiles (coast / floor) receive a textured water base built from
 *     the four coast_cell / floor_cell quadrant sprites (t.l0.<g>_cell_u/r/l/d
 *     with the "000" neighbour-code variant), then the directional layer-1
 *     sprite is composited on top.  The directional sprites are partially or
 *     fully transparent (the all-ocean variant is completely transparent), so
 *     the textured base must be painted first.  A solid-colour fill is used
 *     as a fallback when the cell sprites have not yet been loaded.
 *   – All non-ocean land tiles first receive the grassland base sprite.
 *   – The terrain-specific directional overlay is drawn on top.
 *
 * After terrain, fog-of-war is applied where the tile is known-but-unseen.
 */
function map2d_render_terrain(ctx, ptile, cx, cy, tw, th)
{
  if (ptile == null) return;

  var known = tile_get_known(ptile);
  if (known === TILE_UNKNOWN) return;

  var pterrain  = tile_terrain(ptile);
  var g         = pterrain ? pterrain['graphic_str'] : null;
  var is_ocean  = (g === 'coast' || g === 'floor');

  /* Step 1 – textured water base for ocean tiles, grassland base for land
   * tiles.  Ocean directional sprites are (partially) transparent and must be
   * drawn over a base so open-water tiles are not left black.
   * Use the four cell-quadrant sprites (t.l0.<g>_cell_u/r/l/d000) when
   * available; fall back to a solid colour fill. */
  if (is_ocean) {
    var cp = 't.l0.' + g + '_cell_';
    var su = sprites_2d_init && sprites_2d[cp + 'u000'];
    var sr = sprites_2d_init && sprites_2d[cp + 'r000'];
    var sl = sprites_2d_init && sprites_2d[cp + 'l000'];
    var sd = sprites_2d_init && sprites_2d[cp + 'd000'];
    if (su && sr && sl && sd) {
      var hw = Math.ceil(tw / 2);
      var hh = Math.ceil(th / 2);
      ctx.drawImage(su, cx,      cy,      hw,      hh);
      ctx.drawImage(sr, cx + hw, cy,      tw - hw, hh);
      ctx.drawImage(sl, cx,      cy + hh, hw,      th - hh);
      ctx.drawImage(sd, cx + hw, cy + hh, tw - hw, th - hh);
    } else {
      ctx.fillStyle = map2d_terrain_colors[g] || '#1a3a6a';
      ctx.fillRect(cx, cy, tw, th);
    }
  } else if (sprites_2d_init && sprites_2d['t.l0.grassland1']) {
    ctx.drawImage(sprites_2d['t.l0.grassland1'], cx, cy, tw, th);
  }

  /* Step 2 – terrain overlay (or solid-colour fallback) */
  var terrain_drawn = false;
  if (pterrain && sprites_2d_init) {
    var tag = get_2d_terrain_sprite_tag(pterrain, ptile);
    var spr = sprites_2d[tag];
    if (spr) {
      /* Grassland is already drawn as the background; skip double-draw */
      if (is_ocean || tag !== 't.l0.grassland1') {
        ctx.drawImage(spr, cx, cy, tw, th);
      }
      terrain_drawn = true;
    }
  }

  if (!terrain_drawn) {
    ctx.fillStyle = (pterrain && map2d_terrain_colors[g])
                    ? map2d_terrain_colors[g] : '#334';
    ctx.fillRect(cx, cy, tw, th);
  }

  /* Step 3 – fog of war overlay */
  if (known === TILE_KNOWN_UNSEEN) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(cx, cy, tw, th);
  }
}

/* ------------------------------------------------------------------ */
/*  Per-tile rendering (legacy stub – rendering now done in layers)    */
/* ------------------------------------------------------------------ */

/**
 * @deprecated  Use render_2d_map() which calls the individual layer
 *              renderers.  This stub is retained for API compatibility.
 */
function render_2d_tile(ctx, ptile, cx, cy, tw, th)
{
  map2d_render_terrain(ctx, ptile, cx, cy, tw, th);
  if (!ptile || tile_get_known(ptile) !== TILE_KNOWN_SEEN) return;
  map2d_draw_tile_extras(ctx, ptile, cx, cy, tw, th);
  map2d_draw_border(ctx, ptile, cx, cy, tw, th);
  var pcity = tile_city(ptile);
  if (pcity) map2d_draw_city(ctx, pcity, cx, cy, tw, th);
  var punits = tile_units(ptile);
  if (punits && punits.length > 0) {
    map2d_draw_unit(ctx, punits[0], cx, cy, tw, th);
    if (punits.length > 1) map2d_draw_unit_count(ctx, punits.length, cx, cy, tw, th);
  }
}

/* ------------------------------------------------------------------ */
/*  City and unit drawing                                               */
/* ------------------------------------------------------------------ */

function map2d_draw_city(ctx, pcity, cx, cy, tw, th)
{
  /* Try city sprites from the trident tileset (style_city_0 variants) */
  if (sprites_2d_init) {
    var city_sprite = sprites_2d['city.european_city_0']
                   || sprites_2d['city.classical_city_0']
                   || sprites_2d['city.industrial_city_0']
                   || sprites_2d['city.modern_city_0'];
    if (city_sprite) {
      ctx.drawImage(city_sprite, cx, cy, tw, th);
      return;
    }
  }

  /* Fallback: filled circle in the player's colour */
  ctx.fillStyle = map2d_player_color(pcity['owner'], '#ffffff');
  var r = Math.max(3, Math.floor(Math.min(tw, th) * 0.35));
  ctx.beginPath();
  ctx.arc(cx + tw / 2, cy + th / 2, r, 0, 2 * Math.PI);
  ctx.fill();
}

function map2d_draw_city_label(ctx, pcity, cx, cy, tw, th)
{
  if (tw < 20) return; /* too small to be readable */
  var name      = pcity['name'] || '';
  var font_size = Math.max(8, Math.floor(th * 0.45));
  var label_y   = cy + th + 1;
  var label_cx  = cx + tw / 2;

  /* Draw nation flag/shield to the left of the city name */
  var flag_drawn_w = 0;
  if (sprites_2d_init && typeof get_city_flag_sprite === 'function') {
    var flag_info = get_city_flag_sprite(pcity);
    if (flag_info && flag_info['key']) {
      var flag_spr = sprites_2d[flag_info['key']];
      if (flag_spr) {
        var fh = Math.max(8, font_size);
        var fw = Math.round(fh * flag_spr.width / Math.max(1, flag_spr.height));
        var fx = Math.floor(label_cx - fw / 2 - fw - 2);
        ctx.drawImage(flag_spr, fx, label_y, fw, fh);
        flag_drawn_w = fw + 2;
      }
    }
  }

  ctx.font          = font_size + 'px sans-serif';
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'top';
  ctx.strokeStyle   = '#000000';
  ctx.lineWidth     = 2;
  ctx.strokeText(name, label_cx + flag_drawn_w / 2, label_y);
  ctx.fillStyle     = '#ffffff';
  ctx.fillText(name, label_cx + flag_drawn_w / 2, label_y);
}

function map2d_draw_unit(ctx, punit, cx, cy, tw, th)
{
  /* Try unit sprite from the trident tileset using a 2D-specific lookup */
  if (sprites_2d_init) {
    var tag = get_2d_unit_sprite_tag(punit);
    if (tag && sprites_2d[tag]) {
      ctx.drawImage(sprites_2d[tag], cx, cy, tw, th);
      map2d_draw_unit_shield(ctx, punit, cx, cy, tw, th);
      return;
    }
  }

  /* Fallback: small coloured rectangle */
  var us = Math.max(4, Math.floor(Math.min(tw, th) * 0.4));
  ctx.fillStyle = map2d_player_color(punit['owner'], '#ffff00');
  ctx.fillRect(cx + Math.floor((tw - us) / 2), cy + Math.floor((th - us) / 2), us, us);
  map2d_draw_unit_shield(ctx, punit, cx, cy, tw, th);
}

/**
 * Draw a small nation shield/flag badge in the top-left of the unit tile.
 */
function map2d_draw_unit_shield(ctx, punit, cx, cy, tw, th)
{
  if (!sprites_2d_init || tw < 12) return;
  var owner_id = punit['owner'];
  if (owner_id == null) return;
  var pplayer = players[owner_id];
  if (!pplayer) return;
  var nation = nations[pplayer['nation']];
  if (!nation) return;
  var shield_tag = 'f.shield.' + nation['graphic_str'];
  var shield_spr = sprites_2d[shield_tag];
  if (!shield_spr) return;
  var sh = Math.max(6, Math.floor(th * 0.35));
  var sw = Math.round(sh * shield_spr.width / Math.max(1, shield_spr.height));
  ctx.drawImage(shield_spr, cx + 1, cy + 1, sw, sh);
}

/* ------------------------------------------------------------------ */
/*  Optional grid overlay                                               */
/* ------------------------------------------------------------------ */

function map2d_draw_grid(cw, ch, tw, th, off_x, off_y)
{
  if (tw < 8 || th < 8) return; /* skip if tiles are tiny */
  map2d_ctx.save();
  map2d_ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  map2d_ctx.lineWidth = 0.5;

  /* Vertical lines */
  for (var x = off_x % tw; x < cw; x += tw) {
    map2d_ctx.beginPath();
    map2d_ctx.moveTo(x, 0);
    map2d_ctx.lineTo(x, ch);
    map2d_ctx.stroke();
  }
  /* Horizontal lines */
  for (var y = off_y % th; y < ch; y += th) {
    map2d_ctx.beginPath();
    map2d_ctx.moveTo(0, y);
    map2d_ctx.lineTo(cw, y);
    map2d_ctx.stroke();
  }
  map2d_ctx.restore();
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Returns a CSS colour string for `player_id`, or `fallback` if unavailable.
 */
function map2d_player_color(player_id, fallback)
{
  if (player_id == null) return fallback;
  var pplayer = players[player_id];
  if (!pplayer || !pplayer['color']) return fallback;
  var c = pplayer['color'];
  return 'rgb(' + c['r'] + ',' + c['g'] + ',' + c['b'] + ')';
}

/**
 * Centre the 2D map view on the given tile.
 * @param {object} ptile  A tile object with 'x' and 'y' fields.
 */
function center_2d_map_on_tile(ptile)
{
  if (ptile == null) return;
  map2d_center_x = ptile['x'];
  map2d_center_y = ptile['y'];
  render_2d_map();
}

/**
 * Schedule a re-render of the 2D map, coalescing rapid packet bursts into
 * a single repaint.  Has no effect when the 2D tab is not visible.
 */
function map2d_schedule_render()
{
  if (map2d_render_pending) return;
  if (typeof $ === 'undefined') return;
  try {
    if ($('#tabs').tabs('option', 'active') !== 1) return;
  } catch (e) {
    return;
  }
  map2d_render_pending = true;
  setTimeout(function() {
    map2d_render_pending = false;
    render_2d_map();
  }, MAP2D_RENDER_DELAY_MS);
}

/**
 * Update the mouse cursor on the 2D map canvas based on the tile under the
 * pointer.  Mirrors the logic of update_mouse_cursor() for the 3D map:
 *  – 'grabbing'   while dragging (panning the map)
 *  – 'crosshair'  when a valid goto destination is highlighted
 *  – 'not-allowed' when goto is active but no valid path exists
 *  – 'pointer'    when hovering over an own city or own unit
 *  – 'grab'       (default) everywhere else
 */
function map2d_update_mouse_cursor()
{
  if (!map2d_canvas) return;
  if (map2d_drag_active) {
    map2d_canvas.style.cursor = 'grabbing';
    return;
  }
  if (typeof goto_active !== 'undefined' && goto_active) {
    map2d_canvas.style.cursor =
      (typeof current_goto_turns !== 'undefined' && current_goto_turns != null)
        ? 'crosshair' : 'not-allowed';
    return;
  }
  var ptile = map2d_mouse_tile;
  if (ptile != null && typeof client !== 'undefined'
      && client.conn && client.conn.playing != null) {
    var pcity = (typeof tile_city === 'function') ? tile_city(ptile) : null;
    if (pcity != null && typeof city_owner_player_id === 'function'
        && city_owner_player_id(pcity) == client.conn.playing.playerno) {
      map2d_canvas.style.cursor = 'pointer';
      return;
    }
    var punit = (typeof find_visible_unit === 'function') ? find_visible_unit(ptile) : null;
    if (punit != null && punit['owner'] == client.conn.playing.playerno) {
      map2d_canvas.style.cursor = 'pointer';
      return;
    }
  }
  map2d_canvas.style.cursor = 'grab';
}

/**
 * Handle a left-click on the 2D map canvas.
 *
 * Delegates entirely to do_map_click() so that all game actions (goto,
 * city dialog, unit focus, paradrop, airlift, …) behave identically to
 * the 3D map.
 */
function map2d_handle_tile_click(ptile)
{
  if (ptile == null) return;
  do_map_click(ptile, SELECT_POPUP, true);
  render_2d_map();
}

/**
 * Look up the best matching sprite tag for a unit in the trident tileset
 * (sprites_2d dictionary).  Tries common naming conventions used by the
 * Trident tileset before falling back to amplio2-style tags.
 */
function get_2d_unit_sprite_tag(punit)
{
  if (!sprites_2d_init || punit == null) return null;
  var utype = unit_type(punit);
  if (!utype) return null;

  /* Candidate tag list in preference order. */
  var candidates = [
    utype['graphic_str'],
    utype['graphic_alt'],
    utype['graphic_str'] + '_Idle',
    utype['graphic_alt'] + '_Idle',
    'u.' + utype['graphic_str'],
    'u.' + utype['graphic_alt']
  ];

  for (var i = 0; i < candidates.length; i++) {
    var t = candidates[i];
    if (t && sprites_2d[t]) return t;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Extras / improvements rendering                                     */
/* ------------------------------------------------------------------ */

/**
 * Draw tile improvement/extra sprites (roads, irrigation, mine,
 * fortress, pollution, hut) using tileset sprites where available,
 * falling back to simple geometric indicators.
 */
function map2d_draw_tile_extras(ctx, ptile, cx, cy, tw, th)
{
  if (ptile == null || ptile['extras'] == null) return;
  var spr;

  /* --- Irrigation (light blue diagonal lines) --- */
  if (typeof EXTRA_IRRIGATION !== 'undefined' && tile_has_extra(ptile, EXTRA_IRRIGATION)) {
    spr = sprites_2d_init && sprites_2d['tx.irrigation'];
    if (spr) {
      ctx.drawImage(spr, cx, cy, tw, th);
    } else {
      ctx.strokeStyle = 'rgba(100,180,255,0.6)';
      ctx.lineWidth = Math.max(1, tw * 0.08);
      for (var li = -th; li < tw + th; li += Math.max(4, tw * 0.3)) {
        ctx.beginPath();
        ctx.moveTo(cx + li, cy);
        ctx.lineTo(cx + li + th, cy + th);
        ctx.stroke();
      }
    }
  }

  /* --- Mine (small gray M symbol) --- */
  if (typeof EXTRA_MINE !== 'undefined' && tile_has_extra(ptile, EXTRA_MINE)) {
    spr = sprites_2d_init && sprites_2d['tx.mine'];
    if (spr) {
      ctx.drawImage(spr, cx, cy, tw, th);
    } else {
      ctx.fillStyle = 'rgba(150,150,150,0.8)';
      ctx.font = Math.max(6, Math.floor(th * 0.4)) + 'px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('M', cx + 1, cy + 1);
    }
  }

  /* --- Fortress (thin dark border) --- */
  if (typeof EXTRA_FORTRESS !== 'undefined' && tile_has_extra(ptile, EXTRA_FORTRESS)) {
    spr = sprites_2d_init && sprites_2d['base.fortress_fg'];
    if (spr) {
      ctx.drawImage(spr, cx, cy, tw, th);
    } else {
      ctx.strokeStyle = 'rgba(180,120,40,0.9)';
      ctx.lineWidth = Math.max(1, Math.floor(tw * 0.1));
      ctx.strokeRect(cx + 1, cy + 1, tw - 2, th - 2);
    }
  }

  /* --- Pollution (dark red dots) --- */
  if (typeof EXTRA_POLLUTION !== 'undefined' && tile_has_extra(ptile, EXTRA_POLLUTION)) {
    spr = sprites_2d_init && sprites_2d['tx.pollution'];
    if (spr) {
      ctx.drawImage(spr, cx, cy, tw, th);
    } else {
      ctx.fillStyle = 'rgba(180,0,0,0.5)';
      ctx.fillRect(cx, cy, tw, th);
    }
  }

  /* --- Hut / minor tribe village --- */
  if (typeof EXTRA_HUT !== 'undefined' && tile_has_extra(ptile, EXTRA_HUT)) {
    spr = sprites_2d_init && sprites_2d['tx.village'];
    if (spr) {
      ctx.drawImage(spr, cx, cy, tw, th);
    } else {
      var hr = Math.max(3, Math.floor(Math.min(tw, th) * 0.2));
      ctx.fillStyle = 'rgba(255,200,0,0.9)';
      ctx.beginPath();
      ctx.arc(cx + tw / 2, cy + th / 2, hr, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  /* --- Road (brown cross lines) --- */
  if (typeof EXTRA_ROAD !== 'undefined' && tile_has_extra(ptile, EXTRA_ROAD)) {
    map2d_draw_road_lines(ctx, ptile, cx, cy, tw, th, false);
  }

  /* --- Railroad (dark lines with tick marks) --- */
  if (typeof EXTRA_RAIL !== 'undefined' && tile_has_extra(ptile, EXTRA_RAIL)) {
    map2d_draw_road_lines(ctx, ptile, cx, cy, tw, th, true);
  }
}

/**
 * Draw road or railroad lines connecting to adjacent tiles.
 * Uses simple geometric lines as fallback (trident road sprites are
 * directional composites that require the full tilespec rendering pipeline).
 */
function map2d_draw_road_lines(ctx, ptile, cx, cy, tw, th, is_rail)
{
  var cx2 = cx + tw / 2;
  var cy2 = cy + th / 2;
  var extra_id = is_rail ? EXTRA_RAIL : EXTRA_ROAD;
  var color = is_rail ? 'rgba(60,60,60,0.9)' : 'rgba(180,140,80,0.9)';
  var lw = Math.max(1, Math.floor(tw * (is_rail ? 0.1 : 0.12)));

  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();

  /* Draw a short line toward each neighbor that also has the same extra */
  var dirs = [
    {dx: 0,  dy: -1, ex: 0,    ey: -th/2},   /* N */
    {dx: 1,  dy: 0,  ex: tw/2, ey: 0   },    /* E */
    {dx: 0,  dy: 1,  ex: 0,    ey:  th/2},   /* S */
    {dx: -1, dy: 0,  ex: -tw/2, ey: 0  }     /* W */
  ];

  var any = false;
  for (var d = 0; d < dirs.length; d++) {
    var nx = ((ptile['x'] + dirs[d].dx) % map['xsize'] + map['xsize']) % map['xsize'];
    var ny = ptile['y'] + dirs[d].dy;
    if (ny < 0 || ny >= map['ysize']) continue;
    var ntile = map_pos_to_tile(nx, ny);
    if (ntile != null && tile_has_extra(ntile, extra_id)) {
      ctx.moveTo(cx2, cy2);
      ctx.lineTo(cx2 + dirs[d].ex, cy2 + dirs[d].ey);
      any = true;
    }
  }

  if (!any) {
    /* Isolated road: draw a small cross */
    var r = Math.max(2, Math.floor(Math.min(tw, th) * 0.2));
    ctx.moveTo(cx2 - r, cy2);
    ctx.lineTo(cx2 + r, cy2);
    ctx.moveTo(cx2, cy2 - r);
    ctx.lineTo(cx2, cy2 + r);
  }

  ctx.stroke();

  /* Railroad: add perpendicular tie marks */
  if (is_rail) {
    ctx.strokeStyle = 'rgba(40,40,40,0.7)';
    ctx.lineWidth = Math.max(1, lw - 1);
    var tm = Math.max(1, Math.floor(Math.min(tw, th) * 0.15));
    /* Horizontal tie */
    ctx.beginPath();
    ctx.moveTo(cx2 - tm, cy2 - 1);
    ctx.lineTo(cx2 + tm, cy2 - 1);
    ctx.stroke();
    /* Vertical tie */
    ctx.beginPath();
    ctx.moveTo(cx2 - 1, cy2 - tm);
    ctx.lineTo(cx2 - 1, cy2 + tm);
    ctx.stroke();
  }
}

/* ------------------------------------------------------------------ */
/*  Territory border rendering                                          */
/* ------------------------------------------------------------------ */

/**
 * Draw a dashed colored border on tile edges that border a different owner.
 */
function map2d_draw_border(ctx, ptile, cx, cy, tw, th)
{
  var owner = tile_owner(ptile);
  if (owner == null) return;

  var border_color = map2d_player_color(owner, null);
  if (!border_color) return;

  ctx.save();
  ctx.strokeStyle  = border_color;
  ctx.lineWidth    = Math.max(1, Math.floor(tw * 0.08));
  ctx.globalAlpha  = 0.6;
  ctx.setLineDash([Math.max(2, Math.floor(tw * 0.2)), Math.max(2, Math.floor(tw * 0.12))]);

  var edges = [
    {dx: 0,  dy: -1, x1: cx,      y1: cy,      x2: cx + tw, y2: cy     },  /* N */
    {dx: 1,  dy: 0,  x1: cx + tw, y1: cy,      x2: cx + tw, y2: cy + th},  /* E */
    {dx: 0,  dy: 1,  x1: cx,      y1: cy + th, x2: cx + tw, y2: cy + th},  /* S */
    {dx: -1, dy: 0,  x1: cx,      y1: cy,      x2: cx,      y2: cy + th}   /* W */
  ];

  for (var i = 0; i < edges.length; i++) {
    var e = edges[i];
    var nx = ((ptile['x'] + e.dx) % map['xsize'] + map['xsize']) % map['xsize'];
    var ny = ptile['y'] + e.dy;
    if (ny < 0 || ny >= map['ysize']) {
      ctx.beginPath();
      ctx.moveTo(e.x1, e.y1);
      ctx.lineTo(e.x2, e.y2);
      ctx.stroke();
      continue;
    }
    var ntile  = map_pos_to_tile(nx, ny);
    var nowner = ntile ? tile_owner(ntile) : null;
    if (nowner !== owner) {
      ctx.beginPath();
      ctx.moveTo(e.x1, e.y1);
      ctx.lineTo(e.x2, e.y2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/*  Unit count badge                                                    */
/* ------------------------------------------------------------------ */

/**
 * Draw a small badge showing the number of units stacked on a tile.
 */
function map2d_draw_unit_count(ctx, count, cx, cy, tw, th)
{
  if (tw < 10) return;
  var r = Math.max(4, Math.floor(Math.min(tw, th) * 0.22));
  var bx = cx + tw - r - 1;
  var by = cy + 1;
  ctx.fillStyle = '#cc0000';
  ctx.beginPath();
  ctx.arc(bx, by + r, r, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold ' + Math.max(6, r) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(count > 9 ? '9+' : String(count), bx, by + r);
}

/* ------------------------------------------------------------------ */
/*  Tile coordinate helper                                              */
/* ------------------------------------------------------------------ */

/**
 * Convert a mouse event on the 2D canvas to the map tile it falls on.
 * Returns null if the tile is off-map or unknown.
 */
function map2d_tile_from_event(e)
{
  if (!map2d_canvas || !map || !map['xsize']) return null;
  var rect = map2d_canvas.getBoundingClientRect();
  var px = e.clientX - rect.left;
  var py = e.clientY - rect.top;

  var tw = Math.max(1, Math.floor(map2d_tileset_config['normal_tile_width']  * map2d_zoom));
  var th = Math.max(1, Math.floor(map2d_tileset_config['normal_tile_height'] * map2d_zoom));

  var cw = map2d_canvas.width;
  var ch = map2d_canvas.height;
  var tiles_x = Math.ceil(cw / tw) + 2;
  var tiles_y = Math.ceil(ch / th) + 2;
  var start_x = Math.floor(map2d_center_x - tiles_x / 2);
  var start_y = Math.floor(map2d_center_y - tiles_y / 2);
  var off_x = Math.floor(cw / 2 - (map2d_center_x - start_x) * tw);
  var off_y = Math.floor(ch / 2 - (map2d_center_y - start_y) * th);

  var tx = Math.floor((px - off_x) / tw);
  var ty = Math.floor((py - off_y) / th);
  var map_y = start_y + ty;
  if (map_y < 0 || map_y >= map['ysize']) return null;
  var map_x = ((start_x + tx) % map['xsize'] + map['xsize']) % map['xsize'];
  return map_pos_to_tile(map_x, map_y);
}

/* ------------------------------------------------------------------ */
/*  Context menu for the 2D map                                         */
/* ------------------------------------------------------------------ */

/**
 * Show a context menu popup at the given mouse event position.
 * Re-uses the same unit-action commands as the 3D map context menu.
 */
function map2d_show_context_menu(e)
{
  /* Focus any unit on the clicked tile */
  if (map2d_mouse_tile != null) {
    var punits = tile_units(map2d_mouse_tile);
    if (punits && punits.length > 0 && typeof set_unit_focus === 'function') {
      set_unit_focus(punits[0]);
    }
  }

  /* Build menu items using the shared helper */
  var items = {};
  if (typeof update_unit_order_commands === 'function') {
    items = update_unit_order_commands();
  }

  /* Always offer tile info */
  if (!items['tile_info']) {
    items['tile_info'] = {name: 'Tile info', icon: 'fas fa-info-circle'};
  }

  if (Object.keys(items).length === 0) return;

  /* Remove any stale menu */
  var old = document.getElementById('map2d_context_menu');
  if (old) old.parentNode.removeChild(old);

  var menu = document.createElement('ul');
  menu.id = 'map2d_context_menu';
  menu.style.cssText = [
    'position:fixed',
    'left:' + e.clientX + 'px',
    'top:' + e.clientY + 'px',
    'background:#1a1a2e',
    'border:1px solid #444',
    'border-radius:4px',
    'padding:4px 0',
    'list-style:none',
    'margin:0',
    'z-index:9000',
    'min-width:160px',
    'box-shadow:2px 2px 8px rgba(0,0,0,0.6)',
    'font:13px sans-serif',
    'color:#eee'
  ].join(';');

  for (var key in items) {
    if (!items.hasOwnProperty(key)) continue;
    var item = items[key];
    (function(k, label) {
      var li = document.createElement('li');
      li.style.cssText = 'padding:5px 14px;cursor:pointer;white-space:nowrap;';
      li.textContent = label;
      li.addEventListener('mouseenter', function() { li.style.background = '#2a2a4e'; });
      li.addEventListener('mouseleave', function() { li.style.background = ''; });
      li.addEventListener('click', function() {
        map2d_close_context_menu();
        if (k === 'tile_info') {
          if (map2d_mouse_tile != null && typeof popit_req === 'function') {
            popit_req(map2d_mouse_tile);
          }
        } else if (typeof handle_context_menu_callback === 'function') {
          handle_context_menu_callback(k);
        }
      });
      menu.appendChild(li);
    })(key, item['name'] || key);
  }

  document.body.appendChild(menu);

  /* Close on any outside click */
  setTimeout(function() {
    document.addEventListener('click', map2d_close_context_menu, {once: true});
    document.addEventListener('contextmenu', map2d_close_context_menu, {once: true});
  }, 0);
}

/**
 * Remove the 2D map context menu if present.
 */
function map2d_close_context_menu()
{
  var menu = document.getElementById('map2d_context_menu');
  if (menu && menu.parentNode) menu.parentNode.removeChild(menu);
}
