# freeciv-scores-go

freeciv-scores-go is a backend daemon written in Go that implements an end-to-end Elo rating system for multiplayer Freeciv games. It monitors game logs, calculates player rankings, and persists results to the FreecivWorld database.

## Features

* **Automated Polling:** Scans the Freeciv ranklog directory on startup and every N seconds (default 60s).
* **Elo Calculation:** Pairwise Elo updates with K=32; default rating 1200, floor 100.
* **Database Persistence:** Writes results transactionally, including game_results rows and updates to player ratings.
* **File Management:** Parses winners and losers from ranklog files and renames processed files to .done.
* **Dual Logging:** Writes logs to both stdout and logs/freeciv-scores-go.log.

## How It Works

1. **Watch:** Monitors ~/freecivworld/ranklog/ranklog-game-<port>.score.
2. **Parse:** Extracts usernames from winners: and losers: lines.
3. **Calculate:** Fetches current ratings and runs pairwise updates.
4. **Persist:** Inserts game data and updates auth.elo_rating in one transaction.
5. **Cleanup:** Moves files to .done status upon successful database write.

## Configuration

Settings are managed via settings.ini or environment variable overrides:

* SCORES_DB_*: Database connection settings.
* SCORES_RANKLOG_DIR: Directory for ranklog score files.
* SCORES_POLL_INTERVAL: Ticker interval for polling.

See settings.ini.dist for a template.

## Requirements

* **Database:** Requires the game_results table (see V1_19__add_game_results.sql).
* **Go:** Built and run using the Go toolchain.
