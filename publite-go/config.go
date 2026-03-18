package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config holds the publite-go configuration.
type Config struct {
	ServerCapacitySingle int
	ServerCapacityMulti  int
	ServerLimit          int
	SavesDir             string
	MetaHost             string
	MetaPort             int
	StatusPort           int
	InitialPort          int
	CheckInterval        int
	FreecivxPort         int
	FreecivxMultiPort    int
	FreecivxSingleHexPort int
	FreecivxMultiHexPort  int
}

// loadConfig reads an INI-format settings file and returns a Config.
// Environment variables override file settings:
//   - PUBLITE_METAHOST
//   - PUBLITE_METAPORT
//   - PUBLITE_STATUS_PORT
//   - PUBLITE_INITIAL_PORT
//   - PUBLITE_CHECK_INTERVAL
//   - PUBLITE_FREECIVX_PORT
//   - PUBLITE_FREECIVX_MULTI_PORT
//   - PUBLITE_FREECIVX_SINGLE_HEX_PORT
//   - PUBLITE_FREECIVX_MULTI_HEX_PORT
func loadConfig(path string) (*Config, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("publite-go isn't set up correctly – copy settings.ini.dist to settings.ini and update it: %w", err)
	}
	defer f.Close()

	// Parse the INI file into a nested map.
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
		ServerCapacitySingle: getInt("Resource usage", "server_capacity_single", 5),
		ServerCapacityMulti:  getInt("Resource usage", "server_capacity_multi", 2),
		ServerLimit:          getInt("Resource usage", "server_limit", 250),
		SavesDir:             get("Config", "save_directory", "/var/lib/tomcat11/webapps/data/savegames/"),
		MetaHost:             envStr("PUBLITE_METAHOST", get("Config", "metahost", "localhost")),
		MetaPort:             envInt("PUBLITE_METAPORT", getInt("Config", "metaport", 8080)),
		StatusPort:           envInt("PUBLITE_STATUS_PORT", getInt("Config", "status_port", 4002)),
		InitialPort:          envInt("PUBLITE_INITIAL_PORT", getInt("Config", "initial_port", 6000)),
		CheckInterval:        envInt("PUBLITE_CHECK_INTERVAL", getInt("Config", "check_interval", 40)),
		FreecivxPort:         envInt("PUBLITE_FREECIVX_PORT", getInt("Config", "freecivx_port", 7800)),
		FreecivxMultiPort:    envInt("PUBLITE_FREECIVX_MULTI_PORT", getInt("Config", "freecivx_multi_port", 7802)),
		FreecivxSingleHexPort: envInt("PUBLITE_FREECIVX_SINGLE_HEX_PORT", getInt("Config", "freecivx_single_hex_port", 7804)),
		FreecivxMultiHexPort:  envInt("PUBLITE_FREECIVX_MULTI_HEX_PORT", getInt("Config", "freecivx_multi_hex_port", 7806)),
	}, nil
}
