/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2026  The Freeciv-web project

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License...
***********************************************************************/

/**
 * 2D Map Canvas Controls (mapctrl2d.js)
 * * Logic flow:
 * 1. Pointer Down -> Store start position & check for unit.
 * 2. Pointer Move -> If distance > 8px:
 * - If started on unit: Enter GOTO mode (draw path).
 * - If started on terrain: Enter PAN mode (move map).
 * 3. Pointer Up ->
 * - If GOTO: Execute move.
 * - If PAN: Stop.
 * - If NO MOVEMENT (Tap): Show Context Menu (Mobile/Right-click) or Select (Left-click).
 */

/* ------------------------------------------------------------------ */
/* Control State                                                     */
/* ------------------------------------------------------------------ */
var map2d_drag = {
  active: false,    // Is the user currently pressing down?
  moved: false,     // Has the pointer moved past the threshold?
  is_goto: false,   // Are we currently dragging a unit path?
  unit: null,       // The unit being dragged (if any)
  start_x: 0,       // Initial screen X
  start_y: 0,       // Initial screen Y
  start_cx: 0,      // Map center X at start
  start_cy: 0       // Map center Y at start
};

var map2d_pinch_start_dist = 0;
var map2d_pinch_start_zoom = 1.0;

/* ------------------------------------------------------------------ */
/* Initialization                                                    */
/* ------------------------------------------------------------------ */

