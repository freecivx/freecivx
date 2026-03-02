package main

import (
	"log/slog"

	"github.com/gorilla/websocket"
)

// Hub manages the set of active WebSocket clients and broadcasts messages to
// them.  All mutations to the clients map happen inside the Run goroutine so
// no external locking is required.
//
// Usage:
//
//	h := newHub()
//	go h.Run()        // start the event loop
//	h.Broadcast(msg)  // send a message to all connected clients
type Hub struct {
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

// Run processes registration, unregistration, and broadcast events.  It
// must be called in its own goroutine.
func (h *Hub) Run() {
	for {
		select {
		case conn := <-h.register:
			h.clients[conn] = struct{}{}

		case conn := <-h.unregister:
			delete(h.clients, conn)

		case msg := <-h.broadcast:
			for conn := range h.clients {
				if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
					slog.Error("Hub: broadcast write error", "error", err, "remote", conn.RemoteAddr())
					delete(h.clients, conn)
					conn.Close()
				}
			}
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
