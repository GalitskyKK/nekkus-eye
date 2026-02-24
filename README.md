# Nekkus Eye

> System monitor: CPU, memory. Part of the Nekkus ecosystem.

MVP модуль мониторинга системы (CPU %, память). Standalone окно + tray, интеграция с Hub по gRPC.

## Сборка

Требуется **CGO** (nekkus-core использует webview для окна).

```bash
# Локально (из корня nekkus)
go work use ./nekkus-eye   # если ещё не добавлен в go.work

# Установить зависимости фронта
cd frontend && npm install && npm run build && cd ..

# Сборка бинарника
go build -o bin/nekkus-eye ./cmd   # Linux/macOS
go build -o bin/nekkus-eye.exe ./cmd   # Windows

# Или через Task
task ui:build
task build:go
```

## Папка com.nekkus.eye (для Hub)

При релизе по тегу `v*` GitHub Actions собирает под каждую ОС архив с папкой **com.nekkus.eye**: внутри бинарник и `manifest.json`.

Локально можно собрать так:

```bash
task build
mkdir -p dist/com.nekkus.eye
cp bin/nekkus-eye dist/com.nekkus.eye/   # или nekkus-eye.exe на Windows
sed 's/"version": "0.0.0"/"version": "0.1.0"/' manifest.json.template > dist/com.nekkus.eye/manifest.json
```

На Windows без `sed`: скопируйте `manifest.json.template` в `dist/com.nekkus.eye/manifest.json` и замените `"version": "0.0.0"` на нужную версию.

## Dev-режим (проверка модуля)

Если **Task не установлен**, используйте команды ниже напрямую.

**Вариант 1: только бэкенд (API)**  
Один терминал — Go-сервер без окна:

```bash
cd nekkus-eye
go run ./cmd/ --port 9002 --headless
# Или с Task: task dev
# Сервер на http://localhost:9002
```

**Вариант 2: фронт с hot reload**  
Два терминала:

1. **Терминал 1** — бэкенд (обязательно запустить первым):
   ```bash
   cd nekkus-eye
   go run ./cmd/ --port 9002 --headless
   ```

2. **Терминал 2** — Vite:
   ```bash
   cd nekkus-eye/frontend
   npm install   # один раз
   npm run dev
   ```

3. Открыть в браузере **http://localhost:5173**. Запросы к `/api/*` Vite проксирует на `:9002`.

**Вариант 3: как у пользователя (окно + трей)**  
Собрать фронт один раз и запустить бинарник:

```bash
task build
task run
# Или: ./bin/nekkus-eye  (откроется окно и трей)
```

HTTP: 9002, gRPC: 19002.

## Запуск (production)

```bash
./bin/nekkus-eye
# или
./bin/nekkus-eye --port 9002 --headless
```

## Иконка

По умолчанию в трее используется минимальный 1×1 PNG. Свою иконку: положите `icon.png` в `assets/` и в `assets/icons.go` замените использование `minimalPNG` на `//go:embed icon.png` и `var TrayIcon = TrayIconPNG` (как в nekkus-net).
