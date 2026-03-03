#!/bin/bash

set -e

# Set up the working directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
cd "${DIR}"

BINARY="freeciv-server-go"

# Build the full binary linked against the Freeciv C libraries.
# The CGO header and library paths are declared in engine/engine.go via
# #cgo directives pointing to ../freeciv/freeciv (relative to this module),
# so no extra CGO_CFLAGS/CGO_LDFLAGS overrides are needed here.
echo "Building freeciv-server-go (full CGO build)..."
CGO_ENABLED=1 go build -tags freeciv_cgo -o "${BINARY}" . || { echo "Build failed"; exit 1; }

echo "Build complete. Binary: ${DIR}/${BINARY}"
