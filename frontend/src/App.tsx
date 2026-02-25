import React, { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  AppShell,
  Button,
  Card,
  DataText,
  LineChart,
  MetricHero,
  PageLayout,
  Section,
  StatusDot,
} from '@nekkus/ui-kit'
import { fetchStats, fetchProcesses, killProcess, type Stats, type ProcessInfo } from './api'

const REFRESH_MS = 2000
const CHART_POINTS = 30
const CHART_HEIGHT = 160
const EYE_COLOR = '#10B981'
const EYE_NET_COLOR = '#3b82f6'

export type SectionId = 'cpu' | 'memory' | 'disk' | 'gpu' | 'network' | 'uptime' | 'processes'

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb} MB`
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} ГБ`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} МБ`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${bytes} Б`
}

function formatUptime(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}ч ${m}м`
  if (m > 0) return `${m}м ${s}с`
  return `${s}с`
}

function padHistory(history: number[], len: number): number[] {
  if (history.length >= len) return history.slice(-len)
  return [...Array(len - history.length).fill(0), ...history]
}

/** Ловит ошибки рендера в дочернем дереве (например в панели процессов) и показывает заглушку вместо белого экрана. */
class MonitoringErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="eye-detail" style={{ padding: 24 }}>
          <p style={{ color: 'var(--nekkus-muted)' }}>Ошибка отображения</p>
          <button type="button" onClick={() => this.setState({ hasError: false })}>Повторить</button>
        </div>
      )
    }
    return this.props.children
  }
}

interface ProcessesPanelProps {
  processCount: number
  processList: ProcessInfo[]
  processSearch: string
  setProcessSearch: (s: string) => void
  processLoading: boolean
  setProcessLoading: (v: boolean) => void
  setProcessList: Dispatch<SetStateAction<ProcessInfo[]>>
  processKilling: number | null
  setProcessKilling: (pid: number | null) => void
  processError: string | null
  setProcessError: (s: string | null) => void
}

function ProcessesPanel({
  processCount,
  processList,
  processSearch,
  setProcessSearch,
  processLoading,
  setProcessLoading,
  setProcessList,
  processKilling,
  setProcessKilling,
  processError,
  setProcessError,
}: ProcessesPanelProps) {
  const loadProcesses = useCallback(
    async (q: string) => {
      setProcessLoading(true)
      setProcessError(null)
      try {
        const list = await fetchProcesses({ q: q || undefined, limit: 200 })
        setProcessList(list)
      } catch (e) {
        setProcessError(e instanceof Error ? e.message : 'Ошибка загрузки')
        setProcessList([])
      } finally {
        setProcessLoading(false)
      }
    },
    [setProcessList, setProcessError]
  )

  useEffect(() => {
    const id = setTimeout(() => loadProcesses(processSearch), processSearch ? 300 : 0)
    return () => clearTimeout(id)
  }, [processSearch, loadProcesses])

  const handleKill = useCallback(
    async (pid: number) => {
      if (!window.confirm(`Завершить процесс ${pid}?`)) return
      setProcessKilling(pid)
      try {
        await killProcess(pid)
        setProcessList((prev) => prev.filter((p) => p.pid !== pid))
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'Ошибка')
      } finally {
        setProcessKilling(null)
      }
    },
    [setProcessList, setProcessKilling]
  )

  return (
    <div className="eye-detail">
      <div className="eye-detail-stats">
        <MetricHero value={String(processCount)} label="Процессов в системе" />
      </div>
      <div className="eye-processes-toolbar">
        <input
          type="search"
          className="eye-processes-search"
          placeholder="Поиск по имени процесса…"
          value={processSearch}
          onChange={(e) => setProcessSearch(e.target.value)}
          aria-label="Поиск по имени процесса"
        />
      </div>
      {processError && (
        <div className="eye-processes-error" role="alert">
          <DataText size="sm">{processError}</DataText>
          <button type="button" onClick={() => loadProcesses(processSearch)}>Повторить</button>
        </div>
      )}
      {processLoading ? (
        <DataText size="sm">Загрузка…</DataText>
      ) : !processError ? (
        <div className="eye-processes-list">
          {processList.length === 0 ? (
            <div className="eye-processes-empty">
              {(typeof processSearch === 'string' ? processSearch : '').trim()
                ? `Ничего не найдено по запросу «${(typeof processSearch === 'string' ? processSearch : '').trim()}»`
                : 'Нет процессов'}
            </div>
          ) : (
            processList.map((proc, idx) => (
              <div key={proc?.pid ?? idx} className="eye-processes-row">
                <span className="eye-processes-pid">{proc?.pid ?? '—'}</span>
                <span className="eye-processes-name" title={proc?.name ?? `PID ${proc?.pid ?? ''}`}>
                  {proc?.name && proc.name !== '?' ? proc.name : `PID ${proc?.pid ?? idx}`}
                </span>
                <span className="eye-processes-mem">
                  {proc?.rss_mb != null ? `${proc.rss_mb} MB` : '—'}
                </span>
                <button
                  type="button"
                  className="eye-processes-kill"
                  onClick={() => proc != null && handleKill(proc.pid)}
                  disabled={processKilling === (proc?.pid ?? null)}
                  aria-label={`Завершить процесс ${proc?.pid ?? ''}`}
                >
                  {processKilling === (proc?.pid ?? null) ? '…' : 'Завершить'}
                </button>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

export default function App() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cpuHistory, setCpuHistory] = useState<number[]>([])
  const [memHistory, setMemHistory] = useState<number[]>([])
  const [selectedSection, setSelectedSection] = useState<SectionId | null>(null)
  const [processList, setProcessList] = useState<ProcessInfo[]>([])
  const [processSearch, setProcessSearch] = useState('')
  const [processLoading, setProcessLoading] = useState(false)
  const [processKilling, setProcessKilling] = useState<number | null>(null)
  const [processError, setProcessError] = useState<string | null>(null)
  const [gpuHistory, setGpuHistory] = useState<number[]>([])
  const [diskHistory, setDiskHistory] = useState<number[]>([])
  const [netSentRateHistory, setNetSentRateHistory] = useState<number[]>([])
  const [netRecvRateHistory, setNetRecvRateHistory] = useState<number[]>([])
  const prevNetRef = useRef<{ sent: number; recv: number; ts: number } | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const data = await fetchStats()
      setStats(data)
      setCpuHistory((prev) => [...prev, data.cpu_percent].slice(-CHART_POINTS))
      setMemHistory((prev) => [...prev, data.memory_percent].slice(-CHART_POINTS))
      const gpuPct = data.gpu_percent
      if (gpuPct != null) {
        setGpuHistory((prev) => [...prev, gpuPct].slice(-CHART_POINTS))
      }
      const diskPct = data.disk_percent
      if (diskPct != null) {
        setDiskHistory((prev) => [...prev, diskPct].slice(-CHART_POINTS))
      }
      const sent = data.net_bytes_sent ?? 0
      const recv = data.net_bytes_recv ?? 0
      const ts = (data.timestamp || Date.now() / 1000) * 1000
      const prev = prevNetRef.current
      prevNetRef.current = { sent, recv, ts }
      if (prev != null && ts > prev.ts) {
        const dtSec = (ts - prev.ts) / 1000
        if (dtSec > 0) {
          const sentRateMB = (sent - prev.sent) / (1024 * 1024) / dtSec
          const recvRateMB = (recv - prev.recv) / (1024 * 1024) / dtSec
          setNetSentRateHistory((h) => [...h, Math.max(0, sentRateMB)].slice(-CHART_POINTS))
          setNetRecvRateHistory((h) => [...h, Math.max(0, recvRateMB)].slice(-CHART_POINTS))
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stats')
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  if (error) {
    return (
      <div className="nekkus-theme nekkus-glass-root" data-nekkus-root style={{ padding: 24 }}>
        <Card variant="default" className="nekkus-glass-card">
          <DataText>Error: {error}</DataText>
          <button type="button" onClick={load}>Retry</button>
        </Card>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="nekkus-theme nekkus-glass-root" data-nekkus-root style={{ padding: 24 }}>
        <p>Loading…</p>
      </div>
    )
  }

  // Главная: блоки-карточки по разделам (клик → раздел с графиками)
  if (selectedSection === null) {
    return (
      <div className="nekkus-theme nekkus-glass-root" data-nekkus-root>
        <PageLayout>
          <AppShell
            logo="Nekkus"
            title="Eye"
            description="CPU, память, диск, GPU, сеть, процессы."
          >
          <Section title="Обзор">
            <p className="eye-overview-hint">
              Нажмите на блок — откроется раздел с полной статистикой и графиком.
            </p>
            <div className="eye-overview">
              <Card
                variant="elevated"
                moduleGlow="eye"
                className="eye-card eye-card--large eye-card--clickable nekkus-glass-card"
                onClick={() => setSelectedSection('cpu')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedSection('cpu')}
              >
                <div className="eye-block-main">
                  <span className="eye-block-value">{stats.cpu_percent.toFixed(1)}%</span>
                  <StatusDot
                    status={stats.cpu_percent > 90 ? 'error' : stats.cpu_percent > 70 ? 'busy' : 'online'}
                  />
                </div>
                <span className="eye-block-label">CPU</span>
                {stats.cpu_model_name && (
                  <div className="eye-block-extra" title={stats.cpu_model_name}>
                    {stats.cpu_model_name.length > 40
                      ? `${stats.cpu_model_name.slice(0, 40)}…`
                      : stats.cpu_model_name}
                  </div>
                )}
                {stats.cpu_mhz != null && stats.cpu_mhz > 0 && (
                  <div className="eye-block-extra">
                    {(stats.cpu_mhz / 1000).toFixed(2)} GHz
                  </div>
                )}
                {(stats.cpu_cores != null && stats.cpu_cores > 0) && (
                  <div className="eye-block-extra">
                    {stats.cpu_cores} ядер
                    {stats.cpu_physical_cores != null && stats.cpu_physical_cores > 0 && stats.cpu_physical_cores !== stats.cpu_cores
                      ? ` (${stats.cpu_physical_cores} физ.)`
                      : ''}
                  </div>
                )}
              </Card>
              <Card
                variant="elevated"
                moduleGlow="eye"
                className="eye-card eye-card--large eye-card--clickable nekkus-glass-card"
                onClick={() => setSelectedSection('memory')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedSection('memory')}
              >
                <div className="eye-block-main">
                  <span className="eye-block-value">{stats.memory_percent.toFixed(1)}%</span>
                </div>
                <span className="eye-block-label">Память</span>
                <div className="eye-block-extra">
                  {formatMB(stats.memory_used_mb)} / {formatMB(stats.memory_total_mb)}
                </div>
                <div className="eye-block-extra">
                  Свободно: {formatMB(stats.memory_free_mb ?? Math.max(0, stats.memory_total_mb - stats.memory_used_mb))}
                </div>
                {(stats.swap_total_mb != null && stats.swap_total_mb > 0) && (
                  <div className="eye-block-extra">
                    Swap: {formatMB(stats.swap_used_mb ?? 0)} / {formatMB(stats.swap_total_mb)}
                  </div>
                )}
              </Card>
              {stats.disk_percent != null && (
                <Card
                  variant="elevated"
                  moduleGlow="eye"
                  className="eye-card eye-card--large eye-card--clickable nekkus-glass-card"
                  onClick={() => setSelectedSection('disk')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedSection('disk')}
                >
                  <div className="eye-block-main">
                    <span className="eye-block-value">{(stats.disk_percent ?? 0).toFixed(1)}%</span>
                  </div>
                  <span className="eye-block-label">Диск</span>
                  <div className="eye-block-extra">
                    {stats.disk_used_gb ?? 0} ГБ / {stats.disk_total_gb ?? 0} ГБ
                  </div>
                  {stats.disk_path && (
                    <div className="eye-block-extra">{stats.disk_path}</div>
                  )}
                </Card>
              )}
              {(stats.gpu_percent != null || stats.gpu_name || stats.gpu_temp_c != null) && (
                <Card
                  variant="elevated"
                  moduleGlow="eye"
                  className="eye-card eye-card--large eye-card--clickable nekkus-glass-card"
                  onClick={() => setSelectedSection('gpu')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedSection('gpu')}
                >
                  <div className="eye-block-main">
                    <span className="eye-block-value">
                      {stats.gpu_percent != null ? `${stats.gpu_percent.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                  <span className="eye-block-label">GPU</span>
                  {stats.gpu_name && <div className="eye-block-extra">{stats.gpu_name}</div>}
                  {stats.gpu_temp_c != null && stats.gpu_temp_c > 0 && (
                    <div className="eye-block-extra">{stats.gpu_temp_c} °C</div>
                  )}
                  {(stats.gpu_memory_used_mb != null || stats.gpu_memory_total_mb != null) && (
                    <div className="eye-block-extra">
                      VRAM: {formatMB(stats.gpu_memory_used_mb ?? 0)} / {formatMB(stats.gpu_memory_total_mb ?? 0)}
                    </div>
                  )}
                </Card>
              )}
              <Card
                variant="elevated"
                moduleGlow="eye"
                className="eye-card eye-card--large eye-card--clickable nekkus-glass-card"
                onClick={() => setSelectedSection('network')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedSection('network')}
              >
                <div className="eye-block-main">
                  <span className="eye-block-value">Сеть</span>
                </div>
                <span className="eye-block-label">Ethernet / I/O</span>
                <div className="eye-block-extra">
                  ↑ {formatBytes(stats.net_bytes_sent ?? 0)} / ↓ {formatBytes(stats.net_bytes_recv ?? 0)}
                </div>
              </Card>
              {stats.uptime_sec != null && stats.uptime_sec > 0 && (
                <Card
                  variant="elevated"
                  moduleGlow="eye"
                  className="eye-card eye-card--large eye-card--clickable nekkus-glass-card"
                  onClick={() => setSelectedSection('uptime')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedSection('uptime')}
                >
                  <div className="eye-block-main">
                    <span className="eye-block-value">{formatUptime(stats.uptime_sec)}</span>
                  </div>
                  <span className="eye-block-label">Аптайм</span>
                </Card>
              )}
              {stats.process_count != null && (
                <Card
                  variant="elevated"
                  moduleGlow="eye"
                  className="eye-card eye-card--large eye-card--clickable nekkus-glass-card"
                  onClick={() => setSelectedSection('processes')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedSection('processes')}
                >
                  <div className="eye-block-main">
                    <span className="eye-block-value">{stats.process_count}</span>
                  </div>
                  <span className="eye-block-label">Процессы</span>
                  <div className="eye-block-extra">Нажмите для списка и поиска</div>
                </Card>
              )}
            </div>
          </Section>
          </AppShell>
        </PageLayout>
      </div>
    )
  }

  // Экран раздела: назад + полная статистика + график (где есть)
  const sectionTitles: Record<SectionId, string> = {
    cpu: 'CPU',
    memory: 'Память',
    disk: 'Диск',
    gpu: 'GPU',
    network: 'Сеть',
    uptime: 'Аптайм',
    processes: 'Процессы',
  }

  return (
    <div className="nekkus-theme nekkus-glass-root" data-nekkus-root>
      <PageLayout>
        <AppShell
          logo="Nekkus"
          title="Eye"
          description="CPU, память, диск, GPU, сеть, процессы."
        >
        <Section title="">
          <div className="eye-section-header">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedSection(null)}
              aria-label="Назад к обзору"
            >
              ← Назад
            </Button>
            <h2 className="eye-section-title">{sectionTitles[selectedSection]}</h2>
          </div>

          {selectedSection === 'cpu' && (
            <div className="eye-detail">
              <div className="eye-detail-stats">
                <MetricHero
                  value={`${stats.cpu_percent.toFixed(1)}%`}
                  label="Загрузка"
                />
                <StatusDot
                  status={stats.cpu_percent > 90 ? 'error' : stats.cpu_percent > 70 ? 'busy' : 'online'}
                />
              </div>
              <Card variant="default" className="eye-info-card">
                <h3 className="eye-info-title">Характеристики CPU</h3>
                <dl className="eye-info-list">
                  {stats.cpu_model_name && (
                    <>
                      <dt>Модель</dt>
                      <dd title={stats.cpu_model_name}>{stats.cpu_model_name}</dd>
                    </>
                  )}
                  {stats.cpu_mhz != null && stats.cpu_mhz > 0 && (
                    <>
                      <dt>Частота</dt>
                      <dd>{(stats.cpu_mhz / 1000).toFixed(2)} GHz</dd>
                    </>
                  )}
                  {(stats.cpu_cores != null && stats.cpu_cores > 0) && (
                    <>
                      <dt>Ядра (логические)</dt>
                      <dd>{stats.cpu_cores}</dd>
                    </>
                  )}
                  {(stats.cpu_physical_cores != null && stats.cpu_physical_cores > 0) && (
                    <>
                      <dt>Ядра (физические)</dt>
                      <dd>{stats.cpu_physical_cores}</dd>
                    </>
                  )}
                </dl>
              </Card>
              <p className="eye-chart-hint">
                Последние {CHART_POINTS} замеров, каждые {REFRESH_MS / 1000} с.
              </p>
              <Card variant="default" className="eye-chart-card">
                <LineChart
                  data={padHistory(cpuHistory, CHART_POINTS)}
                  height={CHART_HEIGHT}
                  color={EYE_COLOR}
                  maxValue={100}
                  valueSuffix="%"
                  yLabel="Используется %"
                  xLabel={`${Math.round((CHART_POINTS * REFRESH_MS) / 1000)} секунд`}
                  timeRangeLabel="0"
                />
              </Card>
            </div>
          )}

          {selectedSection === 'memory' && (
            <div className="eye-detail">
              <div className="eye-detail-stats">
                <MetricHero
                  value={`${stats.memory_percent.toFixed(1)}%`}
                  label="Занято"
                />
                <DataText size="base">
                  {formatMB(stats.memory_used_mb)} / {formatMB(stats.memory_total_mb)}
                </DataText>
              </div>
              <Card variant="default" className="eye-info-card">
                <h3 className="eye-info-title">ОЗУ (RAM)</h3>
                <dl className="eye-info-list">
                  <dt>Занято</dt>
                  <dd>{formatMB(stats.memory_used_mb)}</dd>
                  <dt>Всего</dt>
                  <dd>{formatMB(stats.memory_total_mb)}</dd>
                  <dt>Свободно</dt>
                  <dd>{formatMB(stats.memory_free_mb ?? Math.max(0, stats.memory_total_mb - stats.memory_used_mb))}</dd>
                  {(stats.memory_available_mb != null && stats.memory_available_mb !== stats.memory_free_mb) && (
                    <>
                      <dt>Доступно</dt>
                      <dd>{formatMB(stats.memory_available_mb)}</dd>
                    </>
                  )}
                </dl>
                {(stats.swap_total_mb != null && stats.swap_total_mb > 0) && (
                  <>
                    <h3 className="eye-info-title eye-info-title--sub">Swap</h3>
                    <dl className="eye-info-list">
                      <dt>Занято</dt>
                      <dd>{formatMB(stats.swap_used_mb ?? 0)}</dd>
                      <dt>Всего</dt>
                      <dd>{formatMB(stats.swap_total_mb)}</dd>
                      <dt>Свободно</dt>
                      <dd>{formatMB(stats.swap_free_mb ?? 0)}</dd>
                    </dl>
                  </>
                )}
              </Card>
              <p className="eye-chart-hint">
                Последние {CHART_POINTS} замеров, каждые {REFRESH_MS / 1000} с.
              </p>
              <Card variant="default" className="eye-chart-card">
                <LineChart
                  data={padHistory(memHistory, CHART_POINTS)}
                  height={CHART_HEIGHT}
                  color={EYE_COLOR}
                  maxValue={100}
                  valueSuffix="%"
                  yLabel="Используется %"
                  xLabel={`${Math.round((CHART_POINTS * REFRESH_MS) / 1000)} секунд`}
                />
              </Card>
            </div>
          )}

          {selectedSection === 'disk' && (
            <div className="eye-detail">
              <div className="eye-detail-stats">
                <MetricHero
                  value={stats.disk_percent != null ? `${stats.disk_percent.toFixed(1)}%` : '—'}
                  label="Занято"
                />
                <DataText size="base">
                  {stats.disk_used_gb ?? 0} ГБ / {stats.disk_total_gb ?? 0} ГБ
                </DataText>
              </div>
              <Card variant="default" className="eye-info-card">
                <h3 className="eye-info-title">Диск</h3>
                <dl className="eye-info-list">
                  {stats.disk_path && (
                    <>
                      <dt>Путь</dt>
                      <dd>{stats.disk_path}</dd>
                    </>
                  )}
                  <dt>Занято</dt>
                  <dd>{stats.disk_used_gb ?? 0} ГБ</dd>
                  <dt>Всего</dt>
                  <dd>{stats.disk_total_gb ?? 0} ГБ</dd>
                  <dt>Свободно</dt>
                  <dd>{stats.disk_free_gb ?? Math.max(0, (stats.disk_total_gb ?? 0) - (stats.disk_used_gb ?? 0))} ГБ</dd>
                </dl>
              </Card>
              <p className="eye-chart-hint">
                Последние {CHART_POINTS} замеров, каждые {REFRESH_MS / 1000} с.
              </p>
              <Card variant="default" className="eye-chart-card">
                <LineChart
                  data={padHistory(diskHistory, CHART_POINTS)}
                  height={CHART_HEIGHT}
                  color={EYE_COLOR}
                  maxValue={100}
                  valueSuffix="%"
                  yLabel="Занято %"
                  xLabel={`${Math.round((CHART_POINTS * REFRESH_MS) / 1000)} секунд`}
                />
              </Card>
            </div>
          )}

          {selectedSection === 'gpu' && (
            <div className="eye-detail">
              <div className="eye-detail-stats">
                <MetricHero
                  value={stats.gpu_percent != null ? `${stats.gpu_percent.toFixed(1)}%` : '—'}
                  label="Загрузка"
                />
              </div>
              <Card variant="default" className="eye-info-card">
                <h3 className="eye-info-title">GPU</h3>
                <dl className="eye-info-list">
                  {stats.gpu_name && (
                    <>
                      <dt>Модель</dt>
                      <dd>{stats.gpu_name}</dd>
                    </>
                  )}
                  {stats.gpu_temp_c != null && stats.gpu_temp_c > 0 && (
                    <>
                      <dt>Температура</dt>
                      <dd>{stats.gpu_temp_c} °C</dd>
                    </>
                  )}
                  {(stats.gpu_memory_used_mb != null || stats.gpu_memory_total_mb != null) && (
                    <>
                      <dt>VRAM</dt>
                      <dd>{formatMB(stats.gpu_memory_used_mb ?? 0)} / {formatMB(stats.gpu_memory_total_mb ?? 0)}</dd>
                    </>
                  )}
                  {stats.gpu_percent != null && (
                    <>
                      <dt>Загрузка</dt>
                      <dd>{stats.gpu_percent.toFixed(1)}%</dd>
                    </>
                  )}
                </dl>
              </Card>
              <p className="eye-chart-hint">
                Последние {CHART_POINTS} замеров, каждые {REFRESH_MS / 1000} с.
              </p>
              <Card variant="default" className="eye-chart-card">
                <LineChart
                  data={padHistory(gpuHistory, CHART_POINTS)}
                  height={CHART_HEIGHT}
                  color={EYE_COLOR}
                  maxValue={100}
                  valueSuffix="%"
                  yLabel="Используется %"
                  xLabel={`${Math.round((CHART_POINTS * REFRESH_MS) / 1000)} секунд`}
                />
              </Card>
            </div>
          )}

          {selectedSection === 'network' && (
            <div className="eye-detail">
              <Card variant="default" className="eye-info-card">
                <h3 className="eye-info-title">Сеть (суммарный I/O)</h3>
                <dl className="eye-info-list">
                  <dt>Отправлено</dt>
                  <dd>{formatBytes(stats.net_bytes_sent ?? 0)}</dd>
                  <dt>Получено</dt>
                  <dd>{formatBytes(stats.net_bytes_recv ?? 0)}</dd>
                  <dt>Всего</dt>
                  <dd>{formatBytes((stats.net_bytes_sent ?? 0) + (stats.net_bytes_recv ?? 0))}</dd>
                </dl>
              </Card>
              <p className="eye-chart-hint">
                Скорость (МБ/с), последние {CHART_POINTS} замеров.
              </p>
              {(() => {
                const netPadded = padHistory(netSentRateHistory, CHART_POINTS)
                const recvPadded = padHistory(netRecvRateHistory, CHART_POINTS)
                const netChartMax = Math.max(10, ...netPadded, ...recvPadded)
                return (
                  <div className="eye-charts-row">
                    <Card variant="default" className="eye-chart-card">
                      <LineChart
                        data={netPadded}
                        height={CHART_HEIGHT}
                        color={EYE_NET_COLOR}
                        maxValue={netChartMax}
                        valueSuffix=" МБ/с"
                        yLabel="Отправка"
                        xLabel={`${Math.round((CHART_POINTS * REFRESH_MS) / 1000)} с`}
                      />
                    </Card>
                    <Card variant="default" className="eye-chart-card">
                      <LineChart
                        data={recvPadded}
                        height={CHART_HEIGHT}
                        color={EYE_NET_COLOR}
                        maxValue={netChartMax}
                        valueSuffix=" МБ/с"
                        yLabel="Получение"
                        xLabel={`${Math.round((CHART_POINTS * REFRESH_MS) / 1000)} с`}
                      />
                    </Card>
                  </div>
                )
              })()}
            </div>
          )}

          {selectedSection === 'uptime' && (
            <div className="eye-detail">
              <div className="eye-detail-stats">
                <MetricHero
                  value={stats.uptime_sec != null ? formatUptime(stats.uptime_sec) : '—'}
                  label="Время работы системы"
                />
                {stats.uptime_sec != null && (
                  <DataText size="base">
                    {Math.floor(stats.uptime_sec)} с всего
                  </DataText>
                )}
              </div>
              <Card variant="default" className="eye-info-card">
                <h3 className="eye-info-title">Система</h3>
                <dl className="eye-info-list">
                  {stats.hostname && (
                    <>
                      <dt>Имя ПК</dt>
                      <dd>{stats.hostname}</dd>
                    </>
                  )}
                  {stats.os && (
                    <>
                      <dt>ОС</dt>
                      <dd>{stats.os}</dd>
                    </>
                  )}
                  {stats.platform && (
                    <>
                      <dt>Платформа</dt>
                      <dd>{stats.platform}</dd>
                    </>
                  )}
                  {stats.kernel_arch && (
                    <>
                      <dt>Архитектура</dt>
                      <dd>{stats.kernel_arch}</dd>
                    </>
                  )}
                  {stats.kernel_version && (
                    <>
                      <dt>Ядро</dt>
                      <dd>{stats.kernel_version}</dd>
                    </>
                  )}
                  <dt>Процессов</dt>
                  <dd>{stats.process_count ?? 0}</dd>
                </dl>
              </Card>
            </div>
          )}

          {selectedSection === 'processes' && (
            <MonitoringErrorBoundary>
              <ProcessesPanel
                processCount={stats.process_count ?? 0}
                processList={processList}
                processSearch={processSearch}
                setProcessSearch={setProcessSearch}
                processLoading={processLoading}
                setProcessLoading={setProcessLoading}
                setProcessList={setProcessList}
                processKilling={processKilling}
                setProcessKilling={setProcessKilling}
                processError={processError}
                setProcessError={setProcessError}
              />
            </MonitoringErrorBoundary>
          )}
        </Section>
        </AppShell>
      </PageLayout>
    </div>
  )
}
