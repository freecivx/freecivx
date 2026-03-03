# Makefile for freeciv-server-go
#
# Targets
# -------
#   make build       Build the server linked against the real Freeciv C
#                    libraries (requires a pre-compiled Freeciv tree built
#                    with meson at ../freeciv/build).
#
#   make build-stub  Build the server using stub CGO implementations.
#                    No C compiler or Freeciv headers required.
#                    Useful for iterating on Go code and running tests.
#
#   make test        Run the test suite in stub mode.
#
#   make run-stub    Build and run the stub binary (port 8080).
#
#   make clean       Remove build artefacts.
#
# Prerequisites (for 'make build')
# ---------------------------------
#   1. A Freeciv tree built with meson at ../freeciv.
#      Run:  cd ../freeciv && bash prepare_freeciv.sh
#
#   2. CGO_ENABLED=1 and a C compiler (gcc / clang) on PATH.
#
# CGO flags
# ---------
# The Go files in engine/engine.go and internal/cgo/bridge.go declare
# #cgo CFLAGS and LDFLAGS directives using ${SRCDIR}-relative paths that
# point to the meson source tree (../freeciv/freeciv) and build directory
# (../freeciv/build).  The variables below can be used to override these
# defaults when the Freeciv tree is at a non-standard location.
#
# Example:
#   make build FREECIV_SRC=/opt/freeciv/src FREECIV_BUILD=/opt/freeciv/build

FREECIV_SRC   ?= ../freeciv/freeciv
FREECIV_BUILD ?= ../freeciv/build
BINARY        := freeciv-server-go

# Extra CGO flags can be injected from the environment:
#   CGO_CFLAGS_EXTRA  additional -I / -D flags
#   CGO_LDFLAGS_EXTRA additional -L / -l flags
CGO_CFLAGS_EXTRA  ?=
CGO_LDFLAGS_EXTRA ?=

# When liblua5.4-dev is installed (as deb.sh installs it if available), meson
# uses the system Lua instead of the bundled copy.  The static Freeciv
# libraries then contain unresolved references to Lua symbols that must be
# satisfied by linking against the system Lua library.  Detect via pkg-config;
# if system Lua is absent the bundled copy is compiled into fc_dependencies and
# no extra flag is needed.
LUA_LDFLAGS := $(shell pkg-config --libs lua5.4 2>/dev/null || pkg-config --libs lua-5.4 2>/dev/null)

# SQLite3 and LZMA are used by Freeciv's luasql driver and ioz compression
# respectively.  Link against the system libraries unconditionally.
SQLITE_LDFLAGS := -lsqlite3
LZMA_LDFLAGS   := -llzma

# ICU (unicode) is used by Freeciv's utility/support.c.  Prefer pkg-config so
# that the correct versioned library path is used; fall back to -licuuc.
ICU_LDFLAGS := $(shell pkg-config --libs icu-uc 2>/dev/null || echo "-licuuc")

# ImageMagick (MagickWand) is used by Freeciv's common/mapimg.c.  The
# pkg-config name varies across versions/builds of ImageMagick; try the most
# common variants in order and fall back to bare -l flags.
MAGICK_LDFLAGS := $(shell \
  pkg-config --libs MagickWand 2>/dev/null || \
  pkg-config --libs 'MagickWand-7.Q16HDRI' 2>/dev/null || \
  pkg-config --libs 'MagickWand-7.Q16' 2>/dev/null || \
  echo "-lMagickWand -lMagickCore")

# Full CGO flag set used when building against the real Freeciv tree.
# These override the inline #cgo directives in the Go source files.
FREECIV_CFLAGS := \
	-I$(FREECIV_SRC) \
	-I$(FREECIV_SRC)/common \
	-I$(FREECIV_SRC)/common/aicore \
	-I$(FREECIV_SRC)/common/networking \
	-I$(FREECIV_SRC)/server \
	-I$(FREECIV_SRC)/utility \
	-I$(FREECIV_SRC)/dependencies/lua-5.4/src \
	-I$(FREECIV_BUILD) \
	-DHAVE_CONFIG_H \
	$(CGO_CFLAGS_EXTRA)

# Meson produces static libraries named libfc_server.a, libfreeciv.a,
# libfc_ai.a, and libfc_dependencies.a in the build directory.
# -flto is required because prepare_freeciv.sh builds Freeciv with
# -Db_lto=true; the static libraries contain LTO IR and must be linked
# with -flto so gcc can resolve all symbols via the LTO plugin.
FREECIV_LDFLAGS := \
	-flto \
	-L$(FREECIV_BUILD) \
	-lfc_server -lfreeciv -lfc_ai -lfc_dependencies \
	$(LUA_LDFLAGS) \
	-ljansson -lm -ldl -lpthread -lreadline -lcurl -lzstd \
	$(SQLITE_LDFLAGS) $(LZMA_LDFLAGS) $(ICU_LDFLAGS) $(MAGICK_LDFLAGS) \
	$(CGO_LDFLAGS_EXTRA)

.PHONY: build build-stub test run-stub clean

## build: compile with real Freeciv C libraries (CGO, requires meson build)
build:
	CGO_ENABLED=1 \
	CGO_CFLAGS="$(FREECIV_CFLAGS)" \
	CGO_LDFLAGS="$(FREECIV_LDFLAGS)" \
	go build -tags freeciv_cgo -o $(BINARY) .

## build-stub: compile without CGO (uses stub engine implementations)
build-stub:
	CGO_ENABLED=0 go build -o $(BINARY)-stub .

## test: run tests in stub mode
test:
	CGO_ENABLED=0 go test ./...

## run-stub: build and immediately run the stub binary
run-stub: build-stub
	./$(BINARY)-stub

## clean: remove build artefacts
clean:
	rm -f $(BINARY) $(BINARY)-stub
