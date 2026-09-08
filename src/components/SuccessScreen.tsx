import { useEffect, useRef } from 'react'
import type { Team } from '../types'
import { formatDuration } from '../lib/timer'

export function SuccessScreen({ team, playSound = true }: { team: Team; playSound?: boolean }) {
  const played = useRef(false)

  useEffect(() => {
    if (!playSound || played.current) return
    played.current = true
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const now = ctx.currentTime
      // Simple ascending three-tone chime — no external audio file needed (offline-safe).
      ;[523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.0001, now + i * 0.14)
        gain.gain.exponentialRampToValueAtTime(0.18, now + i * 0.14 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.5)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + i * 0.14)
        osc.stop(now + i * 0.14 + 0.55)
      })
    } catch {
      // Audio not available — silently ignore, never block the success flow.
    }
  }, [playSound])

  return (
    <div className="fade-up flex flex-col items-center text-center gap-6 py-10">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
        style={{ border: '2px solid var(--green)', color: 'var(--green)', boxShadow: '0 0 40px rgba(53,226,140,0.35)' }}
      >
        ✓
      </div>
      <div>
        <div className="font-display text-3xl sm:text-4xl font-bold tracking-widest" style={{ color: 'var(--green)' }}>
          ACCESS GRANTED
        </div>
        <div className="font-mono text-sm sm:text-base mt-2 tracking-[0.3em]" style={{ color: 'var(--text-mid)' }}>
          SYSTEM RESTORED — ESCAPE SUCCESSFUL
        </div>
      </div>

      <div className="w-full max-w-sm rounded-md p-6 mt-2" style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}>
        <div className="font-display text-lg font-semibold tracking-wide mb-4">{team.name}</div>
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
          <div>
            <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
              Hint Penalty
            </div>
            <div className="font-mono text-xl" style={{ color: 'var(--amber)' }}>
              {team.hintPenaltySeconds !== undefined ? `+${formatDuration(team.hintPenaltySeconds)}` : '—'}
            </div>
          </div>
          <div>
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
