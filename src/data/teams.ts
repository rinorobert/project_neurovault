import type { Team, TeamPuzzleAssignment, PuzzleVersion } from '../types'
import { ALL_PUZZLE_SLOTS } from '../types'

// ============================================================================
// PROJECT NEUROVAULT — Team Factory
// ----------------------------------------------------------------------------
// There is intentionally NO sample/demo team data in this file (or anywhere
// in the production code path). Production starts with zero teams; every
// Team record is created either through public registration (POST
// /api/register) or coordinator manual entry (POST /api/teams), both of
// which route through `newTeamDraft()` below and are persisted with a
// server-generated id (see src/server/db/client.ts).
// ============================================================================

export function defaultPuzzleAssignments(puzzleVersions: PuzzleVersion[]): TeamPuzzleAssignment[] {
  return ALL_PUZZLE_SLOTS.map((slot) => ({
    slot,
    puzzleVersionId: puzzleVersions.find((v) => v.slot === slot)?.id ?? '',
  }))
}

export interface NewTeamInput {
  name: string
  members: string[]
  captain: string
  contactEmail: string
  /** Must already be validated/normalized (see src/server/validation.ts) before reaching here. */
  contactMobile: string
  registrationSource: 'PUBLIC_FORM' | 'COORDINATOR_MANUAL'
  maxTimeSeconds: number
  puzzleAssignments: TeamPuzzleAssignment[]
}

/**
 * Builds a full Team record ready to persist. `id` and `version`/`updatedAt`
 * are intentionally NOT set here — the database layer assigns those
 * atomically so two coordinator devices creating teams at the same moment
 * can never collide (see DatabaseRepository.createTeam).
 */
export function newTeamDraft(input: NewTeamInput): Omit<Team, 'id' | 'version' | 'updatedAt'> {
  const now = Date.now()
  return {
    name: input.name,
    members: input.members,
    captain: input.captain,
    contactEmail: input.contactEmail,
    contactMobile: input.contactMobile,
    registrationStatus: 'PENDING',
    registeredAt: now,
    registrationSource: input.registrationSource,
    puzzleAssignments: input.puzzleAssignments,
    finalCodeTransform: {},
    finalModuleEnabled: false,
    maxTimeSeconds: input.maxTimeSeconds,
    status: 'NOT_STARTED',
    totalPausedMs: 0,
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
  }
}
