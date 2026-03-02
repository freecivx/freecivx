# Makefile for freeciv-server-go
#
# Targets
# -------
#   make build       Build the server linked against the real Freeciv C
#                    libraries (requires a pre-compiled Freeciv tree at
#                    ../freeciv).
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
#   1. A configured and compiled Freeciv tree at ../freeciv.
#      Run:  cd ../freeciv/freeciv && ./autogen.sh && ./configure && make
#
#   2. CGO_ENABLED=1 and a C compiler (gcc / clang) on PATH.
#
# CGO flags
# ---------
# The Go files in engine/engine.go declare #cgo CFLAGS and LDFLAGS
# directives that point to the Freeciv headers and libraries.  The
# variables below are passed as overrides when you need a non-standard
# Freeciv prefix.
#
# Example:
#   make build FREECIV_PREFIX=/opt/freeciv

FREECIV_PREFIX ?= ../freeciv/freeciv
BINARY         := freeciv-server-go

# Extra CGO flags can be injected from the environment:
#   CGO_CFLAGS_EXTRA  additional -I / -D flags
#   CGO_LDFLAGS_EXTRA additional -L / -l flags
CGO_CFLAGS_EXTRA  ?=
CGO_LDFLAGS_EXTRA ?=

# Full CGO flag set used when building against the real Freeciv tree.
FREECIV_CFLAGS := \
	-I$(FREECIV_PREFIX) \
	-I$(FREECIV_PREFIX)/common \
	-I$(FREECIV_PREFIX)/server \
	-I$(FREECIV_PREFIX)/utility \
	-I$(FREECIV_PREFIX)/dependencies/lua \
	-DHAVE_CONFIG_H \
	$(CGO_CFLAGS_EXTRA)

FREECIV_LDFLAGS := \
	-L$(FREECIV_PREFIX)/server/.libs   -lfreecivserver \
	-L$(FREECIV_PREFIX)/common/.libs   -lfreecivclient \
	-L$(FREECIV_PREFIX)/utility/.libs  -lfreecivutility \
	-L$(FREECIV_PREFIX)/dependencies/lua/.libs -llua \
	-lm -ldl -lpthread \
	$(CGO_LDFLAGS_EXTRA)

.PHONY: build build-stub test run-stub clean

## build: compile with real Freeciv C libraries (CGO, requires Freeciv tree)
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
