package main

import (
	"database/sql"
	"fmt"
	"log/slog"
	"strings"

	_ "github.com/go-sql-driver/mysql"
)

// openDB opens a MySQL connection using the provided Config.
func openDB(cfg *Config) (*sql.DB, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?parseTime=true",
		cfg.DBUser, cfg.DBPassword, cfg.DBHost, cfg.DBPort, cfg.DBName)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("opening DB: %w", err)
	}
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("pinging DB: %w", err)
	}
	return db, nil
}

// getPlayerRatings fetches the current elo_rating for each of the given usernames.
// Usernames not found in the database are omitted from the result map.
func getPlayerRatings(db *sql.DB, usernames []string) (map[string]int, error) {
	if len(usernames) == 0 {
		return map[string]int{}, nil
	}

	placeholders := make([]string, len(usernames))
	args := make([]interface{}, len(usernames))
	for i, u := range usernames {
		placeholders[i] = "?"
		args[i] = u
	}

	query := fmt.Sprintf(
		"SELECT username, COALESCE(elo_rating, 0) FROM auth WHERE username IN (%s)",
		strings.Join(placeholders, ","),
	)

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("querying ratings: %w", err)
	}
	defer rows.Close()

	ratings := make(map[string]int)
	for rows.Next() {
		var username string
		var rating int
		if err := rows.Scan(&username, &rating); err != nil {
			return nil, fmt.Errorf("scanning rating row: %w", err)
		}
		ratings[username] = rating
	}
	return ratings, rows.Err()
}

// saveGameResults inserts player rows into game_results and updates elo_rating
// in auth, all within a single transaction.
func saveGameResults(db *sql.DB, gameID int, winners, losers []string, newRatings map[string]int) error {
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("starting transaction: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	insertStmt, err := tx.Prepare(
		"INSERT INTO game_results (game_id, player, win, loss) VALUES (?, ?, ?, ?)",
	)
	if err != nil {
		return fmt.Errorf("preparing insert: %w", err)
	}
	defer insertStmt.Close()

	updateStmt, err := tx.Prepare(
		"UPDATE auth SET elo_rating = ? WHERE username = ?",
	)
	if err != nil {
		return fmt.Errorf("preparing update: %w", err)
	}
	defer updateStmt.Close()

	for _, w := range winners {
		if _, err = insertStmt.Exec(gameID, w, true, false); err != nil {
			return fmt.Errorf("inserting winner %s: %w", w, err)
		}
		if rating, ok := newRatings[w]; ok {
			if _, err = updateStmt.Exec(rating, w); err != nil {
				return fmt.Errorf("updating rating for %s: %w", w, err)
			}
			slog.Info("Updated Elo rating", "player", w, "new_rating", rating)
		}
	}

	for _, l := range losers {
		if _, err = insertStmt.Exec(gameID, l, false, true); err != nil {
			return fmt.Errorf("inserting loser %s: %w", l, err)
		}
		if rating, ok := newRatings[l]; ok {
			if _, err = updateStmt.Exec(rating, l); err != nil {
				return fmt.Errorf("updating rating for %s: %w", l, err)
			}
			slog.Info("Updated Elo rating", "player", l, "new_rating", rating)
		}
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}
	return nil
}

// nextGameID returns game_id = MAX(game_id) + 1 from game_results, or 1 if empty.
func nextGameID(db *sql.DB) (int, error) {
	var maxID sql.NullInt64
	row := db.QueryRow("SELECT MAX(game_id) FROM game_results")
	if err := row.Scan(&maxID); err != nil {
		return 0, fmt.Errorf("querying max game_id: %w", err)
	}
	if !maxID.Valid {
		return 1, nil
	}
	return int(maxID.Int64) + 1, nil
}
