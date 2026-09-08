import type { Team, HintLevel, InitialPuzzleSlotKey } from '../types'
import type { PuzzleVersion } from '../types'
import { elapsedMs } from '../lib/timer'
import { hintPenaltyForCount, MAX_HINTS } from '../lib/hints'
import { validateFinalCode, validateRecoveryCode } from '../lib/finalCode'

// ============================================================================
// PROJECT NEUROVAULT — Pure Game Engine
// ----------------------------------------------------------------------------
// Single source of truth for all game rules, timing, puzzle progression,
// hints, and result freezing. Every function is pure:
// (team, ...args, now) -> patch | null
// ============================================================================

const EMPTY_PUZZLE_COMPLETED: Record<InitialPuzzleSlotKey, boolean> = {
  SLOT_1: false,
  SLOT_2: false,
  SLOT_3: false,
  SLOT_4: false,
}

export function isFinished(team: Team): boolean {
  return team.status === 'ESCAPED' || team.status === 'TIME_EXPIRED'
}

/** Check if all 4 initial parallel puzzles are completed */
export function areInitialPuzzlesCompleted(team: Team): boolean {
  return (
    team.puzzleCompleted.SLOT_1 &&
    team.puzzleCompleted.SLOT_2 &&
    team.puzzleCompleted.SLOT_3 &&
    team.puzzleCompleted.SLOT_4
  )
}

/** Freezes completion/penalty/official-ranking exactly once from elapsed duration */
export function freeze(completionSeconds: number, hintsUsed: number) {
  const hintPenaltySeconds = hintPenaltyForCount(hintsUsed)
  return {
    completionSeconds,
    hintPenaltySeconds,
    officialRankingSeconds: completionSeconds + hintPenaltySeconds,
  }
}

/** START GAME — only valid from NOT_STARTED. Clears any stale state. */
export function startGame(team: Team, now: number): Partial<Team> | null {
  if (team.status !== 'NOT_STARTED') return null
  return {
    status: 'RUNNING',
    startedAt: now,
    pausedAt: undefined,
    totalPausedMs: 0,
    finishedAt: undefined,
    completionSeconds: undefined,
    hintPenaltySeconds: undefined,
    officialRankingSeconds: undefined,
  }
}

/** PAUSE — only valid while RUNNING. */
export function pauseGame(team: Team, now: number): Partial<Team> | null {
  if (team.status !== 'RUNNING') return null
  return { status: 'PAUSED', pausedAt: now }
}

/** RESUME — only valid while PAUSED. Accumulates paused duration into totalPausedMs. */
export function resumeGame(team: Team, now: number): Partial<Team> | null {
  if (team.status !== 'PAUSED' || !team.pausedAt) return null
  const pausedDuration = now - team.pausedAt
  return {
    status: 'RUNNING',
    pausedAt: undefined,
    totalPausedMs: team.totalPausedMs + pausedDuration,
  }
}

/**
 * MARK INITIAL PUZZLE COMPLETED — Parallel progression for slots 1-4.
 * A player solving their puzzle records completion & fragment without blocking teammates.
 */
export function markInitialPuzzleCompleted(
  team: Team,
  slot: InitialPuzzleSlotKey,
  completed: boolean,
  outputFragment?: string
): Partial<Team> | null {
  if (isFinished(team)) return null

  const puzzleCompleted = {
    ...team.puzzleCompleted,
    [slot]: completed,
  }

  const puzzleOutputs = {
    ...team.puzzleOutputs,
  }
  if (outputFragment !== undefined) {
    if (completed) {
      puzzleOutputs[slot] = outputFragment
    } else {
      delete puzzleOutputs[slot]
    }
  }

  return {
    puzzleCompleted,
    puzzleOutputs,
  }
}

/**
 * MARK FINAL PUZZLE COMPLETED — Collaborative Gated Final Puzzle.
 * Can only be marked completed once ALL 4 initial parallel puzzles are completed.
 */
