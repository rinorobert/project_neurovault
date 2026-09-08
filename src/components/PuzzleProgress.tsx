import type { Team } from '../types.js'
import { INITIAL_PUZZLE_SLOTS, PUZZLE_SLOT_SYSTEM_TITLES } from '../types.js'
import { areInitialPuzzlesCompleted } from '../engine/gameEngine.js'

export function PuzzleProgress({ team, compact = false }: { team: Team; compact?: boolean }) {
  const initialDone = areInitialPuzzlesCompleted(team)

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[10px] font-mono tracking-widest uppercase" style={{ color: 'var(--text-dim)' }}>
        PARALLEL SUBSYSTEMS (4 PLAYERS)
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {INITIAL_PUZZLE_SLOTS.map((slot, i) => {
          const done = team.puzzleCompleted[slot]
          return (
            <div
              key={slot}
              className="flex items-center gap-2.5 p-2 rounded-sm"
              style={{
                background: done ? 'rgba(53,226,140,0.06)' : 'var(--bg-raised)',
                border: `1px solid ${done ? 'rgba(53,226,140,0.3)' : 'var(--line)'}`,
              }}
            >
              <span
                className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[11px] font-mono border"
                style={{
                  borderColor: done ? 'var(--green)' : 'var(--line)',
                  background: done ? 'rgba(53,226,140,0.15)' : 'transparent',
                  color: done ? 'var(--green)' : 'var(--text-dim)',
                }}
              >
                {done ? '✓' : i + 1}
              </span>
              <div className="flex flex-col min-w-0">
                <span
                  className="font-mono text-xs font-semibold truncate"
                  style={{ color: done ? 'var(--text-hi)' : 'var(--text-mid)' }}
                >
                  {compact ? `Mod ${i + 1}` : PUZZLE_SLOT_SYSTEM_TITLES[slot]}
                </span>
                <span className="font-mono text-[10px]" style={{ color: done ? 'var(--green)' : 'var(--text-dim)' }}>
                  {done ? 'RESTORED' : 'PENDING'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div
        className="mt-1 pt-3 border-t flex items-center justify-between p-2 rounded-sm"
        style={{
          borderColor: 'var(--line)',
          background: team.finalPuzzleCompleted
            ? 'rgba(53,226,140,0.08)'
            : initialDone
            ? 'rgba(76,224,210,0.06)'
            : 'transparent',
          border: `1px solid ${
            team.finalPuzzleCompleted
              ? 'var(--green)'
              : initialDone
              ? 'var(--cyan)'
              : 'var(--line)'
          }`,
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[11px] font-mono border"
            style={{
              borderColor: team.finalPuzzleCompleted
                ? 'var(--green)'
                : initialDone
                ? 'var(--cyan)'
                : 'var(--line)',
              background: team.finalPuzzleCompleted
                ? 'rgba(53,226,140,0.15)'
                : initialDone
                ? 'rgba(76,224,210,0.15)'
                : 'transparent',
              color: team.finalPuzzleCompleted
                ? 'var(--green)'
                : initialDone
                ? 'var(--cyan)'
                : 'var(--text-dim)',
            }}
          >
            {team.finalPuzzleCompleted ? '✓' : initialDone ? '!' : '🔒'}
          </span>
          <div className="flex flex-col">
            <span
              className="font-mono text-xs sm:text-sm font-semibold tracking-wide"
              style={{
                color: team.finalPuzzleCompleted
                  ? 'var(--green)'
                  : initialDone
                  ? 'var(--cyan)'
                  : 'var(--text-dim)',
              }}
            >
              FINAL COLLABORATIVE OVERRIDE
            </span>
            <span className="font-mono text-[10px]" style={{ color: 'var(--text-dim)' }}>
              {team.finalPuzzleCompleted
                ? 'COLLABORATIVE OVERRIDE COMPLETE'
                : initialDone
                ? 'ALL 4 STATIONS COMPLETE — READY FOR FINAL CHALLENGE'
                : 'LOCKED (Requires 4 initial station completions)'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
