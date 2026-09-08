import type {
  Team,
  ParticipantTeamView,
  PuzzleVersion,
  ParticipantPuzzleView,
  ConstraintBreachVariant,
  ParticipantConstraintView,
} from '../types.js'

// ============================================================================
// PROJECT NEUROVAULT — Participant-Safe Serialization
// ----------------------------------------------------------------------------
// These builders WHITELIST fields rather than blacklist them. Any new secret
// field added to a server-side type in the future is safe-by-default: it
// will simply not appear here until someone deliberately adds it, instead of
// silently leaking the way `answer`/`outputDigit` did in the previous
// implementation (which spread the whole object and only ever deleted one
// field).
// ============================================================================

export function toParticipantTeamView(team: Team): ParticipantTeamView {
  return {
    id: team.id,
    name: team.name,
    members: team.members,
    captain: team.captain,
    // NOTE: contactEmail/contactMobile are intentionally OMITTED here.
    // They are coordinator-only private contact details and are never
    // whitelisted into any participant/public-facing view.
    registrationStatus: team.registrationStatus,
    registeredAt: team.registeredAt,
    registrationSource: team.registrationSource,
    puzzleAssignments: team.puzzleAssignments,
    finalModuleEnabled: team.finalModuleEnabled,
    constraintBreachHintRevealed: team.constraintBreachHintRevealed,
    maxTimeSeconds: team.maxTimeSeconds,
    status: team.status,
    startedAt: team.startedAt,
    pausedAt: team.pausedAt,
    totalPausedMs: team.totalPausedMs,
    finishedAt: team.finishedAt,
    puzzleCompleted: team.puzzleCompleted,
    finalPuzzleCompleted: team.finalPuzzleCompleted,
    // Output fragments are per-slot flavor text the team's own station
    // already showed them — not the answer key — so it's safe to echo back.
    puzzleOutputs: team.puzzleOutputs,
    hintsUsed: team.hintsUsed,
    hintLevelLog: team.hintLevelLog,
    attempts: team.attempts,
    // A team may see its OWN submitted guesses (they typed them), never the
    // expected code, and never another team's log.
    attemptLog: team.attemptLog,
    maxAttempts: team.maxAttempts,
    recoveryCodeUnlocked: team.recoveryCodeUnlocked,
    recoveryAttempts: team.recoveryAttempts,
    recoveryAttemptLog: team.recoveryAttemptLog,
    completionSeconds: team.completionSeconds,
    hintPenaltySeconds: team.hintPenaltySeconds,
    officialRankingSeconds: team.officialRankingSeconds,
    version: team.version,
    updatedAt: team.updatedAt,
  }
}

export function toParticipantPuzzleView(pv: PuzzleVersion): ParticipantPuzzleView {
  return {
    id: pv.id,
    slot: pv.slot,
    version: pv.version,
    title: pv.title,
    category: pv.category,
    difficulty: pv.difficulty,
    status: pv.status,
    completionMode: pv.completionMode,
    clue: pv.clue,
    data: pv.data,
  }
}

export function toParticipantConstraintView(
  variant: ConstraintBreachVariant,
  hintRevealed: boolean
): ParticipantConstraintView {
  const forbiddenCells = hintRevealed
    ? [...variant.initialForbiddenCells, variant.hiddenHintForbiddenCell]
    : variant.initialForbiddenCells
  return {
    id: variant.id,
    difficulty: variant.difficulty,
    fixedAgents: variant.fixedAgents,
    forbiddenCells,
  }
}

/** For leaderboard/public listing: only what's needed for a public ranking row. */
export function toPublicLeaderboardTeamView(team: Team) {
  return {
    id: team.id,
    name: team.name,
    status: team.status,
    completionSeconds: team.completionSeconds,
    hintsUsed: team.hintsUsed,
    hintPenaltySeconds: team.hintPenaltySeconds,
    officialRankingSeconds: team.officialRankingSeconds,
  }
}
