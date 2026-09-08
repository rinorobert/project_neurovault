import type { PuzzleVersion, PuzzleSlotKey } from '../types.js'

// ============================================================================
// PROJECT NEUROVAULT — Production Puzzle Slot Defaults
// ----------------------------------------------------------------------------
// These are the puzzle records a fresh production database starts with.
// They are intentionally empty of any answer key: Memory Archive and
// Constraint Breach are still being playtested, and Modules 02-04 have no
// approved mechanic yet. Every slot starts DESIGN_PENDING with no `answer`,
// `outputDigit`, or `hint` field set at all — there is nothing here for a
// participant (or an attacker) to read, because there is nothing to leak.
//
// A coordinator configures real content per team through the Coordinator
// Dashboard (which PATCHes a real PuzzleVersion with real answer data) once
// each module's mechanic is finalized. This file only defines the SHAPE of
// the 5 slots so the platform, state machine, and API have something to
// point `TeamPuzzleAssignment` records at from day one.
//
// Fully-worked EXAMPLE puzzle content (with real answers) lives in
// src/data/devFixtures.ts and is used only by local dev seeding and the
// automated test suite — never by the production database.
// ============================================================================

export const PRODUCTION_PUZZLE_VERSIONS: PuzzleVersion[] = [
  {
    id: 'NV_MOD_01_PENDING',
    slot: 'SLOT_1',
    version: 'PENDING',
    title: 'Module 01 — Memory Archive (Design Pending)',
    category: 'MEMORY / OBSERVATION',
    difficulty: 'medium',
    status: 'DESIGN_PENDING',
    completionMode: 'COORDINATOR_ONLY',
    clue:
      'This station is still being playtested. A coordinator will configure the final Memory Archive ' +
      'content (a short observation sequence and questions) before the event and mark completion once ' +
      'a team has physically solved it.',
  },
  {
    id: 'NV_MOD_02_PENDING',
    slot: 'SLOT_2',
    version: 'PENDING',
    title: 'Module 02 (Design Pending)',
    category: 'UNDECIDED',
    difficulty: 'medium',
    status: 'DESIGN_PENDING',
    completionMode: 'COORDINATOR_ONLY',
    clue: 'This module\'s mechanic has not been finalized yet. Configure it once the puzzle design is locked.',
  },
  {
    id: 'NV_MOD_03_PENDING',
    slot: 'SLOT_3',
    version: 'PENDING',
    title: 'Module 03 (Design Pending)',
    category: 'UNDECIDED',
    difficulty: 'medium',
    status: 'DESIGN_PENDING',
    completionMode: 'COORDINATOR_ONLY',
    clue: 'This module\'s mechanic has not been finalized yet. Configure it once the puzzle design is locked.',
  },
  {
    id: 'NV_MOD_04_PENDING',
    slot: 'SLOT_4',
    version: 'PENDING',
    title: 'Module 04 (Design Pending)',
    category: 'UNDECIDED',
    difficulty: 'medium',
    status: 'DESIGN_PENDING',
    completionMode: 'COORDINATOR_ONLY',
    clue: 'This module\'s mechanic has not been finalized yet. Configure it once the puzzle design is locked.',
  },
  {
    id: 'NV_FINAL_MOD_PENDING',
    slot: 'FINAL_SLOT',
    version: 'PENDING',
    title: 'Constraint Breach (Design Pending)',
    category: 'COLLABORATIVE CONSTRAINT RESTORATION',
    difficulty: 'hard',
    status: 'DESIGN_PENDING',
    // Once a specific ConstraintBreachVariant is finalized and assigned to a
    // team (Team.constraintBreachVariantId), the final module becomes
    // SERVER_VALIDATED: the grid submission endpoint checks it server-side.
    completionMode: 'SERVER_VALIDATED',
    clue:
      'Restore the corrupted 8x8 core matrix. All four operators must collaborate to place the 8 ' +
      'autonomous agents under the event-specific constraints. This puzzle is still being playtested.',
  },
]

export function getPuzzleVersionsBySlot(
  versions: PuzzleVersion[],
  slot: PuzzleSlotKey
): PuzzleVersion[] {
  return versions.filter((v) => v.slot === slot)
}
