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

/* Panning by mouse-drag */
var map2d_drag_active = false;
var map2d_drag_start_x = 0;
var map2d_drag_start_y = 0;
var map2d_drag_center_x = 0;
var map2d_drag_center_y = 0;
var map2d_drag_moved = false;  /* true if the mouse moved during the current press */

/* Tile under the mouse cursor (for context menu) */
var map2d_mouse_tile = null;

/* ------------------------------------------------------------------ */
/*  Terrain → sprite-tag mapping (Trident tileset naming convention)   */
/* ------------------------------------------------------------------ */

/*
 * For most terrains the Trident tileset provides a single base tile
 * tagged "t.l0.<terrain>1" plus optional directional variants.
 * Directional terrain tags follow the pattern
 * "t.l0.<terrain>_n<0|1>e<0|1>s<0|1>w<0|1>" where each flag
 * indicates whether the same terrain type lies in that direction.
 *
 * Oceanic terrains use the layer-1 naming "t.l1.coast_n…" and
 * "t.l1.floor_n…".
 */
var map2d_terrain_simple = {
  "grassland": true,
  "plains":    true,
  "swamp":     true,
  "tundra":    true,
  "jungle":    true
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

  /* Oceanic terrains use layer-1 tags */
  if (g === "coast" || g === "floor") {
    var dir_tag = "t.l1." + g + "_n" + map2d_neighbor_flag(ptile, g, DIR8_NORTH)
                              + "e" + map2d_neighbor_flag(ptile, g, DIR8_EAST)
                              + "s" + map2d_neighbor_flag(ptile, g, DIR8_SOUTH)
                              + "w" + map2d_neighbor_flag(ptile, g, DIR8_WEST);
    if (sprites_init && sprites[dir_tag]) return dir_tag;
    return "t.l1." + g + "_n0e0s0w0";
  }

  /* Directional land terrains: hills, forest, mountains, desert, arctic */
  var base_dir = "t.l0." + g + "_n" + map2d_neighbor_flag(ptile, g, DIR8_NORTH)
                            + "e" + map2d_neighbor_flag(ptile, g, DIR8_EAST)
                            + "s" + map2d_neighbor_flag(ptile, g, DIR8_SOUTH)
                            + "w" + map2d_neighbor_flag(ptile, g, DIR8_WEST);
  if (sprites_init && sprites[base_dir]) return base_dir;

  /* Simplest directional variant */
  var simple_dir = "t.l0." + g + "_n0e0s0w0";
  if (sprites_init && sprites[simple_dir]) return simple_dir;

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
      map2d_zoom = Math.min(6, map2d_zoom * 1.15);
    } else {
      map2d_zoom = Math.max(0.3, map2d_zoom / 1.15);
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

    if (!map2d_drag_active) return;
    map2d_drag_moved = true;
    var tw = Math.max(1, Math.floor(normal_tile_width  * map2d_zoom));
    var th = Math.max(1, Math.floor(normal_tile_height * map2d_zoom));
    var dx = Math.round((map2d_drag_start_x - e.clientX) / tw);
    var dy = Math.round((map2d_drag_start_y - e.clientY) / th);
    map2d_center_x = map2d_drag_center_x + dx;
    map2d_center_y = map2d_drag_center_y + dy;
    render_2d_map();
  });

  map2d_canvas.addEventListener('mouseup',   function() {
    map2d_drag_active = false;
    map2d_canvas.style.cursor = 'grab';
  });
  map2d_canvas.addEventListener('mouseleave', function() {
    map2d_drag_active = false;
    map2d_canvas.style.cursor = 'grab';
  });
  map2d_canvas.style.cursor = 'grab';

  /* Arrow-key panning (canvas must be focusable) */
  map2d_canvas.setAttribute('tabindex', '0');
  map2d_canvas.addEventListener('keydown', function(e) {
    var step = 3;
    if (e.key === 'ArrowLeft')  { map2d_center_x -= step; render_2d_map(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { map2d_center_x += step; render_2d_map(); e.preventDefault(); }
    if (e.key === 'ArrowUp')    { map2d_center_y -= step; render_2d_map(); e.preventDefault(); }
    if (e.key === 'ArrowDown')  { map2d_center_y += step; render_2d_map(); e.preventDefault(); }
    if (e.key === '+')          { map2d_zoom = Math.min(6, map2d_zoom * 1.2); render_2d_map(); }
    if (e.key === '-')          { map2d_zoom = Math.max(0.3, map2d_zoom / 1.2); render_2d_map(); }
  });

  /* Left-click: select unit on tile (only if not a drag) */
  map2d_canvas.addEventListener('click', function(e) {
    if (map2d_drag_moved) { map2d_drag_moved = false; return; }
    var ptile = map2d_tile_from_event(e);
    if (ptile == null) return;
    var punits = tile_units(ptile);
    if (punits && punits.length > 0) {
      unit_focus_set(punits[0]);
    }
  });

  /* Context menu on right-click */
  map2d_canvas.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    /* Recompute tile at the exact right-click position (mousemove may not
     * have fired at this exact pixel, especially on trackpads). */
    map2d_mouse_tile = map2d_tile_from_event(e);
    map2d_show_context_menu(e);
  });

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
 * Render the full 2D map onto the canvas.
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

  var cw = map2d_canvas.width;
  var ch = map2d_canvas.height;

  /* Tile dimensions at current zoom */
  var tw = Math.max(1, Math.floor(normal_tile_width  * map2d_zoom));
  var th = Math.max(1, Math.floor(normal_tile_height * map2d_zoom));

  /* Clear */
  map2d_ctx.fillStyle = '#000000';
  map2d_ctx.fillRect(0, 0, cw, ch);

  /* How many tiles fit on screen (add 2 as margin) */
  var tiles_x = Math.ceil(cw / tw) + 2;
  var tiles_y = Math.ceil(ch / th) + 2;

  /* Top-left tile in map coordinates */
  var start_x = Math.floor(map2d_center_x - tiles_x / 2);
  var start_y = Math.floor(map2d_center_y - tiles_y / 2);

  /* Pixel offset so the centre tile lands in the middle of the canvas */
  var off_x = Math.floor(cw / 2 - (map2d_center_x - start_x) * tw);
  var off_y = Math.floor(ch / 2 - (map2d_center_y - start_y) * th);

  for (var ty = 0; ty < tiles_y; ty++) {
    var map_y = start_y + ty;
    if (map_y < 0 || map_y >= map['ysize']) continue;

    for (var tx = 0; tx < tiles_x; tx++) {
      /* Wrap x for cylindrical maps */
      var map_x = ((start_x + tx) % map['xsize'] + map['xsize']) % map['xsize'];

      var canvas_x = off_x + tx * tw;
      var canvas_y = off_y + ty * th;

      var ptile = map_pos_to_tile(map_x, map_y);
      render_2d_tile(map2d_ctx, ptile, canvas_x, canvas_y, tw, th);
    }
  }

  /* Draw grid lines (optional, subtle) */
  map2d_draw_grid(cw, ch, tw, th, off_x, off_y);
}

