import { useCallback, useEffect, useState } from 'react'
import {
  Button,
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
const CHART_HEIGHT = 96
const EYE_COLOR = '#10B981'

export type SectionId = 'cpu' | 'memory' | 'disk' | 'gpu' | 'uptime' | 'processes'

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

function padHistory(history: number[], len: number): number[] {
  if (history.length >= len) return history.slice(-len)
  return [...Array(len - history.length).fill(0), ...history]
}

export default function App() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cpuHistory, setCpuHistory] = useState<number[]>([])
  const [memHistory, setMemHistory] = useState<number[]>([])
  const [selectedSection, setSelectedSection] = useState<SectionId | null>(null)

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

  // Главная: блоки-карточки по разделам (клик → раздел с графиками)
  if (selectedSection === null) {
    return (
      <div className="nekkus-theme" data-nekkus-root>
        <PageLayout>
          <Section title="Обзор">
            <p className="eye-overview-hint">
              Нажмите на блок — откроется раздел с полной статистикой и графиком.
            </p>
            <div className="eye-overview">
              <Card
                variant="elevated"
                moduleGlow="eye"
                className="eye-card eye-card--clickable"
                onClick={() => setSelectedSection('cpu')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedSection('cpu')}
              >
                <MetricHero
                  value={`${stats.cpu_percent.toFixed(1)}%`}
                  label="CPU"
                />
                <StatusDot
                  status={stats.cpu_percent > 90 ? 'error' : stats.cpu_percent > 70 ? 'busy' : 'online'}
                />
              </Card>
              <Card
                variant="elevated"
                moduleGlow="eye"
                className="eye-card eye-card--clickable"
                onClick={() => setSelectedSection('memory')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedSection('memory')}
              >
                <MetricHero
                  value={`${stats.memory_percent.toFixed(1)}%`}
                  label="Память"
                />
                <DataText size="sm">
                  {formatMB(stats.memory_used_mb)} / {formatMB(stats.memory_total_mb)}
                </DataText>
              </Card>
              {stats.disk_percent != null && (
                <Card
                  variant="elevated"
                  moduleGlow="eye"
                  className="eye-card eye-card--clickable"
                  onClick={() => setSelectedSection('disk')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedSection('disk')}
                >
                  <MetricHero
                    value={`${(stats.disk_percent ?? 0).toFixed(1)}%`}
                    label="Диск"
                  />
                  <DataText size="sm">
                    {stats.disk_used_gb ?? 0} / {stats.disk_total_gb ?? 0} ГБ
                  </DataText>
                </Card>
              )}
              {(stats.gpu_percent != null || stats.gpu_name || stats.gpu_temp_c != null) && (
                <Card
                  variant="elevated"
                  moduleGlow="eye"
                  className="eye-card eye-card--clickable"
                  onClick={() => setSelectedSection('gpu')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedSection('gpu')}
                >
                  <MetricHero
                    value={stats.gpu_percent != null ? `${stats.gpu_percent.toFixed(1)}%` : '—'}
                    label="GPU"
                  />
                  {stats.gpu_name ? <DataText size="sm">{stats.gpu_name}</DataText> : null}
                  {stats.gpu_temp_c != null && stats.gpu_temp_c > 0 ? (
                    <DataText size="sm">{stats.gpu_temp_c} °C</DataText>
                  ) : null}
                </Card>
              )}
              {stats.uptime_sec != null && stats.uptime_sec > 0 && (
                <Card
                  variant="elevated"
                  moduleGlow="eye"
                  className="eye-card eye-card--clickable"
                  onClick={() => setSelectedSection('uptime')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedSection('uptime')}
                >
                  <MetricHero value={formatUptime(stats.uptime_sec)} label="Аптайм" />
                </Card>
              )}
              {stats.process_count != null && (
                <Card
                  variant="elevated"
                  moduleGlow="eye"
                  className="eye-card eye-card--clickable"
                  onClick={() => setSelectedSection('processes')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedSection('processes')}
                >
                  <MetricHero value={String(stats.process_count)} label="Процессы" />
                </Card>
              )}
            </div>
          </Section>
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
    uptime: 'Аптайм',
    processes: 'Процессы',
  }

  return (
    <div className="nekkus-theme" data-nekkus-root>
      <PageLayout>
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
              <p className="eye-chart-hint">
                Последние {CHART_POINTS} замеров, каждые {REFRESH_MS / 1000} с.
              </p>
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
              <p className="eye-chart-hint">
                Последние {CHART_POINTS} замеров, каждые {REFRESH_MS / 1000} с.
              </p>
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
              <p className="eye-chart-hint">История по диску не ведётся.</p>
            </div>
          )}

          {selectedSection === 'gpu' && (
            <div className="eye-detail">
              <div className="eye-detail-stats">
                <MetricHero
                  value={stats.gpu_percent != null ? `${stats.gpu_percent.toFixed(1)}%` : '—'}
                  label="Загрузка"
                />
                {stats.gpu_name ? (
                  <DataText size="base">{stats.gpu_name}</DataText>
                ) : null}
                {stats.gpu_temp_c != null && stats.gpu_temp_c > 0 ? (
                  <DataText size="base">{stats.gpu_temp_c} °C</DataText>
                ) : null}
              </div>
              <p className="eye-chart-hint">История по GPU не ведётся.</p>
            </div>
          )}

          {selectedSection === 'uptime' && (
            <div className="eye-detail">
              <div className="eye-detail-stats">
                <MetricHero
                  value={stats.uptime_sec != null ? formatUptime(stats.uptime_sec) : '—'}
                  label="Время работы"
                />
              </div>
            </div>
          )}

          {selectedSection === 'processes' && (
            <div className="eye-detail">
              <div className="eye-detail-stats">
                <MetricHero
                  value={String(stats.process_count ?? 0)}
                  label="Процессов"
                />
              </div>
            </div>
          )}
        </Section>
      </PageLayout>
    </div>
  )
}
