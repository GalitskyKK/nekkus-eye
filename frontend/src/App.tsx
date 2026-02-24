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
const EYE_COLOR = '#10B981'

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb} MB`
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
      setCpuHistory((prev) => {
        const next = [...prev, data.cpu_percent].slice(-CHART_POINTS)
        return next.length === 1 ? Array(CHART_POINTS).fill(0).concat(next).slice(-CHART_POINTS) : next
      })
      setMemHistory((prev) => {
        const next = [...prev, data.memory_percent].slice(-CHART_POINTS)
        return next.length === 1 ? Array(CHART_POINTS).fill(0).concat(next).slice(-CHART_POINTS) : next
      })
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
        <Section title="Overview">
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Card variant="elevated" moduleGlow="eye">
              <MetricHero
                value={`${stats.cpu_percent.toFixed(1)}%`}
                label="CPU"
              />
              <StatusDot
                status={stats.cpu_percent > 90 ? 'error' : stats.cpu_percent > 70 ? 'busy' : 'online'}
              />
            </Card>
            <Card variant="elevated" moduleGlow="eye">
              <MetricHero
                value={`${stats.memory_percent.toFixed(1)}%`}
                label="Memory"
              />
              <DataText size="sm">
                Used / Total: {formatMB(stats.memory_used_mb)} / {formatMB(stats.memory_total_mb)}
              </DataText>
            </Card>
          </div>
        </Section>

        <Section title="CPU history">
          <Card variant="default">
            <Chart
              data={cpuHistory.length ? cpuHistory : [0]}
              height={120}
              color={EYE_COLOR}
            />
          </Card>
        </Section>

        <Section title="Memory history">
          <Card variant="default">
            <Chart
              data={memHistory.length ? memHistory : [0]}
              height={120}
              color={EYE_COLOR}
            />
          </Card>
        </Section>
      </PageLayout>
    </div>
  )
}
