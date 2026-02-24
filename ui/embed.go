package ui

import "embed"

// Содержимое frontend/dist. Для сборки: соберите фронт в ui/frontend/dist
// (локально: cd frontend && npm run build; в CI копируют в ui/frontend/dist).
//go:embed all:frontend/dist
var Assets embed.FS
