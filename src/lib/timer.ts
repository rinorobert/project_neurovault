import type { Team } from '../types'

/**
 * All timing is derived from absolute epoch timestamps stored on the Team
 * record (startedAt / pausedAt / totalPausedMs / finishedAt), never from a
 * running in-memory counter. This means a page refresh, tab close, or
 * browser crash never loses timer state — on reload we just recompute
 * elapsed time from the stored timestamps.
 */

/** Milliseconds elapsed since start, excluding any paused duration, up to `now`. */
export function elapsedMs(team: Team, now: number = Date.now()): number {
  if (!team.startedAt) return 0

  const end = team.finishedAt ?? now
  const pausedSoFar =
    team.totalPausedMs + (team.pausedAt ? Math.max(0, now - team.pausedAt) : 0)

  return Math.max(0, end - team.startedAt - pausedSoFar)
}

export function remainingMs(team: Team, now: number = Date.now()): number {
  const maxMs = team.maxTimeSeconds * 1000
  return Math.max(0, maxMs - elapsedMs(team, now))
}

export function isTimeExpired(team: Team, now: number = Date.now()): boolean {
  // Expiry only ever applies to a live, running clock — never to a team
  // that hasn't started, is paused, or has already finished.
  if (team.status !== 'RUNNING') return false
  if (!team.startedAt) return false
  return remainingMs(team, now) <= 0
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === undefined) return '—'
  if (seconds === null) return '—'
  return formatClock(seconds * 1000)
}
