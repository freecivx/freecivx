#!/bin/bash
# Integrate Freeciv C server and websockify-c into v86 buildroot
# This script automates copying all necessary files to buildroot overlay
# including the Freeciv server, rulesets, nations, and websockify-c

set -e  # Exit on error

# Set up the working directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
cd "${DIR}"

echo "========================================="
echo "v86 Buildroot Integration Script"
echo "========================================="
echo ""

# Check for required inputs
FREECIV_V86_DIR="${DIR}/freeciv-v86"
WEBSOCKIFY_V86_DIR="${DIR}/websockify-v86"
BUILDROOT_DIR="${1:-}"

# Usage message
usage() {
    echo "Usage: $0 <buildroot_path>"
    echo ""
    echo "This script integrates Freeciv C server and websockify-c into v86-buildroot."
    echo ""
    echo "Arguments:"
    echo "  buildroot_path  Path to v86-buildroot directory"
    echo ""
    echo "Prerequisites:"
    echo "  1. Run ./compile_freeciv_v86.sh to build Freeciv server"
    echo "  2. Run ./compile_websockify_c_v86.sh to build websockify-c"
    echo "  3. Clone v86-buildroot if not already done:"
    echo "     git clone https://github.com/chschnell/v86-buildroot"
    echo "     cd v86-buildroot && make bootstrap"
    echo ""
    echo "Example:"
    echo "  $0 /path/to/v86-buildroot"
    echo ""
    exit 1
}

# Check if buildroot path is provided
if [ -z "${BUILDROOT_DIR}" ]; then
    echo "Error: buildroot path not provided"
    echo ""
    usage
fi

# Validate buildroot directory
if [ ! -d "${BUILDROOT_DIR}" ]; then
    echo "Error: Buildroot directory not found: ${BUILDROOT_DIR}"
    echo ""
    usage
fi

OVERLAY_DIR="${BUILDROOT_DIR}/board/v86/rootfs_overlay/usr/local"

if [ ! -d "${BUILDROOT_DIR}/board/v86" ]; then
    echo "Error: Not a valid v86-buildroot directory (missing board/v86)"
    echo "       Expected: ${BUILDROOT_DIR}/board/v86"
    echo ""
    usage
fi

# Check if Freeciv build exists
if [ ! -d "${FREECIV_V86_DIR}" ]; then
    echo "Error: Freeciv v86 build not found!"
    echo "       Expected at: ${FREECIV_V86_DIR}"
    echo ""
    echo "Please run ./compile_freeciv_v86.sh first to build Freeciv server."
    exit 1
fi

if [ ! -f "${FREECIV_V86_DIR}/bin/freeciv-web" ]; then
    echo "Error: Freeciv binary not found!"
    echo "       Expected at: ${FREECIV_V86_DIR}/bin/freeciv-web"
    exit 1
fi

# Check if websockify build exists (optional)
INCLUDE_WEBSOCKIFY=false
if [ -f "${WEBSOCKIFY_V86_DIR}/bin/websockify" ]; then
    INCLUDE_WEBSOCKIFY=true
    echo "[OK] websockify-c binary found"
else
    echo "[WARN] websockify-c binary not found at: ${WEBSOCKIFY_V86_DIR}/bin/websockify"
    echo "       WebSocket support will not be included"
    echo "       Run ./compile_websockify_c_v86.sh if you need WebSocket tunneling"
    echo ""
fi

# Create overlay directories
echo "Creating buildroot overlay directories..."
mkdir -p "${OVERLAY_DIR}/bin"
mkdir -p "${OVERLAY_DIR}/share"

# Copy Freeciv server binary
echo ""
echo "Copying Freeciv server..."
cp -v "${FREECIV_V86_DIR}/bin/freeciv-web" "${OVERLAY_DIR}/bin/"

# Copy Freeciv data files (rulesets, nations, etc.)
echo ""
echo "Copying Freeciv data files (rulesets, nations, etc.)..."
if [ -d "${FREECIV_V86_DIR}/share/freeciv" ]; then
    cp -rv "${FREECIV_V86_DIR}/share/freeciv" "${OVERLAY_DIR}/share/"
    
    # List what was copied
    echo ""
    echo "Data files copied:"
    ls -lh "${OVERLAY_DIR}/share/freeciv/" || true
    
    # Check for important subdirectories
    for subdir in rulesets nations scenarios tilesets; do
        if [ -d "${OVERLAY_DIR}/share/freeciv/${subdir}" ]; then
            count=$(find "${OVERLAY_DIR}/share/freeciv/${subdir}" -type f | wc -l)
            echo "  - ${subdir}: ${count} files"
        fi
    done
else
    echo "Warning: Freeciv data directory not found!"
    echo "         Expected at: ${FREECIV_V86_DIR}/share/freeciv"
    echo "         The server may not work properly without data files."
fi

# Copy websockify-c if available
if [ "${INCLUDE_WEBSOCKIFY}" = true ]; then
    echo ""
    echo "Copying websockify-c..."
    cp -v "${WEBSOCKIFY_V86_DIR}/bin/websockify" "${OVERLAY_DIR}/bin/"
fi

# Verify files
echo ""
echo "========================================="
echo "Integration complete!"
echo "========================================="
echo ""
echo "Files copied to buildroot overlay:"
echo ""
ls -lh "${OVERLAY_DIR}/bin/"
echo ""

# Calculate total size
TOTAL_SIZE=$(du -sh "${OVERLAY_DIR}" | cut -f1)
echo "Total overlay size: ${TOTAL_SIZE}"
echo ""

# Show what will be in the rootfs
echo "The following will be included in rootfs.cpio:"
echo ""
echo "Binaries:"
echo "  /usr/local/bin/freeciv-web    - Freeciv server"
if [ "${INCLUDE_WEBSOCKIFY}" = true ]; then
echo "  /usr/local/bin/websockify     - WebSocket proxy (C implementation)"
fi
echo ""
echo "Data files:"
echo "  /usr/local/share/freeciv/     - Game data (rulesets, nations, etc.)"
echo ""

# Next steps
echo "========================================="
echo "Next Steps"
echo "========================================="
echo ""
echo "1. Review the overlay directory contents:"
echo "   ls -R ${OVERLAY_DIR}"
echo ""
echo "2. (Optional) Add startup scripts to run Freeciv automatically:"
echo "   Create: ${BUILDROOT_DIR}/board/v86/rootfs_overlay/etc/init.d/S99freeciv"
echo ""
echo "3. Rebuild rootfs.cpio with all changes:"
echo "   cd ${BUILDROOT_DIR}"
echo "   make all"
echo ""
echo "4. Copy the built files to FreecivWorld web app:"
echo "   cp ${BUILDROOT_DIR}/build/v86/images/bzImage /path/to/freecivworld/freeciv-web/src/main/webapp/v86/"
echo "   cp ${BUILDROOT_DIR}/build/v86/images/rootfs.cpio /path/to/freecivworld/freeciv-web/src/main/webapp/v86/"
echo ""
echo "5. Test in the browser by loading the v86 terminal"
echo ""
echo "For network setup documentation, see:"
echo "  freeciv-web/src/main/webapp/javascript/server-xterm-v86.js"
echo "  doc/v86-embedded-linux.md"
echo ""
