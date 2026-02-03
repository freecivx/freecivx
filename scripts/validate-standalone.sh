#!/bin/bash
# Validation script for standalone 3D testing environment

echo "=== Validating Standalone 3D Testing Environment ==="
echo ""

WEBAPP_DIR="freeciv-web/src/main/webapp"
STANDALONE_DIR="${WEBAPP_DIR}/standalone"
ERRORS=0

# Check main HTML file
echo "Checking main HTML file..."
if [ -f "${WEBAPP_DIR}/freeciv-web-standalone.html" ]; then
  echo "  ✓ freeciv-web-standalone.html exists"
else
  echo "  ✗ freeciv-web-standalone.html NOT FOUND"
  ERRORS=$((ERRORS + 1))
fi

# Check standalone directory
echo ""
echo "Checking standalone directory..."
if [ -d "${STANDALONE_DIR}" ]; then
  echo "  ✓ standalone directory exists"
else
  echo "  ✗ standalone directory NOT FOUND"
  ERRORS=$((ERRORS + 1))
  exit 1
fi

# Check required JavaScript files
echo ""
echo "Checking standalone JavaScript files..."
FILES=(
  "mock-data.js"
  "mock-server.js"
  "renderer-bootstrap.js"
  "test-scenarios.js"
  "screenshot-capture.js"
  "test-runner.js"
  "README.md"
)

for file in "${FILES[@]}"; do
  if [ -f "${STANDALONE_DIR}/${file}" ]; then
    echo "  ✓ ${file} exists"
    
    # Check file size
    SIZE=$(stat -f%z "${STANDALONE_DIR}/${file}" 2>/dev/null || stat -c%s "${STANDALONE_DIR}/${file}")
    if [ "$SIZE" -gt 100 ]; then
      echo "    Size: ${SIZE} bytes"
    else
      echo "    ⚠ Warning: File seems too small (${SIZE} bytes)"
    fi
  else
    echo "  ✗ ${file} NOT FOUND"
    ERRORS=$((ERRORS + 1))
  fi
done

# Check required JavaScript modules
echo ""
echo "Checking required Freeciv-web JavaScript modules..."
REQUIRED_JS=(
  "javascript/fc_types.js"
  "javascript/map.js"
  "javascript/tile.js"
  "javascript/terrain.js"
  "javascript/game.js"
  "javascript/utility.js"
  "javascript/webgpu/renderer_init.js"
  "javascript/webgpu/mapview_common.js"
  "javascript/webgpu/preload.js"
)

for jsfile in "${REQUIRED_JS[@]}"; do
  if [ -f "${WEBAPP_DIR}/${jsfile}" ]; then
    echo "  ✓ ${jsfile} exists"
  else
    echo "  ✗ ${jsfile} NOT FOUND"
    ERRORS=$((ERRORS + 1))
  fi
done

# Check Three.js libraries
echo ""
echo "Checking Three.js libraries..."
THREEJS_FILES=(
  "javascript/webgpu/libs/threejs/three.module.min.js"
  "javascript/webgpu/libs/GLTFLoader.js"
  "javascript/webgpu/libs/OrbitControls.js"
  "javascript/webgpu/libs/DRACOLoader.js"
)

for threefile in "${THREEJS_FILES[@]}"; do
  if [ -f "${WEBAPP_DIR}/${threefile}" ]; then
    echo "  ✓ ${threefile} exists"
  else
    echo "  ✗ ${threefile} NOT FOUND"
    ERRORS=$((ERRORS + 1))
  fi
done

# Check Playwright test
echo ""
echo "Checking Playwright test..."
if [ -f "freeciv-web/tests/playwright/standalone.test.js" ]; then
  echo "  ✓ standalone.test.js exists"
else
  echo "  ✗ standalone.test.js NOT FOUND"
  ERRORS=$((ERRORS + 1))
fi

# Summary
echo ""
echo "=== Validation Summary ==="
if [ $ERRORS -eq 0 ]; then
  echo "✓ All validation checks passed!"
  echo ""
  echo "To use the standalone environment:"
  echo "1. Start a web server (e.g., run Tomcat or use python -m http.server)"
  echo "2. Navigate to http://localhost/freeciv-web-standalone.html"
  echo "3. Wait for 3D renderer to initialize"
  echo "4. Use test runner and screenshot controls to test"
  exit 0
else
  echo "✗ Validation failed with ${ERRORS} error(s)"
  exit 1
fi
