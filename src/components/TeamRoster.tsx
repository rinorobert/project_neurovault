import { useState } from 'react'
import type { Team, PuzzleVersion } from '../types.js'
import { formatDuration } from '../lib/timer.js'
import { PUZZLE_SLOT_LABELS, ALL_PUZZLE_SLOTS } from '../types.js'

const REG_STATUS_COLOR: Record<Team['registrationStatus'], string> = {
  PENDING: 'var(--amber)',
  APPROVED: 'var(--cyan)',
  ACTIVE: 'var(--green)',
  COMPLETED: 'var(--text-dim)',
  REJECTED: 'var(--red)',
}

const GAME_STATUS_COLOR: Record<Team['status'], string> = {
  NOT_STARTED: 'var(--text-dim)',
  RUNNING: 'var(--cyan)',
  PAUSED: 'var(--amber)',
  ESCAPED: 'var(--green)',
  TIME_EXPIRED: 'var(--red)',
}

function formatTimestamp(ms: number | undefined): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleString()
}

/**
 * Coordinator-only roster of every registered team. The list itself stays
 * compact/scannable; clicking a row expands it in place to show the full
 * identity, member, contact, and game-progress details already present on
 * the (unsanitized, coordinator-only) Team object — nothing here is
 * invented, it's all data the existing architecture already tracks.
 */
export function TeamRoster({
  teams,
  puzzleVersions,
  activeTeamId,
  onSelect,
}: {
  teams: Team[]
  puzzleVersions: PuzzleVersion[]
  activeTeamId: string | null
  onSelect: (id: string) => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (teams.length === 0) {
    return (
      <div
        className="rounded-md p-6 text-center font-mono text-xs"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)', color: 'var(--text-dim)' }}
      >
        No teams registered yet.
      </div>
    )
  }

  return (
    <div className="rounded-md overflow-hidden" style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}>
      <div className="px-4 py-3 font-mono text-xs tracking-[0.25em]" style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--line)' }}>
        REGISTERED TEAMS ({teams.length})
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
        {teams.map((team) => {
          const isExpanded = expandedId === team.id
          return (
            <div key={team.id} style={{ borderColor: 'var(--line)' }}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : team.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left flex-wrap"
                style={{ background: team.id === activeTeamId ? 'var(--bg-raised)' : 'transparent' }}
              >
                <span className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
                  {isExpanded ? '▾' : '▸'}
                </span>
                <span className="font-mono text-xs w-20 shrink-0" style={{ color: 'var(--text-hi)' }}>
                  {team.id}
                </span>
                <span className="font-mono text-sm flex-1 min-w-[120px]" style={{ color: 'var(--text-hi)' }}>
                  {team.name}
                </span>
                <span
                  className="px-1.5 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider"
                  style={{ border: `1px solid ${REG_STATUS_COLOR[team.registrationStatus]}`, color: REG_STATUS_COLOR[team.registrationStatus] }}
                >
                  {team.registrationStatus}
                </span>
                <span
                  className="px-1.5 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider"
                  style={{ border: `1px solid ${GAME_STATUS_COLOR[team.status]}`, color: GAME_STATUS_COLOR[team.status] }}
                >
                  {team.status.replace('_', ' ')}
                </span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs" style={{ color: 'var(--text-mid)' }}>
                  <div className="flex flex-col gap-1">
                    <div className="uppercase tracking-wider text-[10px]" style={{ color: 'var(--text-dim)' }}>Identity</div>
                    <div>Team ID: <span style={{ color: 'var(--text-hi)' }}>{team.id}</span></div>
                    <div>Team Name: <span style={{ color: 'var(--text-hi)' }}>{team.name}</span></div>
                    <div>Registration Status: <span style={{ color: REG_STATUS_COLOR[team.registrationStatus] }}>{team.registrationStatus}</span></div>
                    <div>
                      Registration Source:{' '}
                      <span style={{ color: 'var(--text-hi)' }}>
                        {team.registrationSource === 'PUBLIC_FORM' ? 'ONLINE' : 'MANUAL'}
                      </span>
                    </div>
                    <div>Registered At: <span style={{ color: 'var(--text-hi)' }}>{formatTimestamp(team.registeredAt)}</span></div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="uppercase tracking-wider text-[10px]" style={{ color: 'var(--text-dim)' }}>Members & Contact</div>
                    <div>Captain: <span style={{ color: 'var(--text-hi)' }}>{team.captain}</span></div>
                    {team.members.filter((m) => m !== team.captain).map((m, i) => (
                      <div key={i}>Player {i + 2}: <span style={{ color: 'var(--text-hi)' }}>{m}</span></div>
                    ))}
                    <div>Mobile: <span style={{ color: 'var(--text-hi)' }}>{team.contactMobile || '—'}</span></div>
                    <div>Email: <span style={{ color: 'var(--text-hi)' }}>{team.contactEmail || '—'}</span></div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="uppercase tracking-wider text-[10px]" style={{ color: 'var(--text-dim)' }}>Game Progress</div>
                    <div>Status: <span style={{ color: GAME_STATUS_COLOR[team.status] }}>{team.status.replace('_', ' ')}</span></div>
                    <div>Start Time: <span style={{ color: 'var(--text-hi)' }}>{formatTimestamp(team.startedAt)}</span></div>
                    <div>Completion Time: <span style={{ color: 'var(--text-hi)' }}>{formatTimestamp(team.finishedAt)}</span></div>
                    <div>Official Ranking Time: <span style={{ color: 'var(--cyan)' }}>{formatDuration(team.officialRankingSeconds)}</span></div>
                    <div>Hints Used: <span style={{ color: 'var(--text-hi)' }}>{team.hintsUsed} / 3</span></div>
                    <div>Final Code Attempts: <span style={{ color: 'var(--text-hi)' }}>{team.attempts}{team.maxAttempts !== undefined ? ` / ${team.maxAttempts}` : ''}</span></div>
                    <div>Final Module: <span style={{ color: team.finalPuzzleCompleted ? 'var(--green)' : 'var(--text-dim)' }}>{team.finalPuzzleCompleted ? 'Resolved' : team.finalModuleEnabled ? 'Enabled' : 'Disabled'}</span></div>
                  </div>

                  <div className="sm:col-span-3 flex flex-col gap-1">
                    <div className="uppercase tracking-wider text-[10px]" style={{ color: 'var(--text-dim)' }}>Assigned Puzzle Modules</div>
                    <div className="flex flex-wrap gap-3">
                      {ALL_PUZZLE_SLOTS.map((slot) => {
                        const assignment = team.puzzleAssignments.find((a) => a.slot === slot)
                        const version = puzzleVersions.find((v) => v.id === assignment?.puzzleVersionId)
                        return (
                          <span key={slot} style={{ color: 'var(--text-hi)' }}>
                            {PUZZLE_SLOT_LABELS[slot]}: {version ? `${version.version} — ${version.title}` : '—'}
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <button
                      onClick={() => onSelect(team.id)}
                      className="font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-sm"
                      style={{ border: '1px solid var(--cyan)', color: 'var(--cyan)' }}
                    >
                      {team.id === activeTeamId ? 'Currently Selected' : 'Select for Edit / Control'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
