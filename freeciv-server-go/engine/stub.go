//go:build !freeciv_cgo

// Package engine provides a Go interface to the Freeciv C server.
//
// This file contains stub implementations used when the module is built
// without the freeciv_cgo build tag (i.e. without linking against the
// Freeciv C libraries).  The stubs allow the rest of the codebase –
// including tests – to compile and run without a Freeciv build present.
//
// To build against the real C server use:
//
//	make build   # see the Makefile at the top of this module
package engine

import "log/slog"

// RunCServer is a stub that logs a message and blocks until the caller
// cancels via the stop channel.  In the real (freeciv_cgo) build this
// function calls srv_main() in the C server which never returns.
func RunCServer() {
	slog.Info("freeciv-server-go: C server stub – returning immediately (build without freeciv_cgo tag)")
}

// GetPlayerList returns an empty slice in stub mode.  In the real build
// it reads from the C-level game.players list via CGO.
func GetPlayerList() []string {
	return []string{}
}
