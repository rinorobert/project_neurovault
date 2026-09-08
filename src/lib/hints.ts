import type { HintLevel } from '../types.js'

// ============================================================================
// Fixed 3-level hint penalty system.
// ----------------------------------------------------------------------------
// Hints are a SCORING penalty only — they never touch the live countdown.
// Levels must be used strictly in order (1, then 2, then 3), max 3 total.
// ============================================================================

export const MAX_HINTS = 3

/** Index 0 = Hint 1 penalty, index 1 = Hint 2 penalty, index 2 = Hint 3 penalty. */
export const HINT_PENALTIES_SECONDS: readonly [number, number, number] = [30, 60, 90]

export function penaltyForLevel(level: HintLevel): number {
  return HINT_PENALTIES_SECONDS[level - 1]
}

/** Total penalty for having used `count` hint levels (0-3), summing levels 1..count. */
export function hintPenaltyForCount(count: number): number {
  const clamped = Math.max(0, Math.min(MAX_HINTS, count))
  let total = 0
  for (let i = 0; i < clamped; i++) total += HINT_PENALTIES_SECONDS[i]
  return total
}
