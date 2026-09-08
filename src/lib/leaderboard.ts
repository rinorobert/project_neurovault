import type { Team } from '../types'

/**
 * The minimal shape buildLeaderboard/the Leaderboard component actually
 * need. A full `Team` satisfies this structurally, so every existing
 * coordinator-side call site (which passes full Team[]) keeps working
 * unchanged — but it also lets the PUBLIC leaderboard page safely reuse
 * this exact ranking logic against the pre-sanitized, contact-info-free
 * rows returned by GET /api/leaderboard (toPublicLeaderboardTeamView),
 * without ever needing a full Team object client-side.
 */
export type LeaderboardTeamLike = Pick<
  Team,
  'id' | 'name' | 'status' | 'completionSeconds' | 'hintsUsed' | 'hintPenaltySeconds' | 'officialRankingSeconds'
>

export interface LeaderboardRow<T extends LeaderboardTeamLike = Team> {
  team: T
  rank: number | null // null for teams that haven't escaped
}

/**
 * Ranks strictly by each team's frozen `officialRankingSeconds`. Never
 * touches the live clock — a team that hasn't finished simply isn't ranked
 * (it won't be ESCAPED or TIME_EXPIRED, so it's excluded entirely).
 */
export function buildLeaderboard<T extends LeaderboardTeamLike>(teams: T[]): LeaderboardRow<T>[] {
  const escaped = teams.filter((t) => t.status === 'ESCAPED')
  const expired = teams.filter((t) => t.status === 'TIME_EXPIRED')

  const scored = [...escaped].sort(
    (a, b) => (a.officialRankingSeconds ?? Infinity) - (b.officialRankingSeconds ?? Infinity)
  )

  const rows: LeaderboardRow<T>[] = scored.map((team, i) => ({ team, rank: i + 1 }))
  const expiredRows: LeaderboardRow<T>[] = expired.map((team) => ({ team, rank: null }))

  return [...rows, ...expiredRows]
}
