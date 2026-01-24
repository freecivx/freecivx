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

// The minified bundle is an IIFE like: !function(A){...}(THREE)
// Match patterns: !function(...){...}(...) or (function(...){...})(...) or function(...){...}(...)
const iifePattern = /^[!]?[\(]?function\s*\(([^)]*)\)\s*\{([\s\S]*)\}\s*[\)]?\(([^)]*)\);?$/;
const match = code.match(iifePattern);

if (match) {
  const params = match[1].trim();
  let body = match[2];
  const args = match[3].trim();
  
  console.log('Detected IIFE with params:', params || '(none)', 'and args:', args || '(none)');
  
  // Remove "use strict"; from the beginning if present
  body = body.replace(/^["']use strict["'];?/, '');
  
  // If there are parameters (like 'A' for 'three'), we need to assign them
  let paramAssignments = '';
  if (params && args) {
    const paramList = params.split(',').map(p => p.trim()).filter(p => p);
    const argList = args.split(',').map(a => a.trim()).filter(a => a);
    paramList.forEach((param, i) => {
      if (param && argList[i]) {
        paramAssignments += `var ${param}=${argList[i]};`;
      }
    });
  }
  
  // Create the new code that executes in global scope
  const newCode = paramAssignments + body;
  
  console.log('Writing unwrapped bundle (size:', newCode.length, 'bytes)...');
  writeFileSync(bundlePath, newCode, 'utf-8');
  console.log('Done! Bundle now executes in global scope.');
} else {
  console.warn('Could not match IIFE pattern.');
  console.warn('First 300 characters:', code.substring(0, 300));
  console.warn('Trying alternative pattern...');
  
  // Try to find where the function starts and ends manually
  // Pattern: !function(params){body}(args)
  const altMatch = code.match(/^!function\(([^)]*)\)\{/);
  if (altMatch) {
    console.log('Found function start with params:', altMatch[1]);
    // Find the matching closing brace and parenthesis
    let depth = 0;
    let bodyStart = code.indexOf('{') + 1;
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
    
    if (bodyEnd > 0) {
      const body = code.substring(bodyStart, bodyEnd);
      const argsMatch = code.substring(bodyEnd).match(/\}\(([^)]*)\)/);
      const params = altMatch[1].trim();
      const args = argsMatch ? argsMatch[1].trim() : '';
      
      console.log('Extracted body length:', body.length, 'Args:', args);
      
      // Remove "use strict"; from the beginning if present
      const cleanBody = body.replace(/^["']use strict["'];?/, '');
      
      // Assign parameters
      let paramAssignments = '';
      if (params && args) {
        const paramList = params.split(',').map(p => p.trim()).filter(p => p);
        const argList = args.split(',').map(a => a.trim()).filter(a => a);
        paramList.forEach((param, i) => {
          if (param && argList[i]) {
            paramAssignments += `var ${param}=${argList[i]};`;
          }
        });
      }
      
      const newCode = paramAssignments + cleanBody;
      console.log('Writing unwrapped bundle (size:', newCode.length, 'bytes)...');
      writeFileSync(bundlePath, newCode, 'utf-8');
      console.log('Done! Bundle now executes in global scope.');
    } else {
      console.error('Could not find matching closing brace');
      process.exit(1);
    }
  } else {
    console.error('Could not unwrap bundle - unrecognized format');
    process.exit(1);
  }
}
