import type { ConstraintBreachVariant } from '../../types.js'
import { deriveOverrideCodeFromPlacement, solveConstraintBreach } from '../../lib/constraintBreachSolver.js'

// ============================================================================
// PROJECT NEUROVAULT — Constraint Breach Variant Data (SERVER-ONLY)
// ----------------------------------------------------------------------------
// !! DO NOT IMPORT THIS FILE FROM src/pages, src/components, src/state, OR
// !! src/lib. Every one of those directories can end up in the client
// !! JS bundle. This file contains `solution`, `overrideCode`, and
// !! `hiddenHintForbiddenCell` — the actual answer key for the final module.
// !! It must only ever be imported from other files under src/server/.
// ============================================================================

/**
 * Algebraic coordinate helpers:
 * Column / File: A -> 0, B -> 1, C -> 2, D -> 3, E -> 4, F -> 5, G -> 6, H -> 7
 * Row / Rank:    1 -> 0, 2 -> 1, 3 -> 2, 4 -> 3, 5 -> 4, 6 -> 5, 7 -> 6, 8 -> 7
 */
export function algToCoord(alg: string): { row: number; col: number } {
  const col = alg.toUpperCase().charCodeAt(0) - 65
  const row = parseInt(alg[1], 10) - 1
  return { row, col }
}

export function coordToAlg(row: number, col: number): string {
  return `${String.fromCharCode(65 + col)}${row + 1}`
}

type ConstraintBreachVariantInput = Omit<
  ConstraintBreachVariant,
  'solution' | 'solutionCount' | 'overrideCode'
> & {
  /** Agent labels are physical-board labels; placement coordinates are solved below. */
  agentIdsByColumn: number[]
}

/**
 * Makes the physical board configuration authoritative. The unique solution
 * and final override are derived from its fixed/forbidden constraints, so a
 * code can never drift independently from the puzzle that produces it.
 */
function buildConstraintBreachVariant({ agentIdsByColumn, ...input }: ConstraintBreachVariantInput): ConstraintBreachVariant {
  if (agentIdsByColumn.length !== 8 || new Set(agentIdsByColumn).size !== 8) {
    throw new Error(`${input.id}: exactly eight unique physical agent IDs are required.`)
  }
  const solved = solveConstraintBreach(
    input.fixedAgents.map(({ row, col }) => ({ row, col })),
    [...input.initialForbiddenCells, input.hiddenHintForbiddenCell]
  )
  if (!solved.isValidUniqueVariant || !solved.solutions[0]) {
    throw new Error(`${input.id}: physical constraints must produce exactly one solution after Hint 1.`)
  }

  const solution = solved.solutions[0].map(({ row, col }) => ({
    agentId: agentIdsByColumn[col],
    row,
    col,
  }))
  for (const fixed of input.fixedAgents) {
    const solvedCell = solution.find((cell) => cell.agentId === fixed.agentId)
    if (!solvedCell || solvedCell.row !== fixed.row || solvedCell.col !== fixed.col) {
      throw new Error(`${input.id}: fixed agent ${fixed.agentId} does not match the solved physical board.`)
    }
  }

  return {
    ...input,
    solution,
    solutionCount: solved.solutionCount,
    overrideCode: deriveOverrideCodeFromPlacement(solution),
  }
}

/**
 * PRODUCTION VARIANT 1: CB-01 — THE BREACH
 *
 * Fixed:
 *   Agent 2 -> H2
 *   Agent 5 -> A5
 *   Agent 6 -> G6
 *
 * Visible forbidden:
 *   H1, C5, F3
 *
 * Hint 1 reveals:
 *   D1
 *
 * Unique solution:
 *   A5, B3, C8, D4, E7, F1, G6, H2
 *
 * Final Override:
 *   53847162
 */
