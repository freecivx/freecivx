package main

import (
	"fmt"
	"html"
	"log/slog"
	"net/http"
)

// startPubStatus starts the HTTP status server and blocks until it fails.
func startPubStatus(mc *MetaChecker) {
	mux := http.NewServeMux()
	mux.HandleFunc("/pubstatus", func(w http.ResponseWriter, r *http.Request) {
		handlePubStatus(w, r, mc)
	})
	addr := fmt.Sprintf(":%d", mc.config.StatusPort)
	slog.Info("PubStatus server listening", "port", mc.config.StatusPort)
	if err := http.ListenAndServe(addr, mux); err != nil {
		slog.Error("PubStatus server error", "error", err)
	}
}

func handlePubStatus(w http.ResponseWriter, _ *http.Request, mc *MetaChecker) {
	mc.serversMu.Lock()
	servers := make([]*CivLauncher, len(mc.servers))
	copy(servers, mc.servers)
	mc.serversMu.Unlock()

	var gameCount, errorCount int
	for _, s := range servers {
		gameCount += s.NumStart
		errorCount += s.NumError
	}
	var errorRate float64
	if gameCount > 0 {
		errorRate = float64(errorCount) * 100.0 / float64(gameCount)
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `<html>
<head>
    <title>publite-go status for Freecivx</title>
    <link href='/css/bootstrap.min.css' rel='stylesheet'>
    <meta http-equiv="refresh" content="20">
    <style>td { padding: 2px; }</style>
</head>
<body>
    <div class='container'>
        <h2>FreecivX publite-go Status</h2>
        <table>
            <tr><td>Number of Freeciv-web games run:</td><td>%d</td></tr>
            <tr><td>Server limit (maximum number of running servers):</td><td>%d</td></tr>
            <tr><td>Server capacity:</td><td>%d, %d</td></tr>
            <tr><td>Number of servers running according to publite-go:</td><td>%d</td></tr>
            <tr><td>Number of servers running according to metaserver:</td><td>%d</td></tr>
            <tr><td>Available single-player pregame servers on metaserver:</td><td>%d</td></tr>
            <tr><td>Available multi-player pregame servers on metaserver:</td><td>%d</td></tr>
            <tr><td>Number of HTTP checks against metaserver:</td><td>%d</td></tr>
            <tr><td>Last response from metaserver:</td><td>%s</td></tr>
            <tr><td>Last HTTP status from metaserver:</td><td>%d</td></tr>
            <tr><td>Number of Freeciv servers stopped by error:</td><td>%d (%.2f%%)</td></tr>
        </table>
        <h3>Running Freeciv-web servers:</h3>
        <table>
            <tr>
                <td>Server Port</td><td>Type</td><td>Started Time</td><td>Restarts</td><td>Errors</td>
            </tr>
`,
		gameCount,
		mc.config.ServerLimit,
		mc.config.ServerCapacitySingle, mc.config.ServerCapacityMulti,
		len(servers),
		mc.total,
		mc.single,
		mc.multi,
		mc.checkCount,
		html.EscapeString(mc.htmlDoc),
		mc.lastHTTPStatus,
		errorCount, errorRate,
	)

	for _, s := range servers {
		fmt.Fprintf(w, "            <tr>\n                <td><a href='/civsocket/%d/status'>%d</a></td>\n                <td>%s</td>\n                <td>%s</td>\n                <td>%d</td>\n                <td>%d</td>\n            </tr>\n",
			s.Port+1000, s.Port,
			html.EscapeString(s.GameType),
			html.EscapeString(s.StartedTime),
			s.NumStart,
			s.NumError,
		)
	}

	fmt.Fprintf(w, "        </table>\n    </div>\n</body>\n</html>\n")
}
