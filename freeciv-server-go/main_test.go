package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestPlayersHandler(t *testing.T) {
	srv := newServer()
	req := httptest.NewRequest(http.MethodGet, "/players", nil)
	rr := httptest.NewRecorder()
	srv.playersHandler(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}
	if ct := rr.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", ct)
	}
	// Stub engine returns an empty list, so body should be a JSON empty array.
	var players []struct {
		Name string `json:"name"`
		IsAI bool   `json:"is_ai"`
		ID   int    `json:"id"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&players); err != nil {
		t.Fatalf("failed to decode players response: %v", err)
	}
	if len(players) != 0 {
		t.Errorf("expected empty players array in stub mode, got %d entries", len(players))
	}
}

func TestStatusHandler(t *testing.T) {
	srv := newServer()
	req := httptest.NewRequest(http.MethodGet, "/status", nil)
	rr := httptest.NewRecorder()
	srv.statusHandler(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}
	if ct := rr.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", ct)
	}

	var resp statusResponse
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.Status != "ok" {
		t.Errorf("expected status ok, got %q", resp.Status)
	}
	if resp.UptimeSeconds < 0 {
		t.Errorf("expected non-negative uptime, got %f", resp.UptimeSeconds)
	}
	if resp.ConnectedClients != 0 {
		t.Errorf("expected 0 connected clients, got %d", resp.ConnectedClients)
	}
}

func TestStatusHandlerConnectedClients(t *testing.T) {
	srv := newServer()
	srv.connectedClients.Add(3)

	req := httptest.NewRequest(http.MethodGet, "/status", nil)
	rr := httptest.NewRecorder()
	srv.statusHandler(rr, req)

	var resp statusResponse
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.ConnectedClients != 3 {
		t.Errorf("expected 3 connected clients, got %d", resp.ConnectedClients)
	}
}

func TestLoadConfigMissing(t *testing.T) {
	cfg, err := loadConfig("/nonexistent/path/settings.ini")
	if err == nil {
		t.Fatal("expected error for missing config file")
	}
	if cfg != nil {
		t.Fatal("expected nil config on error")
	}
}

func writeTempConfig(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "settings.ini")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write temp config: %v", err)
	}
	return path
}

func TestLoadConfigFromFile(t *testing.T) {
	path := writeTempConfig(t, "[Config]\nlisten_addr = :9090\nlog_level = DEBUG\nlog_file = /tmp/test.log\n")
	cfg, err := loadConfig(path)
	if err != nil {
		t.Fatalf("unexpected error loading config: %v", err)
	}
	if cfg.ListenAddr != ":9090" {
		t.Errorf("expected listen_addr :9090, got %q", cfg.ListenAddr)
	}
	if cfg.LogLevel != "DEBUG" {
		t.Errorf("expected log_level DEBUG, got %q", cfg.LogLevel)
	}
	if cfg.LogFile != "/tmp/test.log" {
		t.Errorf("expected log_file /tmp/test.log, got %q", cfg.LogFile)
	}
}

func TestLoadConfigEnvOverride(t *testing.T) {
	path := writeTempConfig(t, "[Config]\nlisten_addr = :9090\nlog_level = INFO\n")

	t.Setenv("FREECIV_SERVER_ADDR", ":7777")
	t.Setenv("FREECIV_SERVER_LOG_LEVEL", "WARN")

	cfg, err := loadConfig(path)
	if err != nil {
		t.Fatalf("unexpected error loading config: %v", err)
	}
	if cfg.ListenAddr != ":7777" {
		t.Errorf("expected env override :7777, got %q", cfg.ListenAddr)
	}
	if cfg.LogLevel != "WARN" {
		t.Errorf("expected env override WARN, got %q", cfg.LogLevel)
	}
}

func TestLoadConfigDefaults(t *testing.T) {
	// Empty file – all values should be defaults.
	path := writeTempConfig(t, "")
	cfg, err := loadConfig(path)
	if err != nil {
		t.Fatalf("unexpected error loading empty config: %v", err)
	}
	if cfg.ListenAddr != ":8080" {
		t.Errorf("expected default listen_addr :8080, got %q", cfg.ListenAddr)
	}
	if cfg.LogLevel != "INFO" {
		t.Errorf("expected default log_level INFO, got %q", cfg.LogLevel)
	}
}

// newWsHandlerServer starts an httptest.Server that mounts the given server's
// wsHandler at "/" and returns the test server and a cancel function that
// cancels the hub context.
func newWsHandlerServer(t *testing.T) (*httptest.Server, context.CancelFunc) {
	t.Helper()
	srv := newServer()
	ctx, cancel := context.WithCancel(context.Background())
	go srv.hub.Run(ctx)
	ts := httptest.NewServer(http.HandlerFunc(srv.wsHandler))
	t.Cleanup(func() { ts.Close(); cancel() })
	return ts, cancel
}

// dialTestWS dials a WebSocket to the test server and returns the connection.
func dialTestWS(t *testing.T, ts *httptest.Server) *websocket.Conn {
	t.Helper()
	u := "ws" + strings.TrimPrefix(ts.URL, "http")
	conn, _, err := websocket.DefaultDialer.Dial(u, nil)
	if err != nil {
		t.Fatalf("dial WebSocket: %v", err)
	}
	return conn
}

// readTextMsg reads the next text message from conn with a short timeout.
func readTextMsg(t *testing.T, conn *websocket.Conn) []byte {
	t.Helper()
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("read message: %v", err)
	}
	return msg
}

// TestWsHandlerLoginReply verifies that the server sends a valid
// server_join_reply (pid 5) in response to a server_join_req (pid 4).
func TestWsHandlerLoginReply(t *testing.T) {
	ts, _ := newWsHandlerServer(t)
	client := dialTestWS(t, ts)
	defer client.Close()

	joinReq := serverJoinReq{
		PID:          pidServerJoinReq,
		Username:     "testuser",
		Capability:   serverCapability,
		VersionLabel: "-dev",
		MajorVersion: 3,
		MinorVersion: 1,
		PatchVersion: 90,
	}
	b, _ := json.Marshal(joinReq)
	if err := client.WriteMessage(websocket.TextMessage, b); err != nil {
		t.Fatalf("write join req: %v", err)
	}

	// Read server_join_reply (pid 5).
	msg := readTextMsg(t, client)
	var reply serverJoinReply
	if err := json.Unmarshal(msg, &reply); err != nil {
		t.Fatalf("unmarshal server_join_reply: %v – raw: %s", err, msg)
	}
	if reply.PID != pidServerJoinReply {
		t.Errorf("expected pid %d, got %d", pidServerJoinReply, reply.PID)
	}
	if !reply.YouCanJoin {
		t.Errorf("expected you_can_join true, got false (message: %q)", reply.Message)
	}
	if reply.ConnID <= 0 {
		t.Errorf("expected positive conn_id, got %d", reply.ConnID)
	}
	if reply.Capability != serverCapability {
		t.Errorf("expected capability %q, got %q", serverCapability, reply.Capability)
	}
	if !strings.Contains(reply.Message, "testuser") {
		t.Errorf("expected message to contain username, got %q", reply.Message)
	}
}

// TestWsHandlerConnInfo verifies that after the join reply the server sends a
// conn_info packet (pid 115) describing the new connection.
func TestWsHandlerConnInfo(t *testing.T) {
	ts, _ := newWsHandlerServer(t)
	client := dialTestWS(t, ts)
	defer client.Close()

	joinReq := serverJoinReq{
		PID:      pidServerJoinReq,
		Username: "alice",
	}
	b, _ := json.Marshal(joinReq)
	client.WriteMessage(websocket.TextMessage, b) //nolint:errcheck

	// First message is the join reply; second is conn_info.
	readTextMsg(t, client) // join reply
	msg := readTextMsg(t, client)

	var info connInfo
	if err := json.Unmarshal(msg, &info); err != nil {
		t.Fatalf("unmarshal conn_info: %v – raw: %s", err, msg)
	}
	if info.PID != pidConnInfo {
		t.Errorf("expected pid %d, got %d", pidConnInfo, info.PID)
	}
	if !info.Used {
		t.Error("expected conn_info.used=true")
	}
	if !info.Established {
		t.Error("expected conn_info.established=true")
	}
	if info.Username != "alice" {
		t.Errorf("expected username %q, got %q", "alice", info.Username)
	}
	if info.ID <= 0 {
		t.Errorf("expected positive conn_info.id, got %d", info.ID)
	}
}

// TestWsHandlerMissingJoinReq verifies that the server closes the connection
// when the first message is not a valid server_join_req.
func TestWsHandlerMissingJoinReq(t *testing.T) {
	ts, _ := newWsHandlerServer(t)
	client := dialTestWS(t, ts)
	defer client.Close()

	// Send a packet with the wrong pid.
	bogus := []byte(`{"pid":99,"foo":"bar"}`)
	client.WriteMessage(websocket.TextMessage, bogus) //nolint:errcheck

	// The server should close the connection without sending a join reply.
	client.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, _, err := client.ReadMessage()
	if err == nil {
		t.Error("expected connection to be closed after invalid join req, but read succeeded")
	}
}

// TestWsHandlerConnIDsAreUnique verifies that each connection receives a
// distinct conn_id.
func TestWsHandlerConnIDsAreUnique(t *testing.T) {
	ts, _ := newWsHandlerServer(t)

	joinPkt := func() []byte {
		b, _ := json.Marshal(serverJoinReq{PID: pidServerJoinReq, Username: "u"})
		return b
	}

	login := func() int64 {
		c := dialTestWS(t, ts)
		defer c.Close()
		c.WriteMessage(websocket.TextMessage, joinPkt()) //nolint:errcheck
		msg := readTextMsg(t, c)
		var reply serverJoinReply
		json.Unmarshal(msg, &reply) //nolint:errcheck
		return reply.ConnID
	}

	id1 := login()
	id2 := login()
	if id1 == id2 {
		t.Errorf("expected unique conn IDs, but both were %d", id1)
	}
}
