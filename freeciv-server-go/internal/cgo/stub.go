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

// ── Packet handler stubs ──────────────────────────────────────────────────────
// All functions below are no-ops in stub mode.  In the real (freeciv_cgo)
// build each function calls the corresponding Freeciv C handler.

// HandleChatMsgReq is a no-op stub.
func HandleChatMsgReq(_ int64, _ string) {}

// HandleNationSelectReq is a no-op stub.
func HandleNationSelectReq(_ int64, _, _ int, _ bool, _ string, _ int) {}

// HandlePlayerReady is a no-op stub.
func HandlePlayerReady(_ int64, _ int, _ bool) {}

// HandlePlayerPhaseDone is a no-op stub.
func HandlePlayerPhaseDone(_ int64, _ int) {}

// HandlePlayerRates is a no-op stub.
func HandlePlayerRates(_ int64, _, _, _ int) {}

// HandlePlayerChangeGovernment is a no-op stub.
func HandlePlayerChangeGovernment(_ int64, _ int) {}

// HandlePlayerResearch is a no-op stub.
func HandlePlayerResearch(_ int64, _ int) {}

// HandlePlayerTechGoal is a no-op stub.
func HandlePlayerTechGoal(_ int64, _ int) {}

// HandlePlayerAttributeBlock is a no-op stub.
func HandlePlayerAttributeBlock(_ int64) {}

// HandlePlayerPlaceInfra is a no-op stub.
func HandlePlayerPlaceInfra(_ int64, _, _ int) {}

// HandleReportReq is a no-op stub.
func HandleReportReq(_ int64, _ int) {}

// HandleVoteSubmit is a no-op stub.
func HandleVoteSubmit(_ int64, _, _ int) {}

// HandleSpaceshipLaunch is a no-op stub.
func HandleSpaceshipLaunch(_ int64) {}

// HandleCitySell is a no-op stub.
func HandleCitySell(_ int64, _, _ int) {}

// HandleCityBuy is a no-op stub.
func HandleCityBuy(_ int64, _ int) {}

// HandleCityChange is a no-op stub.
func HandleCityChange(_ int64, _, _, _ int) {}

// HandleCityRefresh is a no-op stub.
func HandleCityRefresh(_ int64, _ int) {}

// HandleCityRename is a no-op stub.
func HandleCityRename(_ int64, _ int, _ string) {}

// HandleCityOptionsReq is a no-op stub.
func HandleCityOptionsReq(_ int64, _, _ int) {}

// HandleCityNameSuggestionReq is a no-op stub.
func HandleCityNameSuggestionReq(_ int64, _ int) {}

// HandleDiplomacyInitMeetingReq is a no-op stub.
func HandleDiplomacyInitMeetingReq(_ int64, _ int) {}

// HandleDiplomacyCancelMeetingReq is a no-op stub.
func HandleDiplomacyCancelMeetingReq(_ int64, _ int) {}

// HandleDiplomacyAcceptTreatyReq is a no-op stub.
func HandleDiplomacyAcceptTreatyReq(_ int64, _ int) {}

// HandleDiplomacyCreateClauseReq is a no-op stub.
func HandleDiplomacyCreateClauseReq(_ int64, _, _, _, _ int) {}

// HandleDiplomacyRemoveClauseReq is a no-op stub.
func HandleDiplomacyRemoveClauseReq(_ int64, _, _, _, _ int) {}

// HandleDiplomacyCancelPact is a no-op stub.
func HandleDiplomacyCancelPact(_ int64, _, _ int) {}

// HandleWebGotoPathReq is a no-op stub.
func HandleWebGotoPathReq(_ int64, _, _ int) {}

// HandleWebInfoTextReq is a no-op stub.
func HandleWebInfoTextReq(_ int64, _ int) {}

