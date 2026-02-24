const BASE = ''

export interface Stats {
  cpu_percent: number
  memory_percent: number
  memory_used_mb: number
  memory_total_mb: number
  disk_percent?: number
  disk_used_gb?: number
  disk_total_gb?: number
  uptime_sec?: number
  process_count?: number
  timestamp: number
}

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${BASE}/api/stats`)
  if (!res.ok) throw new Error(res.statusText)
  return res.json()
}