export function markFinalPuzzleCompleted(
  team: Team,
  completed: boolean,
  outputFragment?: string
): Partial<Team> | null {
  if (isFinished(team)) return null
  // Gating rule: the coordinator must have enabled the final module, the 4
  // initial puzzles must be complete, AND the correct recovery code must
  // already have been entered before the final (Constraint Breach) module
  // can be marked solved. `finalModuleEnabled` alone never completes or
  // escapes anything — it only opens the gate for a real server-validated
  // submission to be evaluated at all.
  if (completed && (!team.finalModuleEnabled || !areInitialPuzzlesCompleted(team) || !team.recoveryCodeUnlocked)) {
    return null
  }

  const puzzleOutputs = {
    ...team.puzzleOutputs,
  }
  if (outputFragment !== undefined) {
    if (completed) {
      puzzleOutputs.FINAL_SLOT = outputFragment
    } else {
      delete puzzleOutputs.FINAL_SLOT
    }
  }

  return {
    finalPuzzleCompleted: completed,
    puzzleOutputs,
  }
}

/**
 * GIVE HINT — coordinator-only, sequential (1 then 2 then 3), max 3, only
 * while the team is actively playing (RUNNING or PAUSED). Never touches the
 * live clock — only records the hint; penalty is applied at freeze time.
 */
export function giveHint(team: Team, now: number, requestedLevel: HintLevel): Partial<Team> | null {
  if (team.status !== 'RUNNING' && team.status !== 'PAUSED') return null
  if (team.hintsUsed >= MAX_HINTS) return null
  const nextLevel = team.hintsUsed + 1
  if (requestedLevel !== nextLevel) return null // enforce strict order

  return {
    hintsUsed: nextLevel,
    hintLevelLog: [...team.hintLevelLog, { level: nextLevel as HintLevel, timestamp: now }],
  }
}

/**
 * VERIFY RECOVERY CODE — NEUROVAULT // RECOVERY CODE. Checks the 4-digit
 * Module 01->02->03->04 code (fixed order). On success this ONLY unlocks
 * the final module (`recoveryCodeUnlocked`) — it never escapes the team and
 * never touches the live clock. Recovery-code attempts are tracked
 * separately from final-code `attempts`/`attemptLog` because they are not
 * part of the official ranking.
 */
export function verifyRecoveryCode(
  team: Team,
  code: string,
  puzzleVersions: PuzzleVersion[],
  now: number
): { patch: Partial<Team>; correct: boolean } {
  if (isFinished(team)) return { patch: {}, correct: false }
  if (!areInitialPuzzlesCompleted(team)) return { patch: {}, correct: false }
  if (team.recoveryCodeUnlocked) return { patch: {}, correct: true } // already unlocked

  const correct = validateRecoveryCode(code, team, puzzleVersions)
  const patch: Partial<Team> = {
    recoveryAttempts: (team.recoveryAttempts ?? 0) + 1,
    recoveryAttemptLog: [
      ...(team.recoveryAttemptLog ?? []),
      { code, correct, timestamp: now },
    ],
  }
  if (correct) patch.recoveryCodeUnlocked = true
  return { patch, correct }
}

/**
 * SUBMIT FINAL CODE — validates against the team's expected/overridden code.
 * Final code entry is only accessible after initial puzzles and final puzzle are completed.
 */
export function submitCode(
  team: Team,
  code: string,
  puzzleVersions: PuzzleVersion[],
  now: number
): { patch: Partial<Team>; correct: boolean; attemptsRemaining: number | null } {
  if (isFinished(team)) {
    return { patch: {}, correct: team.status === 'ESCAPED', attemptsRemaining: null }
  }

  // Final code requires all 4 initial + final puzzle to be complete
  if (!areInitialPuzzlesCompleted(team) || !team.finalPuzzleCompleted) {
    return {
      patch: {},
      correct: false,
      attemptsRemaining: team.maxAttempts !== undefined ? Math.max(0, team.maxAttempts - team.attempts) : null,
    }
  }

  const correct = validateFinalCode(code, team, puzzleVersions)
  const attempts = team.attempts + 1
  const attemptsRemaining =
    team.maxAttempts !== undefined ? Math.max(0, team.maxAttempts - attempts) : null

  const base: Partial<Team> = {
    attempts,
    attemptLog: [...team.attemptLog, { code, correct, timestamp: now }],
  }

  if (!correct) return { patch: base, correct, attemptsRemaining }

  const completionSeconds = Math.round(elapsedMs(team, now) / 1000)
  return {
    patch: {
      ...base,
      status: 'ESCAPED',
      finishedAt: now,
      ...freeze(completionSeconds, team.hintsUsed),
    },
    correct: true,
    attemptsRemaining,
  }
}

