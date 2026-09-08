// ============================================================================
// PROJECT NEUROVAULT — Core Data Model
// Tagline: UNLOCK THE INTELLIGENCE WITHIN
// ============================================================================

export type InitialPuzzleSlotKey = 'SLOT_1' | 'SLOT_2' | 'SLOT_3' | 'SLOT_4'
export type PuzzleSlotKey = InitialPuzzleSlotKey | 'FINAL_SLOT'

export const INITIAL_PUZZLE_SLOTS: InitialPuzzleSlotKey[] = [
  'SLOT_1',
  'SLOT_2',
  'SLOT_3',
  'SLOT_4',
]

export const ALL_PUZZLE_SLOTS: PuzzleSlotKey[] = [
  'SLOT_1',
  'SLOT_2',
  'SLOT_3',
  'SLOT_4',
  'FINAL_SLOT',
]

export const PUZZLE_SLOT_LABELS: Record<PuzzleSlotKey, string> = {
  SLOT_1: 'Module 01 (Parallel Station 1)',
  SLOT_2: 'Module 02 (Parallel Station 2)',
  SLOT_3: 'Module 03 (Parallel Station 3)',
  SLOT_4: 'Module 04 (Parallel Station 4)',
  FINAL_SLOT: 'Final Module (Collaborative Gated)',
}

export const PUZZLE_SLOT_SYSTEM_TITLES: Record<PuzzleSlotKey, string> = {
  SLOT_1: 'NEUROVAULT // MODULE 01',
  SLOT_2: 'NEUROVAULT // MODULE 02',
  SLOT_3: 'NEUROVAULT // MODULE 03',
  SLOT_4: 'NEUROVAULT // MODULE 04',
  FINAL_SLOT: 'NEUROVAULT // FINAL MODULE',
}

/**
 * How a puzzle slot's completion is authorized. Because Modules 02-04 (and,
 * per the brief, Memory Archive itself) are still being playtested, most
 * production slots start as COORDINATOR_ONLY: a coordinator marks a physical
 * station solved after visually verifying it. SERVER_VALIDATED is reserved
 * for puzzles with a real server-side answer check (e.g. Constraint Breach's
 * grid submission). DEV_SHORTCUT must never be honored outside development.
 */
export type CompletionMode = 'COORDINATOR_ONLY' | 'SERVER_VALIDATED' | 'DEV_SHORTCUT'

/**
 * Configurable, reusable puzzle definition for any of the 5 slots.
 *
 * IMPORTANT: this is the SERVER-SIDE shape. `answer`, `outputDigit`, and
 * `hint` are answer-key data and must never be serialized to a participant.
 * Use `toParticipantPuzzleView()` (src/server/sanitize.ts) to build the
 * safe subset that is actually sent over the wire to non-coordinator
 * clients. Coordinator-authenticated requests may receive the full object.
 */
export interface PuzzleVersion {
  id: string // e.g. "NV_MOD_01_V01"
  slot: PuzzleSlotKey
  version: string // e.g. "V01"
  title: string
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  status: 'DESIGN_PENDING' | 'CONFIGURED' | 'EXPERIMENTAL'
  completionMode: CompletionMode
  /** The clue / data / prompt text shown to participants. Never secret. */
  clue: string
  /** Optional supplementary data (e.g. data rows, sequences). Never secret. */
  data?: string[]
  /** ANSWER KEY — server-only. Never send to participants. */
  answer?: string
  /** ANSWER KEY — server-only. Single digit (0-9) produced on completion. */
  outputDigit?: number
  outputFragment?: string
  /** ANSWER KEY — server-only reference hint text for the coordinator. */
  hint?: string
  metadata?: Record<string, unknown>
}

/** Safe subset of PuzzleVersion that may be sent to participant clients. */
export interface ParticipantPuzzleView {
  id: string
  slot: PuzzleSlotKey
  version: string
  title: string
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  status: 'DESIGN_PENDING' | 'CONFIGURED' | 'EXPERIMENTAL'
  completionMode: CompletionMode
  clue: string
  data?: string[]
}

export interface CellCoord {
  row: number
  col: number
}

/**
 * Constraint Breach N-Queens Variant.
 *
 * SERVER-ONLY. Lives in src/server/puzzleData/constraintVariants.ts and must
 * never be imported by any file that ships in the client bundle (pages/,
 * components/, state/). `solution` and `hiddenHintForbiddenCell` are answer
 * data. Use `toParticipantConstraintView()` for the safe subset.
 */
