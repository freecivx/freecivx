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
# -flto is required because prepare_freeciv.sh builds with -Db_lto=true; the
# resulting static libraries contain LTO IR rather than regular object code and
# must be linked with -flto so gcc can resolve all symbols via the LTO plugin.
#
# When liblua5.4-dev is installed (as deb.sh installs it if available), meson
# uses the system Lua instead of the bundled copy.  The static Freeciv
# libraries then contain unresolved references to Lua symbols that must be
# satisfied by linking against the system Lua library.  Detect it via
# pkg-config and append its flags; if the system Lua is absent the bundled
# Lua is compiled into fc_dependencies and no extra flag is needed.
LUA_LDFLAGS=""
if pkg-config --exists lua5.4 2>/dev/null; then
  LUA_LDFLAGS=$(pkg-config --libs lua5.4)
elif pkg-config --exists lua-5.4 2>/dev/null; then
  LUA_LDFLAGS=$(pkg-config --libs lua-5.4)
fi

CGO_LDFLAGS_VAL="-flto -L${FREECIV_BUILD} -lfc_server -lfreeciv -lfc_ai -lfc_dependencies ${LUA_LDFLAGS} -ljansson -lm -ldl -lpthread -lreadline -lcurl -lzstd"

echo "Building freeciv-server-go (full CGO build)..."
CGO_ENABLED=1 CGO_CFLAGS="${CGO_CFLAGS_VAL}" CGO_LDFLAGS="${CGO_LDFLAGS_VAL}" \
  go build -tags freeciv_cgo -o "${BINARY}" . || { echo "Build failed"; exit 1; }

echo "Build complete. Binary: ${DIR}/${BINARY}"
