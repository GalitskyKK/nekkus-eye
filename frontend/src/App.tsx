import { useCallback, useEffect, useState } from 'react'
import {
  Card,
  Chart,
  DataText,
  MetricHero,
  PageLayout,
  Section,
  StatusDot,
} from '@nekkus/ui-kit'
import { fetchStats, type Stats } from './api'

const REFRESH_MS = 2000
const CHART_POINTS = 20
const CHART_HEIGHT = 72
const EYE_COLOR = '#10B981'

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb} MB`
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

/** Добивает массив до len нулями слева (старые слева, новые справа). */
function padHistory(history: number[], len: number): number[] {
  if (history.length >= len) return history.slice(-len)
  return [...Array(len - history.length).fill(0), ...history]
}

export default function App() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cpuHistory, setCpuHistory] = useState<number[]>([])
  const [memHistory, setMemHistory] = useState<number[]>([])

  const load = useCallback(async () => {
    try {
      setError(null)
      const data = await fetchStats()
      setStats(data)
      setCpuHistory((prev) => [...prev, data.cpu_percent].slice(-CHART_POINTS))
      setMemHistory((prev) => [...prev, data.memory_percent].slice(-CHART_POINTS))
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
      <div className="nekkus-theme" data-nekkus-root style={{ padding: 24 }}>
        <Card variant="default">
          <DataText>Error: {error}</DataText>
          <button type="button" onClick={load}>Retry</button>
        </Card>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="nekkus-theme" data-nekkus-root style={{ padding: 24 }}>
        <p>Loading…</p>
      </div>
    )
  }

  return (
    <div className="nekkus-theme" data-nekkus-root>
      <PageLayout>
        <Section title="Обзор">
          <div className="eye-overview">
            <Card variant="elevated" moduleGlow="eye" className="eye-card">
              <MetricHero
                value={`${stats.cpu_percent.toFixed(1)}%`}
                label="CPU"
              />
              <StatusDot
                status={stats.cpu_percent > 90 ? 'error' : stats.cpu_percent > 70 ? 'busy' : 'online'}
              />
            </Card>
            <Card variant="elevated" moduleGlow="eye" className="eye-card">
              <MetricHero
                value={`${stats.memory_percent.toFixed(1)}%`}
                label="Память"
              />
              <DataText size="sm">
                {formatMB(stats.memory_used_mb)} / {formatMB(stats.memory_total_mb)}
              </DataText>
            </Card>
            {stats.disk_percent != null && (
              <Card variant="elevated" moduleGlow="eye" className="eye-card">
                <MetricHero
                  value={`${(stats.disk_percent ?? 0).toFixed(1)}%`}
                  label="Диск"
                />
                <DataText size="sm">
                  {stats.disk_used_gb ?? 0} / {stats.disk_total_gb ?? 0} ГБ
                </DataText>
              </Card>
            )}
            {stats.uptime_sec != null && stats.uptime_sec > 0 && (
              <Card variant="elevated" moduleGlow="eye" className="eye-card">
                <MetricHero
                  value={formatUptime(stats.uptime_sec)}
                  label="Аптайм"
                />
              </Card>
            )}
            {stats.process_count != null && (
              <Card variant="elevated" moduleGlow="eye" className="eye-card">
                <MetricHero
                  value={String(stats.process_count)}
                  label="Процессы"
                />
              </Card>
            )}
            {(stats.gpu_percent != null || (stats.gpu_name != null && stats.gpu_name !== '') || stats.gpu_temp_c != null) && (
              <Card variant="elevated" moduleGlow="eye" className="eye-card">
                <MetricHero
                  value={stats.gpu_percent != null ? `${stats.gpu_percent.toFixed(1)}%` : '—'}
                  label="GPU"
                />
                {stats.gpu_name ? (
                  <DataText size="sm">{stats.gpu_name}</DataText>
                ) : null}
                {stats.gpu_temp_c != null && stats.gpu_temp_c > 0 ? (
                  <DataText size="sm">{stats.gpu_temp_c} °C</DataText>
                ) : null}
              </Card>
            )}
          </div>
        </Section>

        <Section title="История">
          <p className="eye-chart-hint">
            Последние {CHART_POINTS} замеров, каждые {REFRESH_MS / 1000} с. Слева → новее.
          </p>
          <div className="eye-charts-row">
            <div className="eye-chart-block">
              <div className="eye-chart-block-header">
                <span className="eye-chart-block-title">CPU</span>
                <span className="eye-chart-block-value">{stats.cpu_percent.toFixed(1)}%</span>
              </div>
              <Card variant="default" className="eye-chart-card">
                <Chart
                  data={padHistory(cpuHistory, CHART_POINTS)}
                  height={CHART_HEIGHT}
                  color={EYE_COLOR}
                  valueSuffix="%"
                  maxValue={100}
                />
              </Card>
            </div>
            <div className="eye-chart-block">
              <div className="eye-chart-block-header">
                <span className="eye-chart-block-title">Память</span>
                <span className="eye-chart-block-value">{stats.memory_percent.toFixed(1)}%</span>
              </div>
              <Card variant="default" className="eye-chart-card">
                <Chart
                  data={padHistory(memHistory, CHART_POINTS)}
                  height={CHART_HEIGHT}
                  color={EYE_COLOR}
                  valueSuffix="%"
                  maxValue={100}
                />
              </Card>
            </div>
          </div>
        </Section>
      </PageLayout>
    </div>
  )
}
