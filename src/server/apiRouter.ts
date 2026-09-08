import type { InitialPuzzleSlotKey, PuzzleSlotKey, Team, HintLevel, ConstraintBreachSubmission } from '../types'
import { getDatabase, type DatabaseRepository } from './db/client'
import { verifyCoordinatorPin } from './auth'
import {
  parseCookies,
  verifyCoordinatorSessionToken,
  createCoordinatorSessionToken,
  buildSessionCookie,
  buildClearSessionCookie,
  COORDINATOR_SESSION_COOKIE,
} from './security'
import * as engine from '../engine/gameEngine'
import { buildLeaderboard } from '../lib/leaderboard'
import { solveConstraintBreach, validateConstraintBreachSubmission, deriveOverrideCodeFromPlacement } from '../lib/constraintBreachSolver'
import { getConstraintVariantById } from './puzzleData/constraintVariants'
import { newTeamDraft, defaultPuzzleAssignments } from '../data/teams'
import { normalizeIndianMobile } from './validation'
import {
  toParticipantTeamView,
  toParticipantPuzzleView,
  toParticipantConstraintView,
  toPublicLeaderboardTeamView,
} from './sanitize'
import { logAudit } from './audit'

// ============================================================================
// PROJECT NEUROVAULT — Unified API Router
// ----------------------------------------------------------------------------
// Compatible with Vercel Serverless Functions (/api/*) and the Vite local
// dev middleware (npm run dev).
//
// SECURITY MODEL
// - Every route that mutates coordinator-only state, or that would reveal
//   answer-key data, checks a signed, HttpOnly-cookie-backed session (see
//   security.ts) via requireCoordinator() below. There is no client-side
//   flag anywhere that this router trusts as proof of identity.
// - GET /api/state (and any other team/puzzle read reachable by a
//   participant) always runs the response through the sanitize.ts
//   whitelist builders when the caller is not an authenticated coordinator.
// ============================================================================

export interface ApiRequest {
  method: string
  url: string
  headers: Record<string, string | string[] | undefined>
  query?: Record<string, string | undefined>
  body?: any
}

export interface ApiResponse {
  statusCode: number
  headers: Record<string, string | string[]>
  body: any
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
}

function isCoordinatorRequest(req: ApiRequest): boolean {
  const cookies = parseCookies(req.headers['cookie'] as string | undefined)
  return verifyCoordinatorSessionToken(cookies[COORDINATOR_SESSION_COOKIE])
}

interface MutationOutcome {
  statusCode: number
  body: any
}

/**
 * Shared helper for every team-scoped gameplay mutation.
 *
 * 1. Fetches the team fresh.
 * 2. Applies any pending expiry freeze FIRST (its own small CAS retry) so a
 *    stale RUNNING team that has actually timed out is frozen before the
 *    requested mutation is even evaluated against it.
 * 3. Computes the caller's requested patch via `computePatch` against that
 *    up-to-date team.
 * 4. Persists with optimistic concurrency (expectedVersion = the version we
 *    just read). If a concurrent request beat us to it, we retry against
 *    the fresh copy — bounded — so "the first valid terminal transition
 *    wins" instead of last-write-wins.
 */
async function withTeamMutation(
  db: DatabaseRepository,
  teamId: string,
  now: number,
  computePatch: (team: Team) => Partial<Team> | null,
  rejectionMessage: string
): Promise<MutationOutcome & { team?: Team }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    let team = await db.getTeamById(teamId)
    if (!team) return { statusCode: 404, body: { error: `Team ${teamId} not found` } }

    // Step 1: settle any pending expiry before evaluating the real mutation.
    const expiryPatch = engine.checkExpiry(team, now)
    if (expiryPatch) {
      const expiryResult = await db.updateTeam(teamId, expiryPatch, team.version)
      if (expiryResult.ok) {
        team = expiryResult.team
      } else if (expiryResult.reason === 'conflict') {
        team = expiryResult.current
      } else {
        return { statusCode: 404, body: { error: `Team ${teamId} not found` } }
      }
    }

    const patch = computePatch(team)
    if (!patch) return { statusCode: 400, body: { error: rejectionMessage } }

    const result = await db.updateTeam(teamId, patch, team.version)
    if (result.ok) return { statusCode: 200, body: {}, team: result.team }
    if (result.reason === 'not_found') return { statusCode: 404, body: { error: `Team ${teamId} not found` } }
    // conflict — loop and retry against the fresh copy
  }
  return { statusCode: 409, body: { error: 'Concurrent update conflict — please retry.' } }
}

