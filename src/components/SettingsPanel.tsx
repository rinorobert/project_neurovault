import { useState } from 'react'
import { useStore } from '../state/store'

export function SettingsPanel() {
  const { settings, updateSettings } = useStore()
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-md" style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 font-mono text-xs tracking-[0.25em]"
        style={{ color: 'var(--text-dim)' }}
      >
        SYSTEM SETTINGS
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4">
          <div className="font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
            The coordinator PIN is configured server-side via the <code>COORDINATOR_PIN</code> environment
            variable (and, in production, must be paired with <code>SESSION_SECRET</code>). It cannot be changed
            from this panel — there is no client-side override, by design.
          </div>

          <label className="font-mono text-xs flex items-center gap-2" style={{ color: 'var(--text-mid)' }}>
            Default max time (min)
            <input
              type="number"
              min={1}
              value={Math.round(settings.defaultMaxTimeSeconds / 60)}
              onChange={(e) => updateSettings({ defaultMaxTimeSeconds: Math.max(1, Number(e.target.value)) * 60 })}
              className="font-mono text-sm rounded-sm px-2 py-1 outline-none w-20"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--text-hi)' }}
            />
          </label>

          <div className="font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
            Hint penalties are fixed: Hint 1 = +00:30, Hint 2 = +01:00, Hint 3 = +01:30 (max 3 per team).
          </div>

          <div className="pt-3 border-t flex flex-col gap-2" style={{ borderColor: 'var(--line)' }}>
            <div className="font-mono text-xs flex items-center gap-2" style={{ color: 'var(--text-mid)' }}>
              PUBLIC LEADERBOARD:
              <span
                className="px-1.5 py-0.5 rounded-sm text-[10px] uppercase tracking-wider"
                style={{
                  border: `1px solid ${settings.publicLeaderboardUnlocked ? 'var(--green)' : 'var(--amber)'}`,
                  color: settings.publicLeaderboardUnlocked ? 'var(--green)' : 'var(--amber)',
                }}
              >
                {settings.publicLeaderboardUnlocked ? 'Unlocked' : 'Locked'}
              </span>
            </div>
            <div className="font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
              Controls whether the public <code>/leaderboard</code> page and API reveal results. Locked by
              default. This is enforced server-side — the public endpoint itself refuses to return result data
              while locked, regardless of what the browser renders.
            </div>
            <button
              onClick={() => updateSettings({ publicLeaderboardUnlocked: !settings.publicLeaderboardUnlocked })}
              className="font-mono text-[11px] uppercase tracking-wider px-3 py-2 rounded-sm self-start"
              style={{
                border: `1px solid ${settings.publicLeaderboardUnlocked ? 'var(--red)' : 'var(--green)'}`,
                color: settings.publicLeaderboardUnlocked ? 'var(--red)' : 'var(--green)',
              }}
            >
              {settings.publicLeaderboardUnlocked ? 'Lock Public Leaderboard' : 'Unlock Public Leaderboard'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
