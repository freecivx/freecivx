# Vite Build for Freeciv-Web

This directory contains the Vite-based build system for freeciv-web JavaScript files.

## Overview

The Vite build process is designed to maintain compatibility with the original design where all JavaScript functions are globally accessible. Unlike typical Vite builds that create ES6 modules, this build concatenates JavaScript files and executes them in the global scope.

## Key Components

### 1. `vite-concat-plugin.js`
A custom Vite plugin that:
- Concatenates all JavaScript files in the correct order (matching the original build)
- Transforms ES6 imports from 'three' to use the global THREE object
- Removes export statements to ensure everything executes in global scope
- Tracks imported identifiers to avoid duplicate declarations

### 2. `vite.config.js`
Vite configuration that:
- Uses the concat plugin
- Configures Terser to preserve function names (`keep_fnames: true`)
- Treats 'three' as an external dependency (loaded via import maps in index.jsp)
- Targets ES2019 for compatibility

### 3. `unwrap-bundle.js`
Post-build script that:
- Removes the IIFE (Immediately Invoked Function Expression) wrapper that Vite creates
- Ensures the code executes directly in global scope
- Preserves sourcemap comments

### 4. `test-bundle.js`
Test script that verifies:
- No IIFE wrapper remains
- Specific functions like `update_city_screen` are present
- No ES6 module syntax remains
- Function names are preserved

## Build Process

```bash
npm run build
```

This command:
1. Runs `vite build` to concatenate and minify JavaScript files
2. Runs `node unwrap-bundle.js` to remove the IIFE wrapper
3. Outputs `target/vite-build/webclient-vite.min.js`

## Testing

```bash
npm test
```

This runs the bundle verification tests to ensure functions are globally accessible.

## Why This Approach?

The original freeciv-web design relies on all JavaScript functions being globally accessible. Modern build tools like Vite typically create ES6 modules where functions are scoped within the module. This causes runtime errors like:

```
Uncaught ReferenceError: update_city_screen is not defined
```

Our approach:
1. Concatenates files (instead of bundling as modules)
2. Removes module wrappers
3. Preserves function names
4. Executes code in global scope

This maintains backward compatibility while still benefiting from Vite's fast build times and minification.

## File Order

The JavaScript files are concatenated in a specific order defined in `vite-concat-plugin.js`. This order matches the original Closure Compiler build configuration in `pom.xml`.

## Three.js Integration

Three.js is loaded externally via import maps in `index.jsp` and exposed as a global `THREE` object. The build process transforms ES6 imports from 'three' to use this global object.
