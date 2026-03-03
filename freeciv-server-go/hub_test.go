package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// startTestHub starts a Hub in its own goroutine and returns a cancel func
// that stops it.
func startTestHub(t *testing.T) (*Hub, context.CancelFunc) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	h := newHub()
	go h.Run(ctx)
	return h, cancel
}

// newWSServer starts a test HTTP server that upgrades connections to WebSocket
// and registers each server-side connection with h.  It also returns a channel
// that delivers server-side conns as clients connect.
func newWSServer(t *testing.T, h *Hub) (*httptest.Server, <-chan *websocket.Conn) {
	t.Helper()
	connCh := make(chan *websocket.Conn, 4)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade: %v", err)
			return
		}
		h.register <- conn
		connCh <- conn
	}))
	return ts, connCh
}

// dialWS opens a client-side WebSocket connection to ts.
func dialWS(t *testing.T, ts *httptest.Server) *websocket.Conn {
	t.Helper()
	u := "ws" + strings.TrimPrefix(ts.URL, "http")
	conn, _, err := websocket.DefaultDialer.Dial(u, nil)
	if err != nil {
		t.Fatalf("dial WebSocket: %v", err)
	}
	return conn
}

// recvConn reads the next server-side conn from ch with a timeout.
func recvConn(t *testing.T, ch <-chan *websocket.Conn) *websocket.Conn {
	t.Helper()
	select {
	case c := <-ch:
		return c
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for server-side WebSocket conn")
		return nil
	}
}

// waitClientCount polls h.ClientCount() until it equals want or a timeout
// elapses, avoiding fragile time.Sleep synchronisation.
func waitClientCount(t *testing.T, h *Hub, want int) {
	t.Helper()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if h.ClientCount() == want {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("timeout: expected %d hub clients, got %d", want, h.ClientCount())
}

func TestHubRegisterUnregister(t *testing.T) {
	h, cancel := startTestHub(t)
	defer cancel()

	ts, connCh := newWSServer(t, h)
	defer ts.Close()

	clientConn := dialWS(t, ts)
	defer clientConn.Close()

	serverConn := recvConn(t, connCh)
	waitClientCount(t, h, 1)

	// Unregister and verify.
	h.unregister <- serverConn
	waitClientCount(t, h, 0)
}

func TestHubBroadcast(t *testing.T) {
	h, cancel := startTestHub(t)
	defer cancel()

	ts, connCh := newWSServer(t, h)
	defer ts.Close()

	clientConn := dialWS(t, ts)
	defer clientConn.Close()

	recvConn(t, connCh)
	waitClientCount(t, h, 1)

	want := "hello from hub"
	h.Broadcast([]byte(want))

	clientConn.SetReadDeadline(time.Now().Add(time.Second))
	_, got, err := clientConn.ReadMessage()
	if err != nil {
		t.Fatalf("read broadcast message: %v", err)
	}
	if string(got) != want {
		t.Errorf("expected %q, got %q", want, string(got))
	}
}

func TestHubShutdownClosesClients(t *testing.T) {
	h, cancel := startTestHub(t)

	ts, connCh := newWSServer(t, h)
	defer ts.Close()

	clientConn := dialWS(t, ts)
	defer clientConn.Close()

	recvConn(t, connCh)
	waitClientCount(t, h, 1)

	// Cancel ctx – hub should close all clients.
	cancel()

	clientConn.SetReadDeadline(time.Now().Add(time.Second))
	_, _, err := clientConn.ReadMessage()
	if err == nil {
		t.Fatal("expected error reading from closed connection, got nil")
	}
}
