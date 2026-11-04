import type { RunSummary } from '@/bridge/types'
import type { TaskStatusFilter, TaskTimeFilter } from '@/state/ui-state'

export const STATUS: Record<RunSummary['status'], { dot: string; label: string }> = {
  pending: { dot: 'bg-ink-faint', label: '等待' },
  running: { dot: 'bg-accent dot-live', label: '运行中' },
  succeeded: { dot: 'bg-success', label: '完成' },
  failed: { dot: 'bg-danger', label: '失败' },
  aborted: { dot: 'bg-ink-faint', label: '中断' },
}

export const STATUS_FILTERS: Array<{ value: TaskStatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'running', label: '进行中' },
  { value: 'failed', label: '失败' },
]

export const TIME_FILTERS: Array<{ value: TaskTimeFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'today', label: '今天' },
  { value: 'week', label: '7 天' },
  { value: 'month', label: '30 天' },
]

export function matchesStatus(run: RunSummary, filter: TaskStatusFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'running') return run.status === 'running' || run.status === 'pending'
  return run.status === 'failed' || run.status === 'aborted'
}

function startOfDay(time: number): number {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function matchesTime(run: RunSummary, filter: TaskTimeFilter, now = Date.now()): boolean {
  if (filter === 'all') return true
  const started = Date.parse(run.startedAt)
  if (!Number.isFinite(started)) return false
  if (filter === 'today') return startOfDay(started) === startOfDay(now)
  const days = filter === 'week' ? 7 : 30
  return started >= now - days * 24 * 60 * 60 * 1000
}

function dayOf(startedAt: string): string {
  return startedAt.slice(0, 10)
}

/** 置顶任务单独成组，其余按今天 / 昨天 / 更早分组。 */
export function groupRuns(
  runs: RunSummary[],
  pinned: Set<string>,
): Array<[string, RunSummary[]]> {
  const groups: Array<[string, RunSummary[]]> = []
  const pinnedRuns = runs.filter((run) => pinned.has(run.id))
  if (pinnedRuns.length > 0) groups.push(['置顶', pinnedRuns])

  const rest = runs.filter((run) => !pinned.has(run.id))
  if (rest.length === 0) return groups
  const days = [...new Set(rest.map((run) => dayOf(run.startedAt)))].sort().reverse()
  const olderDays = new Set(days.slice(2))
  if (days[0]) groups.push(['今天', rest.filter((run) => dayOf(run.startedAt) === days[0])])
  if (days[1]) groups.push(['昨天', rest.filter((run) => dayOf(run.startedAt) === days[1])])
  const older = rest.filter((run) => olderDays.has(dayOf(run.startedAt)))
  if (older.length > 0) groups.push(['更早', older])
  return groups
}

export function duration(run: RunSummary): string {
  if (!run.endedAt) return '进行中'
  const ms = Date.parse(run.endedAt) - Date.parse(run.startedAt)
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const minutes = ms / 60000
  return minutes < 1 ? `${Math.max(1, Math.round(ms / 1000))}s` : `${minutes.toFixed(1)}m`
}
