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
 * 2D Map Canvas Controls (mapctrl2d.js)
 *
 * Contains all input handling for the 2D map canvas:
 *  - Mouse wheel zoom
 *  - Mouse drag panning
 *  - Mouse click (unit selection / goto destination)
 *  - Right-click context menu
 *  - Keyboard arrow-key panning
 *  - Touch controls: single-finger pan, two-finger pinch-zoom,
 *    and tap to always show context menu
 *
 * All event listeners use jQuery .on() / .off().
 * No setTimeout or other deferred logic is used here.
 *
 * Public API
 * ----------
 *  init_2d_map_controls()  – attach all event listeners to the canvas
 */

/* ------------------------------------------------------------------ */
/*  Control state                                                       */
/* ------------------------------------------------------------------ */

/* Panning by mouse-drag / touch */
var map2d_drag_active   = false;
var map2d_drag_start_x  = 0;
var map2d_drag_start_y  = 0;
var map2d_drag_center_x = 0;
var map2d_drag_center_y = 0;
var map2d_drag_moved    = false; /* true if pointer moved during current press */

/* Pinch-zoom state (two-finger touch) */
var map2d_pinch_start_dist = 0;
var map2d_pinch_start_zoom = 1.0;

/* Timestamp of the last touch-tap that showed the context menu.
 * Used to suppress the synthetic 'click' Chrome Android fires ~300 ms
 * after every touchend so it does not re-trigger map logic. */
var map2d_touch_ctx_time = 0;

/* ------------------------------------------------------------------ */
/*  Event handler setup                                                 */
/* ------------------------------------------------------------------ */

/**
 * Attach all mouse, keyboard, and touch event listeners to the 2D map
 * canvas using jQuery.  Called once from init_2d_map_canvas() in
 * map2d.js after the canvas element has been obtained.
 */
