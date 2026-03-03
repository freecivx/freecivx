package main

import (
	"encoding/json"
	"fmt"
	"sync/atomic"
)

// Packet type identifiers used in the Freeciv WebSocket protocol.
// The JavaScript client identifies every packet with a "pid" field; the
// constants below mirror the values in
// freeciv-web/src/derived/webapp/javascript/packets.js and
// freeciv/freeciv/common/networking/packets.def.
//
// Direction labels: sc = server → client, cs = client → server.
const (
	// ── Server → Client (sc) ──────────────────────────────────────────────
	pidProcessingStarted      = 0   // sc: batch processing started
	pidProcessingFinished     = 1   // sc: batch processing finished
	pidServerJoinReply        = 5   // sc: login reply
	pidAuthenticationReq      = 6   // sc: authentication challenge
	pidServerShutdown         = 8   // sc: server is shutting down
	pidRulesetTechClass       = 9   // sc: tech-class ruleset data
	pidEndgameReport          = 12  // sc: endgame statistics
	pidScenarioDescription    = 13  // sc: scenario description
	pidTileInfo               = 15  // sc: tile information update
	pidGameInfo               = 16  // sc: game settings snapshot
	pidMapInfo                = 17  // sc: map dimensions / topology
	pidNukeTileInfo           = 18  // sc: nuke effect on tile
	pidTeamNameInfo           = 19  // sc: team name
	pidRulesetImprFlag        = 20  // sc: improvement flag ruleset data
	pidChatMsg                = 25  // sc: chat message to display
	pidConnectMsg             = 27  // sc: connect-time message to client
	pidEarlyChatMsg           = 28  // sc: pre-game chat message
	pidServerInfo             = 29  // sc: server version/label
	pidCityRemove             = 30  // sc: city removed from map
	pidCityInfo               = 31  // sc: full city data
	pidCityShortInfo          = 32  // sc: abbreviated city data
	pidCityNameSuggestionInfo = 44  // sc: city-name suggestion reply
	pidCitySabotageList       = 45  // sc: sabotage target list
	pidCityNationalities      = 46  // sc: city nationality data
	pidPlayerRemove           = 50  // sc: player removed
	pidPlayerInfo             = 51  // sc: player data snapshot
	pidPlayerDiplstate        = 59  // sc: diplomatic state between players
	pidResearchInfo           = 60  // sc: player research state
	pidUnitRemove             = 62  // sc: unit removed from map
	pidUnitInfo               = 63  // sc: full unit data
	pidUnitShortInfo          = 64  // sc: abbreviated unit data
	pidUnitCombatInfo         = 65  // sc: combat result
	pidUnknownResearch        = 66  // sc: unknown-tech research state
	pidUnitActionAnswer       = 85  // sc: answer to unit action query
	pidConnPing               = 88  // sc: keepalive ping
	pidUnitActions            = 90  // sc: available unit actions
	pidDiplomacyInitMeeting   = 96  // sc: diplomacy meeting opened
	pidDiplomacyCancelMeeting = 98  // sc: diplomacy meeting cancelled
	pidDiplomacyCreateClause  = 100 // sc: treaty clause added
	pidDiplomacyRemoveClause  = 102 // sc: treaty clause removed
	pidPageMsg                = 110 // sc: full-screen page message
	pidConnInfo               = 115 // sc: connection info
	pidConnPingInfo           = 116 // sc: round-trip time info
	pidEndPhase               = 125 // sc: player's phase ended
	pidStartPhase             = 126 // sc: player's phase started
	pidNewYear                = 127 // sc: new turn / year
	pidBeginTurn              = 128 // sc: turn begins
	pidEndTurn                = 129 // sc: turn ends
	pidFreezeClient           = 130 // sc: pause client updates
	pidThawClient             = 131 // sc: resume client updates
	pidSpaceshipInfo          = 137 // sc: spaceship status
	pidRulesetUnit            = 140 // sc: unit-type ruleset data
	pidRulesetGame            = 141 // sc: game ruleset data
	pidRulesetSpecialist      = 142 // sc: specialist ruleset data
	pidRulesetGovernmentRulerTitle = 143 // sc: government ruler title data
	pidRulesetTech            = 144 // sc: tech ruleset data
	pidRulesetGovernment      = 145 // sc: government ruleset data
	pidRulesetTerrainControl  = 146 // sc: terrain control ruleset data
	pidRulesetNationGroups    = 147 // sc: nation groups ruleset data
	pidRulesetNation          = 148 // sc: nation ruleset data
	pidRulesetCity            = 149 // sc: city ruleset data
	pidRulesetBuilding        = 150 // sc: building ruleset data
	pidRulesetTerrain         = 151 // sc: terrain ruleset data
	pidRulesetUnitClass       = 152 // sc: unit class ruleset data
	pidRulesetBase            = 153 // sc: base ruleset data
	pidRulesetControl         = 155 // sc: ruleset control packet
	pidSingleWantHackReply    = 161 // sc: hack-token reply
	pidRulesetChoices         = 162 // sc: available rulesets list
	pidGameLoad               = 163 // sc: game-load result
	pidServerSettingControl   = 164 // sc: number of server settings
	pidServerSettingConst     = 165 // sc: constant server setting
	pidServerSettingBool      = 166 // sc: boolean server setting
	pidServerSettingInt       = 167 // sc: integer server setting
	pidServerSettingStr       = 168 // sc: string server setting
	pidServerSettingEnum      = 169 // sc: enum server setting
	pidServerSettingBitwise   = 170 // sc: bitwise server setting
	pidRulesetEffect          = 175 // sc: effect ruleset data
	pidRulesetResource        = 177 // sc: resource ruleset data
	pidScenarioInfo           = 180 // sc: scenario metadata
	pidVoteNew                = 185 // sc: new server vote
	pidVoteUpdate             = 186 // sc: vote tally update
	pidVoteRemove             = 187 // sc: vote removed
	pidVoteResolve            = 188 // sc: vote resolved
	pidEditObjectCreated      = 219 // sc: edit-mode object created
	pidRulesetRoad            = 220 // sc: road ruleset data
	pidEndgamePlayer          = 223 // sc: per-player endgame data
	pidRulesetDisaster        = 224 // sc: disaster ruleset data
	pidRulesetsReady          = 225 // sc: all ruleset packets sent
	pidRulesetExtraFlag       = 226 // sc: extra flag ruleset data
	pidRulesetTrade           = 227 // sc: trade ruleset data
	pidRulesetUnitBonus       = 228 // sc: unit bonus ruleset data
	pidRulesetUnitFlag        = 229 // sc: unit flag ruleset data
	pidRulesetUnitClassFlag   = 230 // sc: unit-class flag ruleset data
	pidRulesetTerrainFlag     = 231 // sc: terrain flag ruleset data
	pidRulesetExtra           = 232 // sc: extra ruleset data
	pidRulesetAchievement     = 233 // sc: achievement ruleset data
	pidRulesetTechFlag        = 234 // sc: tech flag ruleset data
	pidRulesetActionEnabler   = 235 // sc: action-enabler ruleset data
	pidRulesetNationSets      = 236 // sc: nation sets ruleset data
	pidNationAvailability     = 237 // sc: per-player nation availability
	pidAchievementInfo        = 238 // sc: player achievement status
	pidRulesetStyle           = 239 // sc: style ruleset data
	pidRulesetMusic           = 240 // sc: music ruleset data
	pidRulesetMultiplier      = 243 // sc: multiplier ruleset data
	pidTimeoutInfo            = 244 // sc: turn-timeout information
	pidPlayMusic              = 245 // sc: play music track
	pidRulesetAction          = 246 // sc: action ruleset data
	pidRulesetDescriptionPart = 247 // sc: ruleset description chunk
	pidRulesetGoods           = 248 // sc: goods ruleset data
	pidTraderoute             = 249 // sc: trade-route info
	pidPageMsgPart            = 250 // sc: continuation of page message
	pidRulesetSummary         = 251 // sc: ruleset summary text
	pidRulesetActionAuto      = 252 // sc: auto-action ruleset data
	pidSetTopology            = 253 // sc: map topology flags
	pidCalendarInfo           = 255 // sc: calendar settings
	pidWebCityInfoAddition    = 256 // sc: web-specific city info extension
	pidWebPlayerInfoAddition  = 259 // sc: web-specific player info extension
	pidWebRulesetUnitAddition = 260 // sc: web-specific unit ruleset extension
	pidWebGotoPath            = 288 // sc: computed goto path
	pidWebInfoTextMessage     = 290 // sc: info-text message
	pidRulesetClause          = 512 // sc: clause type ruleset data
	pidRulesetCounter         = 513 // sc: counter ruleset data
	pidCityUpdateCounters     = 514 // sc: city counter update

	// ── Client → Server (cs) ──────────────────────────────────────────────
	pidServerJoinReq          = 4   // cs: login request
	pidAuthenticationReply    = 7   // cs: authentication response
	pidNationSelectReq        = 10  // cs: nation selection
	pidPlayerReady            = 11  // cs: player ready toggle
	pidEditScenarioDesc       = 14  // cs: edit scenario description
	pidChatMsgReq             = 26  // cs: send chat message
	pidCitySell               = 33  // cs: sell city improvement
	pidCityBuy                = 34  // cs: rush-buy city production
	pidCityChange             = 35  // cs: change city production
	pidCityWorklist           = 36  // cs: set city worklist
	pidCityMakeSpecialist     = 37  // cs: make tile worker a specialist
	pidCityMakeWorker         = 38  // cs: make specialist a worker
	pidCityChangeSpecialist   = 39  // cs: change specialist type
	pidCityRename             = 40  // cs: rename city
	pidCityOptionsReq         = 41  // cs: set city options
	pidCityRefresh            = 42  // cs: request city refresh
	pidCityNameSuggestionReq  = 43  // cs: request city-name suggestion
	pidPlayerPhaseDone        = 52  // cs: end player's turn phase
	pidPlayerRates            = 53  // cs: set tax/luxury/science rates
	pidPlayerChangeGovernment = 54  // cs: change government type
	pidPlayerResearch         = 55  // cs: choose research target
	pidPlayerTechGoal         = 56  // cs: set long-term tech goal
	pidPlayerAttributeBlock   = 57  // cs: request player attribute block
	pidPlayerAttributeChunk   = 58  // cs: player attribute chunk (also sc)
	pidPlayerPlaceInfra       = 61  // cs: place infrastructure on tile
	pidUnitSscsSet            = 71  // cs: set unit server-side client state
	pidUnitOrders             = 73  // cs: give unit a list of orders
	pidUnitServerSideAgentSet = 74  // cs: set unit's server-side agent
	pidUnitActionQuery        = 82  // cs: query available unit actions
	pidUnitTypeUpgrade        = 83  // cs: upgrade unit type
	pidUnitDoAction           = 84  // cs: perform unit action
	pidUnitGetActions         = 87  // cs: get available actions for unit
	pidConnPong               = 89  // cs: keepalive pong
	pidDiplomacyInitMeetingReq    = 95  // cs: initiate diplomacy meeting
	pidDiplomacyCancelMeetingReq  = 97  // cs: cancel diplomacy meeting
	pidDiplomacyCreateClauseReq   = 99  // cs: add treaty clause
	pidDiplomacyRemoveClauseReq   = 101 // cs: remove treaty clause
	pidDiplomacyAcceptTreatyReq   = 103 // cs: accept treaty
	pidDiplomacyCancelPact        = 105 // cs: cancel existing pact
	pidReportReq              = 111 // cs: request a report
	pidClientInfo             = 119 // cs: client GUI/version info
	pidSpaceshipLaunch        = 135 // cs: launch spaceship
	pidSpaceshipPlace         = 136 // cs: place spaceship part
	pidCityRallyPoint         = 138 // cs/sc: set city rally point
	pidSingleWantHackReq      = 160 // cs: request hack token
	pidRulesetSelect          = 171 // cs: select ruleset
	pidSaveScenario           = 181 // cs: save as scenario
	pidVoteSubmit             = 189 // cs: submit a vote
	pidEditMode               = 190 // cs: toggle edit mode
	pidEditRecalculateBorders = 197 // cs: recalculate borders
	pidEditCheckTiles         = 198 // cs: check tile validity
	pidEditToggleFogofwar     = 199 // cs: toggle fog of war
	pidEditTileTerrain        = 200 // cs: set tile terrain
	pidEditTileExtra          = 202 // cs: set tile extra
	pidEditStartpos           = 204 // cs/sc: set start position
	pidEditStartposFull       = 205 // cs/sc: set full start position
	pidEditTile               = 206 // cs: edit tile
	pidEditUnitCreate         = 207 // cs: create unit via editor
	pidEditUnitRemove         = 208 // cs: remove units from tile
	pidEditUnitRemoveById     = 209 // cs: remove specific unit
	pidEditUnit               = 210 // cs: edit unit properties
	pidEditCityCreate         = 211 // cs: create city via editor
	pidEditCityRemove         = 212 // cs: remove city via editor
	pidEditCity               = 213 // cs: edit city properties
	pidEditPlayerCreate       = 214 // cs: create player via editor
	pidEditPlayerRemove       = 215 // cs: remove player via editor
	pidEditPlayer             = 216 // cs/sc: edit player properties
	pidEditPlayerVision       = 217 // cs: set player vision
	pidEditGame               = 218 // cs: edit game properties
	pidUnitChangeActivity     = 222 // cs: change unit activity
	pidWorkerTask             = 241 // cs/sc: set worker task
	pidPlayerMultiplier       = 242 // cs: set player multipliers
	pidClientHeartbeat        = 254 // cs: client heartbeat
	pidWebCmaSet              = 257 // cs: set CMA for city
	pidWebCmaClear            = 258 // cs: clear CMA for city
	pidWebGotoPathReq         = 287 // cs: request goto path
	pidWebInfoTextReq         = 289 // cs: request info text
)

