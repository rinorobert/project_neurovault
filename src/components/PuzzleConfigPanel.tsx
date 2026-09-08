import { useState } from 'react'
import type { Team, PuzzleVersion, InitialPuzzleSlotKey } from '../types'
import { ALL_PUZZLE_SLOTS, PUZZLE_SLOT_LABELS } from '../types'
import { computeFinalCode } from '../lib/finalCode'
import { useStore } from '../state/store'
import { areInitialPuzzlesCompleted } from '../engine/gameEngine'

export function PuzzleConfigPanel({ team, puzzleVersions }: { team: Team; puzzleVersions: PuzzleVersion[] }) {
  const { setPuzzleVersion, markPuzzleCompleted, updateTeam, changeFinalCodeOverride } = useStore()
  const [editingCode, setEditingCode] = useState(false)
  const [codeDraft, setCodeDraft] = useState('')

  const expectedCode = computeFinalCode(team, puzzleVersions)
  const initialDone = areInitialPuzzlesCompleted(team)

  return (
    <div className="rounded-md p-5 flex flex-col gap-4" style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}>
      <div className="flex items-center justify-between">
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

          // For the 4 initial slots, the checkbox both toggles AND reflects
          // completion. The final slot is different on purpose: completion
          // (`finalPuzzleCompleted`) can ONLY ever be set by a real
          // server-validated Constraint Breach submission — a coordinator
          // checkbox must never be able to fake that. What the coordinator
          // CAN toggle here is `finalModuleEnabled`, a readiness gate that,
          // combined with the team's own recovery-code unlock, is what
          // actually opens the participant-facing Constraint Breach
          // interface. This persists through the same PATCH /api/teams/:id
          // route used for every other team edit — no new mechanism.
          const isDone = isFinal ? team.finalPuzzleCompleted : team.puzzleCompleted[slot as InitialPuzzleSlotKey]
          const checkboxChecked = isFinal ? team.finalModuleEnabled === true : isDone

          function handleCheckboxChange(checked: boolean) {
            if (isFinal) {
              updateTeam(team.id, { finalModuleEnabled: checked })
            } else {
              markPuzzleCompleted(team.id, slot, checked, currentVersion?.outputFragment)
            }
          }

          return (
            <div
              key={slot}
              className="flex flex-col gap-1 p-2.5 rounded-sm"
              style={{
                background: 'var(--bg-raised)',
                border: `1px solid ${isFinal ? (isDone ? 'var(--green)' : checkboxChecked ? 'var(--cyan)' : 'var(--line)') : isDone ? 'rgba(53,226,140,0.3)' : 'var(--line)'}`,
              }}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="checkbox"
                  checked={checkboxChecked}
                  onChange={(e) => handleCheckboxChange(e.target.checked)}
                  className="w-4 h-4 accent-[var(--cyan)] cursor-pointer"
                  title={isFinal ? 'Enable the final module (does not by itself complete or escape the team)' : ''}
                />
                <span
                  className="font-mono text-xs w-60 shrink-0 font-medium"
                  style={{ color: isDone ? 'var(--green)' : 'var(--text-hi)' }}
                >
                  {PUZZLE_SLOT_LABELS[slot]}
                  {isFinal && ' (Collaborative Gated)'}
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
                {isFinal && (
                  <span
                    className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm"
                    style={{
                      border: `1px solid ${isDone ? 'var(--green)' : checkboxChecked ? 'var(--cyan)' : 'var(--text-dim)'}`,
                      color: isDone ? 'var(--green)' : checkboxChecked ? 'var(--cyan)' : 'var(--text-dim)',
                    }}
                  >
                    {isDone ? 'Resolved' : checkboxChecked ? 'Enabled' : 'Disabled'}
                  </span>
                )}
                {isFinal && !team.recoveryCodeUnlocked && (
                  <span className="font-mono text-[10px]" style={{ color: 'var(--amber)' }}>
                    [Also requires team's recovery code to be unlocked]
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
            EXPECTED CODE (COORDINATOR REFERENCE — RECOVERY CODE UNTIL A FINAL-MODULE OVERRIDE IS SET)
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
                {expectedCode}
              </span>
              {team.finalCodeOverride && (
                <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--amber)' }}>
                  manual override
                </span>
              )}
              <button
                onClick={() => {
                  setCodeDraft(expectedCode)
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
                  Revert to Computed
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
