import { useMemo } from 'react'
import type { Team } from '../types'
import { remainingMs, formatClock } from '../lib/timer'
import { useStore } from '../state/store'

export function CountdownTimer({ team, size = 'large' }: { team: Team; size?: 'large' | 'compact' }) {
  const { tick } = useStore() // subscribing to the global 1s ticker forces a re-render every second
  void tick

  const remaining = remainingMs(team)
  const pct = team.maxTimeSeconds > 0 ? remaining / (team.maxTimeSeconds * 1000) : 0

  const state = useMemo<'normal' | 'warning' | 'critical'>(() => {
    if (pct <= 0.1) return 'critical'
    if (pct <= 0.3) return 'warning'
    return 'normal'
  }, [pct])

  const colorVar = state === 'critical' ? 'var(--red)' : state === 'warning' ? 'var(--amber)' : 'var(--cyan)'

  if (size === 'compact') {
    return (
      <div className="font-mono digit-box text-2xl font-semibold" style={{ color: colorVar }}>
        {formatClock(remaining)}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`font-mono digit-box text-7xl sm:text-8xl font-bold tracking-wider ${
          state === 'critical' ? 'pulse' : ''
        }`}
        style={{ color: colorVar, textShadow: `0 0 28px ${colorVar}55` }}
      >
        {formatClock(remaining)}
      </div>
      <div className="w-full max-w-xs h-1 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
        <div
          className="h-full rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${Math.max(0, Math.min(100, pct * 100))}%`, background: colorVar }}
        />
      </div>
    </div>
  )
}
