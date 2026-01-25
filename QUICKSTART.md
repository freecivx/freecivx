# Freeciv Standalone Client - Quick Start Guide for Copilot Development

This guide helps you get the Freeciv standalone client running in **under 5 minutes** for development with GitHub Copilot.

## What is the Standalone Client?

The standalone client is a simplified version of Freeciv-web that runs entirely in the browser with mock data, perfect for:
- Testing 3D rendering without a server
- Rapid UI development
- Learning the codebase
- Debugging game mechanics

## Prerequisites

- **Java 17 or later** (Java 21+ recommended for full builds)
- **Maven 3.6+**
- **Python 3** (for local web server)
- **Modern web browser** with WebGL 2 or WebGPU support

## Quick Start (5 Minutes)

### Step 1: Clone the Repository

```bash
git clone https://github.com/freecivworld/freecivworld.git --depth=10
cd freecivworld
```

### Step 2: Build the Project

```bash
cd freeciv-web
mvn compile -DskipTests=true -Dskip-minify-js=true
```

**Note:** If you have Java 21+, you can omit `-Dskip-minify-js=true` for optimized builds.

### Step 3: Start a Local Web Server

```bash
cd target/freeciv-web
python3 -m http.server 8080
```

**Alternative options:**
- **Node.js:** `npx http-server -p 8080`
- **PHP:** `php -S localhost:8080`

### Step 4: Open in Browser

Navigate to: **http://localhost:8080/freeciv-web-standalone.html**

The game should initialize automatically with:
- 3 players (1 human, 2 AI)
- 40x30 map with varied terrain
- Cities and units
- 3D WebGL rendering

## Common Issues & Solutions

### Build Fails with "Java version 21 is not met"

**Solution:** Either:
1. Upgrade to Java 21+, or
2. Build with minification disabled: `mvn compile -DskipTests=true -Dskip-minify-js=true`

### Missing Derived Sources Error

**Solution:** Run the synchronization script:
```bash
cd scripts
./sync-js-hand.sh
cd ../freeciv-web
mvn compile
```

### WebGL Errors in Browser Console

**Cause:** Missing 3D models or textures. This is normal in standalone mode.

**Solution:** The client handles these gracefully. Check:
- Browser console for specific errors
- GPU/WebGL 2 support in browser

### Blank Screen After Loading

**Possible causes:**
1. JavaScript errors (check browser console)
2. CORS issues (make sure you're using a web server, not file://)
3. WebGL not supported (update browser or GPU drivers)

**Solution:**
```bash
# Try a different web server
cd target/freeciv-web
python3 -m http.server 8080 --bind 127.0.0.1
```

### Database Migration Errors (Production Setup)

**Solution:** For standalone client, you don't need the database. If building for production:
```bash
# Create flyway.properties from template
cp freeciv-web/src/main/resources/flyway.properties.dist freeciv-web/src/main/resources/flyway.properties
# Edit and set your MySQL password
```

## Development Workflow

### Quick JavaScript Changes

For faster iteration when working on JavaScript only:

```bash
# Use the quick JS build script
cd freeciv-web
./build-js.sh
```

This rebuilds JavaScript without recompiling the entire project.

### Testing Changes

1. Make your changes to files in `src/main/webapp/javascript/`
2. Run `mvn compile` (or `./build-js.sh` for JS-only)
3. Refresh browser (Ctrl+F5 for hard refresh)

### Key Files for Standalone Development

- **Entry Point:** `src/main/webapp/freeciv-web-standalone.html`
- **Initialization:** `src/main/webapp/javascript/standalone.js`
- **Map Rendering:** `src/main/webapp/javascript/webgl/mapview_webgl.js`
- **Game Logic:** `src/main/webapp/javascript/client_main.js`

## Running with Docker (Alternative)

If you prefer containerized development:

```bash
docker-compose up
```

Then access: http://localhost:8080/freeciv-web-standalone.html

## Validation

To verify your standalone environment is set up correctly:

```bash
./scripts/validate-standalone.sh
```

This checks all required files and dependencies.

## Next Steps

- **Full Documentation:** See [DEVELOPMENT.md](DEVELOPMENT.md) for architecture details
- **Contributing:** Read [CONTRIBUTING.md](doc/CONTRIBUTING.md) for PR guidelines
- **Testing:** See `freeciv-web/tests/playwright/` for E2E tests
- **3D Models:** See `freeciv-web/src/main/webapp/gltf/` for 3D assets

## Getting Help

- **GitHub Issues:** https://github.com/freecivworld/freecivworld/issues
- **Documentation:** See `/doc` directory
- **Build Logs:** Check Maven output for detailed error messages

## Tips for GitHub Copilot Development

1. **Use browser dev tools:** Open Console/Network tabs for real-time debugging
2. **Focus on one file at a time:** The codebase is large; work incrementally
3. **Check standalone.js:** All mock data initialization is documented there
4. **Test with hard refresh:** Browser caching can hide changes (Ctrl+Shift+R)
5. **Look at existing tests:** `freeciv-web/tests/playwright/standalone.test.js`

## Performance Tips

- **Disable 3D if needed:** Set `webgl_renderer_enabled = false` in `civclient.js`
- **Reduce map size:** Edit `STANDALONE_MAP_WIDTH/HEIGHT` in `standalone.js`
- **Profile rendering:** Use browser Performance tab for bottlenecks

---

**Ready to develop!** The standalone client should now be running at http://localhost:8080/freeciv-web-standalone.html 🎮
