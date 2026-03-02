package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestPlayersHandler(t *testing.T) {
	srv := newServer()
	req := httptest.NewRequest(http.MethodGet, "/players", nil)
	rr := httptest.NewRecorder()
	srv.playersHandler(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}
	// Stub engine returns an empty list, so body should be empty.
	body := rr.Body.String()
	if body != "" {
		t.Errorf("expected empty body in stub mode, got %q", body)
	}
	if ct := rr.Header().Get("Content-Type"); ct != "text/plain" {
		t.Errorf("expected Content-Type text/plain, got %q", ct)
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
