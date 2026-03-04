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
// dependencies (sqlite3, lzma, icu-uc).  MagickWand is intentionally
// omitted here because its library name is version-specific on Ubuntu
// (e.g. libMagickWand-6.Q16); the Makefile and
// prepare_freeciv_server_go.sh resolve the correct name via pkg-config and
// supply it through the CGO_LDFLAGS environment variable.  CGO_LDFLAGS
// appends to (rather than replaces) inline directives, so including
// -lMagickWand here would cause a link failure on systems where only the
// versioned library name exists.

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
#cgo LDFLAGS: -ljansson -lm -ldl -lpthread -lreadline -lcurl -lzstd -lsqlite3 -llzma -licuuc

#include "player.h"
#include "game.h"
#include "connection.h"   /* conn_by_number */
#include "handchat.h"     /* handle_chat_msg_req */
#include <stdlib.h>
#include <string.h>

// Forward-declare server-side packet handlers.  Their definitions live in
// the Freeciv server libraries; the actual declarations are generated into
// hand_gen.h (build dir) which we avoid including here to keep the bridge
// self-contained.  All enum parameters are passed as int and cast inside the
// bridge wrapper so the ABI matches (C enums are int-sized).

void handle_nation_select_req(struct connection *pc, int player_no,
                              int nation_no, bool is_male,
                              const char *name, int style);
void handle_player_ready(struct player *requestor, int player_no,
                         bool is_ready);
void handle_player_phase_done(struct player *pplayer, int turn);
void handle_player_rates(struct player *pplayer,
                         int tax, int luxury, int science);
void handle_player_change_government(struct player *pplayer, int government);
void handle_player_research(struct player *pplayer, int tech);
void handle_player_tech_goal(struct player *pplayer, int tech_goal);
void handle_player_attribute_block(struct player *pplayer);
void handle_player_place_infra(struct player *pplayer, int tile, int extra);
void handle_report_req(struct connection *pconn, int type);
void handle_vote_submit(struct connection *pconn, int vote_no, int value);
void handle_spaceship_launch(struct player *pplayer);
void handle_spaceship_place(struct player *pplayer, int type, int num);
void handle_city_sell(struct player *pplayer, int city_id, int build_id);
void handle_city_buy(struct player *pplayer, int city_id);
void handle_city_change(struct player *pplayer, int city_id,
                        int production_kind, int production_value);
void handle_city_refresh(struct player *pplayer, int city_id);
void handle_city_rename(struct player *pplayer, int city_id,
                        const char *name);
void handle_city_options_req(struct player *pplayer, int city_id, int options);
void handle_city_make_specialist(struct player *pplayer, int city_id,
                                 int worker_position);
void handle_city_make_worker(struct player *pplayer, int city_id,
                             int specialist_from);
void handle_city_change_specialist(struct player *pplayer, int city_id,
                                   int from, int to);
void handle_city_rally_point(struct player *pplayer, int city_id,
                             int length, const int *steps);
void handle_web_cma_set(struct player *pplayer, int id,
                        int celebrate, const int *parameters);
void handle_web_cma_clear(struct player *pplayer, int id);
void handle_city_name_suggestion_req(struct player *pplayer, int unit_id);
void handle_diplomacy_init_meeting_req(struct player *pplayer, int counterpart);
void handle_diplomacy_cancel_meeting_req(struct player *pplayer, int counterpart);
void handle_diplomacy_accept_treaty_req(struct player *pplayer, int counterpart);
void handle_diplomacy_create_clause_req(struct player *pplayer,
                                        int counterpart, int giver,
                                        int type, int value);
void handle_diplomacy_remove_clause_req(struct player *pplayer,
                                        int counterpart, int giver,
                                        int type, int value);
void handle_diplomacy_cancel_pact(struct player *pplayer,
                                  int other_player_id, int clause);
void handle_web_goto_path_req(struct player *pplayer, int unit_id, int goal);
void handle_web_info_text_req(struct player *pplayer, int loc,
                              int visible_unit_id, int focus_unit_id);

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

