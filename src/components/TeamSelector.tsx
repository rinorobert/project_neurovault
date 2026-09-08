import type { Team } from '../types'

const STATUS_DOT: Record<Team['status'], string> = {
  NOT_STARTED: 'var(--text-dim)',
  RUNNING: 'var(--cyan)',
  PAUSED: 'var(--amber)',
  ESCAPED: 'var(--green)',
  TIME_EXPIRED: 'var(--red)',
}

export function TeamSelector({
  teams,
  activeTeamId,
  onSelect,
}: {
  teams: Team[]
  activeTeamId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="font-mono text-xs tracking-widest whitespace-nowrap" style={{ color: 'var(--text-dim)' }}>
        CURRENT TEAM
      </label>
      <select
        value={activeTeamId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        className="font-mono text-sm rounded-sm px-3 py-2 outline-none flex-1"
        style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--text-hi)' }}
      >
        <option value="" disabled>
          Select a team...
        </option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.id} — {t.name}
          </option>
        ))}
      </select>
      {activeTeamId && (
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: STATUS_DOT[teams.find((t) => t.id === activeTeamId)?.status ?? 'NOT_STARTED'] }}
        />
      )}
    </div>
  )
}
