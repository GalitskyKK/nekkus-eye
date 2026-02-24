package monitor

import (
	"bufio"
	"bytes"
	"context"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// GPUStats — результат сбора метрик GPU.
type GPUStats struct {
	UtilPercent   float64
	Name          string
	TempC         int
	MemoryUsedMB  uint64
	MemoryTotalMB uint64
}

// getGPUStats возвращает загрузку первого GPU (%), название, температуру (°C) и видеопамять (МБ).
// Использует nvidia-smi (Windows/Linux с драйверами NVIDIA).
func getGPUStats() GPUStats {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "nvidia-smi",
		"--query-gpu=utilization.gpu,name,temperature.gpu,memory.used,memory.total",
		"--format=csv,noheader,nounits",
	)
	setProcessNoWindow(cmd)
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		return GPUStats{}
	}

	scanner := bufio.NewScanner(&out)
	if !scanner.Scan() {
		return GPUStats{}
	}
	line := strings.TrimSpace(scanner.Text())
	// Формат: "35, NVIDIA GeForce RTX 3060, 49, 2048, 12288" (util%, name, temp, mem_used_MiB, mem_total_MiB)
	parts := strings.Split(line, ", ")
	if len(parts) < 1 {
		return GPUStats{}
	}
	pctStr := strings.TrimSpace(parts[0])
	pctStr = strings.TrimSuffix(pctStr, "%")
	pct, _ := strconv.ParseFloat(strings.TrimSpace(pctStr), 64)
	name := ""
	if len(parts) > 1 {
		name = strings.TrimSpace(parts[1])
		name = strings.Trim(name, `"`)
	}
	temp := 0
	if len(parts) > 2 {
		tempStr := strings.TrimSpace(parts[2])
		tempStr = strings.TrimSuffix(tempStr, " C")
		if t, err := strconv.Atoi(strings.TrimSpace(tempStr)); err == nil {
			temp = t
		}
	}
	memUsed := uint64(0)
	memTotal := uint64(0)
	if len(parts) > 3 {
		memUsed, _ = parseMiB(parts[3])
	}
	if len(parts) > 4 {
		memTotal, _ = parseMiB(parts[4])
	}
	return GPUStats{
		UtilPercent:   pct,
		Name:          name,
		TempC:         temp,
		MemoryUsedMB:  memUsed,
		MemoryTotalMB: memTotal,
	}
}

func parseMiB(s string) (uint64, error) {
	s = strings.TrimSpace(s)
	s = strings.TrimSuffix(s, " MiB")
	return strconv.ParseUint(s, 10, 64)
}