// Freeciv capability string advertised to connecting clients.
// Must match the value in freeciv-web/src/main/webapp/javascript/clinet.js.
const serverCapability = "+Freeciv.Web.Devel-3.3"

// connIDCounter is used to assign a unique numeric ID to each WebSocket
// connection.  It starts at 1 so that 0 is never a valid connection ID
// (the JS client uses -1 for "not connected").
var connIDCounter atomic.Int64

func init() {
	connIDCounter.Store(0)
}

// nextConnID returns the next unique connection ID.
func nextConnID() int64 {
	return connIDCounter.Add(1)
}

// ── Client → Server (cs) packet structs ──────────────────────────────────────

// serverJoinReq is the login packet sent by the JavaScript client (pid = 4).
type serverJoinReq struct {
	PID          int    `json:"pid"`
	Username     string `json:"username"`
	Capability   string `json:"capability"`
	VersionLabel string `json:"version_label"`
	MajorVersion int    `json:"major_version"`
	MinorVersion int    `json:"minor_version"`
	PatchVersion int    `json:"patch_version"`
}

// authenticationReply is the password response sent by the client (pid = 7).
// The Password field is only read transiently during packet handling and is
// never written to persistent storage.
type authenticationReply struct {
	PID      int    `json:"pid"`
	Password string `json:"password"`
}

