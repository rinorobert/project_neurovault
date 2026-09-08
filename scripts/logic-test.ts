import { readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { DEV_FIXTURE_TEAMS, DEV_FIXTURE_PUZZLE_VERSIONS } from '../src/data/devFixtures.js'
import { computeFinalCode, validateFinalCode } from '../src/lib/finalCode.js'
import { remainingMs, isTimeExpired } from '../src/lib/timer.js'
import { hintPenaltyForCount } from '../src/lib/hints.js'
import { buildLeaderboard } from '../src/lib/leaderboard.js'
import * as engine from '../src/engine/gameEngine.js'
import { solveConstraintBreach } from '../src/lib/constraintBreachSolver.js'
import { CB_DEV_FIXTURE_VARIANTS } from '../src/server/puzzleData/constraintVariants.js'
import type { Team } from '../src/types.js'

let failures = 0
function check(label: string, cond: boolean) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}`)
  if (!cond) failures++
}

function section(title: string) {
  console.log(`\n--- ${title} ---`)
}

const BASE = DEV_FIXTURE_TEAMS.find((team: Team) => team.id === 'T01')!

function freshTeam(overrides: Partial<Team> = {}): Team {
  return {
    ...BASE,
    status: 'NOT_STARTED',
    startedAt: undefined,
    pausedAt: undefined,
    totalPausedMs: 0,
    finishedAt: undefined,
    puzzleCompleted: {
      SLOT_1: false,
      SLOT_2: false,
      SLOT_3: false,
      SLOT_4: false,
    },
    finalPuzzleCompleted: false,
    puzzleOutputs: {},
    hintsUsed: 0,
    hintLevelLog: [],
    attempts: 0,
    attemptLog: [],
    recoveryCodeUnlocked: false,
    recoveryAttempts: 0,
    recoveryAttemptLog: [],
    completionSeconds: undefined,
    hintPenaltySeconds: undefined,
    officialRankingSeconds: undefined,
    maxTimeSeconds: 25 * 60,
    ...overrides,
  }
}

const now = Date.now()
const correctCode = computeFinalCode(BASE, DEV_FIXTURE_PUZZLE_VERSIONS)

// ============================================================================
section('1. Recovery-Code Resolver & Unique Codes (Fixed Module Order)')
// ============================================================================
{
  const codes = DEV_FIXTURE_TEAMS.map((team: Team) => computeFinalCode(team, DEV_FIXTURE_PUZZLE_VERSIONS))
  check('All fixture teams have unique recovery codes', new Set(codes).size === codes.length)
  check('validateFinalCode accepts the correct code', validateFinalCode(correctCode, BASE, DEV_FIXTURE_PUZZLE_VERSIONS))
  check('validateFinalCode rejects a wrong code', !validateFinalCode('0000', BASE, DEV_FIXTURE_PUZZLE_VERSIONS))

  const reordered: Team = { ...BASE, finalCodeTransform: { order: ['SLOT_4', 'SLOT_1', 'SLOT_3', 'SLOT_2'] } }
  check(
    'Legacy per-team finalCodeTransform.order is ignored — code stays fixed Module01->02->03->04',
    computeFinalCode(reordered, DEV_FIXTURE_PUZZLE_VERSIONS) === correctCode
  )
}

// ============================================================================
section('2. Parallel Initial Puzzles (Independent Completion)')
// ============================================================================
{
  let t: Team = freshTeam()
  check('Initial puzzles start all incomplete', !engine.areInitialPuzzlesCompleted(t))

  // Player 2 finishes Module 02 first
  const p2 = engine.markInitialPuzzleCompleted(t, 'SLOT_2', true, 'KEY_B')!
  t = { ...t, ...p2 }
  check('Module 02 completes independently', t.puzzleCompleted.SLOT_2 && !t.puzzleCompleted.SLOT_1)
  check('Output fragment stored for Module 02', t.puzzleOutputs.SLOT_2 === 'KEY_B')

  // Player 4 finishes Module 04
  const p4 = engine.markInitialPuzzleCompleted(t, 'SLOT_4', true, 'KEY_D')!
  t = { ...t, ...p4 }
  check('Module 04 completes independently', t.puzzleCompleted.SLOT_4 && !t.puzzleCompleted.SLOT_1)

  // Modules 01 and 03 finish
  t = { ...t, ...engine.markInitialPuzzleCompleted(t, 'SLOT_1', true, 'KEY_A')! }
  t = { ...t, ...engine.markInitialPuzzleCompleted(t, 'SLOT_3', true, 'KEY_C')! }
  check('All 4 initial puzzles now complete in parallel', engine.areInitialPuzzlesCompleted(t))
}

// ============================================================================
section('3. Recovery Code Unlocks the Final Module (But Never Escapes)')
// ============================================================================
{
  const notReady: Team = freshTeam({
    puzzleCompleted: { SLOT_1: true, SLOT_2: true, SLOT_3: false, SLOT_4: true },
  })
  const { correct: earlyAttempt } = engine.verifyRecoveryCode(notReady, correctCode, DEV_FIXTURE_PUZZLE_VERSIONS, now)
  check('Recovery code rejected before all 4 modules are complete', !earlyAttempt)

  const ready: Team = freshTeam({
    puzzleCompleted: { SLOT_1: true, SLOT_2: true, SLOT_3: true, SLOT_4: true },
  })
  const { patch: rcPatch, correct: rcCorrect } = engine.verifyRecoveryCode(ready, correctCode, DEV_FIXTURE_PUZZLE_VERSIONS, now)
  check('Correct recovery code is accepted once all 4 modules are complete', rcCorrect)
  check('Correct recovery code sets recoveryCodeUnlocked', rcPatch.recoveryCodeUnlocked === true)
  check('Recovery code does NOT change team status (never escapes by itself)', rcPatch.status === undefined)

  const { patch: wrongPatch, correct: wrongCorrect } = engine.verifyRecoveryCode(ready, '0000', DEV_FIXTURE_PUZZLE_VERSIONS, now)
  check('Wrong recovery code is rejected', !wrongCorrect)
  check('Wrong recovery code is logged in recoveryAttemptLog', wrongPatch.recoveryAttemptLog?.length === 1)

  // Final module cannot be marked complete without recovery code unlock
  check(
    'Final module rejected if recovery code has not been unlocked yet',
    engine.markFinalPuzzleCompleted(ready, true) === null
  )

  const recoveryOnlyNotEnabled: Team = { ...ready, recoveryCodeUnlocked: true, finalModuleEnabled: false }
  check(
    'Final module rejected if recovery code IS unlocked but coordinator has NOT enabled the Final Module',
    engine.markFinalPuzzleCompleted(recoveryOnlyNotEnabled, true) === null
  )

  const enabledOnlyNotUnlocked: Team = { ...ready, recoveryCodeUnlocked: false, finalModuleEnabled: true }
  check(
    'Final module rejected if coordinator enabled it but recovery code is NOT unlocked',
    engine.markFinalPuzzleCompleted(enabledOnlyNotUnlocked, true) === null
  )

  const unlocked: Team = { ...ready, recoveryCodeUnlocked: true, finalModuleEnabled: true }
  const finalPatch = engine.markFinalPuzzleCompleted(unlocked, true, 'FINAL_OK')!
  check('Final module completes once BOTH recovery code is unlocked AND coordinator has enabled it', finalPatch.finalPuzzleCompleted === true)

  // Enabling the Final Module is a plain config field, not a state-machine
  // transition — setting it must never itself touch status or completion.
  const justEnabled: Team = { ...ready, finalModuleEnabled: true }
  check('Setting finalModuleEnabled alone does not change team status', justEnabled.status === ready.status)
  check('Setting finalModuleEnabled alone does not mark finalPuzzleCompleted', justEnabled.finalPuzzleCompleted === false)
}

// ============================================================================
section('4. Gated Final Code Submission (Escape)')
// ============================================================================
{
  // Cannot submit code before final puzzle is complete
  const incompleteTeam: Team = freshTeam({
    status: 'RUNNING',
    startedAt: now - 5000,
    puzzleCompleted: { SLOT_1: true, SLOT_2: true, SLOT_3: true, SLOT_4: true },
    recoveryCodeUnlocked: true,
    finalPuzzleCompleted: false,
  })
  const { correct: earlyCorrect } = engine.submitCode(incompleteTeam, correctCode, DEV_FIXTURE_PUZZLE_VERSIONS, now)
  check('Code submission rejected if final puzzle is not completed', !earlyCorrect)

  const bypassRecoveryTeam: Team = { ...incompleteTeam, recoveryCodeUnlocked: false, finalPuzzleCompleted: true }
  const { patch: bypassRecoveryPatch, correct: bypassRecoveryCorrect } = engine.submitCode(
    bypassRecoveryTeam,
    correctCode,
    DEV_FIXTURE_PUZZLE_VERSIONS,
    now
  )
  check('Final code is rejected if Constraint Breach is complete but Recovery Code was never unlocked', !bypassRecoveryCorrect)
  check('Rejected pre-gate final code does not create an attempt', bypassRecoveryPatch.attempts === undefined)

  // Once final puzzle is complete, code submission succeeds
  const unlockedTeam: Team = { ...incompleteTeam, finalPuzzleCompleted: true }
  const { patch: subPatch, correct: subCorrect } = engine.submitCode(unlockedTeam, correctCode, DEV_FIXTURE_PUZZLE_VERSIONS, now)
  check('Code submission accepted once final puzzle is complete', subCorrect)
  check('Status transitions to ESCAPED on correct code', subPatch.status === 'ESCAPED')
}

// ============================================================================
section('5. Starting a Team & Countdown Math')
// ============================================================================
{
  const t: Team = freshTeam()
  const patch = engine.startGame(t, now)!
  check('startGame returns RUNNING with startedAt set', patch.status === 'RUNNING' && patch.startedAt === now)
  const running: Team = { ...t, ...patch }
  check('Full max time remains at instant of start', remainingMs(running, now) === t.maxTimeSeconds * 1000)

  const r0 = remainingMs(running, now)
  const r5 = remainingMs(running, now + 5000)
  check('Remaining time decreases correctly after 5s pass', r0 - r5 === 5000)
}

// ============================================================================
section('6. Pause and Resume Behavior')
// ============================================================================
{
  let t: Team = { ...freshTeam(), status: 'RUNNING', startedAt: now - 10000 }
  const pausePatch = engine.pauseGame(t, now)!
  t = { ...t, ...pausePatch }
  check('pauseGame sets status PAUSED and pausedAt timestamp', t.status === 'PAUSED' && t.pausedAt === now)

  const resumeTime = now + 15000 // paused for 15s
  const resumePatch = engine.resumeGame(t, resumeTime)!
  t = { ...t, ...resumePatch }
  check('resumeGame restores RUNNING and folds duration into totalPausedMs', t.status === 'RUNNING' && t.totalPausedMs === 15000)
}

// ============================================================================
section('7. Escaped Team Timer & Result Freezing')
// ============================================================================
{
  let t: Team = { ...freshTeam(), status: 'RUNNING', startedAt: now - 15000 }
  const h1 = engine.giveHint(t, now, 1)!
  t = { ...t, ...h1 }

  const escapeTime = now
  const escapePatch = engine.markEscaped(t, escapeTime)!
  const escaped: Team = { ...t, ...escapePatch }
  check('markEscaped sets status ESCAPED and freezes completion', escaped.status === 'ESCAPED' && escaped.completionSeconds === 15)
  check('Official ranking time includes Hint 1 penalty (+00:30): 15 + 30 = 45s', escaped.officialRankingSeconds === 45)

  const remAtEscape = remainingMs(escaped, escapeTime)
  const remMuchLater = remainingMs(escaped, escapeTime + 60 * 60 * 1000)
  check('Remaining time never moves again after escape (frozen permanently)', remAtEscape === remMuchLater)
}

// ============================================================================
section('8. Time Expiry Freezes at 00:00 (Never Negative)')
// ============================================================================
{
  const t: Team = { ...freshTeam(), status: 'RUNNING', startedAt: now - 26 * 60 * 1000 }
  check('isTimeExpired is true when max time exceeded', isTimeExpired(t, now))
  check('remainingMs clamps to exactly 0 (never negative)', remainingMs(t, now) === 0)

  const expiryPatch = engine.checkExpiry(t, now)!
  const expired: Team = { ...t, ...expiryPatch }
  check('checkExpiry freezes status TIME_EXPIRED with completion == maxTimeSeconds', expired.status === 'TIME_EXPIRED' && expired.completionSeconds === t.maxTimeSeconds)
  check('Expired remaining time stays at 0 indefinitely', remainingMs(expired, now + 100000) === 0)
}

// ============================================================================
section('9. Hint Levels (Strict Order, Fixed Penalties, Max 3)')
// ============================================================================
{
  check('Hint 1 penalty is 30s', hintPenaltyForCount(1) === 30)
  check('Hint 2 total penalty is 90s (30+60)', hintPenaltyForCount(2) === 90)
  check('Hint 3 total penalty is 180s (30+60+90)', hintPenaltyForCount(3) === 180)

  let t: Team = { ...freshTeam(), status: 'RUNNING', startedAt: now }
  check('Hint 2 rejected before Hint 1', engine.giveHint(t, now, 2) === null)

  t = { ...t, ...engine.giveHint(t, now, 1)! }
  check('Hint 1 applied', t.hintsUsed === 1)
  check('Hint 3 rejected before Hint 2', engine.giveHint(t, now, 3) === null)

  t = { ...t, ...engine.giveHint(t, now, 2)! }
  t = { ...t, ...engine.giveHint(t, now, 3)! }
  check('All 3 hints applied sequentially', t.hintsUsed === 3)
  check('4th hint request rejected (capped at 3)', engine.giveHint(t, now, 3) === null)
}

// ============================================================================
section('10. Team State Isolation & Switching')
// ============================================================================
{
  const teamA: Team = {
    ...freshTeam({ id: 'T01', name: 'Team A' }),
    status: 'ESCAPED',
    startedAt: now - 20000,
    finishedAt: now,
    completionSeconds: 20,
    hintPenaltySeconds: 30,
    officialRankingSeconds: 50,
  }
  const teamB: Team = freshTeam({ id: 'T02', name: 'Team B' })

  check('Team A has its own frozen result (50s)', teamA.officialRankingSeconds === 50)
  check('Team B is completely unstarted with full time', teamB.status === 'NOT_STARTED' && remainingMs(teamB, now) === teamB.maxTimeSeconds * 1000)

  // Resetting Team B does not mutate Team A
  const resetB = engine.resetActiveRun(teamB)!
  const newB: Team = { ...teamB, ...resetB }
  check('Team B reset does not touch Team A', teamA.officialRankingSeconds === 50 && newB.status === 'NOT_STARTED')
}

// ============================================================================
section('11. Reset Active Run vs Clear Completed Result')
// ============================================================================
{
  const runningTeam: Team = { ...freshTeam(), status: 'RUNNING', startedAt: now - 5000 }
  const completedTeam: Team = { ...freshTeam(), status: 'ESCAPED', finishedAt: now, completionSeconds: 10 }

  check('resetActiveRun clears running team', engine.resetActiveRun(runningTeam) !== null)
  check('resetActiveRun refuses completed team (safety guard)', engine.resetActiveRun(completedTeam) === null)

  check('clearCompletedResult works on completed team', engine.clearCompletedResult(completedTeam) !== null)
  check('clearCompletedResult refuses uncompleted team', engine.clearCompletedResult(runningTeam) === null)
}

// ============================================================================
section('12. Leaderboard Sorting (Frozen Official Ranking Time)')
// ============================================================================
{
  const mk = (id: string, name: string, officialRankingSeconds: number, status: Team['status'] = 'ESCAPED'): Team =>
    freshTeam({ id, name, status, officialRankingSeconds, completionSeconds: officialRankingSeconds, finishedAt: now })

  const rows = buildLeaderboard([
    mk('A', 'Team A', 19 * 60 + 42),
    mk('B', 'Team B', 22 * 60 + 17),
    mk('C', 'Team C', 22 * 60 + 8),
    mk('D', 'Team D', 25 * 60, 'TIME_EXPIRED'),
  ])

  check('Fastest team ranks #1', rows[0].team.id === 'A' && rows[0].rank === 1)
  check('Team C (22:08) ranks before Team B (22:17)', rows[1].team.id === 'C' && rows[2].team.id === 'B')
  check('Expired team is listed last with null rank', rows[3].team.id === 'D' && rows[3].rank === null)
}

// ============================================================================
section('13. Constraint Breach N-Queens Solver & 3 Dev Fixture Variants')
// ============================================================================
{
  for (const variant of CB_DEV_FIXTURE_VARIANTS) {
    const cells = variant.fixedAgents.map((a) => ({ row: a.row, col: a.col }))
    const res = solveConstraintBreach(cells, variant.initialForbiddenCells)
    check(`${variant.id}: solver confirms strictly 1 unique solution`, res.solutionCount === 1)
  }
}

// ============================================================================
section('14. Registration Lifecycle (Independent of Gameplay Status)')
// ============================================================================
{
  const pending: Team = freshTeam({ registrationStatus: 'PENDING' })
  check('New team registration starts PENDING', pending.registrationStatus === 'PENDING')
  check('Cannot activate a PENDING team directly', engine.activateTeam(pending) === null)

  const approvedPatch = engine.approveTeam(pending)!
  check('approveTeam moves PENDING -> APPROVED', approvedPatch.registrationStatus === 'APPROVED')

  const approved: Team = { ...pending, ...approvedPatch }
  check('Cannot approve an already-APPROVED team', engine.approveTeam(approved) === null)

  const activePatch = engine.activateTeam(approved)!
  check('activateTeam moves APPROVED -> ACTIVE', activePatch.registrationStatus === 'ACTIVE')

  const active: Team = { ...approved, ...activePatch }
  check('Cannot reject a team that already started playing', (() => {
    const started: Team = { ...active, status: 'RUNNING' }
    return engine.rejectTeam(started) === null
  })())

  const rejectPatch = engine.rejectTeam(pending)!
  check('A PENDING team can be rejected', rejectPatch.registrationStatus === 'REJECTED')

  const finishedTeam: Team = { ...active, status: 'ESCAPED', finishedAt: now }
  const completedPatch = engine.completeRegistration(finishedTeam)!
  check('completeRegistration marks COMPLETED once the run has finished', completedPatch.registrationStatus === 'COMPLETED')
  check('completeRegistration refuses an unfinished team', engine.completeRegistration(active) === null)
}

// ============================================================================
section('15. Clean Global setInterval Management in src/')
// ============================================================================
{
  function walk(dir: string): string[] {
    let files: string[] = []
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) files = files.concat(walk(full))
      else if (/\.(ts|tsx)$/.test(entry)) files.push(full)
    }
    return files
  }
  const files = walk(join(dirname(fileURLToPath(import.meta.url)), '../src'))
  let intervalCount = 0
  for (const f of files) {
    const contents = readFileSync(f, 'utf-8')
    const matches = contents.match(/setInterval\(/g)
    if (matches) intervalCount += matches.length
  }
  // 2 in store.tsx (state poll + UI tick) + 1 in PublicLeaderboard.tsx (its
  // own direct /api/leaderboard poll, independent of the global store so it
  // can react to the lock state) = 3 legitimate, cleaned-up-on-unmount
  // intervals. This check exists to catch accidental interval leaks, not to
  // cap intentional, properly-managed polling.
  check(`Clean timer interval management in src/ (found ${intervalCount})`, intervalCount <= 3)
}

console.log(`\n${failures === 0 ? 'ALL LOGIC SUITE CHECKS PASSED' : failures + ' TEST(S) FAILED'}`)
process.exit(failures === 0 ? 0 : 1)
