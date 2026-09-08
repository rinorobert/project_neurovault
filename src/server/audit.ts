import type { AuditEvent, AuditEventType } from '../types.js'
import type { DatabaseRepository } from './db/client.js'
import { generateId } from './security.js'

export async function logAudit(
  db: DatabaseRepository,
  type: AuditEventType,
  opts: {
    teamId?: string
    actor: 'coordinator' | 'participant' | 'system'
    metadata?: Record<string, unknown>
    now?: number
  }
): Promise<AuditEvent> {
  const event: AuditEvent = {
    id: generateId('audit'),
    type,
    teamId: opts.teamId,
    actor: opts.actor,
    timestamp: opts.now ?? Date.now(),
    metadata: opts.metadata,
  }
  await db.appendAuditEvent(event)
  return event
}
