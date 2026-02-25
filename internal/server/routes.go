package server

import (
	"encoding/json"
	"net/http"
	"strconv"

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
		topProcs, _ := monitor.ListTopProcessesByCPU(5)
		var resp map[string]interface{}
		if b, err := json.Marshal(stats); err == nil && json.Unmarshal(b, &resp) == nil {
			resp["top_processes"] = topProcs
		} else {
			resp = map[string]interface{}{"timestamp": stats.Timestamp, "top_processes": topProcs}
		}
		_ = json.NewEncoder(w).Encode(resp)
	})

	srv.Mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		setCORS(w)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	srv.Mux.HandleFunc("GET /api/processes", func(w http.ResponseWriter, r *http.Request) {
		setCORS(w)
		w.Header().Set("Content-Type", "application/json")
		limit := 200
		if l := r.URL.Query().Get("limit"); l != "" {
			if n, err := strconv.Atoi(l); err == nil && n > 0 {
				limit = n
			}
		}
		q := r.URL.Query().Get("q")
		withMetrics := r.URL.Query().Get("with_metrics") == "1" || r.URL.Query().Get("with_metrics") == "true"
		list, err := monitor.ListProcesses(limit, q, withMetrics)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(list)
	})

	srv.Mux.HandleFunc("POST /api/processes/kill", func(w http.ResponseWriter, r *http.Request) {
		setCORS(w)
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "OPTIONS" {
			return
		}
		var body struct {
			PID int32 `json:"pid"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
			return
		}
		if body.PID <= 0 {
			http.Error(w, `{"error":"invalid pid"}`, http.StatusBadRequest)
			return
		}
		if err := monitor.KillProcess(body.PID); err != nil {
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	})
}
