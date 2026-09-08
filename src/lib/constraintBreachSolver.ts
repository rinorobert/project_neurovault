import type { CellCoord, ConstraintBreachVariant } from '../types'

// ============================================================================
// CONSTRAINT BREACH — N-QUEENS SOLVER & SUBMISSION VALIDATOR
// ----------------------------------------------------------------------------
// Pure, side-effect-free puzzle logic ONLY. No answer keys or fixture data
// live in this file (that would ship it straight into the client bundle
// wherever this module is imported). See src/server/puzzleData/
// constraintVariants.ts for the actual (server-only) variant definitions.
//
// This solver implements an exact backtracking constraint satisfaction
// algorithm for an 8x8 grid. It enforces:
// 1. Exactly 1 agent per row (8 total agents)
// 2. Exactly 1 agent per column
// 3. No two agents on the same major diagonal (r - c) or minor diagonal (r + c)
// 4. Fixed agent coordinates must be occupied
// 5. Forbidden / corrupted cells cannot be occupied
// ============================================================================

export type { CellCoord }

export interface SolverResult {
  solutionCount: number
  solutions: CellCoord[][]
  isValidUniqueVariant: boolean
}

/**
 * Solves the 8-Queens problem on an 8x8 grid subject to fixed positions
 * and forbidden cells. Used at puzzle-design time to verify a variant has
 * exactly one solution — never called on a live participant submission
 * (that uses validateConstraintBreachSubmission, an O(1) equality check).
 */
export function solveConstraintBreach(
  fixedAgents: CellCoord[],
  forbiddenCells: CellCoord[] = [],
  maxSolutions: number = 100
): SolverResult {
  const BOARD_SIZE = 8
  const fixedMap = new Map<number, number>()
  for (const { row, col } of fixedAgents) {
    if (fixedMap.has(row) && fixedMap.get(row) !== col) {
      // Direct contradiction: two fixed agents in same row
      return { solutionCount: 0, solutions: [], isValidUniqueVariant: false }
    }
    fixedMap.set(row, col)
  }

  // Pre-validate fixed agents among themselves
  const fixedList = Array.from(fixedMap.entries()).map(([row, col]) => ({ row, col }))
  for (let i = 0; i < fixedList.length; i++) {
    for (let j = i + 1; j < fixedList.length; j++) {
      const a = fixedList[i]
      const b = fixedList[j]
      if (
        a.col === b.col ||
        Math.abs(a.row - b.row) === Math.abs(a.col - b.col)
      ) {
        return { solutionCount: 0, solutions: [], isValidUniqueVariant: false }
      }
    }
  }

  // Build forbidden lookup
  const forbiddenSet = new Set<string>()
  for (const { row, col } of forbiddenCells) {
    forbiddenSet.add(`${row},${col}`)
  }

  // Ensure fixed agents are not in forbidden cells
  for (const { row, col } of fixedAgents) {
    if (forbiddenSet.has(`${row},${col}`)) {
      return { solutionCount: 0, solutions: [], isValidUniqueVariant: false }
    }
  }

  const solutions: CellCoord[][] = []
  const colsUsed = new Set<number>()
  const diag1Used = new Set<number>() // row - col
  const diag2Used = new Set<number>() // row + col
  const currentPlacement: number[] = new Array(BOARD_SIZE).fill(-1)

  function backtrack(row: number) {
    if (solutions.length >= maxSolutions) return
    if (row === BOARD_SIZE) {
      solutions.push(
        currentPlacement.map((col, r) => ({ row: r, col }))
      )
      return
    }

    if (fixedMap.has(row)) {
      const col = fixedMap.get(row)!
      const d1 = row - col
      const d2 = row + col
      if (
        !colsUsed.has(col) &&
        !diag1Used.has(d1) &&
        !diag2Used.has(d2) &&
        !forbiddenSet.has(`${row},${col}`)
      ) {
        colsUsed.add(col)
        diag1Used.add(d1)
        diag2Used.add(d2)
        currentPlacement[row] = col

        backtrack(row + 1)

        currentPlacement[row] = -1
        diag2Used.delete(d2)
        diag1Used.delete(d1)
        colsUsed.delete(col)
      }
      return
    }

    for (let col = 0; col < BOARD_SIZE; col++) {
      const d1 = row - col
      const d2 = row + col
      if (
        !colsUsed.has(col) &&
        !diag1Used.has(d1) &&
        !diag2Used.has(d2) &&
        !forbiddenSet.has(`${row},${col}`)
      ) {
        colsUsed.add(col)
        diag1Used.add(d1)
        diag2Used.add(d2)
        currentPlacement[row] = col

        backtrack(row + 1)

        currentPlacement[row] = -1
        diag2Used.delete(d2)
        diag1Used.delete(d1)
        colsUsed.delete(col)
      }
    }
  }

  backtrack(0)

  return {
    solutionCount: solutions.length,
    solutions,
    isValidUniqueVariant: solutions.length === 1,
  }
}