// nationSelectReq is sent when the client picks a nation (pid = 10).
type nationSelectReq struct {
	PID      int    `json:"pid"`
	PlayerNo int    `json:"player_no"`
	NationNo int    `json:"nation_no"`
	IsMale   bool   `json:"is_male"`
	Name     string `json:"name"`
	Style    int    `json:"style"`
}

// playerReady signals that the client is ready to start (pid = 11).
type playerReady struct {
	PID      int  `json:"pid"`
	PlayerNo int  `json:"player_no"`
	IsReady  bool `json:"is_ready"`
}

// chatMsgReq is a chat message from the client (pid = 26).
type chatMsgReq struct {
	PID     int    `json:"pid"`
	Message string `json:"message"`
}

// playerPhaseDone signals that the player has ended their turn phase (pid = 52).
type playerPhaseDone struct {
	PID  int `json:"pid"`
	Turn int `json:"turn"`
}

// playerRates sets the client's tax/luxury/science rates (pid = 53).
type playerRates struct {
	PID     int `json:"pid"`
	Tax     int `json:"tax"`
	Luxury  int `json:"luxury"`
	Science int `json:"science"`
}

// playerChangeGovernment requests a government change (pid = 54).
type playerChangeGovernment struct {
	PID        int `json:"pid"`
	Government int `json:"government"`
}