// bridge_conn_player returns the player pointer for the connection with the
// given ID, or NULL if no such connection exists or the connection has no
// associated player.  The conn_id must correspond to the Freeciv server's
// internal connection numbering (conn->id), which the Go layer is responsible
// for keeping in sync.
static struct player *bridge_conn_player(int conn_id) {
    struct connection *pc = conn_by_number(conn_id);
    if (pc == NULL) {
        return NULL;
    }
    return pc->player;
}

// ── Connection-based bridge wrappers ─────────────────────────────────────────

static void bridge_handle_chat_msg_req(int conn_id, const char *message) {
    struct connection *pc = conn_by_number(conn_id);
    if (pc == NULL) { return; }
    handle_chat_msg_req(pc, message);
}

static void bridge_handle_nation_select_req(int conn_id, int player_no,
                                            int nation_no, int is_male,
                                            const char *name, int style) {
    struct connection *pc = conn_by_number(conn_id);
    if (pc == NULL) { return; }
    handle_nation_select_req(pc, player_no, nation_no, (bool)is_male, name, style);
}

static void bridge_handle_report_req(int conn_id, int report_type) {
    struct connection *pc = conn_by_number(conn_id);
    if (pc == NULL) { return; }
    handle_report_req(pc, report_type);
}

static void bridge_handle_vote_submit(int conn_id, int vote_no, int value) {
    struct connection *pc = conn_by_number(conn_id);
    if (pc == NULL) { return; }
    handle_vote_submit(pc, vote_no, value);
}

// ── Player-based bridge wrappers ─────────────────────────────────────────────

static void bridge_handle_player_ready(int conn_id, int player_no,
                                       int is_ready) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_player_ready(pplayer, player_no, (bool)is_ready);
}

static void bridge_handle_player_phase_done(int conn_id, int turn) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_player_phase_done(pplayer, turn);
}

static void bridge_handle_player_rates(int conn_id, int tax,
                                       int luxury, int science) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_player_rates(pplayer, tax, luxury, science);
}

static void bridge_handle_player_change_government(int conn_id,
                                                   int government) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_player_change_government(pplayer, government);
}

static void bridge_handle_player_research(int conn_id, int tech) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_player_research(pplayer, tech);
}

static void bridge_handle_player_tech_goal(int conn_id, int tech_goal) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_player_tech_goal(pplayer, tech_goal);
}

static void bridge_handle_player_attribute_block(int conn_id) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_player_attribute_block(pplayer);
}

static void bridge_handle_player_place_infra(int conn_id, int tile,
                                             int extra) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_player_place_infra(pplayer, tile, extra);
}

static void bridge_handle_spaceship_launch(int conn_id) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_spaceship_launch(pplayer);
}

static void bridge_handle_city_sell(int conn_id, int city_id, int build_id) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_city_sell(pplayer, city_id, build_id);
}

static void bridge_handle_city_buy(int conn_id, int city_id) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_city_buy(pplayer, city_id);
}

static void bridge_handle_city_change(int conn_id, int city_id,
                                      int production_kind,
                                      int production_value) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_city_change(pplayer, city_id, production_kind, production_value);
}

static void bridge_handle_city_refresh(int conn_id, int city_id) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_city_refresh(pplayer, city_id);
}

static void bridge_handle_city_rename(int conn_id, int city_id,
                                      const char *name) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_city_rename(pplayer, city_id, name);
}

static void bridge_handle_city_options_req(int conn_id, int city_id,
                                           int options) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_city_options_req(pplayer, city_id, options);
}

static void bridge_handle_city_name_suggestion_req(int conn_id, int unit_id) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_city_name_suggestion_req(pplayer, unit_id);
}

static void bridge_handle_diplomacy_init_meeting_req(int conn_id,
                                                     int counterpart) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_diplomacy_init_meeting_req(pplayer, counterpart);
}

static void bridge_handle_diplomacy_cancel_meeting_req(int conn_id,
                                                       int counterpart) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_diplomacy_cancel_meeting_req(pplayer, counterpart);
}

static void bridge_handle_diplomacy_accept_treaty_req(int conn_id,
                                                      int counterpart) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_diplomacy_accept_treaty_req(pplayer, counterpart);
}

