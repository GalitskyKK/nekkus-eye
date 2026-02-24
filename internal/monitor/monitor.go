package monitor

import (
	"context"
	"os"
	"runtime"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"
)

// Stats — снимок системных метрик для виджетов и API.
type Stats struct {
	CPUPercent    float64 `json:"cpu_percent"`
	CPUModelName  string  `json:"cpu_model_name,omitempty"`
	CPUMhz        float64 `json:"cpu_mhz,omitempty"`
	MemoryPercent float64 `json:"memory_percent"`
	MemoryUsedMB  uint64  `json:"memory_used_mb"`
	MemoryTotalMB uint64  `json:"memory_total_mb"`
	DiskPercent   float64 `json:"disk_percent"`
	DiskUsedGB    uint64  `json:"disk_used_gb"`
	DiskTotalGB   uint64  `json:"disk_total_gb"`
	GPUPercent       float64 `json:"gpu_percent,omitempty"`
	GPUName          string  `json:"gpu_name,omitempty"`
	GPUTempC         int     `json:"gpu_temp_c,omitempty"`
	GPUMemoryUsedMB  uint64  `json:"gpu_memory_used_mb,omitempty"`
	GPUMemoryTotalMB uint64  `json:"gpu_memory_total_mb,omitempty"`
	UptimeSec        uint64  `json:"uptime_sec"`
	ProcessCount  int     `json:"process_count"`
	NetBytesSent  uint64  `json:"net_bytes_sent,omitempty"`
	NetBytesRecv  uint64  `json:"net_bytes_recv,omitempty"`
	Timestamp     int64   `json:"timestamp"`
}

// Collector собирает CPU/memory с кэшем и периодическим обновлением.
type Collector struct {
	mu     sync.RWMutex
	last   Stats
	ticker *time.Ticker
	stop   chan struct{}
}

// NewCollector создаёт коллектор и запускает фоновое обновление раз в interval.
func NewCollector(interval time.Duration) *Collector {
	c := &Collector{stop: make(chan struct{})}
	c.ticker = time.NewTicker(interval)
	go c.loop()
	return c
}

func (c *Collector) loop() {
	c.collect()
	for {
		select {
		case <-c.stop:
			c.ticker.Stop()
			return
		case <-c.ticker.C:
			c.collect()
		}
	}
}

func (c *Collector) collect() {
	percents, err := cpu.Percent(0, false)
	cpuPct := 0.0
	if err == nil && len(percents) > 0 {
		cpuPct = percents[0]
	}

	cpuModelName := ""
	cpuMhz := 0.0
	if infos, err := cpu.Info(); err == nil && len(infos) > 0 {
		cpuModelName = infos[0].ModelName
		cpuMhz = infos[0].Mhz
	}

	v, err := mem.VirtualMemory()
	memPct := 0.0
	memUsed := uint64(0)
	memTotal := uint64(0)
	if err == nil {
		memPct = v.UsedPercent
		memUsed = v.Used / (1024 * 1024)
		memTotal = v.Total / (1024 * 1024)
	}

	diskPct := 0.0
	diskUsedGB := uint64(0)
	diskTotalGB := uint64(0)
	diskPath := "/"
	if runtime.GOOS == "windows" {
		drive := os.Getenv("SystemDrive")
		if drive == "" {
			drive = "C:"
		}
		diskPath = drive + "\\"
	}
	if usage, err := disk.Usage(diskPath); err == nil && usage != nil {
		diskPct = usage.UsedPercent
		diskUsedGB = usage.Used / (1024 * 1024 * 1024)
		diskTotalGB = usage.Total / (1024 * 1024 * 1024)
	}

	uptimeSec := uint64(0)
	if up, err := host.Uptime(); err == nil {
		uptimeSec = up
	}

	processCount := 0
	if pids, err := process.Pids(); err == nil {
		processCount = len(pids)
	}

	gpu := getGPUStats()

	netSent := uint64(0)
	netRecv := uint64(0)
	if counters, err := net.IOCounters(false); err == nil && len(counters) > 0 {
		netSent = counters[0].BytesSent
		netRecv = counters[0].BytesRecv
	}

	c.mu.Lock()
	c.last = Stats{
		CPUPercent:       cpuPct,
		CPUModelName:     cpuModelName,
		CPUMhz:           cpuMhz,
		MemoryPercent:    memPct,
		MemoryUsedMB:     memUsed,
		MemoryTotalMB:    memTotal,
		DiskPercent:      diskPct,
		DiskUsedGB:       diskUsedGB,
		DiskTotalGB:      diskTotalGB,
		GPUPercent:       gpu.UtilPercent,
		GPUName:          gpu.Name,
		GPUTempC:         gpu.TempC,
		GPUMemoryUsedMB:  gpu.MemoryUsedMB,
		GPUMemoryTotalMB: gpu.MemoryTotalMB,
		UptimeSec:        uptimeSec,
		ProcessCount:     processCount,
		NetBytesSent:     netSent,
		NetBytesRecv:     netRecv,
		Timestamp:        time.Now().Unix(),
	}
	c.mu.Unlock()
}

// Get возвращает последний снимок метрик.
func (c *Collector) Get() Stats {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.last
}

// Stop останавливает фоновое обновление. Вызывать при выходе из приложения.
func (c *Collector) Stop() {
	close(c.stop)
}

// CollectOnce собирает метрики один раз (для API без фонового коллектора).
func CollectOnce(ctx context.Context) (Stats, error) {
	percents, err := cpu.PercentWithContext(ctx, 0, false)
	cpuPct := 0.0
	if err == nil && len(percents) > 0 {
		cpuPct = percents[0]
	}

	v, err := mem.VirtualMemoryWithContext(ctx)
	memPct := 0.0
	memUsed := uint64(0)
	memTotal := uint64(0)
	if err == nil {
		memPct = v.UsedPercent
		memUsed = v.Used / (1024 * 1024)
		memTotal = v.Total / (1024 * 1024)
	}

	return Stats{
		CPUPercent:    cpuPct,
		MemoryPercent: memPct,
		MemoryUsedMB:  memUsed,
		MemoryTotalMB: memTotal,
		// Остальные метрики — в режиме CollectOnce не критичны для модуля; при необходимости можно расширить.
		Timestamp:     time.Now().Unix(),
	}, nil
}
