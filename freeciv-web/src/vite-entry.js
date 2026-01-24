// Vite entry point for Freeciv-Web
// This file imports all JavaScript modules in the correct order,
// similar to the closure compiler build configuration in pom.xml

// Order-dependent files must be loaded first
import './main/webapp/javascript/libs/EventAggregator.js';

// TODO: Generated/derived files need to be included when available:
// - map-constants.js (generated from Freeciv C code)
// - 2dcanvas/tilespec-constants.js (generated from Freeciv C code)
// - packhand_gen.js (generated packet handler)
// These files are created by running scripts/sync-js-hand.sh and stored in
// src/derived/webapp/javascript/. The Vite build currently does not include
// these files, which accounts for much of the size difference with the
// traditional Closure Compiler build.
//
// To fully match the traditional build size, the Vite build process needs to:
// 1. Ensure derived files are generated before build
// 2. Configure Vite to include files from src/derived/webapp/javascript/
// OR copy derived files to src/main/webapp/javascript/ before build

// Main JavaScript files
import './main/webapp/javascript/action_dialog.js';
import './main/webapp/javascript/actions.js';
import './main/webapp/javascript/banlist.js';
import './main/webapp/javascript/benchmark.js';
import './main/webapp/javascript/bitvector.js';
import './main/webapp/javascript/cities.js';
import './main/webapp/javascript/city.js';
import './main/webapp/javascript/civclient.js';
import './main/webapp/javascript/client_main.js';
import './main/webapp/javascript/clinet.js';
import './main/webapp/javascript/cma.js';
import './main/webapp/javascript/connection.js';
import './main/webapp/javascript/control.js';
import './main/webapp/javascript/diplomacy.js';
import './main/webapp/javascript/effects.js';
import './main/webapp/javascript/errorlog.js';
import './main/webapp/javascript/extra.js';
import './main/webapp/javascript/fc_types.js';
import './main/webapp/javascript/freeciv-wiki-doc.js';
import './main/webapp/javascript/game.js';
import './main/webapp/javascript/government.js';
import './main/webapp/javascript/hall_of_fame.js';
import './main/webapp/javascript/helpdata.js';
import './main/webapp/javascript/improvement.js';
import './main/webapp/javascript/intel_dialog.js';
import './main/webapp/javascript/invites.js';
import './main/webapp/javascript/log.js';
import './main/webapp/javascript/map.js';
import './main/webapp/javascript/messages.js';
import './main/webapp/javascript/mobile.js';
import './main/webapp/javascript/nation.js';
import './main/webapp/javascript/openai.js';
import './main/webapp/javascript/options.js';
import './main/webapp/javascript/packhand.js';
import './main/webapp/javascript/pages.js';
import './main/webapp/javascript/pillage_dialog.js';
import './main/webapp/javascript/player.js';
import './main/webapp/javascript/pregame.js';
import './main/webapp/javascript/rates.js';
import './main/webapp/javascript/reqtree.js';
import './main/webapp/javascript/requirements.js';
import './main/webapp/javascript/savegame.js';
import './main/webapp/javascript/scorelog.js';
import './main/webapp/javascript/sounds.js';
import './main/webapp/javascript/spacerace.js';
import './main/webapp/javascript/specialist.js';
import './main/webapp/javascript/speech.js';
import './main/webapp/javascript/tech.js';
import './main/webapp/javascript/terrain.js';
import './main/webapp/javascript/tile.js';
import './main/webapp/javascript/unit.js';
import './main/webapp/javascript/unittype.js';
import './main/webapp/javascript/utility.js';

// Library files
import './main/webapp/javascript/libs/Detector.js';
import './main/webapp/javascript/libs/bigscreen.min.js';
import './main/webapp/javascript/libs/html2canvas.min.js';
import './main/webapp/javascript/libs/jquery-ui.min.js';
import './main/webapp/javascript/libs/jquery.blockUI.js';
import './main/webapp/javascript/libs/jquery.contextMenu.js';
import './main/webapp/javascript/libs/jquery.dialogextend.js';
import './main/webapp/javascript/libs/jquery.mCustomScrollbar.js';
import './main/webapp/javascript/libs/jquery.tablesorter.js';
import './main/webapp/javascript/libs/platform.js';
import './main/webapp/javascript/libs/range.js';
import './main/webapp/javascript/libs/seedrandom.min.js';
import './main/webapp/javascript/libs/sha512.js';
import './main/webapp/javascript/libs/simpleStorage.min.js';
import './main/webapp/javascript/libs/slider.js';
import './main/webapp/javascript/libs/stats.min.js';
import './main/webapp/javascript/libs/sweetalert.min.js';
import './main/webapp/javascript/libs/timer.js';

// 2D Canvas files
import './main/webapp/javascript/2dcanvas/mapview.js';
import './main/webapp/javascript/2dcanvas/tileset_config_amplio2.js';
import './main/webapp/javascript/2dcanvas/tilespec.js';

// WebGL files (excluding those that depend on three.js)
import './main/webapp/javascript/webgl/animation.js';
import './main/webapp/javascript/webgl/borders.js';
import './main/webapp/javascript/webgl/camera_square.js';
import './main/webapp/javascript/webgl/city.js';
import './main/webapp/javascript/webgl/goto_square.js';
import './main/webapp/javascript/webgl/heightmap_square.js';
import './main/webapp/javascript/webgl/instances.js';
import './main/webapp/javascript/webgl/map_tiletype.js';
import './main/webapp/javascript/webgl/mapctrl_square.js';
import './main/webapp/javascript/webgl/maputil_square.js';
import './main/webapp/javascript/webgl/mapview_webgl.js';
import './main/webapp/javascript/webgl/nuke.js';
import './main/webapp/javascript/webgl/object_position_handler_square.js';
// Note: These files depend on three.js which is loaded externally via import maps
import './main/webapp/javascript/webgl/objects/Reflector.js';
import './main/webapp/javascript/webgl/objects/Refractor.js';
import './main/webapp/javascript/webgl/postprocessing/Pass.js';
import './main/webapp/javascript/webgl/preload.js';
import './main/webapp/javascript/webgl/renderer_init.js';
import './main/webapp/javascript/webgl/roads_square.js';
import './main/webapp/javascript/webgl/sprites.js';
import './main/webapp/javascript/webgl/text.js';
import './main/webapp/javascript/webgl/tile_visibility_handler.js';
import './main/webapp/javascript/webgl/utils/BufferGeometryUtils.js';
// Note: AnaglyphEffect.js is in webgl/effects/ which is excluded per pom.xml
// import './main/webapp/javascript/webgl/effects/AnaglyphEffect.js';

// Note: The following files are excluded as per pom.xml configuration:
// - webclient.js
// - webclient.min.js
// - libs/es-module-shims.js
// - libs/jquery.min.js
// - libs/gif.worker.js
// - libs/stacktrace.min.js
// - webgl/libs/*js
// - webgl/effects/*js (except AnaglyphEffect.js which is included)
// - three-modules.js
