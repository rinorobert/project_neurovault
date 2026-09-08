import type { Team } from '../types'
import { CountdownTimer } from './CountdownTimer'
import { useStore } from '../state/store'
import { formatDuration } from '../lib/timer'

function ActionButton({
  label,
  onClick,
  color = 'var(--cyan)',
  disabled = false,
  filled = false,
}: {
  label: string
  onClick: () => void
  color?: string
  disabled?: boolean
  filled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="font-display uppercase tracking-[0.15em] text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-sm transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        background: filled ? color : 'transparent',
        color: filled ? 'var(--bg-void)' : color,
        border: `1px solid ${color}`,
      }}
    >
      {label}
    </button>
  )
}

const STATUS_LABEL: Record<Team['status'], string> = {
  NOT_STARTED: 'NOT STARTED',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  ESCAPED: 'ESCAPED ✓',
  TIME_EXPIRED: 'TIME EXPIRED',
}

const STATUS_COLOR: Record<Team['status'], string> = {
  NOT_STARTED: 'var(--text-dim)',
  RUNNING: 'var(--cyan)',
  PAUSED: 'var(--amber)',
  ESCAPED: 'var(--green)',
  TIME_EXPIRED: 'var(--red)',
}

export function ControlsPanel({ team }: { team: Team }) {
  const { startGame, pauseGame, resumeGame, markEscaped, resetActiveRun, requestDeleteResultToken, confirmDeleteResult } =
    useStore()

  const canStart = team.status === 'NOT_STARTED'
  const canPause = team.status === 'RUNNING'
  const canResume = team.status === 'PAUSED'
  const canMarkEscaped = team.status === 'RUNNING' || team.status === 'PAUSED'
  const isFinished = team.status === 'ESCAPED' || team.status === 'TIME_EXPIRED'
  const isLive = team.status === 'RUNNING' || team.status === 'PAUSED'

  function handleResetActiveRun() {
    if (confirm(`Reset this team's active run? This clears the timer, attempts, and hints for ${team.name}.`)) {
      resetActiveRun(team.id)
    }
  }

  async function handleDeleteCompletedResult() {
    // The confirmation token is generated SERVER-SIDE (never by the
    // browser) and is single-use with a short expiry — see
    // POST /api/teams/:id/result/delete-token.
    const info = await requestDeleteResultToken(team.id)
    if (!info) {
      alert('Could not generate a deletion token (team may not have finished yet).')
      return
    }
    const typed = window.prompt(
      `DELETE COMPLETED RESULT — IRREVERSIBLE\n\n` +
        `Team: ${info.teamName}\n` +
        `Official Ranking Time: ${formatDuration(info.officialRankingSeconds)}\n\n` +
        `This permanently deletes only the completed result/ranking record — the team registration ` +
        `and players are kept.\n\n` +
        `Type ${info.token} to confirm:`
    )
    if (typed === null) return // cancelled — no action
    const result = await confirmDeleteResult(team.id, typed)
    if (!result.ok) alert(result.error ?? 'Incorrect token — deletion cancelled.')
  }

  return (
    <div className="rounded-md p-5 flex flex-col gap-5" style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}>
      <div className="flex items-center justify-between">
        <div className="font-mono text-xs tracking-[0.25em]" style={{ color: 'var(--text-dim)' }}>
          STATUS: <span style={{ color: STATUS_COLOR[team.status] }}>{STATUS_LABEL[team.status]}</span>
        </div>
        <div className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
          Max {Math.round(team.maxTimeSeconds / 60)} min
        </div>
      </div>

      {/* Live countdown only while actually running/paused. A finished team shows
          its frozen completion time instead — never a moving clock. */}
      <div className="flex justify-center py-2">
        {isLive ? (
          <CountdownTimer team={team} />
        ) : (
          <div className="text-center">
            <div className="font-mono text-xs tracking-[0.3em] mb-2" style={{ color: 'var(--text-dim)' }}>
              {team.status === 'NOT_STARTED' ? 'READY' : 'COMPLETION'}
            </div>
            <div
              className="font-mono digit-box text-5xl font-bold"
              style={{ color: isFinished ? (team.status === 'ESCAPED' ? 'var(--green)' : 'var(--red)') : 'var(--text-dim)' }}
            >
              {team.status === 'NOT_STARTED'
                ? formatDuration(team.maxTimeSeconds)
                : formatDuration(team.completionSeconds)}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <ActionButton label="Start Game" onClick={() => startGame(team.id)} disabled={!canStart} color="var(--green)" filled />
        <ActionButton label="Pause" onClick={() => pauseGame(team.id)} disabled={!canPause} color="var(--amber)" />
        <ActionButton label="Resume" onClick={() => resumeGame(team.id)} disabled={!canResume} color="var(--cyan)" />
        <ActionButton label="Mark Escaped" onClick={() => markEscaped(team.id)} disabled={!canMarkEscaped} color="var(--green)" />
        <ActionButton label="Reset Active Run" onClick={handleResetActiveRun} disabled={isFinished} color="var(--amber)" />
        <ActionButton
          label="Delete Completed Result"
          onClick={handleDeleteCompletedResult}
          disabled={!isFinished}
          color="var(--red)"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
            Hints Used
          </div>
          <div className="font-mono text-lg" style={{ color: 'var(--amber)' }}>
            {team.hintsUsed} / 3
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
            Attempts
          </div>
          <div className="font-mono text-lg" style={{ color: 'var(--text-hi)' }}>
            {team.attempts}
            {team.maxAttempts !== undefined ? ` / ${team.maxAttempts}` : ''}
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
            Hint Penalty
          </div>
          <div className="font-mono text-lg" style={{ color: 'var(--amber)' }}>
            {team.hintPenaltySeconds !== undefined ? `+${formatDuration(team.hintPenaltySeconds)}` : '—'}
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
            Official Ranking Time
          </div>
          <div className="font-mono text-lg" style={{ color: 'var(--cyan)' }}>
            {team.officialRankingSeconds !== undefined ? formatDuration(team.officialRankingSeconds) : '—'}
          </div>
        </div>
      </div>
    </div>
  )
}
