#!/bin/bash

set -e

# Set up the working directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
cd "${DIR}"

BINARY="freeciv-server-go"

# Freeciv is built with meson.  The source tree and meson build directory
# are located at fixed paths relative to this module:
#   Source headers : ../freeciv/freeciv
#   Meson build dir: ../freeciv/build  (output of prepare_freeciv.sh)
FREECIV_SRC="${DIR}/../freeciv/freeciv"
FREECIV_BUILD="${DIR}/../freeciv/build"

CGO_CFLAGS_VAL="-I${FREECIV_SRC} -I${FREECIV_SRC}/common -I${FREECIV_SRC}/common/aicore -I${FREECIV_SRC}/server -I${FREECIV_SRC}/utility -I${FREECIV_SRC}/dependencies/lua-5.4/src -I${FREECIV_BUILD} -DFC_HAVE_UNISTD_H -DHAVE_CONFIG_H"

# Meson produces: libfc_server.a, libfreeciv.a, libfc_ai.a, libfc_dependencies.a
CGO_LDFLAGS_VAL="-L${FREECIV_BUILD} -lfc_server -lfreeciv -lfc_ai -lfc_dependencies -lm -ldl -lpthread"

echo "Building freeciv-server-go (full CGO build)..."
CGO_ENABLED=1 CGO_CFLAGS="${CGO_CFLAGS_VAL}" CGO_LDFLAGS="${CGO_LDFLAGS_VAL}" \
  go build -tags freeciv_cgo -o "${BINARY}" . || { echo "Build failed"; exit 1; }

echo "Build complete. Binary: ${DIR}/${BINARY}"
