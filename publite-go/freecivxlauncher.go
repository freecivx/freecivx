package main

import (
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

// FreecivxLauncher starts and restarts the Java freecivx-server.
type FreecivxLauncher struct {
	Port        int
	Mode        string // "singleplayer" or "multiplayer"
	Tiles       string // "square" or "hex"
	MetaMessage string // metaserver description text
	shutdown    chan struct{}
	StartedTime string
	NumStart    int
	NumError    int
}

// NewFreecivxLauncher creates a FreecivxLauncher ready to run.
func NewFreecivxLauncher(port int, mode string, tiles string, metaMessage string, shutdown chan struct{}) *FreecivxLauncher {
	return &FreecivxLauncher{
		Port:        port,
		Mode:        mode,
		Tiles:       tiles,
		MetaMessage: metaMessage,
		shutdown:    shutdown,
		StartedTime: time.Now().UTC().Format("2006-01-02 15:04:05"),
	}
}

// Run is the main goroutine loop; it restarts the Java server until shutdown.
func (fl *FreecivxLauncher) Run() {
	for {
		select {
		case <-fl.shutdown:
			slog.Info("FreecivxLauncher shutting down", "port", fl.Port)
			return
		default:
		}

		slog.Info("Starting freecivx-server", "port", fl.Port)
		if err := fl.launchFreecivx(); err != nil {
			slog.Error("Error during freecivx-server execution", "port", fl.Port, "error", err)
			fl.NumError++
		} else {
			fl.NumStart++
		}

		select {
		case <-fl.shutdown:
			slog.Info("FreecivxLauncher shutting down", "port", fl.Port)
			return
		case <-time.After(5 * time.Second):
		}
	}
}

func (fl *FreecivxLauncher) launchFreecivx() error {
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("getting executable path: %w", err)
	}
	exeDir := filepath.Dir(exePath)

	matches, err := filepath.Glob(filepath.Join(exeDir, "..", "freecivx-server", "target", "freecivx-server-*.jar"))
	if err != nil || len(matches) == 0 {
		return fmt.Errorf("freecivx-server jar not found in %s/freecivx-server/target/", filepath.Join(exeDir, ".."))
	}
	jarPath := matches[0]

	logsDir := filepath.Join(exeDir, "..", "logs")
	if err := os.MkdirAll(logsDir, 0o755); err != nil {
		return fmt.Errorf("creating logs dir: %w", err)
	}

	logPath := filepath.Join(logsDir, fmt.Sprintf("freecivx-server-%d.log", fl.Port))
	logFile, err := os.Create(logPath)
	if err != nil {
		return fmt.Errorf("creating freecivx-server log: %w", err)
	}
	defer logFile.Close()

	cmd := exec.Command("java", "-jar", jarPath, fmt.Sprintf("%d", fl.Port), "--mode", fl.Mode, "--tiles", fl.Tiles, "--metamessage", fl.MetaMessage)
	cmd.Stdout = logFile
	cmd.Stderr = logFile
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("starting freecivx-server: %w", err)
	}
	if err := cmd.Wait(); err != nil {
		slog.Info("freecivx-server process exited", "port", fl.Port, "error", err)
	} else {
		slog.Info("freecivx-server process exited successfully", "port", fl.Port)
	}
	return nil
}