// playerResearch sets the active research target (pid = 55).
type playerResearch struct {
	PID  int `json:"pid"`
	Tech int `json:"tech"`
}

// playerTechGoal sets the long-term technology goal (pid = 56).
type playerTechGoal struct {
	PID  int `json:"pid"`
	Tech int `json:"tech"`
}

// playerMultiplier sets the player's policy multiplier values (pid = 242).
type playerMultiplier struct {
	PID    int   `json:"pid"`
	Values []int `json:"values"`
}

// reportReq requests a game report from the server (pid = 111).
type reportReq struct {
	PID  int `json:"pid"`
	Type int `json:"type"`
}

// singleWantHackReq requests a server-hack token (pid = 160).
type singleWantHackReq struct {
	PID   int    `json:"pid"`
	Token string `json:"token"`
}

// rulesetSelect tells the server which ruleset to load (pid = 171).
type rulesetSelect struct {
	PID     int    `json:"pid"`
	Modpack string `json:"modpack"`
}

// clientHeartbeat is a periodic keep-alive from the client (pid = 254).
type clientHeartbeat struct {
	PID int `json:"pid"`
}

// webGotoPathReq asks the server to compute a goto path (pid = 287).
type webGotoPathReq struct {
	PID    int `json:"pid"`
	UnitID int `json:"unit_id"`
	TileX  int `json:"tile_x"`
	TileY  int `json:"tile_y"`
}

