import { useEffect, useRef } from 'react'
import type { Team } from '../types.js'
import { formatDuration } from '../lib/timer.js'

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

  // Constraint Breach has its own single permitted hint. The overall team
  // hint count may include earlier module hints, so it is not appropriate for
  // this final-stage summary.
  const constraintHintsUsed = team.constraintBreachHintRevealed ? 1 : 0

  return (
    <div className="fade-up flex flex-col items-center text-center gap-6 py-10">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
        style={{ border: '2px solid var(--green)', color: 'var(--green)', boxShadow: '0 0 40px rgba(53,226,140,0.35)' }}
      >
        ✓
      </div>
      <div>
        <div className="font-mono text-xs sm:text-sm tracking-[0.4em] mb-1" style={{ color: 'var(--text-dim)' }}>
          NEUROVAULT
        </div>
        <div className="font-display text-3xl sm:text-4xl font-bold tracking-widest" style={{ color: 'var(--green)' }}>
          ACCESS GRANTED
        </div>
        <div className="font-display text-xl sm:text-2xl font-semibold tracking-wider mt-1" style={{ color: 'var(--text-hi)' }}>
          SUCCESSFUL ESCAPE
        </div>
        <div className="font-mono text-sm sm:text-base mt-2 tracking-[0.3em]" style={{ color: 'var(--cyan)' }}>
          SYSTEM RESTORED
        </div>
      </div>

      <div className="w-full max-w-md rounded-md p-6 mt-2" style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}>
        <div className="font-display text-lg font-semibold tracking-wide mb-4 text-center">{team.name}</div>
        <div className="grid grid-cols-2 gap-4 text-left">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
              COMPLETION TIME
            </div>
            <div className="font-mono text-xl" style={{ color: 'var(--text-hi)' }}>
              {formatDuration(team.completionSeconds)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
              HINTS USED
            </div>
            <div className="font-mono text-xl" style={{ color: 'var(--text-hi)' }}>
              {constraintHintsUsed} / 1
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
              PENALTY
            </div>
            <div className="font-mono text-xl" style={{ color: 'var(--amber)' }}>
              {team.hintPenaltySeconds !== undefined ? `+${formatDuration(team.hintPenaltySeconds)}` : '+00:00'}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
              OFFICIAL STATUS
            </div>
            <div className="font-mono text-xl font-bold" style={{ color: 'var(--green)' }}>
              ESCAPED
            </div>
          </div>
        </div>

        {team.officialRankingSeconds !== undefined && (
          <div className="mt-4 pt-4 border-t text-center" style={{ borderColor: 'var(--line)' }}>
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
              OFFICIAL RANKING TIME
            </div>
            <div className="font-mono text-2xl font-bold mt-0.5" style={{ color: 'var(--cyan)' }}>
              {formatDuration(team.officialRankingSeconds)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