export interface ConstraintBreachVariant {
  id: string
  difficulty: 'easy' | 'medium' | 'hard'
  fixedAgents: Array<{ agentId: number; row: number; col: number }> // Exactly 3 fixed agents
  initialForbiddenCells: CellCoord[] // Exactly 3 initial forbidden cells
  hiddenHintForbiddenCell: CellCoord // 1 hidden cell revealed only after Hint 1 is used
  solution: Array<{ agentId: number; row: number; col: number }> // 8 agent placements
  solutionCount: number // Must strictly equal 1
  metadata?: string
}

/** Safe subset of ConstraintBreachVariant sent to participants. */
export interface ParticipantConstraintView {
  id: string
  difficulty: 'easy' | 'medium' | 'hard'
  fixedAgents: Array<{ agentId: number; row: number; col: number }>
  /** Initial 3 forbidden cells, plus the 4th once legitimately hinted. */
  forbiddenCells: CellCoord[]
}

export interface ConstraintBreachSubmission {
  placement: Array<{ agentId: number; row: number; col: number }>
}

export interface TeamPuzzleAssignment {
  slot: PuzzleSlotKey
  puzzleVersionId: string
}

export interface FinalCodeTransform {
  /**
   * @deprecated Recovery code order is now always fixed
   * (SLOT_1 -> SLOT_2 -> SLOT_3 -> SLOT_4) per the event spec, regardless of
   * completion order. This field is retained only for backward-compatible
   * deserialization of old records and is ignored by the resolver.
   */
  order?: PuzzleSlotKey[]
  /** Optional modular offset applied to output digits, 0 = no-op */
  digitOffset?: number
}

export type TeamStatus =
  | 'NOT_STARTED'
  | 'RUNNING'
  | 'PAUSED'
  | 'ESCAPED'
  | 'TIME_EXPIRED'

/**
 * Registration lifecycle — intentionally SEPARATE from `TeamStatus` (which
 * is purely the in-game timer/puzzle state machine). A team can be
 * APPROVED or ACTIVE while its game status is still NOT_STARTED.
 */
export type RegistrationStatus = 'PENDING' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'REJECTED'

export type HintLevel = 1 | 2 | 3

export interface Team {
  id: string // server-generated, e.g. "NV-001"
  name: string
  members: string[] // exactly 4 players for the room
  captain: string // must be one of `members`
  contactEmail: string
  /**
   * Primary contact mobile number for the team, normalized server-side
   * (see src/server/validation.ts) to a canonical `+91XXXXXXXXXX` form.
   * Coordinator-only — never sent to participants/public callers.
   */
  contactMobile: string

  // ---------------------------------------------------------------------
  // REGISTRATION LIFECYCLE — independent of gameplay status
  // ---------------------------------------------------------------------
  registrationStatus: RegistrationStatus
  registeredAt: number // epoch ms
  registrationSource: 'PUBLIC_FORM' | 'COORDINATOR_MANUAL'

  puzzleAssignments: TeamPuzzleAssignment[]
  finalCodeTransform: FinalCodeTransform
  /** Manual coordinator override for the final code. Takes precedence if set. Server-only, never sent to participants. */
  finalCodeOverride?: string
  /** Assigned Constraint Breach variant id for the final module (server-only reference). */
  constraintBreachVariantId?: string
  /**
   * Coordinator-controlled readiness flag for the final (Constraint Breach)
   * module. This is DISTINCT from `finalPuzzleCompleted` (which can only
   * ever be set by a server-validated Constraint Breach submission). Setting
   * this to true does not complete, solve, or escape anything by itself —
   * it is one of two conditions (the other being `recoveryCodeUnlocked`)
   * required before the participant-facing Constraint Breach interface
   * (GET/POST /api/teams/:id/constraint-breach*) becomes reachable at all.
   */
  finalModuleEnabled?: boolean
  /** Set true once Hint 1 has been legitimately used, revealing the 4th forbidden cell. */
  constraintBreachHintRevealed?: boolean
  maxTimeSeconds: number // default 25 * 60 (25 minutes)

  status: TeamStatus
  startedAt?: number // epoch ms
  pausedAt?: number // epoch ms
  totalPausedMs: number // accumulated paused duration in ms
  finishedAt?: number // epoch ms — set once on ESCAPED or TIME_EXPIRED