/**
 * MARK ESCAPED — manual coordinator fallback. Only valid from RUNNING or PAUSED.
 */
export function markEscaped(team: Team, now: number): Partial<Team> | null {
  if (team.status !== 'RUNNING' && team.status !== 'PAUSED') return null
  const completionSeconds = Math.round(elapsedMs(team, now) / 1000)
  return {
    status: 'ESCAPED',
    finishedAt: now,
    finalPuzzleCompleted: true,
    ...freeze(completionSeconds, team.hintsUsed),
  }
}

/**
 * CHECK EXPIRY — called once a second for RUNNING teams.
 * Freezes at exactly maxTimeSeconds (never negative, never restarts).
 */
export function checkExpiry(team: Team, now: number): Partial<Team> | null {
  if (team.status !== 'RUNNING') return null
  if (!team.startedAt) return null
  if (elapsedMs(team, now) < team.maxTimeSeconds * 1000) return null

  return {
    status: 'TIME_EXPIRED',
    finishedAt: now,
    ...freeze(team.maxTimeSeconds, team.hintsUsed),
  }
}

const CLEAN_SLATE = {
  status: 'NOT_STARTED' as const,
  startedAt: undefined,
  pausedAt: undefined,
  totalPausedMs: 0,
  finishedAt: undefined,
  puzzleCompleted: { ...EMPTY_PUZZLE_COMPLETED },
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
}

/**
 * RESET ACTIVE RUN — clears in-progress team back to clean slate.
 * Refuses to touch finished teams.
 */
export function resetActiveRun(team: Team): Partial<Team> | null {
  if (isFinished(team)) return null
  return { ...CLEAN_SLATE }
}

/**
 * CLEAR COMPLETED RESULT — explicitly clears a finished team's score.
 */
export function clearCompletedResult(team: Team): Partial<Team> | null {
  if (!isFinished(team)) return null
  return { ...CLEAN_SLATE }
}

// ============================================================================
// REGISTRATION LIFECYCLE — independent of the gameplay TeamStatus machine.
// A team can be APPROVED/ACTIVE while its game status is still NOT_STARTED.
// ============================================================================

/** APPROVE — only valid from PENDING. */
export function approveTeam(team: Team): Partial<Team> | null {
  if (team.registrationStatus !== 'PENDING') return null
  return { registrationStatus: 'APPROVED' }
}

/** REJECT — only valid from PENDING or APPROVED (before the run starts). */
export function rejectTeam(team: Team): Partial<Team> | null {
  if (team.registrationStatus !== 'PENDING' && team.registrationStatus !== 'APPROVED') return null
  if (team.status !== 'NOT_STARTED') return null
  return { registrationStatus: 'REJECTED' }
}

/** ACTIVATE — only valid from APPROVED. Marks the team ready to play. */
export function activateTeam(team: Team): Partial<Team> | null {
  if (team.registrationStatus !== 'APPROVED') return null
  return { registrationStatus: 'ACTIVE' }
}

/** Mark a team COMPLETED once its run has finished (called after ESCAPED/TIME_EXPIRED). */
export function completeRegistration(team: Team): Partial<Team> | null {
  if (!isFinished(team)) return null
  if (team.registrationStatus === 'COMPLETED') return null
  return { registrationStatus: 'COMPLETED' }
}
