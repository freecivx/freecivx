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

## Elo Rating System

The Elo implementation lives in `elo.go` and uses the following rules.

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `eloK` | 32 | K-factor – maximum rating change per pairing |
| `eloDefault` | 1200 | Starting rating for players with no stored rating |
| Rating floor | 100 | A player's rating is never allowed to fall below 100 |

### Expected Score

For two players with ratings *a* and *b*, the expected score for the player
rated *a* is:

```
E(a, b) = 1 / (1 + 10^((b - a) / 400))
```

This is the standard Elo formula.  The exponent is computed using the natural
logarithm (`ln10 ≈ 2.3026`) so that `10^x = e^(x · ln10)`.

### Pairwise Delta Accumulation (`calculateEloChanges`)

Each winner is paired against each loser.  For every winner *w* and loser *l*:

```
delta[w] += K × (1 - E(w, l))   // actual score = 1 (win)
delta[l] += K × (0 - E(l, w))   // actual score = 0 (loss)
```

After all pairings are processed, every player's new rating is:

```
new_rating = round(base_rating + delta[player])
```

clamped to a minimum of **100** and rounded to the nearest integer.

This approach rewards beating many strong opponents more than beating one weak
opponent, while penalising losses to many weak opponents more heavily.

### Example

Alice (1200) and Bob (1300) are the only winner and loser:

* `E(Alice, Bob) = 1 / (1 + 10^(100/400)) ≈ 0.360`
* `E(Bob, Alice) = 1 / (1 + 10^(-100/400)) ≈ 0.640`
* `delta[Alice] = 32 × (1 - 0.360) ≈ +20.5` → new rating **1220**
* `delta[Bob]   = 32 × (0 - 0.640) ≈ -20.5` → new rating **1280**

## Requirements

* **Database:** Requires the game_results table (see V1_19__add_game_results.sql).
* **Go:** Built and run using the Go toolchain.
