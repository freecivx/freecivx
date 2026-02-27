#!/bin/bash
# Compile websockify-c as a static x86 executable for v86 buildroot
# This script builds websockify-c from https://github.com/mittorn/websockify-c
# which is a C implementation replacing the Python version

set -e  # Exit on error

# Set up the working directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
cd "${DIR}"

# Configuration
BUILD_DIR="websockify-c"
OUTPUT_DIR="${DIR}/websockify-v86"
WEBSOCKIFY_C_REPO="https://github.com/mittorn/websockify-c.git"

echo "========================================="
echo "websockify-c v86 Static Build Script"
echo "========================================="
echo "Build directory: ${BUILD_DIR}"
echo "Output directory: ${OUTPUT_DIR}"
echo "========================================="

# Clean previous build if requested
if [ "$1" = "--clean" ]; then
    echo "Cleaning previous build..."
    rm -rf "${BUILD_DIR}"
    rm -rf "${OUTPUT_DIR}"
fi

# Create output directory
mkdir -p "${OUTPUT_DIR}"

# Clone or update websockify-c repository
if [ ! -d "${BUILD_DIR}" ]; then
    echo "Cloning websockify-c..."
    git clone "${WEBSOCKIFY_C_REPO}" "${BUILD_DIR}"
else
    echo "Updating websockify-c..."
    (cd "${BUILD_DIR}" && git pull)
fi

# Check for required build tools
echo "Checking build dependencies..."
for tool in gcc make; do
    if ! command -v "$tool" &> /dev/null; then
        echo "Error: $tool is not installed"
        exit 1
    fi
done

# Build process
echo ""
echo "Building websockify-c for v86 (static x86 build)..."
(
  cd "${BUILD_DIR}" || exit

  # Clean any previous build
  make clean 2>/dev/null || true

  # Build with static linking and 32-bit target
  # CFLAGS: -static for static linking, -m32 for 32-bit x86
  # LDFLAGS: -static -m32 for linking
  echo "Compiling websockify-c..."
  CFLAGS="-static -m32 -O2" LDFLAGS="-static -m32" make || {
      echo ""
      echo "========================================="
      echo "Build failed!"
      echo "========================================="
      echo ""
      echo "This might be because:"
      echo "1. 32-bit development libraries are not installed"
      echo "   Install with: sudo apt-get install gcc-multilib"
      echo "   Also install 32-bit versions of dependencies:"
      echo "   - libssl-dev:i386"
      echo ""
      echo "2. Some dependencies don't support static linking"
      echo "   You may need to adjust the build"
      echo ""
      exit 1
  }
)

# Copy binary to output directory
echo ""
echo "Installing to ${OUTPUT_DIR}..."
if [ -f "${BUILD_DIR}/websockify" ]; then
    mkdir -p "${OUTPUT_DIR}/bin"
    cp "${BUILD_DIR}/websockify" "${OUTPUT_DIR}/bin/"
    chmod +x "${OUTPUT_DIR}/bin/websockify"
else
    echo "Error: websockify binary not found after build!"
    exit 1
fi

# Verify the build
echo ""
echo "========================================="
echo "Build complete!"
echo "========================================="
echo ""

if [ -f "${OUTPUT_DIR}/bin/websockify" ]; then
    echo "[OK] Binary: ${OUTPUT_DIR}/bin/websockify"
    
    # Check if it's actually static
    if file "${OUTPUT_DIR}/bin/websockify" | grep -q "statically linked"; then
        echo "[OK] Binary is statically linked"
    else
        echo "[WARN] Binary may not be fully statically linked"
        echo "       This might cause issues in v86 if required libraries are missing"
    fi
    
    # Check if it's 32-bit
    if file "${OUTPUT_DIR}/bin/websockify" | grep -q "80386\|i386\|x86-32"; then
        echo "[OK] Binary is 32-bit x86"
    else
        echo "[WARN] Binary is not 32-bit x86"
        echo "       Architecture: $(file "${OUTPUT_DIR}/bin/websockify" | cut -d: -f2)"
    fi
    
    echo ""
    ls -lh "${OUTPUT_DIR}/bin/websockify"
else
    echo "[FAIL] Binary not found!"
    echo "       Expected at: ${OUTPUT_DIR}/bin/websockify"
    exit 1
fi

echo ""
echo "========================================="
echo "Integration with v86-buildroot"
echo "========================================="
echo ""
echo "To include websockify-c in your v86 buildroot rootfs.cpio:"
echo ""
echo "1. Copy to your buildroot overlay:"
echo "   cp ${OUTPUT_DIR}/bin/websockify board/v86/rootfs_overlay/usr/local/bin/"
echo ""
echo "2. Rebuild your rootfs.cpio:"
echo "   cd /path/to/v86-buildroot"
echo "   make all"
echo ""
echo "3. The resulting rootfs.cpio will contain websockify at:"
echo "   /usr/local/bin/websockify"
echo ""
echo "Usage inside v86 Linux:"
echo "  websockify [options] [listen_port] [target_host:target_port]"
echo "  Example: websockify 8080 localhost:5556"
echo ""
echo "This enables WebSocket connections from the browser to reach"
echo "the Freeciv server running inside the v86 emulated Linux."
echo ""
