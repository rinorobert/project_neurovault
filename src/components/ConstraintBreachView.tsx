import { useEffect, useState } from 'react'
import type { Team, ParticipantConstraintView } from '../types.js'
import { useStore } from '../state/store.js'
import { CodeEntry } from './CodeEntry.js'
import { AccessDenied } from './FailureScreen.js'

function coordToAlg(row: number, col: number): string {
  return `${String.fromCharCode(65 + col)}${row + 1}`
}

export function ConstraintBreachView({
  team,
  disabled = false,
}: {
  team: Team
  disabled?: boolean
}) {
  const { fetchConstraintBreach, useConstraintBreachHint, submitCode } = useStore()
  const [variantView, setVariantView] = useState<ParticipantConstraintView | null>(null)
  const [loading, setLoading] = useState(true)
  const [hinting, setHinting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [shake, setShake] = useState(false)
  const [lastResult, setLastResult] = useState<{ correct: boolean; attemptsRemaining: number | null } | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      const v = await fetchConstraintBreach(team.id)
      if (active) {
        setVariantView(v)
        setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [team.id, team.constraintBreachHintRevealed, fetchConstraintBreach])

  async function handleHint() {
    if (hinting || disabled || team.hintsUsed >= 3) return
    setHinting(true)
    try {
      await useConstraintBreachHint(team.id)
      const refreshed = await fetchConstraintBreach(team.id)
      if (refreshed) setVariantView(refreshed)
    } finally {
      setHinting(false)
    }
  }

  async function handleFinalSubmit(code: string) {
    if (submitting || disabled) return
    setSubmitting(true)
    try {
      const res = await submitCode(team.id, code)
      setLastResult(res)
      if (!res.correct) {
        setShake(true)
        setTimeout(() => setShake(false), 500)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const attemptsExhausted =
    team.maxAttempts !== undefined && team.attempts >= team.maxAttempts && team.status !== 'ESCAPED'

  // Lookups for 8x8 grid rendering (files A-H cols 0-7, ranks 8-1 top-to-bottom rows 7-0)
  const fixedMap = new Map<string, number>()
  if (variantView) {
    for (const fa of variantView.fixedAgents) {
      fixedMap.set(`${fa.row},${fa.col}`, fa.agentId)
    }
  }

  const forbiddenSet = new Set<string>()
  if (variantView) {
    for (const fc of variantView.forbiddenCells) {
      forbiddenSet.add(`${fc.row},${fc.col}`)
    }
  }

  return (
    <div className="w-full max-w-2xl flex flex-col gap-8">
      {/* 1. SECTION TITLE & SYSTEM ALERT */}
      <div
        className="rounded-md p-6 flex flex-col gap-3"
        style={{
          background: 'rgba(255, 77, 77, 0.05)',
          border: '1px solid var(--red)',
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="font-display text-lg sm:text-xl font-bold tracking-[0.2em]" style={{ color: 'var(--red)' }}>
            NEUROVAULT // CONSTRAINT BREACH
          </span>
          <span
            className="font-mono text-[11px] uppercase tracking-widest px-2 py-0.5 rounded-sm"
            style={{ border: '1px solid var(--red)', color: 'var(--red)' }}
          >
            SYSTEM ALERT
          </span>
        </div>
        <p className="font-mono text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--text-hi)' }}>
          Eight AI agents have been displaced from their assigned positions.
          The NEUROVAULT coordination grid is unstable.
          Restore the agents to valid positions and recover the final override sequence.
        </p>
      </div>

      {/* 2. FIXED AGENTS & FORBIDDEN CELLS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* FIXED AGENTS */}
        <div
          className="rounded-md p-5 flex flex-col gap-3"
          style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}
        >
          <div className="font-mono text-xs tracking-[0.25em]" style={{ color: 'var(--cyan)' }}>
            FIXED AGENTS
          </div>
          <div className="font-mono text-xs flex flex-col gap-2">
            {variantView ? (
              variantView.fixedAgents.map((fa) => (
                <div key={fa.agentId} className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-dim)' }}>Agent {fa.agentId}</span>
                  <span
                    className="font-bold px-2 py-0.5 rounded-sm"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--cyan)', color: 'var(--cyan)' }}
                  >
                    → {coordToAlg(fa.row, fa.col)}
                  </span>
                </div>
              ))
            ) : (
              <span style={{ color: 'var(--text-dim)' }}>{loading ? 'Retrieving coordinates...' : 'Awaiting assignment'}</span>
            )}
          </div>
        </div>

        {/* FORBIDDEN CELLS */}
        <div
          className="rounded-md p-5 flex flex-col gap-3"
          style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}
        >
          <div className="font-mono text-xs tracking-[0.25em]" style={{ color: 'var(--amber)' }}>
            FORBIDDEN CELLS
          </div>
          <div className="font-mono text-xs flex flex-wrap gap-2">
            {variantView && variantView.forbiddenCells.length > 0 ? (
              variantView.forbiddenCells.map((fc, idx) => (
                <span
                  key={`${fc.row}-${fc.col}`}
                  className="font-bold px-2.5 py-1 rounded-sm"
                  style={{
                    background: idx >= 3 ? 'rgba(245,166,35,0.15)' : 'var(--bg-raised)',
                    border: `1px solid ${idx >= 3 ? 'var(--amber)' : 'var(--red)'}`,
                    color: idx >= 3 ? 'var(--amber)' : 'var(--red)',
                  }}
                  title={idx >= 3 ? 'Revealed by Hint 1' : 'Initial Forbidden Cell'}
                >
                  {coordToAlg(fc.row, fc.col)} {idx >= 3 && '⚡'}
                </span>
              ))
            ) : (
              <span style={{ color: 'var(--text-dim)' }}>{loading ? 'Retrieving constraints...' : 'None reported'}</span>
            )}
          </div>
          {team.constraintBreachHintRevealed && (
            <div className="font-mono text-[10px]" style={{ color: 'var(--amber)' }}>
              ⚡ 4th forbidden cell revealed via Hint 1
            </div>
          )}
        </div>
      </div>

      {/* 3. SYSTEM CONDITIONS */}
      <div
        className="rounded-md p-5 flex flex-col gap-2"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}
      >
        <div className="font-mono text-xs tracking-[0.25em]" style={{ color: 'var(--text-dim)' }}>
          SYSTEM CONDITIONS
        </div>
        <ul className="font-mono text-xs flex flex-col gap-1.5 list-disc list-inside" style={{ color: 'var(--text-mid)' }}>
          <li>Restore exactly 8 AI agents across the 8x8 coordination grid (one per file and one per rank).</li>
          <li>No two AI agents may share the same column (A–H), row (1–8), or diagonal vector.</li>
          <li>Fixed agents are locked and cannot be relocated from their designated coordinates.</li>
          <li>Forbidden cells are corrupted vectors and cannot be occupied by any agent.</li>
          <li>Solve the configuration on your physical coordination grid and recover the 8-digit Override Sequence.</li>
        </ul>
      </div>

      {/* 4. PHYSICAL GRID REQUIRED & 8x8 REFERENCE GRID */}
      <div
        className="rounded-md p-6 flex flex-col items-center gap-5"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--cyan)' }}
      >
        <div className="w-full flex items-center justify-between flex-wrap gap-2 border-b pb-3" style={{ borderColor: 'var(--line)' }}>
          <div className="font-mono text-xs sm:text-sm font-bold tracking-[0.25em]" style={{ color: 'var(--cyan)' }}>
            PHYSICAL GRID REQUIRED
          </div>
          <div className="font-mono text-[10px] tracking-widest" style={{ color: 'var(--text-dim)' }}>
            8x8 REFERENCE DISPLAY TERMINAL
          </div>
        </div>

        <div className="font-mono text-xs text-center max-w-md" style={{ color: 'var(--text-dim)' }}>
          Perform grid restoration manually using the physical 8x8 board and AI agent tokens.
          Use this terminal as your reference briefing.
        </div>

        {/* 8x8 Board Display */}
        <div className="flex flex-col items-center select-none">
          {/* Top Column Labels (A-H) */}
          <div className="grid grid-cols-8 w-64 sm:w-80 text-center font-mono text-[11px] mb-1" style={{ color: 'var(--text-dim)' }}>
            {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((col) => (
              <div key={col}>{col}</div>
            ))}
          </div>

          {/* Grid Rows (Rank 8 down to Rank 1) */}
          <div className="flex">
            {/* Rank Labels Left */}
            <div className="flex flex-col justify-around pr-2 font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
              {[8, 7, 6, 5, 4, 3, 2, 1].map((rank) => (
                <div key={rank} className="h-8 sm:h-10 flex items-center">{rank}</div>
              ))}
            </div>

            {/* The 8x8 Cells */}
            <div
              className="grid grid-cols-8 border rounded-xs overflow-hidden"
              style={{ borderColor: 'var(--line)', width: '20rem', maxWidth: '100%' }}
            >
              {[7, 6, 5, 4, 3, 2, 1, 0].map((row) =>
                [0, 1, 2, 3, 4, 5, 6, 7].map((col) => {
                  const key = `${row},${col}`
                  const agentId = fixedMap.get(key)
                  const isForbidden = forbiddenSet.has(key)
                  const isLightSquare = (row + col) % 2 === 1

                  return (
                    <div
                      key={key}
                      className="h-8 sm:h-10 flex items-center justify-center font-mono text-[10px] sm:text-xs relative"
                      style={{
                        background: isForbidden
                          ? 'rgba(255,77,77,0.18)'
                          : agentId !== undefined
                            ? 'rgba(0,240,255,0.18)'
                            : isLightSquare
                              ? 'var(--bg-raised)'
                              : 'var(--bg-void)',
                        border: '1px solid rgba(255,255,255,0.04)',
                      }}
                      title={`${coordToAlg(row, col)}${agentId ? ` — Agent ${agentId} (Fixed)` : isForbidden ? ' — Forbidden Cell' : ''}`}
                    >
                      {agentId !== undefined ? (
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px]"
                          style={{
                            background: 'var(--cyan)',
                            color: 'var(--bg-void)',
                            boxShadow: '0 0 8px var(--cyan)',
                          }}
                        >
                          {agentId}
                        </span>
                      ) : isForbidden ? (
                        <span className="font-bold text-sm leading-none" style={{ color: 'var(--red)' }}>
                          ✕
                        </span>
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>

            {/* Rank Labels Right */}
            <div className="flex flex-col justify-around pl-2 font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
              {[8, 7, 6, 5, 4, 3, 2, 1].map((rank) => (
                <div key={rank} className="h-8 sm:h-10 flex items-center">{rank}</div>
              ))}
            </div>
          </div>

          {/* Bottom Column Labels (A-H) */}
          <div className="grid grid-cols-8 w-64 sm:w-80 text-center font-mono text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
            {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((col) => (
              <div key={col}>{col}</div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 mt-4 font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-[var(--cyan)] inline-block" />
              <span>Fixed Agent</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[var(--red)]">✕</span>
              <span>Forbidden Cell</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. CONSTRAINT BREACH HINTS */}
      <div
        className="rounded-md p-5 flex flex-col gap-3"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}
      >
        <div className="flex items-center justify-between">
          <div className="font-mono text-xs tracking-[0.25em]" style={{ color: 'var(--cyan)' }}>
            CONSTRAINT BREACH HINTS
          </div>
          <div className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
            Hints: {team.hintsUsed} / 3
          </div>
        </div>

        <div className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
          Hint 1 reveals the hidden 4th forbidden cell to reduce placement entropy (+30s penalty).
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={disabled || hinting || team.constraintBreachHintRevealed === true || team.hintsUsed >= 3}
            onClick={handleHint}
            className="font-display uppercase tracking-wider text-xs font-semibold px-4 py-2 rounded-sm transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: team.constraintBreachHintRevealed ? 'var(--bg-raised)' : 'transparent',
              color: team.constraintBreachHintRevealed ? 'var(--text-dim)' : 'var(--amber)',
              border: `1px solid ${team.constraintBreachHintRevealed ? 'var(--line)' : 'var(--amber)'}`,
            }}
          >
            {team.constraintBreachHintRevealed
              ? 'HINT 1 — REVEALED (+30s)'
              : hinting
                ? 'REVEALING...'
                : 'REQUEST HINT 1 (+30s)'}
          </button>
        </div>
      </div>

      {/* 6. FINAL OVERRIDE ENTRY */}
      <div
        className="rounded-md p-6 flex flex-col items-center gap-4"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}
      >
        <div className="font-mono text-xs tracking-[0.3em] text-center" style={{ color: 'var(--cyan)' }}>
          FINAL OVERRIDE
        </div>
        <div className="font-mono text-[11px] text-center max-w-sm" style={{ color: 'var(--text-dim)' }}>
          Read the 8-digit sequence from your restored physical board (Column A through Column H) and submit below.
        </div>

        <CodeEntry
          length={8}
          onSubmit={handleFinalSubmit}
          disabled={disabled || attemptsExhausted || submitting}
          shake={shake}
          submitLabel={submitting ? 'VALIDATING...' : 'SUBMIT OVERRIDE'}
        />

        {team.maxAttempts !== undefined && (
          <div className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
            Attempts remaining: {Math.max(0, team.maxAttempts - team.attempts)}
          </div>
        )}

        {attemptsExhausted && (
          <div
            className="font-mono text-xs tracking-widest px-4 py-2 rounded-sm text-center"
            style={{ color: 'var(--red)', border: '1px solid var(--red)' }}
          >
            OVERRIDE LOCKED — NO ATTEMPTS REMAINING. CONTACT YOUR COORDINATOR.
          </div>
        )}

        {!attemptsExhausted && lastResult && !lastResult.correct && (
          <AccessDenied attemptsRemaining={lastResult.attemptsRemaining} />
        )}
      </div>
    </div>
  )
}
