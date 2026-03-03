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
		case pidConnPong:
			// Client responded to our ping – nothing to do.
		case pidClientInfo:
			// Client sent its GUI/version info – acknowledge silently.
			slog.Debug("WebSocket client_info received", "remote", r.RemoteAddr)
		default:
			slog.Debug("WebSocket packet received", "remote", r.RemoteAddr, "pid", pkt.PID, "raw", string(message))
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
