import type { ConstraintBreachVariant } from '../../types'

// ============================================================================
// PROJECT NEUROVAULT — Constraint Breach Variant Data (SERVER-ONLY)
// ----------------------------------------------------------------------------
// !! DO NOT IMPORT THIS FILE FROM src/pages, src/components, src/state, OR
// !! src/lib. Every one of those directories can end up in the client
// !! JS bundle. This file contains `solution` and `hiddenHintForbiddenCell`
// !! — the actual answer key for the final module. It must only ever be
// !! imported from other files under src/server/.
//
// These 3 variants are DEVELOPMENT/PLAYTEST FIXTURES, verified unique via
// solveConstraintBreach() (see scripts/solver-test.ts). Per the brief,
// Constraint Breach is still being playtested — do not treat these as
// final event content. Swap in the real event-specific variant(s) here
// (or load them from the database) once the puzzle design is locked.
// ============================================================================

/**
 * Standard 8-Queens Solution 1: [0, 4, 7, 5, 2, 6, 1, 3]
 * Coordinates: (0,0), (1,4), (2,7), (3,5), (4,2), (5,6), (6,1), (7,3)
 * Agent IDs follow row+1 by convention (agent 1 = row 0, ... agent 8 = row 7).
 */
export const CB_DEV_VAR_01: ConstraintBreachVariant = {
  id: 'CB_DEV_VAR_01',
  difficulty: 'medium',
  fixedAgents: [
    { agentId: 1, row: 0, col: 0 },
    { agentId: 2, row: 1, col: 4 },
    { agentId: 5, row: 4, col: 2 },
  ],
  initialForbiddenCells: [
    { row: 2, col: 3 },
    { row: 3, col: 1 },
    { row: 6, col: 4 },
  ],
  hiddenHintForbiddenCell: { row: 5, col: 1 },
  solution: [
    { agentId: 1, row: 0, col: 0 },
    { agentId: 2, row: 1, col: 4 },
    { agentId: 3, row: 2, col: 7 },
    { agentId: 4, row: 3, col: 5 },
    { agentId: 5, row: 4, col: 2 },
    { agentId: 6, row: 5, col: 6 },
    { agentId: 7, row: 6, col: 1 },
    { agentId: 8, row: 7, col: 3 },
  ],
  solutionCount: 1,
  metadata: 'Dev/Playtest Fixture Alpha (Verified Unique)',
}

/**
 * Standard 8-Queens Solution 2: [1, 3, 5, 7, 2, 0, 6, 4]
 * Coordinates: (0,1), (1,3), (2,5), (3,7), (4,2), (5,0), (6,6), (7,4)
 */
export const CB_DEV_VAR_02: ConstraintBreachVariant = {
  id: 'CB_DEV_VAR_02',
  difficulty: 'medium',
  fixedAgents: [
    { agentId: 1, row: 0, col: 1 },
    { agentId: 4, row: 3, col: 7 },
    { agentId: 6, row: 5, col: 0 },
  ],
  initialForbiddenCells: [
    { row: 1, col: 6 },
    { row: 4, col: 6 },
    { row: 6, col: 2 },
  ],
  hiddenHintForbiddenCell: { row: 2, col: 0 },
  solution: [
    { agentId: 1, row: 0, col: 1 },
    { agentId: 2, row: 1, col: 3 },
    { agentId: 3, row: 2, col: 5 },
    { agentId: 4, row: 3, col: 7 },
    { agentId: 5, row: 4, col: 2 },
    { agentId: 6, row: 5, col: 0 },
    { agentId: 7, row: 6, col: 6 },
    { agentId: 8, row: 7, col: 4 },
  ],
  solutionCount: 1,
  metadata: 'Dev/Playtest Fixture Beta (Verified Unique)',
}

/**
 * Standard 8-Queens Solution 3: [2, 5, 7, 0, 3, 6, 4, 1]
 * Coordinates: (0,2), (1,5), (2,7), (3,0), (4,3), (5,6), (6,4), (7,1)
 */
export const CB_DEV_VAR_03: ConstraintBreachVariant = {
  id: 'CB_DEV_VAR_03',
  difficulty: 'medium',
  fixedAgents: [
    { agentId: 1, row: 0, col: 2 },
    { agentId: 4, row: 3, col: 0 },
    { agentId: 7, row: 6, col: 4 },
  ],
  initialForbiddenCells: [
    { row: 1, col: 1 },
    { row: 4, col: 7 },
    { row: 7, col: 6 },
  ],
  hiddenHintForbiddenCell: { row: 5, col: 1 },
  solution: [
    { agentId: 1, row: 0, col: 2 },
    { agentId: 2, row: 1, col: 5 },
    { agentId: 3, row: 2, col: 7 },
    { agentId: 4, row: 3, col: 0 },
    { agentId: 5, row: 4, col: 3 },
    { agentId: 6, row: 5, col: 6 },
    { agentId: 7, row: 6, col: 4 },
    { agentId: 8, row: 7, col: 1 },
  ],
  solutionCount: 1,
  metadata: 'Dev/Playtest Fixture Gamma (Verified Unique)',
}

export const CB_DEV_FIXTURE_VARIANTS: ConstraintBreachVariant[] = [
  CB_DEV_VAR_01,
  CB_DEV_VAR_02,
  CB_DEV_VAR_03,
]

export function getConstraintVariantById(id: string): ConstraintBreachVariant | null {
  return CB_DEV_FIXTURE_VARIANTS.find((v) => v.id === id) ?? null
}
