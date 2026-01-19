Freeciv-web Publite2   
====================

Publite2 is a process manager which launches multiple Freeciv-web servers
depending on demand reported by the Metaserver. It requires the Freeciv-web
webapplication to be already running on Tomcat to work. 

Publite2 also launches one websockify instance for each Freeciv C server.

Publite2 is started automatically by the start-freeciv-web.sh script.

## Requirements

- Python 3.8 or higher
- Freeciv C server built for Freeciv-web
- websockify (for WebSocket proxy)
- tornado (for status page)

## Installation

Install Python dependencies:
```bash
pip install -r requirements.txt
```

## Configuration

Copy the configuration template and edit it:
```bash
cp settings.ini.dist settings.ini
# Edit settings.ini with your preferred settings
```

## Usage

Publite2 is typically started via the main startup script:
```bash
../scripts/start-freeciv-web.sh
```

Or manually:
```bash
cd publite2
./run.sh
```

## Logging

This process logs to:
- `logs/publite2.log` - Main process log
- `logs/freeciv-web-log-<port>.log` - Individual server logs
- `logs/freeciv-web-stderr-<port>.log` - Server error logs
- `logs/freeciv-proxy-<port>.log` - Websockify proxy logs

## Status Page

Publite2 has an HTTP status page which can be accessed at:
- http://localhost/pubstatus (through nginx)
- http://localhost:4002/pubstatus (direct access)

## Security

Publite2 has been hardened with the following security measures:
- Input validation for all external inputs (metaserver paths, etc.)
- HTML escaping in status pages to prevent XSS
- Absolute paths for logs to prevent path traversal
- Proper file handle management to prevent resource leaks
- HTTP timeouts to prevent hanging connections
- Thread-safe access to shared data structures

