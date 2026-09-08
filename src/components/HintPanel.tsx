import type { Team, HintLevel } from '../types.js'
import { HINT_PENALTIES_SECONDS, MAX_HINTS, hintPenaltyForCount } from '../lib/hints.js'
import { formatDuration } from '../lib/timer.js'
import { useStore } from '../state/store.js'

function formatPenalty(seconds: number): string {
  return `+${formatDuration(seconds)}`
}

export function HintPanel({ team }: { team: Team }) {
  const { giveHint } = useStore()
  const canGiveHints = team.status === 'RUNNING' || team.status === 'PAUSED'
  const currentPenalty =
    team.hintPenaltySeconds !== undefined ? team.hintPenaltySeconds : hintPenaltyForCount(team.hintsUsed)

  return (
    <div className="rounded-md p-5 flex flex-col gap-4" style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}>
      <div className="font-mono text-xs tracking-[0.25em]" style={{ color: 'var(--text-dim)' }}>
        HINT SYSTEM
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
            Hints Used
          </div>
          <div className="font-mono text-lg" style={{ color: 'var(--text-hi)' }}>
            {team.hintsUsed} / {MAX_HINTS}
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
            Penalty
          </div>
          <div className="font-mono text-lg" style={{ color: 'var(--amber)' }}>
            {formatPenalty(currentPenalty)}
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
            Official Ranking
          </div>
          <div className="font-mono text-lg" style={{ color: 'var(--cyan)' }}>
            {team.officialRankingSeconds !== undefined ? formatDuration(team.officialRankingSeconds) : '—'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {([1, 2, 3] as HintLevel[]).map((level) => {
          const alreadyUsed = team.hintsUsed >= level
          const isNextAvailable = team.hintsUsed === level - 1
          const enabled = canGiveHints && isNextAvailable

          return (
            <button
              key={level}
              disabled={!enabled}
              onClick={() => giveHint(team.id, level)}
              className="font-display uppercase tracking-[0.1em] text-xs font-semibold px-3 py-2.5 rounded-sm transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: alreadyUsed ? 'var(--bg-raised)' : 'transparent',
                color: alreadyUsed ? 'var(--text-dim)' : 'var(--amber)',
                border: `1px solid ${alreadyUsed ? 'var(--line)' : 'var(--amber)'}`,
              }}
            >
              {alreadyUsed ? `HINT ${level} — USED` : `HINT ${level} — +${formatDuration(HINT_PENALTIES_SECONDS[level - 1])}`}
            </button>
          )
        })}
      </div>

      {!canGiveHints && (
        <div className="font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
          {team.status === 'NOT_STARTED'
            ? 'Hints unlock once the game has started.'
            : 'This team has finished — hints are locked.'}
        </div>
      )}
    </div>
  )
}
