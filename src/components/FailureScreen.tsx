import type { Team } from '../types'
import { formatDuration } from '../lib/timer'

export function AccessDenied({ attemptsRemaining }: { attemptsRemaining: number | null }) {
  return (
    <div className="fade-up flex flex-col items-center text-center gap-2 py-4">
      <div
        className="font-display text-2xl sm:text-3xl font-bold tracking-widest"
        style={{ color: 'var(--red)' }}
      >
        ACCESS DENIED
      </div>
      <div className="font-mono text-xs sm:text-sm tracking-[0.25em]" style={{ color: 'var(--text-mid)' }}>
        INVALID OVERRIDE CODE
      </div>
      {attemptsRemaining !== null && (
        <div className="font-mono text-sm mt-2" style={{ color: 'var(--amber)' }}>
          Attempts remaining: {attemptsRemaining}
        </div>
      )}
    </div>
  )
}

export function TimeExpiredScreen({ team }: { team: Team }) {
  return (
    <div className="fade-up flex flex-col items-center text-center gap-4 py-10">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
        style={{ border: '2px solid var(--red)', color: 'var(--red)', boxShadow: '0 0 40px rgba(255,59,78,0.3)' }}
      >
        ✕
      </div>
      <div>
        <div className="font-display text-3xl font-bold tracking-widest" style={{ color: 'var(--red)' }}>
          SYSTEM LOCKDOWN
        </div>
        <div className="font-mono text-sm mt-2 tracking-[0.25em]" style={{ color: 'var(--text-mid)' }}>
          TIME EXPIRED — {team.name.toUpperCase()}
        </div>
      </div>

      <div className="w-full max-w-sm rounded-md p-6 mt-2" style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}>
        <div className="grid grid-cols-2 gap-3 text-left">
          <div>
            <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
              Completion Time
            </div>
            <div className="font-mono text-xl" style={{ color: 'var(--text-hi)' }}>
              {formatDuration(team.completionSeconds)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
              Hints Used
            </div>
            <div className="font-mono text-xl" style={{ color: 'var(--text-hi)' }}>
              {team.hintsUsed} / 3
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
              Official Ranking Time
            </div>
            <div className="font-mono text-xl" style={{ color: 'var(--cyan)' }}>
              {formatDuration(team.officialRankingSeconds)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
