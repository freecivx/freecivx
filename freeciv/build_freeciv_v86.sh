#!/bin/bash
# Build Freeciv C server as a static x86 executable for v86 buildroot
# v86 is a x86 emulator that runs in the browser: https://github.com/copy/v86
#
# This script compiles a fully static Freeciv server binary that can run
# inside the v86 buildroot environment.
#
# Usage: ./build_freeciv_v86.sh
#
# Output: freeciv-v86/ directory containing the static executable
#
# Integration with v86-buildroot:
# --------------------------------
# To include this Freeciv server in a v86 rootfs.cpio:
#
# 1. Build Freeciv using this script:
#    $ ./build_freeciv_v86.sh
#
# 2. Copy the static binary to v86-buildroot:
#    $ cp freeciv-v86/bin/freeciv-web-server /path/to/v86-buildroot/overlay/usr/local/bin/
#
# 3. For websockify support, include websockify in the rootfs:
#    $ git clone https://github.com/novnc/websockify
#    $ cp -r websockify/websockify /path/to/v86-buildroot/overlay/usr/local/lib/python3.x/site-packages/
#    $ cp websockify/websockify /path/to/v86-buildroot/overlay/usr/local/bin/
#
# 4. Rebuild the rootfs.cpio with v86-buildroot:
#    $ cd /path/to/v86-buildroot
#    $ make
#
# 5. The resulting rootfs.cpio will contain both Freeciv server and websockify
#
# Requirements:
# - GCC toolchain with static library support
# - Meson build system
# - Ninja build system
# - Standard C library static libraries (musl recommended for smaller size)

set -e  # Exit on error
set -u  # Exit on undefined variable

# Set up the working directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
cd "${DIR}"

# Source version information
. ./version.txt

# Set up build directory
BUILD_DIR="build-v86"
OUTPUT_DIR="${DIR}/freeciv-v86"
# Detect number of CPU cores with fallback
if command -v nproc >/dev/null 2>&1; then
    NUM_CORES=$(nproc)
elif command -v sysctl >/dev/null 2>&1; then
    NUM_CORES=$(sysctl -n hw.ncpu 2>/dev/null || echo "1")
else
    NUM_CORES=1
fi

# Detect or set compiler for static builds
# For best v86 compatibility, use i686-linux-gnu-gcc if available
if command -v i686-linux-gnu-gcc >/dev/null 2>&1; then
    export CC=i686-linux-gnu-gcc
    export CXX=i686-linux-gnu-g++
    CROSS_FILE_CONTENT="[binaries]
c = 'i686-linux-gnu-gcc'
cpp = 'i686-linux-gnu-g++'
ar = 'i686-linux-gnu-ar'
strip = 'i686-linux-gnu-strip'
pkgconfig = 'i686-linux-gnu-pkg-config'

[host_machine]
system = 'linux'
cpu_family = 'x86'
cpu = 'i686'
endian = 'little'"
    CROSS_FILE="${DIR}/meson-cross-i686.txt"
    echo "$CROSS_FILE_CONTENT" > "$CROSS_FILE"
    CROSS_ARGS="--cross-file=$CROSS_FILE"
    echo "Using i686 cross-compiler for v86 compatibility"
else
    CROSS_ARGS=""
    echo "Warning: i686 cross-compiler not found. Building with native compiler."
    echo "For v86 compatibility, install: sudo apt-get install gcc-multilib g++-multilib"
    if [ "$(uname -m)" != "i686" ] && [ "$(uname -m)" != "x86_64" ]; then
        echo "Error: Not on an x86-compatible architecture"
        exit 1
    fi
fi

# Clean previous build
rm -rf "${BUILD_DIR}"
rm -rf "${OUTPUT_DIR}"
mkdir -p "${BUILD_DIR}"
mkdir -p "${OUTPUT_DIR}"

echo "================================"
echo "Building Freeciv for v86"
echo "================================"
echo "Output directory: ${OUTPUT_DIR}"
echo "Build directory: ${BUILD_DIR}"
echo "Using ${NUM_CORES} CPU cores"
echo ""

# Build process
(
  cd "${BUILD_DIR}" || exit

  # Configure with meson for static build optimized for v86
  # Key flags:
  # - default_library=static: Build static libraries
  # - b_lto=true: Link-time optimization for smaller binary
  # - optimization=2: Optimize for size and speed (3 for max speed, s for size)
  # - prefer_static=true: Prefer static linking
  # - server='freeciv-web': Build freeciv-web server variant
  # - clients=[]: No GUI clients needed
  # - json-protocol=true: Enable JSON protocol for web
  # - nls=false: Disable internationalization (reduces size)
  # - audio=false: No audio support needed
  # - ruledit=false: No ruleset editor needed
  # - readline=false: Disable readline (may not be available statically)
  
  meson setup ../freeciv \
    $CROSS_ARGS \
    -Dserver='freeciv-web' \
    -Dclients=[] \
    -Dfcmp=cli \
    -Djson-protocol=true \
    -Dnls=false \
    -Daudio=false \
    -Druledit=false \
    -Dreadline=false \
    -Ddefault_library=static \
    -Dprefer_static=true \
    -Dprefix="${OUTPUT_DIR}" \
    -Doptimization=2 \
    -Db_lto=true \
    -Db_pie=false

  # Build using all available CPU cores
  echo ""
  echo "Starting build..."
  ninja -j "${NUM_CORES}"

  # Install to output directory
  echo ""
  echo "Installing to ${OUTPUT_DIR}..."
  ninja install
)

# Verify the binary
echo ""
echo "================================"
echo "Build complete!"
echo "================================"

if [ -f "${OUTPUT_DIR}/bin/freeciv-web-server" ]; then
    echo "✓ Freeciv server binary created: ${OUTPUT_DIR}/bin/freeciv-web-server"
    
    # Check if binary is static
    if command -v ldd >/dev/null 2>&1; then
        echo ""
        echo "Checking if binary is static:"
        if ldd "${OUTPUT_DIR}/bin/freeciv-web-server" 2>&1 | grep -q "not a dynamic executable"; then
            echo "✓ Binary is fully static"
        else
            echo "⚠ Warning: Binary may not be fully static:"
            ldd "${OUTPUT_DIR}/bin/freeciv-web-server" || true
        fi
    fi
    
    # Show binary size
    BINARY_SIZE=$(du -h "${OUTPUT_DIR}/bin/freeciv-web-server" | cut -f1)
    echo ""
    echo "Binary size: ${BINARY_SIZE}"
    
    # Show binary info
    if command -v file >/dev/null 2>&1; then
        echo ""
        echo "Binary info:"
        file "${OUTPUT_DIR}/bin/freeciv-web-server"
    fi
    
    echo ""
    echo "To include in v86 buildroot rootfs.cpio:"
    echo "  1. Copy binary: cp ${OUTPUT_DIR}/bin/freeciv-web-server <v86-buildroot>/overlay/usr/local/bin/"
    echo "  2. Add websockify to overlay (see script comments for details)"
    echo "  3. Rebuild rootfs: cd <v86-buildroot> && make"
    echo ""
    echo "See script header for detailed integration instructions."
else
    echo "✗ Error: Binary not found at expected location"
    exit 1
fi
