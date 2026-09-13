import { useState } from 'react'
import type { Team, PuzzleVersion, InitialPuzzleSlotKey } from '../types.js'
import { ALL_PUZZLE_SLOTS, PUZZLE_SLOT_LABELS } from '../types.js'
import { computeFinalCode } from '../lib/finalCode.js'
import { useStore } from '../state/store.js'
import { areInitialPuzzlesCompleted } from '../engine/gameEngine.js'

const CB_VARIANTS_CONFIG = [
  {
    id: 'CB-01',
    name: 'CB-01 — THE BREACH',
    fixed: 'Agent 2 → H2, Agent 5 → A5, Agent 6 → G6',
    forbidden: 'H1, C5, F3 (Hint 1: D1)',
    overrideCode: '53847162',
  },
  {
    id: 'CB-02',
    name: 'CB-02 — THE FRACTURE',
    fixed: 'Agent 2 → B6, Agent 5 → E1, Agent 6 → F4',
    forbidden: 'H8, C7, G5 (Hint 1: D3)',
    overrideCode: '36271485',
  },
  {
    id: 'CB-03',
    name: 'CB-03 — THE COLLAPSE',
    fixed: 'Agent 2 → B8, Agent 5 → E1, Agent 6 → F7',
    forbidden: 'D6, C4, A3 (Hint 1: G5)',
    overrideCode: '48531726',
  },
]

