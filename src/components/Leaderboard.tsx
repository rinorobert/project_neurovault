import type { Team } from '../types.js'
import { buildLeaderboard, type LeaderboardTeamLike } from '../lib/leaderboard.js'
import { formatDuration } from '../lib/timer.js'

const STATUS_LABEL: Record<Team['status'], string> = {
  NOT_STARTED: 'Not Started',
  RUNNING: 'Running',
  PAUSED: 'Paused',
  ESCAPED: 'Escaped',
  TIME_EXPIRED: 'Time Expired',
}

const STATUS_COLOR: Record<Team['status'], string> = {
  NOT_STARTED: 'var(--text-dim)',
  RUNNING: 'var(--cyan)',
  PAUSED: 'var(--amber)',
  ESCAPED: 'var(--green)',
  TIME_EXPIRED: 'var(--red)',
}

export function Leaderboard<T extends LeaderboardTeamLike>({
  teams,
  publicView = false,
}: {
  teams: T[]
  publicView?: boolean
}) {
  // Public view only shows teams that have finished (escaped or timed out) —
  // never exposes future teams' configuration, codes, or in-progress state.
  const visibleTeams = publicView
    ? teams.filter((t) => t.status === 'ESCAPED' || t.status === 'TIME_EXPIRED')
    : teams

  const rows = buildLeaderboard(visibleTeams)

  return (
    <div className="overflow-x-auto rounded-md" style={{ border: '1px solid var(--line)' }}>
      <table className="w-full text-sm font-mono min-w-[640px]">
        <thead>
          <tr style={{ background: 'var(--bg-panel)', color: 'var(--text-mid)' }}>
            <th className="text-left px-4 py-3 font-medium tracking-wider text-xs uppercase">Rank</th>
            <th className="text-left px-4 py-3 font-medium tracking-wider text-xs uppercase">Team</th>
            <th className="text-left px-4 py-3 font-medium tracking-wider text-xs uppercase">Completion</th>
            <th className="text-left px-4 py-3 font-medium tracking-wider text-xs uppercase">Hints</th>
            <th className="text-left px-4 py-3 font-medium tracking-wider text-xs uppercase">Penalty</th>
            <th className="text-left px-4 py-3 font-medium tracking-wider text-xs uppercase">Official Ranking</th>
            <th className="text-left px-4 py-3 font-medium tracking-wider text-xs uppercase">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--text-dim)' }}>
                No teams have finished yet.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.team.id} className="border-t" style={{ borderColor: 'var(--line)' }}>
              <td className="px-4 py-3" style={{ color: row.rank === 1 ? 'var(--amber)' : 'var(--text-hi)' }}>
                {row.rank ?? '—'}
              </td>
              <td className="px-4 py-3" style={{ color: 'var(--text-hi)' }}>
                {row.team.name}
              </td>
              <td className="px-4 py-3" style={{ color: 'var(--text-mid)' }}>
                {formatDuration(row.team.completionSeconds)}
              </td>
              <td className="px-4 py-3" style={{ color: 'var(--text-mid)' }}>
                {row.team.hintsUsed} / 3
              </td>
              <td className="px-4 py-3" style={{ color: 'var(--amber)' }}>
                {row.team.hintPenaltySeconds !== undefined ? `+${formatDuration(row.team.hintPenaltySeconds)}` : '—'}
              </td>
              <td className="px-4 py-3 font-semibold" style={{ color: 'var(--cyan)' }}>
                {formatDuration(row.team.officialRankingSeconds)}
              </td>
              <td className="px-4 py-3">
                <span style={{ color: STATUS_COLOR[row.team.status] }}>{STATUS_LABEL[row.team.status]}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
