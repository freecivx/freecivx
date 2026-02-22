/**
 * OverlayScrollbars Module Loader
 * 
 * This file imports the OverlayScrollbars ESM module and exposes it as a global variable
 * for compatibility with existing non-module code in the application.
 * 
 * Usage: Load this file as a module in HTML:
 * <script type="module" src="/javascript/libs/overlayscrollbars-global.js"></script>
 */

import { OverlayScrollbars } from './overlayscrollbars.esm.js';

// Export to global window object for backward compatibility with existing code
window.OverlayScrollbarsGlobal = {
  OverlayScrollbars: OverlayScrollbars
};

export { OverlayScrollbars };
