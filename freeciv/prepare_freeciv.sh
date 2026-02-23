#!/bin/bash

# Set up the working directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
cd "${DIR}/freeciv" || exit

# Source version information
. ../version.txt

# Set up install directory
INSTALL_DIR="${HOME}/freeciv"
NUM_CORES=$(nproc)

# Create build directory
if [ ! -d "${DIR}/build" ]; then
  mkdir -p "${DIR}/build"
fi

cd "${DIR}/build" || exit

# Configure with Meson with Rust AI enabled by default
echo "Configuring Freeciv with Rust AI using Meson..."
meson setup \
  --prefix="${INSTALL_DIR}" \
  --buildtype=release \
  -Dclients=[] \
  -Dfcmp=cli \
  -Djson-protocol=true \
  -Dnls=false \
  -Dserver=freeciv-web \
  -Daudio=false \
  -Druledit=false \
  -Dc_link_args="-Wl,-rpath,${INSTALL_DIR}/lib" \
  ../freeciv

# Build using all available CPU cores
echo "Building Freeciv..."
ninja -j "${NUM_CORES}"

# Finish up
echo "Build complete."
echo "Installed to: ${INSTALL_DIR}"
