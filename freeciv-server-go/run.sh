#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
LOG_DIR="${SCRIPT_DIR}/../logs"
LOG_FILE="${LOG_DIR}/freeciv-server-go.log"
BINARY="${SCRIPT_DIR}/freeciv-server-go"
SETTINGS="${SCRIPT_DIR}/settings.ini"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Build the binary if it does not exist yet
if [ ! -f "$BINARY" ]; then
    echo "Building freeciv-server-go..."
    cd "$SCRIPT_DIR"
    bash ./prepare_freeciv_server_go.sh || { echo "Build failed"; exit 1; }
fi

# Start freeciv-server-go with nohup and logging
cd "$SCRIPT_DIR"
if [ -f "$SETTINGS" ]; then
    nohup "$BINARY" -settings "$SETTINGS" > "$LOG_FILE" 2>&1 &
else
    nohup "$BINARY" > "$LOG_FILE" 2>&1 &
fi

# Capture the PID of the process
PID=$!

# Wait briefly to ensure the binary starts
sleep 1

# Check if the process is still running
if ps -p "$PID" > /dev/null; then
    echo "freeciv-server-go is running with PID $PID."
else
    echo "freeciv-server-go failed to start. Check the log below:"
    tail -5 "$LOG_FILE"
fi
