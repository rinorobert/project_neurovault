import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../state/store.js'

export default function Home() {
  const [introVisible, setIntroVisible] = useState(true)
  // Settings are synchronized from /api/state; this is deliberately not a
  // locally persisted preference. The server remains authoritative if a
  // participant tries to navigate to the route directly.
  const { settings } = useStore()

  return (
    <>
      {introVisible && (
        <video
          className="fixed inset-0 z-50 h-screen w-screen object-cover bg-black transition-opacity duration-700"
          src="/media/NV.mp4"
          autoPlay
          muted
          playsInline
          preload="metadata"
          aria-label="Project NeuroVault introduction"
          onEnded={() => setIntroVisible(false)}
          onError={() => setIntroVisible(false)}
        />
      )}
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
        {settings.publicLeaderboardUnlocked ? (
          <Link to="/leaderboard" className="font-mono text-xs tracking-widest hover:underline" style={{ color: 'var(--text-dim)' }}>
            View Public Leaderboard →
          </Link>
        ) : (
          <span
            className="font-mono text-xs tracking-widest cursor-not-allowed"
            aria-disabled="true"
            title="The coordinator has not released the public leaderboard yet."
            style={{ color: 'var(--text-dim)', opacity: 0.55 }}
          >
            🔒 Public Leaderboard Locked
          </span>
        )}
      </div>
      </div>
    </>
  )
}
