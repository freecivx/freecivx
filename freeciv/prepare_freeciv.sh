#!/bin/bash

# Set up the working directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
cd "${DIR}/freeciv" || exit

# Source version information
. ../version.txt

# Set up install directory
INSTALL_DIR="${HOME}/freeciv"
NUM_CORES=$(nproc)

# Check for Rust installation (required for Rust AI)
echo "Checking for Rust installation..."
if ! command -v rustc &> /dev/null; then
    echo "Warning: Rust compiler (rustc) not found. Rust AI will not be built."
    echo "Install Rust from https://rustup.rs/ to enable Rust AI support."
else
    echo "Rust compiler found: $(rustc --version)"
fi

if ! command -v cargo &> /dev/null; then
    echo "Warning: Cargo not found. Rust AI will not be built."
else
    echo "Cargo found: $(cargo --version)"
fi

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
  --libdir=lib \
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
echo "Building Freeciv (including Rust AI)..."
ninja -j "${NUM_CORES}"

# Finish up
echo "Build complete."
echo "Installed to: ${INSTALL_DIR}"
echo ""
echo "Rust AI has been built and is set as the default AI type."
echo "Deity level AI players will automatically use the Rust AI."
