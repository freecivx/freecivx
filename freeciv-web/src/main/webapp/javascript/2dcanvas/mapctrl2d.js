/**
 * 2D Map Canvas Controls (jQuery Simplified)
 * Ensures robust "Tap for Context Menu" on mobile.
 */

var map2d_drag_active = false;
var map2d_drag_moved = false;
var map2d_start_x = 0;
var map2d_start_y = 0;
var map2d_start_center_x = 0;
var map2d_start_center_y = 0;

var map2d_pinch_dist = 0;
var map2d_pinch_zoom = 1.0;

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
    map2d_start_x = ptr.clientX;
    map2d_start_y = ptr.clientY;
    map2d_start_center_x = map2d_center_x;
    map2d_start_center_y = map2d_center_y;

    if (isTouch && e.originalEvent.touches.length === 2) {
      var t1 = e.originalEvent.touches[0];
      var t2 = e.originalEvent.touches[1];
      map2d_pinch_dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      map2d_pinch_zoom = map2d_zoom;
      map2d_drag_active = false; // Pinch overrides pan
    }
  });

  /* ---- Unified Move ---- */
  $(window).on('mousemove touchmove', function(e) {
    if (!map2d_drag_active) return;

    var isTouch = e.type === 'touchmove';
    var ptr = isTouch ? e.originalEvent.touches[0] : e;

    var dx = ptr.clientX - map2d_start_x;
    var dy = ptr.clientY - map2d_start_y;

    // Distinguish Tap from Drag (threshold of 6 pixels)
    if (Math.hypot(dx, dy) > 6) {
      map2d_drag_moved = true;
      var tw = Math.floor(map2d_tileset_config.normal_tile_width * map2d_zoom);
      var th = Math.floor(map2d_tileset_config.normal_tile_height * map2d_zoom);

      map2d_center_x = map2d_start_center_x - Math.round(dx / tw);
      map2d_center_y = map2d_start_center_y - Math.round(dy / th);
      render_2d_map();
    }

    if (isTouch) e.preventDefault(); // Prevent scrolling while panning
  });

  /* ---- Unified Release (The Tap Logic) ---- */
  $(window).on('mouseup touchend', function(e) {
    if (!map2d_drag_active) return;
    map2d_drag_active = false;

    // If we didn't drag significantly, it's a CLICK/TAP
    if (!map2d_drag_moved) {
      var isTouch = e.type === 'touchend';
      var ptr = isTouch ? e.originalEvent.changedTouches[0] : e;

      map2d_mouse_tile = map2d_tile_from_event(ptr);

      if (isTouch || e.button === 2) {
        // Mobile tap OR Right-click always shows menu
        map2d_show_context_menu(ptr);
      } else {
        // Regular left-click selects unit
        map2d_handle_tile_click(map2d_mouse_tile, e);
      }
    }
  });

  /* ---- Cleanup & Helpers ---- */
  $canvas.on('contextmenu', function(e) { e.preventDefault(); });

  $canvas.attr('tabindex', '0').on('keydown', function(e) {
    var step = 3;
    if (e.key.includes('Arrow')) {
      if (e.key === 'ArrowLeft')  map2d_center_x -= step;
      if (e.key === 'ArrowRight') map2d_center_x += step;
      if (e.key === 'ArrowUp')    map2d_center_y -= step;
      if (e.key === 'ArrowDown')  map2d_center_y += step;
      e.preventDefault();
      render_2d_map();
    }
  });
}

/**
 * Modern Context Menu (Robust)
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
    minWidth: '150px'
  });

  $.each(items, function(key, val) {
    $('<li>')
      .text(val.name || key)
      .css({ padding: '8px 15px', cursor: 'pointer' })
      .hover(function() { $(this).css('background', '#333'); }, function() { $(this).css('background', ''); })
      .on('click touchend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        map2d_close_context_menu();
        if (key === 'tile_info') {
          if (typeof popit_req === 'function') popit_req(map2d_mouse_tile);
        } else {
          if (typeof handle_context_menu_callback === 'function') handle_context_menu_callback(key);
        }
      })
      .appendTo($menu);
  });

  $('body').append($menu);

  // Close menu on outside click
  setTimeout(function() {
    $(document).one('mousedown touchstart', function(e) {
      if (!$('#map2d_context_menu').has(e.target).length) map2d_close_context_menu();
    });
  }, 10);
}

function map2d_close_context_menu() {
  $('#map2d_context_menu').remove();
}