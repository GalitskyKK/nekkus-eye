package monitor

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	"github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"
)

// ProcessInfo — краткая информация о процессе для API.
type ProcessInfo struct {
	PID              int32   `json:"pid"`
	Name             string  `json:"name"`
	RSSMB            uint64  `json:"rss_mb,omitempty"`
	Status           string  `json:"status,omitempty"`
	CPUPercent       float64 `json:"cpu_percent,omitempty"`
	NetBytesSent     uint64  `json:"net_bytes_sent,omitempty"`
	NetBytesRecv     uint64  `json:"net_bytes_recv,omitempty"`
	ConnectionsCount int     `json:"connections_count,omitempty"`
}

// ListProcesses возвращает список процессов. limit — макс. количество, query — фильтр по имени (подстрока).
// withMetrics при true добавляет CPU%, сеть и соединения (медленнее, limit ограничивается 100).
func ListProcesses(limit int, query string, withMetrics bool) ([]ProcessInfo, error) {
	if limit <= 0 {
		limit = 200
	}
	if limit > 500 {
		limit = 500
	}
	if withMetrics && limit > 100 {
		limit = 100
	}
	procs, err := process.Processes()
	if err != nil {
		return nil, err
	}
	query = strings.TrimSpace(strings.ToLower(query))
	var out []ProcessInfo
	for _, p := range procs {
		if len(out) >= limit {
			break
		}
		name, _ := p.Name()
		if name == "" {
			if exe, err := p.Exe(); err == nil && exe != "" {
				name = filepath.Base(exe)
			}
			if name == "" {
				name = fmt.Sprintf("PID %d", p.Pid)
			}
		}
		if query != "" && !strings.Contains(strings.ToLower(name), query) {
			continue
		}
		info := ProcessInfo{PID: p.Pid, Name: name}
		if mem, err := p.MemoryInfo(); err == nil && mem != nil {
			info.RSSMB = mem.RSS / (1024 * 1024)
		}
		if status, err := p.Status(); err == nil && len(status) > 0 {
			info.Status = status[0]
		}
		if withMetrics {
			if pct, err := p.CPUPercent(); err == nil {
				info.CPUPercent = pct
			}
			// NetIOCounters per process есть в gopsutil v4; в v3 на Windows нет — оставляем 0.
			if conns, err := net.ConnectionsPid("all", p.Pid); err == nil {
				info.ConnectionsCount = len(conns)
			}
		}
		out = append(out, info)
	}
	return out, nil
}

// ListTopProcessesByCPU возвращает топ limit процессов по загрузке CPU (для виджета Hub).
func ListTopProcessesByCPU(limit int) ([]ProcessInfo, error) {
	if limit <= 0 {
		limit = 5
	}
	if limit > 20 {
		limit = 20
	}
	procs, err := process.Processes()
	if err != nil {
		return nil, err
	}
	type scored struct {
		info  ProcessInfo
		score float64
	}
	var scoredList []scored
	for _, p := range procs {
		name, _ := p.Name()
		if name == "" {
			if exe, err := p.Exe(); err == nil && exe != "" {
				name = filepath.Base(exe)
			}
			if name == "" {
				name = fmt.Sprintf("PID %d", p.Pid)
			}
		}
		pct, err := p.CPUPercent()
		if err != nil || pct <= 0 {
			continue
		}
		info := ProcessInfo{PID: p.Pid, Name: name, CPUPercent: pct}
		if mem, err := p.MemoryInfo(); err == nil && mem != nil {
			info.RSSMB = mem.RSS / (1024 * 1024)
		}
		scoredList = append(scoredList, scored{info: info, score: pct})
	}
	sort.Slice(scoredList, func(i, j int) bool { return scoredList[i].score > scoredList[j].score })
	out := make([]ProcessInfo, 0, limit)
	for i := 0; i < limit && i < len(scoredList); i++ {
		out = append(out, scoredList[i].info)
	}
	return out, nil
}

// KillProcess завершает процесс по PID. Возвращает ошибку при отказе или отсутствии процесса.
func KillProcess(pid int32) error {
	p, err := process.NewProcess(pid)
	if err != nil {
		return err
	}
	return p.Kill()
}
