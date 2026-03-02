//go:build !freeciv_cgo

// Package cgo provides a CGO bridge between the Freeciv C server and Go.
//
// This file contains stub implementations used when the module is built
// without the freeciv_cgo build tag (i.e. without linking against the
// Freeciv C libraries).  The stubs allow the rest of the codebase –
// including tests – to compile and run without a Freeciv build present.
//
// To build against the real C server use:
//
//	make build   # see the Makefile at the top of this module
package cgo

// PlayerInfo holds Go-friendly information about a single Freeciv player.
type PlayerInfo struct {
	Name string `json:"name"`
	IsAI bool   `json:"is_ai"`
	ID   int    `json:"id"`
}

// CStringToGo is a stub that accepts a uintptr placeholder.  In the CGO
// build this function accepts a *C.char and converts it to a Go string; the
// two signatures cannot be unified because the C type only exists in CGO
// compilation units.  This stub is intentionally non-functional: callers
// that actually need to convert C strings must use the freeciv_cgo build tag.
func CStringToGo(_ uintptr) string {
	return ""
}

// FetchCPlayerList returns an empty slice in stub mode.  In the real
// (freeciv_cgo) build it reads from the C-level game.players list via CGO.
func FetchCPlayerList() []PlayerInfo {
	return []PlayerInfo{}
}
