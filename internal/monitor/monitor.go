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
	// CPU
	CPUPercent     float64 `json:"cpu_percent"`
	CPUModelName   string  `json:"cpu_model_name,omitempty"`
	CPUMhz         float64 `json:"cpu_mhz,omitempty"`
	CPUCores       int     `json:"cpu_cores,omitempty"`        // логические ядра
	CPUPhysicalCores int   `json:"cpu_physical_cores,omitempty"` // физические ядра
	// Память
	MemoryPercent  float64 `json:"memory_percent"`
	MemoryUsedMB   uint64  `json:"memory_used_mb"`
	MemoryTotalMB  uint64  `json:"memory_total_mb"`
	MemoryFreeMB   uint64  `json:"memory_free_mb,omitempty"`
	MemoryAvailableMB uint64 `json:"memory_available_mb,omitempty"`
	SwapTotalMB    uint64  `json:"swap_total_mb,omitempty"`
	SwapUsedMB     uint64  `json:"swap_used_mb,omitempty"`
	SwapFreeMB     uint64  `json:"swap_free_mb,omitempty"`
	// Диск
	DiskPercent    float64 `json:"disk_percent"`
	DiskUsedGB     uint64  `json:"disk_used_gb"`
	DiskTotalGB    uint64  `json:"disk_total_gb"`
	DiskFreeGB     uint64  `json:"disk_free_gb,omitempty"`
	DiskPath       string  `json:"disk_path,omitempty"`
	// GPU
	GPUPercent       float64 `json:"gpu_percent,omitempty"`
	GPUName          string  `json:"gpu_name,omitempty"`
	GPUTempC         int     `json:"gpu_temp_c,omitempty"`
	GPUMemoryUsedMB  uint64  `json:"gpu_memory_used_mb,omitempty"`
	GPUMemoryTotalMB uint64  `json:"gpu_memory_total_mb,omitempty"`
	// Система
	Hostname     string `json:"hostname,omitempty"`
	Platform     string `json:"platform,omitempty"`      // windows / linux / darwin
	OS           string `json:"os,omitempty"`           // Windows 10, Ubuntu, etc.
	KernelArch   string `json:"kernel_arch,omitempty"`   // amd64, arm64
	KernelVersion string `json:"kernel_version,omitempty"`
	UptimeSec    uint64 `json:"uptime_sec"`
	ProcessCount int    `json:"process_count"`
	// Сеть
	NetBytesSent uint64 `json:"net_bytes_sent,omitempty"`
	NetBytesRecv uint64 `json:"net_bytes_recv,omitempty"`
	Timestamp    int64  `json:"timestamp"`
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
	cpuCores := 0
	cpuPhysicalCores := 0
	if infos, err := cpu.Info(); err == nil && len(infos) > 0 {
		cpuModelName = infos[0].ModelName
		cpuMhz = infos[0].Mhz
		for _, info := range infos {
			if info.Cores > 0 {
				cpuCores += int(info.Cores)
			}
		}
	}
	if logical, err := cpu.Counts(true); err == nil && logical > 0 {
		cpuCores = logical
	}
	if physical, err := cpu.Counts(false); err == nil && physical > 0 {
		cpuPhysicalCores = physical
	}

	v, err := mem.VirtualMemory()
	memPct := 0.0
	memUsed := uint64(0)
	memTotal := uint64(0)
	memFree := uint64(0)
	memAvailable := uint64(0)
	if err == nil {
		memPct = v.UsedPercent
		memUsed = v.Used / (1024 * 1024)
		memTotal = v.Total / (1024 * 1024)
		memFree = v.Free / (1024 * 1024)
		memAvailable = v.Available / (1024 * 1024)
	}

	swapTotal := uint64(0)
	swapUsed := uint64(0)
	swapFree := uint64(0)
	if sw, err := mem.SwapMemory(); err == nil {
		swapTotal = sw.Total / (1024 * 1024)
		swapUsed = sw.Used / (1024 * 1024)
		swapFree = sw.Free / (1024 * 1024)
	}

	diskPct := 0.0
	diskUsedGB := uint64(0)
	diskTotalGB := uint64(0)
	diskFreeGB := uint64(0)
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
		diskFreeGB = usage.Free / (1024 * 1024 * 1024)
	}

	hostname := ""
	platform := ""
	osName := ""
	kernelArch := ""
	kernelVersion := ""
	uptimeSec := uint64(0)
	if hi, err := host.Info(); err == nil {
		hostname = hi.Hostname
		platform = hi.Platform
		if hi.PlatformVersion != "" {
			osName = hi.Platform + " " + hi.PlatformVersion
		} else {
			osName = hi.Platform
		}
		kernelArch = hi.KernelArch
		kernelVersion = hi.KernelVersion
		uptimeSec = hi.Uptime
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
		CPUPercent:        cpuPct,
		CPUModelName:      cpuModelName,
		CPUMhz:            cpuMhz,
		CPUCores:          cpuCores,
		CPUPhysicalCores:  cpuPhysicalCores,
		MemoryPercent:     memPct,
		MemoryUsedMB:      memUsed,
		MemoryTotalMB:     memTotal,
		MemoryFreeMB:      memFree,
		MemoryAvailableMB: memAvailable,
		SwapTotalMB:       swapTotal,
		SwapUsedMB:        swapUsed,
		SwapFreeMB:        swapFree,
		DiskPercent:       diskPct,
		DiskUsedGB:        diskUsedGB,
		DiskTotalGB:       diskTotalGB,
		DiskFreeGB:        diskFreeGB,
		DiskPath:          diskPath,
		GPUPercent:        gpu.UtilPercent,
		GPUName:           gpu.Name,
		GPUTempC:          gpu.TempC,
		GPUMemoryUsedMB:   gpu.MemoryUsedMB,
		GPUMemoryTotalMB:  gpu.MemoryTotalMB,
		Hostname:          hostname,
		Platform:          platform,
		OS:                osName,
		KernelArch:        kernelArch,
		KernelVersion:     kernelVersion,
		UptimeSec:         uptimeSec,
		ProcessCount:      processCount,
		NetBytesSent:      netSent,
		NetBytesRecv:      netRecv,
		Timestamp:         time.Now().Unix(),
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
