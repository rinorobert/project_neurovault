import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import type { Team, PuzzleVersion, GameSettings, AuditEvent } from '../../types'
import { PRODUCTION_PUZZLE_VERSIONS } from '../../data/puzzles'
import { generateRandomAlphanumeric } from '../security'

// ============================================================================
// PROJECT NEUROVAULT — Database & Persistent Storage Layer
// ----------------------------------------------------------------------------
// Production: Neon PostgreSQL via DATABASE_URL (mandatory in production),
//             accessed through the REAL @neondatabase/serverless HTTP driver
//             (no hand-rolled /sql endpoint).
// Development / Tests: In-memory repository. NOT auto-seeded with any
//             sample/demo data — production and local dev both start with
//             zero teams unless a coordinator/participant creates one, or a
//             developer explicitly calls seedDevFixtures() (never wired to
//             any code path that runs automatically).
// ============================================================================

export type UpdateResult =
  | { ok: true; team: Team }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'conflict'; current: Team }

export interface DatabaseRepository {
  getTeams(): Promise<Team[]>
  getTeamById(id: string): Promise<Team | null>
  /** Atomically assigns a server-generated id (e.g. "NV-001") and persists the team. */
  createTeam(draft: Omit<Team, 'id' | 'version' | 'updatedAt'>): Promise<Team>
  /**
   * Optimistic-concurrency update. If `expectedVersion` is provided and does
   * not match the currently stored version, the update is rejected with
   * `{ ok: false, reason: 'conflict' }` instead of silently overwriting
   * whatever happened in between (e.g. a concurrent ESCAPED/TIME_EXPIRED
   * freeze). Version is incremented on every successful write.
   */
  updateTeam(id: string, patch: Partial<Team>, expectedVersion?: number): Promise<UpdateResult>
  deleteTeam(id: string): Promise<boolean>

  getPuzzleVersions(): Promise<PuzzleVersion[]>
  savePuzzleVersion(pv: PuzzleVersion): Promise<PuzzleVersion>

  getSettings(): Promise<GameSettings>
  updateSettings(patch: Partial<GameSettings>): Promise<GameSettings>

  getActiveTeamId(): Promise<string | null>
  setActiveTeamId(id: string | null): Promise<void>

  appendAuditEvent(event: AuditEvent): Promise<void>
  listAuditEvents(filter?: { teamId?: string; limit?: number }): Promise<AuditEvent[]>

  /** One-time, server-generated confirmation token for "Delete Completed Result". */
  createDeleteResultToken(teamId: string): Promise<string>
  /** Verifies + consumes the token (single use, short expiry). */
  consumeDeleteResultToken(teamId: string, submittedToken: string): Promise<boolean>
}

const DELETE_TOKEN_TTL_MS = 5 * 60 * 1000

// ---------------------------------------------------------------------------
// In-Memory Dev / Test Implementation
// ---------------------------------------------------------------------------
class InMemoryRepository implements DatabaseRepository {
  private teams: Map<string, Team> = new Map()
  private puzzleVersions: Map<string, PuzzleVersion> = new Map()
  private settings: GameSettings = { defaultMaxTimeSeconds: 25 * 60, publicLeaderboardUnlocked: false }
  private activeTeamId: string | null = null
  private auditEvents: AuditEvent[] = []
  private deleteTokens: Map<string, { token: string; expiresAt: number }> = new Map()
  private nextIdCounter = 1

  constructor() {
    // Intentionally empty. Production and local dev both start with ZERO
    // teams. Only PRODUCTION_PUZZLE_VERSIONS (no answer keys) are seeded so
    // the platform has something for TeamPuzzleAssignment to point at.
    for (const pv of PRODUCTION_PUZZLE_VERSIONS) {
      this.puzzleVersions.set(pv.id, JSON.parse(JSON.stringify(pv)))
    }
  }

  /** Dev-only helper. Never called automatically — see scripts/seed-dev.ts. */
  seedDevFixtures(teams: Team[], puzzleVersions: PuzzleVersion[]) {
    for (const t of teams) this.teams.set(t.id, JSON.parse(JSON.stringify(t)))
    for (const pv of puzzleVersions) this.puzzleVersions.set(pv.id, JSON.parse(JSON.stringify(pv)))
  }

  async getTeams(): Promise<Team[]> {
    return Array.from(this.teams.values()).map((t) => JSON.parse(JSON.stringify(t)))
  }

  async getTeamById(id: string): Promise<Team | null> {
    const t = this.teams.get(id)
    return t ? JSON.parse(JSON.stringify(t)) : null
  }

