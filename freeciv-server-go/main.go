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
	"sync"
	"sync/atomic"
	"syscall"
	"time"

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
	mu               sync.Mutex // guards wsConns
	wsConns          map[*websocket.Conn]struct{}
}

func newServer() *server {
	return &server{
		startTime: time.Now(),
		wsConns:   make(map[*websocket.Conn]struct{}),
	}
}

// wsHandler upgrades an HTTP connection to WebSocket, sends the
// current player list as a greeting, and then echoes messages until
// the client disconnects or the server shuts down.
func (s *server) wsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("WebSocket upgrade failed", "error", err)
		return
	}
	defer conn.Close()

	s.mu.Lock()
	s.wsConns[conn] = struct{}{}
	s.mu.Unlock()
	s.connectedClients.Add(1)
	defer func() {
		s.mu.Lock()
		delete(s.wsConns, conn)
		s.mu.Unlock()
		s.connectedClients.Add(-1)
	}()

	slog.Info("WebSocket client connected", "remote", r.RemoteAddr)

	// Send the current player list as an initial message.
	players := engine.GetPlayerList()
	var sb strings.Builder
	sb.WriteString("players:")
	for _, name := range players {
		sb.WriteByte(' ')
		sb.WriteString(name)
	}
	if err := conn.WriteMessage(websocket.TextMessage, []byte(sb.String())); err != nil {
		slog.Error("WebSocket write error", "error", err)
		return
	}

	// Echo loop – read until the client closes or an error occurs.
	for {
		mt, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				slog.Error("WebSocket read error", "error", err)
			}
			return
		}
		slog.Debug("WebSocket message received", "remote", r.RemoteAddr, "message", string(message))
		if err := conn.WriteMessage(mt, message); err != nil {
			slog.Error("WebSocket write error", "error", err)
			return
		}
	}
}

// playersHandler writes the current player list as plain text.
func (s *server) playersHandler(w http.ResponseWriter, r *http.Request) {
	players := engine.GetPlayerList()
	w.Header().Set("Content-Type", "text/plain")
	for _, name := range players {
		_, _ = w.Write([]byte(name + "\n"))
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