export function PuzzleConfigPanel({ team, puzzleVersions }: { team: Team; puzzleVersions: PuzzleVersion[] }) {
  const { setPuzzleVersion, markPuzzleCompleted, updateTeam, changeFinalCodeOverride, assignConstraintVariant, completeConstraintBreachAction } = useStore()
  const [editingCode, setEditingCode] = useState(false)
  const [codeDraft, setCodeDraft] = useState('')

  const expectedCode = computeFinalCode(team, puzzleVersions)
  const initialDone = areInitialPuzzlesCompleted(team)

  const activeCbVariant = CB_VARIANTS_CONFIG.find(
    (v) => v.id.toUpperCase() === (team.constraintBreachVariantId?.toUpperCase() ?? 'CB-01')
  ) ?? CB_VARIANTS_CONFIG[0]

  return (
    <div className="rounded-md p-5 flex flex-col gap-4" style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="font-mono text-xs tracking-[0.25em]" style={{ color: 'var(--text-dim)' }}>
          PUZZLE CONFIGURATION (5 SLOTS)
        </div>
        <div className="font-mono text-[10px]" style={{ color: initialDone ? 'var(--green)' : 'var(--amber)' }}>
          {initialDone ? '4 INITIAL STATIONS RESOLVED' : 'INITIAL STATIONS IN PROGRESS'}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {ALL_PUZZLE_SLOTS.map((slot) => {
          const isFinal = slot === 'FINAL_SLOT'
          const versions = puzzleVersions.filter((v) => v.slot === slot)
          const assignment = team.puzzleAssignments.find((a) => a.slot === slot)
          const currentVersion = versions.find((v) => v.id === assignment?.puzzleVersionId)

          if (isFinal) {
            const isDone = team.finalPuzzleCompleted
            const isEnabled = team.finalModuleEnabled === true

            return (
              <div
                key={slot}
                className="flex flex-col gap-3 p-3 rounded-sm"
                style={{
                  background: 'var(--bg-raised)',
                  border: `1px solid ${isDone ? 'var(--green)' : isEnabled ? 'var(--cyan)' : 'var(--line)'}`,
                }}
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-semibold" style={{ color: isDone ? 'var(--green)' : 'var(--text-hi)' }}>
                      PUZZLE 5: CONSTRAINT BREACH (PHYSICAL 8x8 GRID)
                    </span>
                    <span
                      className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm"
                      style={{
                        border: `1px solid ${isDone ? 'var(--green)' : isEnabled ? 'var(--cyan)' : 'var(--text-dim)'}`,
                        color: isDone ? 'var(--green)' : isEnabled ? 'var(--cyan)' : 'var(--text-dim)',
                      }}
                    >
                      {isDone ? 'Physical Grid Solved' : isEnabled ? 'Final Module Enabled' : 'Locked'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer font-mono text-xs" style={{ color: 'var(--text-hi)' }}>
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => updateTeam(team.id, { finalModuleEnabled: e.target.checked })}
                        className="w-4 h-4 accent-[var(--cyan)]"
                      />
                      <span>Enable Final Module</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-mono text-xs" style={{ color: 'var(--text-hi)' }}>
                      <input
                        type="checkbox"
                        checked={isDone}
                        disabled={isDone || !isEnabled || !team.recoveryCodeUnlocked}
                        onChange={(e) => {
                          if (e.target.checked) void completeConstraintBreachAction(team.id)
                        }}
                        className="w-4 h-4 accent-[var(--green)]"
                      />
                      <span>Physical Grid Solved</span>
                    </label>
                  </div>
                </div>

                {/* Variant Selector */}
                <div className="flex items-center gap-3 flex-wrap pt-2 border-t" style={{ borderColor: 'var(--line)' }}>
                  <span className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
                    Assigned Variant:
                  </span>
                  <select
                    value={team.constraintBreachVariantId ?? 'CB-01'}
                    onChange={(e) => assignConstraintVariant(team.id, e.target.value)}
                    className="font-mono text-xs rounded-sm px-2.5 py-1.5 outline-none font-semibold"
                    style={{ background: 'var(--bg-void)', border: '1px solid var(--cyan)', color: 'var(--cyan)' }}
                  >
                    {CB_VARIANTS_CONFIG.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} (Override: {v.overrideCode})
                      </option>
                    ))}
                  </select>

                  <span className="font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
                    Fixed: <strong style={{ color: 'var(--text-hi)' }}>{activeCbVariant.fixed}</strong>
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
                    Forbidden: <strong style={{ color: 'var(--text-hi)' }}>{activeCbVariant.forbidden}</strong>
                  </span>
                </div>

                {!team.recoveryCodeUnlocked && (
                  <div className="font-mono text-[10px]" style={{ color: 'var(--amber)' }}>
                    ⚠️ Note: Final module participant interface also requires the 4-digit Recovery Code to be unlocked.
                  </div>
                )}
              </div>
            )
          }

          const isDone = team.puzzleCompleted[slot as InitialPuzzleSlotKey]

          return (
            <div
              key={slot}
              className="flex flex-col gap-1 p-2.5 rounded-sm"
              style={{
                background: 'var(--bg-raised)',
                border: `1px solid ${isDone ? 'rgba(53,226,140,0.3)' : 'var(--line)'}`,
              }}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={(e) => markPuzzleCompleted(team.id, slot, e.target.checked, currentVersion?.outputFragment)}
                  className="w-4 h-4 accent-[var(--cyan)] cursor-pointer"
                />
                <span
                  className="font-mono text-xs w-60 shrink-0 font-medium"
                  style={{ color: isDone ? 'var(--green)' : 'var(--text-hi)' }}
                >
                  {PUZZLE_SLOT_LABELS[slot]}
                </span>
                <select
                  value={assignment?.puzzleVersionId ?? ''}
                  onChange={(e) => setPuzzleVersion(team.id, slot, e.target.value)}
                  className="font-mono text-xs rounded-sm px-2 py-1.5 outline-none"
                  style={{ background: 'var(--bg-void)', border: '1px solid var(--line)', color: 'var(--text-hi)' }}
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.version} — {v.title} {v.outputDigit !== undefined ? `(Digit ${v.outputDigit})` : ''}
                    </option>
                  ))}
                </select>
                {currentVersion?.outputDigit !== undefined && (
                  <span className="font-mono text-xs" style={{ color: 'var(--cyan)' }}>
                    → {currentVersion.outputDigit}
                  </span>
                )}
                {isDone && (
                  <span
                    className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm"
                    style={{ border: '1px solid var(--green)', color: 'var(--green)' }}
                  >
                    Resolved
                  </span>
                )}
              </div>
              {currentVersion?.hint && (
                <div className="font-mono text-[11px] pl-7" style={{ color: 'var(--text-dim)' }}>
                  Hint ref: {currentVersion.hint}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="pt-3 mt-1 border-t flex flex-wrap items-center gap-4" style={{ borderColor: 'var(--line)' }}>
        <div>
          <div className="font-mono text-xs tracking-[0.25em] mb-1" style={{ color: 'var(--text-dim)' }}>
            EXPECTED FINAL OVERRIDE / RECOVERY CODE (COORDINATOR REFERENCE)
          </div>
          {editingCode ? (
            <div className="flex items-center gap-2">
              <input
                value={codeDraft}
                onChange={(e) => setCodeDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
                autoFocus
                className="digit-box text-2xl font-bold rounded-sm px-2 py-1 w-32 outline-none"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--cyan)', color: 'var(--text-hi)' }}
              />
              <button
                onClick={() => {
                  changeFinalCodeOverride(team.id, codeDraft || undefined)
                  setEditingCode(false)
                }}
                className="font-mono text-[11px] uppercase px-2 py-1.5 rounded-sm"
                style={{ background: 'var(--cyan)', color: 'var(--bg-void)' }}
              >
                Save
              </button>
              <button
                onClick={() => setEditingCode(false)}
                className="font-mono text-[11px] uppercase px-2 py-1.5 rounded-sm"
                style={{ border: '1px solid var(--line)', color: 'var(--text-mid)' }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="digit-box text-3xl font-bold tracking-widest" style={{ color: 'var(--cyan)' }}>
                {team.finalCodeOverride || activeCbVariant.overrideCode || expectedCode}
              </span>
              {team.finalCodeOverride && (
                <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--amber)' }}>
                  manual override
                </span>
              )}
              <button
                onClick={() => {
                  setCodeDraft(team.finalCodeOverride || activeCbVariant.overrideCode || expectedCode)
                  setEditingCode(true)
                }}
                className="font-mono text-[11px] uppercase tracking-wider px-2 py-1 rounded-sm"
                style={{ border: '1px solid var(--line)', color: 'var(--text-mid)' }}
              >
                Change Code
              </button>
              {team.finalCodeOverride && (
                <button
                  onClick={() => changeFinalCodeOverride(team.id, undefined)}
                  className="font-mono text-[11px] uppercase tracking-wider px-2 py-1 rounded-sm"
                  style={{ border: '1px solid var(--line)', color: 'var(--text-dim)' }}
                >
                  Revert to Variant
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
