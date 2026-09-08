import { useState } from 'react'
import type { Team } from '../types'
import { useStore } from '../state/store'

const REG_STATUS_COLOR: Record<Team['registrationStatus'], string> = {
  PENDING: 'var(--amber)',
  APPROVED: 'var(--cyan)',
  ACTIVE: 'var(--green)',
  COMPLETED: 'var(--text-dim)',
  REJECTED: 'var(--red)',
}

export function TeamManagerPanel({ team }: { team: Team | null }) {
  const { addTeam, updateTeam, deleteTeam, approveTeamAction, rejectTeamAction, activateTeamAction, setActiveTeamId } =
    useStore()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [members, setMembers] = useState('')
  const [captain, setCaptain] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactMobile, setContactMobile] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  async function createTeam() {
    if (!name.trim()) return
    setCreateError(null)
    const memberList = members.split(',').map((m) => m.trim()).filter(Boolean)
    // Server assigns the id (NV-001, NV-002, ...) — the client never
    // computes or sends one, so two coordinator devices creating teams at
    // the same moment can never collide.
    const result = await addTeam({
      name: name.trim(),
      members: memberList,
      captain: captain.trim() || memberList[0],
      contactEmail: contactEmail.trim(),
      contactMobile: contactMobile.trim(),
    })
    if (!result.ok) {
      setCreateError(result.error ?? 'Failed to create team')
      return
    }
    setName('')
    setMembers('')
    setCaptain('')
    setContactEmail('')
    setContactMobile('')
    setOpen(false)
  }

  async function editField(patch: Partial<Team>) {
    setEditError(null)
    const result = await updateTeam(team!.id, patch)
    if (!result.ok) setEditError(result.error ?? 'Update failed')
  }

  return (
    <div className="rounded-md p-5 flex flex-col gap-4" style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}>
      <div className="flex items-center justify-between">
        <div className="font-mono text-xs tracking-[0.25em]" style={{ color: 'var(--text-dim)' }}>
          TEAM MANAGEMENT
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="font-mono text-[11px] uppercase tracking-wider px-2 py-1 rounded-sm"
          style={{ border: '1px solid var(--cyan)', color: 'var(--cyan)' }}
        >
          {open ? 'Cancel' : '+ Add Team'}
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-2">
          <input
            placeholder="Team name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="font-mono text-sm rounded-sm px-3 py-2 outline-none"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--text-hi)' }}
          />
          <input
            placeholder="Members (comma separated, exactly 4)"
            value={members}
            onChange={(e) => setMembers(e.target.value)}
            className="font-mono text-sm rounded-sm px-3 py-2 outline-none"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--text-hi)' }}
          />
          <input
            placeholder="Captain (must match a member name)"
            value={captain}
            onChange={(e) => setCaptain(e.target.value)}
            className="font-mono text-sm rounded-sm px-3 py-2 outline-none"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--text-hi)' }}
          />
          <input
            placeholder="Contact email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="font-mono text-sm rounded-sm px-3 py-2 outline-none"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--text-hi)' }}
          />
          <input
            placeholder="Team contact mobile number (e.g. 8921151978 or +91 8921151978)"
            value={contactMobile}
            onChange={(e) => setContactMobile(e.target.value)}
            className="font-mono text-sm rounded-sm px-3 py-2 outline-none"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--text-hi)' }}
          />
          {createError && (
            <div className="font-mono text-xs" style={{ color: 'var(--red)' }}>
              {createError}
            </div>
          )}
          <button
            onClick={createTeam}
            className="font-display uppercase tracking-wider text-xs font-semibold py-2 rounded-sm"
            style={{ background: 'var(--cyan)', color: 'var(--bg-void)' }}
          >
            Create Team (server assigns NV-### id)
          </button>
        </div>
      )}

      {team && (
        <div className="pt-3 border-t flex flex-col gap-2" style={{ borderColor: 'var(--line)' }}>
          <div className="font-mono text-xs flex items-center gap-2" style={{ color: 'var(--text-dim)' }}>
            Editing: <span style={{ color: 'var(--text-hi)' }}>{team.name}</span> ({team.id})
            <span
              className="px-1.5 py-0.5 rounded-sm text-[10px] uppercase tracking-wider"
              style={{ border: `1px solid ${REG_STATUS_COLOR[team.registrationStatus]}`, color: REG_STATUS_COLOR[team.registrationStatus] }}
            >
              {team.registrationStatus}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {team.registrationStatus === 'PENDING' && (
              <>
                <button
                  onClick={() => approveTeamAction(team.id)}
                  className="font-mono text-[11px] uppercase tracking-wider px-2 py-1.5 rounded-sm"
                  style={{ border: '1px solid var(--cyan)', color: 'var(--cyan)' }}
                >
                  Approve
                </button>
                <button
                  onClick={() => rejectTeamAction(team.id)}
                  className="font-mono text-[11px] uppercase tracking-wider px-2 py-1.5 rounded-sm"
                  style={{ border: '1px solid var(--red)', color: 'var(--red)' }}
                >
                  Reject
                </button>
              </>
            )}
            {team.registrationStatus === 'APPROVED' && (
              <button
                onClick={() => activateTeamAction(team.id)}
                className="font-mono text-[11px] uppercase tracking-wider px-2 py-1.5 rounded-sm"
                style={{ border: '1px solid var(--green)', color: 'var(--green)' }}
              >
                Activate
              </button>
            )}
          </div>

          <label className="font-mono text-xs flex items-center gap-2" style={{ color: 'var(--text-mid)' }}>
            Team name
            <input
              value={team.name}
              onChange={(e) => editField({ name: e.target.value })}
              className="font-mono text-sm rounded-sm px-2 py-1 outline-none flex-1"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--text-hi)' }}
            />
          </label>
          <label className="font-mono text-xs flex items-center gap-2" style={{ color: 'var(--text-mid)' }}>
            Members (4 players)
            <input
              value={team.members.join(', ')}
              onChange={(e) =>
                editField({ members: e.target.value.split(',').map((m) => m.trim()).filter(Boolean) })
              }
              className="font-mono text-sm rounded-sm px-2 py-1 outline-none flex-1"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--text-hi)' }}
            />
          </label>
          <label className="font-mono text-xs flex items-center gap-2" style={{ color: 'var(--text-mid)' }}>
            Captain
            <input
              value={team.captain}
              onChange={(e) => editField({ captain: e.target.value })}
              className="font-mono text-sm rounded-sm px-2 py-1 outline-none flex-1"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--text-hi)' }}
            />
          </label>
          <label className="font-mono text-xs flex items-center gap-2" style={{ color: 'var(--text-mid)' }}>
            Contact email
            <input
              value={team.contactEmail}
              onChange={(e) => editField({ contactEmail: e.target.value })}
              className="font-mono text-sm rounded-sm px-2 py-1 outline-none flex-1"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--text-hi)' }}
            />
          </label>
          <label className="font-mono text-xs flex items-center gap-2" style={{ color: 'var(--text-mid)' }}>
            Contact mobile
            <input
              value={team.contactMobile}
              onChange={(e) => editField({ contactMobile: e.target.value })}
              placeholder="e.g. 8921151978 or +91 8921151978"
              className="font-mono text-sm rounded-sm px-2 py-1 outline-none flex-1"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--text-hi)' }}
            />
          </label>
          {editError && (
            <div className="font-mono text-xs" style={{ color: 'var(--red)' }}>
              {editError}
            </div>
          )}
          <label className="font-mono text-xs flex items-center gap-2" style={{ color: 'var(--text-mid)' }}>
            Max time (min)
            <input
              type="number"
              min={1}
              value={Math.round(team.maxTimeSeconds / 60)}
              onChange={(e) => updateTeam(team.id, { maxTimeSeconds: Math.max(1, Number(e.target.value)) * 60 })}
              className="font-mono text-sm rounded-sm px-2 py-1 outline-none w-20"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--text-hi)' }}
            />
          </label>
          <label className="font-mono text-xs flex items-center gap-2" style={{ color: 'var(--text-mid)' }}>
            Max attempts (blank = unlimited)
            <input
              type="number"
              min={1}
              value={team.maxAttempts ?? ''}
              onChange={(e) =>
                updateTeam(team.id, {
                  maxAttempts: e.target.value === '' ? undefined : Math.max(1, Number(e.target.value)),
                })
              }
              className="font-mono text-sm rounded-sm px-2 py-1 outline-none w-20"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--text-hi)' }}
            />
          </label>
          <button
            onClick={() => {
              if (confirm(`Delete team ${team.name} (${team.id})? This permanently removes the registration and cannot be undone.`)) {
                deleteTeam(team.id)
                setActiveTeamId(null)
              }
            }}
            className="font-mono text-[11px] uppercase tracking-wider px-2 py-1.5 rounded-sm self-start mt-1"
            style={{ border: '1px solid var(--red)', color: 'var(--red)' }}
          >
            Delete Team (registration + all data)
          </button>
        </div>
      )}
    </div>
  )
}
