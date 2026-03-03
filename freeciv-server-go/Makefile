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
FREECIV_LDFLAGS := \
	-L$(FREECIV_BUILD) \
	-lfc_server -lfreeciv -lfc_ai -lfc_dependencies \
	-lm -ldl -lpthread \
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