static void bridge_handle_diplomacy_create_clause_req(int conn_id,
                                                      int counterpart,
                                                      int giver,
                                                      int type, int value) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_diplomacy_create_clause_req(pplayer, counterpart, giver,
                                       type, value);
}

static void bridge_handle_diplomacy_remove_clause_req(int conn_id,
                                                      int counterpart,
                                                      int giver,
                                                      int type, int value) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_diplomacy_remove_clause_req(pplayer, counterpart, giver,
                                       type, value);
}

static void bridge_handle_diplomacy_cancel_pact(int conn_id,
                                                int other_player_id,
                                                int clause) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_diplomacy_cancel_pact(pplayer, other_player_id, clause);
}

static void bridge_handle_web_goto_path_req(int conn_id, int unit_id,
                                            int goal) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_web_goto_path_req(pplayer, unit_id, goal);
}

static void bridge_handle_web_info_text_req(int conn_id, int loc) {
    struct player *pplayer = bridge_conn_player(conn_id);
    if (pplayer == NULL) { return; }
    handle_web_info_text_req(pplayer, loc, 0, 0);
}
*/
import "C"

import (
	"runtime"
	"unsafe"
)

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

// ── Packet handler bridge functions ──────────────────────────────────────────
//
// Each function below converts Go types to their C equivalents and calls the
// corresponding Freeciv server handler.  All functions lock the OS thread for
// the duration of the C call to match the Freeciv server's thread model.
//
// connID must correspond to the Freeciv C server's internal connection ID
// (conn->id).  The Go layer is responsible for keeping these in sync via a
// registration step when a new WebSocket connection is accepted.

// HandleChatMsgReq forwards a chat message to the C server.
func HandleChatMsgReq(connID int64, message string) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	cMsg := C.CString(message)
	defer C.free(unsafe.Pointer(cMsg))
	C.bridge_handle_chat_msg_req(C.int(connID), cMsg)
}

// HandleNationSelectReq forwards a nation-selection request to the C server.
func HandleNationSelectReq(connID int64, playerNo, nationNo int, isMale bool, name string, style int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	cName := C.CString(name)
	defer C.free(unsafe.Pointer(cName))
	isMaleInt := 0
	if isMale {
		isMaleInt = 1
	}
	C.bridge_handle_nation_select_req(C.int(connID), C.int(playerNo),
		C.int(nationNo), C.int(isMaleInt), cName, C.int(style))
}

// HandlePlayerReady forwards a player-ready signal to the C server.
func HandlePlayerReady(connID int64, playerNo int, isReady bool) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	isReadyInt := 0
	if isReady {
		isReadyInt = 1
	}
	C.bridge_handle_player_ready(C.int(connID), C.int(playerNo), C.int(isReadyInt))
}

// HandlePlayerPhaseDone forwards a phase-done signal to the C server.
func HandlePlayerPhaseDone(connID int64, turn int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_player_phase_done(C.int(connID), C.int(turn))
}

// HandlePlayerRates forwards updated tax/luxury/science rates to the C server.
func HandlePlayerRates(connID int64, tax, luxury, science int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_player_rates(C.int(connID), C.int(tax), C.int(luxury), C.int(science))
}

// HandlePlayerChangeGovernment forwards a government-change request to the C server.
func HandlePlayerChangeGovernment(connID int64, government int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_player_change_government(C.int(connID), C.int(government))
}

// HandlePlayerResearch forwards a research selection to the C server.
func HandlePlayerResearch(connID int64, tech int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_player_research(C.int(connID), C.int(tech))
}

// HandlePlayerTechGoal forwards a long-term tech-goal selection to the C server.
func HandlePlayerTechGoal(connID int64, techGoal int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_player_tech_goal(C.int(connID), C.int(techGoal))
}

// HandlePlayerAttributeBlock forwards an attribute-block request to the C server.
func HandlePlayerAttributeBlock(connID int64) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_player_attribute_block(C.int(connID))
}

// HandlePlayerPlaceInfra forwards an infrastructure placement to the C server.
func HandlePlayerPlaceInfra(connID int64, tile, extra int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_player_place_infra(C.int(connID), C.int(tile), C.int(extra))
}

// HandleReportReq forwards a report request to the C server.
func HandleReportReq(connID int64, reportType int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_report_req(C.int(connID), C.int(reportType))
}

