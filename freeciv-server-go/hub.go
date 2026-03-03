package main

import (
	"context"
	"log/slog"
	"sync"

	"github.com/gorilla/websocket"
)

// Hub manages the set of active WebSocket clients and broadcasts messages to
// them.  The clients map is protected by mu so it can be safely read (e.g. for
// testing) from outside the Run goroutine.
//
// Usage:
//
//	h := newHub()
//	go h.Run(ctx)     // start the event loop; stops when ctx is cancelled
//	h.Broadcast(msg)  // send a message to all connected clients
type Hub struct {
	mu sync.RWMutex
	// clients is the set of currently registered WebSocket connections.
	clients map[*websocket.Conn]struct{}

	// register is sent a connection when a new WebSocket client connects.
	register chan *websocket.Conn

	// unregister is sent a connection when a WebSocket client disconnects.
	unregister chan *websocket.Conn

	// broadcast is sent a message to be forwarded to all connected clients.
	broadcast chan []byte
}

// newHub creates and initialises a Hub ready to be started with Run.
func newHub() *Hub {
	return &Hub{
		clients:    make(map[*websocket.Conn]struct{}),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
		broadcast:  make(chan []byte, 256),
	}
}

// ClientCount returns the number of currently registered WebSocket clients.
// It is safe to call from any goroutine.
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// Run processes registration, unregistration, and broadcast events.  It
// must be called in its own goroutine.  It returns when ctx is cancelled,
// closing all remaining client connections before returning.
func (h *Hub) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			h.mu.Lock()
			for conn := range h.clients {
				if err := conn.Close(); err != nil {
					slog.Debug("Hub: close error during shutdown", "error", err, "remote", conn.RemoteAddr())
				}
			}
			h.mu.Unlock()
			return

		case conn := <-h.register:
			h.mu.Lock()
			h.clients[conn] = struct{}{}
			h.mu.Unlock()

		case conn := <-h.unregister:
			h.mu.Lock()
			delete(h.clients, conn)
			h.mu.Unlock()

		case msg := <-h.broadcast:
			h.mu.Lock()
			for conn := range h.clients {
				if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
					slog.Error("Hub: broadcast write error", "error", err, "remote", conn.RemoteAddr())
					delete(h.clients, conn)
					conn.Close()
				}
			}
			h.mu.Unlock()
		}
	}
}

// Broadcast sends msg to all currently connected WebSocket clients.  It is
// safe to call from any goroutine.  When the C engine fires a game event
// (e.g. end-of-turn), call this method with a JSON-encoded payload to push
// the update to all browser clients.
func (h *Hub) Broadcast(msg []byte) {
	h.broadcast <- msg
}
