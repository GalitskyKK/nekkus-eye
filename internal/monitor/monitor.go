package monitor

import (
	"context"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/mem"
)

// Stats — снимок системных метрик для виджетов и API.
type Stats struct {
	CPUPercent    float64 `json:"cpu_percent"`
	MemoryPercent float64 `json:"memory_percent"`
	MemoryUsedMB  uint64  `json:"memory_used_mb"`
	MemoryTotalMB uint64  `json:"memory_total_mb"`
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

	v, err := mem.VirtualMemory()
	memPct := 0.0
	memUsed := uint64(0)
	memTotal := uint64(0)
	if err == nil {
		memPct = v.UsedPercent
		memUsed = v.Used / (1024 * 1024)
		memTotal = v.Total / (1024 * 1024)
	}

	c.mu.Lock()
	c.last = Stats{
		CPUPercent:    cpuPct,
		MemoryPercent: memPct,
		MemoryUsedMB:  memUsed,
		MemoryTotalMB: memTotal,
		Timestamp:     time.Now().Unix(),
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
		Timestamp:     time.Now().Unix(),
	}, nil
}