  async createTeam(draft: Omit<Team, 'id' | 'version' | 'updatedAt'>): Promise<Team> {
    const id = `NV-${String(this.nextIdCounter).padStart(3, '0')}`
    this.nextIdCounter += 1
    const now = Date.now()
    const team: Team = { ...draft, id, version: 1, updatedAt: now } as Team
    this.teams.set(id, JSON.parse(JSON.stringify(team)))
    return JSON.parse(JSON.stringify(team))
  }

  async updateTeam(id: string, patch: Partial<Team>, expectedVersion?: number): Promise<UpdateResult> {
    const existing = this.teams.get(id)
    if (!existing) return { ok: false, reason: 'not_found' }
    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
      return { ok: false, reason: 'conflict', current: JSON.parse(JSON.stringify(existing)) }
    }
    const updated: Team = { ...existing, ...patch, id, version: existing.version + 1, updatedAt: Date.now() }
    this.teams.set(id, updated)
    return { ok: true, team: JSON.parse(JSON.stringify(updated)) }
  }

  async deleteTeam(id: string): Promise<boolean> {
    return this.teams.delete(id)
  }

  async getPuzzleVersions(): Promise<PuzzleVersion[]> {
    return Array.from(this.puzzleVersions.values())
  }

  async savePuzzleVersion(pv: PuzzleVersion): Promise<PuzzleVersion> {
    this.puzzleVersions.set(pv.id, pv)
    return pv
  }

  async getSettings(): Promise<GameSettings> {
    return { ...this.settings }
  }

  async updateSettings(patch: Partial<GameSettings>): Promise<GameSettings> {
    this.settings = { ...this.settings, ...patch }
    return { ...this.settings }
  }

  async getActiveTeamId(): Promise<string | null> {
    return this.activeTeamId
  }

  async setActiveTeamId(id: string | null): Promise<void> {
    this.activeTeamId = id
  }

  async appendAuditEvent(event: AuditEvent): Promise<void> {
    this.auditEvents.push(event)
  }

  async listAuditEvents(filter?: { teamId?: string; limit?: number }): Promise<AuditEvent[]> {
    let events = this.auditEvents
    if (filter?.teamId) events = events.filter((e) => e.teamId === filter.teamId)
    events = [...events].sort((a, b) => b.timestamp - a.timestamp)
    return filter?.limit ? events.slice(0, filter.limit) : events
  }

  async createDeleteResultToken(teamId: string): Promise<string> {
    const token = generateRandomAlphanumeric(1)
    this.deleteTokens.set(teamId, { token, expiresAt: Date.now() + DELETE_TOKEN_TTL_MS })
    return token
  }

  async consumeDeleteResultToken(teamId: string, submittedToken: string): Promise<boolean> {
    const entry = this.deleteTokens.get(teamId)
    this.deleteTokens.delete(teamId) // one-time use regardless of outcome
    if (!entry) return false
    if (Date.now() > entry.expiresAt) return false
    return entry.token === submittedToken
  }
}

