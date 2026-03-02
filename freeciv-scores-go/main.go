package main

import (
	"flag"
	"fmt"
	"io"
	"log/slog"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// mathExp wraps math.Exp so elo.go can call it without its own math import.
func mathExp(x float64) float64 {
	return math.Exp(x)
}

var ranklogRe = regexp.MustCompile(`^ranklog-game-(\d+)\.score$`)

// run is the main processing loop called on each tick.
func run(cfg *Config) {
	entries, err := os.ReadDir(cfg.RanklogDir)
	if err != nil {
		slog.Error("Cannot read ranklog directory", "dir", cfg.RanklogDir, "error", err)
		return
	}

	db, err := openDB(cfg)
	if err != nil {
		slog.Error("Cannot connect to database", "error", err)
		return
	}
	defer db.Close()

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		matches := ranklogRe.FindStringSubmatch(name)
		if matches == nil {
			continue
		}
		port, _ := strconv.Atoi(matches[1])
		fullPath := filepath.Join(cfg.RanklogDir, name)

		slog.Info("Processing ranklog file", "file", fullPath, "port", port)

		result, err := parseRanklog(fullPath, port)
		if err != nil {
			slog.Error("Failed to parse ranklog", "file", fullPath, "error", err)
			continue
		}

		if len(result.Winners) == 0 && len(result.Losers) == 0 {
			slog.Warn("Ranklog has no players, skipping", "file", fullPath)
			continue
		}

		allPlayers := append(append([]string{}, result.Winners...), result.Losers...)
		ratings, err := getPlayerRatings(db, allPlayers)
		if err != nil {
			slog.Error("Failed to get player ratings", "error", err)
			continue
		}

		newRatings := calculateEloChanges(result.Winners, result.Losers, ratings)

		gameID, err := nextGameID(db)
		if err != nil {
			slog.Error("Failed to get next game ID", "error", err)
			continue
		}

		if err := saveGameResults(db, gameID, result.Winners, result.Losers, newRatings); err != nil {
			slog.Error("Failed to save game results", "file", fullPath, "error", err)
			continue
		}

		slog.Info("Game processed successfully",
			"file", fullPath,
			"game_id", gameID,
			"winners", strings.Join(result.Winners, ","),
			"losers", strings.Join(result.Losers, ","),
		)

		slog.Info("Deleting ranklog file", "file", fullPath)
		if err := os.Remove(fullPath); err != nil {
			slog.Error("Failed to delete ranklog file", "file", fullPath, "error", err)
		}
	}
}

func main() {
	settingsFile := flag.String("settings", "settings.ini", "Path to settings.ini")
	logLevel := flag.String("log-level", "INFO", "Logging level (DEBUG, INFO, WARN, ERROR)")
	flag.Parse()

	cfg, err := loadConfig(*settingsFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to load config: %v\n", err)
		os.Exit(1)
	}

	// Ensure the log directory exists.
	if err := os.MkdirAll(filepath.Dir(cfg.LogFile), 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create log directory: %v\n", err)
		os.Exit(1)
	}

	logFile, err := os.OpenFile(cfg.LogFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to open log file %s: %v\n", cfg.LogFile, err)
		os.Exit(1)
	}
	defer logFile.Close()

	// Log to both file and stdout.
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

	multiWriter := io.MultiWriter(os.Stdout, logFile)
	slog.SetDefault(slog.New(slog.NewTextHandler(multiWriter, &slog.HandlerOptions{Level: level})))

	slog.Info("freeciv-scores-go started",
		"ranklog_dir", cfg.RanklogDir,
		"poll_interval", cfg.PollInterval,
		"log_file", cfg.LogFile,
	)

	ticker := time.NewTicker(time.Duration(cfg.PollInterval) * time.Second)
	defer ticker.Stop()

	// Run once immediately on startup.
	run(cfg)

	for range ticker.C {
		run(cfg)
	}
}
