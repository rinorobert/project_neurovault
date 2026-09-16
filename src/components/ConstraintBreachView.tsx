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
  const { fetchConstraintBreach, requestConstraintBreachHint, submitCode } = useStore()
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
    if (hinting || disabled || team.constraintBreachHintRevealed) return
    setHinting(true)
    try {
      await requestConstraintBreachHint(team.id)
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
      if (!res.correct) {
        setLastResult(res)
        setShake(true)
        setTimeout(() => setShake(false), 500)
      } else {
        setLastResult(null)
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
  let revealedCellKey: string | null = null
  if (variantView) {
    for (let i = 0; i < variantView.forbiddenCells.length; i++) {
      const fc = variantView.forbiddenCells[i]
      const key = `${fc.row},${fc.col}`
      forbiddenSet.add(key)
      if (i >= 3) {
        revealedCellKey = key
      }
    }
  }

  // Constraint Breach's single participant-requested hint is separate from
  // the coordinator's general module hints. Only its server-owned reveal
  // flag may expose the hidden forbidden cell.
  const isHintUsed = team.constraintBreachHintRevealed === true
  const physicalBoardConfirmed = team.finalPuzzleCompleted === true

  if (!loading && !variantView) {
    return (
      <div className="w-full rounded-md p-6 text-center" style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}>
        <div className="font-display text-lg font-bold tracking-[0.2em]" style={{ color: 'var(--red)' }}>
          CONSTRAINT BREACH
        </div>
        <div className="font-mono text-xs tracking-[0.2em] mt-3" style={{ color: 'var(--text-mid)' }}>
          AWAITING COORDINATOR ASSIGNMENT
        </div>
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col gap-6">
      {/* 1. TOP TITLE & SYSTEM ALERT */}
      <div
        className="rounded-md p-5 flex flex-col gap-2.5"
        style={{
          background: 'rgba(255, 77, 77, 0.06)',
          border: '1px solid var(--red)',
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="font-display text-lg sm:text-2xl font-bold tracking-[0.2em]" style={{ color: 'var(--red)' }}>
            NEUROVAULT // CONSTRAINT BREACH
          </span>
          <span
            className="font-mono text-[11px] uppercase tracking-widest px-2.5 py-0.5 rounded-sm font-semibold"
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

      {/* 2. RESPONSIVE TWO-COLUMN GRID (Desktop: 7 cols Main / 5 cols Secondary) */}
      <div className="grid w-full grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.85fr)]">
        {/* ================================================================= */}
        {/* MAIN AREA (Left 7 Cols)                                           */}
        {/* ================================================================= */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* SYSTEM CONDITIONS / PUZZLE GUIDELINES */}
          <div
            className="rounded-md p-5 flex flex-col gap-3"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}
          >
            <div className="font-mono text-xs font-bold tracking-[0.25em]" style={{ color: 'var(--cyan)' }}>
              SYSTEM CONDITIONS / PUZZLE GUIDELINES
            </div>
            <ol className="font-mono text-xs flex flex-col gap-2 list-decimal list-inside" style={{ color: 'var(--text-mid)', lineHeight: '1.6' }}>
              <li>
                <strong style={{ color: 'var(--text-hi)' }}>Grid Population:</strong> Restore exactly 8 AI agents on the 8x8 coordination grid.
              </li>
              <li>
                <strong style={{ color: 'var(--text-hi)' }}>Column Vector:</strong> There must be exactly ONE AI agent in each column: A, B, C, D, E, F, G, H.
              </li>
              <li>
                <strong style={{ color: 'var(--text-hi)' }}>Row Vector:</strong> There must be exactly ONE AI agent in each row: 1 through 8.
              </li>
              <li>
                <strong style={{ color: 'var(--text-hi)' }}>Diagonal Vector:</strong> No two AI agents may share the same diagonal.
              </li>
              <li>
                <strong style={{ color: 'var(--text-hi)' }}>Fixed Agents:</strong> Fixed agents are locked to their specified coordinates and cannot be moved.
              </li>
              <li>
                <strong style={{ color: 'var(--text-hi)' }}>Forbidden Cells:</strong> Forbidden cells cannot contain any AI agent.
              </li>
              <li>
                <strong style={{ color: 'var(--text-hi)' }}>Physical Board:</strong> The actual configuration must be solved on the physical 8x8 board.
              </li>
              <li>
                <strong style={{ color: 'var(--text-hi)' }}>Override Recovery:</strong> After restoring the valid configuration, read the row position in each column from A through H to obtain the 8-digit Final Override sequence.
              </li>
            </ol>
          </div>

          {/* PHYSICAL 8x8 REFERENCE GRID */}
          <div
            className="rounded-md p-6 flex flex-col items-center gap-4"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}
          >
            <div className="w-full flex items-center justify-between flex-wrap gap-2 border-b pb-3" style={{ borderColor: 'var(--line)' }}>
              <div className="font-mono text-xs sm:text-sm font-bold tracking-[0.25em]" style={{ color: 'var(--cyan)' }}>
                PHYSICAL 8x8 REFERENCE GRID
              </div>
              <div className="font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-sm" style={{ border: '1px solid var(--line)', color: 'var(--text-dim)' }}>
                NON-INTERACTIVE TERMINAL
              </div>
            </div>

            <div className="font-mono text-xs text-center max-w-md" style={{ color: 'var(--text-dim)' }}>
              Use your physical board and agent tokens to solve the layout.
              This screen is a visual reference display.
            </div>

            {/* Reference Board Display */}
            <div className="flex w-full flex-col items-center select-none my-2">
              {/* Top Column Labels (A-H) */}
              <div className="grid w-full max-w-[34rem] grid-cols-8 text-center font-mono text-[11px] font-semibold mb-1" style={{ color: 'var(--cyan)' }}>
                {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((col) => (
                  <div key={col}>{col}</div>
                ))}
              </div>

              {/* Grid Rows (Rank 8 down to Rank 1) */}
              <div className="flex w-full max-w-[38rem] items-stretch justify-center">
                {/* Rank Labels Left */}
                <div className="grid grid-rows-8 self-stretch pr-2 font-mono text-[11px] font-semibold" style={{ color: 'var(--cyan)' }}>
                  {[8, 7, 6, 5, 4, 3, 2, 1].map((rank) => (
                    <div key={rank} className="flex w-4 items-center justify-center">{rank}</div>
                  ))}
                </div>

                {/* The 8x8 Cells */}
                <div
                  className="grid grid-cols-8 flex-none overflow-hidden rounded-xs border"
                  style={{
                    borderColor: 'var(--line)',
                    width: 'min(100%, 34rem)',
                    aspectRatio: '1 / 1',
                    gridTemplateRows: 'repeat(8, minmax(0, 1fr))',
                  }}
                >
                  {[7, 6, 5, 4, 3, 2, 1, 0].map((row) =>
                    [0, 1, 2, 3, 4, 5, 6, 7].map((col) => {
                      const key = `${row},${col}`
                      const agentId = fixedMap.get(key)
                      const isForbidden = forbiddenSet.has(key)
                      const isRevealedHint = key === revealedCellKey
                      const isLightSquare = (row + col) % 2 === 1

                      return (
                        <div
                          key={key}
                          className="relative flex min-h-0 min-w-0 items-center justify-center font-mono text-[10px] sm:text-xs"
                          style={{
                            background: isForbidden
                              ? isRevealedHint
                                ? 'rgba(245,166,35,0.22)'
                                : 'rgba(255,77,77,0.2)'
                              : agentId !== undefined
                                ? 'rgba(0,240,255,0.22)'
                                : isLightSquare
                                  ? 'var(--bg-raised)'
                                  : 'var(--bg-void)',
                            border: '1px solid rgba(255,255,255,0.05)',
                          }}
                          title={`${coordToAlg(row, col)}${agentId ? ` — Agent ${agentId} (Fixed)` : isRevealedHint ? ' — Forbidden Cell (Revealed by Hint 1)' : isForbidden ? ' — Forbidden Cell' : ''}`}
                        >
                          {agentId !== undefined ? (
                            <span
                              className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px]"
                              style={{
                                background: 'var(--cyan)',
                                color: 'var(--bg-void)',
                                boxShadow: '0 0 10px rgba(0,240,255,0.6)',
                              }}
                            >
                              {agentId}
                            </span>
                          ) : isForbidden ? (
                            <span
                              className="font-bold text-base leading-none"
                              style={{ color: isRevealedHint ? 'var(--amber)' : 'var(--red)' }}
                            >
                              ✕
                            </span>
                          ) : null}
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Rank Labels Right */}
                <div className="grid grid-rows-8 self-stretch pl-2 font-mono text-[11px] font-semibold" style={{ color: 'var(--cyan)' }}>
                  {[8, 7, 6, 5, 4, 3, 2, 1].map((rank) => (
                    <div key={rank} className="flex w-4 items-center justify-center">{rank}</div>
                  ))}
                </div>
              </div>

              {/* Bottom Column Labels (A-H) */}
              <div className="grid w-full max-w-[34rem] grid-cols-8 text-center font-mono text-[11px] font-semibold mt-1" style={{ color: 'var(--cyan)' }}>
                {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((col) => (
                  <div key={col}>{col}</div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center flex-wrap gap-5 mt-4 font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full bg-[var(--cyan)] inline-block shadow-[0_0_6px_var(--cyan)]" />
                  <span style={{ color: 'var(--text-hi)' }}>● FIXED AGENT</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[var(--red)]">✕</span>
                  <span style={{ color: 'var(--text-hi)' }}>FORBIDDEN CELL</span>
                </div>
                {isHintUsed && (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--amber)]">✕⚡</span>
                    <span style={{ color: 'var(--amber)' }}>REVEALED VIA HINT 1</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* SECONDARY AREA (Right 5 Cols)                                     */}
        {/* ================================================================= */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* FIXED AGENTS */}
          <div
            className="rounded-md p-5 flex flex-col gap-3"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}
          >
            <div className="flex items-center justify-between">
              <div className="font-mono text-xs font-bold tracking-[0.25em]" style={{ color: 'var(--cyan)' }}>
                FIXED AGENTS
              </div>
              <div className="font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
                {variantView?.fixedAgents.length ?? 0} Agents Locked
              </div>
            </div>
            <div className="font-mono text-xs flex flex-col gap-2.5">
              {variantView ? (
                variantView.fixedAgents.map((fa) => (
                  <div
                    key={fa.agentId}
                    className="flex items-center justify-between p-2 rounded-sm"
                    style={{ background: 'var(--bg-raised)', border: '1px solid rgba(0,240,255,0.15)' }}
                  >
                    <span className="font-semibold" style={{ color: 'var(--text-hi)' }}>
                      Agent {fa.agentId}
                    </span>
                    <span
                      className="font-bold px-2.5 py-0.5 rounded-sm"
                      style={{ background: 'var(--bg-void)', border: '1px solid var(--cyan)', color: 'var(--cyan)' }}
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
            <div className="flex items-center justify-between">
              <div className="font-mono text-xs font-bold tracking-[0.25em]" style={{ color: 'var(--amber)' }}>
                FORBIDDEN CELLS
              </div>
              <div className="font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
                {variantView?.forbiddenCells.length ?? 0} Corrupted Vectors
              </div>
            </div>
            <div className="font-mono text-xs flex flex-wrap gap-2">
              {variantView && variantView.forbiddenCells.length > 0 ? (
                variantView.forbiddenCells.map((fc, idx) => (
                  <span
                    key={`${fc.row}-${fc.col}`}
                    className="font-bold px-3 py-1.5 rounded-sm flex items-center gap-1.5"
                    style={{
                      background: idx >= 3 ? 'rgba(245,166,35,0.15)' : 'var(--bg-raised)',
                      border: `1px solid ${idx >= 3 ? 'var(--amber)' : 'var(--red)'}`,
                      color: idx >= 3 ? 'var(--amber)' : 'var(--red)',
                    }}
                    title={idx >= 3 ? 'Revealed by Hint 1' : 'Initial Forbidden Cell'}
                  >
                    <span>{coordToAlg(fc.row, fc.col)}</span>
                    {idx >= 3 && <span>⚡</span>}
                  </span>
                ))
              ) : (
                <span style={{ color: 'var(--text-dim)' }}>{loading ? 'Retrieving constraints...' : 'None reported'}</span>
              )}
            </div>
            {isHintUsed && (
              <div className="font-mono text-[11px] flex items-center gap-1.5 pt-1" style={{ color: 'var(--amber)' }}>
                <span>⚡</span>
                <span>4th forbidden cell revealed via Hint 1</span>
              </div>
            )}
          </div>

          {/* CONSTRAINT BREACH HINT (EXACTLY ONE HINT) */}
          <div
            className="rounded-md p-5 flex flex-col gap-3"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}
          >
            <div className="flex items-center justify-between">
              <div className="font-mono text-xs font-bold tracking-[0.25em]" style={{ color: 'var(--cyan)' }}>
                CONSTRAINT BREACH HINT
              </div>
              <div
                className="font-mono text-xs font-bold px-2 py-0.5 rounded-sm"
                style={{
                  background: isHintUsed ? 'rgba(245,166,35,0.15)' : 'var(--bg-raised)',
                  border: `1px solid ${isHintUsed ? 'var(--amber)' : 'var(--line)'}`,
                  color: isHintUsed ? 'var(--amber)' : 'var(--text-dim)',
                }}
              >
                Hints: {isHintUsed ? '1 / 1' : '0 / 1'}
              </div>
            </div>

            <div className="font-mono text-xs flex flex-col gap-1" style={{ color: 'var(--text-mid)' }}>
              <div>
                <strong style={{ color: 'var(--text-hi)' }}>Hint 1:</strong> Reveal the location of one hidden forbidden cell.
              </div>
              <div style={{ color: 'var(--amber)' }}>
                <strong>Penalty:</strong> +00:30
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                disabled={disabled || hinting || isHintUsed}
                onClick={handleHint}
                className="w-full font-display uppercase tracking-wider text-xs font-semibold px-4 py-2.5 rounded-sm transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: isHintUsed ? 'var(--bg-raised)' : 'transparent',
                  color: isHintUsed ? 'var(--text-dim)' : 'var(--amber)',
                  border: `1px solid ${isHintUsed ? 'var(--line)' : 'var(--amber)'}`,
                }}
              >
                {isHintUsed
                  ? 'HINT REVEALED (+00:30)'
                  : hinting
                    ? 'REVEALING HIDDEN CELL...'
                    : 'REQUEST HINT 1 (+00:30)'}
              </button>
            </div>
          </div>

          {/* FINAL OVERRIDE ENTRY — available only after the coordinator has
              confirmed the manually solved physical board. */}
          <div
            className="rounded-md p-6 flex flex-col items-center gap-4"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--cyan)' }}
          >
            <div className="font-mono text-xs font-bold tracking-[0.3em] text-center" style={{ color: 'var(--cyan)' }}>
              FINAL OVERRIDE
            </div>
            <div className="font-mono text-xs text-center max-w-sm" style={{ color: 'var(--text-mid)' }}>
              Read the 8-digit sequence from the restored physical board, from Column A through Column H.
            </div>

            {physicalBoardConfirmed ? (
              <CodeEntry
                length={8}
                onSubmit={handleFinalSubmit}
                disabled={disabled || attemptsExhausted || submitting}
                shake={shake}
                submitLabel={submitting ? 'VALIDATING...' : 'SUBMIT OVERRIDE'}
              />
            ) : (
              <div
                className="font-mono text-xs text-center px-4 py-3 rounded-sm"
                style={{ color: 'var(--text-mid)', border: '1px solid var(--line)', background: 'var(--bg-raised)' }}
              >
                A coordinator will confirm the restored physical board before Final Override entry is enabled.
              </div>
            )}

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

            {physicalBoardConfirmed && !attemptsExhausted && lastResult && !lastResult.correct && (
              <AccessDenied attemptsRemaining={lastResult.attemptsRemaining} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
