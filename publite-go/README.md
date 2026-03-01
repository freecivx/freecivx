# publite-go

publite-go is a process manager written in Go that launches multiple Freeciv-web servers
depending on demand reported by the Metaserver. It requires the Freeciv-web web
application to be already running on Tomcat to work.

publite-go also launches one websockify instance for each Freeciv C server.

publite-go is started automatically by the start-freeciv-web.sh script.

## Requirements

- Go 1.24 or higher (for building)
- Freeciv C server built for Freeciv-web
- websockify (for WebSocket proxy)

## Installation

Build the binary:
```bash
cd publite-go
go build -o publite-go .
```

Or let `run.sh` build it automatically on first start.

## Configuration

Copy the configuration template and edit it:
```bash
cp settings.ini.dist settings.ini
# Edit settings.ini with your preferred settings
```

Environment variables override file settings:
- `PUBLITE_METAHOST`
- `PUBLITE_METAPORT`
- `PUBLITE_STATUS_PORT`
- `PUBLITE_INITIAL_PORT`
- `PUBLITE_CHECK_INTERVAL`

## Usage

publite-go is typically started via the main startup script:
```bash
../scripts/start-freeciv-web.sh
```

Or manually:
```bash
cd publite-go
./run.sh
```

## Command-line flags

```
--settings <path>   Path to settings.ini (default: settings.ini)
--log-level <level> Logging level: DEBUG, INFO, WARN, ERROR (default: INFO)
```

## Logging

This process logs to:
- `logs/publite-go.log` - Main process log
- `logs/freeciv-web-log-<port>.log` - Individual server logs
- `logs/freeciv-web-stderr-<port>.log` - Server error logs
- `logs/freeciv-proxy-<port>.log` - Websockify proxy logs

## Status Page

publite-go has an HTTP status page which can be accessed at:
- http://localhost/pubstatus (through nginx)
- http://localhost:4002/pubstatus (direct access)

## Security

publite-go includes the following security measures:
- Input validation for all external inputs (metaserver paths, etc.)
- HTML escaping in status pages to prevent XSS
- Absolute paths for logs to prevent path traversal
- HTTP timeouts to prevent hanging connections
- Goroutine-safe access to shared data structures
