/**********************************************************************
    Freeciv-web - 2D Map Canvas Controls (Goto & Panning)
***********************************************************************/

/* Panning state */
var map2d_drag_active   = false;
var map2d_drag_moved    = false;
var map2d_start_x       = 0;
var map2d_start_y       = 0;
var map2d_start_center_x = 0;
var map2d_start_center_y = 0;

/* Goto drag state */
var map2d_is_goto_drag  = false;
var map2d_goto_unit     = null;

/* Pinch-zoom state */
var map2d_pinch_dist    = 0;
var map2d_pinch_zoom    = 1.0;

function init_2d_map_controls() {
  if (!map2d_canvas) return;
  var $canvas = $(map2d_canvas);

  /* ---- Zoom (Wheel) ---- */
  $canvas.on('wheel', function(e) {
    e.preventDefault();
    var delta = e.originalEvent.deltaY;
    var factor = delta < 0 ? 1.15 : 1 / 1.15;
    map2d_zoom = Math.max(MAP2D_MIN_ZOOM, Math.min(MAP2D_MAX_ZOOM, map2d_zoom * factor));
    render_2d_map();
  });

  /* ---- Unified Press (Mouse & Touch) ---- */
  $canvas.on('mousedown touchstart', function(e) {
    var isTouch = e.type === 'touchstart';
    var ptr = isTouch ? e.originalEvent.touches[0] : e;

    // Ignore right-click for dragging
    if (!isTouch && e.button === 2) return;

    map2d_drag_active = true;
    map2d_drag_moved = false;
    map2d_is_goto_drag = false;

    map2d_start_x = ptr.clientX;
    map2d_start_y = ptr.clientY;
    map2d_start_center_x = map2d_center_x;
    map2d_start_center_y = map2d_center_y;

    // Check if we are starting a drag on a unit for a "Goto" action
    var start_tile = map2d_tile_from_event(ptr);
    if (start_tile) {
      var units = tile_units(start_tile);
      if (units && units.length > 0) {
        // Use the first unit on the tile (or focused unit if preferred)
        map2d_goto_unit = units[0];
      } else {
        map2d_goto_unit = null;
      }
    }

    if (isTouch && e.originalEvent.touches.length === 2) {
      var t1 = e.originalEvent.touches[0];
      var t2 = e.originalEvent.touches[1];
      map2d_pinch_dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      map2d_pinch_zoom = map2d_zoom;
      map2d_drag_active = false;
    }
  });

  /* ---- Unified Move ---- */
  $(window).on('mousemove touchmove', function(e) {
    if (!map2d_drag_active) return;

    var isTouch = e.type === 'touchmove';
    var ptr = isTouch ? e.originalEvent.touches[0] : e;
    var dx = ptr.clientX - map2d_start_x;
    var dy = ptr.clientY - map2d_start_y;

    // Distance threshold (6px) to distinguish Tap vs Drag
    if (Math.hypot(dx, dy) > 6) {
      map2d_drag_moved = true;
      map2d_mouse_tile = map2d_tile_from_event(ptr);

      // Decision: Are we performing a Goto or Panning?
      if (map2d_goto_unit && !map2d_is_goto_drag) {
        // If we started on a unit, switch to Goto mode
        map2d_is_goto_drag = true;
        if (typeof set_unit_focus_and_redraw === 'function') {
          set_unit_focus_and_redraw(map2d_goto_unit);
        }
      }

      if (map2d_is_goto_drag) {
        // GOTO MODE: Update visual preview path
        if (typeof map2d_update_goto_preview === 'function') {
          map2d_update_goto_preview(map2d_mouse_tile);
        }
      } else {
        // PAN MODE: Move the map
        var tw = Math.floor(map2d_tileset_config.normal_tile_width * map2d_zoom);
        var th = Math.floor(map2d_tileset_config.normal_tile_height * map2d_zoom);
        map2d_center_x = map2d_start_center_x - Math.round(dx / tw);
        map2d_center_y = map2d_start_center_y - Math.round(dy / th);
        render_2d_map();
      }
    }

    if (isTouch) e.preventDefault();
  });

  /* ---- Unified Release ---- */
  $(window).on('mouseup touchend', function(e) {
    if (!map2d_drag_active) return;
    map2d_drag_active = false;

    if (map2d_is_goto_drag) {
      // Execute the Goto command
      if (map2d_mouse_tile && map2d_goto_unit) {
        if (typeof unit_goto_tile === 'function') {
          unit_goto_tile(map2d_goto_unit, map2d_mouse_tile);
        }
      }
      // Clear preview
      if (typeof map2d_clear_goto_preview === 'function') {
        map2d_clear_goto_preview();
      }
      map2d_is_goto_drag = false;
      return; // Stop here so no context menu appears
    }

    // Handle Tap (if didn't drag)
    if (!map2d_drag_moved) {
      var isTouch = e.type === 'touchend';
      var ptr = isTouch ? e.originalEvent.changedTouches[0] : e;
      map2d_mouse_tile = map2d_tile_from_event(ptr);

      if (isTouch || e.button === 2) {
        map2d_show_context_menu(ptr);
      } else {
        map2d_handle_tile_click(map2d_mouse_tile, e);
      }
    }
  });

  /* ---- Keyboard & Context Menu Cleanup ---- */
  $canvas.on('contextmenu', function(e) { e.preventDefault(); });
  $canvas.attr('tabindex', '0').on('keydown', function(e) {
    var step = 3;
    if (e.key === 'ArrowLeft')  { map2d_center_x -= step; render_2d_map(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { map2d_center_x += step; render_2d_map(); e.preventDefault(); }
    if (e.key === 'ArrowUp')    { map2d_center_y -= step; render_2d_map(); e.preventDefault(); }
    if (e.key === 'ArrowDown')  { map2d_center_y += step; render_2d_map(); e.preventDefault(); }
  });
}

/**
 * Robust Context Menu
 */
function map2d_show_context_menu(pos) {
  map2d_close_context_menu();

  var items = (typeof update_unit_order_commands === 'function') ? update_unit_order_commands() : {};
  items['tile_info'] = { name: 'Tile Info', icon: 'fa-info-circle' };

  var $menu = $('<ul id="map2d_context_menu"></ul>').css({
    position: 'fixed',
    left: pos.clientX,
    top: pos.clientY,
    background: '#1a1a2e',
    color: '#eee',
    border: '1px solid #444',
    padding: '5px 0',
    listStyle: 'none',
    zIndex: 10000,
    borderRadius: '4px',
    minWidth: '150px',
    boxShadow: '2px 2px 10px rgba(0,0,0,0.5)'
  });

  $.each(items, function(key, val) {
    $('<li>')
      .text(val.name || key)
      .css({ padding: '8px 15px', cursor: 'pointer' })
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

  setTimeout(function() {
    $(document).one('mousedown touchstart', function(e) {
      if (!$('#map2d_context_menu').has(e.target).length) map2d_close_context_menu();
    });
  }, 10);
}

function map2d_close_context_menu() {
  $('#map2d_context_menu').remove();
}