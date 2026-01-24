/**
 * Post-build script to unwrap the Vite IIFE bundle and expose globals
 * This script modifies the generated bundle to execute code in global scope,
 * making variables and functions available on window object.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const bundlePath = resolve(__dirname, 'target/vite-build/webclient-vite.min.js');

console.log('Reading bundle:', bundlePath);
let code = readFileSync(bundlePath, 'utf-8');

// Check if code starts with IIFE pattern
// Minified: !function(){...}()
const iifePattern = /^!\s*function\s*\(\s*\)\s*\{\s*["']use strict["'];\s*/;

if (!iifePattern.test(code)) {
  console.log('Code does not start with expected IIFE pattern, checking if already unwrapped...');
  // Check if it's already unwrapped (starts with "use strict" directly)
  if (code.startsWith('"use strict"') || code.startsWith("'use strict'")) {
    console.log('Code appears to be already unwrapped.');
    process.exit(0);
  }
  console.error('Unexpected code format');
  console.error('First 100 chars:', code.substring(0, 100));
  process.exit(1);
}

console.log('Detected IIFE wrapper, unwrapping...');

// Remove the IIFE wrapper
// Pattern: !function(){"use strict";...}();
// We want to remove: !function(){" use strict"; at the start and }(); at the end

// Find where the actual code starts (after "use strict";)
const useStrictMatch = code.match(/^!\s*function\s*\(\s*\)\s*\{\s*["']use strict["'];\s*/);
if (!useStrictMatch) {
  console.error('Could not find use strict');
  process.exit(1);
}

const bodyStart = useStrictMatch[0].length;

// Find the end by looking for the final }(); or }()
// Everything after this pattern should be preserved (like sourcemap comments)
const endMatch = code.match(/(\}\(\);?)(\s*\/\/[^\n]*)?(\n*)$/);

if (!endMatch) {
  console.error('Could not find closing }()');
  console.error('Last 100 chars:', code.substring(code.length - 100));
  process.exit(1);
}

const bodyEnd = code.length - endMatch[0].length;

// Extract the body (everything between the start and end markers)
let body = code.substring(bodyStart, bodyEnd);

// The body should now contain all the actual code
// We don't need to remove any closing brace because bodyEnd stops before }();

// Preserve the sourcemap comment and trailing newlines if they exist
let suffix = '';
if (endMatch[2]) {
  suffix += endMatch[2];  // sourcemap comment
}
if (endMatch[3]) {
  suffix += endMatch[3];  // trailing newlines
}

// Create the new code that executes in global scope
const newCode = body + suffix;

console.log('Writing unwrapped bundle (size:', newCode.length, 'bytes)...');
writeFileSync(bundlePath, newCode, 'utf-8');
console.log('Done! Bundle now executes in global scope.');