// HandleVoteSubmit forwards a vote to the C server.
func HandleVoteSubmit(connID int64, voteNo, value int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_vote_submit(C.int(connID), C.int(voteNo), C.int(value))
}

// HandleSpaceshipLaunch forwards a spaceship launch command to the C server.
func HandleSpaceshipLaunch(connID int64) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_spaceship_launch(C.int(connID))
}

// HandleCitySell forwards a city improvement sale to the C server.
func HandleCitySell(connID int64, cityID, buildID int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_city_sell(C.int(connID), C.int(cityID), C.int(buildID))
}

// HandleCityBuy forwards a city production purchase to the C server.
func HandleCityBuy(connID int64, cityID int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_city_buy(C.int(connID), C.int(cityID))
}

// HandleCityChange forwards a production-type change to the C server.
func HandleCityChange(connID int64, cityID, productionKind, productionValue int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_city_change(C.int(connID), C.int(cityID),
		C.int(productionKind), C.int(productionValue))
}

// HandleCityRefresh forwards a city-refresh request to the C server.
func HandleCityRefresh(connID int64, cityID int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_city_refresh(C.int(connID), C.int(cityID))
}

// HandleCityRename forwards a city rename to the C server.
func HandleCityRename(connID int64, cityID int, name string) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	cName := C.CString(name)
	defer C.free(unsafe.Pointer(cName))
	C.bridge_handle_city_rename(C.int(connID), C.int(cityID), cName)
}

// HandleCityOptionsReq forwards city option flags to the C server.
func HandleCityOptionsReq(connID int64, cityID, options int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_city_options_req(C.int(connID), C.int(cityID), C.int(options))
}

// HandleCityNameSuggestionReq forwards a city-name suggestion request to the C server.
func HandleCityNameSuggestionReq(connID int64, unitID int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_city_name_suggestion_req(C.int(connID), C.int(unitID))
}

// HandleDiplomacyInitMeetingReq forwards a diplomacy meeting request to the C server.
func HandleDiplomacyInitMeetingReq(connID int64, counterpart int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_diplomacy_init_meeting_req(C.int(connID), C.int(counterpart))
}

// HandleDiplomacyCancelMeetingReq forwards a diplomacy meeting cancellation to the C server.
func HandleDiplomacyCancelMeetingReq(connID int64, counterpart int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_diplomacy_cancel_meeting_req(C.int(connID), C.int(counterpart))
}

// HandleDiplomacyAcceptTreatyReq forwards a treaty acceptance to the C server.
func HandleDiplomacyAcceptTreatyReq(connID int64, counterpart int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_diplomacy_accept_treaty_req(C.int(connID), C.int(counterpart))
}

// HandleDiplomacyCreateClauseReq forwards a clause-creation request to the C server.
func HandleDiplomacyCreateClauseReq(connID int64, counterpart, giver, clauseType, value int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_diplomacy_create_clause_req(C.int(connID), C.int(counterpart),
		C.int(giver), C.int(clauseType), C.int(value))
}

// HandleDiplomacyRemoveClauseReq forwards a clause-removal request to the C server.
func HandleDiplomacyRemoveClauseReq(connID int64, counterpart, giver, clauseType, value int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_diplomacy_remove_clause_req(C.int(connID), C.int(counterpart),
		C.int(giver), C.int(clauseType), C.int(value))
}

// HandleDiplomacyCancelPact forwards a pact-cancellation to the C server.
func HandleDiplomacyCancelPact(connID int64, otherPlayerID, clause int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_diplomacy_cancel_pact(C.int(connID), C.int(otherPlayerID), C.int(clause))
}

// HandleWebGotoPathReq forwards a goto-path request to the C server.
// goal is a flat tile index (tile_y * map_width + tile_x).
func HandleWebGotoPathReq(connID int64, unitID, goal int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_web_goto_path_req(C.int(connID), C.int(unitID), C.int(goal))
}

// HandleWebInfoTextReq forwards an info-text request to the C server.
func HandleWebInfoTextReq(connID int64, loc int) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	C.bridge_handle_web_info_text_req(C.int(connID), C.int(loc))
}