// webInfoTextReq asks the server for an info-text description (pid = 289).
type webInfoTextReq struct {
	PID  int `json:"pid"`
	Tile int `json:"tile"`
}

// ── Server → Client (sc) packet structs ──────────────────────────────────────

// serverJoinReply is the server response to a login request (pid = 5).
type serverJoinReply struct {
	PID           int    `json:"pid"`
	YouCanJoin    bool   `json:"you_can_join"`
	Message       string `json:"message"`
	Capability    string `json:"capability"`
	ChallengeFile string `json:"challenge_file"`
	ConnID        int64  `json:"conn_id"`
}

// authenticationReq is the server's authentication challenge (pid = 6).
type authenticationReq struct {
	PID     int    `json:"pid"`
	Type    int    `json:"type"`
	Message string `json:"message"`
}

// connectMsg is sent to a client immediately after connection (pid = 27).
type connectMsg struct {
	PID     int    `json:"pid"`
	Message string `json:"message"`
}

// serverInfo carries the server version and label (pid = 29).
type serverInfo struct {
	PID          int    `json:"pid"`
	VersionLabel string `json:"version_label"`
	MajorVersion int    `json:"major_version"`
	MinorVersion int    `json:"minor_version"`
	PatchVersion int    `json:"patch_version"`
	EmergVersion int    `json:"emerg_version"`
}

// chatMsg is a chat message broadcast from the server (pid = 25).
type chatMsg struct {
	PID     int    `json:"pid"`
	Message string `json:"message"`
	Tile    int    `json:"tile"`
	Event   int    `json:"event"`
	Turn    int    `json:"turn"`
	Phase   int    `json:"phase"`
	ConnID  int64  `json:"conn_id"`
}

// pageMsg is a full-screen informational message from the server (pid = 110).
type pageMsg struct {
	PID      int    `json:"pid"`
	Caption  string `json:"caption"`
	Headline string `json:"headline"`
	Event    int    `json:"event"`
	Len      int    `json:"len"`
	Parts    int    `json:"parts"`
}

// connInfo describes a connection to all clients (pid = 115).
type connInfo struct {
	PID         int    `json:"pid"`
	ID          int64  `json:"id"`
	Used        bool   `json:"used"`
	Established bool   `json:"established"`
	Observer    bool   `json:"observer"`
	PlayerNum   int    `json:"player_num"`
	AccessLevel int    `json:"access_level"`
	Username    string `json:"username"`
	Addr        string `json:"addr"`
	Capability  string `json:"capability"`
}

// connPing is the server-to-client keepalive packet (pid = 88).
type connPing struct {
	PID int `json:"pid"`
}

// endPhase signals that the current player's phase has ended (pid = 125).
type endPhase struct {
	PID int `json:"pid"`
}

// startPhase signals that a new player phase is beginning (pid = 126).
type startPhase struct {
	PID   int `json:"pid"`
	Phase int `json:"phase"`
}

// newYear is sent at the start of each new game turn (pid = 127).
type newYear struct {
	PID       int `json:"pid"`
	Year      int `json:"year"`
	Fragments int `json:"fragments"`
	Turn      int `json:"turn"`
}

// beginTurn marks the very beginning of a turn (pid = 128).
type beginTurn struct {
	PID int `json:"pid"`
}

// endTurn marks the end of a turn (pid = 129).
type endTurn struct {
	PID int `json:"pid"`
}

// freezeClient tells the client to pause visual updates (pid = 130).
type freezeClient struct {
	PID int `json:"pid"`
}

// thawClient tells the client to resume visual updates (pid = 131).
type thawClient struct {
	PID int `json:"pid"`
}

// singleWantHackReply tells the client whether it received the hack (pid = 161).
type singleWantHackReply struct {
	PID        int  `json:"pid"`
	YouHaveHack bool `json:"you_have_hack"`
}

// gameLoad tells the client whether a game was loaded successfully (pid = 163).
type gameLoad struct {
	PID          int    `json:"pid"`
	LoadSuccessful bool  `json:"load_successful"`
	LoadFilename string `json:"load_filename"`
}

// processingStarted signals the start of a batch update (pid = 0).
type processingStarted struct {
	PID int `json:"pid"`
}

// processingFinished signals the end of a batch update (pid = 1).
type processingFinished struct {
	PID int `json:"pid"`
}

// marshalPacket serialises v to JSON, returning a formatted error message
// if marshalling fails.
func marshalPacket(v any) ([]byte, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return nil, fmt.Errorf("marshalPacket: %w", err)
	}
	return b, nil
}
