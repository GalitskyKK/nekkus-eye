package monitor

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/shirou/gopsutil/v3/process"
)

// ProcessInfo — краткая информация о процессе для API.
type ProcessInfo struct {
	PID    int32  `json:"pid"`
	Name   string `json:"name"`
	RSSMB  uint64 `json:"rss_mb,omitempty"`
	Status string `json:"status,omitempty"`
}

// ListProcesses возвращает список процессов. limit — макс. количество, query — фильтр по имени (подстрока).
func ListProcesses(limit int, query string) ([]ProcessInfo, error) {
	if limit <= 0 {
		limit = 200
	}
	if limit > 500 {
		limit = 500
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
		out = append(out, info)
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
