#!/bin/bash
# run-stub.sh – build and start freeciv-server-go in stub mode (no C libraries).
# Useful for local development and testing without a compiled Freeciv tree.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
LOG_DIR="${SCRIPT_DIR}/../logs"
LOG_FILE="${LOG_DIR}/freeciv-server-go.log"
BINARY="${SCRIPT_DIR}/freeciv-server-go-stub"
SETTINGS="${SCRIPT_DIR}/settings.ini"

mkdir -p "$LOG_DIR"

echo "Building freeciv-server-go (stub mode)..."
cd "$SCRIPT_DIR"
CGO_ENABLED=0 go build -o "$BINARY" .
echo "Build complete."

if [ -f "$SETTINGS" ]; then
    nohup "$BINARY" -settings "$SETTINGS" > "$LOG_FILE" 2>&1 &
else
    nohup "$BINARY" > "$LOG_FILE" 2>&1 &
fi

PID=$!
sleep 1

if ps -p "$PID" > /dev/null; then
    echo "freeciv-server-go-stub is running with PID $PID."
    echo "Log: $LOG_FILE"
else
    echo "freeciv-server-go-stub failed to start. Check the log:"
    tail -5 "$LOG_FILE"
    exit 1
fi
