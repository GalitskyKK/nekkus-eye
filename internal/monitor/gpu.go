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

// getGPUStats возвращает загрузку первого GPU (%), название и температуру (°C).
// Использует nvidia-smi (Windows/Linux с драйверами NVIDIA).
// Если nvidia-smi недоступен или ошибка — возвращает 0, "", 0.
func getGPUStats() (float64, string, int) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "nvidia-smi",
		"--query-gpu=utilization.gpu,name,temperature.gpu",
		"--format=csv,noheader,nounits",
	)
	setProcessNoWindow(cmd)
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		return 0, "", 0
	}

	scanner := bufio.NewScanner(&out)
	if !scanner.Scan() {
		return 0, "", 0
	}
	line := strings.TrimSpace(scanner.Text())
	// Формат: "35, NVIDIA GeForce RTX 3060, 49" (utilization, name, temp)
	parts := strings.SplitN(line, ",", 3)
	if len(parts) < 1 {
		return 0, "", 0
	}
	pctStr := strings.TrimSpace(parts[0])
	pctStr = strings.TrimSuffix(pctStr, "%")
	pctStr = strings.TrimSpace(pctStr)
	pct, err := strconv.ParseFloat(pctStr, 64)
	if err != nil {
		return 0, "", 0
	}
	name := ""
	if len(parts) > 1 {
		name = strings.TrimSpace(parts[1])
		name = strings.Trim(name, `"`)
	}
	temp := 0
	if len(parts) > 2 {
		tempStr := strings.TrimSpace(parts[2])
		tempStr = strings.TrimSuffix(tempStr, " C")
		tempStr = strings.TrimSpace(tempStr)
		if t, err := strconv.Atoi(tempStr); err == nil {
			temp = t
		}
	}
	return pct, name, temp
}
