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
    map2d_drag_start_x  = e.clientX;
    map2d_drag_start_y  = e.clientY;
    map2d_drag_center_x = map2d_center_x;
    map2d_drag_center_y = map2d_center_y;
    map2d_canvas.style.cursor = 'grabbing';
  });

  map2d_canvas.addEventListener('mousemove', function(e) {
    if (!map2d_drag_active) return;
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

  /* --- City --- */
  var pcity = tile_city(ptile);
  if (pcity != null) {
    map2d_draw_city(ctx, pcity, cx, cy, tw, th);
  }

  /* --- Unit (topmost unit on tile) --- */
  var punits = tile_units(ptile);
  if (punits && punits.length > 0) {
    map2d_draw_unit(ctx, punits[0], cx, cy, tw, th);
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
