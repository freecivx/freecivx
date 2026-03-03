package main

import (
	"context"
	"encoding/json"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync/atomic"
	"syscall"
	"time"

	cgoBridge "freeciv-server-go/internal/cgo"

	"freeciv-server-go/engine"

	"github.com/gorilla/websocket"
)

// upgrader configures the WebSocket handshake.  CheckOrigin always
// returns true here for simplicity; restrict this in production
// deployments by validating r.Header.Get("Origin") against an
// allowlist.
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// server holds shared runtime state used by HTTP handlers.
type server struct {
	startTime        time.Time
	connectedClients atomic.Int64
	hub              *Hub
}

func newServer() *server {
	return &server{
		startTime: time.Now(),
		hub:       newHub(),
	}
}

// wsHandler upgrades an HTTP connection to WebSocket and implements the
// Freeciv client login protocol:
//
//  1. Read the first message, which must be a server_join_req (pid 4).
//  2. Assign a unique connection ID and reply with server_join_reply (pid 5).
//  3. Send a conn_info (pid 115) packet so the client knows its own connection.
//  4. Start a background goroutine that sends periodic conn_ping (pid 88)
//     keepalives so the client does not time out.
//  5. Read subsequent client packets and dispatch them (pong, chat, etc.).
func (s *server) wsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("WebSocket upgrade failed", "error", err)
		return
	}
	defer conn.Close()

	s.hub.register <- conn
	s.connectedClients.Add(1)
	defer func() {
		s.hub.unregister <- conn
		s.connectedClients.Add(-1)
	}()

	slog.Info("WebSocket client connected", "remote", r.RemoteAddr)

	// ------------------------------------------------------------------ //
	// Step 1 – read the join request (pid 4).                             //
	// ------------------------------------------------------------------ //
	_, rawMsg, err := conn.ReadMessage()
	if err != nil {
		if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
			slog.Error("WebSocket read error (join req)", "error", err)
		}
		return
	}

	var joinReq serverJoinReq
	if jsonErr := json.Unmarshal(rawMsg, &joinReq); jsonErr != nil || joinReq.PID != pidServerJoinReq {
		slog.Warn("WebSocket: expected server_join_req (pid 4)", "remote", r.RemoteAddr, "raw", string(rawMsg))
		return
	}

	username := joinReq.Username
	if username == "" {
		username = "anonymous"
	}
	connID := nextConnID()
	slog.Info("WebSocket login", "remote", r.RemoteAddr, "user", username, "conn_id", connID)

	// ------------------------------------------------------------------ //
	// Step 2 – send server_join_reply (pid 5).                           //
	// ------------------------------------------------------------------ //
	replyPkt := serverJoinReply{
		PID:           pidServerJoinReply,
		YouCanJoin:    true,
		Message:       "Welcome to FreecivWorld! You are logged in as " + username,
		Capability:    serverCapability,
		ChallengeFile: "",
		ConnID:        connID,
	}
	replyJSON, err := marshalPacket(replyPkt)
	if err != nil {
		slog.Error("WebSocket: marshal server_join_reply", "error", err)
		return
	}
	if err := conn.WriteMessage(websocket.TextMessage, replyJSON); err != nil {
		slog.Error("WebSocket write error (join reply)", "error", err)
		return
	}

	// ------------------------------------------------------------------ //
	// Step 3 – send conn_info (pid 115).                                  //
	// ------------------------------------------------------------------ //
	infoPkt := connInfo{
		PID:         pidConnInfo,
		ID:          connID,
		Used:        true,
		Established: true,
		Observer:    false,
		PlayerNum:   -1,
		AccessLevel: 0,
		Username:    username,
		Addr:        r.RemoteAddr,
		Capability:  serverCapability,
	}
	infoJSON, err := marshalPacket(infoPkt)
	if err != nil {
		slog.Error("WebSocket: marshal conn_info", "error", err)
		return
	}
	if err := conn.WriteMessage(websocket.TextMessage, infoJSON); err != nil {
		slog.Error("WebSocket write error (conn_info)", "error", err)
		return
	}

	// ------------------------------------------------------------------ //
	// Step 4 – periodic conn_ping (pid 88) goroutine.                    //
	// ------------------------------------------------------------------ //
	pingStop := make(chan struct{})
	defer close(pingStop)
	go func() {
		pingJSON, _ := marshalPacket(connPing{PID: pidConnPing})
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-pingStop:
				return
			case <-ticker.C:
				if err := conn.WriteMessage(websocket.TextMessage, pingJSON); err != nil {
					slog.Debug("WebSocket ping write error", "error", err)
					return
				}
			}
		}
	}()

	// ------------------------------------------------------------------ //
	// Step 5 – main message loop.                                         //
	// ------------------------------------------------------------------ //
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				slog.Error("WebSocket read error", "error", err)
			}
			return
		}

		// Peek at the packet ID to decide how to handle it.
		var pkt struct {
			PID int `json:"pid"`
		}
		if jsonErr := json.Unmarshal(message, &pkt); jsonErr != nil {
			slog.Warn("WebSocket: unreadable packet", "remote", r.RemoteAddr, "raw", string(message))
			continue
		}

		switch pkt.PID {
		// ── Keepalive ────────────────────────────────────────────────────
		case pidConnPong:
			// Client responded to our ping – nothing to do.

		// ── Session ──────────────────────────────────────────────────────
		case pidClientInfo:
			slog.Debug("client_info received", "remote", r.RemoteAddr)
		case pidClientHeartbeat:
			slog.Debug("client_heartbeat received", "remote", r.RemoteAddr)
		case pidAuthenticationReply:
			slog.Debug("authentication_reply received", "remote", r.RemoteAddr)
		case pidSingleWantHackReq:
			slog.Debug("single_want_hack_req received", "remote", r.RemoteAddr)
		case pidRulesetSelect:
			slog.Debug("ruleset_select received", "remote", r.RemoteAddr)

		// ── Pre-game / lobby ─────────────────────────────────────────────
		case pidNationSelectReq:
			slog.Debug("nation_select_req received", "remote", r.RemoteAddr)
		case pidPlayerReady:
			slog.Debug("player_ready received", "remote", r.RemoteAddr)

		// ── Chat ─────────────────────────────────────────────────────────
		case pidChatMsgReq:
			var chat chatMsgReq
			if err := json.Unmarshal(message, &chat); err != nil {
				slog.Warn("chat_msg_req: unmarshal error", "remote", r.RemoteAddr, "error", err)
			} else {
				slog.Info("chat_msg_req received", "remote", r.RemoteAddr, "user", username, "message", chat.Message)
			}

		// ── City management ──────────────────────────────────────────────
		case pidCitySell:
			slog.Debug("city_sell received", "remote", r.RemoteAddr)
		case pidCityBuy:
			slog.Debug("city_buy received", "remote", r.RemoteAddr)
		case pidCityChange:
			slog.Debug("city_change received", "remote", r.RemoteAddr)
		case pidCityWorklist:
			slog.Debug("city_worklist received", "remote", r.RemoteAddr)
		case pidCityMakeSpecialist:
			slog.Debug("city_make_specialist received", "remote", r.RemoteAddr)
		case pidCityMakeWorker:
			slog.Debug("city_make_worker received", "remote", r.RemoteAddr)
		case pidCityChangeSpecialist:
			slog.Debug("city_change_specialist received", "remote", r.RemoteAddr)
		case pidCityRename:
			slog.Debug("city_rename received", "remote", r.RemoteAddr)
		case pidCityOptionsReq:
			slog.Debug("city_options_req received", "remote", r.RemoteAddr)
		case pidCityRefresh:
			slog.Debug("city_refresh received", "remote", r.RemoteAddr)
		case pidCityNameSuggestionReq:
			slog.Debug("city_name_suggestion_req received", "remote", r.RemoteAddr)
		case pidCityRallyPoint:
			slog.Debug("city_rally_point received", "remote", r.RemoteAddr)
		case pidWebCmaSet:
			slog.Debug("web_cma_set received", "remote", r.RemoteAddr)
		case pidWebCmaClear:
			slog.Debug("web_cma_clear received", "remote", r.RemoteAddr)

		// ── Player / turn ────────────────────────────────────────────────
		case pidPlayerPhaseDone:
			slog.Debug("player_phase_done received", "remote", r.RemoteAddr)
		case pidPlayerRates:
			slog.Debug("player_rates received", "remote", r.RemoteAddr)
		case pidPlayerChangeGovernment:
			slog.Debug("player_change_government received", "remote", r.RemoteAddr)
		case pidPlayerResearch:
			slog.Debug("player_research received", "remote", r.RemoteAddr)
		case pidPlayerTechGoal:
			slog.Debug("player_tech_goal received", "remote", r.RemoteAddr)
		case pidPlayerAttributeBlock:
			slog.Debug("player_attribute_block received", "remote", r.RemoteAddr)
		case pidPlayerAttributeChunk:
			slog.Debug("player_attribute_chunk received", "remote", r.RemoteAddr)
		case pidPlayerPlaceInfra:
			slog.Debug("player_place_infra received", "remote", r.RemoteAddr)
		case pidPlayerMultiplier:
			slog.Debug("player_multiplier received", "remote", r.RemoteAddr)

		// ── Unit actions ─────────────────────────────────────────────────
		case pidUnitSscsSet:
			slog.Debug("unit_sscs_set received", "remote", r.RemoteAddr)
		case pidUnitOrders:
			slog.Debug("unit_orders received", "remote", r.RemoteAddr)
		case pidUnitServerSideAgentSet:
			slog.Debug("unit_server_side_agent_set received", "remote", r.RemoteAddr)
		case pidUnitActionQuery:
			slog.Debug("unit_action_query received", "remote", r.RemoteAddr)
		case pidUnitTypeUpgrade:
			slog.Debug("unit_type_upgrade received", "remote", r.RemoteAddr)
		case pidUnitDoAction:
			slog.Debug("unit_do_action received", "remote", r.RemoteAddr)
		case pidUnitGetActions:
			slog.Debug("unit_get_actions received", "remote", r.RemoteAddr)
		case pidUnitChangeActivity:
			slog.Debug("unit_change_activity received", "remote", r.RemoteAddr)
		case pidWorkerTask:
			slog.Debug("worker_task received", "remote", r.RemoteAddr)

		// ── Diplomacy ────────────────────────────────────────────────────
		case pidDiplomacyInitMeetingReq:
			slog.Debug("diplomacy_init_meeting_req received", "remote", r.RemoteAddr)
		case pidDiplomacyCancelMeetingReq:
			slog.Debug("diplomacy_cancel_meeting_req received", "remote", r.RemoteAddr)
		case pidDiplomacyCreateClauseReq:
			slog.Debug("diplomacy_create_clause_req received", "remote", r.RemoteAddr)
		case pidDiplomacyRemoveClauseReq:
			slog.Debug("diplomacy_remove_clause_req received", "remote", r.RemoteAddr)
		case pidDiplomacyAcceptTreatyReq:
			slog.Debug("diplomacy_accept_treaty_req received", "remote", r.RemoteAddr)
		case pidDiplomacyCancelPact:
			slog.Debug("diplomacy_cancel_pact received", "remote", r.RemoteAddr)

		// ── Reports / misc ───────────────────────────────────────────────
		case pidReportReq:
			slog.Debug("report_req received", "remote", r.RemoteAddr)
		case pidSpaceshipLaunch:
			slog.Debug("spaceship_launch received", "remote", r.RemoteAddr)
		case pidSpaceshipPlace:
			slog.Debug("spaceship_place received", "remote", r.RemoteAddr)
		case pidSaveScenario:
			slog.Debug("save_scenario received", "remote", r.RemoteAddr)
		case pidVoteSubmit:
			slog.Debug("vote_submit received", "remote", r.RemoteAddr)

		// ── Web-specific ─────────────────────────────────────────────────
		case pidWebGotoPathReq:
			slog.Debug("web_goto_path_req received", "remote", r.RemoteAddr)
		case pidWebInfoTextReq:
			slog.Debug("web_info_text_req received", "remote", r.RemoteAddr)

		// ── Edit mode ────────────────────────────────────────────────────
		case pidEditMode:
			slog.Debug("edit_mode received", "remote", r.RemoteAddr)
		case pidEditRecalculateBorders:
			slog.Debug("edit_recalculate_borders received", "remote", r.RemoteAddr)
		case pidEditCheckTiles:
			slog.Debug("edit_check_tiles received", "remote", r.RemoteAddr)
		case pidEditToggleFogofwar:
			slog.Debug("edit_toggle_fogofwar received", "remote", r.RemoteAddr)
		case pidEditTileTerrain:
			slog.Debug("edit_tile_terrain received", "remote", r.RemoteAddr)
		case pidEditTileExtra:
			slog.Debug("edit_tile_extra received", "remote", r.RemoteAddr)
		case pidEditStartpos:
			slog.Debug("edit_startpos received", "remote", r.RemoteAddr)
		case pidEditStartposFull:
			slog.Debug("edit_startpos_full received", "remote", r.RemoteAddr)
		case pidEditTile:
			slog.Debug("edit_tile received", "remote", r.RemoteAddr)
		case pidEditUnitCreate:
			slog.Debug("edit_unit_create received", "remote", r.RemoteAddr)
		case pidEditUnitRemove:
			slog.Debug("edit_unit_remove received", "remote", r.RemoteAddr)
		case pidEditUnitRemoveById:
			slog.Debug("edit_unit_remove_by_id received", "remote", r.RemoteAddr)
		case pidEditUnit:
			slog.Debug("edit_unit received", "remote", r.RemoteAddr)
		case pidEditCityCreate:
			slog.Debug("edit_city_create received", "remote", r.RemoteAddr)
		case pidEditCityRemove:
			slog.Debug("edit_city_remove received", "remote", r.RemoteAddr)
		case pidEditCity:
			slog.Debug("edit_city received", "remote", r.RemoteAddr)
		case pidEditPlayerCreate:
			slog.Debug("edit_player_create received", "remote", r.RemoteAddr)
		case pidEditPlayerRemove:
			slog.Debug("edit_player_remove received", "remote", r.RemoteAddr)
		case pidEditPlayer:
			slog.Debug("edit_player received", "remote", r.RemoteAddr)
		case pidEditPlayerVision:
			slog.Debug("edit_player_vision received", "remote", r.RemoteAddr)
		case pidEditGame:
			slog.Debug("edit_game received", "remote", r.RemoteAddr)
		case pidEditScenarioDesc:
			slog.Debug("edit_scenario_desc received", "remote", r.RemoteAddr)

		default:
			slog.Warn("unknown packet received", "remote", r.RemoteAddr, "pid", pkt.PID)
		}
	}
}

