package main

// eloK is the K-factor used for Elo rating updates.
const eloK = 32

// eloDefault is the starting Elo rating for new players.
const eloDefault = 1200

// ln10 is the natural logarithm of 10 used in the Elo expected-score formula.
const ln10 = 2.302585092994046

// expectedScore returns the expected score for a player with rating `a`
// against a player with rating `b`.
func expectedScore(a, b float64) float64 {
	return 1.0 / (1.0 + mathExp((b-a)/400.0*ln10))
}

// updateElo returns the new Elo rating for a player given their current rating,
// expected score, and actual score (1 = win, 0 = loss).
func updateElo(rating float64, expected, actual float64) int {
	updated := rating + eloK*(actual-expected)
	if updated < 100 {
		updated = 100
	}
	return int(updated + 0.5) // round to nearest integer
}

// calculateEloChanges computes new ratings for all winners and losers.
// It uses pairwise comparisons: each winner is compared against each loser.
// ratings is a map of username -> current Elo rating (0 means use default).
// Returns a map of username -> new Elo rating.
func calculateEloChanges(winners, losers []string, ratings map[string]int) map[string]int {
	// Collect effective ratings.
	effectiveRating := func(name string) float64 {
		if r, ok := ratings[name]; ok && r > 0 {
			return float64(r)
		}
		return float64(eloDefault)
	}

	// Accumulate delta per player from all pairings.
	delta := make(map[string]float64)

	for _, w := range winners {
		for _, l := range losers {
			wr := effectiveRating(w)
			lr := effectiveRating(l)

			eW := expectedScore(wr, lr)
			eL := expectedScore(lr, wr)

			delta[w] += eloK * (1.0 - eW)
			delta[l] += eloK * (0.0 - eL)
		}
	}

	result := make(map[string]int)
	allPlayers := append(append([]string{}, winners...), losers...)
	for _, p := range allPlayers {
		base := effectiveRating(p)
		newRating := base + delta[p]
		if newRating < 100 {
			newRating = 100
		}
		result[p] = int(newRating + 0.5)
	}
	return result
}
