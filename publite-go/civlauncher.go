package main

import (
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"regexp"
	"time"
)

var metaHostPathRe = regexp.MustCompile(`^[a-zA-Z0-9.:/_-]+$`)

// CivLauncher starts and restarts a single freeciv-web + websockify pair.
type CivLauncher struct {
	GameType     string
	ScriptType   string
	Port         int
	MetaHostPath string
	SavesDir     string
	shutdown     chan struct{}
	StartedTime  string
	NumStart     int
	NumError     int
}

// NewCivLauncher creates a CivLauncher ready to run.
func NewCivLauncher(gameType, scriptType string, port int, metaHostPath, savesDir string, shutdown chan struct{}) *CivLauncher {
	return &CivLauncher{
		GameType:     gameType,
		ScriptType:   scriptType,
		Port:         port,
		MetaHostPath: metaHostPath,
		SavesDir:     savesDir,
		shutdown:     shutdown,
		StartedTime:  time.Now().UTC().Format("2006-01-02 15:04:05"),
	}
}

// Run is the main goroutine loop; it restarts the game server until shutdown.
func (cl *CivLauncher) Run() {
	for {
		select {
		case <-cl.shutdown:
			slog.Info("CivLauncher shutting down", "port", cl.Port)
			return
		default:
		}

		slog.Info("Starting freeciv-web", "port", cl.Port, "proxy_port", 1000+cl.Port)
		if err := cl.launchGame(); err != nil {
			slog.Error("Error during execution", "port", cl.Port, "error", err)
			cl.NumError++
		} else {
			cl.NumStart++
		}

		select {
		case <-cl.shutdown:
			slog.Info("CivLauncher shutting down", "port", cl.Port)
			return
		case <-time.After(5 * time.Second):
		}
	}
}

func (cl *CivLauncher) launchGame() error {
	if err := os.MkdirAll(cl.SavesDir, 0o755); err != nil {
		return fmt.Errorf("creating saves dir: %w", err)
	}

	args, logsDir, err := cl.buildFreecivArgs()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(logsDir, 0o755); err != nil {
		return fmt.Errorf("creating logs dir: %w", err)
	}

	// Start websockify proxy.
	proxyLogPath := filepath.Join(logsDir, fmt.Sprintf("freeciv-proxy-%d.log", 1000+cl.Port))
	proxyLogFile, err := os.Create(proxyLogPath)
	if err != nil {
		return fmt.Errorf("creating proxy log: %w", err)
	}
	defer proxyLogFile.Close()

	proxyCmd := exec.Command("websockify",
		"--no-ssl",
		"--cert=",
		fmt.Sprintf("%d", 1000+cl.Port),
		fmt.Sprintf("localhost:%d", cl.Port),
	)
	proxyCmd.Stdout = proxyLogFile
	proxyCmd.Stderr = proxyLogFile
	if err := proxyCmd.Start(); err != nil {
		return fmt.Errorf("starting websockify: %w", err)
	}
	defer func() {
		_ = proxyCmd.Process.Kill()
		_ = proxyCmd.Wait()
		slog.Info("Proxy process terminated", "proxy_port", 1000+cl.Port)
	}()
	slog.Info("Proxy started", "proxy_port", 1000+cl.Port)

	// Start freeciv-web.
	freecivLogPath := filepath.Join(logsDir, fmt.Sprintf("freeciv-web-stderr-%d.log", cl.Port))
	freecivLogFile, err := os.Create(freecivLogPath)
	if err != nil {
		return fmt.Errorf("creating freeciv log: %w", err)
	}
	defer freecivLogFile.Close()

	freecivCmd := exec.Command(args[0], args[1:]...)
	freecivCmd.Stdout = nil // discard
	freecivCmd.Stderr = freecivLogFile
	if err := freecivCmd.Start(); err != nil {
		return fmt.Errorf("starting freeciv-web: %w", err)
	}
	if err := freecivCmd.Wait(); err != nil {
		slog.Info("Freeciv-web process exited", "port", cl.Port, "error", err)
	} else {
		slog.Info("Freeciv-web process exited successfully", "port", cl.Port)
	}
	return nil
}

func (cl *CivLauncher) buildFreecivArgs() (args []string, logsDir string, err error) {
	u, err := user.Current()
	if err != nil {
		return nil, "", fmt.Errorf("getting current user: %w", err)
	}
	freecivBinary := filepath.Join(u.HomeDir, "freeciv", "bin", "freeciv-web")
	if _, err := os.Stat(freecivBinary); err != nil {
		return nil, "", fmt.Errorf("freeciv binary not found at %s: %w", freecivBinary, err)
	}

	// Validate metahostpath to prevent command injection.
	if !metaHostPathRe.MatchString(cl.MetaHostPath) {
		return nil, "", fmt.Errorf("invalid metahostpath %q: must be alphanumeric with dots, colons, slashes, or dashes", cl.MetaHostPath)
	}

	// Determine the executable's directory so we can find sibling files
	// (pubscript_*.serv) and place logs one level up.
	exePath, err := os.Executable()
	if err != nil {
		return nil, "", fmt.Errorf("getting executable path: %w", err)
	}
	exeDir := filepath.Dir(exePath)
	logsDir = filepath.Join(exeDir, "..", "logs")
	logFile := filepath.Join(logsDir, fmt.Sprintf("freeciv-web-log-%d.log", cl.Port))
	scriptFile := filepath.Join(exeDir, fmt.Sprintf("pubscript_%s.serv", cl.ScriptType))

	args = []string{
		freecivBinary,
		"--debug", "1",
		"--port", fmt.Sprintf("%d", cl.Port),
		"--Announce", "none",
		"--exit-on-end",
		"--meta", "--keep",
		"--Metaserver", fmt.Sprintf("http://%s", cl.MetaHostPath),
		"--type", cl.GameType,
		"--read", scriptFile,
		"--log", logFile,
		"--quitidle", "20",
		"--saves", cl.SavesDir,
	}
	// Logic Change: Only add --Ranklog for multiplayer games
	if cl.GameType == "multiplayer" {
		ranklogPath := fmt.Sprintf("../ranklog/ranklog-game-%d.score", cl.Port)
		args = append(args, "--Ranklog", ranklogPath)
	}
	return args, logsDir, nil
}
