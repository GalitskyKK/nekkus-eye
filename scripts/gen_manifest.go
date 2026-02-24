//go:build ignore

package main

import (
	"os"
	"path/filepath"
	"strings"
)

func main() {
	if len(os.Args) < 3 {
		os.Exit(1)
	}
	outDir := os.Args[1]
	version := os.Args[2]
	tpl, err := os.ReadFile("manifest.json.template")
	if err != nil {
		os.Exit(2)
	}
	replaced := strings.Replace(string(tpl), `"version": "0.0.0"`, `"version": "`+version+`"`, 1)
	outPath := filepath.Join(outDir, "manifest.json")
	if err := os.WriteFile(outPath, []byte(replaced), 0644); err != nil {
		os.Exit(3)
	}
}
