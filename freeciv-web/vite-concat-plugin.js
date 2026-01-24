/**
 * Vite plugin to concatenate JavaScript files as plain scripts
 * This plugin ensures that all JavaScript functions remain globally accessible
 * by concatenating files without ES6 module wrapping
 */
import { readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function viteConcatPlugin() {
  // List of JavaScript files to concatenate in order
  // This matches the order from vite-entry.js
  const jsFiles = [
    // Order-dependent files must be loaded first
    './main/webapp/javascript/libs/EventAggregator.js',
    
    // Main JavaScript files
    './main/webapp/javascript/action_dialog.js',
    './main/webapp/javascript/actions.js',
    './main/webapp/javascript/banlist.js',
    './main/webapp/javascript/benchmark.js',
    './main/webapp/javascript/bitvector.js',
    './main/webapp/javascript/cities.js',
    './main/webapp/javascript/city.js',
    './main/webapp/javascript/civclient.js',
    './main/webapp/javascript/client_main.js',
    './main/webapp/javascript/clinet.js',
    './main/webapp/javascript/cma.js',
    './main/webapp/javascript/connection.js',
    './main/webapp/javascript/control.js',
    './main/webapp/javascript/diplomacy.js',
    './main/webapp/javascript/effects.js',
    './main/webapp/javascript/errorlog.js',
    './main/webapp/javascript/extra.js',
    './main/webapp/javascript/fc_types.js',
    './main/webapp/javascript/freeciv-wiki-doc.js',
    './main/webapp/javascript/game.js',
    './main/webapp/javascript/government.js',
    './main/webapp/javascript/hall_of_fame.js',
    './main/webapp/javascript/helpdata.js',
    './main/webapp/javascript/improvement.js',
    './main/webapp/javascript/intel_dialog.js',
    './main/webapp/javascript/invites.js',
    './main/webapp/javascript/log.js',
    './main/webapp/javascript/map.js',
    './main/webapp/javascript/messages.js',
    './main/webapp/javascript/mobile.js',
    './main/webapp/javascript/nation.js',
    './main/webapp/javascript/openai.js',
    './main/webapp/javascript/options.js',
    './main/webapp/javascript/packhand.js',
    './main/webapp/javascript/pages.js',
    './main/webapp/javascript/pillage_dialog.js',
    './main/webapp/javascript/player.js',
    './main/webapp/javascript/pregame.js',
    './main/webapp/javascript/rates.js',
    './main/webapp/javascript/reqtree.js',
    './main/webapp/javascript/requirements.js',
    './main/webapp/javascript/savegame.js',
    './main/webapp/javascript/scorelog.js',
    './main/webapp/javascript/sounds.js',
    './main/webapp/javascript/spacerace.js',
    './main/webapp/javascript/specialist.js',
    './main/webapp/javascript/speech.js',
    './main/webapp/javascript/tech.js',
    './main/webapp/javascript/terrain.js',
    './main/webapp/javascript/tile.js',
    './main/webapp/javascript/unit.js',
    './main/webapp/javascript/unittype.js',
    './main/webapp/javascript/utility.js',
    
    // Library files
    './main/webapp/javascript/libs/Detector.js',
    './main/webapp/javascript/libs/bigscreen.min.js',
    './main/webapp/javascript/libs/html2canvas.min.js',
    './main/webapp/javascript/libs/jquery-ui.min.js',
    './main/webapp/javascript/libs/jquery.blockUI.js',
    './main/webapp/javascript/libs/jquery.contextMenu.js',
    './main/webapp/javascript/libs/jquery.dialogextend.js',
    './main/webapp/javascript/libs/jquery.mCustomScrollbar.js',
    './main/webapp/javascript/libs/jquery.tablesorter.js',
    './main/webapp/javascript/libs/platform.js',
    './main/webapp/javascript/libs/range.js',
    './main/webapp/javascript/libs/seedrandom.min.js',
    './main/webapp/javascript/libs/sha512.js',
    './main/webapp/javascript/libs/simpleStorage.min.js',
    './main/webapp/javascript/libs/slider.js',
    './main/webapp/javascript/libs/stats.min.js',
    './main/webapp/javascript/libs/sweetalert.min.js',
    './main/webapp/javascript/libs/timer.js',
    
    // 2D Canvas files
    './main/webapp/javascript/2dcanvas/mapview.js',
    './main/webapp/javascript/2dcanvas/tileset_config_amplio2.js',
    './main/webapp/javascript/2dcanvas/tilespec.js',
    
    // WebGL files
    './main/webapp/javascript/webgl/animation.js',
    './main/webapp/javascript/webgl/borders.js',
    './main/webapp/javascript/webgl/camera_square.js',
    './main/webapp/javascript/webgl/city.js',
    './main/webapp/javascript/webgl/goto_square.js',
    './main/webapp/javascript/webgl/heightmap_square.js',
    './main/webapp/javascript/webgl/instances.js',
    './main/webapp/javascript/webgl/map_tiletype.js',
    './main/webapp/javascript/webgl/mapctrl_square.js',
    './main/webapp/javascript/webgl/maputil_square.js',
    './main/webapp/javascript/webgl/mapview_webgl.js',
    './main/webapp/javascript/webgl/nuke.js',
    './main/webapp/javascript/webgl/object_position_handler_square.js',
    './main/webapp/javascript/webgl/objects/Reflector.js',
    './main/webapp/javascript/webgl/objects/Refractor.js',
    './main/webapp/javascript/webgl/postprocessing/Pass.js',
    './main/webapp/javascript/webgl/preload.js',
    './main/webapp/javascript/webgl/renderer_init.js',
    './main/webapp/javascript/webgl/roads_square.js',
    './main/webapp/javascript/webgl/sprites.js',
    './main/webapp/javascript/webgl/text.js',
    './main/webapp/javascript/webgl/tile_visibility_handler.js',
    './main/webapp/javascript/webgl/utils/BufferGeometryUtils.js',
  ];

  let concatenatedCode = '';

  return {
    name: 'vite-concat-plugin',
    
    buildStart() {
      // Read and concatenate all JavaScript files
      console.log('Concatenating JavaScript files...');
      const srcDir = resolve(__dirname, 'src');
      const declaredIdentifiers = new Set();
      
      concatenatedCode = '';
      for (const file of jsFiles) {
        const filePath = join(srcDir, file);
        try {
          let code = readFileSync(filePath, 'utf-8');
          
          // Transform ES6 imports from 'three' to use global THREE
          // Track which identifiers we've already declared to avoid duplicates
          code = code.replace(/import\s+{([^}]+)}\s+from\s+['"]three['"]\s*;?/gs, (match, imports) => {
            // Extract the imported names and create const declarations using THREE
            const importNames = imports.split(',')
              .map(name => name.trim())
              .filter(name => name.length > 0);
            
            // Only declare identifiers that haven't been declared yet
            const declarations = importNames
              .filter(name => !declaredIdentifiers.has(name))
              .map(name => {
                declaredIdentifiers.add(name);
                return `const ${name} = THREE.${name};`;
              });
            
            return declarations.length > 0 ? declarations.join('\n') : '';
          });
          
          // Also handle other import patterns (default imports, etc.)
          code = code.replace(/import\s+(\w+)\s+from\s+['"]three['"]\s*;?/g, (match, name) => {
            if (!declaredIdentifiers.has(name)) {
              declaredIdentifiers.add(name);
              return `const ${name} = THREE;`;
            }
            return '';
          });
          
          // Remove export statements since we want everything in global scope
          code = code.replace(/export\s+{[^}]+}\s*;?/g, '');
          code = code.replace(/export\s+default\s+/g, '');
          code = code.replace(/export\s+/g, '');
          
          concatenatedCode += `\n// ===== ${file} =====\n`;
          concatenatedCode += code;
          concatenatedCode += '\n';
        } catch (err) {
          console.warn(`Warning: Could not read file ${file}: ${err.message}`);
        }
      }
      console.log(`Concatenated ${jsFiles.length} files (${concatenatedCode.length} bytes)`);
    },
    
    resolveId(id) {
      // Intercept the vite-entry.js import
      if (id.endsWith('vite-entry.js')) {
        return id;
      }
    },
    
    load(id) {
      // Return the concatenated code for vite-entry.js
      if (id.endsWith('vite-entry.js')) {
        return concatenatedCode;
      }
    }
  };
}
