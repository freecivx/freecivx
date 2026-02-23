#!/bin/bash

# Set up the working directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
cd "${DIR}/freeciv" || exit

# Source version information
. ../version.txt

# Set up install directory
INSTALL_DIR="${HOME}/freeciv"
NUM_CORES=$(nproc)

# Generate configure script if it doesn't exist
if [ ! -f configure ]; then
  echo "Generating configure script..."
  ./autogen.sh --disable-nls --no-configure-run
fi

# Create and enter build directory
BUILD_DIR="${DIR}/build"
mkdir -p "${BUILD_DIR}"
cd "${BUILD_DIR}" || exit

# Configure with Rust AI enabled by default
echo "Configuring Freeciv with Rust AI..."
../freeciv/configure \
  --enable-fcweb \
  --disable-client \
  --enable-fcmp=cli \
  --disable-nls \
  --enable-ai-static=rust \
  --prefix="${INSTALL_DIR}" \
  CFLAGS="-O3" \
  CXXFLAGS="-O3"

# Build using all available CPU cores
echo "Building Freeciv..."
make -j "${NUM_CORES}"

# Install to the specified directory
echo "Installing Freeciv..."
make install

# Finish up
echo "Build complete."
echo "Installed to: ${INSTALL_DIR}"
