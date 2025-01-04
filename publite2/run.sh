#!/bin/bash

export FREECIV_SAVE_PATH=/var/lib/tomcat11/webapps/data/savegames/;

# Variables
SCRIPT="publite2.py"
LOG_DIR="../logs"
LOG_FILE="$LOG_DIR/publite2.log"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Start the Python script with nohup and logging
nohup python3 -u "$SCRIPT" > "$LOG_FILE" 2>&1 &

# Capture the PID of the process
PID=$!

# Wait briefly to ensure the script starts
sleep 1

# Check if the process is still running
if ps -p $PID > /dev/null; then
    echo "Script $SCRIPT is running with PID $PID."
else
    echo "Script $SCRIPT failed to start. Check the log below:"
    tail -5 "$LOG_FILE"
fi
