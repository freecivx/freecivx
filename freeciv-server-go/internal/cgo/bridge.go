//go:build freeciv_cgo

// Package cgo provides a CGO bridge between the Freeciv C server and Go.
//
// Build with:
//
//	go build -tags freeciv_cgo .
//
// The Makefile at the module root provides the canonical build command with
// all required CFLAGS and LDFLAGS configured automatically.
package cgo

// CGO bridge to the Freeciv C player data.
//
// The #cgo CFLAGS and LDFLAGS below mirror those in engine/engine.go.
// ${SRCDIR} expands to the absolute path of this file's directory so
// paths resolve correctly regardless of where `go build` is invoked.
// Freeciv is built with meson; source headers live in ../freeciv/freeciv
// and the static libraries are in ../freeciv/build (both relative to
// this module root, three levels up from this file).
//
// The inline #cgo LDFLAGS use hardcoded library names for external
// dependencies (sqlite3, lzma, icu-uc, MagickWand).  The Makefile and
// prepare_freeciv_server_go.sh use pkg-config for version-specific
// resolution; when building via those tools their CGO_LDFLAGS override
// these inline directives.

/*
#cgo CFLAGS: -I${SRCDIR}/../../../freeciv/freeciv
#cgo CFLAGS: -I${SRCDIR}/../../../freeciv/freeciv/common
#cgo CFLAGS: -I${SRCDIR}/../../../freeciv/freeciv/common/aicore
#cgo CFLAGS: -I${SRCDIR}/../../../freeciv/freeciv/common/networking
#cgo CFLAGS: -I${SRCDIR}/../../../freeciv/freeciv/server
#cgo CFLAGS: -I${SRCDIR}/../../../freeciv/freeciv/utility
#cgo CFLAGS: -I${SRCDIR}/../../../freeciv/freeciv/dependencies/lua-5.4/src
#cgo CFLAGS: -I${SRCDIR}/../../../freeciv/build
#cgo CFLAGS: -DFC_HAVE_UNISTD_H -DHAVE_CONFIG_H
#cgo LDFLAGS: -L${SRCDIR}/../../../freeciv/build
#cgo LDFLAGS: -lfc_server -lfreeciv -lfc_ai -lfc_dependencies
#cgo LDFLAGS: -ljansson -lm -ldl -lpthread -lreadline -lcurl -lzstd -lsqlite3 -llzma -licuuc -lMagickWand

#include "player.h"
#include "game.h"
#include <stdlib.h>
#include <string.h>

// bridge_player_count returns the total number of occupied player slots.
static int bridge_player_count(void) {
    return player_count();
}

// bridge_player_name returns a pointer to the player's name string, or NULL
// if the player slot with the given id is empty.  The pointer is owned by
// the C engine and must NOT be freed by the caller.
static const char *bridge_player_name(int player_id) {
    struct player *pplayer = player_by_number(player_id);
    if (pplayer == NULL) {
        return NULL;
    }
    return pplayer->name;
}

// bridge_is_ai returns 1 if the player at player_id is AI-controlled, 0
// otherwise (including when the slot is empty).
static int bridge_is_ai(int player_id) {
    struct player *pplayer = player_by_number(player_id);
    if (pplayer == NULL) {
        return 0;
    }
    return is_ai(pplayer) ? 1 : 0;
}
*/
import "C"

import "runtime"

// PlayerInfo holds Go-friendly information about a single Freeciv player.
type PlayerInfo struct {
	Name string `json:"name"`
	IsAI bool   `json:"is_ai"`
	ID   int    `json:"id"`
}

// CStringToGo safely converts a C string pointer to a Go string.
// It returns an empty string if cStr is nil, avoiding a nil-pointer dereference.
func CStringToGo(cStr *C.char) string {
	if cStr == nil {
		return ""
	}
	// C.GoString copies the bytes; the original C pointer is no longer
	// referenced after this call returns.
	return C.GoString(cStr)
}

// FetchCPlayerList iterates through the Freeciv player list via CGO and
// returns a slice of PlayerInfo structs.
//
// runtime.LockOSThread is called before entering C because the Freeciv C
// library is not goroutine-safe: it relies on thread-local state managed by
// the server main loop.  Locking ensures that all C calls in this function
// execute on the same OS thread that initialised the C runtime.
func FetchCPlayerList() []PlayerInfo {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	count := int(C.bridge_player_count())
	players := make([]PlayerInfo, 0, count)
	for i := 0; i < count; i++ {
		cname := C.bridge_player_name(C.int(i))
		if cname == nil {
			continue
		}
		players = append(players, PlayerInfo{
			Name: CStringToGo(cname),
			IsAI: C.bridge_is_ai(C.int(i)) != 0,
			ID:   i,
		})
	}
	return players
}