function init_2d_map_controls() {
  if (!map2d_canvas) return;
  var $canvas = $(map2d_canvas);

  /* ---- Mouse-wheel zoom ------------------------------------------ */
  $canvas.on('wheel', function(e) {
    e.preventDefault();
    var delta = e.originalEvent.deltaY;
    var factor = delta < 0 ? 1.15 : 1 / 1.15;
    map2d_zoom = Math.max(MAP2D_MIN_ZOOM, Math.min(MAP2D_MAX_ZOOM, map2d_zoom * factor));
    render_2d_map();
  });

  /* ---- Pointer Down (Mouse & Touch) ------------------------------ */
  $canvas.on('mousedown touchstart', function(e) {
    var isTouch = e.type === 'touchstart';
    var ptr = isTouch ? e.originalEvent.touches[0] : e;

    // Right-click (button 2) logic handled by Context Menu release
    if (!isTouch && e.button === 2) return;

    var start_tile = map2d_tile_from_event(ptr);
    var units = start_tile ? tile_units(start_tile) : null;

    // Initialize drag state
    map2d_drag.active = true;
    map2d_drag.moved = false;
    map2d_drag.is_goto = false;
    map2d_drag.unit = (units && units.length > 0) ? units[0] : null;
    map2d_drag.start_tile = start_tile;
    map2d_drag.start_x = ptr.clientX;
    map2d_drag.start_y = ptr.clientY;
    map2d_drag.start_cx = map2d_center_x;
    map2d_drag.start_cy = map2d_center_y;

    // Handle Pinch-Zoom Start
    if (isTouch && e.originalEvent.touches.length === 2) {
      map2d_drag.active = false; // Disable panning during pinch
      var t1 = e.originalEvent.touches[0];
      var t2 = e.originalEvent.touches[1];
      map2d_pinch_start_dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      map2d_pinch_start_zoom = map2d_zoom;
    }
  });

  /* ---- Mouse Hover (Canvas-level, no drag required) -------------- */
  $canvas.on('mousemove', function(e) {
    if (map2d_drag.active) return; // Handled by window-level handler below
    map2d_mouse_tile = map2d_tile_from_event(e);
    if (typeof map2d_update_mouse_cursor === 'function') map2d_update_mouse_cursor();
  });

  /* ---- Mouse Leave (reset cursor when pointer leaves the canvas) -- */
  $canvas.on('mouseleave', function() {
    map2d_mouse_tile = null;
    if (!map2d_drag.active && map2d_canvas) {
      map2d_canvas.style.cursor = 'default';
    }
  });

  /* ---- Pointer Move (Window-level for smoothness) ---------------- */
  $(window).on('mousemove touchmove', function(e) {
    if (!map2d_drag.active) return;

    var isTouch = e.type === 'touchmove';
    var ptr = isTouch ? e.originalEvent.touches[0] : e;
    var dx = ptr.clientX - map2d_drag.start_x;
    var dy = ptr.clientY - map2d_drag.start_y;

    // Distance threshold to differentiate Tap vs Drag:
    // $Distance = \sqrt{\Delta x^2 + \Delta y^2}$
    if (!map2d_drag.moved && Math.hypot(dx, dy) > 8) {
      map2d_drag.moved = true;

      // If we started on a unit, this drag becomes a GOTO action
      if (map2d_drag.unit) {
        map2d_drag.is_goto = true;
        if (typeof set_unit_focus === 'function') set_unit_focus(map2d_drag.unit);
        if (typeof activate_goto === 'function') activate_goto();
      }
    }

    if (map2d_drag.moved) {
      var current_tile = map2d_tile_from_event(ptr);
      map2d_mouse_tile = current_tile;

      if (map2d_drag.is_goto) {
        /* GOTO MODE: Draw Path */
        if (typeof map2d_update_goto_preview === 'function') {
          map2d_update_goto_preview(current_tile);
        }
      } else {
        /* PAN MODE: Move Map */
        var tw = Math.floor(map2d_tileset_config.normal_tile_width * map2d_zoom);
        var th = Math.floor(map2d_tileset_config.normal_tile_height * map2d_zoom);
        map2d_center_x = map2d_drag.start_cx - Math.round(dx / tw);
        map2d_center_y = map2d_drag.start_cy - Math.round(dy / th);
        render_2d_map();
      }
    }

    if (isTouch) e.preventDefault(); // Prevent browser scroll
  });

  /* ---- Pinch Zoom Move ------------------------------------------- */
  $canvas.on('touchmove', function(e) {
    var oe = e.originalEvent;
    if (oe.touches.length === 2 && map2d_pinch_start_dist > 0) {
      e.preventDefault();
      var t1 = oe.touches[0], t2 = oe.touches[1];
      var dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      map2d_zoom = Math.max(MAP2D_MIN_ZOOM, Math.min(MAP2D_MAX_ZOOM,
                    map2d_pinch_start_zoom * dist / map2d_pinch_start_dist));
      render_2d_map();
    }
  });

  /* ---- Pointer Up (Release) -------------------------------------- */
  $(window).on('mouseup touchend', function(e) {
    if (!map2d_drag.active) return;

    var was_goto = map2d_drag.is_goto;
    var was_moved = map2d_drag.moved;
    var unit = map2d_drag.unit;

    map2d_drag.active = false;

    if (was_goto) {
      /* EXECUTE GOTO: use do_map_click which handles goto_active and
       * sends the unit orders, then calls deactivate_goto() to clean up. */
      var ptr = e.type === 'touchend' ? e.originalEvent.changedTouches[0] : e;
      var target_tile = map2d_tile_from_event(ptr);
      if (target_tile && typeof do_map_click === 'function') {
        do_map_click(target_tile, SELECT_POPUP, true);
      } else if (typeof deactivate_goto === 'function') {
        deactivate_goto(false);
      }
      return;
    }

    if (!was_moved) {
      /* TAP / CLICK ACTION */
      var ptr = e.type === 'touchend' ? e.originalEvent.changedTouches[0] : e;
      var tile = map2d_tile_from_event(ptr);

      if (e.type === 'touchend' || e.button === 2) {
        // Mobile tap OR Right-click: Show Context Menu
        map2d_mouse_tile = tile;
        map2d_show_context_menu(ptr);
      } else if (tile) {
        // Standard Left-click: Select unit
        map2d_handle_tile_click(tile, e);
      }
    }

    // Reset cursor based on tile under pointer now that drag has ended.
    // Skip on touchend: touch devices have no persistent hover state.
    if (e.type !== 'touchend' && typeof map2d_update_mouse_cursor === 'function') {
      map2d_update_mouse_cursor();
    }
  });

  /* ---- Keyboard-goto hover path preview (desktop) --------------- */
  /* When goto is activated via the 'g' key (not drag), track the mouse
   * over the canvas and keep the dashed-line preview up to date. */
  $canvas.on('mousemove', function(e) {
    if (map2d_drag.active) return; // drag mode is handled by the window handler
    if (typeof goto_active === 'undefined' || !goto_active) return;
    var current_tile = map2d_tile_from_event(e);
    map2d_mouse_tile = current_tile;
    if (typeof map2d_update_goto_preview === 'function') {
      map2d_update_goto_preview(current_tile);
    }
  });

  /* ---- Final Cleanup & Keyboard ---------------------------------- */
  $canvas.on('contextmenu', function(e) { e.preventDefault(); });

  $canvas.attr('tabindex', '0').on('keydown', function(e) {
    var step = 3;
    if (e.key === 'ArrowLeft')  { map2d_center_x -= step; render_2d_map(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { map2d_center_x += step; render_2d_map(); e.preventDefault(); }
    if (e.key === 'ArrowUp')    { map2d_center_y -= step; render_2d_map(); e.preventDefault(); }
    if (e.key === 'ArrowDown')  { map2d_center_y += step; render_2d_map(); e.preventDefault(); }
  });
}

/* ------------------------------------------------------------------ */
/* Context Menu UI                                                   */
/* ------------------------------------------------------------------ */

function map2d_show_context_menu(pos) {
  map2d_close_context_menu();

  // Focus unit on the tile if applicable
  if (map2d_mouse_tile) {
    var punits = tile_units(map2d_mouse_tile);
    if (punits?.length > 0 && typeof set_unit_focus_and_redraw === 'function') {
      set_unit_focus_and_redraw(punits[0]);
    }
  }

  var items = (typeof update_unit_order_commands === 'function') ? update_unit_order_commands() : {};
  items['tile_info'] = { name: 'Tile Info', icon: 'fa-info-circle' };

  var $menu = $('<ul id="map2d_context_menu"></ul>').css({
    position: 'fixed',
    left: pos.clientX + 'px',
    top: pos.clientY + 'px',
    background: '#1a1a2e',
    color: '#eee',
    border: '1px solid #444',
    padding: '5px 0',
    listStyle: 'none',
    zIndex: 10000,
    borderRadius: '4px',
    minWidth: '160px',
    boxShadow: '4px 4px 15px rgba(0,0,0,0.6)',
    font: '14px sans-serif'
  });

  $.each(items, function(key, val) {
    $('<li>')
      .text(val.name || key)
      .css({ padding: '10px 18px', cursor: 'pointer', whiteSpace: 'nowrap' })
      .hover(function() { $(this).css('background', '#2a2a4e'); }, function() { $(this).css('background', ''); })
      .on('click touchend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        map2d_close_context_menu();
        if (key === 'tile_info') {
          if (typeof popit_req === 'function') popit_req(map2d_mouse_tile);
        } else if (typeof handle_context_menu_callback === 'function') {
          handle_context_menu_callback(key);
        }
      })
      .appendTo($menu);
  });

  $('body').append($menu);

  // Close when clicking outside
  setTimeout(function() {
    $(document).one('mousedown touchstart', function(e) {
      if (!$('#map2d_context_menu').has(e.target).length) map2d_close_context_menu();
    });
  }, 10);
}

function map2d_close_context_menu() {
  $('#map2d_context_menu').remove();
}