export const CB_01: ConstraintBreachVariant = buildConstraintBreachVariant({
  id: 'CB-01',
  name: 'CB-01 — THE BREACH',
  difficulty: 'medium',
  fixedAgents: [
    { agentId: 2, ...algToCoord('H2') },
    { agentId: 5, ...algToCoord('A5') },
    { agentId: 6, ...algToCoord('G6') },
  ],
  initialForbiddenCells: [
    algToCoord('H1'),
    algToCoord('C5'),
    algToCoord('F3'),
  ],
  hiddenHintForbiddenCell: algToCoord('D1'),
  agentIdsByColumn: [5, 3, 8, 4, 7, 1, 6, 2],
  metadata: 'CB-01 — THE BREACH (Production Variant 1)',
})

/**
 * PRODUCTION VARIANT 2: CB-02 — THE FRACTURE
 *
 * Fixed:
 *   Agent 2 -> B6
 *   Agent 5 -> E1
 *   Agent 6 -> F4
 *
 * Visible forbidden:
 *   H8, C7, G5
 *
 * Hint 1 reveals:
 *   D3
 *
 * Unique solution:
 *   A3, B6, C2, D7, E1, F4, G8, H5
 *
 * Final Override:
 *   36271485
 */
export const CB_02: ConstraintBreachVariant = buildConstraintBreachVariant({
  id: 'CB-02',
  name: 'CB-02 — THE FRACTURE',
  difficulty: 'medium',
  fixedAgents: [
    { agentId: 2, ...algToCoord('B6') },
    { agentId: 5, ...algToCoord('E1') },
    { agentId: 6, ...algToCoord('F4') },
  ],
  initialForbiddenCells: [
    algToCoord('H8'),
    algToCoord('C7'),
    algToCoord('G5'),
  ],
  hiddenHintForbiddenCell: algToCoord('D3'),
  agentIdsByColumn: [3, 2, 1, 7, 5, 6, 8, 4],
  metadata: 'CB-02 — THE FRACTURE (Production Variant 2)',
})

/**
 * PRODUCTION VARIANT 3: CB-03 — THE COLLAPSE
 *
 * Fixed:
 *   Agent 2 -> B8
 *   Agent 5 -> E1
 *   Agent 6 -> F7
 *
 * Visible forbidden:
 *   D6, C4, A3
 *
 * Hint 1 reveals:
 *   G5
 *
 * Unique solution:
 *   A4, B8, C5, D3, E1, F7, G2, H6
 *
 * Final Override:
 *   48531726
 */
export const CB_03: ConstraintBreachVariant = buildConstraintBreachVariant({
  id: 'CB-03',
  name: 'CB-03 — THE COLLAPSE',
  difficulty: 'medium',
  fixedAgents: [
    { agentId: 2, ...algToCoord('B8') },
    { agentId: 5, ...algToCoord('E1') },
    { agentId: 6, ...algToCoord('F7') },
  ],
  initialForbiddenCells: [
    algToCoord('D6'),
    algToCoord('C4'),
    algToCoord('A3'),
  ],
  hiddenHintForbiddenCell: algToCoord('G5'),
  agentIdsByColumn: [4, 2, 3, 1, 5, 6, 7, 8],
  metadata: 'CB-03 — THE COLLAPSE (Production Variant 3)',
})

export const CB_PRODUCTION_VARIANTS: ConstraintBreachVariant[] = [
  CB_01,
  CB_02,
  CB_03,
]

// Backward-compatible dev aliases for existing test suites
export const CB_DEV_VAR_01 = CB_01
export const CB_DEV_VAR_02 = CB_02
export const CB_DEV_VAR_03 = CB_03
export const CB_DEV_FIXTURE_VARIANTS = CB_PRODUCTION_VARIANTS

export function getConstraintVariantById(id: string): ConstraintBreachVariant | null {
  const normalized = id.trim().toUpperCase()
  return (
    CB_PRODUCTION_VARIANTS.find(
      (v) =>
        v.id.toUpperCase() === normalized ||
        (normalized === 'CB_DEV_VAR_01' && v.id === 'CB-01') ||
        (normalized === 'CB_DEV_VAR_02' && v.id === 'CB-02') ||
        (normalized === 'CB_DEV_VAR_03' && v.id === 'CB-03') ||
        (normalized === 'CB01' && v.id === 'CB-01') ||
        (normalized === 'CB02' && v.id === 'CB-02') ||
        (normalized === 'CB03' && v.id === 'CB-03')
    ) ?? null
  )
}
