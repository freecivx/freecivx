package main

import (
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

const goServerRestartDelay = 5 * time.Second

// GoServerLauncher starts and restarts a single freeciv-server-go process.
type GoServerLauncher struct {
	Binary   string
	Settings string
	shutdown chan struct{}
}

// NewGoServerLauncher creates a GoServerLauncher ready to run.
func NewGoServerLauncher(binary, settings string, shutdown chan struct{}) *GoServerLauncher {
	return &GoServerLauncher{
		Binary:   binary,
		Settings: settings,
		shutdown: shutdown,
	}
}

// Run is the main goroutine loop; it restarts freeciv-server-go until shutdown.
func (g *GoServerLauncher) Run() {
	for {
		select {
		case <-g.shutdown:
			slog.Info("GoServerLauncher shutting down")
			return
		default:
		}

		slog.Info("Starting freeciv-server-go", "binary", g.Binary)
		if err := g.launch(); err != nil {
			slog.Error("freeciv-server-go exited with error", "error", err)
		} else {
			slog.Info("freeciv-server-go exited successfully")
		}

		select {
		case <-g.shutdown:
			slog.Info("GoServerLauncher shutting down")
			return
		case <-time.After(goServerRestartDelay):
		}
	}
}

func (g *GoServerLauncher) launch() error {
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("getting executable path: %w", err)
	}
	logsDir := filepath.Join(filepath.Dir(exePath), "..", "logs")
	if err := os.MkdirAll(logsDir, 0o755); err != nil {
		return fmt.Errorf("creating logs dir: %w", err)
	}

	logPath := filepath.Join(logsDir, "freeciv-server-go.log")
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("opening log file: %w", err)
	}
	defer logFile.Close()

	args := []string{g.Binary}
	if g.Settings != "" {
		args = append(args, "-settings", g.Settings)
	}

	cmd := exec.Command(args[0], args[1:]...)
	cmd.Stdout = logFile
	cmd.Stderr = logFile
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("starting freeciv-server-go: %w", err)
	}

	// Terminate the process when shutdown is signaled.
	done := make(chan struct{})
	go func() {
		select {
		case <-g.shutdown:
			_ = cmd.Process.Kill()
		case <-done:
		}
	}()

	waitErr := cmd.Wait()
	close(done)
	if waitErr != nil {
		return fmt.Errorf("freeciv-server-go: %w", waitErr)
	}
	return nil
}
