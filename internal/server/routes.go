package server

import (
	"encoding/json"
	"net/http"

	coreserver "github.com/GalitskyKK/nekkus-core/pkg/server"
	"github.com/GalitskyKK/nekkus-eye/internal/monitor"
)

func setCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

// RegisterRoutes регистрирует API маршруты для nekkus-eye.
func RegisterRoutes(srv *coreserver.Server, collector *monitor.Collector) {
	srv.Mux.HandleFunc("GET /api/stats", func(w http.ResponseWriter, _ *http.Request) {
		setCORS(w)
		w.Header().Set("Content-Type", "application/json")
		stats := collector.Get()
		_ = json.NewEncoder(w).Encode(stats)
	})

	srv.Mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		setCORS(w)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
}
