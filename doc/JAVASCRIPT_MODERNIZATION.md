# JavaScript Modernization and Vite Migration Guide

## Overview

This document describes the JavaScript modernization changes made to `index.jsp` and the roadmap for future Vite migration.

## Current State (Modernized)

### Script Loading Organization

The JavaScript loading in `index.jsp` has been organized into logical sections with clear comments:

1. **Global Configuration Variables** - Application-wide config accessible before any scripts load
2. **Core Dependencies** - jQuery loaded synchronously for backward compatibility
3. **External Services** - Google Platform API with defer attribute
4. **Error Tracking** - Stacktrace.js with defer attribute
5. **Three.js ES Module System** - Modern import map pattern (already Vite-ready)
6. **Main Application Bundle** - webclient.min.js with defer attribute
7. **Audio System** - Audio module with defer attribute

### Key Improvements

#### 1. Defer Attributes
- Added `defer` to all non-blocking scripts (stacktrace, Google platform, webclient, audio)
- Benefits:
  - Scripts download in parallel without blocking HTML parsing
  - Scripts execute in order after DOM is ready
  - Improves page load performance
  - Maintains compatibility with existing code

#### 2. Modern Import Maps
- Three.js already uses ES6 import maps (Vite-compatible pattern)
- `three-modules.js` exports to window for backward compatibility
- This pattern is ready for Vite bundling without changes

#### 3. Inline Comments
- Added descriptive comments explaining each script's purpose
- Highlighted Vite-ready patterns
- Documented backward compatibility considerations

## Benefits for Vite Migration

### What's Already Vite-Ready
1. **Three.js Module System**: Uses import maps and ES6 modules
2. **Module Exports Pattern**: `three-modules.js` demonstrates proper export/window pattern
3. **Deferred Loading**: Non-blocking scripts improve performance
4. **Clear Separation**: Organized structure makes migration clearer

### What Still Needs Migration

#### Phase 1: Convert Bundle to Entry Point
```javascript
// Current: webclient.min.js (80+ files minified into one bundle)
<script src="/javascript/webclient.min.js" defer></script>

// Vite: main.js entry point with ES6 imports
<script type="module" src="/javascript/main.js"></script>
```

#### Phase 2: Replace jQuery with ES6 Imports
```javascript
// Current: Global jQuery loaded via script tag
<script src="/javascript/libs/jquery.min.js"></script>

// Vite: npm package as ES6 module
import $ from 'jquery';
```

#### Phase 3: Convert Legacy Bundles
```javascript
// Current: Minified bundle via Maven plugin
audio.min.js, webclient.min.js

// Vite: Native ES6 modules bundled by Vite
import { initAudio } from './audio/index.js';
```

## Roadmap to Full Vite Migration

### Step 1: Create Entry Point Module
Create `/javascript/main.js`:
```javascript
// Entry point for Vite bundling
import $ from 'jquery';
import { THREE } from './three-modules.js';
import { civclient_init } from './civclient.js';

$(document).ready(() => {
  civclient_init();
});
```

### Step 2: Add ES6 Exports to Existing Files
Modify existing JavaScript files to export functions:
```javascript
// civclient.js
export function civclient_init() {
  // existing code
}
```

### Step 3: Create vite.config.js
```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: '/javascript/main.js'
      }
    }
  },
  resolve: {
    alias: {
      'three': '/javascript/webgl/libs/threejs/three.module.min.js'
    }
  }
});
```

### Step 4: Update Build Process
Replace Maven minify plugin with Vite:
```xml
<!-- In pom.xml, replace minify-maven-plugin with -->
<plugin>
  <artifactId>exec-maven-plugin</artifactId>
  <executions>
    <execution>
      <id>vite-build</id>
      <goals>
        <goal>exec</goal>
      </goals>
      <configuration>
        <executable>npm</executable>
        <arguments>
          <argument>run</argument>
          <argument>build</argument>
        </arguments>
      </configuration>
    </execution>
  </executions>
</plugin>
```

### Step 5: Update index.jsp for Vite Build
```jsp
<!-- Development mode -->
<% if (isDevelopment) { %>
  <script type="module" src="/@vite/client"></script>
  <script type="module" src="/javascript/main.js"></script>
<% } else { %>
  <!-- Production mode - Vite-generated bundle -->
  <script type="module" src="/assets/main-[hash].js"></script>
<% } %>
```

## Testing Strategy

After each migration phase:

1. **Functional Testing**
   - Verify game loads and initializes
   - Test 3D rendering (Three.js)
   - Check audio playback
   - Verify all game features work

2. **Performance Testing**
   - Compare bundle sizes
   - Check page load times
   - Verify proper code splitting

3. **Browser Compatibility**
   - Test on Chrome, Firefox, Safari, Edge
   - Verify WebGL support detection still works
   - Check mobile browser compatibility

## Current Script Loading Order

**Critical for Compatibility:**
1. Global config variables (inline script)
2. jQuery (synchronous - required by subsequent code)
3. Deferred scripts (parallel download, execute after DOM):
   - Google Platform API
   - Stacktrace
   - webclient.min.js (includes civclient.js with $(document).ready())
   - audio.min.js
4. Three.js modules (loaded async as type="module")

**Note:** The `defer` attribute maintains script execution order while allowing parallel downloads.

## References

- [Vite Documentation](https://vitejs.dev/)
- [ES6 Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [Import Maps](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap)
- [Script defer attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#defer)
