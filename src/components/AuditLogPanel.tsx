import { useEffect, useState } from 'react'
import type { AuditEvent } from '../types.js'

function formatMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return '—'
  return Object.entries(metadata)
    .filter(([key]) => !/code|answer|secret|password|token/i.test(key))
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' · ') || '—'
}

export function AuditLogPanel() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const response = await fetch('/api/audit', { credentials: 'same-origin' })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return setError(body.error ?? 'Audit log unavailable.')
    setEvents(body.events ?? [])
    setError(null)
  }

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [])

  return (
    <section className="rounded-md p-5 flex flex-col gap-4" style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-mono text-xs tracking-[0.25em]" style={{ color: 'var(--text-dim)' }}>AUDIT LOG</h2>
        <button onClick={() => void load()} className="font-mono text-[11px] uppercase px-2 py-1 rounded-sm" style={{ border: '1px solid var(--line)', color: 'var(--cyan)' }}>Refresh</button>
      </div>
      {error && <p className="font-mono text-xs" style={{ color: 'var(--red)' }}>{error}</p>}
      {!error && events.length === 0 && <p className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>No audit events recorded yet.</p>}
      <div className="max-h-96 overflow-auto flex flex-col gap-2">
        {events.map((event) => (
          <div key={event.id} className="p-3 rounded-sm font-mono text-[11px]" style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--text-mid)' }}>
            <div className="flex flex-wrap gap-x-3 gap-y-1" style={{ color: 'var(--text-hi)' }}>
              <span>{new Date(event.timestamp).toLocaleString()}</span><span>{event.type}</span><span>actor: {event.actor}</span>{event.teamId && <span>team: {event.teamId}</span>}
            </div>
            <div className="mt-1" style={{ color: 'var(--text-dim)' }}>{formatMetadata(event.metadata)}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