// playersHandler writes the current player list as a JSON array.  In CGO
// mode the list is fetched directly from the C engine's memory; in stub mode
// it returns an empty array.
func (s *server) playersHandler(w http.ResponseWriter, r *http.Request) {
	players := cgoBridge.FetchCPlayerList()
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(players); err != nil {
		slog.Error("playersHandler: failed to encode response", "error", err)
	}
}

// statusResponse is the JSON body returned by the /status endpoint.
type statusResponse struct {
	Status           string   `json:"status"`
	UptimeSeconds    float64  `json:"uptime_seconds"`
	ConnectedClients int64    `json:"connected_clients"`
	Players          []string `json:"players"`
}

// statusHandler returns a JSON document with server health information.
func (s *server) statusHandler(w http.ResponseWriter, r *http.Request) {
	resp := statusResponse{
		Status:           "ok",
		UptimeSeconds:    time.Since(s.startTime).Seconds(),
		ConnectedClients: s.connectedClients.Load(),
		Players:          engine.GetPlayerList(),
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func main() {
	settingsFile := flag.String("settings", "settings.ini", "Path to settings.ini")
	logLevelFlag := flag.String("log-level", "", "Logging level override (DEBUG, INFO, WARN, ERROR)")
	flag.Parse()

	// Load configuration from file; fall back gracefully if not found.
	cfg, err := loadConfig(*settingsFile)
	if err != nil {
		// Use defaults when the file is missing (e.g. first run without setup).
		slog.Info("Config file not found, using defaults", "path", *settingsFile, "error", err)
		cfg = &Config{
			ListenAddr: ":8080",
			LogLevel:   "INFO",
			LogFile:    "../logs/freeciv-server-go.log",
		}
	}

	// Command-line flag overrides the config file.
	if *logLevelFlag != "" {
		cfg.LogLevel = *logLevelFlag
	}

	var level slog.Level
	switch strings.ToUpper(cfg.LogLevel) {
	case "DEBUG":
		level = slog.LevelDebug
	case "WARN", "WARNING":
		level = slog.LevelWarn
	case "ERROR":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: level})))

	// Root context – cancelled on SIGTERM / SIGINT for graceful shutdown.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		sig := <-sigCh
		slog.Info("Signal received, initiating graceful shutdown", "signal", sig)
		cancel()
	}()

	// Launch the Freeciv C server main loop in its own goroutine so it
	// does not block the Go runtime.  In the real (CGO) build this
	// calls srv_main() which runs indefinitely; in stub mode it returns
	// immediately.
	go engine.RunCServer()

	srv := newServer()

	// Start the Hub event loop so register/unregister/broadcast channels
	// are serviced as soon as the first WebSocket client connects.
	go srv.hub.Run(ctx)

	// Set up the HTTP mux and endpoints.
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", srv.wsHandler)
	mux.HandleFunc("/players", srv.playersHandler)
	mux.HandleFunc("/status", srv.statusHandler)

	httpSrv := &http.Server{
		Addr:         cfg.ListenAddr,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start HTTP server in a goroutine.
	go func() {
		slog.Info("freeciv-server-go listening", "addr", cfg.ListenAddr)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("HTTP server error", "error", err)
			cancel()
		}
	}()

	// Block until context is cancelled (signal or error).
	<-ctx.Done()

	// Give active connections up to 10 seconds to finish.
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := httpSrv.Shutdown(shutdownCtx); err != nil {
		slog.Error("HTTP server shutdown error", "error", err)
	}

	slog.Info("freeciv-server-go stopped")
}
