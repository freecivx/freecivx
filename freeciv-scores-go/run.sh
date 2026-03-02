#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
LOG_DIR="${SCRIPT_DIR}/../logs"
LOG_FILE="${LOG_DIR}/freeciv-scores-go.log"
BINARY="${SCRIPT_DIR}/freeciv-scores-go"
SETTINGS="${SCRIPT_DIR}/settings.ini"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Check that settings.ini exists
if [ ! -f "$SETTINGS" ]; then
    echo "ERROR: settings.ini not found. Copy settings.ini.dist to settings.ini and update it."
    exit 1
fi

# Build the binary if it does not exist yet
if [ ! -f "$BINARY" ]; then
    echo "Building freeciv-scores-go..."
    cd "$SCRIPT_DIR"
    go build -o freeciv-scores-go . || { echo "Build failed"; exit 1; }
fi

# Start freeciv-scores-go with nohup and logging
cd "$SCRIPT_DIR"
nohup "$BINARY" -settings "$SETTINGS" > "$LOG_FILE" 2>&1 &

# Capture the PID of the process
PID=$!

# Wait briefly to ensure the binary starts
sleep 1

# Check if the process is still running
if ps -p "$PID" > /dev/null; then
    echo "freeciv-scores-go is running with PID $PID."
else
    echo "freeciv-scores-go failed to start. Check the log below:"
    tail -5 "$LOG_FILE"
fi
