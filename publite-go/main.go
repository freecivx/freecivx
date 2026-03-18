package main

import (
	"flag"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

const (
	metaPath   = "/freeciv-web/meta/metaserver"
	statusPath = "/freeciv-web/meta/status"
)

// MetaChecker monitors the metaserver and manages game server instances.
type MetaChecker struct {
	servers        []*CivLauncher
	serversMu      sync.Mutex
	checkCount     int
	total          int
	single         int
	multi          int
	lastHTTPStatus int
	htmlDoc        string
	shutdown       chan struct{}
	config         *Config
}

func newMetaChecker(cfg *Config) *MetaChecker {
	return &MetaChecker{
		htmlDoc:        "-",
		lastHTTPStatus: -1,
		shutdown:       make(chan struct{}),
		config:         cfg,
	}
}

func (mc *MetaChecker) fetchMetaStatus() []string {
	url := fmt.Sprintf("http://%s:%d%s", mc.config.MetaHost, mc.config.MetaPort, statusPath)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		slog.Error("Unable to connect to metaserver", "url", url, "error", err)
		return nil
	}
	defer resp.Body.Close()

	mc.lastHTTPStatus = resp.StatusCode
	if resp.StatusCode != 200 {
		slog.Error("Invalid metaserver status", "http_status", resp.StatusCode)
		return nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		slog.Error("Error reading metaserver response", "error", err)
		return nil
	}
	mc.htmlDoc = strings.TrimRight(string(body), "\n")
	parts := strings.Split(mc.htmlDoc, ";")
	if len(parts) != 4 {
		slog.Error("Invalid metaserver status format", "expected", 4, "got", len(parts))
		return nil
	}
	return parts
}

func (mc *MetaChecker) launchServer(gameType string, port int) int {
	slog.Info("Launching server", "game_type", gameType, "port", port)
	metaHostPath := fmt.Sprintf("%s:%d%s", mc.config.MetaHost, mc.config.MetaPort, metaPath)
	launcher := NewCivLauncher(gameType, gameType, port, metaHostPath, mc.config.SavesDir, mc.shutdown)
	mc.serversMu.Lock()
	mc.servers = append(mc.servers, launcher)
	mc.serversMu.Unlock()
	go launcher.Run()
	return port + 1
}

func (mc *MetaChecker) run(startPort int) {
	port := startPort
	ticker := time.NewTicker(time.Duration(mc.config.CheckInterval) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-mc.shutdown:
			slog.Info("MetaChecker shutting down gracefully.")
			return
		case <-ticker.C:
		}

		mc.checkCount++
		parts := mc.fetchMetaStatus()
		if parts == nil {
			continue
		}

		mc.total, _ = strconv.Atoi(parts[1])
		mc.single, _ = strconv.Atoi(parts[2])
		mc.multi, _ = strconv.Atoi(parts[3])

		for mc.single < mc.config.ServerCapacitySingle && mc.total < mc.config.ServerLimit {
			select {
			case <-mc.shutdown:
				return
			default:
			}
			port = mc.launchServer("singleplayer", port)
			mc.single++
			mc.total++
		}

		for mc.multi < mc.config.ServerCapacityMulti && mc.total < mc.config.ServerLimit {
			select {
			case <-mc.shutdown:
				return
			default:
			}
			port = mc.launchServer("multiplayer", port)
			mc.multi++
			mc.total++
		}
	}
}

func main() {
	settingsFile := flag.String("settings", "settings.ini", "Path to settings.ini")
	logLevel := flag.String("log-level", "INFO", "Logging level (DEBUG, INFO, WARN, ERROR)")
	flag.Parse()

	// Set up structured logging.
	var level slog.Level
	switch strings.ToUpper(*logLevel) {
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

	cfg, err := loadConfig(*settingsFile)
	if err != nil {
		slog.Error("Failed to load config", "error", err)
		os.Exit(1)
	}

	// Test connection to the metaserver (mirrors legacy behaviour).
	url := fmt.Sprintf("http://%s:%d%s", cfg.MetaHost, cfg.MetaPort, statusPath)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		slog.Error("Unable to connect to metaserver", "url", url, "error", err)
		os.Exit(1)
	}
	if resp.StatusCode != 200 {
		slog.Error("Invalid response from metaserver", "http_status", resp.StatusCode)
		resp.Body.Close()
		os.Exit(1)
	}
	resp.Body.Close()

	mc := newMetaChecker(cfg)

	// Start the status HTTP server in the background.
	go startPubStatus(mc)

	// Launch one initial server of each type.
	port := cfg.InitialPort
	port = mc.launchServer("singleplayer", port)
	port = mc.launchServer("multiplayer", port)

	// Launch one freecivx-server in singleplayer mode and one in multiplayer mode.
	freecivxSingle := NewFreecivxLauncher(cfg.FreecivxPort, "singleplayer", mc.shutdown)
	go freecivxSingle.Run()

	freecivxMulti := NewFreecivxLauncher(cfg.FreecivxMultiPort, "multiplayer", mc.shutdown)
	go freecivxMulti.Run()

	slog.Info("publite-go started!")

	// Set up signal handlers for graceful shutdown.
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		sig := <-sigCh
		slog.Info("Received signal, initiating graceful shutdown...", "signal", sig)
		close(mc.shutdown)
	}()

	mc.run(port)
	slog.Info("publite-go shutdown complete.")
}
