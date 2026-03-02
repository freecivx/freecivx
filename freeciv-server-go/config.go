package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

// Config holds freeciv-server-go configuration.
type Config struct {
	ListenAddr string
	LogLevel   string
	LogFile    string
}

// loadConfig reads an INI-format settings file and returns a Config.
// Environment variables override file settings:
//   - FREECIV_SERVER_ADDR
//   - FREECIV_SERVER_LOG_LEVEL
//   - FREECIV_SERVER_LOG_FILE
func loadConfig(path string) (*Config, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("freeciv-server-go isn't set up correctly – copy settings.ini.dist to settings.ini and update it: %w", err)
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

	envStr := func(envKey, fallback string) string {
		if v := os.Getenv(envKey); v != "" {
			return v
		}
		return fallback
	}

	return &Config{
		ListenAddr: envStr("FREECIV_SERVER_ADDR", get("Config", "listen_addr", ":8080")),
		LogLevel:   envStr("FREECIV_SERVER_LOG_LEVEL", get("Config", "log_level", "INFO")),
		LogFile:    envStr("FREECIV_SERVER_LOG_FILE", get("Config", "log_file", "../logs/freeciv-server-go.log")),
	}, nil
}