/* ------------------------------------------------------------------ */
/*  Per-tile rendering                                                  */
/* ------------------------------------------------------------------ */

function render_2d_tile(ctx, ptile, cx, cy, tw, th)
{
  if (ptile == null) return;

  var known = tile_get_known(ptile);

  if (known === TILE_UNKNOWN) {
    /* Already black from the clear; nothing to draw */
    return;
  }

  /* --- Terrain --- */
  var pterrain = tile_terrain(ptile);
  var terrain_drawn = false;

  if (pterrain && sprites_init) {
    var tag = get_2d_terrain_sprite_tag(pterrain, ptile);
    var spr = sprites[tag];
    if (spr) {
      ctx.drawImage(spr, cx, cy, tw, th);
      terrain_drawn = true;
    }
  }

  if (!terrain_drawn) {
    var color = '#334';
    if (pterrain) {
      color = map2d_terrain_colors[pterrain['graphic_str']] || '#334';
    }
    ctx.fillStyle = color;
    ctx.fillRect(cx, cy, tw, th);
  }

  /* --- Fog of war overlay --- */
  if (known === TILE_KNOWN_UNSEEN) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(cx, cy, tw, th);
    return; /* Don't draw units/cities under deep fog */
  }

  /* --- Extras: irrigation, mine, roads, railroads, fortress, hut --- */
  map2d_draw_tile_extras(ctx, ptile, cx, cy, tw, th);

  /* --- Territory border --- */
  map2d_draw_border(ctx, ptile, cx, cy, tw, th);

  /* --- City --- */
  var pcity = tile_city(ptile);
  if (pcity != null) {
    map2d_draw_city(ctx, pcity, cx, cy, tw, th);
  }

  /* --- Unit (topmost unit on tile) --- */
  var punits = tile_units(ptile);
  if (punits && punits.length > 0) {
    map2d_draw_unit(ctx, punits[0], cx, cy, tw, th);
    if (punits.length > 1) {
      map2d_draw_unit_count(ctx, punits.length, cx, cy, tw, th);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  City and unit drawing                                               */
/* ------------------------------------------------------------------ */

function map2d_draw_city(ctx, pcity, cx, cy, tw, th)
{
  /* Try to draw the city sprite from the loaded tileset */
  if (sprites_init) {
    var city_sprite = sprites['city.medium_coastal_city']
                   || sprites['city.medium_city']
                   || sprites['city.small_city'];
    if (city_sprite) {
      ctx.drawImage(city_sprite, cx, cy, tw, th);
      map2d_draw_city_label(ctx, pcity, cx, cy, tw, th);
      return;
    }
  }

  /* Fallback: filled circle in the player's colour */
  ctx.fillStyle = map2d_player_color(pcity['owner'], '#ffffff');
  var r = Math.max(3, Math.floor(Math.min(tw, th) * 0.35));
  ctx.beginPath();
  ctx.arc(cx + tw / 2, cy + th / 2, r, 0, 2 * Math.PI);
  ctx.fill();

  map2d_draw_city_label(ctx, pcity, cx, cy, tw, th);
}

function map2d_draw_city_label(ctx, pcity, cx, cy, tw, th)
{
  if (tw < 20) return; /* too small to be readable */
  var name = pcity['name'] || '';
  ctx.font = Math.max(8, Math.floor(th * 0.45)) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.strokeText(name, cx + tw / 2, cy + th + 1);
  ctx.fillText(name, cx + tw / 2, cy + th + 1);
}

function map2d_draw_unit(ctx, punit, cx, cy, tw, th)
{
  /* Try unit sprite */
  if (sprites_init) {
    var tag = tileset_unit_graphic_tag(punit);
    if (tag && sprites[tag]) {
      ctx.drawImage(sprites[tag], cx, cy, tw, th);
      return;
    }
  }

  /* Fallback: small coloured rectangle */
  var us = Math.max(4, Math.floor(Math.min(tw, th) * 0.4));
  ctx.fillStyle = map2d_player_color(punit['owner'], '#ffff00');
  ctx.fillRect(cx + Math.floor((tw - us) / 2), cy + Math.floor((th - us) / 2), us, us);
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

  /* --- Irrigation (light blue diagonal lines) --- */
  if (typeof EXTRA_IRRIGATION !== 'undefined' && tile_has_extra(ptile, EXTRA_IRRIGATION)) {
    var spr = sprites_init && sprites['tx.irrigation'];
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
    var spr = sprites_init && sprites['tx.mine'];
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
    var spr = sprites_init && sprites['base.fortress_fg'];
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
    var spr = sprites_init && sprites['tx.pollution'];
    if (spr) {
      ctx.drawImage(spr, cx, cy, tw, th);
    } else {
      ctx.fillStyle = 'rgba(180,0,0,0.5)';
      ctx.fillRect(cx, cy, tw, th);
    }
  }

  /* --- Hut / minor tribe village --- */
  if (typeof EXTRA_HUT !== 'undefined' && tile_has_extra(ptile, EXTRA_HUT)) {
    var spr = sprites_init && sprites['tx.village'];
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
 * Draw a thin colored border on tile edges that border a different owner.
 */
function map2d_draw_border(ctx, ptile, cx, cy, tw, th)
{
  var owner = tile_owner(ptile);
  if (owner == null) return;

  var border_color = map2d_player_color(owner, null);
  if (!border_color) return;

  ctx.save();
  ctx.strokeStyle = border_color;
  ctx.lineWidth = Math.max(1, Math.floor(tw * 0.08));
  ctx.globalAlpha = 0.6;

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
    var ntile = map_pos_to_tile(nx, ny);
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

  var tw = Math.max(1, Math.floor(normal_tile_width  * map2d_zoom));
  var th = Math.max(1, Math.floor(normal_tile_height * map2d_zoom));

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
    if (punits && punits.length > 0 && typeof unit_focus_set === 'function') {
      unit_focus_set(punits[0]);
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
