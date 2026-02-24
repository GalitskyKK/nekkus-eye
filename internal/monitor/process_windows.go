//go:build windows

package monitor

import (
	"os/exec"
	"syscall"
)

func setProcessNoWindow(cmd *exec.Cmd) {
	if cmd != nil {
		if cmd.SysProcAttr == nil {
			cmd.SysProcAttr = &syscall.SysProcAttr{}
		}
		cmd.SysProcAttr.HideWindow = true
	}
}
