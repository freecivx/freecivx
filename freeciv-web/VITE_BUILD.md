# Vite Build System for Freeciv-Web

This document describes the Vite build system added to freeciv-web.

## Overview

Vite has been added as a modern build system for JavaScript assets alongside the existing Maven build system. Both systems can coexist.

## Prerequisites

- Node.js 18 or higher
- npm 9 or higher

## Usage

### Development Mode
```bash
cd freeciv-web
npm install
npm run dev
```

This starts a Vite dev server with hot module replacement at http://localhost:3000

### Production Build
```bash
cd freeciv-web
npm install
npm run build
```

This creates optimized production bundles in `target/freeciv-web-vite/`

### Integration with Maven

To enable Vite builds during Maven builds, set the property:
```bash
mvn clean install -Dskip-vite-build=false
```

By default, Maven builds skip Vite to maintain backward compatibility.

## What Changed

1. **Added Vite Configuration**: `vite.config.js` configures the build process
2. **Added package.json**: Defines npm dependencies and scripts
3. **Modernized Three.js imports**: Created `javascript/three-modules.js` for cleaner module management
4. **Updated index.jsp**: Simplified Three.js loading using the new module system

## Benefits

- Faster development with Hot Module Replacement (HMR)
- Modern ES modules support
- Better tree-shaking and code splitting
- Improved build performance
- Source maps for easier debugging
- Legacy browser support via plugin

## Compatibility

The Maven build system remains unchanged and fully functional. Vite is an optional enhancement.
