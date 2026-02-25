const BASE = ''

export interface EyeTopProcess {
  pid?: number
  name?: string
  cpu_percent?: number
  rss_mb?: number
}

export interface Stats {
  cpu_percent: number
  cpu_model_name?: string
  cpu_mhz?: number
  cpu_cores?: number
  cpu_physical_cores?: number
  cpu_temp_c?: number
  memory_percent: number
  memory_used_mb: number
  memory_total_mb: number
  memory_free_mb?: number
  memory_available_mb?: number
  swap_total_mb?: number
  swap_used_mb?: number
  swap_free_mb?: number
  disk_percent?: number
  disk_used_gb?: number
  disk_total_gb?: number
  disk_free_gb?: number
  disk_path?: string
  gpu_percent?: number
  gpu_name?: string
  gpu_temp_c?: number
  gpu_memory_used_mb?: number
  gpu_memory_total_mb?: number
  hostname?: string
  platform?: string
  os?: string
  kernel_arch?: string
  kernel_version?: string
  uptime_sec?: number
  process_count?: number
  net_bytes_sent?: number
  net_bytes_recv?: number
  timestamp: number
  top_processes?: EyeTopProcess[]
}

export interface ProcessInfo {
  pid: number
  name: string
  rss_mb?: number
  status?: string
  cpu_percent?: number
  net_bytes_sent?: number
  net_bytes_recv?: number
  connections_count?: number
}

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${BASE}/api/stats`)
  if (!res.ok) throw new Error(res.statusText)
  return res.json()
}

export async function fetchProcesses(params?: { q?: string; limit?: number; with_metrics?: boolean }): Promise<ProcessInfo[]> {
  const sp = new URLSearchParams()
  if (params?.q) sp.set('q', params.q)
  if (params?.limit) sp.set('limit', String(params.limit))
  if (params?.with_metrics) sp.set('with_metrics', '1')
  const url = `${BASE}/api/processes${sp.toString() ? `?${sp}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(res.statusText)
  return res.json()
}

export async function killProcess(pid: number): Promise<void> {
  const res = await fetch(`${BASE}/api/processes/kill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pid }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error || res.statusText)
  }
}
