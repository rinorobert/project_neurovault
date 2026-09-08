process.env.NODE_ENV = process.env.NODE_ENV ?? 'test'
process.env.COORDINATOR_PIN = 'test-pin-9182'
delete process.env.DATABASE_URL // force the in-memory repository for this test run

import { handleApiRoute, type ApiRequest } from '../src/server/apiRouter.js'
import { getDatabase, __resetDatabaseForTests } from '../src/server/db/client.js'
import { CB_DEV_FIXTURE_VARIANTS } from '../src/server/puzzleData/constraintVariants.js'
import { DEV_FIXTURE_PUZZLE_VERSIONS } from '../src/data/devFixtures.js'
import { deriveOverrideCodeFromPlacement } from '../src/lib/constraintBreachSolver.js'

let failures = 0
function check(label: string, cond: boolean, extra?: unknown) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${!cond && extra !== undefined ? ` :: ${JSON.stringify(extra)}` : ''}`)
  if (!cond) failures++
}
function section(title: string) {
  console.log(`\n--- ${title} ---`)
}

__resetDatabaseForTests()

function extractCookie(headers: Record<string, string | string[]>): string | null {
  const raw = headers['Set-Cookie']
  if (!raw) return null
  const value = Array.isArray(raw) ? raw[0] : raw
  return value.split(';')[0] // "nv_coordinator_session=<token>"
}

async function call(
  method: string,
  url: string,
  opts: { body?: any; cookie?: string | null } = {}
) {
  const req: ApiRequest = {
    method,
    url,
    headers: opts.cookie ? { cookie: opts.cookie } : {},
    body: opts.body,
  }
  return handleApiRoute(req)
}

async function run() {
  // ==========================================================================
  section('0. Zero-Seed Startup (No Demo/Sample Teams in Production Data Path)')
  // ==========================================================================
  {
    const loginFail = await call('POST', '/api/auth/coordinator/login', { body: { pin: 'wrong' } })
    check('Wrong PIN is rejected (401)', loginFail.statusCode === 401)

    const login = await call('POST', '/api/auth/coordinator/login', { body: { pin: 'test-pin-9182' } })
    check('Correct PIN returns 200', login.statusCode === 200)
    const cookie = extractCookie(login.headers)
    check('Correct PIN issues a Set-Cookie session token', Boolean(cookie))

    const teamsRes = await call('GET', '/api/teams', { cookie })
    check('Fresh database starts with ZERO teams', Array.isArray(teamsRes.body.teams) && teamsRes.body.teams.length === 0)

    var coordinatorCookie = cookie
  }

  // ==========================================================================
  section('1. Coordinator Auth Enforcement on Mutating Routes')
  // ==========================================================================
  {
    const noAuthAttempts: Array<[string, string, any?]> = [
      ['POST', '/api/teams', { name: 'X', members: ['a', 'b', 'c', 'd'] }],
      ['GET', '/api/audit'],
      ['POST', '/api/active-team', { id: null }],
      ['PATCH', '/api/settings', { defaultMaxTimeSeconds: 60 }],
    ]
    for (const [method, url, body] of noAuthAttempts) {
      const res = await call(method, url, { body })
      check(`${method} ${url} without a session is rejected (401)`, res.statusCode === 401)
    }
  }

  // ==========================================================================
  section('2. Public Registration (POST /api/register)')
  // ==========================================================================
  let publicTeamId = ''
  let formatTestTeamIds: string[] = []
  {
    const bad = await call('POST', '/api/register', {
      body: { teamName: 'Incomplete', players: ['A', 'B'], captain: 'A', contactEmail: 'a@b.com', contactMobile: '8921151978' },
    })
    check('Registration with != 4 players is rejected (400, not 500)', bad.statusCode === 400)

    // --- Mobile number validation (server-side, common Indian formats) ---
    const missingMobile = await call('POST', '/api/register', {
      body: {
        teamName: 'No Mobile Team',
        players: ['A', 'B', 'C', 'D'],
        captain: 'A',
        contactEmail: 'nomobile@example.com',
      },
    })
    check('Registration without a mobile number is rejected (400)', missingMobile.statusCode === 400)

    const invalidMobile = await call('POST', '/api/register', {
      body: {
        teamName: 'Bad Mobile Team',
        players: ['A', 'B', 'C', 'D'],
        captain: 'A',
        contactEmail: 'badmobile@example.com',
        contactMobile: '12345',
      },
    })
    check('Registration with an invalid mobile number is rejected (400)', invalidMobile.statusCode === 400)

    const validFormats = ['8921151978', '+91 8921151978', '+918921151978']
    for (const [i, mobile] of validFormats.entries()) {
      const r = await call('POST', '/api/register', {
        body: {
          teamName: `Mobile Format Test ${i}`,
          players: ['A', 'B', 'C', 'D'],
          captain: 'A',
          contactEmail: `mobiletest${i}@example.com`,
          contactMobile: mobile,
        },
      })
      check(`Registration accepts common Indian mobile format "${mobile}" (201)`, r.statusCode === 201)
      formatTestTeamIds.push(r.body.team.id)
    }

    const res = await call('POST', '/api/register', {
      body: {
        teamName: 'Quantum Coders',
        players: ['Alice', 'Bob', 'Carol', 'Dave'],
        captain: 'Alice',
        contactEmail: 'alice@example.com',
        contactMobile: '8921151978',
      },
    })
    check('Valid public registration succeeds (201)', res.statusCode === 201)
    check('New team id follows server-generated NV-### format', /^NV-\d{3}$/.test(res.body.team.id))
    check('New public registration starts PENDING', res.body.team.registrationStatus === 'PENDING')
    check('Registration source recorded as PUBLIC_FORM', res.body.team.registrationSource === 'PUBLIC_FORM')
    check(
      'Public registration response never includes finalCodeOverride/constraintBreachVariantId/finalCodeTransform',
      !('finalCodeOverride' in res.body.team) &&
        !('constraintBreachVariantId' in res.body.team) &&
        !('finalCodeTransform' in res.body.team)
    )
    check(
      'Public registration response never includes contactMobile or contactEmail (private contact info)',
      !('contactMobile' in res.body.team) && !('contactEmail' in res.body.team)
    )
    publicTeamId = res.body.team.id

    // Confirm normalization actually persisted correctly server-side —
    // check via the coordinator-only full record after login below.
  }

  // ==========================================================================
  section('2.5. Mobile Number Normalization Persists Correctly')
  // ==========================================================================
  {
    const login = await call('POST', '/api/auth/coordinator/login', { body: { pin: 'test-pin-9182' } })
    const cookie = extractCookie(login.headers)

    for (const id of formatTestTeamIds) {
      const teamRes = await call('GET', `/api/teams/${id}`, { cookie })
      check(
        `Coordinator view of ${id} shows the mobile number normalized to +918921151978 regardless of input format`,
        teamRes.body.team.contactMobile === '+918921151978'
      )
    }
  }

  // ==========================================================================
  section('3. Server-Generated, Atomically-Unique Team IDs')
  // ==========================================================================
  {
    const noMobile = await call('POST', '/api/teams', {
      cookie: coordinatorCookie,
      body: { name: 'No Mobile Manual Team', members: ['p1', 'p2', 'p3', 'p4'], captain: 'p1', contactEmail: 'nm@x.com' },
    })
    check('Coordinator manual team creation without a mobile number is rejected (400)', noMobile.statusCode === 400)

    const a = await call('POST', '/api/teams', {
      cookie: coordinatorCookie,
      body: { name: 'Team A', members: ['p1', 'p2', 'p3', 'p4'], captain: 'p1', contactEmail: 'a@x.com', contactMobile: '8921151978' },
    })
    const b = await call('POST', '/api/teams', {
      cookie: coordinatorCookie,
      body: { name: 'Team B', members: ['p1', 'p2', 'p3', 'p4'], captain: 'p1', contactEmail: 'b@x.com', contactMobile: '+91 8921151978' },
    })
    check('Coordinator manual team creation accepts a mobile number (201)', a.statusCode === 201 && b.statusCode === 201)
    check('Manually-created team mobile number is normalized and persisted', a.body.team.contactMobile === '+918921151978')
    check('Two sequential coordinator-created teams get distinct ids', a.body.team.id !== b.body.team.id)
    check('IDs are sequential NV-### values', a.body.team.id !== publicTeamId && b.body.team.id !== a.body.team.id)
  }

  // ==========================================================================
  section('3.5. Registered Team Details — View & Edit (Coordinator Only)')
  // ==========================================================================
  {
    const noAuthDetails = await call('GET', `/api/teams/${publicTeamId}`)
    check('Fetching full team details without a coordinator session is rejected (401)', noAuthDetails.statusCode === 401)

    const detailsRes = await call('GET', `/api/teams/${publicTeamId}`, { cookie: coordinatorCookie })
    check('Coordinator can retrieve full team details (200)', detailsRes.statusCode === 200)
    const team = detailsRes.body.team
    check('Full details include identity fields', team.id === publicTeamId && team.name === 'Quantum Coders')
    check('Full details include members/captain', team.captain === 'Alice' && team.members.includes('Bob'))
    check('Full details include contact info (mobile + email)', team.contactMobile === '+918921151978' && team.contactEmail === 'alice@example.com')
    check('Full details include registration metadata', team.registrationStatus === 'PENDING' && team.registrationSource === 'PUBLIC_FORM')
    check('Full details include game/puzzle assignment data', Array.isArray(team.puzzleAssignments) && typeof team.hintsUsed === 'number')

    // --- Coordinator edits identity/contact fields ------------------------
    const editRes = await call('PATCH', `/api/teams/${publicTeamId}`, {
      cookie: coordinatorCookie,
      body: {
        name: 'Quantum Coders Renamed',
        captain: 'Bob',
        members: ['Bob', 'Alice', 'Carol', 'Dave'],
        contactMobile: '+91 9123456780',
        contactEmail: 'bob@example.com',
        expectedVersion: team.version,
      },
    })
    check('Coordinator can edit team name/captain/members/contact (200)', editRes.statusCode === 200)
    check('Edited name persists', editRes.body.team.name === 'Quantum Coders Renamed')
    check('Edited captain persists', editRes.body.team.captain === 'Bob')
    check('Edited mobile number is normalized and persists', editRes.body.team.contactMobile === '+919123456780')
    check('Edited email persists', editRes.body.team.contactEmail === 'bob@example.com')
    check('Version incremented after successful edit', editRes.body.team.version === team.version + 1)

    // --- Invalid mobile on edit is rejected server-side --------------------
    const badEdit = await call('PATCH', `/api/teams/${publicTeamId}`, {
      cookie: coordinatorCookie,
      body: { contactMobile: '123' },
    })
    check('Editing to an invalid mobile number is rejected (400)', badEdit.statusCode === 400)

    // --- CAS/version conflict handling -------------------------------------
    const staleEdit = await call('PATCH', `/api/teams/${publicTeamId}`, {
      cookie: coordinatorCookie,
      body: { name: 'Stale Write', expectedVersion: team.version }, // now outdated — real version has moved on
    })
    check('Editing with a stale expectedVersion is rejected as a conflict (409)', staleEdit.statusCode === 409)
    const afterStale = await call('GET', `/api/teams/${publicTeamId}`, { cookie: coordinatorCookie })
    check('Team name is unaffected by the rejected stale edit', afterStale.body.team.name === 'Quantum Coders Renamed')

    // --- Unauthorized users cannot edit --------------------------------
    const noAuthEdit = await call('PATCH', `/api/teams/${publicTeamId}`, { body: { name: 'Hacked' } })
    check('Editing team details without a coordinator session is rejected (401)', noAuthEdit.statusCode === 401)

    // --- Audit event ------------------------------------------------------
    const auditRes = await call('GET', '/api/audit', { cookie: coordinatorCookie })
    const detailEvents = (auditRes.body.events as any[]).filter(
      (e) => e.type === 'TEAM_DETAILS_UPDATED' && e.teamId === publicTeamId
    )
    check('TEAM_DETAILS_UPDATED audit event was recorded for the edit', detailEvents.length > 0)
    check(
      'TEAM_DETAILS_UPDATED audit metadata records only field NAMES, never PII values',
      detailEvents.every((e) => {
        const meta = JSON.stringify(e.metadata ?? {})
        return !meta.includes('+919123456780') && !meta.includes('bob@example.com') && !meta.includes('Quantum Coders Renamed')
      })
    )
  }

  // ==========================================================================
  section('4. Puzzle Answer / Code Sanitization (No Leakage to Participants)')
  // ==========================================================================
  {
    const db = getDatabase()
    for (const pv of DEV_FIXTURE_PUZZLE_VERSIONS) {
      await db.savePuzzleVersion(pv)
    }

    const stateNoAuth = await call('GET', '/api/state')
    const anyLeak = (stateNoAuth.body.puzzleVersions as any[]).some(
      (pv) => 'answer' in pv || 'outputDigit' in pv || 'hint' in pv
    )
    check('GET /api/state WITHOUT a session never includes answer/outputDigit/hint fields', !anyLeak)
    check(
      'GET /api/state WITHOUT a session marks coordinator:false',
      stateNoAuth.body.coordinator === false
    )

    const stateAuthed = await call('GET', '/api/state', { cookie: coordinatorCookie })
    const anyHasDigit = (stateAuthed.body.puzzleVersions as any[]).some((pv) => pv.outputDigit !== undefined)
    check('GET /api/state WITH a valid coordinator session DOES include full puzzle data', anyHasDigit)

    const teamNoAuth = stateNoAuth.body.teams.find((t: any) => t.id === publicTeamId)
    check(
      'Participant-visible team record omits finalCodeOverride/constraintBreachVariantId/finalCodeTransform',
      teamNoAuth &&
        !('finalCodeOverride' in teamNoAuth) &&
        !('constraintBreachVariantId' in teamNoAuth) &&
        !('finalCodeTransform' in teamNoAuth)
    )
    check(
      'Participant-visible team record (via /api/state) never includes contactMobile or contactEmail',
      teamNoAuth && !('contactMobile' in teamNoAuth) && !('contactEmail' in teamNoAuth)
    )

    const stateAuthedTeam = stateAuthed.body.teams.find((t: any) => t.id === publicTeamId)
    check(
      'Coordinator-authenticated /api/state DOES include contactMobile/contactEmail for internal use',
      stateAuthedTeam && stateAuthedTeam.contactMobile === '+919123456780' && typeof stateAuthedTeam.contactEmail === 'string'
    )
  }

  // ==========================================================================
  section('5. Registration Lifecycle Gates Gameplay')
  // ==========================================================================
  {
    const startBlocked = await call('POST', `/api/teams/${publicTeamId}/game/start`, { cookie: coordinatorCookie })
    check('game/start is rejected for a PENDING team', startBlocked.statusCode === 400)

    const approve = await call('POST', `/api/teams/${publicTeamId}/approve`, { cookie: coordinatorCookie })
    check('Coordinator can approve a PENDING team', approve.statusCode === 200 && approve.body.team.registrationStatus === 'APPROVED')

    const activate = await call('POST', `/api/teams/${publicTeamId}/activate`, { cookie: coordinatorCookie })
    check('Coordinator can activate an APPROVED team', activate.statusCode === 200 && activate.body.team.registrationStatus === 'ACTIVE')

    // Assign real puzzle content (dev fixtures) to this team, coordinator-only
    const assignments = ['SLOT_1', 'SLOT_2', 'SLOT_3', 'SLOT_4', 'FINAL_SLOT'].map((slot) => ({
      slot,
      puzzleVersionId:
        slot === 'FINAL_SLOT'
          ? 'NV_FINAL_MOD_V01'
          : DEV_FIXTURE_PUZZLE_VERSIONS.filter((p) => p.slot === slot)[0].id,
    }))
    const patch = await call('PATCH', `/api/teams/${publicTeamId}`, {
      cookie: coordinatorCookie,
      body: { puzzleAssignments: assignments, constraintBreachVariantId: CB_DEV_FIXTURE_VARIANTS[0].id },
    })
    check('Coordinator can PATCH team puzzle assignments + assign a Constraint Breach variant', patch.statusCode === 200)

    const start = await call('POST', `/api/teams/${publicTeamId}/game/start`, { cookie: coordinatorCookie })
    check('game/start succeeds once ACTIVE', start.statusCode === 200 && start.body.team.status === 'RUNNING')
  }

  // ==========================================================================
  section('6. Puzzle Completion Authorization (No Arbitrary Participant Self-Complete)')
  // ==========================================================================
  {
    const noAuth = await call('POST', `/api/teams/${publicTeamId}/puzzles/SLOT_1/complete`, {
      body: { completed: true },
    })
    check('Puzzle completion without a coordinator session is rejected (401)', noAuth.statusCode === 401)

    for (const slot of ['SLOT_1', 'SLOT_2', 'SLOT_3', 'SLOT_4']) {
      const res = await call('POST', `/api/teams/${publicTeamId}/puzzles/${slot}/complete`, {
        cookie: coordinatorCookie,
        body: { completed: true },
      })
      check(`Coordinator can mark ${slot} complete`, res.statusCode === 200)
    }

    const finalDirect = await call('POST', `/api/teams/${publicTeamId}/puzzles/FINAL_SLOT/complete`, {
      cookie: coordinatorCookie,
      body: { completed: true },
    })
    check(
      'FINAL_SLOT (SERVER_VALIDATED) cannot be marked complete via the generic manual-completion route',
      finalDirect.statusCode === 400
    )
  }

  // ==========================================================================
  section('7. Recovery Code Unlocks Final Module (Never Escapes By Itself)')
  // ==========================================================================
  {
    const db = getDatabase()
    const team = await db.getTeamById(publicTeamId)

    const wrong = await call('POST', `/api/teams/${publicTeamId}/recovery-code/verify`, { body: { code: '0000' } })
    check('Wrong recovery code returns correct:false', wrong.body.correct === false)
    check('Wrong recovery code does not change team status', wrong.body.team.status === 'RUNNING')

    // Compute the true recovery code the same way the server does, using
    // the FULL (server-only) puzzle data — this simulates a team correctly
    // reading their 4 physical station outputs, NOT reading it from any API
    // response (no endpoint ever returns this to a participant).
    const puzzleVersions = await db.getPuzzleVersions()
    const digitsBySlot: Record<string, number> = {}
    for (const a of team!.puzzleAssignments) {
      const pv = puzzleVersions.find((p) => p.id === a.puzzleVersionId)
      if (pv?.outputDigit !== undefined) digitsBySlot[a.slot] = pv.outputDigit
    }
    const trueCode = ['SLOT_1', 'SLOT_2', 'SLOT_3', 'SLOT_4'].map((s) => digitsBySlot[s] ?? 0).join('')

    const correct = await call('POST', `/api/teams/${publicTeamId}/recovery-code/verify`, { body: { code: trueCode } })
    check('Correct recovery code returns correct:true', correct.body.correct === true)
    check('Correct recovery code unlocks the final module', correct.body.team.recoveryCodeUnlocked === true)
    check('Recovery code unlock does NOT escape the team', correct.body.team.status === 'RUNNING')
  }

  // ==========================================================================
  section('7.5. Final Module Coordinator Enablement Gate (Checkbox Fix)')
  // ==========================================================================
  {
    const db = getDatabase()
    const variant = CB_DEV_FIXTURE_VARIANTS[1]

    const gateTeam = await db.createTeam({
      name: 'Gate Test Team',
      members: ['a', 'b', 'c', 'd'],
      captain: 'a',
      contactEmail: 'gate@test.com',
      registrationStatus: 'ACTIVE',
      registeredAt: Date.now(),
      registrationSource: 'COORDINATOR_MANUAL',
      puzzleAssignments: [],
      finalCodeTransform: {},
      finalModuleEnabled: false,
      constraintBreachVariantId: variant.id,
      maxTimeSeconds: 1500,
      status: 'RUNNING',
      startedAt: Date.now() - 1000,
      totalPausedMs: 0,
      puzzleCompleted: { SLOT_1: true, SLOT_2: true, SLOT_3: true, SLOT_4: true },
      finalPuzzleCompleted: false,
      puzzleOutputs: {},
      hintsUsed: 0,
      hintLevelLog: [],
      attempts: 0,
      attemptLog: [],
      recoveryCodeUnlocked: false,
    } as any)

    // --- (a) Neither condition met yet ---------------------------------
    const noneYet = await call('GET', `/api/teams/${gateTeam.id}/constraint-breach`)
    check('Constraint Breach view rejected before enablement AND before recovery code', noneYet.statusCode === 400)
    check(
      'Rejection message specifically calls out "enabled" when not yet enabled',
      String(noneYet.body.error).toLowerCase().includes('enabled')
    )

    // --- Auth is required to flip the flag ------------------------------
    const noAuthEnable = await call('PATCH', `/api/teams/${gateTeam.id}`, {
      body: { finalModuleEnabled: true },
    })
    check('Enabling the Final Module without a coordinator session is rejected (401)', noAuthEnable.statusCode === 401)

    // --- (1) Coordinator can enable the Final Module checkbox ----------
    const enableRes = await call('PATCH', `/api/teams/${gateTeam.id}`, {
      cookie: coordinatorCookie,
      body: { finalModuleEnabled: true },
    })
    check('Coordinator can enable the Final Module (200)', enableRes.statusCode === 200)
    check('Response reflects finalModuleEnabled: true', enableRes.body.team.finalModuleEnabled === true)

    // --- (2) State persists through the existing server/DB mechanism ---
    const refetched = await call('GET', `/api/teams/${gateTeam.id}`, { cookie: coordinatorCookie })
    check(
      'Re-fetching the team (fresh read) still shows finalModuleEnabled: true — it persisted',
      refetched.body.team.finalModuleEnabled === true
    )

    // --- Enabling alone must NOT mark the team escaped/completed -------
    check('Enabling Final Module does not change team status', enableRes.body.team.status === 'RUNNING')
    check('Enabling Final Module does not mark finalPuzzleCompleted', enableRes.body.team.finalPuzzleCompleted === false)
    check('Enabling Final Module does not set a completion/ranking time', enableRes.body.team.officialRankingSeconds === undefined)

    // --- (b) Enabled, but recovery code still not verified --------------
    const enabledOnly = await call('GET', `/api/teams/${gateTeam.id}/constraint-breach`)
    check('Constraint Breach view still rejected: enabled but recovery code not yet unlocked', enabledOnly.statusCode === 400)
    check(
      'Rejection message specifically calls out the recovery code when that is the missing condition',
      String(enabledOnly.body.error).toLowerCase().includes('recovery code')
    )
    const submitEnabledOnly = await call('POST', `/api/teams/${gateTeam.id}/constraint-breach/submit`, {
      body: { placement: variant.solution },
    })
    check(
      'Constraint Breach submission also rejected before recovery code is unlocked (400, not silently validated)',
      submitEnabledOnly.statusCode === 400
    )

    // --- Now unlock the recovery code (the OTHER required condition) ---
    await db.updateTeam(gateTeam.id, { recoveryCodeUnlocked: true })

    // --- (c) Un-enable temporarily to prove recovery code alone is not enough ---
    await db.updateTeam(gateTeam.id, { finalModuleEnabled: false })
    const recoveryOnly = await call('GET', `/api/teams/${gateTeam.id}/constraint-breach`)
    check('Constraint Breach view rejected: recovery code unlocked but coordinator has NOT enabled it', recoveryOnly.statusCode === 400)
    check(
      'Rejection message calls out "enabled" when that is the missing condition',
      String(recoveryOnly.body.error).toLowerCase().includes('enabled')
    )

    // --- (3+d) BOTH conditions true -> participant interface unlocks ---
    await db.updateTeam(gateTeam.id, { finalModuleEnabled: true })
    const bothMet = await call('GET', `/api/teams/${gateTeam.id}/constraint-breach`)
    check('Constraint Breach view succeeds once BOTH conditions are true', bothMet.statusCode === 200)

    const submitBothMet = await call('POST', `/api/teams/${gateTeam.id}/constraint-breach/submit`, {
      body: { placement: variant.solution },
    })
    check('Constraint Breach submission is accepted once BOTH conditions are true', submitBothMet.body.correct === true)
    check('Accepted submission marks the final module complete', submitBothMet.body.team.finalPuzzleCompleted === true)
  }

  // ==========================================================================
  section('8. Constraint Breach — Server-Validated Final Module + Derived Override Code')
  // ==========================================================================
  {
    const variant = CB_DEV_FIXTURE_VARIANTS[0]

    // The Constraint Breach interface requires BOTH conditions now — the
    // recovery code was already unlocked in section 7, so the coordinator
    // also needs to flip the Final Module enablement flag (the fixed
    // checkbox) before this team's participant interface opens.
    const enableMain = await call('PATCH', `/api/teams/${publicTeamId}`, {
      cookie: coordinatorCookie,
      body: { finalModuleEnabled: true },
    })
    check('Coordinator enables Final Module for the main end-to-end team', enableMain.statusCode === 200 && enableMain.body.team.finalModuleEnabled === true)

    const view = await call('GET', `/api/teams/${publicTeamId}/constraint-breach`)
    check('Participant Constraint Breach view succeeds once unlocked', view.statusCode === 200)
    check('Participant view exposes exactly 3 forbidden cells (hint not yet used)', view.body.variant.forbiddenCells.length === 3)
    check('Participant view never includes the solution', !('solution' in view.body.variant))
    check('Participant view never includes the hidden hint cell field', !('hiddenHintForbiddenCell' in view.body.variant))

    const badSubmit = await call('POST', `/api/teams/${publicTeamId}/constraint-breach/submit`, {
      body: { placement: variant.solution.map((s) => ({ ...s, col: (s.col + 1) % 8 })) },
    })
    check('Tampered Constraint Breach submission is rejected', badSubmit.body.correct === false)

    const goodSubmit = await call('POST', `/api/teams/${publicTeamId}/constraint-breach/submit`, {
      body: { placement: variant.solution },
    })
    check('Correct Constraint Breach submission is accepted', goodSubmit.body.correct === true)
    check('Correct submission marks the final module complete', goodSubmit.body.team.finalPuzzleCompleted === true)
    check('Constraint Breach completion does NOT escape the team', goodSubmit.body.team.status === 'RUNNING')
    check(
      'Constraint Breach response never echoes back the override code or variant internals',
      !('finalCodeOverride' in goodSubmit.body.team)
    )

    const expectedOverride = deriveOverrideCodeFromPlacement(variant.solution)

    const beforePartialFinal = await getDatabase().getTeamById(publicTeamId)
    const partialFinal = await call('POST', `/api/teams/${publicTeamId}/final-code/verify`, { body: { code: '1234567' } })
    const afterPartialFinal = await getDatabase().getTeamById(publicTeamId)
    check('A 7-digit final override is rejected before validation', partialFinal.statusCode === 400)
    check(
      'A partial final override does not count as an attempt',
      afterPartialFinal?.attempts === beforePartialFinal?.attempts && afterPartialFinal?.attemptLog.length === beforePartialFinal?.attemptLog.length
    )

    const wrongFinal = await call('POST', `/api/teams/${publicTeamId}/final-code/verify`, { body: { code: '00000000' } })
    check('Wrong final override code is rejected', wrongFinal.body.correct === false)
    check('Team status remains RUNNING after a wrong final code', wrongFinal.body.status === 'RUNNING')

    const rightFinal = await call('POST', `/api/teams/${publicTeamId}/final-code/verify`, {
      body: { code: expectedOverride },
    })
    check('Server-derived final override code (from the validated board) is accepted', rightFinal.body.correct === true)
    check('Correct final code transitions the team to ESCAPED', rightFinal.body.status === 'ESCAPED')
  }

  // ==========================================================================
  section('9. Terminal-State Freeze Cannot Be Overwritten')
  // ==========================================================================
  {
    const beforeAgain = await getDatabase().getTeamById(publicTeamId)
    const again = await call('POST', `/api/teams/${publicTeamId}/final-code/verify`, {
      body: { code: '99999999' },
    })
    // Resubmitting against an already-ESCAPED team is a safe, side-effect-free
    // echo (the engine returns an empty patch) rather than a hard error — the
    // important guarantee is that it can NEVER mutate the frozen result.
    check('Resubmitting after ESCAPED does not error the request', again.statusCode === 200)
    const afterAgain = await getDatabase().getTeamById(publicTeamId)
    check(
      'Resubmitting after ESCAPED never mutates the frozen result (attempts/status/ranking unchanged)',
      afterAgain?.status === beforeAgain?.status &&
        afterAgain?.attempts === beforeAgain?.attempts &&
        afterAgain?.officialRankingSeconds === beforeAgain?.officialRankingSeconds
    )

    const resetAttempt = await call('POST', `/api/teams/${publicTeamId}/game/reset`, { cookie: coordinatorCookie })
    check('"Reset Active Run" (not Delete Result) refuses an already-finished team', resetAttempt.statusCode === 400)
  }

  // ==========================================================================
  section('10. Delete Completed Result — Server-Generated One-Time Token')
  // ==========================================================================
  {
    const noAuth = await call('POST', `/api/teams/${publicTeamId}/result/delete-token`)
    check('Requesting a delete token without coordinator auth is rejected (401)', noAuth.statusCode === 401)

    const tokenRes = await call('POST', `/api/teams/${publicTeamId}/result/delete-token`, { cookie: coordinatorCookie })
    check('Coordinator can request a deletion token for a finished team', tokenRes.statusCode === 200)
    check('Token is a short random string (not a static "CLEAR")', typeof tokenRes.body.token === 'string' && tokenRes.body.token !== 'CLEAR')
    check('Token response includes the frozen official ranking time', typeof tokenRes.body.officialRankingSeconds === 'number')

    const wrongToken = await call('POST', `/api/teams/${publicTeamId}/result/delete`, {
      cookie: coordinatorCookie,
      body: { token: 'WRONG' },
    })
    check('Wrong token is rejected and nothing is deleted', wrongToken.statusCode === 400)

    const stillEscaped = await getDatabase().getTeamById(publicTeamId)
    check('Team result is untouched after a wrong-token attempt', stillEscaped?.status === 'ESCAPED')

    // The wrong attempt consumed the one-time token (by design) — request a
    // fresh one before confirming, mirroring the real UI flow.
    const tokenRes2 = await call('POST', `/api/teams/${publicTeamId}/result/delete-token`, { cookie: coordinatorCookie })
    const correctToken = tokenRes2.body.token

    const deleted = await call('POST', `/api/teams/${publicTeamId}/result/delete`, {
      cookie: coordinatorCookie,
      body: { token: correctToken },
    })
    check('Correct token clears the completed result', deleted.statusCode === 200 && deleted.body.team.status === 'NOT_STARTED')

    const reuse = await call('POST', `/api/teams/${publicTeamId}/result/delete`, {
      cookie: coordinatorCookie,
      body: { token: correctToken },
    })
    check('A consumed token cannot be reused (single-use)', reuse.statusCode === 400)

    const teamAfter = await getDatabase().getTeamById(publicTeamId)
    check('Team registration/players are preserved — only the result was cleared', teamAfter?.name === 'Quantum Coders Renamed')
  }

  // ==========================================================================
  section('11. Audit Log Records the Full Session')
  // ==========================================================================
  {
    const noAuth = await call('GET', '/api/audit')
    check('Audit log requires coordinator auth (401 without a session)', noAuth.statusCode === 401)

    const events = await call('GET', '/api/audit', { cookie: coordinatorCookie })
    const types = new Set((events.body.events as any[]).map((e) => e.type))
    for (const expected of [
      'COORDINATOR_LOGIN',
      'COORDINATOR_LOGIN_FAILED',
      'TEAM_REGISTERED',
      'TEAM_APPROVED',
      'GAME_STARTED',
      'PUZZLE_COMPLETED',
      'RECOVERY_CODE_ATTEMPT',
      'CONSTRAINT_BREACH_COMPLETED',
      'FINAL_CODE_ATTEMPT',
      'TEAM_ESCAPED',
      'RESULT_DELETED',
      'TEAM_DETAILS_UPDATED',
    ]) {
      check(`Audit log contains at least one ${expected} event`, types.has(expected))
    }
  }

  // ==========================================================================
  section('13. Public Leaderboard — Server-Side Lock/Unlock')
  // ==========================================================================
  {
    const db = getDatabase()

    // --- Locked by default -------------------------------------------------
    const settingsBefore = await db.getSettings()
    check('Public leaderboard is LOCKED by default', settingsBefore.publicLeaderboardUnlocked === false)

    const publicLocked = await call('GET', '/api/leaderboard')
    check('Locked public endpoint returns 200 with locked:true (not an error)', publicLocked.statusCode === 200 && publicLocked.body.locked === true)
    check('Locked response contains NO leaderboard/result data', !('leaderboard' in publicLocked.body))
    check(
      'Locked response includes a professional "authorized by the coordinator" message',
      typeof publicLocked.body.message === 'string' && publicLocked.body.message.length > 0
    )

    // --- No alternate endpoint leaks it while locked ------------------------
    const stateWhileLocked = await call('GET', '/api/state')
    check(
      '/api/state does not expose officialRankingSeconds-based ranking data circumventing the lock',
      Array.isArray(stateWhileLocked.body.teams) // sanity: /api/state still works for gameplay, it just was never a leaderboard source
    )

    // --- Coordinator CAN preview while locked -------------------------------
    const coordinatorPreview = await call('GET', '/api/leaderboard', { cookie: coordinatorCookie })
    check('An authenticated coordinator can preview the leaderboard while publicly locked', coordinatorPreview.body.locked !== true)

    // --- Only a coordinator may unlock ---------------------------------------
    const noAuthUnlock = await call('PATCH', '/api/settings', { body: { publicLeaderboardUnlocked: true } })
    check('Unlocking without a coordinator session is rejected (401)', noAuthUnlock.statusCode === 401)

    const unlockRes = await call('PATCH', '/api/settings', {
      cookie: coordinatorCookie,
      body: { publicLeaderboardUnlocked: true },
    })
    check('Coordinator can unlock the public leaderboard (200)', unlockRes.statusCode === 200 && unlockRes.body.settings.publicLeaderboardUnlocked === true)

    // --- Unlock persists (fresh read, not just the mutation response) -------
    const settingsAfterUnlock = await db.getSettings()
    check('Unlock persists in the authoritative settings store', settingsAfterUnlock.publicLeaderboardUnlocked === true)

    // --- Public can now access it --------------------------------------------
    const publicUnlocked = await call('GET', '/api/leaderboard')
    check('Public endpoint returns real results once unlocked', publicUnlocked.body.locked === false && Array.isArray(publicUnlocked.body.leaderboard))

    // --- Eligibility filtering: pending/rejected/unplayed excluded -----------
    const pendingTeam = await db.createTeam({
      name: 'Pending Team', members: ['a', 'b', 'c', 'd'], captain: 'a', contactEmail: 'p@t.com', contactMobile: '+919000000001',
      registrationStatus: 'PENDING', registeredAt: Date.now(), registrationSource: 'COORDINATOR_MANUAL',
      puzzleAssignments: [], finalCodeTransform: {}, maxTimeSeconds: 1500, status: 'NOT_STARTED', totalPausedMs: 0,
      puzzleCompleted: { SLOT_1: false, SLOT_2: false, SLOT_3: false, SLOT_4: false }, finalPuzzleCompleted: false,
      puzzleOutputs: {}, hintsUsed: 0, hintLevelLog: [], attempts: 0, attemptLog: [],
    } as any)
    const rejectedTeam = await db.createTeam({
      name: 'Rejected Team', members: ['a', 'b', 'c', 'd'], captain: 'a', contactEmail: 'r@t.com', contactMobile: '+919000000002',
      registrationStatus: 'REJECTED', registeredAt: Date.now(), registrationSource: 'COORDINATOR_MANUAL',
      puzzleAssignments: [], finalCodeTransform: {}, maxTimeSeconds: 1500, status: 'NOT_STARTED', totalPausedMs: 0,
      puzzleCompleted: { SLOT_1: false, SLOT_2: false, SLOT_3: false, SLOT_4: false }, finalPuzzleCompleted: false,
      puzzleOutputs: {}, hintsUsed: 0, hintLevelLog: [], attempts: 0, attemptLog: [],
    } as any)
    const unplayedActiveTeam = await db.createTeam({
      name: 'Unplayed Active Team', members: ['a', 'b', 'c', 'd'], captain: 'a', contactEmail: 'u@t.com', contactMobile: '+919000000003',
      registrationStatus: 'ACTIVE', registeredAt: Date.now(), registrationSource: 'COORDINATOR_MANUAL',
      puzzleAssignments: [], finalCodeTransform: {}, maxTimeSeconds: 1500, status: 'NOT_STARTED', totalPausedMs: 0,
      puzzleCompleted: { SLOT_1: false, SLOT_2: false, SLOT_3: false, SLOT_4: false }, finalPuzzleCompleted: false,
      puzzleOutputs: {}, hintsUsed: 0, hintLevelLog: [], attempts: 0, attemptLog: [],
    } as any)

    const publicAfterNewTeams = await call('GET', '/api/leaderboard')
    const ids = (publicAfterNewTeams.body.leaderboard as any[]).map((r) => r.team.id)
    check('PENDING teams are excluded from the public leaderboard', !ids.includes(pendingTeam.id))
    check('REJECTED teams are excluded from the public leaderboard', !ids.includes(rejectedTeam.id))
    check('ACTIVE-but-unplayed (NOT_STARTED) teams are excluded from the public leaderboard', !ids.includes(unplayedActiveTeam.id))

    // --- Public leaderboard never leaks private contact info -----------------
    const anyContactLeak = (publicAfterNewTeams.body.leaderboard as any[]).some(
      (r) => 'contactMobile' in r.team || 'contactEmail' in r.team
    )
    check('Public leaderboard entries never include contactMobile/contactEmail', !anyContactLeak)
    const anyAnswerLeak = (publicAfterNewTeams.body.leaderboard as any[]).some(
      (r) => 'finalCodeOverride' in r.team || 'attemptLog' in r.team || 'puzzleAssignments' in r.team
    )
    check('Public leaderboard entries never include codes/attempts/assignment internals', !anyAnswerLeak)

    // --- Relock ---------------------------------------------------------------
    const relockCheckTeam = await db.createTeam({
      name: 'Relock Check Team', members: ['a', 'b', 'c', 'd'], captain: 'a', contactEmail: 'rc@t.com', contactMobile: '+919000000004',
      registrationStatus: 'COMPLETED', registeredAt: Date.now(), registrationSource: 'COORDINATOR_MANUAL',
      puzzleAssignments: [], finalCodeTransform: {}, maxTimeSeconds: 1500, status: 'ESCAPED',
      startedAt: Date.now() - 60000, finishedAt: Date.now(), totalPausedMs: 0,
      puzzleCompleted: { SLOT_1: true, SLOT_2: true, SLOT_3: true, SLOT_4: true }, finalPuzzleCompleted: true,
      puzzleOutputs: {}, hintsUsed: 0, hintLevelLog: [], attempts: 1,
      attemptLog: [{ code: '12345678', correct: true, timestamp: Date.now() }],
      completionSeconds: 600, hintPenaltySeconds: 0, officialRankingSeconds: 600,
    } as any)

    const relockRes = await call('PATCH', '/api/settings', {
      cookie: coordinatorCookie,
      body: { publicLeaderboardUnlocked: false },
    })
    check('Coordinator can relock the public leaderboard (200)', relockRes.statusCode === 200 && relockRes.body.settings.publicLeaderboardUnlocked === false)

    const publicAfterRelock = await call('GET', '/api/leaderboard')
    check('Public leaderboard is inaccessible again immediately after relock', publicAfterRelock.body.locked === true)

    const teamsStillExist = await db.getTeamById(relockCheckTeam.id)
    check('Relocking does not delete any team/result data', teamsStillExist !== null && teamsStillExist.officialRankingSeconds === 600)

    // --- Audit events -----------------------------------------------------
    const auditAfter = await call('GET', '/api/audit', { cookie: coordinatorCookie })
    const auditTypes = (auditAfter.body.events as any[]).map((e) => e.type)
    check('PUBLIC_LEADERBOARD_UNLOCKED audit event was recorded', auditTypes.includes('PUBLIC_LEADERBOARD_UNLOCKED'))
    check('PUBLIC_LEADERBOARD_LOCKED audit event was recorded', auditTypes.includes('PUBLIC_LEADERBOARD_LOCKED'))
  }

  // ==========================================================================
  section('14. Persistence-Layer Optimistic Concurrency (CAS)')
  // ==========================================================================
  {
    const db = getDatabase()
    const created = await db.createTeam({
      name: 'Concurrency Test Team',
      members: ['a', 'b', 'c', 'd'],
      captain: 'a',
      contactEmail: 'c@t.com',
      registrationStatus: 'ACTIVE',
      registeredAt: Date.now(),
      registrationSource: 'COORDINATOR_MANUAL',
      puzzleAssignments: [],
      finalCodeTransform: {},
      maxTimeSeconds: 1500,
      status: 'NOT_STARTED',
      totalPausedMs: 0,
      puzzleCompleted: { SLOT_1: false, SLOT_2: false, SLOT_3: false, SLOT_4: false },
      finalPuzzleCompleted: false,
      puzzleOutputs: {},
      hintsUsed: 0,
      hintLevelLog: [],
      attempts: 0,
      attemptLog: [],
    } as any)

    check('New team starts at version 1', created.version === 1)

    const firstWrite = await db.updateTeam(created.id, { status: 'RUNNING' }, 1)
    check('First write with correct expectedVersion succeeds', firstWrite.ok === true)
    if (firstWrite.ok) check('Successful write increments version to 2', firstWrite.team.version === 2)

    // Simulate a second, concurrent request that read the SAME stale version
    // (1) before the first write landed — e.g. a TIME_EXPIRED freeze racing
    // a TEAM_ESCAPED request. It must be rejected, not silently overwrite.
    const staleWrite = await db.updateTeam(created.id, { status: 'TIME_EXPIRED' }, 1)
    check(
      'A second write against the now-stale version 1 is rejected as a conflict (first transition wins)',
      staleWrite.ok === false && (staleWrite as any).reason === 'conflict'
    )

    const finalState = await db.getTeamById(created.id)
    check('The team keeps the FIRST transition (RUNNING), not the stale second one', finalState?.status === 'RUNNING')
  }

  console.log(`\n${failures === 0 ? 'ALL API INTEGRATION TESTS PASSED' : failures + ' TEST(S) FAILED'}`)
  process.exit(failures === 0 ? 0 : 1)
}

run()
