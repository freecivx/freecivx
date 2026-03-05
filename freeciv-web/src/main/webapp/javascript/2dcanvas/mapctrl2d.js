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

/* ------------------------------------------------------------------ */
/*  Event handler setup                                                 */
/* ------------------------------------------------------------------ */

/**
 * Attach all mouse, keyboard, and touch event listeners to the 2D map
 * canvas.  Called once from init_2d_map_canvas() in map2d.js after the
 * canvas element has been obtained.
 */
function init_2d_map_controls()
{
  if (!map2d_canvas) return;

  /* ---- Mouse-wheel zoom ------------------------------------------ */
  map2d_canvas.addEventListener('wheel', function(e) {
    e.preventDefault();
    if (e.deltaY < 0) {
      map2d_zoom = Math.min(MAP2D_MAX_ZOOM, map2d_zoom * 1.15);
    } else {
      map2d_zoom = Math.max(MAP2D_MIN_ZOOM, map2d_zoom / 1.15);
    }
    render_2d_map();
  }, { passive: false });

  /* ---- Mouse-drag panning ---------------------------------------- */
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

  map2d_canvas.addEventListener('mouseup', function() {
    map2d_drag_active = false;
    map2d_update_mouse_cursor();
  });

  map2d_canvas.addEventListener('mouseleave', function() {
    map2d_drag_active = false;
    map2d_canvas.style.cursor = 'grab';
  });

  map2d_canvas.style.cursor = 'grab';

  /* ---- Arrow-key panning ----------------------------------------- */
  /* Canvas must be focusable; stopPropagation prevents arrow keys from
   * also triggering unit-movement in the global keyboard listener. */
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

  /* ---- Left-click: unit selection / goto destination -------------- */
  map2d_canvas.addEventListener('click', function(e) {
    if (map2d_drag_moved) { map2d_drag_moved = false; return; }
    map2d_last_event_pos = {clientX: e.clientX, clientY: e.clientY};
    var ptile = map2d_tile_from_event(e);
    if (ptile == null) return;
    map2d_handle_tile_click(ptile, e);
  });

  /* ---- Right-click context menu ---------------------------------- */
  map2d_canvas.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    map2d_mouse_tile = map2d_tile_from_event(e);
    map2d_show_context_menu(e);
  });

  /* ----------------------------------------------------------------
   * Touch controls – simple and always working
   *
   * Single-finger drag = pan
   * Two-finger pinch   = zoom
   * Tap (no drag)      = context menu ALWAYS shown
   * ---------------------------------------------------------------- */
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
      map2d_zoom = Math.max(MAP2D_MIN_ZOOM, Math.min(MAP2D_MAX_ZOOM,
                    map2d_pinch_start_zoom * dist / map2d_pinch_start_dist));
      render_2d_map();
    }
  }, { passive: false });

  map2d_canvas.addEventListener('touchend', function(e) {
    e.preventDefault();
    /* Tap (no drag): ALWAYS show the context menu */
    if (e.touches.length === 0 && !map2d_drag_moved && e.changedTouches.length > 0) {
      var ct = e.changedTouches[0];
      var touch_pos = {clientX: ct.clientX, clientY: ct.clientY};
      map2d_last_event_pos = touch_pos;
      var ptile = map2d_tile_from_event(touch_pos);
      if (ptile != null) {
        map2d_mouse_tile = ptile;
        map2d_show_context_menu(touch_pos);
        render_2d_map();
      }
    }
    map2d_drag_active      = false;
    map2d_drag_moved       = false;
    map2d_pinch_start_dist = 0;
  }, { passive: false });

  map2d_canvas.addEventListener('touchcancel', function() {
    map2d_drag_active      = false;
    map2d_drag_moved       = false;
    map2d_pinch_start_dist = 0;
  }, { passive: false });
}
