#!/usr/bin/env node

/**********************************************************************
    FreecivWorld.net - Standalone JavaScript Bundle Builder
    Copyright (C) 2009-2026  The Freeciv-web project

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
 * Build script for standalone testing environment
 * 
 * Concatenates all required JavaScript files in dependency order
 * for the standalone 3D testing environment.
 * 
 * USAGE:
 *   node build-standalone.js [--output path] [--minify]
 * 
 * OPTIONS:
 *   --output   Output file path (default: src/main/webapp/standalone/standalone-bundle.js)
 *   --minify   Minify the output (requires terser package)
 *   --help     Show this help message
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const config = {
  output: 'src/main/webapp/standalone/standalone-bundle.js',
  minify: false,
  help: false
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--output':
      config.output = args[++i];
      break;
    case '--minify':
      config.minify = true;
      break;
    case '--help':
      config.help = true;
      break;
  }
}

if (config.help) {
  console.log(`
FreecivWorld.net - Standalone JavaScript Bundle Builder

USAGE:
  node build-standalone.js [--output path] [--minify]

OPTIONS:
  --output   Output file path (default: src/main/webapp/standalone/standalone-bundle.js)
  --minify   Minify the output (requires terser package)
  --help     Show this help message

DESCRIPTION:
  Concatenates all required JavaScript files for the standalone 3D testing
  environment in dependency order. The output can be used in
  freeciv-web-standalone.html to reduce HTTP requests and improve loading time.

EXAMPLE:
  # Build unminified bundle
  node build-standalone.js

  # Build minified bundle
  node build-standalone.js --minify

  # Build to custom location
  node build-standalone.js --output /tmp/bundle.js
  `);
  process.exit(0);
}

// Base directory for JavaScript files
const JS_DIR = path.join(__dirname, 'src/main/webapp/javascript');
const STANDALONE_DIR = path.join(__dirname, 'src/main/webapp/standalone');

/**
 * JavaScript files in dependency order
 * CRITICAL: Order matters! Dependencies must come before dependents
 */
const JS_FILES = [
  // Core utilities and type definitions (no dependencies)
  'libs/EventAggregator.js',
  'utility.js',
  'fc_types.js',
  'bitvector.js',
  
  // Map data structures (depend on fc_types, bitvector)
  'map.js',
  'tile.js',
  'terrain.js',
  'extra.js',
  
  // Game entities (depend on map structures)
  'player.js',
  'nation.js',
  'game.js',
  'unittype.js',
  'unit.js',
  'improvement.js',
  'city.js',
  'cities.js',
  'government.js',
  
  // Network and packet handling (depend on game entities)
  'clinet.js',
  'packhand.js',
  'pages.js',
  
  // Client main files (depend on all of the above)
  'client_main.js',
  'civclient.js',
  'control.js',
  
  // WebGL/3D rendering modules (depend on game state)
  'webgl/renderer_init.js',
  'webgl/preload.js',
  'webgl/mapview_webgl.js',
  'webgl/heightmap_square.js',
  'webgl/map_tiletype.js',
  'webgl/camera_square.js',
  'webgl/mapctrl_square.js',
  'webgl/maputil_square.js',
  'webgl/borders.js',
  'webgl/animation.js',
  'webgl/nuke.js',
  'webgl/sprites.js',
  'webgl/city.js',
  'webgl/text.js',
  'webgl/goto_square.js',
  'webgl/instances.js',
  'webgl/roads_square.js',
  'webgl/object_position_handler_square.js',
  'webgl/tile_visibility_handler.js'
];

/**
 * Standalone module files (loaded after core JS)
 */
const STANDALONE_FILES = [
  'mock-data.js',
  'renderer-bootstrap.js',
  'test-scenarios.js',
  'screenshot-capture.js',
  'test-runner.js'
];

/**
 * Read and concatenate files
 */
function concatenateFiles(baseDir, files) {
  const contents = [];
  
  for (const file of files) {
    const filePath = path.join(baseDir, file);
    
    if (!fs.existsSync(filePath)) {
      console.error(`ERROR: File not found: ${filePath}`);
      console.error(`  Relative path: ${file}`);
      process.exit(1);
    }
    
    console.log(`  Including: ${file}`);
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Add file separator comment
    contents.push(`\n/* ========================================`);
    contents.push(`   FILE: ${file}`);
    contents.push(`   ======================================== */\n`);
    contents.push(content);
  }
  
  return contents.join('\n');
}

/**
 * Minify JavaScript using terser (if available)
 */
async function minifyCode(code) {
  try {
    const { minify } = await import('terser');
    const result = await minify(code, {
      compress: {
        dead_code: true,
        drop_console: false, // Keep console for debugging
        drop_debugger: true,
        keep_classnames: true,
        keep_fnames: true
      },
      mangle: false, // Don't mangle names to preserve debugging
      format: {
        comments: /^!/  // Keep comments starting with !
      }
    });
    return result.code;
  } catch (e) {
    console.error('ERROR: Minification failed. Install terser: npm install terser');
    console.error(e);
    process.exit(1);
  }
}

/**
 * Main build function
 */
async function build() {
  console.log('FreecivWorld.net - Standalone Bundle Builder');
  console.log('='.repeat(60));
  console.log(`Output: ${config.output}`);
  console.log(`Minify: ${config.minify}`);
  console.log('');
  
  // Build header
  const header = `/**********************************************************************
    FreecivWorld.net - Standalone JavaScript Bundle
    Copyright (C) 2009-2026  The Freeciv-web project
    
    This file is automatically generated by build-standalone.js
    DO NOT EDIT MANUALLY
    
    Generated: ${new Date().toISOString()}
    Minified: ${config.minify}
    
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

***********************************************************************/

"use strict";

console.log("Loading FreecivWorld.net Standalone Bundle...");
console.log("Generated: ${new Date().toISOString()}");

`;
  
  // Concatenate core JavaScript files
  console.log('Concatenating core JavaScript files:');
  const coreJS = concatenateFiles(JS_DIR, JS_FILES);
  
  // Concatenate standalone module files
  console.log('');
  console.log('Concatenating standalone modules:');
  const standaloneJS = concatenateFiles(STANDALONE_DIR, STANDALONE_FILES);
  
  // Combine all content
  let bundle = header + coreJS + standaloneJS;
  
  // Add footer
  bundle += `\n\nconsole.log("FreecivWorld.net Standalone Bundle loaded successfully");\n`;
  
  // Minify if requested
  if (config.minify) {
    console.log('');
    console.log('Minifying...');
    bundle = await minifyCode(bundle);
  }
  
  // Write output file
  const outputPath = path.resolve(config.output);
  const outputDir = path.dirname(outputPath);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, bundle, 'utf8');
  
  // Print statistics
  const stats = fs.statSync(outputPath);
  const sizeKB = (stats.size / 1024).toFixed(2);
  
  console.log('');
  console.log('='.repeat(60));
  console.log('Build complete!');
  console.log(`Output file: ${outputPath}`);
  console.log(`Bundle size: ${sizeKB} KB`);
  console.log(`Files bundled: ${JS_FILES.length + STANDALONE_FILES.length}`);
  console.log('='.repeat(60));
}

// Run build
build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
