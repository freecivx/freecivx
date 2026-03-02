package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"freeciv-server-go/engine"

	"github.com/gorilla/websocket"
)

const listenAddr = ":8080"

// upgrader configures the WebSocket handshake.  CheckOrigin always
// returns true here for simplicity; restrict this in production
// deployments by validating r.Header.Get("Origin") against an
// allowlist.
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// wsHandler upgrades an HTTP connection to WebSocket, sends the
// current player list as a greeting, and then echoes messages until
// the client disconnects or the server shuts down.
func wsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("WebSocket upgrade failed", "error", err)
		return
	}
	defer conn.Close()

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

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

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

	// Set up the HTTP mux and WebSocket endpoint.
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", wsHandler)
	mux.HandleFunc("/players", func(w http.ResponseWriter, r *http.Request) {
		players := engine.GetPlayerList()
		w.Header().Set("Content-Type", "text/plain")
		for _, name := range players {
			_, _ = w.Write([]byte(name + "\n"))
		}
	})

	srv := &http.Server{
		Addr:         listenAddr,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start HTTP server in a goroutine.
	go func() {
		slog.Info("freeciv-server-go listening", "addr", listenAddr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("HTTP server error", "error", err)
			cancel()
		}
	}()

	// Block until context is cancelled (signal or error).
	<-ctx.Done()

	// Give active connections up to 10 seconds to finish.
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("HTTP server shutdown error", "error", err)
	}

	slog.Info("freeciv-server-go stopped")
}
