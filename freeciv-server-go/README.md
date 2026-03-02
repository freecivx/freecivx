# freeciv-server-go

freeciv-server-go is a Go wrapper around the Freeciv C server. It hosts the server's main loop inside the Go runtime and exposes HTTP and WebSocket endpoints for web clients to interact with the game.

## Features

* **WebSocket endpoint** (`/ws`) – upgrades HTTP connections to WebSocket, sends an initial player-list greeting, and echoes subsequent messages.
* **Player list endpoint** (`/players`) – returns the current player list as plain text, one name per line.
* **Status endpoint** (`/status`) – returns a JSON document with server health information: uptime, number of connected WebSocket clients, and the current player list.
* **Graceful shutdown** – handles `SIGTERM` and `SIGINT`, draining active connections within a configurable timeout.
* **INI-based configuration** with environment-variable overrides.
* **Structured logging** via `log/slog` at a configurable level.

## Build

### Stub build (no C compiler required)

Useful for iterating on Go code and running tests without a Freeciv C library:

```bash
cd freeciv-server-go
make build-stub
```

### Full build (links against Freeciv C libraries)

Requires a configured and compiled Freeciv tree at `../freeciv`:

```bash
cd ../freeciv/freeciv && ./autogen.sh && ./configure && make
cd ../../freeciv-server-go
make build
```

See the [Makefile](Makefile) for additional options such as `FREECIV_PREFIX`.

## Configuration

Copy the configuration template and edit it:

```bash
cp settings.ini.dist settings.ini
# Edit settings.ini with your preferred settings
```

### Configuration file (`settings.ini`)

```ini
[Config]
# Address (host:port) the server listens on.
listen_addr = :8080

# Logging level: DEBUG, INFO, WARN, ERROR
log_level = INFO

# Path for the log file (stdout is always used as well).
log_file = ../logs/freeciv-server-go.log
```

### Environment variable overrides

| Variable | Config key | Default |
|---|---|---|
| `FREECIV_SERVER_ADDR` | `listen_addr` | `:8080` |
| `FREECIV_SERVER_LOG_LEVEL` | `log_level` | `INFO` |
| `FREECIV_SERVER_LOG_FILE` | `log_file` | `../logs/freeciv-server-go.log` |

## Usage

### Via run.sh (recommended)

```bash
cd freeciv-server-go
./run.sh
```

`run.sh` builds the stub binary if it is not already present and starts the server with `nohup`, redirecting output to `../logs/freeciv-server-go.log`.

### Manually

```bash
./freeciv-server-go-stub -settings settings.ini
```

### Command-line flags

```
-settings <path>    Path to settings.ini (default: settings.ini)
-log-level <level>  Logging level override: DEBUG, INFO, WARN, ERROR
```

The `-log-level` flag takes precedence over the value in `settings.ini`.

## HTTP Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/ws` | `GET` (WebSocket upgrade) | WebSocket connection; sends initial player list, then echoes messages |
| `/players` | `GET` | Current player list, one name per line (plain text) |
| `/status` | `GET` | JSON health document |

### `/status` response example

```json
{
  "status": "ok",
  "uptime_seconds": 42.7,
  "connected_clients": 2,
  "players": ["Alice", "Bob"]
}
```

## Tests

```bash
cd freeciv-server-go
make test
```

Tests run in stub mode (no C compiler or Freeciv libraries needed).

## Requirements

* Go 1.22 or higher
* C compiler + Freeciv C libraries (only for the full `make build` target)
