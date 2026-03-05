/**********************************************************************
    Freeciv-web - 2D Map Canvas Controls (Simplified & Robust)
***********************************************************************/

/* Control state */
let map2d_is_dragging = false;
let map2d_did_move = false;
let map2d_start_pos = { x: 0, y: 0 };
let map2d_start_center = { x: 0, y: 0 };

/* Pinch-zoom state */
let map2d_pinch_dist = 0;
let map2d_pinch_zoom = 1.0;

/**
 * Initializes all interaction for the 2D map.
 */
function init_2d_map_controls() {
    if (!map2d_canvas) return;

    // 1. Mouse Wheel Zoom
    map2d_canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        map2d_zoom = Math.max(MAP2D_MIN_ZOOM, Math.min(MAP2D_MAX_ZOOM, map2d_zoom * factor));
        render_2d_map();
    }, { passive: false });

    // 2. Pointer Events (Handles Mouse and Single-Touch Pan/Click)
    map2d_canvas.addEventListener('pointerdown', (e) => {
        // Ignore secondary buttons for dragging, but allow right-click for menu
        if (e.button === 2) return;

        map2d_is_dragging = true;
        map2d_did_move = false;
        map2d_start_pos = { x: e.clientX, y: e.clientY };
        map2d_start_center = { x: map2d_center_x, y: map2d_center_y };
        map2d_canvas.setPointerCapture(e.pointerId);
    });

    map2d_canvas.addEventListener('pointermove', (e) => {
        // Track tile for cursor/goto preview
        map2d_mouse_tile = map2d_tile_from_event(e);
        map2d_update_mouse_cursor();

        if (typeof goto_active !== 'undefined' && goto_active) {
            map2d_update_goto_preview(map2d_mouse_tile);
            return;
        }

        if (!map2d_is_dragging) return;

        const dx = e.clientX - map2d_start_pos.x;
        const dy = e.clientY - map2d_start_pos.y;

        // Threshold to distinguish click vs drag (5 pixels)
        if (Math.hypot(dx, dy) > 5) {
            map2d_did_move = true;
            const tw = Math.max(1, Math.floor(map2d_tileset_config['normal_tile_width'] * map2d_zoom));
            const th = Math.max(1, Math.floor(map2d_tileset_config['normal_tile_height'] * map2d_zoom));

            map2d_center_x = map2d_start_center.x - Math.round(dx / tw);
            map2d_center_y = map2d_start_center.y - Math.round(dy / th);
            render_2d_map();
        }
    });

    map2d_canvas.addEventListener('pointerup', (e) => {
        map2d_is_dragging = false;
        map2d_canvas.releasePointerCapture(e.pointerId);

        // If we didn't drag, handle it as a selection or menu trigger
        if (!map2d_did_move) {
            const isTouch = e.pointerType === 'touch';
            const isRightClick = e.button === 2;

            if (isTouch || isRightClick) {
                // ALWAYS show menu on mobile tap or desktop right-click
                map2d_mouse_tile = map2d_tile_from_event(e);
                map2d_show_context_menu(e);
            } else {
                // Standard left-click selection for desktop
                const ptile = map2d_tile_from_event(e);
                if (ptile) map2d_handle_tile_click(ptile, e);
            }
        }
    });

    // 3. Right-Click Prevention (Desktop)
    map2d_canvas.addEventListener('contextmenu', e => e.preventDefault());

    // 4. Pinch-to-Zoom (Touch specific)
    map2d_canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            map2d_is_dragging = false; // Cancel pan
            map2d_pinch_dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            map2d_pinch_zoom = map2d_zoom;
        }
    }, { passive: false });

    map2d_canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && map2d_pinch_dist > 0) {
            e.preventDefault();
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            map2d_zoom = Math.max(MAP2D_MIN_ZOOM, Math.min(MAP2D_MAX_ZOOM,
                map2d_pinch_zoom * (dist / map2d_pinch_dist)));
            render_2d_map();
        }
    }, { passive: false });

    // 5. Keyboard Panning
    map2d_canvas.setAttribute('tabindex', '0');
    map2d_canvas.addEventListener('keydown', (e) => {
        const step = 3;
        const keys = {
            ArrowLeft:  () => map2d_center_x -= step,
            ArrowRight: () => map2d_center_x += step,
            ArrowUp:    () => map2d_center_y -= step,
            ArrowDown:  () => map2d_center_y += step,
            '+':        () => map2d_zoom = Math.min(MAP2D_MAX_ZOOM, map2d_zoom * 1.2),
            '-':        () => map2d_zoom = Math.max(MAP2D_MIN_ZOOM, map2d_zoom / 1.2)
        };
        if (keys[e.key]) {
            keys[e.key]();
            e.preventDefault();
            e.stopPropagation();
            render_2d_map();
        }
    });
}

/**
 * Creates and shows the context menu.
 */
function map2d_show_context_menu(e) {
    map2d_close_context_menu();

    if (!map2d_mouse_tile) return;

    // Focus unit on tile
    const punits = tile_units(map2d_mouse_tile);
    if (punits?.length > 0 && typeof set_unit_focus_and_redraw === 'function') {
        set_unit_focus_and_redraw(punits[0]);
    }

    const items = typeof update_unit_order_commands === 'function' ? update_unit_order_commands() : {};
    items['tile_info'] = { name: 'Tile info', icon: 'fas fa-info-circle' };

    const menu = document.createElement('ul');
    menu.id = 'map2d_context_menu';
    Object.assign(menu.style, {
        position: 'fixed',
        left: `${e.clientX}px`,
        top: `${e.clientY}px`,
        background: '#1a1a2e',
        border: '1px solid #444',
        borderRadius: '4px',
        padding: '4px 0',
        listStyle: 'none',
        zIndex: '10000',
        minWidth: '160px',
        boxShadow: '4px 4px 12px rgba(0,0,0,0.5)',
        color: '#eee',
        font: '14px sans-serif'
    });

    Object.entries(items).forEach(([key, data]) => {
        const li = document.createElement('li');
        li.textContent = data.name || key;
        Object.assign(li.style, { padding: '8px 16px', cursor: 'pointer' });

        li.onmouseenter = () => li.style.background = '#2a2a4e';
        li.onmouseleave = () => li.style.background = '';

        // Use pointerup for immediate response on all devices
        li.onpointerup = (ev) => {
            ev.stopPropagation();
            map2d_close_context_menu();
            if (key === 'tile_info') {
                if (typeof popit_req === 'function') popit_req(map2d_mouse_tile);
            } else if (typeof handle_context_menu_callback === 'function') {
                handle_context_menu_callback(key);
            }
        };
        menu.appendChild(li);
    });

    document.body.appendChild(menu);

    // Auto-close logic
    const closeHandler = (ev) => {
        if (!menu.contains(ev.target)) {
            map2d_close_context_menu();
            document.removeEventListener('pointerdown', closeHandler);
        }
    };
    // Delay listener to prevent the current tap from closing it instantly
    requestAnimationFrame(() => {
        document.addEventListener('pointerdown', closeHandler);
    });
}

function map2d_close_context_menu() {
    const menu = document.getElementById('map2d_context_menu');
    if (menu) menu.remove();
}