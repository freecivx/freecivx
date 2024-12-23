#!/bin/bash

# Set up the working directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
cd "${DIR}"

# Source version information
. ./version.txt

# Set up build directory
BUILD_DIR="build"
INSTALL_DIR="${HOME}/freeciv"
NUM_CORES=$(nproc)

# Create build directory if it doesn't exist
mkdir -p "${BUILD_DIR}"

# Build process
(
  cd "${BUILD_DIR}" || exit

  # Optimize build settings
  meson setup ../freeciv \
    -Dserver='freeciv-web' \
    -Dclients=[] \
    -Dfcmp=cli \
    -Djson-protocol=true \
    -Dnls=false \
    -Daudio=false \
    -Druledit=false \
    -Ddefault_library=static \
    -Dprefix="${INSTALL_DIR}" \
    -Doptimization=3 \
    -Db_lto=true 

  # Build using all available CPU cores
  ninja -j "${NUM_CORES}"
)

# Finish up
echo "Build complete. Output located in: ${BUILD_DIR}"
echo "Installed to: ${INSTALL_DIR}"