/**
 * Server-side validation of a participant's submitted board.
 *
 * Because a legitimate variant is (by construction, verified via
 * solveConstraintBreach at authoring time) guaranteed to have exactly ONE
 * valid solution, correctness is decided by structural validation of the
 * submission PLUS exact equality against the stored solution — not by
 * re-running the solver against arbitrary participant input.
 */
export function validateConstraintBreachSubmission(
  submission: Array<{ agentId: number; row: number; col: number }>,
  variant: ConstraintBreachVariant,
  forbiddenCellsInPlay: CellCoord[]
): boolean {
  if (!Array.isArray(submission) || submission.length !== 8) return false

  const agentIds = new Set(submission.map((s) => s.agentId))
  const rows = new Set(submission.map((s) => s.row))
  const cols = new Set(submission.map((s) => s.col))
  if (agentIds.size !== 8 || rows.size !== 8 || cols.size !== 8) return false
  for (let i = 1; i <= 8; i++) if (!agentIds.has(i)) return false
  for (let i = 0; i < 8; i++) {
    if (!rows.has(i) || !cols.has(i)) return false
  }

  // No two agents may share a diagonal.
  const diag1 = new Set<number>()
  const diag2 = new Set<number>()
  for (const { row, col } of submission) {
    const d1 = row - col
    const d2 = row + col
    if (diag1.has(d1) || diag2.has(d2)) return false
    diag1.add(d1)
    diag2.add(d2)
  }

  // No agent may sit on a forbidden cell currently in play.
  const forbiddenSet = new Set(forbiddenCellsInPlay.map((c) => `${c.row},${c.col}`))
  for (const { row, col } of submission) {
    if (forbiddenSet.has(`${row},${col}`)) return false
  }

  // Fixed agents must be exactly where the variant requires.
  for (const fixed of variant.fixedAgents) {
    const match = submission.find((s) => s.agentId === fixed.agentId)
    if (!match || match.row !== fixed.row || match.col !== fixed.col) return false
  }

  // Finally, the submission must match the unique known solution exactly.
  const submittedKey = [...submission]
    .sort((a, b) => a.agentId - b.agentId)
    .map((s) => `${s.agentId}:${s.row}:${s.col}`)
    .join('|')
  const solutionKey = [...variant.solution]
    .sort((a, b) => a.agentId - b.agentId)
    .map((s) => `${s.agentId}:${s.row}:${s.col}`)
    .join('|')

  return submittedKey === solutionKey
}

/**
 * FINAL OVERRIDE CODE — read agent IDs left to right, Column A (0) through
 * Column H (7), from a validated placement.
 */
export function deriveOverrideCodeFromPlacement(
  placement: Array<{ agentId: number; row: number; col: number }>
): string {
  const byColumn = new Array(8).fill(0)
  for (const { agentId, col } of placement) {
    if (col >= 0 && col < 8) byColumn[col] = agentId
  }
  return byColumn.join('')
}
