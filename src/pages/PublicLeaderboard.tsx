import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Leaderboard } from '../components/Leaderboard'
import type { LeaderboardRow, LeaderboardTeamLike } from '../lib/leaderboard'

const POLL_INTERVAL_MS = 3000

type LeaderboardApiState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'locked'; message: string }
  | { status: 'unlocked'; rows: LeaderboardRow<LeaderboardTeamLike>[] }

export default function PublicLeaderboard() {
  const [state, setState] = useState<LeaderboardApiState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch('/api/leaderboard', { credentials: 'same-origin' })
        const body = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setState({ status: 'error' })
          return
        }
        if (body.locked) {
          setState({ status: 'locked', message: body.message ?? 'Results will be revealed when authorized by the coordinator.' })
        } else {
          setState({ status: 'unlocked', rows: body.leaderboard ?? [] })
        }
      } catch {
        if (!cancelled) setState({ status: 'error' })
      }
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="min-h-screen px-5 sm:px-10 py-10 flex flex-col items-center gap-8">
      <div className="text-center">
        <div className="font-display text-2xl sm:text-4xl font-bold tracking-[0.2em]" style={{ color: 'var(--text-hi)' }}>
          PROJECT NEUROVAULT
        </div>
        <div className="font-mono text-xs sm:text-sm tracking-[0.3em] mt-2" style={{ color: 'var(--cyan)' }}>
          UNLOCK THE INTELLIGENCE WITHIN // OFFICIAL LEADERBOARD
        </div>
      </div>

      <div className="w-full max-w-3xl">
        {state.status === 'loading' && (
          <div className="font-mono text-sm text-center py-16" style={{ color: 'var(--text-dim)' }}>
            Connecting to server...
          </div>
        )}

        {state.status === 'error' && (
          <div className="font-mono text-sm text-center py-16" style={{ color: 'var(--red)' }}>
            Unable to reach the server. Retrying...
          </div>
        )}

        {state.status === 'locked' && (
          <div
            className="rounded-md py-16 px-8 flex flex-col items-center gap-4 text-center"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}
          >
            <div className="text-3xl">🔒</div>
            <div className="font-display text-xl font-bold tracking-[0.2em]" style={{ color: 'var(--amber)' }}>
              LEADERBOARD LOCKED
            </div>
            <div className="font-mono text-sm max-w-md" style={{ color: 'var(--text-mid)' }}>
              {state.message}
            </div>
          </div>
        )}

        {state.status === 'unlocked' && <Leaderboard teams={state.rows.map((r) => r.team)} />}
      </div>

      <Link to="/play" className="font-mono text-xs tracking-widest hover:underline" style={{ color: 'var(--text-dim)' }}>
        ← Return to Terminal
      </Link>
    </div>
  )
}
