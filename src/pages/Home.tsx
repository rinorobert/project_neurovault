import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-12 px-6">
      <div className="text-center">
        <div className="font-display text-3xl sm:text-5xl font-bold tracking-[0.25em] flicker" style={{ color: 'var(--text-hi)' }}>
          PROJECT NEUROVAULT
        </div>
        <div className="font-mono text-xs sm:text-sm tracking-[0.35em] mt-3" style={{ color: 'var(--cyan)' }}>
          UNLOCK THE INTELLIGENCE WITHIN
        </div>
        <div className="font-mono text-[11px] tracking-[0.2em] mt-2" style={{ color: 'var(--text-dim)' }}>
          HIGH-SECURITY AI CONTAINMENT PROTOCOL
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-5 w-full max-w-2xl">
        <Link
          to="/play"
          className="flex-1 rounded-md p-8 text-center transition-transform hover:scale-[1.02]"
          style={{ background: 'var(--bg-panel)', border: '1px solid var(--cyan)' }}
        >
          <div className="font-display text-lg font-bold tracking-widest" style={{ color: 'var(--cyan)' }}>
            PARTICIPANT TERMINAL
          </div>
          <div className="font-mono text-xs mt-2" style={{ color: 'var(--text-dim)' }}>
            Physical Escape Room Station Display
          </div>
        </Link>

        <Link
          to="/coordinator/login"
          className="flex-1 rounded-md p-8 text-center transition-transform hover:scale-[1.02]"
          style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}
        >
          <div className="font-display text-lg font-bold tracking-widest" style={{ color: 'var(--text-hi)' }}>
            COORDINATOR ACCESS
          </div>
          <div className="font-mono text-xs mt-2" style={{ color: 'var(--text-dim)' }}>
            PIN Required
          </div>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Link to="/register" className="font-mono text-xs tracking-widest hover:underline" style={{ color: 'var(--cyan)' }}>
          Register Your Team →
        </Link>
        <Link to="/leaderboard" className="font-mono text-xs tracking-widest hover:underline" style={{ color: 'var(--text-dim)' }}>
          View Public Leaderboard →
        </Link>
      </div>
    </div>
  )
}
