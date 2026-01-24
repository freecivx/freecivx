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
// Minified: !function(A){...}(THREE)
// Non-minified: (function(three) {\n  "use strict";\n  ...})(THREE);
const startsWithIIFE = /^[!(\s]*function\s*\(/i.test(code);

if (!startsWithIIFE) {
  console.log('Code does not start with IIFE, likely already unwrapped or different format');
  process.exit(0);
}

// Try to find the IIFE pattern
// Match: !function(...){...}(...) or (function(...){...})(...)
const minifiedPattern = /^!function\(([^)]*)\)\{/;
const normalPattern = /^\(function\s*\(([^)]*)\)\s*\{/;

let params = '';
let bodyStart = -1;
let isMinified = false;

const minMatch = code.match(minifiedPattern);
const normMatch = code.match(normalPattern);

if (minMatch) {
  console.log('Detected minified IIFE');
  params = minMatch[1].trim();
  bodyStart = code.indexOf('{') + 1;
  isMinified = true;
} else if (normMatch) {
  console.log('Detected non-minified IIFE');
  params = normMatch[1].trim();
  bodyStart = code.indexOf('{', code.indexOf('function')) + 1;
  isMinified = false;
} else {
  console.error('Could not detect IIFE pattern');
  console.error('First 300 chars:', code.substring(0, 300));
  process.exit(1);
}

// Find the matching closing brace
let depth = 0;
let bodyEnd = -1;

for (let i = bodyStart - 1; i < code.length; i++) {
  if (code[i] === '{') depth++;
  else if (code[i] === '}') {
    depth--;
    if (depth === 0) {
      bodyEnd = i;
      break;
    }
  }
}

if (bodyEnd === -1) {
  console.error('Could not find matching closing brace');
  process.exit(1);
}

// Extract the body
let body = code.substring(bodyStart, bodyEnd);

// Find the arguments
const argsMatch = code.substring(bodyEnd).match(/\}\s*[\)]?\s*\(([^)]*)\)/);
const args = argsMatch ? argsMatch[1].trim() : '';

console.log('Extracted:', {
  params: params || '(none)',
  args: args || '(none)',
  bodyLength: body.length
});

// Remove "use strict"; from the beginning if present
body = body.replace(/^[\s\n]*["']use strict["'];?\s*\n?/, '');

// Assign parameters as variables
let paramAssignments = '';
if (params && args) {
  const paramList = params.split(',').map(p => p.trim()).filter(p => p);
  const argList = args.split(',').map(a => a.trim()).filter(a => a);
  paramList.forEach((param, i) => {
    if (param && argList[i]) {
      if (isMinified) {
        paramAssignments += `var ${param}=${argList[i]};`;
      } else {
        paramAssignments += `var ${param} = ${argList[i]};\n`;
      }
    }
  });
}

// Create the new code that executes in global scope
const newCode = paramAssignments + body;

console.log('Writing unwrapped bundle (size:', newCode.length, 'bytes)...');
writeFileSync(bundlePath, newCode, 'utf-8');
console.log('Done! Bundle now executes in global scope.');
