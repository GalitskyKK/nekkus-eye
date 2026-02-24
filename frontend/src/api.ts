const BASE = ''

export interface Stats {
  cpu_percent: number
  memory_percent: number
  memory_used_mb: number
  memory_total_mb: number
  timestamp: number
}

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${BASE}/api/stats`)
  if (!res.ok) throw new Error(res.statusText)
  return res.json()
}
