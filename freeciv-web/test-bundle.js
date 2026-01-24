#!/usr/bin/env node

/**
 * Test script to verify that JavaScript functions are globally accessible
 * in the Vite-built bundle by analyzing the code structure
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const bundlePath = resolve(__dirname, 'target/vite-build/webclient-vite.min.js');

console.log('Testing bundle:', bundlePath);

// Read the bundle
const bundleCode = readFileSync(bundlePath, 'utf-8');

// Test 1: Verify no IIFE wrapper
console.log('\n1. Checking for IIFE wrapper...');
const hasIIFE = /^!\s*function\s*\(\s*\)\s*\{/.test(bundleCode);
if (hasIIFE) {
  console.log('✗ FAIL: Bundle still has IIFE wrapper');
  process.exit(1);
} else {
  console.log('✓ PASS: No IIFE wrapper found');
}

// Test 2: Verify it doesn't end with }();
console.log('\n2. Checking bundle ending...');
const endsWithIIFE = /\}\(\);?\s*$/.test(bundleCode.trim());
if (endsWithIIFE) {
  console.log('✗ FAIL: Bundle ends with }(); (IIFE pattern)');
  process.exit(1);
} else {
  console.log('✓ PASS: Bundle does not end with IIFE pattern');
}

// Test 3: Verify specific functions are defined
console.log('\n3. Checking for specific function declarations...');
const testFunctions = [
  'update_city_screen',
  'EventAggregator',
];

let allFunctionsFound = true;
for (const funcName of testFunctions) {
  const regex = new RegExp(`function\\s+${funcName}\\s*\\(`);
  if (regex.test(bundleCode)) {
    console.log(`✓ PASS: Found function ${funcName}`);
  } else {
    console.log(`✗ FAIL: Function ${funcName} not found`);
    allFunctionsFound = false;
  }
}

// Test 4: Verify no ES6 module syntax remains
console.log('\n4. Checking for ES6 module syntax...');
const hasImport = /\bimport\s+.*\s+from\s+/.test(bundleCode);
const hasExport = /\bexport\s+(default\s+)?(function|class|const|let|var)/.test(bundleCode);

if (hasImport || hasExport) {
  console.log('✗ FAIL: Bundle contains ES6 import/export statements');
  if (hasImport) console.log('  - Found import statements');
  if (hasExport) console.log('  - Found export statements');
  process.exit(1);
} else {
  console.log('✓ PASS: No ES6 module syntax found');
}

// Test 5: Verify function names are not mangled
console.log('\n5. Checking if function names are preserved...');
// Check for some long function names that would be mangled if not preserved
const preservedNames = [
  'update_city_screen',
  'city_screen_updater',
  'show_diplomacy_dialog'
];

let namesMaintained = 0;
for (const name of preservedNames) {
  if (bundleCode.includes(name)) {
    namesMaintained++;
  }
}

if (namesMaintained >= 2) {
  console.log(`✓ PASS: Function names are preserved (${namesMaintained}/${preservedNames.length} tested names found)`);
} else {
  console.log(`⚠ WARNING: Only ${namesMaintained}/${preservedNames.length} function names found. Names might be mangled.`);
}

// Summary
console.log('\n=== Summary ===');
if (allFunctionsFound) {
  console.log('✓ All critical tests passed!');
  console.log('✓ Bundle is unwrapped and functions should be globally accessible.');
  process.exit(0);
} else {
  console.log('✗ Some tests failed. Bundle may not work correctly.');
  process.exit(1);
}
