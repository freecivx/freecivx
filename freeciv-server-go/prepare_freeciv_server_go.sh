#!/bin/bash

set -e

# Set up the working directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
cd "${DIR}"

BINARY="freeciv-server-go-stub"

# Build the stub binary (no C compiler or Freeciv headers required)
echo "Building freeciv-server-go (stub)..."
CGO_ENABLED=0 go build -o "${BINARY}" . || { echo "Build failed"; exit 1; }

echo "Build complete. Binary: ${DIR}/${BINARY}"
