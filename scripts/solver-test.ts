import {
  solveConstraintBreach,
  validateConstraintBreachSubmission,
  deriveOverrideCodeFromPlacement,
} from '../src/lib/constraintBreachSolver'
import { CB_DEV_FIXTURE_VARIANTS } from '../src/server/puzzleData/constraintVariants'

console.log('================================================================')
console.log('CONSTRAINT BREACH — N-QUEENS SOLVER & FIXTURE VALIDATION')
console.log('================================================================\n')

let failures = 0
function check(label: string, cond: boolean) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}`)
  if (!cond) failures++
}

// 1. Test standard unconstrained 8-queens
const unconstrained = solveConstraintBreach([])
check('Standard 8x8 unconstrained board has 92 solutions', unconstrained.solutionCount === 92)

// 2. Test impossible board (two fixed queens in same row or diagonal)
const invalidFixed = solveConstraintBreach([
  { row: 0, col: 0 },
  { row: 1, col: 1 },
])
check('Direct diagonal conflict returns 0 solutions', invalidFixed.solutionCount === 0 && !invalidFixed.isValidUniqueVariant)

// 3. Test dev fixture variants
for (const variant of CB_DEV_FIXTURE_VARIANTS) {
  console.log(`\nTesting Variant: ${variant.id} (${variant.metadata})`)

  const fixedCells = variant.fixedAgents.map((a) => ({ row: a.row, col: a.col }))

  // Check with initial 3 forbidden cells
  const resInitial = solveConstraintBreach(fixedCells, variant.initialForbiddenCells)
  check(`${variant.id}: exactly 1 unique solution with initial forbidden cells`, resInitial.solutionCount === 1)

  // Check that the solution matches expected
  const found = resInitial.solutions[0]
  let matches = Boolean(found && found.length === 8)
  if (matches) {
    for (const solCoord of variant.solution) {
      if (!found.some((c) => c.row === solCoord.row && c.col === solCoord.col)) {
        matches = false
        break
      }
    }
  }
  check(`${variant.id}: verified unique solution matches expected solution coordinates`, matches)

  // Check with 4th hint forbidden cell added
  const resWithHint = solveConstraintBreach(
    fixedCells,
    [...variant.initialForbiddenCells, variant.hiddenHintForbiddenCell]
  )
  check(`${variant.id}: solution remains unique (= 1) after Hint 1 reveals 4th cell`, resWithHint.solutionCount === 1)

  // 4. Server-side submission validation — correct submission accepted
  const correctSubmission = variant.solution.map((s) => ({ ...s }))
  check(
    `${variant.id}: validateConstraintBreachSubmission accepts the true solution`,
    validateConstraintBreachSubmission(correctSubmission, variant, variant.initialForbiddenCells)
  )

  // 5. Wrong submission (swap two agents' columns) is rejected
  const tampered = correctSubmission.map((s) => ({ ...s }))
  ;[tampered[0].col, tampered[1].col] = [tampered[1].col, tampered[0].col]
  check(
    `${variant.id}: validateConstraintBreachSubmission rejects a tampered board`,
    !validateConstraintBreachSubmission(tampered, variant, variant.initialForbiddenCells)
  )

  // 6. Submission occupying a forbidden cell is rejected even if otherwise correct
  check(
    `${variant.id}: validateConstraintBreachSubmission rejects placement on a forbidden cell`,
    !validateConstraintBreachSubmission(correctSubmission, variant, [
      ...variant.initialForbiddenCells,
      { row: correctSubmission[0].row, col: correctSubmission[0].col },
    ])
  )

  // 7. Fixed-agent mismatch is rejected
  const fixedMismatch = correctSubmission.map((s) =>
    s.agentId === variant.fixedAgents[0].agentId ? { ...s, col: (s.col + 1) % 8 } : s
  )
  check(
    `${variant.id}: validateConstraintBreachSubmission rejects a moved fixed agent`,
    !validateConstraintBreachSubmission(fixedMismatch, variant, variant.initialForbiddenCells)
  )

  // 8. Override code derivation reads column A -> H as agent IDs
  const code = deriveOverrideCodeFromPlacement(variant.solution)
  check(`${variant.id}: derived override code is an 8-digit string`, /^[1-8]{8}$/.test(code))
  const byCol = new Array(8).fill(0)
  for (const s of variant.solution) byCol[s.col] = s.agentId
  check(`${variant.id}: derived override code matches manual column reading`, code === byCol.join(''))
}

console.log(`\n${failures === 0 ? 'ALL SOLVER TESTS PASSED' : failures + ' TEST(S) FAILED'}`)
process.exit(failures === 0 ? 0 : 1)
