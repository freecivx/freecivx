#!/bin/bash
# Compile Freeciv C server as a static x86 executable for v86 buildroot
# This script builds a fully static Freeciv server that can run inside the v86 emulator

set -e  # Exit on error

# Set up the working directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
cd "${DIR}"

# Source version information
. ./version.txt

# Configuration
BUILD_DIR="build-v86"
OUTPUT_DIR="${DIR}/freeciv-v86"
NUM_CORES=$(nproc)

echo "========================================="
echo "Freeciv v86 Static Build Script"
echo "========================================="
echo "Build directory: ${BUILD_DIR}"
echo "Output directory: ${OUTPUT_DIR}"
echo "CPU cores: ${NUM_CORES}"
echo "========================================="

# Clean previous build if requested
if [ "$1" = "--clean" ]; then
    echo "Cleaning previous build..."
    rm -rf "${BUILD_DIR}"
    rm -rf "${OUTPUT_DIR}"
fi

# Create build directory
mkdir -p "${BUILD_DIR}"
mkdir -p "${OUTPUT_DIR}"

# Check if freeciv source exists
if [ ! -d "freeciv" ]; then
    echo "Error: freeciv source directory not found!"
    echo "Please run prepare_freeciv.sh first to checkout and patch Freeciv."
    exit 1
fi

# Check for required build tools
echo "Checking build dependencies..."
for tool in gcc ninja pkg-config; do
    if ! command -v "$tool" &> /dev/null; then
        echo "Error: $tool is not installed"
        exit 1
    fi
done

# Check for meson
if ! command -v meson &> /dev/null && ! python3 -m mesonbuild --version &> /dev/null; then
    echo "Error: meson is not installed"
    echo "Install with: pip3 install meson"
    exit 1
fi

# Set meson command
MESON_CMD="meson"
if ! command -v meson &> /dev/null; then
    MESON_CMD="python3 -m mesonbuild"
fi

echo "Using meson: $MESON_CMD"

# Build process
echo ""
echo "Configuring Freeciv for v86 (static x86 build)..."
(
  cd "${BUILD_DIR}" || exit

  # Configure with meson for static linking
  # Key options:
  # - server='freeciv-web': Build freeciv-web server variant
  # - clients=[]: Don't build any clients
  # - fcmp=cli: Only build CLI modpack installer
  # - json-protocol=true: Enable JSON protocol for web client
  # - nls=false: Disable translations (reduces size)
  # - audio=false: No audio support needed
  # - ruledit=false: Don't build rule editor
  # - default_library=static: Build static libraries
  # - prefer_static=true: Prefer static linking
  # - optimization=2: Optimize for size
  # - strip=true: Strip symbols to reduce size
  # - b_lto=true: Enable link-time optimization
  
  CFLAGS="-static -m32" LDFLAGS="-static -m32" \
  $MESON_CMD setup ../freeciv \
    -Dserver='freeciv-web' \
    -Dclients=[] \
    -Dfcmp=cli \
    -Djson-protocol=true \
    -Dnls=false \
    -Daudio=false \
    -Druledit=false \
    -Ddefault_library=static \
    -Dprefer_static=true \
    -Dprefix="${OUTPUT_DIR}" \
    -Doptimization=2 \
    -Dstrip=true \
    -Db_lto=true \
    -Dc_args="-static -m32" \
    -Dc_link_args="-static -m32" \
    || {
        echo ""
        echo "========================================="
        echo "Configuration failed!"
        echo "========================================="
        echo ""
        echo "This might be because:"
        echo "1. 32-bit development libraries are not installed"
        echo "   Install with: sudo apt-get install gcc-multilib g++-multilib"
        echo "   Also install 32-bit versions of dependencies:"
        echo "   - zlib1g-dev:i386"
        echo "   - libcurl4-openssl-dev:i386"
        echo "   - libsqlite3-dev:i386"
        echo ""
        echo "2. Some dependencies don't support static linking"
        echo "   You may need to build a less statically-linked version"
        echo ""
        exit 1
    }

  # Build using all available CPU cores
  echo ""
  echo "Building Freeciv server..."
  ninja -j "${NUM_CORES}" || {
      echo ""
      echo "Build failed! Check the errors above."
      exit 1
  }

  # Install to output directory
  echo ""
  echo "Installing to ${OUTPUT_DIR}..."
  ninja install || {
      echo ""
      echo "Installation failed!"
      exit 1
  }
)

# Verify the build
echo ""
echo "========================================="
echo "Build complete!"
echo "========================================="
echo ""

if [ -f "${OUTPUT_DIR}/bin/freeciv-web" ]; then
    echo "[OK] Server binary: ${OUTPUT_DIR}/bin/freeciv-web"
    
    # Check if it's actually static
    if file "${OUTPUT_DIR}/bin/freeciv-web" | grep -q "statically linked"; then
        echo "[OK] Binary is statically linked"
    else
        echo "[WARN] Binary may not be fully statically linked"
        echo "       This might cause issues in v86 if required libraries are missing"
    fi
    
    # Check if it's 32-bit
    if file "${OUTPUT_DIR}/bin/freeciv-web" | grep -q "80386\|i386\|x86-32"; then
        echo "[OK] Binary is 32-bit x86"
    else
        echo "[WARN] Binary is not 32-bit x86"
        echo "       Architecture: $(file "${OUTPUT_DIR}/bin/freeciv-web" | cut -d: -f2)"
    fi
    
    echo ""
    ls -lh "${OUTPUT_DIR}/bin/freeciv-web"
else
    echo "[FAIL] Server binary not found!"
    echo "       Expected at: ${OUTPUT_DIR}/bin/freeciv-web"
    exit 1
fi

# List data files
echo ""
echo "Data files installed:"
ls -lh "${OUTPUT_DIR}/share/freeciv/" 2>/dev/null || echo "  (no data files found)"

echo ""
echo "========================================="
echo "Integration with v86-buildroot"
echo "========================================="
echo ""
echo "To include this Freeciv server in your v86 buildroot rootfs.cpio:"
echo ""
echo "1. Clone v86-buildroot if you haven't already:"
echo "   git clone https://github.com/chschnell/v86-buildroot"
echo "   cd v86-buildroot"
echo "   make bootstrap"
echo ""
echo "2. Copy the binaries and data to your buildroot overlay:"
echo "   cp -r ${OUTPUT_DIR}/* board/v86/rootfs_overlay/usr/local/"
echo ""
echo "3. For websockify support (if needed for WebSocket tunneling):"
echo "   - Add python3 package in buildroot menuconfig"
echo "   - Add python-websockify package or copy websockify.py"
echo "   - Example: BR2_PACKAGE_PYTHON3=y"
echo "   - Then get websockify:"
echo "     git clone https://github.com/novnc/websockify"
echo "     cp websockify/websockify board/v86/rootfs_overlay/usr/local/bin/"
echo ""
echo "4. Rebuild your rootfs.cpio:"
echo "   cd /path/to/v86-buildroot"
echo "   make all"
echo ""
echo "5. The resulting rootfs.cpio will contain Freeciv server at:"
echo "   /usr/local/bin/freeciv-web"
echo "   /usr/local/share/freeciv/ (data files)"
echo ""
echo "6. To use in v86, copy rootfs.cpio to your web app:"
echo "   cp build/v86/images/rootfs.cpio /path/to/freecivworld/freeciv-web/src/main/webapp/v86/"
echo ""
echo "For more details on v86 and buildroot, see:"
echo "  - https://github.com/copy/v86"
echo "  - https://github.com/chschnell/v86-buildroot"
echo "  - doc/v86-embedded-linux.md in this repository"
echo ""
