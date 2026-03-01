#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
LOG_DIR="${SCRIPT_DIR}/../logs"
LOG_FILE="${LOG_DIR}/publite-go.log"
BINARY="${SCRIPT_DIR}/publite-go"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Build the binary if it does not exist yet
if [ ! -f "$BINARY" ]; then
    echo "Building publite-go..."
    cd "$SCRIPT_DIR"
    go build -o publite-go . || { echo "Build failed"; exit 1; }
fi

# Start publite-go with nohup and logging
cd "$SCRIPT_DIR"
nohup "$BINARY" > "$LOG_FILE" 2>&1 &

# Capture the PID of the process
PID=$!

# Wait briefly to ensure the binary starts
sleep 1

# Check if the process is still running
if ps -p $PID > /dev/null; then
    echo "publite-go is running with PID $PID."
else
    echo "publite-go failed to start. Check the log below:"
    tail -5 "$LOG_FILE"
fi
