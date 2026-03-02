//go:build freeciv_cgo

package engine

// CGO bridge to the Freeciv C server.
//
// Build with:
//
//	go build -tags freeciv_cgo .
//
// The Makefile provides the canonical build command with all required
// CFLAGS and LDFLAGS set up automatically.
//
// Header search paths and compiler flags are declared below via the
// special #cgo comment directives that the Go tool picks up before the
// import "C" line.
//
// Adjust the paths if your Freeciv tree lives somewhere other than
// ../freeciv relative to this module.

/*
#cgo CFLAGS: -I../freeciv/freeciv \
             -I../freeciv/freeciv/common \
             -I../freeciv/freeciv/server \
             -I../freeciv/freeciv/utility \
             -I../freeciv/freeciv/dependencies/lua \
             -I../freeciv/freeciv \
             -DFC_HAVE_UNISTD_H \
             -DHAVE_CONFIG_H

#cgo LDFLAGS: -L../freeciv/freeciv/server/.libs   -lfreecivserver \
              -L../freeciv/freeciv/common/.libs    -lfreecivclient \
              -L../freeciv/freeciv/utility/.libs   -lfreecivutility \
              -L../freeciv/freeciv/dependencies/lua/.libs -llua \
              -lm -ldl -lpthread

#include "srv_main.h"
#include "player.h"
#include "game.h"

#include <stdlib.h>
#include <string.h>

// fc_run_srv_main is a thin wrapper around srv_main() that removes the
// fc__noreturn attribute so CGO can call it without triggering a
// "call to noreturn function" compiler warning.
void fc_run_srv_main(void) {
    srv_main();
}

// fc_player_name returns a pointer to the name of the player with the
// given numeric ID, or NULL if the ID is out of range.  The returned
// pointer is valid for the lifetime of the player object – callers
// must NOT free it.
const char *fc_player_name(int player_id) {
    struct player *pplayer = player_by_number(player_id);
    if (pplayer == NULL) {
        return NULL;
    }
    return pplayer->name;
}

// fc_player_count returns the total number of player slots that are
// currently occupied (equivalent to player_count() in the C API).
int fc_player_count(void) {
    return player_count();
}
*/
import "C"

import "log/slog"

// RunCServer launches the Freeciv C server main loop.  It calls
// srv_main() which never returns under normal operation; the function
// will only return if the C server exits for some reason (e.g. when
// server_quit() is invoked from elsewhere).
//
// Always call this in its own goroutine so it does not block the Go
// runtime:
//
//	go engine.RunCServer()
func RunCServer() {
	slog.Info("freeciv-server-go: starting Freeciv C server main loop")
	C.fc_run_srv_main()
	slog.Info("freeciv-server-go: Freeciv C server main loop returned")
}

// GetPlayerList returns the names of all current players as a Go
// string slice.  It iterates the C-level player slots via
// player_count() / player_by_number() and converts each char* name
// to a safe Go string using C.GoString, which copies the bytes so
// there is no risk of the Go GC observing a dangling pointer.
//
// This is the canonical CGO idiom for consuming a C-string:
//
//	cstr := C.fc_player_name(C.int(i))   // *C.char – owned by C
//	goStr := C.GoString(cstr)             // []byte copy – owned by Go
func GetPlayerList() []string {
	count := int(C.fc_player_count())
	names := make([]string, 0, count)
	for i := range count {
		cname := C.fc_player_name(C.int(i))
		if cname == nil {
			continue
		}
		// C.GoString performs a safe copy; the original C pointer is
		// no longer referenced after this call.
		names = append(names, C.GoString(cname))
	}
	return names
}
