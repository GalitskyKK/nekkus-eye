//go:build !windows

package monitor

import "os/exec"

func setProcessNoWindow(cmd *exec.Cmd) {}