// ---------------------------------------------------------------------------
// Neon PostgreSQL Implementation (real @neondatabase/serverless driver)
// ---------------------------------------------------------------------------
class NeonPostgresRepository implements DatabaseRepository {
  private sql: NeonQueryFunction<false, false>
  private schemaReady: Promise<void> | null = null

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl)
  }

  private async ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = (async () => {
        await this.sql`
          CREATE TABLE IF NOT EXISTS nv_teams (
            id TEXT PRIMARY KEY,
            data JSONB NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `
        await this.sql`
          CREATE TABLE IF NOT EXISTS nv_team_id_seq_table (
            name TEXT PRIMARY KEY,
            value BIGINT NOT NULL
          )
        `
        await this.sql`
          INSERT INTO nv_team_id_seq_table (name, value) VALUES ('nv_team_id', 0)
          ON CONFLICT (name) DO NOTHING
        `
        await this.sql`
          CREATE TABLE IF NOT EXISTS nv_puzzle_versions (
            id TEXT PRIMARY KEY,
            data JSONB NOT NULL
          )
        `
        await this.sql`
          CREATE TABLE IF NOT EXISTS nv_app_state (
            key TEXT PRIMARY KEY,
            value JSONB NOT NULL
          )
        `
        await this.sql`
          CREATE TABLE IF NOT EXISTS nv_audit_events (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            team_id TEXT,
            actor TEXT NOT NULL,
            timestamp BIGINT NOT NULL,
            metadata JSONB
          )
        `
        await this.sql`
          CREATE TABLE IF NOT EXISTS nv_delete_tokens (
            team_id TEXT PRIMARY KEY,
            token TEXT NOT NULL,
            expires_at BIGINT NOT NULL
          )
        `

        // Seed the safe (no answer-key) production puzzle slot defaults if
        // the table is empty. This is the ONLY thing ever auto-seeded, and
        // it contains no answers — it's just the 5-slot shape.
        const existing = await this.sql`SELECT COUNT(*)::int AS count FROM nv_puzzle_versions`
        if ((existing[0] as any)?.count === 0) {
          for (const pv of PRODUCTION_PUZZLE_VERSIONS) {
            await this.sql`
              INSERT INTO nv_puzzle_versions (id, data) VALUES (${pv.id}, ${JSON.stringify(pv)})
              ON CONFLICT (id) DO NOTHING
            `
          }
        }
      })()
    }
    return this.schemaReady
  }

  async getTeams(): Promise<Team[]> {
    await this.ensureSchema()
    const rows = await this.sql`SELECT data FROM nv_teams ORDER BY id ASC`
    return rows.map((r: any) => r.data as Team)
  }

  async getTeamById(id: string): Promise<Team | null> {
    await this.ensureSchema()
    const rows = await this.sql`SELECT data FROM nv_teams WHERE id = ${id}`
    return rows.length > 0 ? ((rows[0] as any).data as Team) : null
  }

  async createTeam(draft: Omit<Team, 'id' | 'version' | 'updatedAt'>): Promise<Team> {
    await this.ensureSchema()
    // Atomic id allocation via a single UPDATE ... RETURNING — this cannot
    // collide even under concurrent requests from two coordinator devices,
    // because Postgres serializes row-level updates.
    const seqRows = await this.sql`
      UPDATE nv_team_id_seq_table SET value = value + 1 WHERE name = 'nv_team_id' RETURNING value
    `
    const n = Number((seqRows[0] as any).value)
    const id = `NV-${String(n).padStart(3, '0')}`
    const now = Date.now()
    const team: Team = { ...draft, id, version: 1, updatedAt: now } as Team
    await this.sql`
      INSERT INTO nv_teams (id, data, version, updated_at)
      VALUES (${id}, ${JSON.stringify(team)}, 1, now())
    `
    return team
  }

  async updateTeam(id: string, patch: Partial<Team>, expectedVersion?: number): Promise<UpdateResult> {
    await this.ensureSchema()
    const existingRows = await this.sql`SELECT data, version FROM nv_teams WHERE id = ${id}`
    if (existingRows.length === 0) return { ok: false, reason: 'not_found' }
    const existing = (existingRows[0] as any).data as Team
    const currentVersion = Number((existingRows[0] as any).version)

    if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
      return { ok: false, reason: 'conflict', current: existing }
    }

    const updated: Team = { ...existing, ...patch, id, version: currentVersion + 1, updatedAt: Date.now() }

    // Conditional UPDATE: the WHERE clause re-checks the version at the SQL
    // level, so even a race between this read and this write (another
    // request updating the row in between) is caught — RETURNING comes back
    // empty and we treat it as a conflict rather than silently overwriting.
    const versionGuard = expectedVersion !== undefined ? expectedVersion : currentVersion
    const result = await this.sql`
      UPDATE nv_teams
      SET data = ${JSON.stringify(updated)}, version = ${currentVersion + 1}, updated_at = now()
      WHERE id = ${id} AND version = ${versionGuard}
      RETURNING data
    `
    if (result.length === 0) {
      const freshRows = await this.sql`SELECT data FROM nv_teams WHERE id = ${id}`
      return { ok: false, reason: 'conflict', current: (freshRows[0] as any)?.data as Team }
    }
    return { ok: true, team: updated }
  }

  async deleteTeam(id: string): Promise<boolean> {
    await this.ensureSchema()
    await this.sql`DELETE FROM nv_teams WHERE id = ${id}`
    return true
  }

  async getPuzzleVersions(): Promise<PuzzleVersion[]> {
    await this.ensureSchema()
    const rows = await this.sql`SELECT data FROM nv_puzzle_versions ORDER BY id ASC`
    return rows.map((r: any) => r.data as PuzzleVersion)
  }

  async savePuzzleVersion(pv: PuzzleVersion): Promise<PuzzleVersion> {
    await this.ensureSchema()
    await this.sql`
      INSERT INTO nv_puzzle_versions (id, data) VALUES (${pv.id}, ${JSON.stringify(pv)})
      ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(pv)}
    `
    return pv
  }

  async getSettings(): Promise<GameSettings> {
    await this.ensureSchema()
    const rows = await this.sql`SELECT value FROM nv_app_state WHERE key = 'settings'`
    return rows.length > 0 ? ((rows[0] as any).value as GameSettings) : { defaultMaxTimeSeconds: 25 * 60, publicLeaderboardUnlocked: false }
  }

  async updateSettings(patch: Partial<GameSettings>): Promise<GameSettings> {
    const current = await this.getSettings()
    const updated = { ...current, ...patch }
    await this.sql`
      INSERT INTO nv_app_state (key, value) VALUES ('settings', ${JSON.stringify(updated)})
      ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(updated)}
    `
    return updated
  }

  async getActiveTeamId(): Promise<string | null> {
    await this.ensureSchema()
    const rows = await this.sql`SELECT value FROM nv_app_state WHERE key = 'active_team_id'`
    return rows.length > 0 ? ((rows[0] as any).value as string) : null
  }

  async setActiveTeamId(id: string | null): Promise<void> {
    await this.ensureSchema()
    await this.sql`
      INSERT INTO nv_app_state (key, value) VALUES ('active_team_id', ${JSON.stringify(id)})
      ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(id)}
    `
  }

  async appendAuditEvent(event: AuditEvent): Promise<void> {
    await this.ensureSchema()
    await this.sql`
      INSERT INTO nv_audit_events (id, type, team_id, actor, timestamp, metadata)
      VALUES (${event.id}, ${event.type}, ${event.teamId ?? null}, ${event.actor}, ${event.timestamp}, ${
      event.metadata ? JSON.stringify(event.metadata) : null
    })
    `
  }

  async listAuditEvents(filter?: { teamId?: string; limit?: number }): Promise<AuditEvent[]> {
    await this.ensureSchema()
    const limit = filter?.limit ?? 500
    const rows = filter?.teamId
      ? await this.sql`
          SELECT id, type, team_id, actor, timestamp, metadata FROM nv_audit_events
          WHERE team_id = ${filter.teamId} ORDER BY timestamp DESC LIMIT ${limit}
        `
      : await this.sql`
          SELECT id, type, team_id, actor, timestamp, metadata FROM nv_audit_events
          ORDER BY timestamp DESC LIMIT ${limit}
        `
    return rows.map((r: any) => ({
      id: r.id,
      type: r.type,
      teamId: r.team_id ?? undefined,
      actor: r.actor,
      timestamp: Number(r.timestamp),
      metadata: r.metadata ?? undefined,
    }))
  }

  async createDeleteResultToken(teamId: string): Promise<string> {
    await this.ensureSchema()
    const token = generateRandomAlphanumeric(1)
    const expiresAt = Date.now() + DELETE_TOKEN_TTL_MS
    await this.sql`
      INSERT INTO nv_delete_tokens (team_id, token, expires_at) VALUES (${teamId}, ${token}, ${expiresAt})
      ON CONFLICT (team_id) DO UPDATE SET token = ${token}, expires_at = ${expiresAt}
    `
    return token
  }

  async consumeDeleteResultToken(teamId: string, submittedToken: string): Promise<boolean> {
    await this.ensureSchema()
    const rows = await this.sql`SELECT token, expires_at FROM nv_delete_tokens WHERE team_id = ${teamId}`
    await this.sql`DELETE FROM nv_delete_tokens WHERE team_id = ${teamId}` // one-time use
    if (rows.length === 0) return false
    const { token, expires_at } = rows[0] as any
    if (Date.now() > Number(expires_at)) return false
    return token === submittedToken
  }
}

// ---------------------------------------------------------------------------
// Database Factory
// ---------------------------------------------------------------------------
let instance: DatabaseRepository | null = null

export function getDatabase(): DatabaseRepository {
  if (instance) return instance

  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
  const databaseUrl = process.env.DATABASE_URL

  if (databaseUrl && databaseUrl.trim() !== '') {
    instance = new NeonPostgresRepository(databaseUrl.trim())
    return instance
  }

  // Production requirement guard: DATABASE_URL must not be missing in production!
  if (isProduction) {
    throw new Error(
      '[CRITICAL] DATABASE_URL environment variable is required in production for Neon PostgreSQL storage. ' +
        'The in-memory repository must never become the production data source.'
    )
  }

  // Permitted ONLY in local development and automated test suites. Starts
  // with ZERO teams — see InMemoryRepository above.
  instance = new InMemoryRepository()
  return instance
}

/** Test-only escape hatch so integration tests can reset state between runs. */
export function __resetDatabaseForTests(): void {
  instance = null
}