function init_2d_map_controls()
{
  if (!map2d_canvas) return;

  var $canvas = $(map2d_canvas);

  /* ---- Mouse-wheel zoom ------------------------------------------ */
  /* jQuery on a <canvas> uses non-passive listeners, so preventDefault()
   * works correctly here without needing native addEventListener options. */
  $canvas.on('wheel', function(e) {
    e.preventDefault();
    var delta = e.originalEvent.deltaY;
    if (delta < 0) {
      map2d_zoom = Math.min(MAP2D_MAX_ZOOM, map2d_zoom * 1.15);
    } else {
      map2d_zoom = Math.max(MAP2D_MIN_ZOOM, map2d_zoom / 1.15);
    }
    render_2d_map();
  });

  /* ---- Mouse-drag panning ---------------------------------------- */
  $canvas.on('mousedown', function(e) {
    map2d_drag_active   = true;
    map2d_drag_moved    = false;
    map2d_drag_start_x  = e.clientX;
    map2d_drag_start_y  = e.clientY;
    map2d_drag_center_x = map2d_center_x;
    map2d_drag_center_y = map2d_center_y;
    map2d_canvas.style.cursor = 'grabbing';
  });

  $canvas.on('mousemove', function(e) {
    /* Track tile under cursor for context menu and click handling */
    map2d_mouse_tile = map2d_tile_from_event(e);
    map2d_update_mouse_cursor();

    /* Update goto preview when goto mode is active (don't pan in goto mode) */
    if (typeof goto_active !== 'undefined' && goto_active) {
      map2d_update_goto_preview(map2d_mouse_tile);
      return;
    }

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

  $canvas.on('mouseup', function() {
    map2d_drag_active = false;
    map2d_update_mouse_cursor();
  });

  $canvas.on('mouseleave', function() {
    map2d_drag_active = false;
    map2d_canvas.style.cursor = 'grab';
  });

  map2d_canvas.style.cursor = 'grab';

  /* ---- Arrow-key panning ----------------------------------------- */
  /* Canvas must be focusable; stopPropagation prevents arrow keys from
   * also triggering unit-movement in the global keyboard listener. */
  map2d_canvas.setAttribute('tabindex', '0');
  $canvas.on('keydown', function(e) {
    var step = 3;
    if (e.key === 'ArrowLeft')  { map2d_center_x -= step; render_2d_map(); e.preventDefault(); e.stopPropagation(); return; }
    if (e.key === 'ArrowRight') { map2d_center_x += step; render_2d_map(); e.preventDefault(); e.stopPropagation(); return; }
    if (e.key === 'ArrowUp')    { map2d_center_y -= step; render_2d_map(); e.preventDefault(); e.stopPropagation(); return; }
    if (e.key === 'ArrowDown')  { map2d_center_y += step; render_2d_map(); e.preventDefault(); e.stopPropagation(); return; }
    if (e.key === '+')          { map2d_zoom = Math.min(MAP2D_MAX_ZOOM, map2d_zoom * 1.2); render_2d_map(); }
    if (e.key === '-')          { map2d_zoom = Math.max(MAP2D_MIN_ZOOM, map2d_zoom / 1.2); render_2d_map(); }
  });

  /* ---- Left-click: unit selection / context menu ----------------- */
  /* Suppress synthetic clicks that Chrome Android fires ~300 ms after
   * a touchend which already showed the context menu. */
  $canvas.on('click', function(e) {
    if (map2d_drag_moved) { map2d_drag_moved = false; return; }
    if (Date.now() - map2d_touch_ctx_time < 500) return;
    map2d_last_event_pos = {clientX: e.clientX, clientY: e.clientY};
    var ptile = map2d_tile_from_event(e);
    if (ptile == null) return;
    map2d_handle_tile_click(ptile, e);
    e.stopPropagation(); /* keep close-on-outside listener from firing */
  });

  /* ---- Right-click context menu ---------------------------------- */
  $canvas.on('contextmenu', function(e) {
    e.preventDefault();
    e.stopPropagation(); /* keep close-on-outside listener from firing */
    map2d_mouse_tile = map2d_tile_from_event(e);
    map2d_show_context_menu(e);
  });

  /* ----------------------------------------------------------------
   * Touch controls – simple and always working
   *
   * Single-finger drag = pan
   * Two-finger pinch   = zoom
   * Tap (no drag)      = context menu ALWAYS shown
   *
   * jQuery on a <canvas> uses non-passive listeners, so preventDefault()
   * inside touchstart/touchmove works correctly to block page scrolling.
   * ---------------------------------------------------------------- */
  $canvas.on('touchstart', function(e) {
    e.preventDefault();
    var oe = e.originalEvent;
    if (oe.touches.length === 1) {
      var t = oe.touches[0];
      map2d_drag_active   = true;
      map2d_drag_moved    = false;
      map2d_drag_start_x  = t.clientX;
      map2d_drag_start_y  = t.clientY;
      map2d_drag_center_x = map2d_center_x;
      map2d_drag_center_y = map2d_center_y;
    } else if (oe.touches.length === 2) {
      map2d_drag_active = false;
      var t1 = oe.touches[0];
      var t2 = oe.touches[1];
      map2d_pinch_start_dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      map2d_pinch_start_zoom = map2d_zoom;
    }
  });

  $canvas.on('touchmove', function(e) {
    e.preventDefault();
    var oe = e.originalEvent;
    if (oe.touches.length === 1 && map2d_drag_active) {
      var t = oe.touches[0];
      map2d_drag_moved = true;
      var tw = Math.max(1, Math.floor(map2d_tileset_config['normal_tile_width']  * map2d_zoom));
      var th = Math.max(1, Math.floor(map2d_tileset_config['normal_tile_height'] * map2d_zoom));
      var dx = Math.round((map2d_drag_start_x - t.clientX) / tw);
      var dy = Math.round((map2d_drag_start_y - t.clientY) / th);
      map2d_center_x = map2d_drag_center_x + dx;
      map2d_center_y = map2d_drag_center_y + dy;
      render_2d_map();
    } else if (oe.touches.length === 2 && map2d_pinch_start_dist > 0) {
      var t1 = oe.touches[0];
      var t2 = oe.touches[1];
      var dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      map2d_zoom = Math.max(MAP2D_MIN_ZOOM, Math.min(MAP2D_MAX_ZOOM,
                    map2d_pinch_start_zoom * dist / map2d_pinch_start_dist));
      render_2d_map();
    }
  });

  $canvas.on('touchend', function(e) {
    e.preventDefault();
    var oe = e.originalEvent;
    /* Tap (no drag): ALWAYS show the context menu */
    if (oe.touches.length === 0 && !map2d_drag_moved && oe.changedTouches.length > 0) {
      var ct = oe.changedTouches[0];
      var touch_pos = {clientX: ct.clientX, clientY: ct.clientY};
      map2d_last_event_pos = touch_pos;
      var ptile = map2d_tile_from_event(touch_pos);
      if (ptile != null) {
        map2d_mouse_tile = ptile;
        map2d_touch_ctx_time = Date.now(); /* suppress the following synthetic click */
        map2d_show_context_menu(touch_pos);
        render_2d_map();
      }
      e.stopPropagation(); /* keep close-on-outside listener from firing */
    }
    map2d_drag_active      = false;
    map2d_drag_moved       = false;
    map2d_pinch_start_dist = 0;
  });

  $canvas.on('touchcancel', function() {
    map2d_drag_active      = false;
    map2d_drag_moved       = false;
    map2d_pinch_start_dist = 0;
  });
}