export async function handleApiRoute(req: ApiRequest): Promise<ApiResponse> {
  const parsedUrl = new URL(req.url, 'http://localhost')
  const pathname = parsedUrl.pathname.replace(/\/$/, '')
  const method = req.method.toUpperCase()
  const db = getDatabase()
  const now = Date.now()
  const coordinator = isCoordinatorRequest(req)

  const jsonHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  }

  function requireCoordinator(): ApiResponse | null {
    if (!coordinator) {
      return {
        statusCode: 401,
        headers: jsonHeaders,
        body: { error: 'Coordinator authentication required.' },
      }
    }
    return null
  }

  try {
    // -----------------------------------------------------------------------
    // GET /api/health
    // -----------------------------------------------------------------------
    if (pathname === '/api/health' && method === 'GET') {
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: { status: 'ok', service: 'Project NeuroVault Platform', timestamp: now },
      }
    }

    // -----------------------------------------------------------------------
    // Coordinator Authentication (real server-side session, not a client flag)
    // -----------------------------------------------------------------------
    if (pathname === '/api/auth/coordinator/login' && method === 'POST') {
      const pin = req.body?.pin ?? ''
      const valid = verifyCoordinatorPin(String(pin))
      if (!valid) {
        await logAudit(db, 'COORDINATOR_LOGIN_FAILED', { actor: 'system', now })
        return { statusCode: 401, headers: jsonHeaders, body: { authenticated: false, error: 'Invalid coordinator PIN' } }
      }
      const token = createCoordinatorSessionToken(now)
      await logAudit(db, 'COORDINATOR_LOGIN', { actor: 'coordinator', now })
      return {
        statusCode: 200,
        headers: { ...jsonHeaders, 'Set-Cookie': buildSessionCookie(token) },
        body: { authenticated: true },
      }
    }

    if (pathname === '/api/auth/coordinator/logout' && method === 'POST') {
      return {
        statusCode: 200,
        headers: { ...jsonHeaders, 'Set-Cookie': buildClearSessionCookie() },
        body: { authenticated: false },
      }
    }

    if (pathname === '/api/auth/coordinator/session' && method === 'GET') {
      return { statusCode: 200, headers: jsonHeaders, body: { authenticated: coordinator } }
    }

    // -----------------------------------------------------------------------
    // Public Registration (POST /api/register) — status starts PENDING
    // -----------------------------------------------------------------------
    if (pathname === '/api/register' && method === 'POST') {
      const { teamName, players, captain, contactEmail, contactMobile } = req.body || {}
      const members: string[] = Array.isArray(players) ? players.map((p: string) => String(p).trim()).filter(Boolean) : []

      if (!teamName || typeof teamName !== 'string' || teamName.trim() === '') {
        return { statusCode: 400, headers: jsonHeaders, body: { error: 'Team name is required.' } }
      }
      if (members.length !== 4) {
        return { statusCode: 400, headers: jsonHeaders, body: { error: 'Exactly 4 players are required.' } }
      }
      if (!captain || !members.includes(captain)) {
        return { statusCode: 400, headers: jsonHeaders, body: { error: 'Captain must be one of the 4 listed players.' } }
      }
      if (!contactEmail || typeof contactEmail !== 'string' || !contactEmail.includes('@')) {
        return { statusCode: 400, headers: jsonHeaders, body: { error: 'A valid contact email is required.' } }
      }
      const normalizedMobile = normalizeIndianMobile(contactMobile)
      if (!normalizedMobile) {
        return {
          statusCode: 400,
          headers: jsonHeaders,
          body: { error: 'A valid team contact mobile number is required (e.g. 8921151978 or +91 8921151978).' },
        }
      }

      const [puzzleVersions, settings] = await Promise.all([db.getPuzzleVersions(), db.getSettings()])
      const draft = newTeamDraft({
        name: teamName.trim(),
        members,
        captain,
        contactEmail: contactEmail.trim(),
        contactMobile: normalizedMobile,
        registrationSource: 'PUBLIC_FORM',
        maxTimeSeconds: settings.defaultMaxTimeSeconds,
        puzzleAssignments: defaultPuzzleAssignments(puzzleVersions),
      })
      const team = await db.createTeam(draft)
      await logAudit(db, 'TEAM_REGISTERED', { teamId: team.id, actor: 'participant', now, metadata: { source: 'PUBLIC_FORM' } })

      return { statusCode: 201, headers: jsonHeaders, body: { team: toParticipantTeamView(team) } }
    }

    // -----------------------------------------------------------------------
    // Global State Sync (/api/state) — role-aware sanitization
    // -----------------------------------------------------------------------
    if (pathname === '/api/state' && method === 'GET') {
      const [teams, puzzleVersions, settings, activeTeamId] = await Promise.all([
        db.getTeams(),
        db.getPuzzleVersions(),
        db.getSettings(),
        db.getActiveTeamId(),
      ])

      // Global expiry check on RUNNING teams during state fetch, using CAS
      // so this read-triggered write can never clobber a concurrent one.
      const updatedTeams: Team[] = []
      for (const t of teams) {
        const patch = engine.checkExpiry(t, now)
        if (!patch) {
          updatedTeams.push(t)
          continue
        }
        const result = await db.updateTeam(t.id, patch, t.version)
        updatedTeams.push(result.ok ? result.team : result.reason === 'conflict' ? result.current : t)
        if (result.ok) await logAudit(db, 'TIME_EXPIRED', { teamId: t.id, actor: 'system', now })
      }

      const teamsOut = coordinator ? updatedTeams : updatedTeams.map(toParticipantTeamView)
      const puzzleVersionsOut = coordinator ? puzzleVersions : puzzleVersions.map(toParticipantPuzzleView)

      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: { teams: teamsOut, puzzleVersions: puzzleVersionsOut, settings, activeTeamId, serverTime: now, coordinator },
      }
    }

    if (pathname === '/api/settings' && method === 'PATCH') {
      const authError = requireCoordinator()
      if (authError) return authError
      const before = await db.getSettings()
      const updated = await db.updateSettings(req.body || {})

      if (before.publicLeaderboardUnlocked !== updated.publicLeaderboardUnlocked) {
        await logAudit(
          db,
          updated.publicLeaderboardUnlocked ? 'PUBLIC_LEADERBOARD_UNLOCKED' : 'PUBLIC_LEADERBOARD_LOCKED',
          { actor: 'coordinator', now }
        )
      }

      return { statusCode: 200, headers: jsonHeaders, body: { settings: updated } }
    }

    if (pathname === '/api/active-team' && method === 'POST') {
      const authError = requireCoordinator()
      if (authError) return authError
      const { id } = req.body || {}
      await db.setActiveTeamId(id ?? null)
      return { statusCode: 200, headers: jsonHeaders, body: { activeTeamId: id ?? null } }
    }

    // -----------------------------------------------------------------------
    // Public Leaderboard — only legitimately participating/finished teams
    // -----------------------------------------------------------------------
    if (pathname === '/api/leaderboard' && method === 'GET') {
      const settings = await db.getSettings()

      // The lock is enforced HERE, server-side — not left to the frontend to
      // hide. An unauthenticated/public caller gets a locked placeholder
      // response with no team/result data at all. An authenticated
      // coordinator may still preview the real leaderboard while it's
      // locked to the public (their dashboard already shows this data
      // regardless, via /api/state).
      if (!settings.publicLeaderboardUnlocked && !coordinator) {
        return {
          statusCode: 200,
          headers: jsonHeaders,
          body: {
            locked: true,
            message: 'Results will be revealed when authorized by the coordinator.',
            timestamp: now,
          },
        }
      }

      const teams = await db.getTeams()
      const eligible = teams.filter(
        (t) => t.registrationStatus !== 'PENDING' && t.registrationStatus !== 'REJECTED'
      )
      const leaderboard = buildLeaderboard(eligible)
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: {
          locked: false,
          leaderboard: leaderboard.map((row) => ({ ...row, team: toPublicLeaderboardTeamView(row.team) })),
          timestamp: now,
        },
      }
    }

    // -----------------------------------------------------------------------
    // Audit Log (coordinator only)
    // -----------------------------------------------------------------------
    if (pathname === '/api/audit' && method === 'GET') {
      const authError = requireCoordinator()
      if (authError) return authError
      const events = await db.listAuditEvents()
      return { statusCode: 200, headers: jsonHeaders, body: { events } }
    }

    // -----------------------------------------------------------------------
    // Teams Collection (/api/teams) — coordinator only
    // -----------------------------------------------------------------------
    if (pathname === '/api/teams' && method === 'GET') {
      const authError = requireCoordinator()
      if (authError) return authError
      const teams = await db.getTeams()
      return { statusCode: 200, headers: jsonHeaders, body: { teams } }
    }

    if (pathname === '/api/teams' && method === 'POST') {
      const authError = requireCoordinator()
      if (authError) return authError
      const body = req.body || {}
      if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
        return { statusCode: 400, headers: jsonHeaders, body: { error: 'Team name is required.' } }
      }
      const members: string[] = Array.isArray(body.members) ? body.members.filter(Boolean) : []
      const normalizedMobile = normalizeIndianMobile(body.contactMobile)
      if (!normalizedMobile) {
        return {
          statusCode: 400,
          headers: jsonHeaders,
          body: { error: 'A valid team contact mobile number is required (e.g. 8921151978 or +91 8921151978).' },
        }
      }
      const [puzzleVersions, settings] = await Promise.all([db.getPuzzleVersions(), db.getSettings()])
      const draft = newTeamDraft({
        name: body.name.trim(),
        members,
        captain: body.captain && members.includes(body.captain) ? body.captain : members[0] ?? '',
        contactEmail: body.contactEmail ?? '',
        contactMobile: normalizedMobile,
        registrationSource: 'COORDINATOR_MANUAL',
        maxTimeSeconds: body.maxTimeSeconds ?? settings.defaultMaxTimeSeconds,
        puzzleAssignments: defaultPuzzleAssignments(puzzleVersions),
      })
      const team = await db.createTeam(draft)
      await logAudit(db, 'TEAM_REGISTERED', { teamId: team.id, actor: 'coordinator', now, metadata: { source: 'COORDINATOR_MANUAL' } })
      return { statusCode: 201, headers: jsonHeaders, body: { team } }
    }

    // -----------------------------------------------------------------------
    // Individual Team Routes (/api/teams/:id/...)
    // -----------------------------------------------------------------------
    const teamMatch = pathname.match(/^\/api\/teams\/([^/]+)(?:\/(.*))?$/)
    if (teamMatch) {
      const teamId = teamMatch[1]
      const subpath = teamMatch[2] || ''

      // ---- Participant-reachable sub-routes (no coordinator auth) --------

      if (subpath === 'recovery-code/verify' && method === 'POST') {
        const code = String(req.body?.code ?? '')
        const puzzleVersions = await db.getPuzzleVersions()
        const outcome = await withTeamMutation(
          db, teamId, now,
          (team) => engine.verifyRecoveryCode(team, code, puzzleVersions, now).patch,
          'Recovery code cannot be checked in the current state.'
        )
        if (outcome.statusCode !== 200 || !outcome.team) {
          return { statusCode: outcome.statusCode, headers: jsonHeaders, body: outcome.body }
        }
        const correct = outcome.team.recoveryCodeUnlocked === true
        await logAudit(db, 'RECOVERY_CODE_ATTEMPT', { teamId, actor: 'participant', now, metadata: { correct } })
        return { statusCode: 200, headers: jsonHeaders, body: { correct, team: toParticipantTeamView(outcome.team) } }
      }

      if (subpath === 'constraint-breach' && method === 'GET') {
        const team = await db.getTeamById(teamId)
        if (!team) return { statusCode: 404, headers: jsonHeaders, body: { error: 'Team not found' } }
        if (!team.finalModuleEnabled) {
          return { statusCode: 400, headers: jsonHeaders, body: { error: 'Final module has not been enabled by the coordinator yet.' } }
        }
        if (!team.recoveryCodeUnlocked) {
          return { statusCode: 400, headers: jsonHeaders, body: { error: 'Final module is not unlocked yet — enter the correct recovery code first.' } }
        }
        if (!team.constraintBreachVariantId) {
          return { statusCode: 400, headers: jsonHeaders, body: { error: 'No Constraint Breach variant assigned to this team yet.' } }
        }
        const variant = getConstraintVariantById(team.constraintBreachVariantId)
        if (!variant) return { statusCode: 404, headers: jsonHeaders, body: { error: 'Assigned variant not found.' } }
        return {
          statusCode: 200,
          headers: jsonHeaders,
          body: { variant: toParticipantConstraintView(variant, team.constraintBreachHintRevealed === true) },
        }
      }

      if (subpath === 'constraint-breach/submit' && method === 'POST') {
        const submission = req.body as ConstraintBreachSubmission
        const team = await db.getTeamById(teamId)
        if (!team) return { statusCode: 404, headers: jsonHeaders, body: { error: 'Team not found' } }
        if (!team.finalModuleEnabled) {
          return { statusCode: 400, headers: jsonHeaders, body: { error: 'Final module has not been enabled by the coordinator yet.' } }
        }
        if (!team.recoveryCodeUnlocked) {
          return { statusCode: 400, headers: jsonHeaders, body: { error: 'Final module is not unlocked yet — enter the correct recovery code first.' } }
        }
        if (!team.constraintBreachVariantId) {
          return { statusCode: 400, headers: jsonHeaders, body: { error: 'No Constraint Breach variant assigned.' } }
        }
        const variant = getConstraintVariantById(team.constraintBreachVariantId)
        if (!variant) return { statusCode: 404, headers: jsonHeaders, body: { error: 'Assigned variant not found.' } }

        const forbiddenInPlay = team.constraintBreachHintRevealed
          ? [...variant.initialForbiddenCells, variant.hiddenHintForbiddenCell]
          : variant.initialForbiddenCells

        const correct = validateConstraintBreachSubmission(submission?.placement ?? [], variant, forbiddenInPlay)
        await logAudit(db, 'CONSTRAINT_BREACH_COMPLETED', { teamId, actor: 'participant', now, metadata: { correct } })

        if (!correct) {
          return { statusCode: 200, headers: jsonHeaders, body: { correct: false } }
        }

        const overrideCode = deriveOverrideCodeFromPlacement(variant.solution)
        const outcome = await withTeamMutation(
          db, teamId, now,
          (t) => engine.markFinalPuzzleCompleted(t, true, 'FINAL_STABILIZED'),
          'Final module cannot be completed yet (recovery code not unlocked).'
        )
        if (outcome.statusCode !== 200 || !outcome.team) {
          return { statusCode: outcome.statusCode, headers: jsonHeaders, body: outcome.body }
        }
        // Store the server-derived override code so final-code/verify can
        // check it — this is NEVER echoed back to the client.
        const withCode = await db.updateTeam(teamId, { finalCodeOverride: overrideCode }, outcome.team.version)
        const finalTeam = withCode.ok ? withCode.team : outcome.team

        return { statusCode: 200, headers: jsonHeaders, body: { correct: true, team: toParticipantTeamView(finalTeam) } }
      }

      if (subpath === 'final-code/verify' && method === 'POST') {
        const code = String(req.body?.code ?? '')
        const puzzleVersions = await db.getPuzzleVersions()
        let correct = false
        const outcome = await withTeamMutation(
          db, teamId, now,
          (team) => {
            const result = engine.submitCode(team, code, puzzleVersions, now)
            correct = result.correct
            return result.patch
          },
          'Final code cannot be submitted in the current state.'
        )
        if (outcome.statusCode !== 200) {
          return { statusCode: outcome.statusCode, headers: jsonHeaders, body: outcome.body }
        }
        await logAudit(db, 'FINAL_CODE_ATTEMPT', { teamId, actor: 'participant', now, metadata: { correct } })
        if (correct) await logAudit(db, 'TEAM_ESCAPED', { teamId, actor: 'participant', now })

        const team = outcome.team!
        const attemptsRemaining =
          team.maxAttempts !== undefined ? Math.max(0, team.maxAttempts - team.attempts) : null
        return {
          statusCode: 200,
          headers: jsonHeaders,
          body: { correct, attemptsRemaining, status: team.status, team: toParticipantTeamView(team) },
        }
      }

      // ---- Everything else under /api/teams/:id requires coordinator ----
      const authError = requireCoordinator()
      if (authError) return authError

      const team = await db.getTeamById(teamId)
      if (!team) return { statusCode: 404, headers: jsonHeaders, body: { error: `Team ${teamId} not found` } }

      if (subpath === '' && method === 'GET') {
        return { statusCode: 200, headers: jsonHeaders, body: { team } }
      }

      if (subpath === '' && method === 'PATCH') {
        const body = { ...(req.body as Record<string, unknown>) }
        // `expectedVersion` is metadata for the CAS check, not a Team field.
        const expectedVersion = typeof body.expectedVersion === 'number' ? (body.expectedVersion as number) : undefined
        delete body.expectedVersion

        if (body.contactMobile !== undefined) {
          const normalizedMobile = normalizeIndianMobile(body.contactMobile)
          if (!normalizedMobile) {
            return {
              statusCode: 400,
              headers: jsonHeaders,
              body: { error: 'A valid team contact mobile number is required (e.g. 8921151978 or +91 8921151978).' },
            }
          }
          body.contactMobile = normalizedMobile
        }

        const patch = body as Partial<Team>
        const result = await db.updateTeam(teamId, patch, expectedVersion)
        if (!result.ok) {
          if (result.reason === 'not_found') {
            return { statusCode: 404, headers: jsonHeaders, body: { error: 'not_found' } }
          }
          return {
            statusCode: 409,
            headers: jsonHeaders,
            body: { error: 'conflict', message: 'Team was modified by someone else — refresh and try again.', current: result.current },
          }
        }

        // Editing a team's identity/contact details is audited distinctly
        // from generic config changes (puzzle assignment, final-code
        // override, etc.), and never records the actual PII values — only
        // which fields changed.
        const IDENTITY_FIELDS = ['name', 'captain', 'members', 'contactMobile', 'contactEmail'] as const
        const touchedIdentityFields = IDENTITY_FIELDS.filter((f) => f in patch)
        if (touchedIdentityFields.length > 0) {
          await logAudit(db, 'TEAM_DETAILS_UPDATED', {
            teamId,
            actor: 'coordinator',
            now,
            metadata: { fields: touchedIdentityFields },
          })
        } else {
          await logAudit(db, 'TEAM_EDITED', { teamId, actor: 'coordinator', now })
        }
        return { statusCode: 200, headers: jsonHeaders, body: { team: result.team } }
      }

      if (subpath === '' && method === 'DELETE') {
        await db.deleteTeam(teamId)
        await logAudit(db, 'TEAM_DELETED', { teamId, actor: 'coordinator', now })
        return { statusCode: 200, headers: jsonHeaders, body: { deleted: true, teamId } }
      }

      if (subpath === 'approve' && method === 'POST') {
        const outcome = await withTeamMutation(db, teamId, now, engine.approveTeam, 'Team cannot be approved from its current status.')
        if (outcome.statusCode === 200) await logAudit(db, 'TEAM_APPROVED', { teamId, actor: 'coordinator', now })
        return { statusCode: outcome.statusCode, headers: jsonHeaders, body: outcome.team ? { team: outcome.team } : outcome.body }
      }

      if (subpath === 'reject' && method === 'POST') {
        const outcome = await withTeamMutation(db, teamId, now, engine.rejectTeam, 'Team cannot be rejected from its current status.')
        if (outcome.statusCode === 200) await logAudit(db, 'TEAM_REJECTED', { teamId, actor: 'coordinator', now })
        return { statusCode: outcome.statusCode, headers: jsonHeaders, body: outcome.team ? { team: outcome.team } : outcome.body }
      }

      if (subpath === 'activate' && method === 'POST') {
        const outcome = await withTeamMutation(db, teamId, now, engine.activateTeam, 'Team cannot be activated from its current status.')
        if (outcome.statusCode === 200) await logAudit(db, 'TEAM_EDITED', { teamId, actor: 'coordinator', now, metadata: { action: 'activate' } })
        return { statusCode: outcome.statusCode, headers: jsonHeaders, body: outcome.team ? { team: outcome.team } : outcome.body }
      }

      if (subpath === 'game/start' && method === 'POST') {
        const outcome = await withTeamMutation(
          db, teamId, now,
          (t) => {
            if (t.registrationStatus === 'PENDING' || t.registrationStatus === 'REJECTED') return null
            return engine.startGame(t, now)
          },
          'Game cannot be started — team must be APPROVED/ACTIVE and NOT_STARTED'
        )
        if (outcome.statusCode === 200) await logAudit(db, 'GAME_STARTED', { teamId, actor: 'coordinator', now })
        return { statusCode: outcome.statusCode, headers: jsonHeaders, body: outcome.team ? { team: outcome.team } : outcome.body }
      }

      if (subpath === 'game/pause' && method === 'POST') {
        const outcome = await withTeamMutation(db, teamId, now, (t) => engine.pauseGame(t, now), 'Game cannot be paused from current status')
        if (outcome.statusCode === 200) await logAudit(db, 'GAME_PAUSED', { teamId, actor: 'coordinator', now })
        return { statusCode: outcome.statusCode, headers: jsonHeaders, body: outcome.team ? { team: outcome.team } : outcome.body }
      }

      if (subpath === 'game/resume' && method === 'POST') {
        const outcome = await withTeamMutation(db, teamId, now, (t) => engine.resumeGame(t, now), 'Game cannot be resumed from current status')
        if (outcome.statusCode === 200) await logAudit(db, 'GAME_RESUMED', { teamId, actor: 'coordinator', now })
        return { statusCode: outcome.statusCode, headers: jsonHeaders, body: outcome.team ? { team: outcome.team } : outcome.body }
      }

      if (subpath === 'game/escape' && method === 'POST') {
        const outcome = await withTeamMutation(db, teamId, now, (t) => engine.markEscaped(t, now), 'Team is not in an escapable active state')
        if (outcome.statusCode === 200) await logAudit(db, 'TEAM_ESCAPED', { teamId, actor: 'coordinator', now, metadata: { manualOverride: true } })
        return { statusCode: outcome.statusCode, headers: jsonHeaders, body: outcome.team ? { team: outcome.team } : outcome.body }
      }

      if (subpath === 'game/reset' && method === 'POST') {
        const outcome = await withTeamMutation(db, teamId, now, engine.resetActiveRun, 'Cannot reset completed run using active reset')
        if (outcome.statusCode === 200) await logAudit(db, 'RESET_PERFORMED', { teamId, actor: 'coordinator', now })
        return { statusCode: outcome.statusCode, headers: jsonHeaders, body: outcome.team ? { team: outcome.team } : outcome.body }
      }

      if (subpath === 'hints/use' && method === 'POST') {
        const level = req.body?.level as HintLevel
        const outcome = await withTeamMutation(db, teamId, now, (t) => engine.giveHint(t, now, level), 'Hint cannot be used in current state or sequence')
        if (outcome.statusCode === 200) {
          await logAudit(db, 'HINT_USED', { teamId, actor: 'coordinator', now, metadata: { level } })
          // Reveal the 4th forbidden cell only once Hint 1 has legitimately fired.
          if (level === 1) await db.updateTeam(teamId, { constraintBreachHintRevealed: true }, outcome.team!.version)
        }
        return { statusCode: outcome.statusCode, headers: jsonHeaders, body: outcome.team ? { team: outcome.team } : outcome.body }
      }

      // POST /api/teams/:id/puzzles/:slotId/complete
      const puzzleCompleteMatch = subpath.match(/^puzzles\/([^/]+)\/complete$/)
      if (puzzleCompleteMatch && method === 'POST') {
        const slot = puzzleCompleteMatch[1] as PuzzleSlotKey
        const completed = req.body?.completed === true
        const outputFragment = req.body?.outputFragment

        const assignment = team.puzzleAssignments.find((a) => a.slot === slot)
        const puzzleVersions = await db.getPuzzleVersions()
        const puzzleVersion = puzzleVersions.find((v) => v.id === assignment?.puzzleVersionId)

        if (puzzleVersion && puzzleVersion.completionMode === 'SERVER_VALIDATED' && completed) {
          return {
            statusCode: 400,
            headers: jsonHeaders,
            body: { error: 'This slot requires a server-validated submission, not manual completion.' },
          }
        }
        if (puzzleVersion?.completionMode === 'DEV_SHORTCUT' && isProduction()) {
          return { statusCode: 403, headers: jsonHeaders, body: { error: 'Dev-shortcut completion is disabled in production.' } }
        }

        const outcome = await withTeamMutation(
          db, teamId, now,
          (t) =>
            slot === 'FINAL_SLOT'
              ? engine.markFinalPuzzleCompleted(t, completed, outputFragment)
              : engine.markInitialPuzzleCompleted(t, slot as InitialPuzzleSlotKey, completed, outputFragment),
          'Puzzle completion rejected (check gating rules)'
        )
        if (outcome.statusCode === 200) {
          await logAudit(db, 'PUZZLE_COMPLETED', { teamId, actor: 'coordinator', now, metadata: { slot, completed } })
        }
        return { statusCode: outcome.statusCode, headers: jsonHeaders, body: outcome.team ? { team: outcome.team } : outcome.body }
      }

      // ---- Delete Completed Result (random server-generated token) ------

      if (subpath === 'result/delete-token' && method === 'POST') {
        if (!engine.isFinished(team)) {
          return { statusCode: 400, headers: jsonHeaders, body: { error: 'Team has not finished — nothing to delete.' } }
        }
        const token = await db.createDeleteResultToken(teamId)
        return {
          statusCode: 200,
          headers: jsonHeaders,
          body: {
            token,
            teamName: team.name,
            officialRankingSeconds: team.officialRankingSeconds,
            expiresInSeconds: 300,
          },
        }
      }

      if (subpath === 'result/delete' && method === 'POST') {
        const submitted = String(req.body?.token ?? '')
        const valid = await db.consumeDeleteResultToken(teamId, submitted)
        if (!valid) {
          return { statusCode: 400, headers: jsonHeaders, body: { error: 'Invalid or expired confirmation token.' } }
        }
        const outcome = await withTeamMutation(db, teamId, now, engine.clearCompletedResult, 'Team has not finished or cannot be cleared')
        if (outcome.statusCode === 200) {
          await logAudit(db, 'RESULT_DELETED', { teamId, actor: 'coordinator', now })
        }
        return { statusCode: outcome.statusCode, headers: jsonHeaders, body: outcome.team ? { team: outcome.team } : outcome.body }
      }
    }

    // -----------------------------------------------------------------------
    // Development Utilities (/api/dev/...) — never available in production
    // -----------------------------------------------------------------------
    if (pathname === '/api/dev/constraint-breach/validate' && method === 'POST') {
      if (isProduction()) {
        return { statusCode: 403, headers: jsonHeaders, body: { error: 'Dev utilities are disabled in production.' } }
      }
      const { fixedAgents, forbiddenCells } = req.body || {}
      const result = solveConstraintBreach(fixedAgents ?? [], forbiddenCells ?? [])
      return { statusCode: 200, headers: jsonHeaders, body: result }
    }

    // 404 Route Not Found
    return { statusCode: 404, headers: jsonHeaders, body: { error: `Endpoint ${method} ${pathname} not found` } }
  } catch (error: any) {
    console.error('API Handler Error:', error)
    return { statusCode: 500, headers: jsonHeaders, body: { error: error?.message ?? 'Internal Server Error' } }
  }
}
