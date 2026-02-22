/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2015  The Freeciv-web project

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

// Store OverlayScrollbars instances
var scrollbar_instances = {};

/**
 * Initialize OverlayScrollbars on an element
 * @param {string} selector - jQuery selector for the element
 * @param {object} options - Optional configuration (theme, etc.)
 */
function init_custom_scrollbar(selector, options) {
  var element = $(selector)[0];
  if (!element) return;
  
  // Destroy existing instance if any
  if (scrollbar_instances[selector]) {
    scrollbar_instances[selector].destroy();
  }
  
  // Default options for dark theme
  var defaultOptions = {
    scrollbars: {
      theme: 'os-theme-dark',
      visibility: 'auto',
      autoHide: 'never'
    }
  };
  
  // Merge options
  var finalOptions = Object.assign({}, defaultOptions, options || {});
  
  // Initialize OverlayScrollbars
  var OverlayScrollbars = OverlayScrollbarsGlobal.OverlayScrollbars;
  scrollbar_instances[selector] = OverlayScrollbars(element, finalOptions);
}

/**
 * Scroll to bottom of a scrollbar element
 * @param {string} selector - jQuery selector for the element
 */
function scrollbar_scroll_to_bottom(selector) {
  var instance = scrollbar_instances[selector];
  if (instance) {
    var viewport = instance.elements().viewport;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'auto' });
  }
}