  // 4 initial parallel puzzles completion tracking
  puzzleCompleted: Record<InitialPuzzleSlotKey, boolean>
  // 5th final collaborative puzzle completion tracking
  finalPuzzleCompleted: boolean
  // Output fragments recorded for each slot
  puzzleOutputs: Record<string, string>

  /** Number of hints used (0-3). Sequential order: 1 -> 2 -> 3. */
  hintsUsed: number
  hintLevelLog: { level: HintLevel; timestamp: number }[]

  attempts: number
  attemptLog: { code: string; correct: boolean; timestamp: number }[]
  maxAttempts?: number // optional cap

  // ---------------------------------------------------------------------
  // RECOVERY CODE — 4-digit code (Module 01-04 digits, fixed order).
  // Unlocks the final module but does NOT by itself complete the escape.
  // Kept separate from `attempts`/`attemptLog` (final-code scoring) because
  // recovery-code attempts are not part of the official ranking.
  // ---------------------------------------------------------------------
  recoveryCodeUnlocked?: boolean
  recoveryAttempts?: number
  recoveryAttemptLog?: { code: string; correct: boolean; timestamp: number }[]

  // ---------------------------------------------------------------------
  // FROZEN RESULT — single authoritative source of truth set upon finish
  // ---------------------------------------------------------------------
  completionSeconds?: number
  hintPenaltySeconds?: number
  officialRankingSeconds?: number

  // ---------------------------------------------------------------------
  // CONCURRENCY CONTROL
  // ---------------------------------------------------------------------
  /** Optimistic-concurrency version. Incremented on every persisted write. */
  version: number
  updatedAt: number
}

/**
 * Safe subset of Team sent to participant (non-coordinator) clients.
 * `contactEmail`/`contactMobile` are coordinator-only private contact
 * details and must never reach a participant/public caller.
 */
export type ParticipantTeamView = Omit<
  Team,
  'finalCodeOverride' | 'constraintBreachVariantId' | 'finalCodeTransform' | 'contactEmail' | 'contactMobile'
>

export interface GameSettings {
  defaultMaxTimeSeconds: number // default 25 * 60
  /** Public registrations are accepted only while this coordinator-controlled gate is open. */
  registrationOpen: boolean
  /**
   * Coordinator-controlled gate for the public leaderboard page/endpoint.
   * Defaults to false (LOCKED) — the public leaderboard reveals nothing
   * until a coordinator explicitly unlocks it, regardless of how many
   * teams have already finished.
   */
  publicLeaderboardUnlocked: boolean
}

export interface AppState {
  settings: GameSettings
  puzzleVersions: PuzzleVersion[]
  teams: Team[]
  activeTeamId: string | null
}

// ============================================================================
// AUDIT LOG
// ============================================================================

export type AuditEventType =
  | 'TEAM_REGISTERED'
  | 'TEAM_APPROVED'
  | 'TEAM_REJECTED'
  | 'TEAM_EDITED'
  | 'TEAM_DETAILS_UPDATED'
  | 'TEAM_DELETED'
  | 'GAME_STARTED'
  | 'GAME_PAUSED'
  | 'GAME_RESUMED'
  | 'PUZZLE_COMPLETED'
  | 'RECOVERY_CODE_ATTEMPT'
  | 'HINT_USED'
  | 'CONSTRAINT_BREACH_COMPLETED'
  | 'FINAL_CODE_ATTEMPT'
  | 'TEAM_ESCAPED'
  | 'TIME_EXPIRED'
  | 'RESET_PERFORMED'
  | 'RESULT_DELETED'
  | 'PUBLIC_LEADERBOARD_UNLOCKED'
  | 'PUBLIC_LEADERBOARD_LOCKED'
  | 'REGISTRATION_OPENED'
  | 'REGISTRATION_CLOSED'
  | 'PUZZLE_VARIANT_CREATED'
  | 'PUZZLE_VARIANT_UPDATED'
  | 'PUZZLE_VARIANT_ASSIGNED'
  | 'COORDINATOR_LOGIN'
  | 'COORDINATOR_LOGIN_FAILED'

export interface AuditEvent {
  id: string
  type: AuditEventType
  teamId?: string
  actor: 'coordinator' | 'participant' | 'system'
  timestamp: number
  metadata?: Record<string, unknown>
}
