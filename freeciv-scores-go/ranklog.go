package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

// GameResult holds the parsed contents of a single ranklog file.
type GameResult struct {
	Port    int
	Winners []string
	Losers  []string
}

// parseRanklog reads a ranklog file and returns a GameResult.
// Expected format:
//
//	turns: 4
//	winners: Unassigned,PlayerName,username,1,,
//	losers:  Unassigned,PlayerName,username,0,,
//
// The third comma-separated field on each winners/losers line is the username.
func parseRanklog(path string, port int) (*GameResult, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open ranklog %s: %w", path, err)
	}
	defer f.Close()

	result := &GameResult{Port: port}

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		if strings.HasPrefix(line, "winners:") {
			names := extractUsernames(strings.TrimPrefix(line, "winners:"))
			result.Winners = append(result.Winners, names...)
		} else if strings.HasPrefix(line, "losers:") {
			names := extractUsernames(strings.TrimPrefix(line, "losers:"))
			result.Losers = append(result.Losers, names...)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("reading ranklog %s: %w", path, err)
	}

	return result, nil
}

// extractUsernames parses one or more semicolon-separated player entries.
// Each entry is comma-separated: Unassigned,DisplayName,username,score,,
// The third field (index 2) is the username used in the database.
func extractUsernames(value string) []string {
	value = strings.TrimSpace(value)
	var usernames []string

	// Multiple players on the same line are separated by semicolons.
	entries := strings.Split(value, ";")
	for _, entry := range entries {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		fields := strings.Split(entry, ",")
		if len(fields) >= 3 {
			username := strings.TrimSpace(fields[2])
			if username != "" {
				usernames = append(usernames, username)
			}
		}
	}
	return usernames
}
