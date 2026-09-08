import type { PuzzleVersion, Team, InitialPuzzleSlotKey } from '../types'
import { INITIAL_PUZZLE_SLOTS } from '../types'

// ============================================================================
// PROJECT NEUROVAULT — Recovery Code Resolver (SERVER-ONLY)
// ----------------------------------------------------------------------------
// NEUROVAULT // RECOVERY CODE = Module 01 digit + Module 02 digit +
// Module 03 digit + Module 04 digit, ALWAYS in that fixed order — regardless
// of which order the 4 parallel stations were actually finished in.
//
// This module must only ever be called from server code (apiRouter.ts) with
// the FULL (non-sanitized) PuzzleVersion list, since it reads `outputDigit`
// (answer-key data). The computed/expected code itself must never be sent
// to a participant — only `validateFinalCode`'s boolean result is.
// ============================================================================

const FIXED_ORDER: InitialPuzzleSlotKey[] = INITIAL_PUZZLE_SLOTS // SLOT_1..SLOT_4, fixed

export interface FinalCodeResolver {
  compute(team: Team, puzzleVersions: PuzzleVersion[]): string
  validate(entered: string, team: Team, puzzleVersions: PuzzleVersion[]): boolean
}

export const defaultFinalCodeResolver: FinalCodeResolver = {
  compute(team: Team, puzzleVersions: PuzzleVersion[]): string {
    // 1. Manual coordinator override always takes absolute precedence.
    if (team.finalCodeOverride && team.finalCodeOverride.trim() !== '') {
      return team.finalCodeOverride.trim()
    }

    // 2. Build map of slot output digits.
    const digitsBySlot = new Map<InitialPuzzleSlotKey, number>()
    for (const assignment of team.puzzleAssignments) {
      if (assignment.slot === 'FINAL_SLOT') continue
      const pv = puzzleVersions.find((v) => v.id === assignment.puzzleVersionId)
      if (pv && pv.outputDigit !== undefined) {
        digitsBySlot.set(assignment.slot, pv.outputDigit)
      } else if (team.puzzleOutputs && team.puzzleOutputs[assignment.slot]) {
        const parsed = parseInt(team.puzzleOutputs[assignment.slot], 10)
        if (!isNaN(parsed)) digitsBySlot.set(assignment.slot, Math.abs(parsed) % 10)
      }
    }

    // 3. ALWAYS fixed order: Module 01 -> 02 -> 03 -> 04. Finish order, and
    //    any legacy `finalCodeTransform.order`, are ignored on purpose.
    const offset = team.finalCodeTransform?.digitOffset ?? 0
    const digits = FIXED_ORDER.map((slot) => {
      const raw = digitsBySlot.get(slot) ?? 0
      return (raw + offset + 10) % 10
    })

    return digits.join('')
  },

  validate(entered: string, team: Team, puzzleVersions: PuzzleVersion[]): boolean {
    const expected = this.compute(team, puzzleVersions)
    return entered.trim() === expected.trim()
  },
}

export function computeFinalCode(
  team: Team,
  allPuzzleVersions: PuzzleVersion[],
  resolver: FinalCodeResolver = defaultFinalCodeResolver
): string {
  return resolver.compute(team, allPuzzleVersions)
}

export function validateFinalCode(
  entered: string,
  team: Team,
  allPuzzleVersions: PuzzleVersion[],
  resolver: FinalCodeResolver = defaultFinalCodeResolver
): boolean {
  return resolver.validate(entered, team, allPuzzleVersions)
}

// ----------------------------------------------------------------------------
// RECOVERY CODE — this resolver computes exactly the 4-digit
// Module01->02->03->04 code described in the brief. It is named
// `computeFinalCode`/`validateFinalCode` above for backward compatibility
// with the existing engine/tests, but the NEUROVAULT // RECOVERY CODE
// concept (unlocks the final module, does not itself escape) uses the same
// underlying computation — see computeRecoveryCode/validateRecoveryCode,
// which apiRouter.ts uses for the dedicated recovery-code endpoint.
// ----------------------------------------------------------------------------
export const computeRecoveryCode = computeFinalCode
export const validateRecoveryCode = validateFinalCode
