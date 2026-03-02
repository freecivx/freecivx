package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config holds freeciv-scores-go configuration.
type Config struct {
	DBHost       string
	DBPort       int
	DBName       string
	DBUser       string
	DBPassword   string
	RanklogDir   string
	LogFile      string
	PollInterval int
}

// loadConfig reads an INI-format settings file and returns a Config.
// Environment variables override file settings:
//   - SCORES_DB_HOST
//   - SCORES_DB_PORT
//   - SCORES_DB_NAME
//   - SCORES_DB_USER
//   - SCORES_DB_PASSWORD
//   - SCORES_RANKLOG_DIR
//   - SCORES_LOG_FILE
//   - SCORES_POLL_INTERVAL
func loadConfig(path string) (*Config, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("freeciv-scores-go isn't set up correctly – copy settings.ini.dist to settings.ini and update it: %w", err)
	}
	defer f.Close()

	sections := map[string]map[string]string{}
	currentSection := ""

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, ";") {
			continue
		}
		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			currentSection = line[1 : len(line)-1]
			if _, ok := sections[currentSection]; !ok {
				sections[currentSection] = map[string]string{}
			}
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 && currentSection != "" {
			key := strings.TrimSpace(parts[0])
			val := strings.TrimSpace(parts[1])
			sections[currentSection][key] = val
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}

	get := func(section, key, def string) string {
		if s, ok := sections[section]; ok {
			if v, ok := s[key]; ok {
				return v
			}
		}
		return def
	}

	getInt := func(section, key string, def int) int {
		v, err := strconv.Atoi(get(section, key, ""))
		if err != nil {
			return def
		}
		return v
	}

	envStr := func(envKey, fallback string) string {
		if v := os.Getenv(envKey); v != "" {
			return v
		}
		return fallback
	}

	envInt := func(envKey string, fallback int) int {
		if v := os.Getenv(envKey); v != "" {
			if n, err := strconv.Atoi(v); err == nil {
				return n
			}
		}
		return fallback
	}

	return &Config{
		DBHost:       envStr("SCORES_DB_HOST", get("Database", "db_host", "localhost")),
		DBPort:       envInt("SCORES_DB_PORT", getInt("Database", "db_port", 3306)),
		DBName:       envStr("SCORES_DB_NAME", get("Database", "db_name", "freeciv_web")),
		DBUser:       envStr("SCORES_DB_USER", get("Database", "db_user", "freeciv")),
		DBPassword:   envStr("SCORES_DB_PASSWORD", get("Database", "db_password", "")),
		RanklogDir:   envStr("SCORES_RANKLOG_DIR", get("Config", "ranklog_dir", "../ranklog")),
		LogFile:      envStr("SCORES_LOG_FILE", get("Config", "log_file", "../logs/freeciv-scores-go.log")),
		PollInterval: envInt("SCORES_POLL_INTERVAL", getInt("Config", "poll_interval", 60)),
	}, nil
}
